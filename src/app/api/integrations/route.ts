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

// POST /api/integrations — upsert credentials for a service
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
