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

    const redirectUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/login?confirmed=true`
      : 'https://app-topaz-chi-44.vercel.app/login?confirmed=true'

    const { data, error: authErr } = await supabase.auth.signUp({
      email, password,
      options: {
        data: { company_name: companyName },
        emailRedirectTo: redirectUrl,
      },
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
  }

  if (done) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: 420, padding: 24 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: 'var(--accent)', fontSize: 28 }}>✉</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, color: 'var(--text-primary)' }}>Check your email</h2>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.6 }}>
            We sent a confirmation link to <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>.
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.6 }}>
            Click the link in the email to activate your account, then come back here to sign in.
          </p>
          <div style={{
            marginTop: 20, padding: '12px 16px', background: 'rgba(217,119,87,.08)',
            border: '1px solid rgba(217,119,87,.2)', borderRadius: 8,
            fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--accent)', lineHeight: 1.5,
          }}>
            Don&apos;t see it? Check your spam folder. The email comes from noreply@mail.app.supabase.io
          </div>
          <Link href="/login" style={{
            display: 'inline-block', marginTop: 20, padding: '12px 24px',
            background: 'var(--accent)', borderRadius: 8, color: '#0C0C0C',
            fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600,
            textDecoration: 'none',
          }}>
            Go to Sign In →
          </Link>
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
