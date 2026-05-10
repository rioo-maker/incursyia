'use client'
import { useState } from 'react'
import { Logo } from './Logo'
import { AccentBtn } from './Buttons'

interface SignupModalProps {
  open: boolean
  onClose: () => void
}

export function SignupModal({ open, onClose }: SignupModalProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  if (!open) return null

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '15px 18px', fontSize: 15,
    fontFamily: 'var(--font-body)', color: 'var(--text-primary)',
    background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)',
    borderRadius: 8, outline: 'none', transition: 'border .2s',
  }

  const handleSubmit = async () => {
    if (!email || !password) return
    setLoading(true)
    await new Promise(r => setTimeout(r, 900))
    setLoading(false)
    setDone(true)
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'fadeIn .25s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: 16, padding: 40, width: 400, maxWidth: '90vw',
          boxShadow: '0 30px 80px rgba(0,0,0,.5)',
          animation: 'slideUp .35s cubic-bezier(.16,1,.3,1)',
          position: 'relative',
        }}
      >
        {done ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12, background: 'var(--accent-subtle)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', color: 'var(--accent)', fontSize: 24,
            }}>✓</div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 24, color: 'var(--text-primary)', marginBottom: 8 }}>Welcome aboard</h3>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--text-secondary)' }}>Redirecting to your dashboard...</p>
          </div>
        ) : (
          <>
            <button
              onClick={onClose}
              style={{ position: 'absolute', top: 16, right: 18, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer' }}
            >×</button>
            <Logo size={22} />
            <h3 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, color: 'var(--text-primary)', marginTop: 24, marginBottom: 6 }}>
              Start for free
            </h3>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)', marginBottom: 28 }}>No credit card required.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="email" placeholder="Email" value={email}
                onChange={e => setEmail(e.target.value)} style={inputStyle}
                onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border-subtle)')}
              />
              <input
                type="password" placeholder="Password" value={password}
                onChange={e => setPassword(e.target.value)} style={inputStyle}
                onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border-subtle)')}
              />
              <AccentBtn large onClick={handleSubmit} style={{ width: '100%', marginTop: 4 }}>
                {loading ? 'Creating account...' : 'Create my account'}
              </AccentBtn>
            </div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginTop: 20 }}>
              Already have an account?{' '}
              <span style={{ color: 'var(--accent)', cursor: 'pointer' }}>Sign in</span>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
