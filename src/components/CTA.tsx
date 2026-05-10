'use client'
import { useEffect, useRef, useState } from 'react'
import { AccentBtn } from './Buttons'

export function CTA({ onCTA }: { onCTA: () => void }) {
  const ref = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.unobserve(el) }
    }, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <section
      ref={ref}
      style={{
        padding: '140px clamp(24px,5vw,80px)',
        textAlign: 'center', background: 'var(--bg-primary)',
        borderTop: '1px solid var(--border-subtle)',
        opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(20px)',
        transition: 'all .8s ease',
      }}
    >
      <h2 style={{
        fontFamily: 'var(--font-display)', fontStyle: 'italic',
        fontSize: 'clamp(32px,5vw,56px)', fontWeight: 400,
        color: 'var(--text-primary)', letterSpacing: '-0.02em',
        lineHeight: 1.1, maxWidth: 600, margin: '0 auto 24px',
      }}>
        Ready to launch your co-founder?
      </h2>
      <p style={{
        fontFamily: 'var(--font-body)', fontSize: 17,
        color: 'var(--text-secondary)', lineHeight: 1.7,
        maxWidth: 420, margin: '0 auto 48px',
      }}>
        Join the companies growing with IncursYIA. Free to get started.
      </p>
      <AccentBtn large onClick={onCTA}>Start for free</AccentBtn>
    </section>
  )
}
