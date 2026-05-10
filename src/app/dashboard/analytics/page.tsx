'use client'
import { useEffect, useState } from 'react'
import { supabase, PlatformStats } from '@/lib/supabase'

export default function AnalyticsPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [analysis, setAnalysis] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.from('platform_stats').select('*').single().then(({ data }) => setStats(data as PlatformStats))
    const sub = supabase.channel('analytics')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'platform_stats' }, p => setStats(p.new as PlatformStats))
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [])

  const generateAnalysis = async () => {
    if (!stats) return
    setLoading(true)
    setAnalysis('')
    const res = await fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: '00000000-0000-0000-0000-000000000002',
        message: `Analyze these platform metrics and give strategic recommendations:
- Total revenue: €${stats.revenue_eur.toLocaleString()}
- Companies powered: ${stats.companies}
- Ad campaigns launched: ${stats.ad_campaigns}
- Tasks automated: ${stats.tasks_done}

Provide: performance assessment, growth rate estimate, top 3 opportunities, and 2 risks to watch.`,
        history: [],
      }),
    })
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const lines = decoder.decode(value).split('\n').filter(l => l.startsWith('data: '))
      for (const line of lines) {
        const d = line.slice(6)
        if (d === '[DONE]') break
        try { const { token } = JSON.parse(d); if (token) setAnalysis(prev => prev + token) } catch {}
      }
    }
    setLoading(false)
  }

  if (!stats) return <div style={{ padding: 32, fontFamily: 'var(--font-body)', color: 'var(--text-muted)' }}>Loading...</div>

  const kpis = [
    { label: 'Revenue Generated', value: `€${(stats.revenue_eur / 1000).toFixed(1)}k`, delta: '+12.4%', color: '#6EE7A0' },
    { label: 'Companies Powered', value: stats.companies.toLocaleString(), delta: '+3 today', color: '#93C5FD' },
    { label: 'Ad Campaigns', value: stats.ad_campaigns.toLocaleString(), delta: '+8 today', color: 'var(--accent)' },
    { label: 'Tasks Automated', value: stats.tasks_done.toLocaleString(), delta: '+142 today', color: '#FCD34D' },
  ]

  return (
    <div style={{ padding: '32px 36px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, color: 'var(--text-primary)', marginBottom: 4 }}>Analytics</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#6EE7A0', animation: 'pulse-dot 2s ease-in-out infinite' }}/>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#6EE7A0' }}>Live data</span>
          </div>
        </div>
        <button onClick={generateAnalysis} disabled={loading} style={{
          padding: '10px 20px', background: loading ? 'rgba(217,119,87,.4)' : 'var(--accent)',
          border: 'none', borderRadius: 8, color: '#0C0C0C',
          fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>{loading ? 'Analyzing...' : '✦ AI Analysis'}</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16, marginBottom: 24 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '20px 24px' }}>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.08em' }}>{k.label}</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 32, fontWeight: 700, color: k.color, letterSpacing: '-0.02em' }}>{k.value}</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#6EE7A0', marginTop: 6 }}>{k.delta}</div>
          </div>
        ))}
      </div>

      {/* Revenue chart (visual bars) */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 24, marginBottom: 20 }}>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 20 }}>Revenue trend (simulated)</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 100 }}>
          {[40,55,48,70,65,80,72,90,85,95,88,100].map((h, i) => (
            <div key={i} style={{ flex: 1, background: `linear-gradient(to top, var(--accent), rgba(217,119,87,.2))`, height: `${h}%`, borderRadius: '3px 3px 0 0', opacity: .8 + i * .01 }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map(m => (
            <span key={m} style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--text-muted)' }}>{m}</span>
          ))}
        </div>
      </div>

      {/* AI Analysis */}
      {(analysis || loading) && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-accent)', borderRadius: 12, padding: 24 }}>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, color: 'var(--accent)', marginBottom: 14, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            ✦ AI Strategic Analysis — {new Date().toLocaleTimeString()}
          </div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {analysis || <span style={{ opacity: .4 }}>Analyzing...</span>}
          </div>
        </div>
      )}
    </div>
  )
}
