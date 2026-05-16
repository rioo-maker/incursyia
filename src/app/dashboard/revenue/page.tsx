'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useCompany } from '@/lib/useCompany'
import Link from 'next/link'

interface RevenueSnapshot {
  id: string
  date: string
  amount: number
  currency: string
  source: string
}

interface Transaction {
  id: string
  amount: number
  currency: string
  description: string
  status: string
  created_at: string
}

interface RevenueData {
  balance: number
  currency: string
  transactions: Transaction[]
  connected: boolean
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, ...style }}>
      {children}
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    succeeded: '#6EE7A0', pending: '#FCD34D', failed: '#F87171',
  }
  return <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: colors[status] ?? '#5A5A5A', flexShrink: 0 }} />
}

export default function RevenuePage() {
  const company = useCompany()
  const [snapshots, setSnapshots] = useState<RevenueSnapshot[]>([])
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch revenue data from API
  useEffect(() => {
    fetch('/api/revenue')
      .then(r => r.json())
      .then(data => {
        setRevenueData(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Fetch snapshots from Supabase
  useEffect(() => {
    if (!company) return
    const load = () => {
      supabase.from('revenue_snapshots').select('*')
        .eq('company_id', company.companyId)
        .order('date', { ascending: false })
        .limit(7)
        .then(({ data }) => setSnapshots((data as RevenueSnapshot[]) ?? []))
    }
    load()
    const sub = supabase.channel('revenue_snapshots')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'revenue_snapshots', filter: `company_id=eq.${company.companyId}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [company])

  const isConnected = revenueData?.connected ?? false
  const totalRevenue = revenueData?.balance ?? 0
  const transactions = revenueData?.transactions ?? []
  const currency = revenueData?.currency ?? 'usd'

  // Compute KPIs
  const now = new Date()
  const thisMonth = transactions.filter(t => {
    const d = new Date(t.created_at)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const monthlyRevenue = thisMonth.reduce((s, t) => s + (t.status === 'succeeded' ? t.amount : 0), 0)
  const txCount = transactions.filter(t => t.status === 'succeeded').length

  // Last month for MRR growth
  const lastMonth = transactions.filter(t => {
    const d = new Date(t.created_at)
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return d.getMonth() === prev.getMonth() && d.getFullYear() === prev.getFullYear()
  })
  const lastMonthRevenue = lastMonth.reduce((s, t) => s + (t.status === 'succeeded' ? t.amount : 0), 0)
  const mrrGrowth = lastMonthRevenue > 0 ? Math.round(((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100) : 0

  const formatCurrency = (amount: number) => {
    const sym = currency === 'eur' ? '€' : '$'
    return amount >= 100000 ? `${sym}${(amount / 100000).toFixed(1)}k` : `${sym}${(amount / 100).toFixed(2)}`
  }

  // Bar chart data: use snapshots if available, otherwise generate from transactions
  const chartData: { label: string; value: number }[] = []
  if (snapshots.length > 0) {
    const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date))
    sorted.forEach(s => {
      const d = new Date(s.date)
      chartData.push({ label: d.toLocaleDateString('en', { weekday: 'short' }), value: s.amount })
    })
  } else {
    // Build from last 7 days of transactions
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dayStr = d.toISOString().slice(0, 10)
      const dayTotal = transactions
        .filter(t => t.status === 'succeeded' && t.created_at.slice(0, 10) === dayStr)
        .reduce((s, t) => s + t.amount, 0)
      chartData.push({ label: d.toLocaleDateString('en', { weekday: 'short' }), value: dayTotal })
    }
  }
  const maxChart = Math.max(...chartData.map(d => d.value), 1)

  if (loading) {
    return <div style={{ padding: 32, fontFamily: 'var(--font-body)', color: 'var(--text-muted)' }}>Loading...</div>
  }

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1200 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 28, color: 'var(--text-primary)', marginBottom: 4 }}>
          Revenue
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)' }}>
          {isConnected ? 'Live revenue data from Stripe' : 'Connect Stripe to track your revenue'}
        </p>
      </div>

      {!isConnected ? (
        <Card style={{ padding: '48px 32px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 40, marginBottom: 16, opacity: 0.3 }}>$</div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 16, color: 'var(--text-secondary)', marginBottom: 8 }}>
            Connect Stripe to track your revenue
          </div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
            Link your Stripe account to see real-time revenue, transactions, and growth metrics.
          </div>
          <Link href="/dashboard/connections" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '12px 24px', background: 'var(--accent)', borderRadius: 8,
            color: '#0C0C0C', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600,
            textDecoration: 'none',
          }}>
            Connect Stripe
          </Link>
        </Card>
      ) : (
        <>
          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16, marginBottom: 28 }}>
            {[
              { label: 'Total Revenue', value: formatCurrency(totalRevenue), color: '#6EE7A0' },
              { label: 'Monthly Revenue', value: formatCurrency(monthlyRevenue), color: 'var(--accent)' },
              { label: 'Transactions', value: txCount.toString(), color: '#93C5FD' },
              { label: 'MRR Growth', value: `${mrrGrowth >= 0 ? '+' : ''}${mrrGrowth}%`, color: mrrGrowth >= 0 ? '#6EE7A0' : '#F87171' },
            ].map(k => (
              <Card key={k.label} style={{ padding: '20px 24px' }}>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.08em' }}>{k.label}</div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 28, fontWeight: 700, color: k.color }}>{k.value}</div>
              </Card>
            ))}
          </div>

          {/* Revenue chart */}
          <Card style={{ padding: 24, marginBottom: 20 }}>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 16 }}>Last 7 days</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120 }}>
              {chartData.map((d, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: '100%', borderRadius: '4px 4px 0 0',
                    background: d.value > 0 ? 'var(--accent)' : 'rgba(217,119,87,.15)',
                    height: `${Math.max((d.value / maxChart) * 100, 4)}%`,
                    minHeight: 4,
                    transition: 'height .3s ease',
                  }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {chartData.map((d, i) => (
                <div key={i} style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--text-muted)' }}>
                  {d.label}
                </div>
              ))}
            </div>
          </Card>

          {/* Recent transactions */}
          <Card>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Recent Transactions</span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)' }}>{transactions.length} total</span>
            </div>
            <div style={{ padding: '8px 0' }}>
              {transactions.length === 0 ? (
                <div style={{ padding: '20px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                  No transactions yet
                </div>
              ) : transactions.slice(0, 10).map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <StatusDot status={t.status} />
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.description || 'Payment'}
                  </span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: t.status === 'succeeded' ? '#6EE7A0' : 'var(--text-muted)' }}>
                    {formatCurrency(t.amount)}
                  </span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)' }}>
                    {new Date(t.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
