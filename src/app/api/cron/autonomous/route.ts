import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runAgentTask } from '@/lib/brain'
import { ollamaChat, AGENT_MODELS, modelForTag } from '@/lib/ollama'
import { buildBrainSystemPrompt } from '@/lib/prompts'

export const runtime = 'nodejs'
export const maxDuration = 300
export const schedule = '0 0 * * *' // Daily at midnight UTC

// Require a secret to prevent unauthorized calls
const CRON_SECRET = process.env.CRON_SECRET ?? ''

// Use service role key to bypass RLS for autonomous operations
function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function GET(req: NextRequest) {
  // Verify cron secret (set in Vercel env)
  const auth = req.headers.get('authorization')
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const results: string[] = []
  const startedAt = new Date().toISOString()

  try {
    // 1. Run up to 5 pending tasks
    const { data: pendingTasks } = await db()
      .from('tasks')
      .select('id, tag, title, company_id')
      .eq('status', 'todo')
      .order('created_at')
      .limit(5)

    if (pendingTasks?.length) {
      for (const task of pendingTasks) {
        try {
          await runAgentTask(task.id)
          results.push(`Ran task: ${task.title} (${task.tag})`)
        } catch (e) {
          results.push(`Failed task ${task.id}: ${e}`)
        }
      }
    }

    // 2. For each company with no recent tasks, generate new ones
    const { data: companies } = await db()
      .from('companies')
      .select('id, name, description, industry, stage, user_id')
      .limit(20)

    if (companies?.length) {
      for (const company of companies) {
        // Check if this company has any pending tasks
        const { count } = await db()
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', company.id)
          .in('status', ['todo', 'in_progress'])

        if ((count ?? 0) > 0) continue // Already has work queued

        // Check last autonomous run for this company (throttle to once per hour)
        const { data: lastRun } = await db()
          .from('autonomous_runs')
          .select('started_at')
          .eq('company_id', company.id)
          .order('started_at', { ascending: false })
          .limit(1)
          .single()

        if (lastRun) {
          const hourAgo = new Date(Date.now() - 60 * 60 * 1000)
          if (new Date(lastRun.started_at) > hourAgo) continue
        }

        // Log this autonomous run
        const { data: run } = await db().from('autonomous_runs').insert({
          company_id: company.id,
          status: 'running',
          started_at: startedAt,
        }).select().single()

        try {
          // Ask brain to generate new tasks for this company
          const profile = await db()
            .from('profiles')
            .select('language, plan')
            .eq('id', company.user_id)
            .single()

          const language = profile.data?.language ?? 'en'
          const plan = profile.data?.plan ?? 'free'

          const prompt = `You are running in autonomous mode for ${company.name}.
Company: ${company.name}
Industry: ${company.industry ?? 'unknown'}
Stage: ${company.stage}
Description: ${company.description ?? 'No description yet'}

Generate the most impactful tasks to grow this business right now.
Think: what would unblock growth the most? What would generate revenue fastest?
Output a task block with 2-3 high-leverage tasks. Be specific.`

          const response = await ollamaChat(
            [{ role: 'user', content: prompt }],
            {
              model: AGENT_MODELS.fast,
              system: buildBrainSystemPrompt(language, company.name, plan),
            }
          )

          // Extract tasks
          const match = response.match(/```tasks\s*([\s\S]*?)```/)
          if (match) {
            const taskList = JSON.parse(match[1])
            for (const t of taskList) {
              const tag = t.tag ?? 'research'
              await db().from('tasks').insert({
                company_id: company.id,
                title: t.title,
                description: t.description,
                tag,
                priority: t.priority ?? 'high',
                estimated_hours: t.estimated_hours ?? 1,
                model: modelForTag(tag),
                status: 'todo',
              })
            }
            results.push(`Generated ${taskList.length} tasks for ${company.name}`)
          }

          if (run) {
            await db().from('autonomous_runs').update({
              status: 'completed',
              completed_at: new Date().toISOString(),
            }).eq('id', run.id)
          }
        } catch (e) {
          results.push(`Brain failed for ${company.name}: ${e}`)
          if (run) {
            await db().from('autonomous_runs').update({ status: 'failed' }).eq('id', run.id)
          }
        }
      }
    }

    return Response.json({
      ok: true,
      ran_at: startedAt,
      results,
    })

  } catch (err) {
    return Response.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
