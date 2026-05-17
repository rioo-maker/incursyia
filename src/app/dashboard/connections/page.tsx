'use client'
import { useEffect, useState } from 'react'
import { useCompany } from '@/lib/useCompany'

interface Integration { service: string; status: string; credentials: Record<string, string>; updated_at: string }

// ─── Service definitions ─────────────────────────────────────────────────────
const SERVICES = [
  {
    id: 'resend',
    name: 'Resend',
    icon: '',
    color: '#6366F1',
    description: 'Send real emails via your own Resend account.',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 're_xxxxxxxxxxxx', secret: true },
      { key: 'from_email', label: 'From Email', placeholder: 'hello@yourdomain.com', secret: false },
    ],
    guide: [
      { step: 1, text: 'Go to resend.com and create a free account' },
      { step: 2, text: 'Click "API Keys" in the sidebar → "Create API Key"' },
      { step: 3, text: 'Add and verify your sending domain (or use onboarding@resend.dev for testing)' },
      { step: 4, text: 'Paste your API key and from email below' },
    ],
    link: 'https://resend.com/api-keys',
  },
  {
    id: 'twitter',
    name: 'Twitter / X',
    icon: '',
    color: '#111111',
    description: 'Auto-publish tweets from your AI agent.',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxx', secret: true },
      { key: 'api_secret', label: 'API Secret', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxx', secret: true },
      { key: 'access_token', label: 'Access Token', placeholder: 'xxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxx', secret: true },
      { key: 'access_token_secret', label: 'Access Token Secret', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', secret: true },
    ],
    guide: [
      { step: 1, text: 'Go to developer.twitter.com → "Developer Portal"' },
      { step: 2, text: 'Create a new project + app' },
      { step: 3, text: 'In app settings → "User authentication settings" → enable OAuth 1.0a with Read + Write' },
      { step: 4, text: 'Keys and Tokens tab → generate all 4 keys and paste below' },
    ],
    link: 'https://developer.twitter.com/en/portal/dashboard',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: '',
    color: '#0077B5',
    description: 'Post company updates and thought leadership.',
    fields: [
      { key: 'access_token', label: 'Access Token', placeholder: 'AQX...', secret: true },
      { key: 'author_id', label: 'Author URN', placeholder: 'urn:li:person:XXXXXXXX', secret: false },
    ],
    guide: [
      { step: 1, text: 'Go to linkedin.com/developers → "Create app"' },
      { step: 2, text: 'Add "Share on LinkedIn" and "Sign In with LinkedIn" products' },
      { step: 3, text: 'Use OAuth 2.0 to get an access token with w_member_social scope' },
      { step: 4, text: 'Your Author ID: go to linkedin.com/in/yourprofile → URL contains your ID' },
    ],
    link: 'https://www.linkedin.com/developers/apps',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: '',
    color: '#FF0050',
    description: 'Auto-publish videos to TikTok via Content Posting API.',
    fields: [
      { key: 'access_token', label: 'Access Token', placeholder: 'act.xxxxxxxxxxxxxxxx', secret: true },
      { key: 'client_key', label: 'Client Key', placeholder: 'awxxxxxxxxxxxxxx', secret: false },
    ],
    guide: [
      { step: 1, text: 'Go to developers.tiktok.com → "Manage Apps" → create an app' },
      { step: 2, text: 'Add the "Content Posting API" product to your app' },
      { step: 3, text: 'Set redirect URI and generate an access token via OAuth 2.0' },
      { step: 4, text: 'Note: TikTok requires a video URL — plain text posts need a video attachment' },
    ],
    link: 'https://developers.tiktok.com/apps/',
  },
  {
    id: 'meta',
    name: 'Meta (Facebook / Instagram)',
    icon: '',
    color: '#1877F2',
    description: 'Launch Meta Ads campaigns and post to Facebook & Instagram pages.',
    fields: [
      { key: 'access_token', label: 'Access Token', placeholder: 'EAAxxxxxxxxxxxxxxxx', secret: true },
      { key: 'ad_account_id', label: 'Ad Account ID', placeholder: 'act_XXXXXXXXXX', secret: false },
      { key: 'page_id', label: 'Page ID (for posts)', placeholder: '1234567890', secret: false },
    ],
    guide: [
      { step: 1, text: 'Go to developers.facebook.com → "My Apps" → create an app' },
      { step: 2, text: 'Add "Marketing API" product' },
      { step: 3, text: 'Business Settings → Ad Accounts → copy your Ad Account ID (act_XXXXX)' },
      { step: 4, text: 'Generate a User Access Token in Graph API Explorer with ads_management + pages_manage_posts permissions' },
    ],
    link: 'https://developers.facebook.com/apps/',
  },
  {
    id: 'github',
    name: 'GitHub',
    icon: '',
    color: '#8B5CF6',
    description: 'Let agents create repos, push code, and manage your GitHub projects.',
    fields: [
      { key: 'token', label: 'Personal Access Token', placeholder: 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', secret: true },
      { key: 'username', label: 'GitHub Username', placeholder: 'your-username', secret: false },
    ],
    guide: [
      { step: 1, text: 'Go to github.com/settings/tokens → "Generate new token (classic)"' },
      { step: 2, text: 'Give it a name like "IncursYIA Agent"' },
      { step: 3, text: 'Select scopes: repo (full control), read:org' },
      { step: 4, text: 'Copy the token (starts with ghp_) and paste below with your username' },
    ],
    link: 'https://github.com/settings/tokens',
  },
  {
    id: 'vercel',
    name: 'Vercel Deploy',
    icon: '',
    color: '#E5E5E5',
    description: 'Let the engineering agent auto-deploy websites and apps it builds.',
    fields: [
      { key: 'api_token', label: 'API Token', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxx', secret: true },
      { key: 'team_id', label: 'Team ID (optional)', placeholder: 'team_xxxxxxxx', secret: false },
    ],
    guide: [
      { step: 1, text: 'Go to vercel.com/account/tokens' },
      { step: 2, text: 'Click "Create Token" — give it a name like "IncursYIA Agent"' },
      { step: 3, text: 'Copy the token and paste below' },
      { step: 4, text: 'Team ID: optional, only needed if deploying to a team account' },
    ],
    link: 'https://vercel.com/account/tokens',
  },
  {
    id: 'stripe',
    name: 'Stripe',
    icon: '',
    color: '#635BFF',
    description: 'Accept payments, create products & prices, manage subscriptions. AI configures payment flows for you.',
    fields: [
      { key: 'secret_key', label: 'Secret Key', placeholder: 'Your Stripe secret key (starts with sk_)', secret: true },
      { key: 'publishable_key', label: 'Publishable Key', placeholder: 'Your Stripe publishable key (starts with pk_)', secret: true },
      { key: 'webhook_secret', label: 'Webhook Secret (optional)', placeholder: 'Your webhook signing secret (starts with whsec_)', secret: true },
    ],
    guide: [
      { step: 1, text: 'Go to dashboard.stripe.com/apikeys' },
      { step: 2, text: 'Copy your Secret Key (sk_live_... or sk_test_... for testing)' },
      { step: 3, text: 'Copy your Publishable Key (pk_live_... or pk_test_...)' },
      { step: 4, text: 'Your AI agent uses the secret key to create products, prices, and checkout sessions — it will NEVER expose it publicly' },
    ],
    link: 'https://dashboard.stripe.com/apikeys',
  },
  {
    id: 'supabase',
    name: 'Supabase',
    icon: '',
    color: '#3ECF8E',
    description: 'Database, auth, and storage for your apps. AI can create tables, query data, manage users.',
    fields: [
      { key: 'url', label: 'Project URL', placeholder: 'https://xxxxx.supabase.co', secret: false },
      { key: 'anon_key', label: 'Anon Key (public)', placeholder: 'eyJhbGciOiJIUzI1NiIs...', secret: true },
      { key: 'service_role_key', label: 'Service Role Key (secret)', placeholder: 'eyJhbGciOiJIUzI1NiIs...', secret: true },
    ],
    guide: [
      { step: 1, text: 'Go to supabase.com → your project → Settings → API' },
      { step: 2, text: 'Copy the Project URL' },
      { step: 3, text: 'Copy the anon (public) key and the service_role (secret) key' },
      { step: 4, text: 'The service role key bypasses Row Level Security — your AI uses it to manage data' },
    ],
    link: 'https://supabase.com/dashboard/projects',
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    icon: '',
    color: '#FF6B35',
    description: 'AI voice generation for video ads, podcasts, and audio content.',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', secret: true },
      { key: 'voice_id', label: 'Default Voice ID (optional)', placeholder: 'pNInz6obpgDQGcFmaJgB', secret: false },
    ],
    guide: [
      { step: 1, text: 'Go to elevenlabs.io → Profile → API Key' },
      { step: 2, text: 'Copy your API key' },
      { step: 3, text: 'Optional: go to Voice Library → pick a voice → copy its Voice ID from the URL' },
      { step: 4, text: 'Your AI will use this to generate voiceovers for video ads and content' },
    ],
    link: 'https://elevenlabs.io/app/settings/api-keys',
  },
  {
    id: 'videogen',
    name: 'Video Generation',
    icon: '',
    color: '#E040FB',
    description: 'Generate video ads automatically. AI creates videos and publishes them to TikTok, Twitter, or Meta Ads.',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxx', secret: true },
      { key: 'provider', label: 'Provider', placeholder: 'runway / heygen / synthesia / pika', secret: false },
    ],
    guide: [
      { step: 1, text: 'Sign up at your preferred video AI provider (Runway, HeyGen, Synthesia, Pika)' },
      { step: 2, text: 'Go to API settings and generate an API key' },
      { step: 3, text: 'Enter the provider name exactly as shown: runway, heygen, synthesia, or pika' },
      { step: 4, text: 'Your AI will generate video ads and publish them directly to your social accounts' },
    ],
    link: 'https://app.runwayml.com',
  },
  {
    id: 'twilio',
    name: 'Twilio',
    icon: '',
    color: '#F22F46',
    description: 'SMS, WhatsApp messages, and phone calls. AI can send notifications and manage customer communication.',
    fields: [
      { key: 'account_sid', label: 'Account SID', placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', secret: false },
      { key: 'auth_token', label: 'Auth Token', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', secret: true },
      { key: 'phone_number', label: 'Twilio Phone Number', placeholder: '+1234567890', secret: false },
    ],
    guide: [
      { step: 1, text: 'Go to twilio.com/console' },
      { step: 2, text: 'Your Account SID and Auth Token are on the dashboard' },
      { step: 3, text: 'Buy a phone number: Phone Numbers → Manage → Buy a number' },
      { step: 4, text: 'Your AI will use this to send SMS campaigns and customer notifications' },
    ],
    link: 'https://www.twilio.com/console',
  },
  {
    id: 'telegram',
    name: 'Telegram',
    icon: '',
    color: '#26A5E4',
    description: 'Get real-time notifications when agents complete tasks, errors occur, or reports are generated.',
    fields: [
      { key: 'bot_token', label: 'Bot Token', placeholder: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11', secret: true },
      { key: 'chat_id', label: 'Chat ID', placeholder: '-1001234567890 or your user ID', secret: false },
    ],
    guide: [
      { step: 1, text: 'Open Telegram and message @BotFather' },
      { step: 2, text: 'Send /newbot and follow the prompts to create your bot' },
      { step: 3, text: 'Copy the bot token you receive' },
      { step: 4, text: 'Message @userinfobot to get your chat ID, or add the bot to a group and use the group chat ID' },
    ],
    link: 'https://t.me/BotFather',
  },
  {
    id: 'sheets',
    name: 'Google Sheets / Excel',
    icon: '',
    color: '#0F9D58',
    description: 'AI creates revenue reports, financial dashboards, and data exports in spreadsheets.',
    fields: [
      { key: 'service_account_json', label: 'Service Account JSON (Google)', placeholder: '{"type":"service_account",...}', secret: true },
      { key: 'spreadsheet_id', label: 'Default Spreadsheet ID (optional)', placeholder: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms', secret: false },
    ],
    guide: [
      { step: 1, text: 'Go to console.cloud.google.com → APIs → enable Google Sheets API' },
      { step: 2, text: 'Create a Service Account → download the JSON key file' },
      { step: 3, text: 'Share your target spreadsheet with the service account email' },
      { step: 4, text: 'Paste the full JSON key content below — your AI will use it to create and update spreadsheets' },
    ],
    link: 'https://console.cloud.google.com/apis/library/sheets.googleapis.com',
  },
]

// ─── Component ────────────────────────────────────────────────────────────────
export default function ConnectionsPage() {
  const company = useCompany()
  const [integrations, setIntegrations] = useState<Record<string, Integration>>({})
  const [expanded, setExpanded] = useState<string | null>(null)
  const [form, setForm] = useState<Record<string, Record<string, string>>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!company) return
    fetch('/api/integrations').then(r => r.json()).then((data: Integration[]) => {
      const map: Record<string, Integration> = {}
      data.forEach(i => { map[i.service] = i })
      setIntegrations(map)
    })
  }, [company])

  const isConnected = (serviceId: string) => !!integrations[serviceId]

  const handleExpand = (serviceId: string) => {
    setExpanded(expanded === serviceId ? null : serviceId)
    // Pre-fill with redacted placeholders to show fields are set
    if (!form[serviceId]) {
      const svc = SERVICES.find(s => s.id === serviceId)
      const existing = integrations[serviceId]?.credentials ?? {}
      const init: Record<string, string> = {}
      svc?.fields.forEach(f => { init[f.key] = existing[f.key] ? '' : '' }) // start empty (user re-enters to update)
      setForm(p => ({ ...p, [serviceId]: init }))
    }
  }

  const handleSave = async (serviceId: string) => {
    setSaving(serviceId)
    setSaveError(null)
    const credentials = form[serviceId] ?? {}
    // Filter out empty strings — keep only filled fields
    const filled = Object.fromEntries(Object.entries(credentials).filter(([, v]) => v.trim()))

    if (Object.keys(filled).length === 0) {
      setSaveError('Fill in at least one field before saving.')
      setSaving(null)
      return
    }

    try {
      const res = await fetch('/api/integrations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: serviceId, credentials: filled }),
      })
      const json = await res.json()
      if (res.ok) {
        setSaved(serviceId)
        setTimeout(() => setSaved(null), 2000)
        // Refresh list
        fetch('/api/integrations').then(r => r.json()).then((data: Integration[]) => {
          const map: Record<string, Integration> = {}
          data.forEach(i => { map[i.service] = i })
          setIntegrations(map)
        })
      } else {
        setSaveError(json.error ?? `Error ${res.status}`)
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setSaving(null)
    }
  }

  const handleDisconnect = async (serviceId: string) => {
    if (!confirm(`Disconnect ${serviceId}? Your AI agents will no longer use it.`)) return
    await fetch(`/api/integrations?service=${serviceId}`, { method: 'DELETE' })
    setIntegrations(p => { const n = { ...p }; delete n[serviceId]; return n })
    setExpanded(null)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px',
    background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)',
    borderRadius: 7, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: 13, outline: 'none',
  }

  return (
    <div style={{ padding: '32px 36px', maxWidth: 800 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, color: 'var(--text-primary)', marginBottom: 4 }}>Connections</h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)' }}>
          Connect your own API accounts — your AI agents will use them to send emails, post content, and run campaigns.
        </p>
      </div>

      {/* Search bar */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Search connections... (Stripe, Telegram, GitHub...)"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', padding: '11px 16px', paddingLeft: 40,
            background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
            borderRadius: 10, color: 'var(--text-primary)', fontFamily: 'var(--font-body)',
            fontSize: 14, outline: 'none', boxSizing: 'border-box',
          }}
          onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border-subtle)')}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {SERVICES.filter(svc => {
          if (!search.trim()) return true
          const q = search.toLowerCase()
          return svc.name.toLowerCase().includes(q) || svc.id.toLowerCase().includes(q) || svc.description.toLowerCase().includes(q)
        }).map(svc => {
          const connected = isConnected(svc.id)
          const open = expanded === svc.id
          const fieldVals = form[svc.id] ?? {}

          return (
            <div key={svc.id} style={{
              background: 'var(--bg-card)', border: `1px solid ${connected ? 'rgba(110,231,160,.25)' : 'var(--border-subtle)'}`,
              borderRadius: 12, overflow: 'hidden',
              borderLeft: `3px solid ${connected ? '#6EE7A0' : 'transparent'}`,
            }}>
              {/* Header row */}
              <div
                onClick={() => handleExpand(svc.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', cursor: 'pointer' }}
              >
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: svc.color, flexShrink: 0, marginTop: 4,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{svc.name}</div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{svc.description}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {connected ? (
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, color: '#6EE7A0', background: 'rgba(110,231,160,.1)', padding: '4px 10px', borderRadius: 20 }}>
                      ✓ Connected
                    </span>
                  ) : (
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)', background: 'rgba(255,255,255,.04)', padding: '4px 10px', borderRadius: 20 }}>
                      Not connected
                    </span>
                  )}
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{open ? '▲' : '▼'}</span>
                </div>
              </div>

              {/* Expanded panel */}
              {open && (
                <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--border-subtle)' }}>
                  {/* Setup guide */}
                  <div style={{ margin: '16px 0', background: 'var(--bg-deep)', borderRadius: 8, padding: 14 }}>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, color: 'var(--accent)', marginBottom: 10, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                      How to get your API key
                    </div>
                    {svc.guide.map(g => (
                      <div key={g.step} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
                        <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--accent-subtle)', color: 'var(--accent)', fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{g.step}</span>
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{g.text}</span>
                      </div>
                    ))}
                    <a href={svc.link} target="_blank" rel="noopener noreferrer" style={{
                      display: 'inline-block', marginTop: 6, fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--accent)', textDecoration: 'none',
                    }}>→ Open {svc.name} dashboard ↗</a>
                  </div>

                  {/* Credential fields */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {svc.fields.map(f => (
                      <div key={f.key}>
                        <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                          {f.label}
                          {connected && integrations[svc.id]?.credentials?.[f.key] && (
                            <span style={{ marginLeft: 8, color: '#6EE7A0', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>✓ set</span>
                          )}
                        </label>
                        <input
                          type={f.secret ? 'password' : 'text'}
                          placeholder={connected && integrations[svc.id]?.credentials?.[f.key] ? '(leave blank to keep existing)' : f.placeholder}
                          value={fieldVals[f.key] ?? ''}
                          onChange={e => setForm(p => ({ ...p, [svc.id]: { ...(p[svc.id] ?? {}), [f.key]: e.target.value } }))}
                          style={inputStyle}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Save error */}
                  {saveError && expanded === svc.id && (
                    <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(248,113,113,.08)', border: '1px solid rgba(248,113,113,.25)', borderRadius: 7, fontFamily: 'var(--font-body)', fontSize: 12, color: '#F87171' }}>
                      {saveError}
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 10, marginTop: 16, alignItems: 'center' }}>
                    <button
                      onClick={() => handleSave(svc.id)}
                      disabled={saving === svc.id}
                      style={{ padding: '9px 22px', background: saving === svc.id ? 'rgba(217,119,87,.4)' : 'var(--accent)', border: 'none', borderRadius: 7, color: '#0C0C0C', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                    >
                      {saved === svc.id ? '✓ Saved!' : saving === svc.id ? 'Saving...' : connected ? 'Update' : 'Connect'}
                    </button>
                    {connected && (
                      <button
                        onClick={() => handleDisconnect(svc.id)}
                        style={{ padding: '9px 16px', background: 'transparent', border: '1px solid rgba(248,113,113,.3)', borderRadius: 7, color: '#F87171', fontFamily: 'var(--font-body)', fontSize: 13, cursor: 'pointer' }}
                      >Disconnect</button>
                    )}
                    {connected && integrations[svc.id]?.updated_at && (
                      <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)' }}>
                        Last updated {new Date(integrations[svc.id].updated_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
