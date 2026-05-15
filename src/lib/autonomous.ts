import { ollamaChat, AGENT_MODELS, modelForTag } from './ollama'
import { buildBrainSystemPrompt } from './prompts'
import { getCompanyIntegrations } from './integrations'
import { createClient } from '@supabase/supabase-js'
import { runAgentTask } from './brain'

// ─── DB helper ───────────────────────────────────────────────────────────────
function sdb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

const AGENT_TYPES = ['engineering', 'content', 'email', 'research', 'ads', 'data', 'support'] as const

interface WakeCycleResult {
  companyId: string
  companyName: string
  cycleId: string
  tasksCreated: number
  tasksExecuted: number
  messagesRead: number
  errors: string[]
}

// ─── 1. Gather full context for a company ────────────────────────────────────
async function gatherCompanyContext(companyId: string) {
  const db = sdb()

  const [companyRes, recentDoneRes, recentFailedRes, pendingTasksRes, messagesRes] = await Promise.all([
    db.from('companies').select('name, description, industry, stage, user_id').eq('id', companyId).single(),
    db.from('tasks').select('title, tag, completed_at')
      .eq('company_id', companyId).eq('status', 'completed')
      .order('completed_at', { ascending: false }).limit(8),
    db.from('tasks').select('title, tag, error')
      .eq('company_id', companyId).eq('status', 'failed')
      .order('created_at', { ascending: false }).limit(3),
    db.from('tasks').select('id, title, tag, priority')
      .eq('company_id', companyId).eq('status', 'todo')
      .order('created_at').limit(10),
    db.from('agent_messages').select('from_agent, to_agent, content')
      .eq('company_id', companyId).eq('read', false)
      .order('created_at').limit(15),
  ])

  const company = companyRes.data
  const integrations = await getCompanyIntegrations(companyId)

  // Fetch user profile for language/plan
  let language = 'en', plan = 'free'
  if (company?.user_id) {
    const { data: profile } = await db.from('profiles').select('language, plan').eq('id', company.user_id).single()
    language = profile?.language ?? 'en'
    plan = profile?.plan ?? 'free'
  }

  return {
    company: company ?? { name: 'Unknown', description: '', industry: '', stage: '' },
    integrations,
    recentDone: recentDoneRes.data ?? [],
    recentFailed: recentFailedRes.data ?? [],
    pendingTasks: pendingTasksRes.data ?? [],
    unreadMessages: messagesRes.data ?? [],
    language,
    plan,
  }
}

// ─── 2. Build the wake briefing prompt (single brain call) ───────────────────
function buildWakeBriefingPrompt(ctx: {
  companyName: string
  description: string
  industry: string
  stage: string
  integrations: string[]
  recentDone: { title: string; tag: string }[]
  recentFailed: { title: string; tag: string; error: string | null }[]
  pendingTasks: { title: string; tag: string }[]
  unreadMessages: { from_agent: string; to_agent: string; content: string }[]
  language: string
}): string {
  const doneList = ctx.recentDone.length > 0
    ? ctx.recentDone.map(t => `- [${t.tag}] ${t.title}`).join('\n')
    : 'Nothing completed yet.'

  const failedList = ctx.recentFailed.length > 0
    ? ctx.recentFailed.map(t => `- [${t.tag}] ${t.title}: ${t.error ?? 'unknown error'}`).join('\n')
    : 'No failures.'

  const pendingList = ctx.pendingTasks.length > 0
    ? ctx.pendingTasks.map(t => `- [${t.tag}] ${t.title}`).join('\n')
    : 'Queue empty.'

  const messagesList = ctx.unreadMessages.length > 0
    ? ctx.unreadMessages.map(m => `- ${m.from_agent} → ${m.to_agent}: ${m.content}`).join('\n')
    : 'No messages.'

  const toolsList = ctx.integrations.length > 0
    ? ctx.integrations.join(', ')
    : 'None connected — focus on research, strategy, content drafts.'

  return `## AUTONOMOUS WAKE CYCLE — ${ctx.companyName}
This is an automated 2-hour wake cycle. No human is watching. You must decide what to do.

**Company**: ${ctx.companyName} | ${ctx.industry ?? 'unknown industry'} | ${ctx.stage ?? 'early stage'}
**Description**: ${ctx.description ?? 'No description set'}
**Connected tools**: ${toolsList}

### Recently completed
${doneList}

### Recent failures (fix these or avoid repeating)
${failedList}

### Current pending tasks
${pendingList}

### Inter-agent messages (agents talking to each other)
${messagesList}

## YOUR MISSION
You are the autonomous coordinator. Think about what MOVES THE NEEDLE for this company right now.

Rules:
1. If there are pending tasks, DON'T create duplicates — just let them execute
2. If an agent sent a message requesting help, create a task responding to it
3. Prioritize: revenue > growth > engagement > maintenance
4. Fix failures before creating new work in the same area
5. Create 2-4 specific, actionable tasks with DETAILED descriptions
6. Make tasks build on each other (deploy site → promote on social → send outreach with link)
7. Use only agents that have their tools connected (check the tools list above)

${ctx.language !== 'en' ? `IMPORTANT: All task titles and descriptions must be in ${ctx.language}.` : ''}

Output your plan:

\`\`\`tasks
[
  {"title":"...", "tag":"engineering|content|email|research|ads|data|support", "priority":"critical|high|medium|low", "estimated_hours": 1, "description":"Detailed instructions for the agent. Be very specific about what to build/write/send."}
]
\`\`\``
}

// ─── 3. THE MAIN WAKE CYCLE (optimized: 1 brain call + task execution) ───────
export async function runWakeCycle(companyId: string): Promise<WakeCycleResult> {
  const db = sdb()
  const errors: string[] = []
  const startedAt = Date.now()

  // Create cycle record
  const { data: cycle } = await db.from('autonomous_runs').insert({
    company_id: companyId,
    status: 'running',
    cycle_type: 'scheduled',
    tasks_created: 0,
    tasks_run: 0,
  }).select().single()

  const cycleId = cycle?.id ?? crypto.randomUUID()

  try {
    // ── Phase 1: GATHER CONTEXT (fast — just DB queries) ──────────────────
    const ctx = await gatherCompanyContext(companyId)
    const { company, integrations, recentDone, recentFailed, pendingTasks, unreadMessages, language, plan } = ctx

    // Set active agents to "waking"
    const agentsToWake = selectAgentsToWake(integrations)
    for (const a of agentsToWake) {
      await db.from('agents').update({ status: 'waking', last_active: new Date().toISOString() }).eq('type', a)
    }

    // If too many pending tasks, skip planning and just execute
    if (pendingTasks.length >= 5) {
      const ran = await executePendingTasks(companyId, 3, startedAt)
      await finalizeCycle(db, cycleId, 0, ran, `Executed ${ran} pending tasks (queue was full)`, agentsToWake)
      return { companyId, companyName: company.name, cycleId, tasksCreated: 0, tasksExecuted: ran, messagesRead: 0, errors }
    }

    // ── Phase 2: SINGLE BRAIN CALL — plan everything at once (~60-90s) ────
    let tasksCreated = 0
    const messagesRead = unreadMessages.length

    try {
      const briefingPrompt = buildWakeBriefingPrompt({
        companyName: company.name,
        description: company.description ?? '',
        industry: company.industry ?? '',
        stage: company.stage ?? '',
        integrations,
        recentDone: recentDone as { title: string; tag: string }[],
        recentFailed: recentFailed as { title: string; tag: string; error: string | null }[],
        pendingTasks: pendingTasks as { title: string; tag: string }[],
        unreadMessages: unreadMessages as { from_agent: string; to_agent: string; content: string }[],
        language,
      })

      const response = await ollamaChat(
        [{ role: 'user', content: briefingPrompt }],
        { model: AGENT_MODELS.brain, system: buildBrainSystemPrompt(language, company.name, plan) }
      )

      // Parse and create tasks
      const tasksMatch = response.match(/```tasks\s*([\s\S]*?)```/)
      if (tasksMatch) {
        const taskList = JSON.parse(tasksMatch[1])
        for (const t of taskList) {
          const tag = t.tag ?? 'research'
          await db.from('tasks').insert({
            company_id: companyId,
            title: t.title,
            description: t.description,
            tag,
            priority: t.priority ?? 'high',
            estimated_hours: t.estimated_hours ?? 1,
            model: modelForTag(tag),
            status: 'todo',
            metadata: { cycle_id: cycleId, source: 'autonomous' },
          })
          tasksCreated++
        }
      }

      // Mark all inter-agent messages as read
      if (unreadMessages.length > 0) {
        await db.from('agent_messages').update({ read: true })
          .eq('company_id', companyId).eq('read', false)
      }

    } catch (err) {
      errors.push(`Brain planning failed: ${err instanceof Error ? err.message : String(err)}`)
    }

    // ── Phase 3: EXECUTE — run tasks in remaining time (~120-180s left) ───
    const tasksExecuted = await executePendingTasks(companyId, 2, startedAt)

    // ── Phase 4: SLEEP ────────────────────────────────────────────────────
    const summary = `Woke ${agentsToWake.length} agents, planned ${tasksCreated} tasks, executed ${tasksExecuted}, read ${messagesRead} messages`
    await finalizeCycle(db, cycleId, tasksCreated, tasksExecuted, summary, agentsToWake)

    return { companyId, companyName: company.name, cycleId, tasksCreated, tasksExecuted, messagesRead, errors }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    errors.push(`Fatal: ${msg}`)
    await db.from('autonomous_runs').update({
      status: 'failed', completed_at: new Date().toISOString(), summary: `Fatal: ${msg}`,
    }).eq('id', cycleId)
    return { companyId, companyName: 'unknown', cycleId, tasksCreated: 0, tasksExecuted: 0, messagesRead: 0, errors }
  }
}

// ─── Helper: finalize cycle and set agents to sleeping ───────────────────────
async function finalizeCycle(
  db: ReturnType<typeof sdb>, cycleId: string,
  tasksCreated: number, tasksRun: number, summary: string,
  agentsToSleep: string[]
) {
  await db.from('autonomous_runs').update({
    status: 'completed',
    completed_at: new Date().toISOString(),
    tasks_created: tasksCreated,
    tasks_run: tasksRun,
    summary,
  }).eq('id', cycleId)

  for (const a of agentsToSleep) {
    await db.from('agents').update({ status: 'sleeping', last_active: new Date().toISOString() }).eq('type', a)
  }
}

// ─── Helper: select agents that should wake ──────────────────────────────────
function selectAgentsToWake(integrations: string[]): string[] {
  const agents = ['research', 'engineering'] // always wake

  if (integrations.includes('resend')) agents.push('email')
  if (integrations.some(i => ['twitter', 'linkedin', 'tiktok'].includes(i))) agents.push('content')
  if (integrations.includes('meta')) agents.push('ads')
  agents.push('data')

  return [...new Set(agents)]
}

// ─── Helper: execute pending tasks with time guard ───────────────────────────
async function executePendingTasks(companyId: string, limit: number, startedAt: number): Promise<number> {
  const db = sdb()
  const { data: tasks } = await db.from('tasks')
    .select('id, title, tag')
    .eq('company_id', companyId)
    .eq('status', 'todo')
    .order('created_at')
    .limit(limit)

  if (!tasks?.length) return 0

  let ran = 0
  for (const task of tasks) {
    // Stop if we're approaching the 300s Vercel timeout (leave 30s buffer)
    if (Date.now() - startedAt > 270_000) break

    try {
      await runAgentTask(task.id)
      ran++
    } catch {
      ran++ // counted even if failed (runAgentTask handles the failure internally)
    }
  }
  return ran
}

// ─── Extract and store agent messages from task output ───────────────────────
export async function extractAgentMessages(
  taskOutput: string,
  companyId: string,
  fromAgent: string,
  taskId: string,
): Promise<number> {
  const msgBlocks = [...taskOutput.matchAll(/```agent_message\s*([\s\S]*?)```/g)]
  let count = 0

  for (const block of msgBlocks) {
    try {
      const parsed = JSON.parse(block[1].trim())
      if (parsed.to && parsed.message) {
        await sdb().from('agent_messages').insert({
          company_id: companyId,
          from_agent: fromAgent,
          to_agent: parsed.to,
          content: parsed.message,
          task_id: taskId,
        })
        count++
      }
    } catch {
      // Ignore parse errors
    }
  }
  return count
}
