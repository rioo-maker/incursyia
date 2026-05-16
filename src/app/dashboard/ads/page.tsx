'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useCompany } from '@/lib/useCompany'

interface Campaign { id: string; name: string; platform: string; status: string; budget_daily: number; spent: number; impressions: number; clicks: number; conversions: number; roas: number; created_at: string; config?: { ai_copy?: string; campaign_id?: string } }
interface VideoAd { id: string; title: string; status: string; provider: string; video_url?: string; prompt: string; created_at: string }

const PLATFORM_COLOR: Record<string, string> = {
  meta: '#1877F2', google: '#EA4335', tiktok: '#010101', linkedin: '#0077B5',
}

const PLATFORM_SETUP: Record<string, string> = {
  meta: 'META_ACCESS_TOKEN + META_AD_ACCOUNT_ID',
  google: 'GOOGLE_ADS_DEVELOPER_TOKEN + GOOGLE_ADS_CUSTOMER_ID',
  tiktok: 'TIKTOK_ACCESS_TOKEN + TIKTOK_ADVERTISER_ID',
  linkedin: 'LINKEDIN_ACCESS_TOKEN + LINKEDIN_AUTHOR_ID',
}

export default function AdsPage() {
  const company = useCompany()
  const [tab, setTab] = useState<'campaigns' | 'video'>('campaigns')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [creating, setCreating] = useState(false)
  const [newCamp, setNewCamp] = useState({ name: '', platform: 'meta', budget_daily: 50 })
  const [generating, setGenerating] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [generatedCopy, setGeneratedCopy] = useState('')
  const [videos, setVideos] = useState<VideoAd[]>([])
  const [videoPrompt, setVideoPrompt] = useState('')
  const [generatingVideo, setGeneratingVideo] = useState(false)

  const load = (companyId: string) => {
    supabase.from('ad_campaigns').select('*').eq('company_id', companyId).order('created_at', { ascending: false })
      .then(({ data }) => setCampaigns(data as Campaign[] ?? []))
  }

  const loadVideos = (companyId: string) => {
    supabase.from('video_ads').select('*').eq('company_id', companyId).order('created_at', { ascending: false })
      .then(({ data }) => setVideos((data as VideoAd[]) ?? []))
  }

  useEffect(() => {
    if (!company) return
    load(company.companyId)
    loadVideos(company.companyId)
    const sub = supabase.channel('ads_page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ad_campaigns', filter: `company_id=eq.${company.companyId}` }, () => load(company.companyId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'video_ads', filter: `company_id=eq.${company.companyId}` }, () => loadVideos(company.companyId))
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [company])

  const generateVideo = async () => {
    if (!company || !videoPrompt.trim()) return
    setGeneratingVideo(true)
    await supabase.from('video_ads').insert({
      company_id: company.companyId,
      title: videoPrompt.slice(0, 80),
      prompt: videoPrompt,
      provider: 'pending',
      status: 'queued',
    })
    setVideoPrompt('')
    setGeneratingVideo(false)
    loadVideos(company.companyId)
  }

  const generateAdCopy = async () => {
    if (!company) return
    setGenerating(true)
    setGeneratedCopy('')
    const res = await fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: company.conversationId,
        message: `Create a complete ${newCamp.platform} ad campaign for ${company.companyName}. Budget: $${newCamp.budget_daily}/day. Include: headline, primary text, description, call-to-action, target audience, and recommended ad sets.`,
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
        try { const { token } = JSON.parse(d); if (token) { copy += token; setGeneratedCopy(copy) } } catch {}
      }
    }
    setGenerating(false)
  }

  const createCampaign = async () => {
    if (!company) return
    setLaunching(true)

    // Try to launch on the real platform
    const launchRes = await fetch('/api/ads/launch', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newCamp, ai_copy: generatedCopy, company_id: company.companyId }),
    })
    const launchData = await launchRes.json()

    const status = launchData.ok ? 'active' : 'draft'
    if (!launchData.ok && launchData.needs_setup) {
      alert(`⚠️ Campaign saved as draft. To launch on ${newCamp.platform}, add to Vercel env vars:\n\n${PLATFORM_SETUP[newCamp.platform] ?? 'Platform API credentials'}`)
    } else if (!launchData.ok && launchData.error) {
      alert(`Launch failed: ${launchData.error}`)
    }

    await supabase.from('ad_campaigns').insert({
      ...newCamp,
      company_id: company.companyId,
      status,
      spent: 0, impressions: 0, clicks: 0, conversions: 0, roas: 0,
      config: { ai_copy: generatedCopy, ...(launchData.ok ? { campaign_id: launchData.campaignId, adset_id: launchData.adSetId } : {}) },
    })

    setLaunching(false)
    setCreating(false)
    setNewCamp({ name: '', platform: 'meta', budget_daily: 50 })
    setGeneratedCopy('')
    load(company.companyId)
  }

  const inputStyle: React.CSSProperties = {
    padding: '10px 14px', background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)',
    borderRadius: 8, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: 13, outline: 'none',
  }

  return (
    <div style={{ padding: '32px 36px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, color: 'var(--text-primary)', marginBottom: 4 }}>Ads & Video</h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)' }}>AI-powered campaigns and video ads</p>
        </div>
        {tab === 'campaigns' && (
          <button onClick={() => setCreating(true)} style={{ padding: '10px 20px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#0C0C0C', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>✦ New Campaign</button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['campaigns', 'video'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '7px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-body)', fontSize: 12, textTransform: 'capitalize',
            background: tab === t ? 'var(--accent-subtle)' : 'rgba(255,255,255,.04)',
            color: tab === t ? 'var(--accent)' : 'var(--text-muted)',
            fontWeight: tab === t ? 600 : 400,
          }}>
            {t === 'campaigns' ? 'Ad Campaigns' : 'Video Ads'}
          </button>
        ))}
      </div>

      {tab === 'campaigns' && creating && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, marginBottom: 12 }}>
            <input placeholder="Campaign name" value={newCamp.name} onChange={e => setNewCamp(p => ({ ...p, name: e.target.value }))} style={inputStyle} />
            <select value={newCamp.platform} onChange={e => setNewCamp(p => ({ ...p, platform: e.target.value }))} style={inputStyle}>
              {['meta','google','tiktok','linkedin'].map(p => <option key={p}>{p}</option>)}
            </select>
            <input type="number" min={5} value={newCamp.budget_daily} onChange={e => setNewCamp(p => ({ ...p, budget_daily: +e.target.value }))} placeholder="Daily budget $" style={{ ...inputStyle, width: 100 }} />
          </div>
          <button onClick={generateAdCopy} disabled={generating || !company} style={{
            padding: '10px 20px', background: 'var(--accent-subtle)', border: '1px solid var(--border-accent)',
            borderRadius: 8, color: 'var(--accent)', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 12,
          }}>{generating ? 'Generating ad copy...' : '✦ Generate AI ad copy'}</button>
          {generatedCopy && (
            <div style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-accent)', borderRadius: 8, padding: 14, marginBottom: 12, fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
              {generatedCopy}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={createCampaign} disabled={launching || !newCamp.name} style={{ padding: '8px 20px', background: 'var(--accent)', border: 'none', borderRadius: 7, color: '#0C0C0C', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {launching ? 'Launching...' : '🚀 Launch'}
            </button>
            <button onClick={() => setCreating(false)} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 7, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)' }}>
              Without API keys → saves as draft
            </span>
          </div>
        </div>
      )}

      {tab === 'campaigns' && (
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
                <span style={{ fontSize: 11, fontFamily: 'var(--font-body)', color: c.status === 'active' ? '#6EE7A0' : c.status === 'draft' ? '#FCD34D' : 'var(--text-muted)', background: 'rgba(255,255,255,.04)', padding: '3px 8px', borderRadius: 5 }}>{c.status}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                {[
                  { l: 'Budget/day', v: `$${c.budget_daily}` },
                  { l: 'Spent', v: `$${c.spent ?? 0}` },
                  { l: 'Impressions', v: (c.impressions ?? 0).toLocaleString() },
                  { l: 'ROAS', v: `${c.roas ?? 0}x` },
                ].map(s => (
                  <div key={s.l} style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{s.v}</div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{s.l}</div>
                  </div>
                ))}
              </div>
              {c.config?.campaign_id && (
                <div style={{ marginTop: 10, fontFamily: 'var(--font-body)', fontSize: 10, color: '#6EE7A0' }}>
                  ✓ Live on {c.platform} · ID: {c.config.campaign_id}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* VIDEO ADS TAB */}
      {tab === 'video' && (
        <div>
          {/* Generate new video */}
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
            borderRadius: 12, padding: 20, marginBottom: 20,
          }}>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>
              Generate AI Video Ad
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                type="text"
                placeholder="Describe your video ad... e.g. 30-second product promo with text overlays"
                value={videoPrompt}
                onChange={e => setVideoPrompt(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && generateVideo()}
                style={{
                  flex: 1, padding: '12px 16px',
                  background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)',
                  borderRadius: 8, color: 'var(--text-primary)',
                  fontFamily: 'var(--font-body)', fontSize: 13, outline: 'none',
                }}
              />
              <button
                onClick={generateVideo}
                disabled={generatingVideo || !videoPrompt.trim()}
                style={{
                  padding: '12px 20px',
                  background: generatingVideo || !videoPrompt.trim() ? 'rgba(217,119,87,.3)' : 'var(--accent)',
                  border: 'none', borderRadius: 8, color: '#0C0C0C',
                  fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {generatingVideo ? 'Queueing...' : '✦ Generate'}
              </button>
            </div>
            <div style={{ marginTop: 10, fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)' }}>
              Requires a Video Generation API connected in Connections. Videos are generated via Runway, HeyGen, Synthesia, or Pika.
            </div>
          </div>

          {/* Video list */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {videos.length === 0 ? (
              <div style={{
                gridColumn: '1/-1', padding: '48px 32px', textAlign: 'center',
                background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-subtle)',
              }}>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 32, marginBottom: 12, opacity: 0.3 }}>◆</div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  No video ads yet
                </div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)' }}>
                  Describe what you want and your AI will generate it
                </div>
              </div>
            ) : videos.map(v => (
              <div key={v.id} style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                borderRadius: 12, overflow: 'hidden',
                borderTop: `3px solid ${v.status === 'completed' ? '#6EE7A0' : v.status === 'queued' ? '#FCD34D' : v.status === 'generating' ? 'var(--accent)' : '#F87171'}`,
              }}>
                {/* Video preview area */}
                <div style={{
                  height: 140, background: 'var(--bg-deep)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {v.video_url ? (
                    <video src={v.video_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} controls />
                  ) : (
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>
                      {v.status === 'queued' && '⏳ Queued for generation'}
                      {v.status === 'generating' && '⚙ Generating...'}
                      {v.status === 'failed' && '✕ Generation failed'}
                      {v.status === 'completed' && !v.video_url && 'Video ready'}
                    </div>
                  )}
                </div>
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {v.title}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{
                      fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600,
                      color: v.status === 'completed' ? '#6EE7A0' : v.status === 'queued' ? '#FCD34D' : v.status === 'generating' ? 'var(--accent)' : '#F87171',
                      background: 'rgba(255,255,255,.04)', padding: '3px 10px', borderRadius: 20,
                      textTransform: 'capitalize',
                    }}>
                      {v.status}
                    </span>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)' }}>
                      {new Date(v.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
