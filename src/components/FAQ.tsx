'use client'
import { useEffect, useRef, useState } from 'react'
import { SectionHeading } from './Features'

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

const FAQS = [
  {
    q: "What makes IncursYIA different from a regular AI assistant?",
    a: "Unlike a chatbot, IncursYIA acts autonomously. It plans, executes and delivers concrete results — code, content, campaigns — without constant supervision.",
  },
  {
    q: "How do the agents work together?",
    a: "You interact with a single interface. Behind the scenes, specialized agents automatically collaborate to complete complex tasks end to end.",
  },
  {
    q: "Do I need technical skills?",
    a: "No. Just describe what you want to accomplish in plain language. IncursYIA handles all the technical execution.",
  },
  {
    q: "Is my data secure?",
    a: "All data is encrypted in transit and at rest. GDPR compliant. No sharing with third parties.",
  },
  {
    q: "Can I try it for free?",
    a: "Yes, no credit card required. Access all core features from the moment you sign up.",
  },
  {
    q: "How long until I see the first results?",
    a: "The first concrete actions happen within minutes of describing your goal.",
  },
]

function FaqItem({ faq, open, onClick, delay }: {
  faq: typeof FAQS[0]; open: boolean; onClick: () => void; delay: number
}) {
  const [ref, visible] = useInView()
  return (
    <div ref={ref} style={{
      borderBottom: '1px solid var(--border-subtle)',
      opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(14px)',
      transition: `all .5s ease ${delay}s`,
    }}>
      <button
        onClick={onClick}
        style={{
          width: '100%', padding: '28px 0', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center',
          background: 'none', border: 'none', cursor: 'pointer', gap: 24,
          fontFamily: 'var(--font-display)', fontStyle: 'italic',
          fontSize: 19, fontWeight: 400, color: 'var(--text-primary)', textAlign: 'left',
        }}
      >
        <span>{faq.q}</span>
        <span style={{
          flexShrink: 0, fontSize: 20, lineHeight: 1,
          color: open ? 'var(--accent)' : 'var(--text-muted)',
          transform: open ? 'rotate(45deg)' : 'none',
          transition: 'all .3s ease',
        }}>+</span>
      </button>
      <div style={{
        maxHeight: open ? 180 : 0, overflow: 'hidden',
        transition: 'max-height .4s ease, opacity .3s ease',
        opacity: open ? 1 : 0,
      }}>
        <p style={{
          padding: '0 0 28px', fontFamily: 'var(--font-body)',
          fontSize: 15, lineHeight: 1.75, color: 'var(--text-secondary)', maxWidth: 580,
        }}>{faq.a}</p>
      </div>
    </div>
  )
}

export function FAQ() {
  const [active, setActive] = useState<number | null>(null)
  return (
    <section id="faq" style={{ padding: '120px clamp(24px,5vw,80px)', background: 'var(--bg-deep)' }}>
      <SectionHeading label="FAQ" title="Frequently asked questions." />
      <div style={{ maxWidth: 680, margin: '56px auto 0', borderTop: '1px solid var(--border-subtle)' }}>
        {FAQS.map((f, i) => (
          <FaqItem
            key={i} faq={f} open={active === i}
            onClick={() => setActive(active === i ? null : i)}
            delay={i * 0.05}
          />
        ))}
      </div>
    </section>
  )
}
