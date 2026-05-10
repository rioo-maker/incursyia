'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const COMPANY_ID = '00000000-0000-0000-0000-000000000001'

interface Memory { id: string; type: string; content: string; importance: number; tags: string[]; created_at: string }

const TYPE_COLOR: Record<string, string> = {
  fact: '#93C5FD', decision: 'var(--accent)', preference: '#FCD34D',
  learning: '#6EE7A0', context: '#C4B5FD',
}

export default function MemoryPage() {
  const [memories, setMemories] = useState<Memory[]>([])
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [newMem, setNewMem] = useState({ type: 'fact', content: '', importance: 5, tags: '' })
  const [searched, setSearched] = useState(false)

  const search = async () => {
    if (!query.trim()) {
      const { data } = await supabase.from('memories').select('*').eq('company_id', COMPANY_ID).order('created_at', { ascending: false }).limit(20)
      setMemories(data as Memory[] ?? [])
      setSearched(true)
      return
    }
    const { data } = await supabase.from('memories').select('*').eq('company_id', COMPANY_ID)
      .ilike('content', `%${query}%`).limit(20)
    setMemories(data as Memory[] ?? [])
    setSearched(true)
  }

  const addMemory = async () => {
    await supabase.from('memories').insert({
      company_id: COMPANY_ID,
      type: newMem.type,
      content: newMem.content,
      importance: newMem.importance,
      tags: newMem.tags.split(',').map(t => t.trim()).filter(Boolean),
    })
    setAdding(false)
    setNewMem({ type: 'fact', content: '', importance: 5, tags: '' })
    search()
  }

  const inputStyle: React.CSSProperties = {
    padding: '10px 14px', background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)',
    borderRadius: 8, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: 13, outline: 'none',
  }

  return (
    <div style={{ padding: '32px 36px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, color: 'var(--text-primary)', marginBottom: 4 }}>Memory</h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)' }}>Persistent knowledge about your business</p>
        </div>
        <button onClick={() => setAdding(true)} style={{ padding: '10px 20px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#0C0C0C', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Add memory</button>
      </div>

      {/* Search */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <input
          value={query} onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="Search memories..." style={{ ...inputStyle, flex: 1 }}
        />
        <button onClick={search} style={{ padding: '10px 20px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', fontSize: 13, cursor: 'pointer' }}>Search</button>
      </div>

      {/* Add form */}
      {adding && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto auto 1fr', gap: 12, marginBottom: 12 }}>
            <select value={newMem.type} onChange={e => setNewMem(p => ({ ...p, type: e.target.value }))} style={inputStyle}>
              {['fact','decision','preference','learning','context'].map(t => <option key={t}>{t}</option>)}
            </select>
            <input type="number" min={1} max={10} value={newMem.importance} onChange={e => setNewMem(p => ({ ...p, importance: +e.target.value }))} placeholder="Importance 1-10" style={{ ...inputStyle, width: 80 }} />
            <input placeholder="Tags (comma separated)" value={newMem.tags} onChange={e => setNewMem(p => ({ ...p, tags: e.target.value }))} style={{ ...inputStyle }} />
          </div>
          <textarea placeholder="Memory content..." value={newMem.content} onChange={e => setNewMem(p => ({ ...p, content: e.target.value }))} style={{ ...inputStyle, width: '100%', resize: 'vertical', minHeight: 80 }} />
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button onClick={addMemory} style={{ padding: '8px 20px', background: 'var(--accent)', border: 'none', borderRadius: 7, color: '#0C0C0C', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Save</button>
            <button onClick={() => setAdding(false)} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 7, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {!searched && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 40, color: 'rgba(217,119,87,.15)', marginBottom: 16 }}>◫</div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)' }}>Search to explore memories, or click Add memory to store a new one</p>
          <button onClick={search} style={{ marginTop: 16, padding: '10px 20px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', fontSize: 13, cursor: 'pointer' }}>Load all memories</button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {memories.map(m => (
          <div key={m.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: TYPE_COLOR[m.type] ?? 'var(--text-muted)', background: 'rgba(255,255,255,.05)', padding: '2px 8px', borderRadius: 4, fontFamily: 'var(--font-body)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{m.type}</span>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--font-body)' }}>imp: {m.importance}/10</span>
              {m.tags.map(t => <span key={t} style={{ fontSize: 10, color: 'var(--text-muted)', background: 'rgba(255,255,255,.04)', padding: '2px 6px', borderRadius: 4, fontFamily: 'var(--font-body)' }}>{t}</span>)}
            </div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{m.content}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
