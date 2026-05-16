'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Logo } from '@/components/Logo'

interface Template {
  id: string
  name: string
  slug: string
  description: string
  category: string
  icon: string
}

const STEPS = ['Company', 'Template', 'Connections']

export default function OnboardingPage() {
  const [step, setStep] = useState(0)
  const [companyName, setCompanyName] = useState('')
  const [industry, setIndustry] = useState('')
  const [website, setWebsite] = useState('')
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)

  // Load user & company data
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { window.location.href = '/login'; return }
      setUserId(user.id)

      const { data: company } = await supabase
        .from('companies').select('id, name')
        .eq('user_id', user.id).order('created_at').limit(1).single()
      if (company) {
        setCompanyId(company.id)
        setCompanyName(company.name)
      }
    })
  }, [])

  // Load templates
  useEffect(() => {
    fetch('/api/templates').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setTemplates(data)
    })
  }, [])

  const handleCompanyStep = async () => {
    if (!companyName.trim()) return
    if (companyId) {
      // Update existing company
      await supabase.from('companies').update({
        name: companyName.trim(),
        industry: industry || undefined,
        website: website || undefined,
      }).eq('id', companyId)
    }
    setStep(1)
  }

  const handleTemplateStep = async () => {
    if (selectedTemplate && companyId) {
      setApplying(true)
      await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: selectedTemplate, company_id: companyId }),
      })
      setApplying(false)
    }
    setStep(2)
  }

  const handleFinish = async () => {
    // Mark onboarded
    if (userId) {
      await supabase.from('profiles').update({ onboarded: true }).eq('id', userId)
    }
    window.location.href = '/dashboard'
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '14px 18px', fontSize: 14,
    fontFamily: 'var(--font-body)', color: 'var(--text-primary)',
    background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)',
    borderRadius: 8, outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-deep)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{ width: 560, maxWidth: '100%' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <Logo size={20} />
          <h1 style={{
            fontFamily: 'var(--font-display)', fontStyle: 'italic',
            fontSize: 32, color: 'var(--text-primary)', marginTop: 24, marginBottom: 8,
          }}>
            Set up your AI co-founder
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--text-muted)' }}>
            {step === 0 && 'Tell us about your business'}
            {step === 1 && 'Choose a template to get started fast'}
            {step === 2 && 'Connect your tools (you can do this later)'}
          </p>
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ flex: 1 }}>
              <div style={{
                height: 3, borderRadius: 2,
                background: i <= step ? 'var(--accent)' : 'rgba(255,255,255,.06)',
                transition: 'background .3s',
              }} />
              <div style={{
                fontFamily: 'var(--font-body)', fontSize: 11, color: i <= step ? 'var(--accent)' : 'var(--text-muted)',
                marginTop: 6, textAlign: 'center',
              }}>
                {s}
              </div>
            </div>
          ))}
        </div>

        {/* Step 1: Company details */}
        {step === 0 && (
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
            borderRadius: 16, padding: 32,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  Company name *
                </label>
                <input
                  type="text" placeholder="My Awesome Startup"
                  value={companyName} onChange={e => setCompanyName(e.target.value)}
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border-subtle)')}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  Industry
                </label>
                <select value={industry} onChange={e => setIndustry(e.target.value)} style={inputStyle}>
                  <option value="">Select an industry</option>
                  {['SaaS', 'E-commerce', 'Freelance / Agency', 'Content Creator', 'AI / Tech', 'Local Business', 'Education', 'Health & Wellness', 'Finance', 'Other'].map(i => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  Website (optional)
                </label>
                <input
                  type="url" placeholder="https://mycompany.com"
                  value={website} onChange={e => setWebsite(e.target.value)}
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border-subtle)')}
                />
              </div>
            </div>
            <button
              onClick={handleCompanyStep}
              disabled={!companyName.trim()}
              style={{
                width: '100%', marginTop: 24, padding: '15px 24px',
                background: !companyName.trim() ? 'rgba(217,119,87,.3)' : 'var(--accent)',
                border: 'none', borderRadius: 8, color: '#0C0C0C',
                fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 600,
                cursor: !companyName.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              Continue →
            </button>
          </div>
        )}

        {/* Step 2: Choose template */}
        {step === 1 && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 24 }}>
              {templates.map(t => (
                <div
                  key={t.id}
                  onClick={() => setSelectedTemplate(selectedTemplate === t.id ? null : t.id)}
                  style={{
                    background: 'var(--bg-card)',
                    border: `2px solid ${selectedTemplate === t.id ? 'var(--accent)' : 'var(--border-subtle)'}`,
                    borderRadius: 12, padding: '20px 18px', cursor: 'pointer',
                    transition: 'border-color .2s, transform .15s',
                    transform: selectedTemplate === t.id ? 'scale(1.02)' : 'none',
                  }}
                >
                  <div style={{ fontSize: 28, marginBottom: 10 }}>{t.icon}</div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                    {t.name}
                  </div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    {t.description}
                  </div>
                  {selectedTemplate === t.id && (
                    <div style={{ marginTop: 10, fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>
                      ✓ Selected
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setStep(0)}
                style={{
                  padding: '14px 24px', background: 'transparent',
                  border: '1px solid var(--border-subtle)', borderRadius: 8,
                  color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: 14, cursor: 'pointer',
                }}
              >
                ← Back
              </button>
              <button
                onClick={handleTemplateStep}
                disabled={applying}
                style={{
                  flex: 1, padding: '14px 24px',
                  background: applying ? 'rgba(217,119,87,.4)' : 'var(--accent)',
                  border: 'none', borderRadius: 8, color: '#0C0C0C',
                  fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {applying ? 'Applying template...' : selectedTemplate ? 'Apply & Continue →' : 'Skip for now →'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Connect tools */}
        {step === 2 && (
          <div>
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
              borderRadius: 16, padding: 32, marginBottom: 24,
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { id: 'stripe', name: 'Stripe', desc: 'Accept payments & track revenue', color: '#635BFF' },
                  { id: 'resend', name: 'Resend', desc: 'Send emails to your customers', color: '#6366F1' },
                  { id: 'github', name: 'GitHub', desc: 'Deploy code & manage repos', color: '#8B5CF6' },
                  { id: 'vercel', name: 'Vercel', desc: 'Auto-deploy your websites', color: '#E5E5E5' },
                  { id: 'telegram', name: 'Telegram', desc: 'Get real-time notifications', color: '#26A5E4' },
                ].map(svc => (
                  <div key={svc.id} style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px', background: 'var(--bg-deep)',
                    borderRadius: 10, border: '1px solid var(--border-subtle)',
                  }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: svc.color, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{svc.name}</div>
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)' }}>{svc.desc}</div>
                    </div>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)', background: 'rgba(255,255,255,.04)', padding: '4px 12px', borderRadius: 20 }}>
                      Setup in Connections
                    </span>
                  </div>
                ))}
              </div>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)', marginTop: 16, textAlign: 'center' }}>
                You can connect these anytime from Settings → Connections
              </p>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  padding: '14px 24px', background: 'transparent',
                  border: '1px solid var(--border-subtle)', borderRadius: 8,
                  color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: 14, cursor: 'pointer',
                }}
              >
                ← Back
              </button>
              <button
                onClick={handleFinish}
                style={{
                  flex: 1, padding: '14px 24px', background: 'var(--accent)',
                  border: 'none', borderRadius: 8, color: '#0C0C0C',
                  fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Launch my Dashboard →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
