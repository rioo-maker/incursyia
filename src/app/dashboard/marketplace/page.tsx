'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useCompany } from '@/lib/useCompany'

interface Skill {
  id: string
  name: string
  description: string
  category: string
  icon: string
  installs: number
  rating: number
}

interface InstalledSkill {
  id: string
  skill_id: string
  installed_at: string
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, ...style }}>
      {children}
    </div>
  )
}

const CATEGORIES = ['All', 'Content', 'Ads', 'Engineering', 'Research', 'Email', 'Data']

const CATEGORY_COLOR: Record<string, string> = {
  Content: '#F9A8D4', Ads: 'var(--accent)', Engineering: '#93C5FD',
  Research: '#C4B5FD', Email: '#6EE7A0', Data: '#67E8F9',
}

export default function MarketplacePage() {
  const company = useCompany()
  const [skills, setSkills] = useState<Skill[]>([])
  const [installedSkills, setInstalledSkills] = useState<InstalledSkill[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [installing, setInstalling] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Load skills from marketplace
  useEffect(() => {
    supabase.from('marketplace_skills').select('*').order('installs', { ascending: false })
      .then(({ data }) => {
        setSkills((data as Skill[]) ?? [])
        setLoading(false)
      })
  }, [])

  // Load installed skills
  useEffect(() => {
    if (!company) return
    const load = () => {
      supabase.from('installed_skills').select('*')
        .eq('company_id', company.companyId)
        .then(({ data }) => setInstalledSkills((data as InstalledSkill[]) ?? []))
    }
    load()
    const sub = supabase.channel('installed_skills')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'installed_skills', filter: `company_id=eq.${company.companyId}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [company])

  const isInstalled = (skillId: string) => installedSkills.some(is => is.skill_id === skillId)

  const installSkill = async (skillId: string) => {
    if (!company || installing) return
    setInstalling(skillId)
    await supabase.from('installed_skills').insert({
      company_id: company.companyId,
      skill_id: skillId,
    })
    // Refresh
    const { data } = await supabase.from('installed_skills').select('*').eq('company_id', company.companyId)
    setInstalledSkills((data as InstalledSkill[]) ?? [])
    setInstalling(null)
  }

  const uninstallSkill = async (skillId: string) => {
    if (!company) return
    await supabase.from('installed_skills').delete()
      .eq('company_id', company.companyId)
      .eq('skill_id', skillId)
    const { data } = await supabase.from('installed_skills').select('*').eq('company_id', company.companyId)
    setInstalledSkills((data as InstalledSkill[]) ?? [])
  }

  // Filter skills
  const filtered = skills.filter(s => {
    const matchesSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.description.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = category === 'All' || s.category === category
    return matchesSearch && matchesCategory
  })

  const installedList = skills.filter(s => isInstalled(s.id))
  const availableList = filtered.filter(s => !isInstalled(s.id))

  const renderStars = (rating: number) => {
    const full = Math.floor(rating)
    const half = rating - full >= 0.5
    let stars = ''
    for (let i = 0; i < full; i++) stars += '★'
    if (half) stars += '☆'
    return stars
  }

  if (loading) {
    return <div style={{ padding: 32, fontFamily: 'var(--font-body)', color: 'var(--text-muted)' }}>Loading...</div>
  }

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1200 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 28, color: 'var(--text-primary)', marginBottom: 4 }}>
          Marketplace
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)' }}>
          Extend your AI co-founder with skills and plugins
        </p>
      </div>

      {/* Search bar */}
      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Search skills..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', padding: '12px 16px',
            background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
            borderRadius: 10, color: 'var(--text-primary)',
            fontFamily: 'var(--font-body)', fontSize: 14, outline: 'none',
          }}
        />
      </div>

      {/* Category tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {CATEGORIES.map(c => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            style={{
              padding: '7px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-body)', fontSize: 12,
              background: category === c ? 'var(--accent-subtle)' : 'rgba(255,255,255,.04)',
              color: category === c ? 'var(--accent)' : 'var(--text-muted)',
              fontWeight: category === c ? 600 : 400,
            }}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Installed skills */}
      {installedList.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Installed ({installedList.length})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
            {installedList.map(skill => (
              <Card key={skill.id} style={{ padding: '18px 20px', borderLeft: '3px solid #6EE7A0' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ fontSize: 24, flexShrink: 0, lineHeight: 1 }}>{skill.icon || '◈'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                      {skill.name}
                    </div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {skill.description}
                    </div>
                    <button
                      onClick={() => uninstallSkill(skill.id)}
                      style={{
                        padding: '5px 14px', background: 'transparent',
                        border: '1px solid rgba(248,113,113,.3)', borderRadius: 6,
                        color: '#F87171', fontFamily: 'var(--font-body)', fontSize: 11, cursor: 'pointer',
                      }}
                    >
                      Uninstall
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Available skills */}
      {availableList.length === 0 && skills.length === 0 ? (
        <Card style={{ padding: '48px 32px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 40, marginBottom: 16, opacity: 0.3 }}>{'◈'}</div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 16, color: 'var(--text-secondary)', marginBottom: 8 }}>
            Marketplace coming soon
          </div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)' }}>
            Skills and plugins will appear here as they become available.
          </div>
        </Card>
      ) : availableList.length === 0 ? (
        <Card style={{ padding: '32px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)' }}>
            No skills match your search
          </div>
        </Card>
      ) : (
        <>
          {installedList.length > 0 && (
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>
              Available
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
            {availableList.map(skill => (
              <Card key={skill.id} style={{ padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ fontSize: 24, flexShrink: 0, lineHeight: 1 }}>{skill.icon || '◈'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {skill.name}
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-body)', fontSize: 10,
                        color: CATEGORY_COLOR[skill.category] ?? 'var(--text-muted)',
                        background: 'rgba(255,255,255,.04)', padding: '2px 8px', borderRadius: 4,
                      }}>
                        {skill.category}
                      </span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 12, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {skill.description}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: '#FCD34D' }}>
                          {renderStars(skill.rating)}
                        </span>
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)' }}>
                          {skill.installs.toLocaleString()} installs
                        </span>
                      </div>
                      <button
                        onClick={() => installSkill(skill.id)}
                        disabled={installing === skill.id}
                        style={{
                          padding: '5px 14px',
                          background: installing === skill.id ? 'rgba(217,119,87,.4)' : 'var(--accent)',
                          border: 'none', borderRadius: 6,
                          color: '#0C0C0C', fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        {installing === skill.id ? '...' : 'Install'}
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
