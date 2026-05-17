import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runWakeCycle } from '@/lib/autonomous'
import { checkTaskLimit } from '@/lib/limits'

export const runtime = 'nodejs'
export const maxDuration = 300

// ── Every 2 hours: agents wake up, coordinate, act, sleep ───────────────────
export const schedule = '0 */2 * * *'

const CRON_SECRET = process.env.CRON_SECRET ?? ''

function sdb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function GET(req: NextRequest) {
  // Auth — Vercel cron sends the CRON_SECRET header
  const auth = req.headers.get('authorization')
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const startedAt = Date.now()
  const results: {
    company: string
    tasksCreated: number
    tasksExecuted: number
    messages: number
    errors: string[]
  }[] = []

  try {
    // ── 1. Unstick crashed tasks (>30 min in_progress) ────────────────────
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    const { data: stuckTasks } = await sdb()
      .from('tasks').select('id, title')
      .eq('status', 'in_progress').lt('started_at', thirtyMinAgo)

    for (const task of stuckTasks ?? []) {
      await sdb().from('tasks').update({
        status: 'todo', error: null, started_at: null,
      }).eq('id', task.id)
    }

    // ── 2. Get all companies with active users ────────────────────────────
    const { data: companies } = await sdb()
      .from('companies')
      .select('id, name')
      .limit(20) // safety cap

    if (!companies?.length) {
      return Response.json({ ok: true, message: 'No companies found', results: [] })
    }

    // ── 3. Throttle: skip companies that ran within 90 min ────────────────
    const ninetyMinAgo = new Date(Date.now() - 90 * 60 * 1000).toISOString()

    for (const company of companies) {
      // Check time limit — Vercel kills at 300s, stop at 240s to be safe
      if (Date.now() - startedAt > 240_000) {
        results.push({
          company: company.name,
          tasksCreated: 0, tasksExecuted: 0, messages: 0,
          errors: ['Skipped — approaching time limit'],
        })
        continue
      }

      // Throttle check
      const { data: lastRun } = await sdb()
        .from('autonomous_runs')
        .select('created_at')
        .eq('company_id', company.id)
        .gte('created_at', ninetyMinAgo)
        .limit(1)
        .single()

      if (lastRun) {
        results.push({
          company: company.name,
          tasksCreated: 0, tasksExecuted: 0, messages: 0,
          errors: ['Skipped — ran recently'],
        })
        continue
      }

      // ── 4. Check task limit before running wake cycle ────────────────
      // Get company owner's plan
      const { data: companyFull } = await sdb()
        .from('companies')
        .select('user_id')
        .eq('id', company.id)
        .single()

      if (companyFull) {
        const { data: ownerProfile } = await sdb()
          .from('profiles')
          .select('plan, plan_expires_at')
          .eq('id', companyFull.user_id)
          .single()

        let ownerPlan = ownerProfile?.plan ?? 'free'
        if (ownerPlan !== 'free' && ownerProfile?.plan_expires_at && new Date(ownerProfile.plan_expires_at) < new Date()) {
          ownerPlan = 'free'
        }

        const taskCheck = await checkTaskLimit(company.id, ownerPlan)
        if (!taskCheck.allowed) {
          results.push({
            company: company.name,
            tasksCreated: 0, tasksExecuted: 0, messages: 0,
            errors: [`Task limit reached (${taskCheck.used}/${taskCheck.limit})`],
          })
          continue
        }
      }

      // ── 5. Run the full wake cycle for this company ───────────────────
      try {
        const cycleResult = await runWakeCycle(company.id)
        results.push({
          company: cycleResult.companyName,
          tasksCreated: cycleResult.tasksCreated,
          tasksExecuted: cycleResult.tasksExecuted,
          messages: cycleResult.messagesRead,
          errors: cycleResult.errors,
        })
      } catch (err) {
        results.push({
          company: company.name,
          tasksCreated: 0, tasksExecuted: 0, messages: 0,
          errors: [err instanceof Error ? err.message : String(err)],
        })
      }
    }

    const elapsed = Math.round((Date.now() - startedAt) / 1000)
    const totalTasks = results.reduce((s, r) => s + r.tasksCreated, 0)
    const totalRan = results.reduce((s, r) => s + r.tasksExecuted, 0)
    const totalMsgs = results.reduce((s, r) => s + r.messages, 0)

    return Response.json({
      ok: true,
      elapsed_seconds: elapsed,
      companies_processed: results.filter(r => !r.errors.includes('Skipped — ran recently')).length,
      total_tasks_created: totalTasks,
      total_tasks_executed: totalRan,
      total_agent_messages: totalMsgs,
      stuck_tasks_reset: stuckTasks?.length ?? 0,
      results,
    })

  } catch (err) {
    return Response.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
