import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/** Build an SSR Supabase client that carries the user's session (respects RLS). */
async function getSupabaseAndCompany() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, companyId: null }

  const { data } = await supabase
    .from('companies').select('id').eq('user_id', user.id).order('created_at').limit(1).single()
  return { supabase, companyId: data?.id ?? null }
}

// GET /api/integrations — list all integrations for the company (credentials redacted)
export async function GET() {
  const { supabase, companyId } = await getSupabaseAndCompany()
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('integrations')
    .select('id, service, status, updated_at, credentials')
    .eq('company_id', companyId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Redact credential values — only send key names so UI knows which fields are filled
  const safe = (data ?? []).map(row => ({
    ...row,
    credentials: Object.fromEntries(
      Object.entries(row.credentials as Record<string, string>).map(([k, v]) => [k, v ? '••••••••' : ''])
    ),
  }))

  return NextResponse.json(safe)
}

// ─── Credential validation helpers ────────────────────────────────────────────

async function validateStripe(creds: Record<string, string>): Promise<string | null> {
  const key = creds.secret_key
  if (!key) return 'Secret key is required'
  if (!key.startsWith('sk_')) return 'Invalid Stripe key — must start with sk_live_ or sk_test_'
  try {
    const res = await fetch('https://api.stripe.com/v1/balance', {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return `Stripe rejected this key (HTTP ${res.status})`
    return null
  } catch {
    return 'Could not reach Stripe API — check your key'
  }
}

async function validateResend(creds: Record<string, string>): Promise<string | null> {
  const key = creds.api_key
  if (!key) return 'API key is required'
  if (!key.startsWith('re_')) return 'Invalid Resend key — must start with re_'
  try {
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return `Resend rejected this key (HTTP ${res.status})`
    return null
  } catch {
    return 'Could not reach Resend API — check your key'
  }
}

async function validateGitHub(creds: Record<string, string>): Promise<string | null> {
  const token = creds.token
  if (!token) return 'Token is required'
  if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) return 'Invalid GitHub token format'
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'IncursYIA' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return `GitHub rejected this token (HTTP ${res.status})`
    return null
  } catch {
    return 'Could not reach GitHub API — check your token'
  }
}

async function validateVercel(creds: Record<string, string>): Promise<string | null> {
  const token = creds.api_token
  if (!token) return 'API token is required'
  try {
    const res = await fetch('https://api.vercel.com/v2/user', {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return `Vercel rejected this token (HTTP ${res.status})`
    return null
  } catch {
    return 'Could not reach Vercel API — check your token'
  }
}

async function validateTelegram(creds: Record<string, string>): Promise<string | null> {
  const token = creds.bot_token
  if (!token) return 'Bot token is required'
  if (!token.includes(':')) return 'Invalid bot token format — should look like 123456:ABC-DEF...'
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      signal: AbortSignal.timeout(8000),
    })
    const data = await res.json()
    if (!data.ok) return `Telegram rejected this bot token: ${data.description}`
    return null
  } catch {
    return 'Could not reach Telegram API — check your bot token'
  }
}

const VALIDATORS: Record<string, (creds: Record<string, string>) => Promise<string | null>> = {
  stripe: validateStripe,
  resend: validateResend,
  github: validateGitHub,
  vercel: validateVercel,
  telegram: validateTelegram,
}

// POST /api/integrations — upsert credentials for a service (with validation)
export async function POST(req: NextRequest) {
  const { supabase, companyId } = await getSupabaseAndCompany()
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { service, credentials } = await req.json()
  if (!service) return NextResponse.json({ error: 'Missing service' }, { status: 400 })
  if (!credentials || typeof credentials !== 'object') return NextResponse.json({ error: 'Missing credentials' }, { status: 400 })

  // Merge with existing (so partial updates keep old values)
  const { data: existing } = await supabase
    .from('integrations')
    .select('credentials')
    .eq('company_id', companyId)
    .eq('service', service)
    .single()

  const merged = { ...(existing?.credentials ?? {}), ...credentials }
  // Remove any keys set to empty string
  Object.keys(merged).forEach(k => { if (!merged[k]) delete merged[k] })

  // ── Validate credentials before saving ──────────────────────────────────
  const validator = VALIDATORS[service]
  if (validator) {
    const error = await validator(merged)
    if (error) {
      return NextResponse.json({ error, validated: false }, { status: 400 })
    }
  }

  const { data, error } = await supabase
    .from('integrations')
    .upsert(
      { company_id: companyId, service, credentials: merged, status: 'active', updated_at: new Date().toISOString() },
      { onConflict: 'company_id,service' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id })
}

// DELETE /api/integrations?service=xxx — remove integration
export async function DELETE(req: NextRequest) {
  const { supabase, companyId } = await getSupabaseAndCompany()
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = new URL(req.url).searchParams.get('service')
  if (!service) return NextResponse.json({ error: 'Missing service' }, { status: 400 })

  const { error } = await supabase
    .from('integrations')
    .delete()
    .eq('company_id', companyId)
    .eq('service', service)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
