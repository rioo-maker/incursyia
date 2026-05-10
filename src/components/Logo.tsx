'use client'

interface LogoProps {
  size?: number
  showText?: boolean
}

export function Logo({ size = 26, showText = true }: LogoProps) {
  const ts = size * 0.78
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: size * 0.4, flexShrink: 0 }}>
      <svg width={size} height={size * 1.15} viewBox="0 0 24 28" fill="none">
        <path d="M2 2 L12 16 L12 26" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M22 2 L12 16" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      {showText && (
        <span style={{
          fontFamily: 'var(--font-body), sans-serif',
          fontSize: ts,
          fontWeight: 600,
          color: 'var(--text-primary)',
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}>
          incurs<span style={{ color: 'var(--accent)' }}>yia</span>
        </span>
      )}
    </div>
  )
}
