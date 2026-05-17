'use client'
import { useState, useEffect, useRef } from 'react'
import { Logo } from '@/components/Logo'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useCompanies } from '@/lib/useCompany'
import type { Company, Invitation } from '@/lib/useCompany'

const NAV_SECTIONS = [
  {
    label: 'Core',
    items: [
      { href: '/dashboard',           icon: '◈', label: 'Overview' },
      { href: '/dashboard/chat',      icon: '◎', label: 'Chat' },
      { href: '/dashboard/tasks',     icon: '⊞', label: 'Tasks' },
    ],
  },
  {
    label: 'Agents',
    items: [
      { href: '/dashboard/agents',      icon: '◉', label: 'Agents' },
      { href: '/dashboard/memory',      icon: '◫', label: 'Memory' },
      { href: '/dashboard/marketplace', icon: '⬡', label: 'Marketplace' },
    ],
  },
  {
    label: 'Grow',
    items: [
      { href: '/dashboard/revenue',   icon: '◈', label: 'Revenue' },
      { href: '/dashboard/ads',       icon: '◆', label: 'Ads & Video' },
      { href: '/dashboard/analytics', icon: '◑', label: 'Analytics' },
      { href: '/dashboard/reports',   icon: '▤', label: 'Reports' },
    ],
  },
  {
    label: 'Channels',
    items: [
      { href: '/dashboard/emails', icon: '◻', label: 'Emails' },
      { href: '/dashboard/social', icon: '◈', label: 'Social' },
    ],
  },
  {
    label: 'Settings',
    items: [
      { href: '/dashboard/connections', icon: '⟁', label: 'Connections' },
      { href: '/dashboard/settings',    icon: '⚙', label: 'Settings' },
    ],
  },
]

function SidebarLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  const pathname = usePathname()
  const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
  return (
    <Link href={href} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 14px', borderRadius: 8, textDecoration: 'none',
      color: active ? 'var(--text-primary)' : 'var(--text-muted)',
      background: active ? 'rgba(217,119,87,.08)' : 'transparent',
      fontSize: 13, fontWeight: active ? 600 : 400,
      fontFamily: 'var(--font-body)',
      transition: 'all .15s',
      borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
    }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-secondary)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text-muted)' }}
    >
      <span style={{ fontSize: 11, opacity: active ? 1 : 0.5, width: 16, textAlign: 'center' }}>{icon}</span>
      {label}
    </Link>
  )
}

/* ── Company Switcher Dropdown ── */
function CompanySwitcher({
  companies,
  currentId,
  switchCompany,
  collapsed,
}: {
  companies: Company[]
  currentId: string | null
  switchCompany: (id: string) => void
  collapsed: boolean
}) {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const currentCompany = companies.find(c => c.id === currentId)
  const canCreate = companies.filter(c => c.role === 'owner').length < 3

  const handleCreate = async () => {
    if (!newName.trim()) return
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Check owned count
    const { count } = await supabase
      .from('companies')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
    if ((count ?? 0) >= 3) {
      setError('Maximum 3 companies reached')
      return
    }

    const { data: company, error: insertErr } = await supabase
      .from('companies')
      .insert({ user_id: user.id, name: newName.trim(), stage: 'idea' })
      .select()
      .single()

    if (insertErr) {
      setError(insertErr.message)
      return
    }

    // Create initial conversation
    if (company) {
      await supabase.from('conversations').insert({
        company_id: company.id,
        title: 'Main chat',
      })
      switchCompany(company.id)
    }
  }

  if (collapsed) return null

  return (
    <div ref={ref} style={{ position: 'relative', padding: '8px 10px' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 10px', background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)',
          borderRadius: 8, cursor: 'pointer', color: 'var(--text-primary)',
          fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600,
          transition: 'border-color .15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentCompany?.name ?? 'Select company'}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6, flexShrink: 0 }}>
          {open ? '▴' : '▾'}
        </span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 10, right: 10, zIndex: 100,
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: 8, marginTop: 4, overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0,0,0,.4)',
        }}>
          {companies.map(c => (
            <button
              key={c.id}
              onClick={() => {
                if (c.id !== currentId) switchCompany(c.id)
                setOpen(false)
              }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 12px', background: 'transparent', border: 'none',
                cursor: 'pointer', color: c.id === currentId ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontFamily: 'var(--font-body)', fontSize: 12, textAlign: 'left',
                borderBottom: '1px solid var(--border-subtle)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ width: 14, fontSize: 10, color: 'var(--accent)', flexShrink: 0 }}>
                {c.id === currentId ? '✓' : ''}
              </span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.name}
              </span>
              <span style={{
                fontSize: 10, color: 'var(--text-muted)', background: 'rgba(255,255,255,.04)',
                padding: '2px 6px', borderRadius: 4, flexShrink: 0,
              }}>
                {c.role}
              </span>
            </button>
          ))}

          {/* Separator */}
          <div style={{ height: 1, background: 'var(--border-subtle)' }} />

          {!creating ? (
            <button
              onClick={() => canCreate ? setCreating(true) : setError('Maximum 3 companies reached')}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 12px', background: 'transparent', border: 'none',
                cursor: canCreate ? 'pointer' : 'not-allowed',
                color: canCreate ? 'var(--accent)' : 'var(--text-muted)',
                fontFamily: 'var(--font-body)', fontSize: 12, textAlign: 'left',
                opacity: canCreate ? 1 : 0.5,
              }}
              onMouseEnter={e => canCreate && (e.currentTarget.style.background = 'rgba(255,255,255,.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ width: 14, fontSize: 12, flexShrink: 0 }}>+</span>
              <span>New Company</span>
              {!canCreate && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>(max 3)</span>}
            </button>
          ) : (
            <div style={{ padding: '8px 12px' }}>
              <input
                type="text"
                placeholder="Company name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                autoFocus
                style={{
                  width: '100%', padding: '6px 8px', background: 'var(--bg-deep)',
                  border: '1px solid var(--border-subtle)', borderRadius: 6,
                  color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: 12,
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button
                  onClick={handleCreate}
                  style={{
                    flex: 1, padding: '5px 8px', background: 'var(--accent)',
                    border: 'none', borderRadius: 5, color: '#0C0C0C',
                    fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Create
                </button>
                <button
                  onClick={() => { setCreating(false); setNewName(''); setError('') }}
                  style={{
                    padding: '5px 8px', background: 'transparent',
                    border: '1px solid var(--border-subtle)', borderRadius: 5,
                    color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: 11, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {error && (
            <div style={{
              padding: '6px 12px', fontFamily: 'var(--font-body)', fontSize: 11,
              color: '#F87171', background: 'rgba(248,113,113,.08)',
            }}>
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Notification Bell + Invitations Panel ── */
function NotificationBell({
  invitations,
  collapsed,
}: {
  invitations: Invitation[]
  collapsed: boolean
}) {
  const [open, setOpen] = useState(false)
  const [processing, setProcessing] = useState<string | null>(null)
  const [localInvitations, setLocalInvitations] = useState(invitations)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLocalInvitations(invitations)
  }, [invitations])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleAction = async (invitationId: string, action: 'accept' | 'decline') => {
    setProcessing(invitationId)
    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, invitation_id: invitationId }),
      })
      if (res.ok) {
        setLocalInvitations(prev => prev.filter(i => i.id !== invitationId))
        if (action === 'accept') {
          // Reload to show the new company in the switcher
          window.location.reload()
        }
      }
    } catch { /* ignore */ }
    setProcessing(null)
  }

  const hasInvitations = localInvitations.length > 0

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', fontSize: 15, padding: 4,
          position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: collapsed ? 32 : 28, height: 28,
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        title="Notifications"
      >
        {/* Bell icon (SVG) */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {hasInvitations && (
          <span style={{
            position: 'absolute', top: 2, right: collapsed ? 6 : 0,
            width: 8, height: 8, borderRadius: '50%',
            background: '#F87171',
          }} />
        )}
      </button>

      {open && !collapsed && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0, zIndex: 100,
          width: 260, marginBottom: 6,
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: 10, overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0,0,0,.4)',
        }}>
          <div style={{
            padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)',
            fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600,
            color: 'var(--text-secondary)',
          }}>
            Notifications
          </div>

          {localInvitations.length === 0 ? (
            <div style={{
              padding: '20px 14px', fontFamily: 'var(--font-body)', fontSize: 12,
              color: 'var(--text-muted)', textAlign: 'center',
            }}>
              No pending invitations
            </div>
          ) : (
            localInvitations.map(inv => (
              <div key={inv.id} style={{
                padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)',
              }}>
                <div style={{
                  fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-primary)',
                  marginBottom: 4,
                }}>
                  Invited to join <strong style={{ color: 'var(--accent)' }}>{inv.company_name}</strong>
                </div>
                <div style={{
                  fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)',
                  marginBottom: 8, textTransform: 'capitalize',
                }}>
                  Role: {inv.role}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => handleAction(inv.id, 'accept')}
                    disabled={processing === inv.id}
                    style={{
                      flex: 1, padding: '5px 10px', background: 'var(--accent)',
                      border: 'none', borderRadius: 5, color: '#0C0C0C',
                      fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {processing === inv.id ? '...' : 'Accept'}
                  </button>
                  <button
                    onClick={() => handleAction(inv.id, 'decline')}
                    disabled={processing === inv.id}
                    style={{
                      flex: 1, padding: '5px 10px', background: 'transparent',
                      border: '1px solid var(--border-subtle)', borderRadius: 5,
                      color: 'var(--text-muted)', fontFamily: 'var(--font-body)',
                      fontSize: 11, cursor: 'pointer',
                    }}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [plan, setPlan] = useState('free')

  const { companies, current, switchCompany, invitations } = useCompanies()

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).single()
      if (profile) setPlan(profile.plan ?? 'free')
    })()
  }, [])

  // Close mobile menu on resize
  useEffect(() => {
    const h = () => { if (window.innerWidth > 768) setMobileOpen(false) }
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const sidebarContent = (
    <>
      <div style={{ padding: '16px 14px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {!collapsed && <Logo size={18} />}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <NotificationBell invitations={invitations} collapsed={collapsed} />
          <button onClick={() => collapsed ? setCollapsed(false) : setCollapsed(true)} className="sidebar-collapse-btn" style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 16, padding: 4,
          }}>
            {collapsed ? '›' : '‹'}
          </button>
        </div>
      </div>

      {/* Company Switcher */}
      {companies.length > 0 && (
        <CompanySwitcher
          companies={companies}
          currentId={current?.companyId ?? null}
          switchCompany={switchCompany}
          collapsed={collapsed}
        />
      )}

      <nav style={{ padding: '6px 8px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0 }}>
        {NAV_SECTIONS.map((section, si) => (
          <div key={section.label}>
            {!collapsed && (
              <div style={{
                fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 600,
                color: 'var(--text-muted)', letterSpacing: '.1em', textTransform: 'uppercase',
                padding: si === 0 ? '8px 14px 4px' : '14px 14px 4px',
                opacity: 0.6,
              }}>
                {section.label}
              </div>
            )}
            {collapsed && si > 0 && (
              <div style={{ height: 1, background: 'var(--border-subtle)', margin: '6px 8px' }} />
            )}
            {section.items.map(n => (
              collapsed
                ? <Link key={n.href} href={n.href} title={n.label} onClick={() => setMobileOpen(false)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '9px 0', color: 'var(--text-muted)', fontSize: 12, textDecoration: 'none',
                  }}>{n.icon}</Link>
                : <div key={n.href} onClick={() => setMobileOpen(false)}>
                    <SidebarLink {...n} />
                  </div>
            ))}
          </div>
        ))}
      </nav>

      <div style={{ padding: '12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {!collapsed && current && (
          <div style={{ padding: '8px 10px', background: 'var(--accent-subtle)', borderRadius: 8, border: '1px solid var(--border-accent)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', marginBottom: 2, fontFamily: 'var(--font-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {current.companyName.toUpperCase()}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', textTransform: 'capitalize' }}>
              {plan} plan
            </div>
          </div>
        )}
        {!collapsed && (
          <button onClick={handleLogout} style={{
            background: 'none', border: '1px solid var(--border-subtle)',
            borderRadius: 6, color: 'var(--text-muted)', padding: '6px 10px',
            fontFamily: 'var(--font-body)', fontSize: 12, cursor: 'pointer',
            textAlign: 'left', transition: 'all .15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--border-accent)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-subtle)' }}
          >
            Sign out
          </button>
        )}
      </div>
    </>
  )

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-deep)', overflow: 'hidden' }}>
      {/* Mobile hamburger */}
      <button
        className="dash-mobile-toggle"
        onClick={() => setMobileOpen(!mobileOpen)}
        style={{
          display: 'none', position: 'fixed', top: 14, left: 14, zIndex: 1001,
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: 8, padding: '8px 10px', color: 'var(--text-primary)',
          fontSize: 18, cursor: 'pointer', lineHeight: 1,
        }}
      >
        {mobileOpen ? '✕' : '☰'}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 999 }}
        />
      )}

      {/* Sidebar */}
      <aside className="dash-sidebar" style={{
        width: collapsed ? 52 : 210,
        flexShrink: 0,
        background: 'var(--bg-primary)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex', flexDirection: 'column',
        transition: 'width .2s ease, transform .2s ease',
        overflow: 'hidden',
        zIndex: 1000,
      }}>
        {sidebarContent}
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>

      <style>{`
        @media(max-width:768px){
          .dash-mobile-toggle{display:flex!important}
          .dash-sidebar{position:fixed!important;top:0;left:0;bottom:0;width:240px!important;transform:${mobileOpen ? 'translateX(0)' : 'translateX(-100%)'}}
          .sidebar-collapse-btn{display:none!important}
          main{margin-left:0!important}
        }
      `}</style>
    </div>
  )
}
