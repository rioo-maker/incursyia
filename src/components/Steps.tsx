'use client'
import { Reveal } from './Reveal'
import { SectionHeading } from './Features'

const STEPS = [
  {
    n: '01',
    title: 'Describe your goal',
    desc: 'Explain in plain language what you want to accomplish. No jargon, no configuration.',
  },
  {
    n: '02',
    title: 'Agents orchestrate',
    desc: 'Development, content, ads, data — everything executes in parallel, without intervention.',
  },
  {
    n: '03',
    title: 'Results delivered',
    desc: 'Code deployed, content published, analyses ready. Concrete results, not suggestions.',
  },
]

export function Steps() {
  return (
    <section id="how-it-works" style={{ padding: '120px clamp(24px,5vw,80px)', background: 'var(--bg-primary)' }}>
      <SectionHeading label="How it works" title="Simple as a conversation." />
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 48, maxWidth: 960, margin: '72px auto 0',
      }}>
        {STEPS.map((s, i) => (
          <Reveal key={i} delay={i * 0.12}>
            <div style={{ position: 'relative' }}>
              <span style={{
                fontFamily: 'var(--font-display)', fontStyle: 'italic',
                fontSize: 72, color: 'var(--accent)', opacity: .1,
                position: 'absolute', top: -24, left: -4, lineHeight: 1,
              }}>{s.n}</span>
              <div style={{ width: 1, height: 40, background: 'var(--accent)', opacity: .35, marginBottom: 24 }}/>
              <h3 style={{
                fontFamily: 'var(--font-body)', fontSize: 19, fontWeight: 600,
                color: 'var(--text-primary)', marginBottom: 12,
              }}>{s.title}</h3>
              <p style={{
                fontFamily: 'var(--font-body)', fontSize: 15,
                color: 'var(--text-secondary)', lineHeight: 1.7,
              }}>{s.desc}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
