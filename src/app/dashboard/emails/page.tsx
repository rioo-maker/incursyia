'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const COMPANY_ID = '00000000-0000-0000-0000-000000000001'
interface Email { id: string; from_addr: string; to_addr: string[]; subject: string; status: string; direction: string; opened: boolean; created_at: string }

export default function EmailsPage() {
  const [emails, setEmails] = useState<Email[]>([])
  const [composing, setComposing] = useState(false)
  const [draft, setDraft] = useState({ to: '', subject: '', body: '' })
  const [tab, setTab] = useState<'inbox' | 'outreach'>('inbox')
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    supabase.from('emails').select('*').eq('company_id', COMPANY_ID).order('created_at', { ascending: false })
      .then(({ data }) => setEmails(data as Email[] ?? []))
  }, [])

  const generateEmailWithAI = async () => {
    setGenerating(true)
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: '00000000-0000-0000-0000-000000000002',
        message: `Write a cold outreach email for: to ${draft.to || 'a prospect'} about ${draft.subject || 'our product'}. Output only the email body, no explanations.`,
        history: [],
      }),
    })
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let body = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const lines = decoder.decode(value).split('\n').filter(l => l.startsWith('data: '))
      for (const line of lines) {
        const d = line.slice(6)
        if (d === '[DONE]') break
        try { const { token } = JSON.parse(d); if (token) body += token } catch {}
      }
    }
    setDraft(p => ({ ...p, body }))
    setGenerating(false)
  }

  const sendEmail = async () => {
    await supabase.from('emails').insert({
      company_id: COMPANY_ID, from_addr: 'agent@incursyia.ai',
      to_addr: [draft.to], subject: draft.subject, body: draft.body,
      direction: 'outbound', status: 'sent',
    })
    setComposing(false)
    setDraft({ to: '', subject: '', body: '' })
    supabase.from('emails').select('*').eq('company_id', COMPANY_ID).order('created_at', { ascending: false })
      .then(({ data }) => setEmails(data as Email[] ?? []))
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', background: 'var(--bg-deep)',
    border: '1px solid var(--border-subtle)', borderRadius: 8,
    color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: 13, outline: 'none',
  }

  const filtered = emails.filter(e => tab === 'inbox' ? e.direction === 'inbound' : e.direction === 'outbound')

  return (
    <div style={{ padding: '32px 36px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, color: 'var(--text-primary)', marginBottom: 4 }}>Emails</h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)' }}>Outreach campaigns & unified inbox</p>
        </div>
        <button onClick={() => setComposing(true)} style={{ padding: '10px 20px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#0C0C0C', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>✦ AI Compose</button>
      </div>

      {composing && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <h3 style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 }}>Compose email</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input placeholder="To (email)" value={draft.to} onChange={e => setDraft(p => ({ ...p, to: e.target.value }))} style={inputStyle} />
            <input placeholder="Subject" value={draft.subject} onChange={e => setDraft(p => ({ ...p, subject: e.target.value }))} style={inputStyle} />
            <div style={{ position: 'relative' }}>
              <textarea placeholder="Body — or use AI to generate it" value={draft.body} onChange={e => setDraft(p => ({ ...p, body: e.target.value }))} style={{ ...inputStyle, resize: 'vertical', minHeight: 120 }} />
              <button onClick={generateEmailWithAI} disabled={generating} style={{
                position: 'absolute', top: 8, right: 8, padding: '4px 10px', background: 'var(--accent-subtle)',
                border: '1px solid var(--border-accent)', borderRadius: 6, color: 'var(--accent)',
                fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}>{generating ? '...' : '✦ AI'}</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button onClick={sendEmail} style={{ padding: '8px 20px', background: 'var(--accent)', border: 'none', borderRadius: 7, color: '#0C0C0C', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Send</button>
            <button onClick={() => setComposing(false)} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 7, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['inbox', 'outreach'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '7px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-body)', fontSize: 12, textTransform: 'capitalize',
            background: tab === t ? 'var(--accent-subtle)' : 'rgba(255,255,255,.04)',
            color: tab === t ? 'var(--accent)' : 'var(--text-muted)',
            fontWeight: tab === t ? 600 : 400,
          }}>{t}</button>
        ))}
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)' }}>No emails yet</div>
        ) : filtered.map(e => (
          <div key={e.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: e.status === 'sent' ? '#6EE7A0' : e.status === 'failed' ? '#F87171' : 'var(--text-muted)' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--text-primary)', marginBottom: 2 }}>{e.subject}</div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)' }}>{e.direction === 'outbound' ? `To: ${e.to_addr?.[0]}` : `From: ${e.from_addr}`}</div>
            </div>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)' }}>{new Date(e.created_at).toLocaleDateString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
