'use client'
import { Reveal } from './Reveal'
import { AccentBtn, GhostBtn } from './Buttons'

const capabilities = [
  'software development', 'web automation', 'research & intelligence',
  'email management', 'content generation', 'ad campaigns',
  'data analysis', 'customer support',
]

function Marquee() {
  const row = capabilities.map((t, i) => (
    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 24, whiteSpace: 'nowrap' }}>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 400, color: 'var(--text-muted)', letterSpacing: '.02em' }}>{t}</span>
      <span style={{ color: 'rgba(255,255,255,.1)', fontSize: 8 }}>●</span>
    </span>
  ))
  return (
    <div style={{
      overflow: 'hidden', padding: '28px 0', marginTop: 72,
      borderTop: '1px solid var(--border-subtle)',
      borderBottom: '1px solid var(--border-subtle)',
    }}>
      <div style={{ display: 'flex', gap: 24, width: 'max-content', animation: 'marquee 30s linear infinite' }}>
        {row}{row}{row}
      </div>
    </div>
  )
}

function DashboardPreview() {
  const rows = [
    { color: 'var(--accent)', label: 'Landing page deployed', time: '2 min ago' },
    { color: '#6EE7A0', label: 'Email campaign launched', time: '5 min ago' },
    { color: '#93C5FD', label: 'Analytics report ready', time: '8 min ago' },
    { color: '#FCD34D', label: 'A/B test running', time: '12 min ago' },
  ]
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
      borderRadius: 14, overflow: 'hidden', width: '100%', maxWidth: 440,
    }}>
      <div style={{
        padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Dashboard</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--text-muted)', opacity: .4 }}/>)}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '1px solid var(--border-subtle)' }}>
        {[{ l: 'Revenue', v: '€12.8k' }, { l: 'Tasks', v: '1,234' }, { l: 'Agents', v: '8 active' }].map((s, i) => (
          <div key={i} style={{ padding: '16px 18px', borderRight: i < 2 ? '1px solid var(--border-subtle)' : 'none' }}>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{s.l}</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{s.v}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: '16px 20px' }}>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>Activity</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: r.color, flexShrink: 0 }}/>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-secondary)', flex: 1 }}>{r.label}</span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)' }}>{r.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

interface HeroProps {
  onCTA: () => void
  onDash: () => void
}

export function Hero({ onCTA, onDash }: HeroProps) {
  return (
    <section style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      justifyContent: 'center', textAlign: 'center',
      padding: '140px clamp(24px,5vw,72px) 0',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Grid background */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        backgroundImage:
          'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
        backgroundSize: '64px 64px',
        maskImage: 'radial-gradient(ellipse 80% 70% at 50% 30%, black 20%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 30%, black 20%, transparent 100%)',
      }} />
      {/* Glow behind grid */}
      <div style={{
        position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)',
        width: '700px', height: '500px', zIndex: 0,
        borderRadius: '50%',
        background: 'radial-gradient(ellipse at center, rgba(217,119,87,0.12) 0%, rgba(217,119,87,0.04) 40%, transparent 70%)',
        filter: 'blur(60px)',
        pointerEvents: 'none',
      }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <Reveal delay={0.05}>
          <span style={{
            fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600,
            color: 'var(--accent)', letterSpacing: '.14em', textTransform: 'uppercase',
          }}>Autonomous AI Co-Founder</span>
        </Reveal>

        <Reveal delay={0.15} style={{ marginTop: 28 }}>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontStyle: 'italic',
            fontSize: 'clamp(42px,7.5vw,88px)', fontWeight: 400,
            color: 'var(--text-primary)', letterSpacing: '-0.025em',
            lineHeight: 1.05, maxWidth: 900, margin: '0 auto',
          }}>
            The intelligence that moves<br/>your business forward
          </h1>
        </Reveal>

        <Reveal delay={0.3} style={{ marginTop: 32 }}>
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: 'clamp(16px,1.8vw,19px)',
            color: 'var(--text-secondary)', lineHeight: 1.7,
            maxWidth: 520, margin: '0 auto',
          }}>
            It plans, builds, automates, publishes, analyzes and grows
            your business — every day, without supervision.
          </p>
        </Reveal>

        <Reveal delay={0.45} style={{ marginTop: 48 }}>
          <div className="hero-buttons" style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <AccentBtn large onClick={onCTA}>Start for free</AccentBtn>
            <GhostBtn large onClick={onDash}>See the dashboard →</GhostBtn>
          </div>
        </Reveal>

        <Marquee />
      </div>
    </section>
  )
}

export function HeroSplit({ onCTA, onDash }: HeroProps) {
  return (
    <section style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      padding: '140px clamp(24px,5vw,80px) 80px',
    }}>
      <div className="hero-split-grid" style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: 'clamp(40px,6vw,80px)', alignItems: 'center',
        maxWidth: 1120, margin: '0 auto', width: '100%',
      }}>
        <div>
          <Reveal delay={0.05}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, color: 'var(--accent)', letterSpacing: '.14em', textTransform: 'uppercase' }}>
              Autonomous AI Co-Founder
            </span>
          </Reveal>
          <Reveal delay={0.15} style={{ marginTop: 24 }}>
            <h1 style={{
              fontFamily: 'var(--font-display)', fontStyle: 'italic',
              fontSize: 'clamp(34px,4.5vw,60px)', fontWeight: 400,
              color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.08,
            }}>
              The intelligence that moves{' '}
              <span style={{ color: 'var(--accent)' }}>your business forward</span>
            </h1>
          </Reveal>
          <Reveal delay={0.3} style={{ marginTop: 24 }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 'clamp(15px,1.6vw,18px)', color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 440 }}>
              It plans, builds, automates, publishes, analyzes and grows
              your business every day.
            </p>
          </Reveal>
          <Reveal delay={0.4} style={{ marginTop: 40 }}>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <AccentBtn large onClick={onCTA}>Start for free</AccentBtn>
              <GhostBtn large onClick={onDash}>Dashboard →</GhostBtn>
            </div>
          </Reveal>
        </div>
        <Reveal delay={0.35} y={30}>
          <DashboardPreview />
        </Reveal>
      </div>
    </section>
  )
}
