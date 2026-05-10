'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const COMPANY_ID = '00000000-0000-0000-0000-000000000001'

interface Task { id: string; title: string; tag: string; status: string; priority: string; created_at: string }
interface Agent { id: string; name: string; type: string; status: string; model: string; total_tasks: number }

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    idle: '#5A5A5A', busy: 'var(--accent)', error: '#F87171', completed: '#6EE7A0',
    in_progress: 'var(--accent)', todo: '#5A5A5A', failed: '#F87171', blocked: '#FCD34D',
  }
  return <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: colors[status] ?? '#5A5A5A', flexShrink: 0 }} />
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
      borderRadius: 12, ...style,
    }}>
      {children}
    </div>
  )
}

export default function DashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [stats, setStats] = useState<{ revenue_eur: number; companies: number; tasks_done: number } | null>(null)

  useEffect(() => {
    supabase.from('tasks').select('*').eq('company_id', COMPANY_ID).order('created_at', { ascending: false }).limit(6)
      .then(({ data }) => setTasks(data ?? []))
    supabase.from('agents').select('*').order('name')
      .then(({ data }) => setAgents(data ?? []))
    supabase.from('platform_stats').select('revenue_eur,companies,tasks_done').single()
      .then(({ data }) => setStats(data as typeof stats))

    const sub = supabase.channel('dash')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        supabase.from('tasks').select('*').eq('company_id', COMPANY_ID).order('created_at', { ascending: false }).limit(6)
          .then(({ data }) => setTasks(data ?? []))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agents' }, () => {
        supabase.from('agents').select('*').order('name').then(({ data }) => setAgents(data ?? []))
      })
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [])

  const activeTasks = tasks.filter(t => t.status === 'in_progress').length
  const pendingTasks = tasks.filter(t => t.status === 'todo').length
  const busyAgents = agents.filter(a => a.status === 'busy').length

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 28, color: 'var(--text-primary)', marginBottom: 4 }}>
          Good day, let&apos;s build.
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)' }}>
          Autonomous AI co-founder — monitoring your business.
        </p>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Active tasks', value: activeTasks, color: 'var(--accent)' },
          { label: 'Pending tasks', value: pendingTasks, color: '#FCD34D' },
          { label: 'Agents busy', value: busyAgents, color: '#93C5FD' },
          { label: 'Revenue (live)', value: stats ? `€${(stats.revenue_eur / 1000).toFixed(1)}k` : '—', color: '#6EE7A0' },
        ].map(k => (
          <Card key={k.label} style={{ padding: '20px 24px' }}>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.08em' }}>{k.label}</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 28, fontWeight: 700, color: k.color }}>{k.value}</div>
          </Card>
        ))}
      </div>

      {/* Tasks + Agents grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Recent Tasks */}
        <Card>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Recent Tasks</span>
            <Link href="/dashboard/tasks" style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}>View all →</Link>
          </div>
          <div style={{ padding: '8px 0' }}>
            {tasks.length === 0 ? (
              <div style={{ padding: '20px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                No tasks yet — start a conversation
              </div>
            ) : tasks.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                <StatusDot status={t.status} />
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)', background: 'rgba(255,255,255,.04)', padding: '2px 8px', borderRadius: 4 }}>{t.tag}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Agents */}
        <Card>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Agents</span>
            <Link href="/dashboard/agents" style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}>View all →</Link>
          </div>
          <div style={{ padding: '8px 0' }}>
            {agents.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                <StatusDot status={a.status} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{a.name}</div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)' }}>{a.model}</div>
                </div>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: a.status === 'busy' ? 'var(--accent)' : 'var(--text-muted)' }}>
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Quick action */}
      <div style={{ marginTop: 20 }}>
        <Link href="/dashboard/chat" style={{
          display: 'inline-flex', alignItems: 'center', gap: 10,
          padding: '14px 24px', background: 'var(--accent)', borderRadius: 10,
          color: '#0C0C0C', fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600,
          textDecoration: 'none', transition: 'background .2s',
        }}>
          ◎ Talk to your AI co-founder →
        </Link>
      </div>
    </div>
  )
}
