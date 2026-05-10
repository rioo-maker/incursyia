'use client'
import { useEffect, useRef, useState } from 'react'
import { Reveal } from './Reveal'

function useInView() {
  const ref = useRef<HTMLDivElement>(null)
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
  return [ref, visible] as const
}

const AGENTS = [
  { n: '01', title: 'Software Development', desc: 'Writes, tests and deploys your code automatically — end to end.' },
  { n: '02', title: 'Web Automation', desc: 'Navigates, scrapes, and automates any task across the web.' },
  { n: '03', title: 'Research & Intelligence', desc: 'Analyzes markets, competitors, and trends in real time.' },
  { n: '04', title: 'Email Management', desc: 'Drafts, sends, and manages your email campaigns intelligently.' },
  { n: '05', title: 'Content Generation', desc: 'Creates optimized content for every channel and audience.' },
  { n: '06', title: 'Ad Campaigns', desc: 'Launches and optimizes your ad campaigns across all platforms.' },
  { n: '07', title: 'Data Analysis', desc: 'Turns raw data into actionable insights and dashboards.' },
  { n: '08', title: 'Customer Support', desc: 'Responds to your customers 24/7 with consistent quality.' },
]

function FeatureRow({ agent, delay }: { agent: typeof AGENTS[0]; delay: number }) {
  const [ref, visible] = useInView()
  const [hovered, setHovered] = useState(false)

  return (
    <div
      ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid', gridTemplateColumns: '48px 1fr',
        gap: 20, padding: '28px 0',
        borderBottom: '1px solid var(--border-subtle)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : 'translateY(16px)',
        transition: `all .6s cubic-bezier(.16,1,.3,1) ${delay}s`,
        cursor: 'default',
      }}
    >
      <span style={{
        fontFamily: 'var(--font-display)', fontStyle: 'italic',
        fontSize: 28, color: hovered ? 'var(--accent)' : 'var(--text-muted)',
        transition: 'color .3s', lineHeight: 1,
      }}>{agent.n}</span>
      <div>
        <h3 style={{
          fontFamily: 'var(--font-body)', fontSize: 17, fontWeight: 600,
          color: hovered ? 'var(--text-primary)' : 'var(--text-secondary)',
          transition: 'color .3s', marginBottom: 6,
        }}>{agent.title}</h3>
        <p style={{
          fontFamily: 'var(--font-body)', fontSize: 14.5,
          color: 'var(--text-muted)', lineHeight: 1.6,
        }}>{agent.desc}</p>
      </div>
    </div>
  )
}

function SectionHeading({ label, title, subtitle }: { label: string; title: string; subtitle?: string }) {
  const [ref, visible] = useInView()
  return (
    <div ref={ref} style={{
      textAlign: 'center', maxWidth: 680, margin: '0 auto', padding: '0 24px',
      opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(24px)',
      transition: 'all .7s cubic-bezier(.16,1,.3,1)',
    }}>
      <span style={{
        display: 'inline-block', fontFamily: 'var(--font-body)',
        fontSize: 12, fontWeight: 600, color: 'var(--accent)',
        letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 20,
      }}>{label}</span>
      <h2 style={{
        fontFamily: 'var(--font-display)', fontStyle: 'italic',
        fontSize: 'clamp(32px,4.5vw,52px)', fontWeight: 400,
        color: 'var(--text-primary)', letterSpacing: '-0.02em',
        lineHeight: 1.15, marginBottom: subtitle ? 18 : 0,
      }}>{title}</h2>
      {subtitle && <p style={{ fontFamily: 'var(--font-body)', fontSize: 'clamp(15px,1.6vw,17px)', color: 'var(--text-secondary)', lineHeight: 1.75 }}>{subtitle}</p>}
    </div>
  )
}

export { SectionHeading }

export function Features() {
  return (
    <section id="features" style={{ padding: '120px clamp(24px,5vw,80px)', background: 'var(--bg-deep)' }}>
      <SectionHeading
        label="Features"
        title="One intelligence, eight specializations."
        subtitle="You see one entity. Behind the scenes, specialized agents collaborate to get everything done."
      />
      <div style={{ maxWidth: 640, margin: '60px auto 0', borderTop: '1px solid var(--border-subtle)' }}>
        {AGENTS.map((a, i) => <FeatureRow key={a.n} agent={a} delay={i * 0.05} />)}
      </div>
    </section>
  )
}
