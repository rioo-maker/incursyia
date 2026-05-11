import { ollamaChatStream, ollamaChat, AGENT_MODELS, modelForTag, OllamaMessage } from './ollama'
import { buildBrainSystemPrompt, buildAgentPrompt } from './prompts'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

function sdb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export interface BrainMessage { role: 'user' | 'assistant'; content: string }
export interface BrainContext { language?: string; companyName?: string; companyId?: string; plan?: string }

// ─── Stream brain response ────────────────────────────────────────────────────
export async function* streamBrainResponse(
  conversationId: string, userMessage: string,
  history: BrainMessage[], ctx: BrainContext = {}
): AsyncGenerator<string> {
  const { language = 'en', companyName = 'your company', companyId, plan = 'free' } = ctx

  await db().from('messages').insert({ conversation_id: conversationId, role: 'user', content: userMessage, model: null })

  const messages: OllamaMessage[] = [
    ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: userMessage },
  ]

  let fullResponse = ''
  try {
    for await (const token of ollamaChatStream(messages, {
      model: AGENT_MODELS.brain,
      system: buildBrainSystemPrompt(language, companyName, plan),
    })) {
      fullResponse += token
      yield token
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const errText = `\n\n[AI Error: ${msg}]`
    fullResponse += errText
    yield errText
  }

  if (fullResponse) {
    await db().from('messages').insert({ conversation_id: conversationId, role: 'assistant', content: fullResponse, model: AGENT_MODELS.brain })
  }

  // Extract and create tasks
  const tasksMatch = fullResponse.match(/```tasks\s*([\s\S]*?)```/)
  if (tasksMatch && companyId) {
    try {
      const taskList = JSON.parse(tasksMatch[1])
      for (const t of taskList) {
        const tag = t.tag ?? 'general'
        await db().from('tasks').insert({
          company_id: companyId, conversation_id: conversationId,
          title: t.title, description: t.description, tag,
          priority: t.priority ?? 'medium', estimated_hours: t.estimated_hours ?? 1,
          model: modelForTag(tag), status: 'todo',
        })
      }
    } catch {}
  }
}

// ─── Execute action blocks from agent output ──────────────────────────────────
async function executeActions(result: string, companyId: string, taskId: string): Promise<string[]> {
  const logs: string[] = []

  // Determine base URL for internal API calls
  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000')

  const call = async (path: string, body: Record<string, unknown>) => {
    try {
      const res = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, company_id: companyId }),
      })
      return await res.json()
    } catch (e) { return { error: String(e) } }
  }

  // send_email blocks
  for (const m of result.matchAll(/```send_email\s*([\s\S]*?)```/g)) {
    try {
      const payload = JSON.parse(m[1].trim())
      const r = await call('/api/email/send', payload)
      const msg = r.ok ? `✓ Email sent to ${payload.to}` : `✗ Email failed: ${r.error}`
      logs.push(msg)
      await sdb().from('task_logs').insert({ task_id: taskId, type: r.ok ? 'action' : 'error', content: msg })
    } catch (e) { logs.push(`✗ send_email parse error: ${e}`) }
  }

  // post_social blocks
  for (const m of result.matchAll(/```post_social\s*([\s\S]*?)```/g)) {
    try {
      const payload = JSON.parse(m[1].trim())
      const r = await call('/api/social/post', payload)
      const msg = r.ok
        ? `✓ Posted on ${payload.platform}${r.external_id ? ` (ID: ${r.external_id})` : ''}`
        : `✗ Post failed (${payload.platform}): ${r.error}`
      logs.push(msg)
      await sdb().from('task_logs').insert({ task_id: taskId, type: r.ok ? 'action' : 'error', content: msg })
    } catch (e) { logs.push(`✗ post_social parse error: ${e}`) }
  }

  // deploy blocks
  for (const m of result.matchAll(/```deploy\s*([\s\S]*?)```/g)) {
    try {
      const payload = JSON.parse(m[1].trim())
      const r = await call('/api/deploy', payload)
      const msg = r.ok ? `✓ Deployed to ${r.url}` : `✗ Deploy failed: ${r.error}`
      logs.push(msg)
      await sdb().from('task_logs').insert({ task_id: taskId, type: r.ok ? 'action' : 'error', content: msg })
    } catch (e) { logs.push(`✗ deploy parse error: ${e}`) }
  }

  // launch_ad blocks
  for (const m of result.matchAll(/```launch_ad\s*([\s\S]*?)```/g)) {
    try {
      const payload = JSON.parse(m[1].trim())
      const r = await call('/api/ads/launch', payload)
      const msg = r.ok
        ? `✓ Ad launched on ${payload.platform} (campaign: ${r.campaignId})`
        : `✗ Ad launch failed: ${r.error}`
      logs.push(msg)
      await sdb().from('task_logs').insert({ task_id: taskId, type: r.ok ? 'action' : 'error', content: msg })
    } catch (e) { logs.push(`✗ launch_ad parse error: ${e}`) }
  }

  return logs
}

// ─── Run a single agent task ──────────────────────────────────────────────────
export async function runAgentTask(taskId: string, language = 'en'): Promise<void> {
  const { data: task } = await sdb().from('tasks').select('*').eq('id', taskId).single()
  if (!task) return

  await sdb().from('tasks').update({ status: 'in_progress', started_at: new Date().toISOString() }).eq('id', taskId)

  const model = task.model ?? modelForTag(task.tag)

  // Fetch which integrations this company has connected
  const { data: integrationRows } = await sdb()
    .from('integrations').select('service').eq('company_id', task.company_id)
  const integrations = (integrationRows ?? []).map((r: { service: string }) => r.service)

  // Fetch company name
  const { data: company } = await sdb().from('companies').select('name').eq('id', task.company_id).single()
  const companyName = company?.name ?? 'the company'

  const systemPrompt = buildAgentPrompt(task.tag, language, companyName, integrations)

  try {
    await sdb().from('task_logs').insert({
      task_id: taskId, type: 'info',
      content: `Agent started: ${task.tag} | Model: ${model} | Tools: ${integrations.join(', ') || 'none configured'}`,
    })

    const result = await ollamaChat(
      [{ role: 'user', content: `Task: ${task.title}\n\n${task.description ?? ''}` }],
      { model, system: systemPrompt }
    )

    await sdb().from('task_logs').insert({ task_id: taskId, type: 'output', content: result })

    // Execute any action blocks the agent produced (emails, posts, ads)
    const actionLogs = await executeActions(result, task.company_id, taskId)

    await sdb().from('tasks').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      result: { output: result, actions_executed: actionLogs },
    }).eq('id', taskId)

    await sdb().from('agents')
      .update({ status: 'idle', last_active: new Date().toISOString() })
      .eq('type', task.tag)

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    await sdb().from('task_logs').insert({ task_id: taskId, type: 'error', content: msg })
    await sdb().from('tasks').update({ status: 'failed', error: msg }).eq('id', taskId)
  }
}
