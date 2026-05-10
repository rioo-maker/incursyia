const BASE = process.env.OLLAMA_BASE_URL ?? 'https://ollama.com'
const KEY  = process.env.OLLAMA_API_KEY ?? ''

// Best model per task type (all available at https://ollama.com/api/tags)
export const AGENT_MODELS: Record<string, string> = {
  brain:       'gpt-oss:120b',          // planning, reasoning, routing
  engineering: 'devstral-small-2:24b',  // code generation & debugging
  browser:     'gpt-oss:120b',          // web automation planning
  research:    'gpt-oss:120b',          // research & analysis
  email:       'gpt-oss:20b',           // copywriting & outreach
  content:     'gpt-oss:20b',           // creative content generation
  ads:         'gpt-oss:120b',          // ad strategy & copy
  data:        'devstral-small-2:24b',  // SQL, analytics
  support:     'gpt-oss:20b',           // fast customer support
  vision:      'qwen3-vl:235b',         // screenshot analysis
  fast:        'ministral-3:3b',        // quick classifications
}

export interface OllamaMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
}

export interface ChatOptions {
  model?: string
  stream?: boolean
  temperature?: number
  system?: string
}

export async function ollamaChat(
  messages: OllamaMessage[],
  opts: ChatOptions = {}
): Promise<string> {
  const model = opts.model ?? AGENT_MODELS.brain

  const allMessages = opts.system
    ? [{ role: 'system', content: opts.system }, ...messages]
    : messages

  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: allMessages,
      stream: false,
      options: { temperature: opts.temperature ?? 0.7 },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Ollama error ${res.status}: ${err}`)
  }

  const data = await res.json()
  return data.message?.content ?? data.response ?? ''
}

export async function* ollamaChatStream(
  messages: OllamaMessage[],
  opts: ChatOptions = {}
): AsyncGenerator<string> {
  const model = opts.model ?? AGENT_MODELS.brain

  const allMessages = opts.system
    ? [{ role: 'system', content: opts.system }, ...messages]
    : messages

  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: allMessages,
      stream: true,
      options: { temperature: opts.temperature ?? 0.7 },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Ollama stream error ${res.status}: ${err}`)
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const lines = decoder.decode(value, { stream: true }).split('\n').filter(Boolean)
    for (const line of lines) {
      try {
        const json = JSON.parse(line)
        const token = json.message?.content ?? json.response ?? ''
        if (token) yield token
      } catch {}
    }
  }
}

// Route to the best model based on task tag
export function modelForTag(tag: string): string {
  return AGENT_MODELS[tag] ?? AGENT_MODELS.brain
}
