'use client'
import { Logo } from './Logo'

const cols = [
  { title: 'Product', links: [
    { label: 'Features', href: '#' },
    { label: 'How it works', href: '#' },
    { label: 'Changelog', href: '#' },
  ]},
  { title: 'Company', links: [
    { label: 'About', href: '#' },
    { label: 'Blog', href: '#' },
    { label: 'Careers', href: '#' },
  ]},
  { title: 'Legal', links: [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Legal Mentions', href: '/legal' },
  ]},
]

export function Footer() {
  return (
    <footer style={{
      padding: '60px clamp(24px,5vw,80px) 36px',
      borderTop: '1px solid var(--border-subtle)',
      background: 'var(--bg-deep)',
    }}>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '40px 64px',
        maxWidth: 1000, margin: '0 auto', justifyContent: 'space-between',
      }}>
        <div style={{ flex: '1 1 240px' }}>
          <Logo size={20} />
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: 13.5,
            color: 'var(--text-muted)', marginTop: 16, lineHeight: 1.7, maxWidth: 260,
          }}>
            Your autonomous AI co-founder. Plans, builds, and moves your business forward.
          </p>
        </div>
        {cols.map(col => (
          <div key={col.title}>
            <h4 style={{
              fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600,
              color: 'var(--text-secondary)', letterSpacing: '.08em',
              textTransform: 'uppercase', marginBottom: 18,
            }}>{col.title}</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {col.links.map(l => (
                <a key={l.label} href={l.href} style={{
                  fontFamily: 'var(--font-body)', fontSize: 14,
                  color: 'var(--text-muted)', textDecoration: 'none', transition: 'color .2s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                >{l.label}</a>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{
        marginTop: 52, paddingTop: 24,
        borderTop: '1px solid var(--border-subtle)',
        maxWidth: 1000, margin: '52px auto 0',
        display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
      }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)' }}>© 2026 IncursYIA</span>
        <div style={{ display: 'flex', gap: 20 }}>
          {['Twitter', 'LinkedIn'].map(s => (
            <a key={s} href="#" style={{
              fontFamily: 'var(--font-body)', fontSize: 13,
              color: 'var(--text-muted)', textDecoration: 'none', transition: 'color .2s',
            }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >{s}</a>
          ))}
        </div>
      </div>
    </footer>
  )
}
