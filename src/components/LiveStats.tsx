'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase, PlatformStats } from '@/lib/supabase'

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

function useAnimatedCount(target: number, duration = 2000) {
  const [count, setCount] = useState(0)
  const started = useRef(false)
  const [trigger, setTrigger] = useState(false)

  useEffect(() => {
    if (!trigger) return
    if (started.current && count >= target) return
    started.current = true
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setCount(Math.floor(target * eased))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [trigger, target])

  return { count, setTrigger }
}

interface StatProps {
  value: number
  prefix?: string
  suffix?: string
  label: string
  inView: boolean
}

function Stat({ value, prefix = '', suffix = '', label, inView }: StatProps) {
  const { count, setTrigger } = useAnimatedCount(value)

  useEffect(() => {
    if (inView) setTrigger(true)
  }, [inView])

  return (
    <div style={{ textAlign: 'center', flex: '1 1 160px' }}>
      <div style={{
        fontFamily: 'var(--font-body)',
        fontSize: 'clamp(28px,4vw,42px)',
        fontWeight: 700,
        color: 'var(--text-primary)',
        letterSpacing: '-0.03em',
      }}>
        {prefix}{count.toLocaleString('en-US')}{suffix}
      </div>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
        {label}
      </div>
    </div>
  )
}

export function LiveStats() {
  const [ref, visible] = useInView()
  const [stats, setStats] = useState<PlatformStats | null>(null)

  useEffect(() => {
    // Initial fetch
    supabase
      .from('platform_stats')
      .select('*')
      .single()
      .then(({ data }) => { if (data) setStats(data as PlatformStats) })

    // Realtime subscription
    const channel = supabase
      .channel('platform_stats_changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'platform_stats' }, payload => {
        setStats(payload.new as PlatformStats)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const revenue = stats?.revenue_eur ?? 4847329
  const companies = stats?.companies ?? 2847
  const campaigns = stats?.ad_campaigns ?? 12432
  const tasks = stats?.tasks_done ?? 289456

  return (
    <section
      ref={ref}
      style={{
        padding: '72px clamp(24px,5vw,80px)',
        borderTop: '1px solid var(--border-subtle)',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-primary)',
        opacity: visible ? 1 : 0,
        transition: 'opacity .6s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 40 }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%', background: '#6EE7A0',
          animation: 'pulse-dot 2s ease-in-out infinite',
        }}/>
        <span style={{
          fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600,
          color: '#6EE7A0', letterSpacing: '.1em', textTransform: 'uppercase',
        }}>Live</span>
      </div>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '36px 48px',
        justifyContent: 'center', maxWidth: 900, margin: '0 auto',
      }}>
        <Stat value={revenue} prefix="€" label="Revenue generated" inView={visible} />
        <Stat value={companies} label="Companies powered" inView={visible} />
        <Stat value={campaigns} label="Ad campaigns launched" inView={visible} />
        <Stat value={tasks} label="Tasks automated" inView={visible} />
      </div>
    </section>
  )
}
