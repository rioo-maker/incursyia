'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Logo } from '@/components/Logo'
import Link from 'next/link'

export default function SignupPage() {
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [companyName, setCompany]   = useState('')
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [done, setDone]             = useState(false)

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '15px 18px', fontSize: 15,
    fontFamily: 'var(--font-body)', color: 'var(--text-primary)',
    background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)',
    borderRadius: 8, outline: 'none', boxSizing: 'border-box',
  }

  const handleSignup = async () => {
    if (!email || !password || !companyName) return
    setLoading(true)
    setError('')

    const { data, error: authErr } = await supabase.auth.signUp({
      email, password,
      options: { data: { company_name: companyName } },
    })

    if (authErr) {
      setError(authErr.message)
      setLoading(false)
      return
    }

    if (data.user) {
      // Create company
      const { data: company } = await supabase.from('companies').insert({
        user_id: data.user.id,
        name: companyName,
        stage: 'idea',
      }).select().single()

      // Create initial conversation
      if (company) {
        await supabase.from('conversations').insert({
          company_id: company.id,
          title: 'Main chat',
        })
      }
    }

    setDone(true)
    setTimeout(() => { window.location.href = '/dashboard' }, 1200)
  }

  if (done) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: 'var(--accent)', fontSize: 28 }}>✓</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, color: 'var(--text-primary)' }}>Account created</h2>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)', marginTop: 8 }}>Launching your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-deep)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        width: 420, maxWidth: '100%',
        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
        borderRadius: 16, padding: 40,
        boxShadow: '0 30px 80px rgba(0,0,0,.4)',
      }}>
        <Logo size={20} />
        <h1 style={{
          fontFamily: 'var(--font-display)', fontStyle: 'italic',
          fontSize: 28, color: 'var(--text-primary)', marginTop: 28, marginBottom: 6,
        }}>Start for free</h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)', marginBottom: 28 }}>
          Your AI co-founder will be ready in seconds.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="text" placeholder="Company name" value={companyName}
            onChange={e => setCompany(e.target.value)}
            style={inputStyle}
            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border-subtle)')}
          />
          <input
            type="email" placeholder="Email" value={email}
            onChange={e => setEmail(e.target.value)}
            style={inputStyle}
            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border-subtle)')}
          />
          <input
            type="password" placeholder="Password (min 8 chars)" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSignup()}
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
            onClick={handleSignup}
            disabled={loading || !email || !password || !companyName}
            style={{
              padding: '15px 20px', background: loading ? 'rgba(217,119,87,.4)' : 'var(--accent)',
              border: 'none', borderRadius: 8, color: '#0C0C0C',
              fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4, width: '100%',
            }}
          >
            {loading ? 'Creating account...' : 'Launch my company →'}
          </button>
        </div>

        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginTop: 24 }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Sign in</Link>
        </p>

        <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 16, opacity: 0.6 }}>
          Free plan · No credit card required
        </p>
      </div>
    </div>
  )
}
