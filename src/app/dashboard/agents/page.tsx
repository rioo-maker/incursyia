'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Agent {
  id: string; name: string; type: string; status: string; model: string
  total_tasks: number; success_rate: number; last_active?: string; config?: { role?: string }
}

const TYPE_ICON: Record<string, string> = {
  orchestrator: '◈', engineering: '⟨⟩', browser: '◉', research: '◎',
  email: '◻', content: '✦', ads: '◆', data: '◑', support: '◈',
}

const STATUS_COLOR: Record<string, string> = {
  idle: '#5A5A5A', busy: 'var(--accent)', error: '#F87171', disabled: '#3A3A3A',
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([])

  useEffect(() => {
    const load = () => {
      supabase.from('agents').select('*').order('name').then(({ data }) => setAgents(data as Agent[] ?? []))
    }
    load()
    const sub = supabase.channel('agents_page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agents' }, load)
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [])

  return (
    <div style={{ padding: '32px 36px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, color: 'var(--text-primary)', marginBottom: 4 }}>Agents</h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)' }}>
          {agents.filter(a => a.status === 'busy').length} busy · {agents.filter(a => a.status === 'idle').length} idle
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
        {agents.map(agent => (
          <div key={agent.id} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
            borderRadius: 14, padding: 20,
            borderLeft: agent.status === 'busy' ? '3px solid var(--accent)' : '3px solid transparent',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8, background: 'var(--bg-surface)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, color: 'var(--accent)',
                }}>{TYPE_ICON[agent.type] ?? '◈'}</div>
                <div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{agent.name}</div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{agent.type}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_COLOR[agent.status] ?? '#5A5A5A' }}/>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: STATUS_COLOR[agent.status] ?? 'var(--text-muted)' }}>{agent.status}</span>
              </div>
            </div>

            <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 14 }}>
              {agent.config?.role ?? '—'}
            </p>

            <div style={{ display: 'flex', gap: 0, borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
              {[
                { label: 'Tasks', value: agent.total_tasks },
                { label: 'Success', value: `${agent.success_rate}%` },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{s.value}</div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
              <div style={{ flex: 2, paddingLeft: 12 }}>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Model</div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--accent)', background: 'var(--accent-subtle)', padding: '3px 8px', borderRadius: 5, display: 'inline-block' }}>{agent.model}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
