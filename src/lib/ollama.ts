const BASE = process.env.OLLAMA_BASE_URL ?? 'https://ollama.com'
const KEY  = process.env.OLLAMA_API_KEY ?? ''

// Best model per task type
export const AGENT_MODELS: Record<string, string> = {
  brain:       'kimi-k2-thinking',   // planning, reasoning, routing
  engineering: 'qwen3-coder:480b',   // code generation & debugging
  browser:     'kimi-k2:1t',          // web automation planning
  research:    'deepseek-v4-flash',  // research & analysis
  email:       'deepseek-v4-flash',  // copywriting & outreach
  content:     'deepseek-v4-flash',  // creative content generation
  ads:         'qwen3-next:80b',     // ad strategy & copy
  data:        'qwen3-next:80b',     // SQL, analytics
  support:     'gpt-oss:20b',        // fast customer support
  vision:      'qwen3-vl:235b',      // screenshot analysis
  fast:        'ministral-3:8b',     // quick classifications
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
