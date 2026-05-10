'use client'
import { useEffect, useState } from 'react'
import { Logo } from './Logo'
import { AccentBtn } from './Buttons'

interface NavProps {
  onCTA: () => void
  isLoggedIn?: boolean
}

export function Nav({ onCTA, isLoggedIn = false }: NavProps) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])

  const links = [
    { label: 'Features', href: '#features' },
    { label: 'How it works', href: '#how-it-works' },
    { label: 'FAQ', href: '#faq' },
  ]

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
      height: 68, padding: '0 clamp(24px,5vw,72px)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: scrolled ? 'rgba(12,12,12,.92)' : 'transparent',
      backdropFilter: scrolled ? 'blur(20px)' : 'none',
      WebkitBackdropFilter: scrolled ? 'blur(20px)' : 'none',
      borderBottom: scrolled ? '1px solid var(--border-subtle)' : '1px solid transparent',
      transition: 'all .3s ease',
    }}>
      <Logo size={22} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
        <div style={{ display: 'flex', gap: 32 }} className="nav-links">
          {links.map(l => (
            <a key={l.href} href={l.href} style={{
              color: 'var(--text-muted)',
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 500,
              fontFamily: 'var(--font-body), sans-serif',
              transition: 'color .2s',
            }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              {l.label}
            </a>
          ))}
        </div>
        <AccentBtn onClick={onCTA} style={{ padding: '10px 24px', fontSize: 14 }}>
          {isLoggedIn ? 'Dashboard' : 'Get started'}
        </AccentBtn>
      </div>

      <style>{`@media(max-width:768px){.nav-links{display:none!important}}`}</style>
    </nav>
  )
}
