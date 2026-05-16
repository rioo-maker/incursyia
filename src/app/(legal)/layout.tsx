import Link from 'next/link'

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-deep)',
      padding: '60px clamp(16px, 5vw, 40px)',
    }}>
      <div style={{
        maxWidth: 800,
        margin: '0 auto',
      }}>
        <Link href="/" style={{
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          color: 'var(--accent)',
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 32,
          transition: 'opacity .2s',
        }}>
          &larr; Back to IncursYIA
        </Link>
        {children}
      </div>
    </div>
  )
}
