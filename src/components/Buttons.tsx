'use client'
import { ButtonHTMLAttributes, CSSProperties } from 'react'

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  large?: boolean
  style?: CSSProperties
}

export function AccentBtn({ children, large, style: sx, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      className="accent-btn"
      style={{
        padding: large ? '18px 44px' : '14px 32px',
        fontSize: large ? 16 : 15,
        fontWeight: 600,
        fontFamily: 'var(--font-body), sans-serif',
        color: '#0C0C0C',
        background: 'var(--accent)',
        border: 'none',
        borderRadius: 10,
        cursor: 'pointer',
        transition: 'all .25s ease',
        boxShadow: '0 2px 12px rgba(217,119,87,.12)',
        ...sx,
      }}
      onMouseEnter={e => {
        const el = e.currentTarget
        el.style.background = 'var(--accent-light)'
        el.style.transform = 'translateY(-1px)'
        el.style.boxShadow = '0 8px 28px rgba(217,119,87,.25)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget
        el.style.background = 'var(--accent)'
        el.style.transform = 'none'
        el.style.boxShadow = '0 2px 12px rgba(217,119,87,.12)'
      }}
    >
      {children}
    </button>
  )
}

export function GhostBtn({ children, large, style: sx, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      style={{
        padding: large ? '18px 44px' : '14px 32px',
        fontSize: large ? 16 : 15,
        fontWeight: 500,
        fontFamily: 'var(--font-body), sans-serif',
        color: 'var(--text-secondary)',
        background: 'transparent',
        border: '1px solid var(--border-subtle)',
        borderRadius: 10,
        cursor: 'pointer',
        transition: 'all .25s ease',
        ...sx,
      }}
      onMouseEnter={e => {
        const el = e.currentTarget
        el.style.color = 'var(--text-primary)'
        el.style.borderColor = 'rgba(255,255,255,.15)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget
        el.style.color = 'var(--text-secondary)'
        el.style.borderColor = 'var(--border-subtle)'
      }}
    >
      {children}
    </button>
  )
}
