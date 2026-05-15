import { ollamaChat, AGENT_MODELS, modelForTag, OllamaMessage } from './ollama'
import { buildAgentPrompt, buildBrainSystemPrompt } from './prompts'
import { getCompanyIntegrations, getCredentials } from './integrations'
import { createClient } from '@supabase/supabase-js'
import { runAgentTask } from './brain'

// ─── DB helpers ──────────────────────────────────────────────────────────────
function sdb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

const AGENT_TYPES = ['engineering', 'content', 'email', 'research', 'ads', 'data', 'support'] as const
type AgentType = typeof AGENT_TYPES[number]

interface WakeCycleResult {
  companyId: string
  companyName: string
  cycleId: string
  tasksCreated: number
  tasksExecuted: number
  messagesExchanged: number
  agentReports: Record<string, string>
  errors: string[]
}

// ─── 1. Gather full context for a company ────────────────────────────────────
async function gatherCompanyContext(companyId: string) {
  const db = sdb()

  // Parallel fetches for speed
  const [
    companyRes,
    integrationsRes,
    recentDoneRes,
    recentFailedRes,
    pendingTasksRes,
    unreadMessagesRes,
    profileRes,
  ] = await Promise.all([
    db.from('companies').select('name, description, industry, stage, user_id').eq('id', companyId).single(),
    db.from('integrations').select('service, status').eq('company_id', companyId).eq('status', 'active'),
    db.from('tasks').select('title, tag, result, completed_at')
      .eq('company_id', companyId).eq('status', 'completed')
      .order('completed_at', { ascending: false }).limit(10),
    db.from('tasks').select('title, tag, error')
      .eq('company_id', companyId).eq('status', 'failed')
      .order('created_at', { ascending: false }).limit(5),
    db.from('tasks').select('id, title, tag, priority')
      .eq('company_id', companyId).eq('status', 'todo')
      .order('created_at').limit(10),
    db.from('agent_messages').select('from_agent, to_agent, content, created_at')
      .eq('company_id', companyId).eq('read', false)
      .order('created_at').limit(20),
    db.from('companies').select('user_id').eq('id', companyId).single()
      .then(async (res) => {
        if (!res.data?.user_id) return { data: null }
        return db.from('profiles').select('language, plan').eq('id', res.data.user_id).single()
      }),
  ])

  const company = companyRes.data
  const integrations = (integrationsRes.data ?? []).map(r => r.service)
  const recentDone = recentDoneRes.data ?? []
  const recentFailed = recentFailedRes.data ?? []
  const pendingTasks = pendingTasksRes.data ?? []
  const unreadMessages = unreadMessagesRes.data ?? []
  const profile = profileRes.data

  return {
    company: company ?? { name: 'Unknown', description: '', industry: '', stage: '', user_id: '' },
    integrations,
    recentDone,
    recentFailed,
    pendingTasks,
    unreadMessages,
    language: (profile as { language?: string })?.language ?? 'en',
    plan: (profile as { plan?: string })?.plan ?? 'free',
  }
}

// ─── 2. Agent self-assessment — what can I do right now? ─────────────────────
function buildAgentWakePrompt(
  agentType: AgentType,
  companyName: string,
  integrations: string[],
  recentDone: { title: string; tag: string }[],
  recentFailed: { title: string; tag: string; error: string | null }[],
  messagesForMe: { from_agent: string; content: string }[],
  language: string
): string {
  const myRecent = recentDone.filter(t => t.tag === agentType)
  const myFailed = recentFailed.filter(t => t.tag === agentType)
  const incomingMsgs = messagesForMe.map(m => `[${m.from_agent}]: ${m.content}`).join('\n')

  return `You are the ${agentType} agent for ${companyName}. You just woke up for your 2-hour autonomous cycle.

## Your situation
- Connected tools: ${integrations.length > 0 ? integrations.join(', ') : 'none yet'}
- Your recent work: ${myRecent.length > 0 ? myRecent.map(t => t.title).join(', ') : 'nothing yet'}
- Your recent failures: ${myFailed.length > 0 ? myFailed.map(t => `${t.title} (${t.error})`).join(', ') : 'none'}

${incomingMsgs ? `## Messages from other agents\n${incomingMsgs}` : ''}

## Your job
1. Based on your role and the company context, propose 1-2 specific tasks you should do RIGHT NOW
2. If another agent sent you a message, respond to it and incorporate it into your plan
3. If you see an opportunity to help another agent, leave them a message

Respond in this EXACT format:

\`\`\`wake_report
{
  "status": "ready",
  "proposed_tasks": [
    {"title": "...", "description": "Detailed instructions...", "priority": "high"}
  ],
  "messages_to_agents": [
    {"to": "content", "message": "I deployed a new site at X, please promote it on social media"}
  ]
}
\`\`\`

${language !== 'en' ? `Respond in ${language}.` : ''}`
}

// ─── 3. Coordinator — brain reviews all agent proposals and creates the plan ─
function buildCoordinatorPrompt(
  companyName: string,
  integrations: string[],
  agentProposals: Record<string, string>,
  pendingTasks: { title: string; tag: string }[],
  language: string
): string {
  const proposalsSummary = Object.entries(agentProposals)
    .map(([agent, proposal]) => `### ${agent} agent\n${proposal}`)
    .join('\n\n')

  const pendingList = pendingTasks.length > 0
    ? `Already pending: ${pendingTasks.map(t => `${t.title} (${t.tag})`).join(', ')}`
    : 'No pending tasks.'

  return `You are the IncursYIA coordinator for ${companyName}. Your agents just woke up and proposed their plans.

## Connected tools
${integrations.length > 0 ? integrations.join(', ') : 'None — focus on content drafts, research, strategy.'}

## Agent proposals
${proposalsSummary}

## Current task queue
${pendingList}

## Your job
1. Review all agent proposals
2. Eliminate duplicates or conflicting work
3. Prioritize: revenue-generating > growth > maintenance
4. Create the final coordinated task list (max 4 tasks to stay within execution time)
5. Make sure tasks build on each other (e.g. engineering deploys site THEN content promotes it)

Output the final approved tasks:

\`\`\`tasks
[
  {"title":"...", "tag":"engineering|content|email|research|ads|data|support", "priority":"critical|high|medium|low", "estimated_hours": 1, "description":"Detailed agent instructions..."}
]
\`\`\`

${language !== 'en' ? `Respond in ${language}.` : ''}`
}

// ─── 4. Post inter-agent messages ────────────────────────────────────────────
async function postAgentMessages(
  companyId: string,
  fromAgent: string,
  messages: { to: string; message: string }[],
  cycleId: string,
  taskId?: string
) {
  const db = sdb()
  for (const msg of messages) {
    await db.from('agent_messages').insert({
      company_id: companyId,
      from_agent: fromAgent,
      to_agent: msg.to,
      content: msg.message,
      task_id: taskId ?? null,
      cycle_id: cycleId,
    })
  }
  return messages.length
}

// ─── 5. Mark messages as read ────────────────────────────────────────────────
async function markMessagesRead(companyId: string, agentType: string) {
  await sdb().from('agent_messages')
    .update({ read: true })
    .eq('company_id', companyId)
    .eq('to_agent', agentType)
    .eq('read', false)
}

// ─── 6. Parse agent wake report ──────────────────────────────────────────────
function parseWakeReport(output: string): {
  proposedTasks: { title: string; description: string; priority: string }[]
  messages: { to: string; message: string }[]
} {
  const match = output.match(/```wake_report\s*([\s\S]*?)```/)
  if (!match) return { proposedTasks: [], messages: [] }
  try {
    const parsed = JSON.parse(match[1])
    return {
      proposedTasks: parsed.proposed_tasks ?? [],
      messages: parsed.messages_to_agents ?? [],
    }
  } catch {
    return { proposedTasks: [], messages: [] }
  }
}

// ─── 7. THE MAIN WAKE CYCLE ─────────────────────────────────────────────────
export async function runWakeCycle(companyId: string): Promise<WakeCycleResult> {
  const db = sdb()
  const errors: string[] = []
  const agentReports: Record<string, string> = {}
  let messagesExchanged = 0

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
    // ── Phase 1: GATHER CONTEXT ─────────────────────────────────────────────
    const ctx = await gatherCompanyContext(companyId)
    const { company, integrations, recentDone, recentFailed, pendingTasks, unreadMessages, language, plan } = ctx

    // If there are already many pending tasks, just execute them instead of planning more
    if (pendingTasks.length >= 5) {
      const ran = await executePendingTasks(companyId, 4)
      await db.from('autonomous_runs').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        tasks_run: ran,
        summary: `Executed ${ran} pending tasks (queue was full, skipped planning)`,
      }).eq('id', cycleId)

      return {
        companyId, companyName: company.name, cycleId,
        tasksCreated: 0, tasksExecuted: ran, messagesExchanged: 0,
        agentReports: { orchestrator: `Queue full — executed ${ran} tasks` }, errors,
      }
    }

    // ── Phase 2: AGENT WAKE — each agent assesses what it can do ────────────
    // Only wake agents that have relevant integrations or can work independently
    const agentsToWake = selectAgentsToWake(integrations)
    const proposals: Record<string, string> = {}

    for (const agentType of agentsToWake) {
      try {
        // Set agent to "waking"
        await db.from('agents').update({ status: 'waking', last_active: new Date().toISOString() }).eq('type', agentType)

        const myMessages = unreadMessages.filter(m => m.to_agent === agentType)
        const prompt = buildAgentWakePrompt(
          agentType, company.name, integrations,
          recentDone as { title: string; tag: string }[],
          recentFailed as { title: string; tag: string; error: string | null }[],
          myMessages as { from_agent: string; content: string }[],
          language
        )

        // Fast model for wake assessment (keep it quick)
        const report = await ollamaChat(
          [{ role: 'user', content: prompt }],
          { model: AGENT_MODELS.fast, temperature: 0.6 }
        )

        proposals[agentType] = report
        agentReports[agentType] = report.substring(0, 500)

        // Parse and send any inter-agent messages
        const parsed = parseWakeReport(report)
        if (parsed.messages.length > 0) {
          const sent = await postAgentMessages(companyId, agentType, parsed.messages, cycleId)
          messagesExchanged += sent
        }

        // Mark my incoming messages as read
        await markMessagesRead(companyId, agentType)

        // Set agent back to idle
        await db.from('agents').update({ status: 'idle' }).eq('type', agentType)

      } catch (err) {
        errors.push(`${agentType} wake failed: ${err instanceof Error ? err.message : String(err)}`)
        await db.from('agents').update({ status: 'idle' }).eq('type', agentType)
      }
    }

    // ── Phase 3: COORDINATOR — brain reviews proposals and creates plan ─────
    let tasksCreated = 0

    if (Object.keys(proposals).length > 0) {
      try {
        const coordPrompt = buildCoordinatorPrompt(
          company.name, integrations, proposals,
          pendingTasks as { title: string; tag: string }[],
          language
        )

        const coordResponse = await ollamaChat(
          [{ role: 'user', content: coordPrompt }],
          { model: AGENT_MODELS.brain, system: buildBrainSystemPrompt(language, company.name, plan) }
        )

        agentReports['coordinator'] = coordResponse.substring(0, 500)

        // Parse tasks from coordinator response
        const tasksMatch = coordResponse.match(/```tasks\s*([\s\S]*?)```/)
        if (tasksMatch) {
          const taskList = JSON.parse(tasksMatch[1])
          for (const t of taskList) {
            const tag = t.tag ?? 'general'
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
      } catch (err) {
        errors.push(`Coordinator failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    // ── Phase 4: EXECUTE — run tasks (pending + newly created) ──────────────
    const tasksExecuted = await executePendingTasks(companyId, 3)

    // ── Phase 5: SLEEP — log everything ─────────────────────────────────────
    await db.from('autonomous_runs').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      tasks_created: tasksCreated,
      tasks_run: tasksExecuted,
      summary: `Woke ${agentsToWake.length} agents, created ${tasksCreated} tasks, executed ${tasksExecuted}, ${messagesExchanged} inter-agent messages`,
      agent_reports: agentReports,
    }).eq('id', cycleId)

    // Set all agents back to sleeping
    for (const agentType of agentsToWake) {
      await db.from('agents').update({ status: 'sleeping', last_active: new Date().toISOString() }).eq('type', agentType)
    }

    return {
      companyId, companyName: company.name, cycleId,
      tasksCreated, tasksExecuted, messagesExchanged,
      agentReports, errors,
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    errors.push(`Fatal: ${msg}`)
    await db.from('autonomous_runs').update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      summary: `Fatal error: ${msg}`,
    }).eq('id', cycleId)

    return {
      companyId, companyName: 'unknown', cycleId,
      tasksCreated: 0, tasksExecuted: 0, messagesExchanged: 0,
      agentReports, errors,
    }
  }
}

// ─── Helper: decide which agents to wake based on integrations ───────────────
function selectAgentsToWake(integrations: string[]): AgentType[] {
  // Always wake these (they can work without integrations)
  const agents: AgentType[] = ['research', 'engineering']

  // Wake agents that have their tools connected
  if (integrations.includes('resend')) agents.push('email')
  if (integrations.some(i => ['twitter', 'linkedin', 'tiktok'].includes(i))) agents.push('content')
  if (integrations.includes('meta')) agents.push('ads')

  // Data and support are useful when there's activity
  agents.push('data')

  return [...new Set(agents)] // dedupe
}

// ─── Helper: execute pending tasks up to a limit ─────────────────────────────
async function executePendingTasks(companyId: string, limit: number): Promise<number> {
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
    try {
      await runAgentTask(task.id)
      ran++
    } catch (err) {
      // Task failure is already handled inside runAgentTask
      ran++
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
  // Look for ```agent_message blocks in agent output
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
