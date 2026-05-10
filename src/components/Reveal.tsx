'use client'
import { useEffect, useRef, useState, CSSProperties, ReactNode } from 'react'

interface RevealProps {
  children: ReactNode
  delay?: number
  y?: number
  style?: CSSProperties
}

export function Reveal({ children, delay = 0, y = 24, style: sx }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); obs.unobserve(el) }
    }, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : `translateY(${y}px)`,
        transition: `all .7s cubic-bezier(.16,1,.3,1) ${delay}s`,
        ...sx,
      }}
    >
      {children}
    </div>
  )
}
