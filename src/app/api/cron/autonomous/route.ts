import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runAgentTask } from '@/lib/brain'
import { ollamaChat, AGENT_MODELS, modelForTag } from '@/lib/ollama'
import { buildBrainSystemPrompt } from '@/lib/prompts'

export const runtime = 'nodejs'
export const maxDuration = 300
export const schedule = '0 0 * * *' // Daily at midnight UTC

const CRON_SECRET = process.env.CRON_SECRET ?? ''

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const results: string[] = []
  const startedAt = new Date().toISOString()

  try {
    // ── 1. Unstick crashed in_progress tasks (>30 min old) ───────────────────
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    const { data: stuckTasks } = await db()
      .from('tasks').select('id, title')
      .eq('status', 'in_progress').lt('started_at', thirtyMinAgo)

    for (const task of stuckTasks ?? []) {
      await db().from('tasks').update({ status: 'failed', error: 'Timed out — will retry next cycle' }).eq('id', task.id)
      results.push(`Reset stuck task: ${task.title}`)
    }

    // ── 2. Retry up to 2 failed tasks ────────────────────────────────────────
    const { data: failedTasks } = await db()
      .from('tasks').select('id, tag, title, company_id')
      .eq('status', 'failed').order('created_at').limit(2)

    for (const task of failedTasks ?? []) {
      try {
        await db().from('tasks').update({ status: 'todo', error: null }).eq('id', task.id)
        await runAgentTask(task.id)
        results.push(`Retried: ${task.title}`)
      } catch (e) { results.push(`Retry failed ${task.id}: ${e}`) }
    }

    // ── 3. Run up to 5 pending tasks ─────────────────────────────────────────
    const { data: pendingTasks } = await db()
      .from('tasks').select('id, tag, title, company_id')
      .eq('status', 'todo').order('created_at').limit(5)

    for (const task of pendingTasks ?? []) {
      try {
        await runAgentTask(task.id)
        results.push(`Ran: ${task.title} (${task.tag})`)
      } catch (e) { results.push(`Failed ${task.id}: ${e}`) }
    }

    // ── 4. Generate new tasks for idle companies ──────────────────────────────
    const { data: companies } = await db()
      .from('companies').select('id, name, description, industry, stage, user_id').limit(20)

    for (const company of companies ?? []) {
      const { count } = await db().from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', company.id).in('status', ['todo', 'in_progress'])
      if ((count ?? 0) > 0) continue

      // Throttle to once per hour
      const { data: lastRun } = await db().from('autonomous_runs')
        .select('started_at').eq('company_id', company.id)
        .order('started_at', { ascending: false }).limit(1).single()
      if (lastRun && new Date(lastRun.started_at) > new Date(Date.now() - 3600000)) continue

      const { data: run } = await db().from('autonomous_runs')
        .insert({ company_id: company.id, status: 'running', started_at: startedAt })
        .select().single()

      try {
        const { data: profile } = await db()
          .from('profiles').select('language, plan').eq('id', company.user_id).single()
        const language = profile?.language ?? 'en'
        const plan = profile?.plan ?? 'free'

        // What integrations does this company have?
        const { data: integrationRows } = await db()
          .from('integrations').select('service').eq('company_id', company.id)
        const integrations = (integrationRows ?? []).map((r: { service: string }) => r.service)

        // What was recently done?
        const { data: recentDone } = await db()
          .from('tasks').select('title, tag').eq('company_id', company.id)
          .eq('status', 'completed').order('completed_at', { ascending: false }).limit(5)
        const doneContext = recentDone?.length
          ? `Recently completed:\n${recentDone.map(t => `- ${t.title} (${t.tag})`).join('\n')}`
          : 'No tasks done yet.'

        const toolsContext = integrations.length
          ? `Connected tools: ${integrations.join(', ')}. Agents can send real emails, post real content, launch real ads. Prioritize tasks that USE these tools.`
          : 'No integrations connected. Focus on research, strategy, content drafts.'

        const prompt = `Autonomous run for ${company.name}.
Company: ${company.name} | Industry: ${company.industry ?? 'unknown'} | Stage: ${company.stage ?? 'early'}
Description: ${company.description ?? 'No description'}

${doneContext}
${toolsContext}

Generate 2-3 specific high-leverage tasks. For each task, write detailed instructions in the description so the agent knows exactly what to do and what action blocks to output.`

        const response = await ollamaChat(
          [{ role: 'user', content: prompt }],
          { model: AGENT_MODELS.fast, system: buildBrainSystemPrompt(language, company.name, plan) }
        )

        const match = response.match(/```tasks\s*([\s\S]*?)```/)
        if (match) {
          const taskList = JSON.parse(match[1])
          for (const t of taskList) {
            const tag = t.tag ?? 'research'
            await db().from('tasks').insert({
              company_id: company.id, title: t.title, description: t.description,
              tag, priority: t.priority ?? 'high',
              estimated_hours: t.estimated_hours ?? 1,
              model: modelForTag(tag), status: 'todo',
            })
          }
          results.push(`Generated ${taskList.length} tasks for ${company.name}`)
        }

        if (run) await db().from('autonomous_runs')
          .update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', run.id)

      } catch (e) {
        results.push(`Brain failed for ${company.name}: ${e}`)
        if (run) await db().from('autonomous_runs').update({ status: 'failed' }).eq('id', run.id)
      }
    }

    return Response.json({ ok: true, ran_at: startedAt, results })
  } catch (err) {
    return Response.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
