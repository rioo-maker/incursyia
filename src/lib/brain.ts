import { ollamaChatStream, ollamaChat, AGENT_MODELS, OllamaMessage } from './ollama'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const COMPANY_ID = '00000000-0000-0000-0000-000000000001'

const BRAIN_SYSTEM = `You are IncursYIA — an autonomous AI co-founder for businesses.

You have 9 specialized agents at your disposal:
- Engineer: writes, tests, deploys code (model: qwen3-coder:480b)
- Browser: web automation, scraping, form filling (model: kimi-k2)
- Researcher: market research, competitor analysis (model: deepseek-v4-flash)
- Outreach: cold email prospecting and campaigns (model: deepseek-v4-flash)
- Creator: blog posts, tweets, ad copy, landing pages (model: deepseek-v4-flash)
- Advertiser: Meta/Google ad campaigns (model: qwen3-next:80b)
- Analyst: SQL, KPIs, revenue analytics (model: qwen3-next:80b)
- Support: customer email and ticket handling (model: gpt-oss:20b)

Your personality:
- Opinionated: make decisions, don't ask unnecessary questions
- Proactive: always end with a proposed next action
- Direct: no fluff, no excessive politeness
- Transparent: acknowledge errors and limits
- Consistent: maintain context across the conversation

When the user gives you a goal, you MUST:
1. Acknowledge it in 1-2 sentences
2. Immediately decompose it into concrete tasks
3. Output tasks in this exact JSON block (inside triple backticks, type "tasks"):
\`\`\`tasks
[
  {"title":"...", "tag":"engineering|browser|research|email|content|ads|data|support", "priority":"critical|high|medium|low", "estimated_hours": 1, "description":"..."}
]
\`\`\`
4. Then explain briefly what each agent will do
5. End with a specific next question or proposed next step

Always be actionable. Never just "suggest" — commit to the plan.`

export interface BrainMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function* streamBrainResponse(
  conversationId: string,
  userMessage: string,
  history: BrainMessage[]
): AsyncGenerator<string> {
  // Save user message to DB
  await supabase.from('messages').insert({
    conversation_id: conversationId,
    role: 'user',
    content: userMessage,
    model: null,
  })

  const messages: OllamaMessage[] = [
    ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: userMessage },
  ]

  let fullResponse = ''

  for await (const token of ollamaChatStream(messages, {
    model: AGENT_MODELS.brain,
    system: BRAIN_SYSTEM,
  })) {
    fullResponse += token
    yield token
  }

  // Save assistant response
  await supabase.from('messages').insert({
    conversation_id: conversationId,
    role: 'assistant',
    content: fullResponse,
    model: AGENT_MODELS.brain,
  })

  // Extract and create tasks if present
  const tasksMatch = fullResponse.match(/```tasks\s*([\s\S]*?)```/)
  if (tasksMatch) {
    try {
      const taskList = JSON.parse(tasksMatch[1])
      for (const t of taskList) {
        await supabase.from('tasks').insert({
          company_id: COMPANY_ID,
          conversation_id: conversationId,
          title: t.title,
          description: t.description,
          tag: t.tag ?? 'general',
          priority: t.priority ?? 'medium',
          estimated_hours: t.estimated_hours ?? 1,
          status: 'todo',
        })
      }
    } catch {}
  }
}

export async function runAgentTask(taskId: string): Promise<void> {
  const { data: task } = await supabase.from('tasks').select('*').eq('id', taskId).single()
  if (!task) return

  await supabase.from('tasks').update({ status: 'in_progress', started_at: new Date().toISOString() }).eq('id', taskId)

  const agentSystems: Record<string, string> = {
    engineering: `You are the Engineering Agent. You write production-ready code, fix bugs, and architect systems. Be specific and technical. Output working code with explanations.`,
    browser: `You are the Browser Agent. You plan web automation workflows step by step. Output a numbered action plan for Playwright.`,
    research: `You are the Research Agent. You conduct thorough market research. Structure findings with: Executive Summary, Key Findings, Competitive Landscape, Opportunities, Risks.`,
    email: `You are the Outreach Agent. You write high-converting cold emails. Output: subject line + personalized body + follow-up sequence.`,
    content: `You are the Content Creator Agent. You write compelling, on-brand content. Match the platform and audience tone.`,
    ads: `You are the Ads Agent. You create Meta/Google ad campaigns. Output: campaign structure, ad sets, copy, targeting, budget recommendation.`,
    data: `You are the Data Agent. You analyze business metrics and write SQL. Output: analysis, SQL queries, KPI dashboard structure.`,
    support: `You are the Support Agent. You handle customer inquiries professionally and empathetically. Resolve issues and document patterns.`,
    general: `You are an autonomous AI assistant. Complete the task thoroughly and professionally.`,
  }

  const systemPrompt = agentSystems[task.tag] ?? agentSystems.general

  try {
    await supabase.from('task_logs').insert({
      task_id: taskId,
      type: 'info',
      content: `Agent started: ${task.tag} | Model: ${task.model}`,
    })

    const result = await ollamaChat(
      [{ role: 'user', content: `Task: ${task.title}\n\n${task.description ?? ''}` }],
      { model: task.model, system: systemPrompt }
    )

    await supabase.from('task_logs').insert({ task_id: taskId, type: 'output', content: result })
    await supabase.from('tasks').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      result: { output: result },
    }).eq('id', taskId)

    // Update agent stats
    await supabase.from('agents').update({
      status: 'idle',
      total_tasks: supabase.rpc('increment', { x: 1 }),
      last_active: new Date().toISOString(),
    }).eq('type', task.tag)

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    await supabase.from('task_logs').insert({ task_id: taskId, type: 'error', content: msg })
    await supabase.from('tasks').update({ status: 'failed', error: msg }).eq('id', taskId)
  }
}
