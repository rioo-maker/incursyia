'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const COMPANY_ID = '00000000-0000-0000-0000-000000000001'

interface Task {
  id: string; title: string; tag: string; status: string; priority: string;
  estimated_hours: number; model: string; created_at: string; description?: string; error?: string
}

const TAG_COLOR: Record<string, string> = {
  engineering: '#93C5FD', browser: '#FCD34D', research: '#C4B5FD',
  email: '#6EE7A0', content: '#F9A8D4', ads: 'var(--accent)',
  data: '#67E8F9', support: '#A3E635', general: 'var(--text-muted)',
}

const STATUS_COLOR: Record<string, string> = {
  todo: '#5A5A5A', in_progress: 'var(--accent)', blocked: '#FCD34D',
  completed: '#6EE7A0', failed: '#F87171',
}

const STATUSES = ['todo', 'in_progress', 'blocked', 'completed', 'failed']

function TaskRow({ task, onRun, onDelete }: { task: Task; onRun: (id: string) => void; onDelete: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <tr
        onClick={() => setOpen(o => !o)}
        style={{ cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.02)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <td style={{ padding: '12px 16px' }}>
          <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: STATUS_COLOR[task.status] ?? '#5A5A5A', marginRight: 10 }}/>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--text-primary)' }}>{task.title}</span>
        </td>
        <td style={{ padding: '12px 8px' }}>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: TAG_COLOR[task.tag] ?? 'var(--text-muted)', background: 'rgba(255,255,255,.05)', padding: '3px 8px', borderRadius: 5 }}>{task.tag}</span>
        </td>
        <td style={{ padding: '12px 8px', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)' }}>{task.status}</td>
        <td style={{ padding: '12px 8px', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)' }}>{task.priority}</td>
        <td style={{ padding: '12px 8px', fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.model}</td>
        <td style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
          {task.status === 'todo' && (
            <button onClick={e => { e.stopPropagation(); onRun(task.id) }} style={{
              padding: '4px 12px', background: 'var(--accent)', border: 'none', borderRadius: 6,
              color: '#0C0C0C', fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}>Run</button>
          )}
          <button onClick={e => { e.stopPropagation(); onDelete(task.id) }} style={{
            padding: '4px 10px', background: 'transparent', border: '1px solid var(--border-subtle)',
            borderRadius: 6, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: 11, cursor: 'pointer',
          }}>✕</button>
        </td>
      </tr>
      {open && (
        <tr style={{ background: 'var(--bg-primary)' }}>
          <td colSpan={6} style={{ padding: '12px 24px 16px' }}>
            {task.description && <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>{task.description}</p>}
            {task.error && <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#F87171' }}>Error: {task.error}</p>}
          </td>
        </tr>
      )}
    </>
  )
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [filter, setFilter] = useState('all')
  const [creating, setCreating] = useState(false)
  const [newTask, setNewTask] = useState({ title: '', tag: 'general', priority: 'medium', description: '' })

  const load = () => {
    supabase.from('tasks').select('*').eq('company_id', COMPANY_ID).order('created_at', { ascending: false })
      .then(({ data }) => setTasks(data as Task[] ?? []))
  }

  useEffect(() => {
    load()
    const sub = supabase.channel('tasks_page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, load)
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [])

  const runTask = async (id: string) => {
    await fetch('/api/tasks/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId: id }) })
  }

  const deleteTask = async (id: string) => {
    await fetch('/api/tasks', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    load()
  }

  const createTask = async () => {
    await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newTask) })
    setCreating(false)
    setNewTask({ title: '', tag: 'general', priority: 'medium', description: '' })
    load()
  }

  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.status === filter)

  const inputStyle: React.CSSProperties = {
    padding: '10px 14px', background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)',
    borderRadius: 8, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: 13, outline: 'none',
  }

  return (
    <div style={{ padding: '32px 36px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, color: 'var(--text-primary)', marginBottom: 2 }}>Tasks</h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)' }}>{tasks.length} total · {tasks.filter(t => t.status === 'in_progress').length} running</p>
        </div>
        <button onClick={() => setCreating(true)} style={{
          padding: '10px 20px', background: 'var(--accent)', border: 'none', borderRadius: 8,
          color: '#0C0C0C', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>+ New task</button>
      </div>

      {/* Create form */}
      {creating && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, marginBottom: 12 }}>
            <input placeholder="Task title" value={newTask.title} onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))} style={{ ...inputStyle, width: '100%' }} />
            <select value={newTask.tag} onChange={e => setNewTask(p => ({ ...p, tag: e.target.value }))} style={inputStyle}>
              {['engineering','browser','research','email','content','ads','data','support','general'].map(t => <option key={t}>{t}</option>)}
            </select>
            <select value={newTask.priority} onChange={e => setNewTask(p => ({ ...p, priority: e.target.value }))} style={inputStyle}>
              {['critical','high','medium','low'].map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <textarea placeholder="Description (optional)" value={newTask.description} onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))} style={{ ...inputStyle, width: '100%', resize: 'vertical', minHeight: 70 }} />
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button onClick={createTask} style={{ padding: '8px 20px', background: 'var(--accent)', border: 'none', borderRadius: 7, color: '#0C0C0C', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Create</button>
            <button onClick={() => setCreating(false)} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 7, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['all', ...STATUSES].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{
            padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-body)', fontSize: 12,
            background: filter === s ? 'var(--accent-subtle)' : 'rgba(255,255,255,.04)',
            color: filter === s ? 'var(--accent)' : 'var(--text-muted)',
            fontWeight: filter === s ? 600 : 400,
          }}>{s}</button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              {['Title', 'Tag', 'Status', 'Priority', 'Model', 'Actions'].map(h => (
                <th key={h} style={{ padding: '10px 16px', fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textAlign: 'left', letterSpacing: '.06em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)' }}>No tasks yet</td></tr>
            ) : filtered.map(t => <TaskRow key={t.id} task={t} onRun={runTask} onDelete={deleteTask} />)}
          </tbody>
        </table>
      </div>
    </div>
  )
}
