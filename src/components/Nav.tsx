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
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])

  // Close menu on resize to desktop
  useEffect(() => {
    const h = () => { if (window.innerWidth > 768) setMenuOpen(false) }
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  const links = [
    { label: 'Features', href: '#features' },
    { label: 'How it works', href: '#how-it-works' },
    { label: 'FAQ', href: '#faq' },
  ]

  return (
    <>
      <nav className="main-nav" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        height: 68, padding: '0 clamp(20px,5vw,72px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: scrolled || menuOpen ? 'rgba(12,12,12,.95)' : 'transparent',
        backdropFilter: scrolled || menuOpen ? 'blur(20px)' : 'none',
        WebkitBackdropFilter: scrolled || menuOpen ? 'blur(20px)' : 'none',
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
          <div className="nav-cta-desktop">
            <AccentBtn onClick={onCTA} style={{ padding: '10px 24px', fontSize: 14 }}>
              {isLoggedIn ? 'Dashboard' : 'Get started'}
            </AccentBtn>
          </div>
          {/* Mobile hamburger */}
          <button
            className="nav-hamburger"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menu"
            style={{
              display: 'none', background: 'none', border: 'none',
              cursor: 'pointer', padding: 8, color: 'var(--text-primary)',
              fontSize: 22, lineHeight: 1,
            }}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </nav>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="nav-mobile-menu" style={{
          position: 'fixed', top: 68, left: 0, right: 0, zIndex: 999,
          background: 'rgba(12,12,12,.97)', backdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--border-subtle)',
          padding: '24px clamp(20px,5vw,72px)',
          display: 'flex', flexDirection: 'column', gap: 20,
          animation: 'slideDown .25s ease',
        }}>
          {links.map(l => (
            <a key={l.href} href={l.href}
              onClick={() => setMenuOpen(false)}
              style={{
                color: 'var(--text-secondary)', textDecoration: 'none',
                fontSize: 16, fontWeight: 500, fontFamily: 'var(--font-body)',
                padding: '8px 0', borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              {l.label}
            </a>
          ))}
          <AccentBtn onClick={() => { setMenuOpen(false); onCTA() }} style={{ width: '100%', marginTop: 8 }}>
            {isLoggedIn ? 'Dashboard' : 'Get started'}
          </AccentBtn>
        </div>
      )}
    </>
  )
}
