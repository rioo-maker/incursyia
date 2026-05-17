'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Logo } from '@/components/Logo'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.get('confirmed') === 'true') setConfirmed(true)
    } catch {}
  }, [])

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '15px 18px', fontSize: 15,
    fontFamily: 'var(--font-body)', color: 'var(--text-primary)',
    background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)',
    borderRadius: 8, outline: 'none', boxSizing: 'border-box',
  }

  const handleLogin = async () => {
    if (!email || !password) return
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) {
      setError(err.message)
      setLoading(false)
    } else {
      window.location.href = '/dashboard'
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-deep)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        width: 400, maxWidth: '100%',
        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
        borderRadius: 16, padding: 40,
        boxShadow: '0 30px 80px rgba(0,0,0,.4)',
      }}>
        <Logo size={20} />
        <h1 style={{
          fontFamily: 'var(--font-display)', fontStyle: 'italic',
          fontSize: 28, color: 'var(--text-primary)', marginTop: 28, marginBottom: 6,
        }}>Welcome back</h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)', marginBottom: 28 }}>
          Sign in to your account.
        </p>

        {confirmed && (
          <div style={{
            marginBottom: 16, padding: '12px 16px', background: 'rgba(110,231,160,.08)',
            border: '1px solid rgba(110,231,160,.25)', borderRadius: 8,
            fontFamily: 'var(--font-body)', fontSize: 13, color: '#6EE7A0',
          }}>
            ✓ Email confirmed! You can now sign in.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="email" placeholder="Email" value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={inputStyle}
            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border-subtle)')}
          />
          <input
            type="password" placeholder="Password" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={inputStyle}
            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border-subtle)')}
          />

          {error && (
            <div style={{
              background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)',
              borderRadius: 8, padding: '10px 14px',
              fontFamily: 'var(--font-body)', fontSize: 13, color: '#F87171',
            }}>{error}</div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading || !email || !password}
            style={{
              padding: '15px 20px', background: loading ? 'rgba(217,119,87,.4)' : 'var(--accent)',
              border: 'none', borderRadius: 8, color: '#0C0C0C',
              fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4, width: '100%',
            }}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </div>

        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginTop: 24 }}>
          No account?{' '}
          <Link href="/signup" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Create one free</Link>
        </p>
      </div>
    </div>
  )
}
