'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useCompany } from '@/lib/useCompany'

interface Post { id: string; platform: string; content: string; status: string; scheduled_at?: string; published_at?: string; metrics: Record<string, number> }

const PLATFORM_COLOR: Record<string, string> = {
  twitter: '#1DA1F2', linkedin: '#0077B5', instagram: '#E1306C', facebook: '#1877F2',
}

export default function SocialPage() {
  const company = useCompany()
  const [posts, setPosts] = useState<Post[]>([])
  const [composing, setComposing] = useState(false)
  const [draft, setDraft] = useState({ platform: 'twitter', content: '', scheduled_at: '' })
  const [generating, setGenerating] = useState(false)

  const load = (companyId: string) => {
    supabase.from('social_posts').select('*').eq('company_id', companyId).order('created_at', { ascending: false })
      .then(({ data }) => setPosts(data as Post[] ?? []))
  }

  useEffect(() => {
    if (!company) return
    load(company.companyId)
    const sub = supabase.channel('social_page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'social_posts', filter: `company_id=eq.${company.companyId}` }, () => load(company.companyId))
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [company])

  const generatePost = async () => {
    if (!company) return
    setGenerating(true)
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: company.conversationId,
        message: `Write a compelling ${draft.platform} post for ${company.companyName}. Make it engaging, under ${draft.platform === 'twitter' ? '280' : '500'} characters. Output only the post text.`,
        history: [],
      }),
    })
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let content = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const lines = decoder.decode(value).split('\n').filter(l => l.startsWith('data: '))
      for (const line of lines) {
        const d = line.slice(6)
        if (d === '[DONE]') break
        try { const { token } = JSON.parse(d); if (token) content += token } catch {}
      }
    }
    setDraft(p => ({ ...p, content }))
    setGenerating(false)
  }

  const schedulePost = async () => {
    if (!company) return

    let externalId: string | null = null
    let postStatus = draft.scheduled_at ? 'scheduled' : 'draft'

    // If no scheduled time = publish now
    if (!draft.scheduled_at) {
      const res = await fetch('/api/social/post', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: draft.platform, content: draft.content }),
      })
      const data = await res.json()
      if (data.ok) {
        postStatus = 'published'
        externalId = data.external_id ?? null
      } else if (data.needs_setup) {
        alert(`⚠️ Post saved as draft. To publish on ${draft.platform}, add the required API keys to your Vercel env vars:\n\n${
          draft.platform === 'twitter'
            ? 'TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET'
            : draft.platform === 'linkedin'
            ? 'LINKEDIN_ACCESS_TOKEN, LINKEDIN_AUTHOR_ID'
            : 'META_ACCESS_TOKEN, META_AD_ACCOUNT_ID'
        }`)
      } else {
        alert(`Failed to post: ${data.error}`)
      }
    }

    await supabase.from('social_posts').insert({
      company_id: company.companyId,
      platform: draft.platform,
      content: draft.content,
      status: postStatus,
      scheduled_at: draft.scheduled_at || null,
      external_id: externalId,
      published_at: postStatus === 'published' ? new Date().toISOString() : null,
    })
    setComposing(false)
    setDraft({ platform: 'twitter', content: '', scheduled_at: '' })
    load(company.companyId)
  }

  const inputStyle: React.CSSProperties = {
    padding: '10px 14px', background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)',
    borderRadius: 8, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: 13, outline: 'none',
  }

  return (
    <div style={{ padding: '32px 36px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, color: 'var(--text-primary)', marginBottom: 4 }}>Social Media</h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)' }}>AI-powered content queue across platforms</p>
        </div>
        <button onClick={() => setComposing(true)} style={{ padding: '10px 20px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#0C0C0C', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>✦ AI Post</button>
      </div>

      {composing && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <select value={draft.platform} onChange={e => setDraft(p => ({ ...p, platform: e.target.value }))} style={inputStyle}>
              {['twitter','linkedin','instagram','facebook'].map(p => <option key={p}>{p}</option>)}
            </select>
            <input type="datetime-local" value={draft.scheduled_at} onChange={e => setDraft(p => ({ ...p, scheduled_at: e.target.value }))} style={{ ...inputStyle, flex: 1 }} />
          </div>
          <div style={{ position: 'relative' }}>
            <textarea
              placeholder={`Write your ${draft.platform} post... or use AI`}
              value={draft.content} onChange={e => setDraft(p => ({ ...p, content: e.target.value }))}
              style={{ ...inputStyle, width: '100%', resize: 'vertical', minHeight: 100 }}
            />
            <button onClick={generatePost} disabled={generating || !company} style={{
              position: 'absolute', top: 8, right: 8, padding: '4px 10px', background: 'var(--accent-subtle)',
              border: '1px solid var(--border-accent)', borderRadius: 6, color: 'var(--accent)',
              fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}>{generating ? '...' : '✦ AI'}</button>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center' }}>
            <button onClick={schedulePost} style={{ padding: '8px 20px', background: 'var(--accent)', border: 'none', borderRadius: 7, color: '#0C0C0C', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {draft.scheduled_at ? 'Schedule' : 'Save draft'}
            </button>
            <button onClick={() => setComposing(false)} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 7, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            {draft.content && <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{draft.content.length} chars</span>}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {posts.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>No posts yet — generate your first AI post</div>
        ) : posts.map(p => (
          <div key={p.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 18, borderLeft: `3px solid ${PLATFORM_COLOR[p.platform] ?? 'var(--accent)'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, color: PLATFORM_COLOR[p.platform] ?? 'var(--text-muted)', textTransform: 'capitalize' }}>{p.platform}</span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: p.status === 'published' ? '#6EE7A0' : p.status === 'scheduled' ? '#FCD34D' : 'var(--text-muted)', background: 'rgba(255,255,255,.04)', padding: '2px 8px', borderRadius: 4 }}>{p.status}</span>
              {p.scheduled_at && <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>📅 {new Date(p.scheduled_at).toLocaleString()}</span>}
            </div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{p.content}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
