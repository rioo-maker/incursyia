'use client'
import { useState, useEffect } from 'react'
import { Logo } from '@/components/Logo'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const NAV = [
  { href: '/dashboard',           icon: '◈', label: 'Overview' },
  { href: '/dashboard/chat',      icon: '◎', label: 'Chat' },
  { href: '/dashboard/tasks',     icon: '⊞', label: 'Tasks' },
  { href: '/dashboard/agents',    icon: '◉', label: 'Agents' },
  { href: '/dashboard/memory',    icon: '◫', label: 'Memory' },
  { href: '/dashboard/emails',    icon: '◻', label: 'Emails' },
  { href: '/dashboard/social',    icon: '◈', label: 'Social' },
  { href: '/dashboard/ads',       icon: '◆', label: 'Ads' },
  { href: '/dashboard/analytics', icon: '◑', label: 'Analytics' },
]

function SidebarLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  const pathname = usePathname()
  const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
  return (
    <Link href={href} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 14px', borderRadius: 8, textDecoration: 'none',
      color: active ? 'var(--text-primary)' : 'var(--text-muted)',
      background: active ? 'rgba(217,119,87,.08)' : 'transparent',
      fontSize: 13.5, fontWeight: active ? 600 : 400,
      fontFamily: 'var(--font-body)',
      transition: 'all .15s',
      borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
    }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-secondary)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text-muted)' }}
    >
      <span style={{ fontSize: 12, opacity: active ? 1 : 0.5 }}>{icon}</span>
      {label}
    </Link>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
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

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-deep)', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{
        width: collapsed ? 56 : 220,
        flexShrink: 0,
        background: 'var(--bg-primary)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex', flexDirection: 'column',
        transition: 'width .2s ease',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '18px 14px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {!collapsed && <Logo size={18} />}
          <button onClick={() => setCollapsed(c => !c)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 16, padding: 4,
          }}>
            {collapsed ? '›' : '‹'}
          </button>
        </div>

        <nav style={{ padding: '10px 8px', flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(n => (
            collapsed
              ? <Link key={n.href} href={n.href} title={n.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 0', color: 'var(--text-muted)', fontSize: 14, textDecoration: 'none' }}>{n.icon}</Link>
              : <SidebarLink key={n.href} {...n} />
          ))}
        </nav>

        <div style={{ padding: '14px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!collapsed && companyName && (
            <div style={{ padding: '8px 10px', background: 'var(--accent-subtle)', borderRadius: 8, border: '1px solid var(--border-accent)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', marginBottom: 2, fontFamily: 'var(--font-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {companyName.toUpperCase()}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', textTransform: 'capitalize' }}>
                {plan} · Autonomous: ON
              </div>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={handleLogout}
              style={{
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
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
    </div>
  )
}
