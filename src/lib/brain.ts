import { ollamaChatStream, ollamaChat, AGENT_MODELS, modelForTag, OllamaMessage } from './ollama'
import { buildBrainSystemPrompt, buildAgentPrompt } from './prompts'
import { getCompanyIntegrations, getCredentials } from './integrations'
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

// ─── Deploy directly to Vercel (no HTTP round-trip) ─────────────────────────
async function deployToVercel(
  companyId: string, projectName: string, files: Record<string, string>, framework: string | null
): Promise<{ ok: boolean; url?: string; error?: string }> {
  try {
    const creds = await getCredentials(companyId, 'vercel')
    if (!creds.api_token) return { ok: false, error: 'Vercel not connected — add API token in Connections' }

    const deployFiles = Object.entries(files).map(([filePath, content]) => ({
      file: filePath,
      data: Buffer.from(content).toString('base64'),
      encoding: 'base64',
    }))

    const body: Record<string, unknown> = {
      name: projectName ?? 'incursyia-project',
      files: deployFiles,
      projectSettings: { framework: framework ?? null },
      target: 'production',
    }

    const url = creds.team_id
      ? `https://api.vercel.com/v13/deployments?teamId=${creds.team_id}`
      : 'https://api.vercel.com/v13/deployments'

    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${creds.api_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()

    if (!res.ok) return { ok: false, error: data.error?.message ?? JSON.stringify(data) }
    return { ok: true, url: `https://${data.url}` }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

// ─── Execute action blocks from agent output ──────────────────────────────────
async function executeActions(result: string, companyId: string, taskId: string): Promise<string[]> {
  const logs: string[] = []

  // Determine base URL for internal API calls (email, social, ads — NOT deploy)
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
      if (!res.ok) {
        const text = await res.text()
        try { return JSON.parse(text) } catch { return { error: `HTTP ${res.status}: ${text.substring(0, 200)}` } }
      }
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

  // ── New multi-block deploy format ──
  // ```deploy-meta
  // {"project_name":"my-site","framework":"nextjs"}
  // ```
  // ```deploy-file:path/to/file.tsx
  // raw file content here — no JSON escaping needed
  // ```
  const metaMatch = result.match(/```deploy-meta\s*([\s\S]*?)```/)
  const fileBlocks = [...result.matchAll(/```deploy-file:([^\n]+)\n([\s\S]*?)```/g)]

  if (metaMatch && fileBlocks.length > 0) {
    try {
      const meta = JSON.parse(metaMatch[1].trim())
      const files: Record<string, string> = {}
      for (const fb of fileBlocks) {
        files[fb[1].trim()] = fb[2]  // raw content, no JSON escaping issues
      }
      await sdb().from('task_logs').insert({ task_id: taskId, type: 'info', content: `Deploying ${Object.keys(files).length} files: ${Object.keys(files).join(', ')}` })

      // Call Vercel API directly — no HTTP round-trip to self
      const r = await deployToVercel(companyId, meta.project_name, files, meta.framework ?? null)
      const msg = r.ok ? `✓ Deployed to ${r.url}` : `✗ Deploy failed: ${r.error}`
      logs.push(msg)
      await sdb().from('task_logs').insert({ task_id: taskId, type: r.ok ? 'action' : 'error', content: msg })
    } catch (e) {
      const errMsg = `✗ deploy-meta parse error: ${e}`
      logs.push(errMsg)
      await sdb().from('task_logs').insert({ task_id: taskId, type: 'error', content: errMsg })
    }
  }

  // ── Legacy single-block deploy format (fallback) ──
  if (!metaMatch) {
    for (const m of result.matchAll(/```deploy\s*([\s\S]*?)```/g)) {
      try {
        let files: Record<string, string> = {}
        let projectName = 'incursyia-project'
        let framework: string | null = null
        try {
          const payload = JSON.parse(m[1].trim())
          files = payload.files ?? {}
          projectName = payload.project_name ?? projectName
          framework = payload.framework ?? null
        } catch {
          // Regex recovery for single-file HTML deploys
          const nameMatch = m[1].match(/"project_name"\s*:\s*"([^"]+)"/)
          const htmlMatch = m[1].match(/"index\.html"\s*:\s*"([\s\S]+)"\s*\}\s*,?\s*"framework"/)
            || m[1].match(/"index\.html"\s*:\s*"([\s\S]+)"\s*\}/)
          if (nameMatch && htmlMatch) {
            let html = htmlMatch[1].replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
            const lastTag = html.lastIndexOf('</html>')
            if (lastTag !== -1) html = html.substring(0, lastTag + 7)
            files = { 'index.html': html }
            projectName = nameMatch[1]
          } else {
            throw new Error('Could not parse deploy JSON')
          }
        }
        // Call Vercel API directly — no HTTP round-trip to self
        const r = await deployToVercel(companyId, projectName, files, framework)
        const msg = r.ok ? `✓ Deployed to ${r.url}` : `✗ Deploy failed: ${r.error}`
        logs.push(msg)
        await sdb().from('task_logs').insert({ task_id: taskId, type: r.ok ? 'action' : 'error', content: msg })
      } catch (e) {
        const errMsg = `✗ deploy parse error: ${e}`
        logs.push(errMsg)
        await sdb().from('task_logs').insert({ task_id: taskId, type: 'error', content: errMsg })
      }
    }
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
  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY
  console.log(`[runAgentTask] taskId=${taskId} serviceKey=${hasServiceKey}`)

  const { data: task, error: taskErr } = await sdb().from('tasks').select('*').eq('id', taskId).single()
  console.log(`[runAgentTask] query result: found=${!!task} error=${taskErr?.message ?? 'none'}`)
  if (!task) return

  await sdb().from('tasks').update({ status: 'in_progress', started_at: new Date().toISOString() }).eq('id', taskId)

  const model = task.model ?? modelForTag(task.tag)

  // Set agent to BUSY with current task
  await sdb().from('agents')
    .update({ status: 'busy', current_task: task.title })
    .eq('type', task.tag)

  // Fetch which integrations this company has connected (RPC bypasses RLS)
  const integrations = await getCompanyIntegrations(task.company_id)

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

    // Count how many actions actually fired
    const actionsOk = actionLogs.filter(l => l.startsWith('✓')).length
    const actionsFailed = actionLogs.filter(l => l.startsWith('✗')).length

    await sdb().from('task_logs').insert({
      task_id: taskId, type: 'info',
      content: `Task done: ${actionsOk} actions executed, ${actionsFailed} failed. Total action blocks: ${actionLogs.length}`,
    })

    await sdb().from('tasks').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      result: { output: result, actions_executed: actionLogs },
    }).eq('id', taskId)

    // Increment counters + set agent back to idle
    await sdb().rpc('increment_agent_stats', { p_agent_type: task.tag, p_success: true })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    await sdb().from('task_logs').insert({ task_id: taskId, type: 'error', content: msg })
    await sdb().from('tasks').update({ status: 'failed', error: msg }).eq('id', taskId)
    // Set agent back to idle even on failure
    await sdb().rpc('increment_agent_stats', { p_agent_type: task.tag, p_success: false })
  }
}
