'use client'
import { useState, useEffect } from 'react'
import { Logo } from '@/components/Logo'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [plan, setPlan] = useState('free')

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).single()
      if (profile) setPlan(profile.plan ?? 'free')
      const { data: company } = await supabase
        .from('companies').select('name').eq('user_id', user.id).order('created_at').limit(1).single()
      if (company) setCompanyName(company.name)
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
        <button onClick={() => collapsed ? setCollapsed(false) : setCollapsed(true)} className="sidebar-collapse-btn" style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', fontSize: 16, padding: 4,
        }}>
          {collapsed ? '›' : '‹'}
        </button>
      </div>

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
        {!collapsed && companyName && (
          <div style={{ padding: '8px 10px', background: 'var(--accent-subtle)', borderRadius: 8, border: '1px solid var(--border-accent)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', marginBottom: 2, fontFamily: 'var(--font-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {companyName.toUpperCase()}
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
