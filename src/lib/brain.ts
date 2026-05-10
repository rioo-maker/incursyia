import { ollamaChatStream, ollamaChat, AGENT_MODELS, modelForTag, OllamaMessage } from './ollama'
import { buildBrainSystemPrompt, buildAgentPrompt } from './prompts'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export interface BrainMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface BrainContext {
  language?: string
  companyName?: string
  companyId?: string
  plan?: string
}

export async function* streamBrainResponse(
  conversationId: string,
  userMessage: string,
  history: BrainMessage[],
  ctx: BrainContext = {}
): AsyncGenerator<string> {
  const { language = 'en', companyName = 'your company', companyId, plan = 'free' } = ctx

  await db().from('messages').insert({
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
    await db().from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: fullResponse,
      model: AGENT_MODELS.brain,
    })
  }

  // Extract and create tasks from ```tasks blocks
  const tasksMatch = fullResponse.match(/```tasks\s*([\s\S]*?)```/)
  if (tasksMatch && companyId) {
    try {
      const taskList = JSON.parse(tasksMatch[1])
      for (const t of taskList) {
        const tag = t.tag ?? 'general'
        await db().from('tasks').insert({
          company_id: companyId,
          conversation_id: conversationId,
          title: t.title,
          description: t.description,
          tag,
          priority: t.priority ?? 'medium',
          estimated_hours: t.estimated_hours ?? 1,
          model: modelForTag(tag),
          status: 'todo',
        })
      }
    } catch {}
  }
}

export async function runAgentTask(taskId: string, language = 'en'): Promise<void> {
  const { data: task } = await db().from('tasks').select('*').eq('id', taskId).single()
  if (!task) return

  await db().from('tasks').update({
    status: 'in_progress',
    started_at: new Date().toISOString(),
  }).eq('id', taskId)

  const model = task.model ?? modelForTag(task.tag)
  const systemPrompt = buildAgentPrompt(task.tag, language)

  try {
    await db().from('task_logs').insert({
      task_id: taskId,
      type: 'info',
      content: `Agent started: ${task.tag} | Model: ${model}`,
    })

    const result = await ollamaChat(
      [{ role: 'user', content: `Task: ${task.title}\n\n${task.description ?? ''}` }],
      { model, system: systemPrompt }
    )

    await db().from('task_logs').insert({ task_id: taskId, type: 'output', content: result })
    await db().from('tasks').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      result: { output: result },
    }).eq('id', taskId)

    await db().from('agents')
      .update({ status: 'idle', last_active: new Date().toISOString() })
      .eq('type', task.tag)

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    await db().from('task_logs').insert({ task_id: taskId, type: 'error', content: msg })
    await db().from('tasks').update({ status: 'failed', error: msg }).eq('id', taskId)
  }
}
