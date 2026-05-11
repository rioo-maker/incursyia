'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Logo } from '@/components/Logo'

interface Message { id: string; role: string; content: string; model?: string; created_at: string }

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 16 }}>
      {!isUser && (
        <div style={{ marginRight: 10, marginTop: 2, flexShrink: 0 }}>
          <Logo size={18} showText={false} />
        </div>
      )}
      <div style={{
        maxWidth: '72%',
        background: isUser ? 'var(--accent)' : 'var(--bg-card)',
        border: isUser ? 'none' : '1px solid var(--border-subtle)',
        borderRadius: isUser ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
        padding: '12px 16px',
        color: isUser ? '#0C0C0C' : 'var(--text-primary)',
        fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.6,
        whiteSpace: 'pre-wrap',
      }}>
        {msg.content.split(/(```tasks[\s\S]*?```)/g).map((part, i) => {
          if (part.startsWith('```tasks')) {
            const json = part.replace(/```tasks\s*/, '').replace(/```$/, '').trim()
            try {
              const tasks = JSON.parse(json)
              return (
                <div key={i} style={{ marginTop: 8, border: '1px solid var(--border-accent)', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ background: 'var(--accent-subtle)', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--accent)', letterSpacing: '.08em', textTransform: 'uppercase' }}>
                    {tasks.length} task{tasks.length !== 1 ? 's' : ''} created
                  </div>
                  {tasks.map((t: { title: string; tag: string; priority: string; estimated_hours?: number }, j: number) => (
                    <div key={j} style={{ padding: '10px 12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 11, background: 'rgba(255,255,255,.06)', padding: '2px 8px', borderRadius: 4, color: 'var(--accent)', fontWeight: 600, flexShrink: 0 }}>{t.tag}</span>
                      <div>
                        <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{t.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{t.priority} · {t.estimated_hours ?? 1}h</div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            } catch { return <pre key={i} style={{ fontSize: 12, opacity: .6 }}>{part}</pre> }
          }
          return <span key={i}>{part}</span>
        })}
        {msg.model && !isUser && (
          <div style={{ marginTop: 6, fontSize: 10, opacity: .4 }}>{msg.model}</div>
        )}
      </div>
    </div>
  )
}

function StreamingMessage({ content }: { content: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16 }}>
      <div style={{ marginRight: 10, marginTop: 2, flexShrink: 0 }}>
        <Logo size={18} showText={false} />
      </div>
      <div style={{
        maxWidth: '72%', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
        borderRadius: '4px 16px 16px 16px', padding: '12px 16px',
        color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.6,
        whiteSpace: 'pre-wrap',
      }}>
        {content || <span style={{ opacity: .4 }}>Thinking...</span>}
      </div>
    </div>
  )
}

export default function ChatPage() {
  const [messages, setMessages]   = useState<Message[]>([])
  const [convId, setConvId]       = useState<string | null>(null)
  const [input, setInput]         = useState('')
  const [streaming, setStreaming] = useState('')
  const [loading, setLoading]     = useState(false)
  const [chatError, setChatError] = useState('')
  const [runningTasks, setRunningTasks] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Load real user's conversation on mount
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: company } = await supabase
        .from('companies').select('id').eq('user_id', user.id).order('created_at').limit(1).single()
      if (!company) return

      let { data: conv } = await supabase
        .from('conversations').select('id').eq('company_id', company.id).order('created_at').limit(1).single()

      if (!conv) {
        const { data: newConv } = await supabase
          .from('conversations').insert({ company_id: company.id, title: 'Main chat' }).select().single()
        conv = newConv
      }

      if (conv) {
        setConvId(conv.id)
        const { data: msgs } = await supabase
          .from('messages').select('*').eq('conversation_id', conv.id).order('created_at')
        setMessages(msgs as Message[] ?? [])
      }
    })()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  const send = async () => {
    if (!input.trim() || loading) return
    const text = input.trim()
    setInput('')
    setLoading(true)
    setStreaming('')
    setChatError('')

    const history = messages.slice(-12).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    setMessages(prev => [...prev, {
      id: Date.now().toString(), role: 'user', content: text, created_at: new Date().toISOString(),
    }])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: convId, message: text, history }),
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`HTTP ${res.status}: ${errText}`)
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let full = ''
      let apiError = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const lines = decoder.decode(value).split('\n').filter(l => l.startsWith('data: '))
        for (const line of lines) {
          const data = line.slice(6)
          if (data === '[DONE]') break
          try {
            const parsed = JSON.parse(data)
            if (parsed.error) { apiError = parsed.error; break }
            if (parsed.token) { full += parsed.token; setStreaming(full) }
          } catch {}
        }
        if (apiError) break
      }

      if (apiError) {
        setChatError(apiError)
      } else if (full) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(), role: 'assistant', content: full,
          model: 'gpt-oss:120b', created_at: new Date().toISOString(),
        }])

        // If the brain created tasks, run them immediately
        if (full.includes('```tasks')) {
          setRunningTasks(true)
          fetch('/api/tasks/auto-run', { method: 'POST' })
            .finally(() => setRunningTasks(false))
        }
      }
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Connection failed')
    } finally {
      setStreaming('')
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 18, color: 'var(--text-primary)' }}>AI Co-Founder</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#6EE7A0', animation: 'pulse-dot 2s ease-in-out infinite' }}/>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: '#6EE7A0' }}>gpt-oss:120b · online</span>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
        {messages.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>◎</div>
            <div style={{ fontSize: 15, marginBottom: 8 }}>Your AI co-founder is ready.</div>
            <div style={{ fontSize: 13, opacity: 0.6 }}>Describe your goal — it will plan, delegate, and execute.</div>
          </div>
        )}
        {messages.map(m => <MessageBubble key={m.id} msg={m} />)}
        {loading && <StreamingMessage content={streaming} />}
        {runningTasks && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', marginBottom: 12, background: 'rgba(110,231,160,.06)', border: '1px solid rgba(110,231,160,.2)', borderRadius: 10, fontFamily: 'var(--font-body)', fontSize: 13, color: '#6EE7A0' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#6EE7A0', animation: 'pulse-dot 1s ease-in-out infinite' }} />
            Agents running tasks — emails sending, posts publishing...
          </div>
        )}
        {chatError && (
          <div style={{
            margin: '0 0 16px', padding: '12px 16px',
            background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)',
            borderRadius: 10, fontFamily: 'var(--font-body)', fontSize: 13, color: '#F87171',
          }}>
            Error: {chatError}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 12 }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Describe your goal, a bug to fix, a campaign to launch..."
          rows={1}
          style={{
            flex: 1, resize: 'none', padding: '14px 16px',
            background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
            borderRadius: 10, color: 'var(--text-primary)', fontFamily: 'var(--font-body)',
            fontSize: 14, outline: 'none', lineHeight: 1.5,
            transition: 'border .2s', minHeight: 50, maxHeight: 140,
          }}
          onFocus={e => (e.target.style.borderColor = 'var(--border-accent)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border-subtle)')}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          style={{
            padding: '14px 22px', background: loading ? 'rgba(217,119,87,.4)' : 'var(--accent)',
            border: 'none', borderRadius: 10, color: '#0C0C0C',
            fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer', transition: 'all .2s',
          }}
        >
          {loading ? '◌' : '→'}
        </button>
      </div>
    </div>
  )
}
