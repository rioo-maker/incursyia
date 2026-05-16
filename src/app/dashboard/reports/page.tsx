'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useCompany } from '@/lib/useCompany'

interface CeoReport {
  id: string
  week_start: string
  week_end: string
  status: string
  summary: string
  content: string
  metrics: {
    revenue?: number
    tasks_completed?: number
    agents_active?: number
    emails_sent?: number
    posts_published?: number
  }
  created_at: string
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, ...style }}>
      {children}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    completed: { bg: 'rgba(110,231,160,.1)', text: '#6EE7A0' },
    generating: { bg: 'rgba(217,119,87,.1)', text: 'var(--accent)' },
    pending: { bg: 'rgba(252,211,77,.1)', text: '#FCD34D' },
    failed: { bg: 'rgba(248,113,113,.1)', text: '#F87171' },
  }
  const c = colors[status] ?? colors.pending
  return (
    <span style={{
      fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600,
      color: c.text, background: c.bg, padding: '3px 10px', borderRadius: 20,
      textTransform: 'capitalize',
    }}>
      {status}
    </span>
  )
}

export default function ReportsPage() {
  const company = useCompany()
  const [reports, setReports] = useState<CeoReport[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = (companyId: string) => {
    supabase.from('ceo_reports').select('*')
      .eq('company_id', companyId)
      .order('week_start', { ascending: false })
      .then(({ data }) => {
        setReports((data as CeoReport[]) ?? [])
        setLoading(false)
      })
  }

  useEffect(() => {
    if (!company) return
    load(company.companyId)
    const sub = supabase.channel('ceo_reports')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ceo_reports', filter: `company_id=eq.${company.companyId}` }, () => load(company.companyId))
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [company])

  const generateReport = async () => {
    if (!company || generating) return
    setGenerating(true)
    try {
      await fetch('/api/reports/ceo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: company.companyId }),
      })
      load(company.companyId)
    } catch {
      // silent
    } finally {
      setGenerating(false)
    }
  }

  const formatWeek = (start: string, end: string) => {
    const s = new Date(start)
    const e = new Date(end)
    return `${s.toLocaleDateString('en', { month: 'short', day: 'numeric' })} - ${e.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}`
  }

  if (loading && company) {
    return <div style={{ padding: 32, fontFamily: 'var(--font-body)', color: 'var(--text-muted)' }}>Loading...</div>
  }

  return (
    <div style={{ padding: '32px 36px', maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 28, color: 'var(--text-primary)', marginBottom: 4 }}>
            CEO Reports
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)' }}>
            Weekly AI-generated business intelligence
          </p>
        </div>
        <button
          onClick={generateReport}
          disabled={generating || !company}
          style={{
            padding: '10px 20px',
            background: generating ? 'rgba(217,119,87,.4)' : 'var(--accent)',
            border: 'none', borderRadius: 8, color: '#0C0C0C',
            fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          {generating ? 'Generating...' : 'Generate Report'}
        </button>
      </div>

      {reports.length === 0 ? (
        <Card style={{ padding: '48px 32px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 40, marginBottom: 16, opacity: 0.3 }}>&#9776;</div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 16, color: 'var(--text-secondary)', marginBottom: 8 }}>
            No reports yet
          </div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
            Your first weekly report will be generated automatically. You can also generate one now.
          </div>
          <button
            onClick={generateReport}
            disabled={generating || !company}
            style={{
              padding: '12px 24px', background: 'var(--accent)', border: 'none', borderRadius: 8,
              color: '#0C0C0C', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {generating ? 'Generating...' : 'Generate First Report'}
          </button>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {reports.map(report => {
            const isExpanded = expandedId === report.id
            return (
              <Card key={report.id}>
                {/* Report header */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : report.id)}
                  style={{ padding: '18px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {formatWeek(report.week_start, report.week_end)}
                      </span>
                      <StatusBadge status={report.status} />
                    </div>
                    {report.summary && (
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        {report.summary}
                      </div>
                    )}
                  </div>

                  {/* Metrics pills */}
                  {report.metrics && (
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      {report.metrics.tasks_completed !== undefined && (
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: '#93C5FD', background: 'rgba(147,197,253,.08)', padding: '4px 10px', borderRadius: 20 }}>
                          {report.metrics.tasks_completed} tasks
                        </span>
                      )}
                      {report.metrics.revenue !== undefined && report.metrics.revenue > 0 && (
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: '#6EE7A0', background: 'rgba(110,231,160,.08)', padding: '4px 10px', borderRadius: 20 }}>
                          ${(report.metrics.revenue / 100).toFixed(0)}
                        </span>
                      )}
                    </div>
                  )}

                  <span style={{ color: 'var(--text-muted)', fontSize: 12, flexShrink: 0 }}>{isExpanded ? '▲' : '▼'}</span>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '20px' }}>
                    {/* Metrics row */}
                    {report.metrics && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 12, marginBottom: 20 }}>
                        {[
                          { label: 'Revenue', value: report.metrics.revenue !== undefined ? `$${(report.metrics.revenue / 100).toFixed(0)}` : '-', color: '#6EE7A0' },
                          { label: 'Tasks Done', value: report.metrics.tasks_completed?.toString() ?? '-', color: '#93C5FD' },
                          { label: 'Agents Active', value: report.metrics.agents_active?.toString() ?? '-', color: 'var(--accent)' },
                          { label: 'Emails Sent', value: report.metrics.emails_sent?.toString() ?? '-', color: '#FCD34D' },
                          { label: 'Posts Published', value: report.metrics.posts_published?.toString() ?? '-', color: '#C4B5FD' },
                        ].map(m => (
                          <div key={m.label} style={{ background: 'var(--bg-deep)', borderRadius: 8, padding: '12px 14px' }}>
                            <div style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.08em' }}>{m.label}</div>
                            <div style={{ fontFamily: 'var(--font-body)', fontSize: 20, fontWeight: 700, color: m.color }}>{m.value}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Report content */}
                    <div style={{
                      fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--text-secondary)',
                      lineHeight: 1.8, whiteSpace: 'pre-wrap',
                    }}>
                      {report.content || 'Report content is being generated...'}
                    </div>

                    <div style={{ marginTop: 16, fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)' }}>
                      Generated {new Date(report.created_at).toLocaleString()}
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
