'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const COMPANY_ID = '00000000-0000-0000-0000-000000000001'
interface Campaign { id: string; name: string; platform: string; status: string; budget_daily: number; spent: number; impressions: number; clicks: number; conversions: number; roas: number; created_at: string }

const PLATFORM_COLOR: Record<string, string> = {
  meta: '#1877F2', google: '#EA4335', tiktok: '#010101', linkedin: '#0077B5',
}

export default function AdsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [creating, setCreating] = useState(false)
  const [newCamp, setNewCamp] = useState({ name: '', platform: 'meta', budget_daily: 50 })
  const [generating, setGenerating] = useState(false)
  const [generatedCopy, setGeneratedCopy] = useState('')

  const load = () => {
    supabase.from('ad_campaigns').select('*').eq('company_id', COMPANY_ID).order('created_at', { ascending: false })
      .then(({ data }) => setCampaigns(data as Campaign[] ?? []))
  }
  useEffect(() => { load() }, [])

  const generateAdCopy = async () => {
    setGenerating(true)
    const res = await fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: '00000000-0000-0000-0000-000000000002',
        message: `Create a complete ${newCamp.platform} ad campaign for IncursYIA (AI co-founder SaaS). Budget: $${newCamp.budget_daily}/day. Include: headline, primary text, description, call-to-action, target audience, and recommended ad sets.`,
        history: [],
      }),
    })
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let copy = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const lines = decoder.decode(value).split('\n').filter(l => l.startsWith('data: '))
      for (const line of lines) {
        const d = line.slice(6)
        if (d === '[DONE]') break
        try { const { token } = JSON.parse(d); if (token) copy += token } catch {}
      }
    }
    setGeneratedCopy(copy)
    setGenerating(false)
  }

  const createCampaign = async () => {
    await supabase.from('ad_campaigns').insert({ ...newCamp, company_id: COMPANY_ID, status: 'draft', config: { ai_copy: generatedCopy } })
    setCreating(false)
    setNewCamp({ name: '', platform: 'meta', budget_daily: 50 })
    setGeneratedCopy('')
    load()
  }

  const inputStyle: React.CSSProperties = {
    padding: '10px 14px', background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)',
    borderRadius: 8, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: 13, outline: 'none',
  }

  return (
    <div style={{ padding: '32px 36px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, color: 'var(--text-primary)', marginBottom: 4 }}>Ad Campaigns</h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)' }}>AI-powered campaigns across Meta, Google, TikTok</p>
        </div>
        <button onClick={() => setCreating(true)} style={{ padding: '10px 20px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#0C0C0C', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>✦ New Campaign</button>
      </div>

      {creating && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, marginBottom: 12 }}>
            <input placeholder="Campaign name" value={newCamp.name} onChange={e => setNewCamp(p => ({ ...p, name: e.target.value }))} style={inputStyle} />
            <select value={newCamp.platform} onChange={e => setNewCamp(p => ({ ...p, platform: e.target.value }))} style={inputStyle}>
              {['meta','google','tiktok','linkedin'].map(p => <option key={p}>{p}</option>)}
            </select>
            <input type="number" min={5} value={newCamp.budget_daily} onChange={e => setNewCamp(p => ({ ...p, budget_daily: +e.target.value }))} placeholder="Daily budget $" style={{ ...inputStyle, width: 100 }} />
          </div>
          <button onClick={generateAdCopy} disabled={generating} style={{
            padding: '10px 20px', background: 'var(--accent-subtle)', border: '1px solid var(--border-accent)',
            borderRadius: 8, color: 'var(--accent)', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 12,
          }}>{generating ? 'Generating ad copy...' : '✦ Generate AI ad copy'}</button>
          {generatedCopy && (
            <div style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-accent)', borderRadius: 8, padding: 14, marginBottom: 12, fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
              {generatedCopy}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={createCampaign} style={{ padding: '8px 20px', background: 'var(--accent)', border: 'none', borderRadius: 7, color: '#0C0C0C', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Create</button>
            <button onClick={() => setCreating(false)} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 7, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {campaigns.length === 0 ? (
          <div style={{ gridColumn: '1/-1', padding: 40, textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>No campaigns yet</div>
        ) : campaigns.map(c => (
          <div key={c.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 20, borderTop: `3px solid ${PLATFORM_COLOR[c.platform] ?? 'var(--accent)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: PLATFORM_COLOR[c.platform], textTransform: 'capitalize', marginTop: 2 }}>{c.platform}</div>
              </div>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-body)', color: c.status === 'active' ? '#6EE7A0' : 'var(--text-muted)', background: 'rgba(255,255,255,.04)', padding: '3px 8px', borderRadius: 5 }}>{c.status}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
              {[
                { l: 'Budget/day', v: `$${c.budget_daily}` },
                { l: 'Spent', v: `$${c.spent}` },
                { l: 'Impressions', v: c.impressions.toLocaleString() },
                { l: 'ROAS', v: `${c.roas}x` },
              ].map(s => (
                <div key={s.l} style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{s.v}</div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
