'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useCompany } from '@/lib/useCompany'
import Link from 'next/link'

interface Task { id: string; title: string; tag: string; status: string; priority: string; created_at: string; completed_at?: string }
interface Agent { id: string; name: string; type: string; status: string; model: string; total_tasks: number }
interface Stats { revenue: number; companies: number; tasks_done: number }
interface RevenueInfo { balance: number; has_stripe: boolean }
interface ActivityItem { id: string; type: 'task' | 'agent'; title: string; detail: string; color: string; time: string }

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    idle: '#5A5A5A', busy: 'var(--accent)', error: '#F87171', completed: '#6EE7A0',
    in_progress: 'var(--accent)', todo: '#5A5A5A', failed: '#F87171', blocked: '#FCD34D',
  }
  return <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: colors[status] ?? '#5A5A5A', flexShrink: 0 }} />
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, ...style }}>
      {children}
    </div>
  )
}

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function DashboardPage() {
  const company = useCompany()
  const [tasks, setTasks] = useState<Task[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [revenueInfo, setRevenueInfo] = useState<RevenueInfo | null>(null)
  const [activity, setActivity] = useState<ActivityItem[]>([])

  // Fetch real stats (for task count only)
  useEffect(() => {
    fetch('/api/stats').then(r => r.json()).then(setStats)
  }, [])

  // Fetch user's OWN revenue (not the global fake stats)
  useEffect(() => {
    fetch('/api/revenue').then(r => r.json()).then(data => {
      if (!data.error) setRevenueInfo({ balance: data.balance ?? 0, has_stripe: data.has_stripe ?? false })
    }).catch(() => {})
  }, [])

  // Fetch agents (global, not per-company)
  useEffect(() => {
    supabase.from('agents').select('*').order('name').then(({ data }) => setAgents(data ?? []))
    const sub = supabase.channel('dash_agents')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agents' }, () => {
        supabase.from('agents').select('*').order('name').then(({ data }) => setAgents(data ?? []))
      })
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [])

  // Build activity feed from recent tasks
  const buildActivity = useCallback((taskList: Task[]) => {
    const items: ActivityItem[] = taskList.map(t => {
      const colors: Record<string, string> = {
        completed: '#6EE7A0', in_progress: 'var(--accent)', todo: '#5A5A5A', failed: '#F87171', blocked: '#FCD34D',
      }
      const verbs: Record<string, string> = {
        completed: 'Completed', in_progress: 'Working on', todo: 'Created', failed: 'Failed', blocked: 'Blocked',
      }
      return {
        id: t.id,
        type: 'task',
        title: t.title,
        detail: `${verbs[t.status] ?? t.status} · ${t.tag}`,
        color: colors[t.status] ?? '#5A5A5A',
        time: t.completed_at ?? t.created_at,
      }
    })
    items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    setActivity(items.slice(0, 8))
  }, [])

  // Fetch tasks for this user's company only
  useEffect(() => {
    if (!company) return
    const load = () => {
      supabase.from('tasks').select('*').eq('company_id', company.companyId)
        .order('created_at', { ascending: false }).limit(10)
        .then(({ data }) => {
          const t = data ?? []
          setTasks(t)
          buildActivity(t)
        })
    }
    load()
    const sub = supabase.channel('dash_tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `company_id=eq.${company.companyId}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [company, buildActivity])

  const activeTasks = tasks.filter(t => t.status === 'in_progress').length
  const pendingTasks = tasks.filter(t => t.status === 'todo').length
  const busyAgents = agents.filter(a => a.status === 'busy').length

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1200 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 28, color: 'var(--text-primary)', marginBottom: 4 }}>
          Good day, let&apos;s build.
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)' }}>
          {company ? `${company.companyName} — autonomous AI co-founder` : 'Autonomous AI co-founder — monitoring your business.'}
        </p>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Active tasks', value: activeTasks, color: 'var(--accent)' },
          { label: 'Pending tasks', value: pendingTasks, color: '#FCD34D' },
          { label: 'Agents busy', value: busyAgents, color: '#93C5FD' },
          { label: 'Revenue', value: revenueInfo ? (revenueInfo.has_stripe ? `$${revenueInfo.balance > 0 ? (revenueInfo.balance >= 1000 ? (revenueInfo.balance / 1000).toFixed(1) + 'k' : revenueInfo.balance.toString()) : '0'}` : 'Connect Stripe') : '—', color: '#6EE7A0' },
        ].map(k => (
          <Card key={k.label} style={{ padding: '20px 24px' }}>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.08em' }}>{k.label}</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 28, fontWeight: 700, color: k.color }}>{k.value}</div>
          </Card>
        ))}
      </div>

      {/* Activity Feed + Agents row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Activity Feed (live) */}
        <Card>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6EE7A0', animation: 'pulse-dot 2s infinite' }} />
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Activity Feed</span>
            </div>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)' }}>Live</span>
          </div>
          <div style={{ padding: '8px 0', maxHeight: 280, overflowY: 'auto' }}>
            {activity.length === 0 ? (
              <div style={{ padding: '20px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                No activity yet — your AI is warming up
              </div>
            ) : activity.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: a.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)' }}>{a.detail}</div>
                </div>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{timeAgo(a.time)}</span>
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
            {agents.length === 0 ? (
              <div style={{ padding: '20px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                Agents initializing...
              </div>
            ) : agents.map(a => (
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

      {/* Recent Tasks */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Recent Tasks</span>
          <Link href="/dashboard/tasks" style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}>View all →</Link>
        </div>
        <div style={{ padding: '8px 0' }}>
          {tasks.length === 0 ? (
            <div style={{ padding: '20px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
              No tasks yet — start a conversation
            </div>
          ) : tasks.slice(0, 6).map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
              <StatusDot status={t.status} />
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)', background: 'rgba(255,255,255,.04)', padding: '2px 8px', borderRadius: 4 }}>{t.tag}</span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)' }}>{timeAgo(t.created_at)}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Quick actions row */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Link href="/dashboard/chat" style={{
          display: 'inline-flex', alignItems: 'center', gap: 10,
          padding: '14px 24px', background: 'var(--accent)', borderRadius: 10,
          color: '#0C0C0C', fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600,
          textDecoration: 'none', transition: 'background .2s',
        }}>
          ◎ Talk to your AI co-founder →
        </Link>
        <Link href="/dashboard/reports" style={{
          display: 'inline-flex', alignItems: 'center', gap: 10,
          padding: '14px 24px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 10,
          color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500,
          textDecoration: 'none', transition: 'all .2s',
        }}>
          ▤ View CEO Report
        </Link>
        <Link href="/dashboard/revenue" style={{
          display: 'inline-flex', alignItems: 'center', gap: 10,
          padding: '14px 24px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 10,
          color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500,
          textDecoration: 'none', transition: 'all .2s',
        }}>
          ◈ Revenue Dashboard
        </Link>
      </div>
    </div>
  )
}
