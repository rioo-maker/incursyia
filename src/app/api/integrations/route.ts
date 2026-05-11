import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

function serviceDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

async function getCompanyId(): Promise<string | null> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('companies').select('id').eq('user_id', user.id).order('created_at').limit(1).single()
  return data?.id ?? null
}

// GET /api/integrations — list all integrations for the company (credentials redacted)
export async function GET() {
  const companyId = await getCompanyId()
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await serviceDb()
    .from('integrations')
    .select('id, service, status, updated_at, credentials')
    .eq('company_id', companyId)

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
  const companyId = await getCompanyId()
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { service, credentials } = await req.json()
  if (!service || !credentials) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  // Merge with existing (so partial updates keep old values)
  const { data: existing } = await serviceDb()
    .from('integrations')
    .select('credentials')
    .eq('company_id', companyId)
    .eq('service', service)
    .single()

  const merged = { ...(existing?.credentials ?? {}), ...credentials }
  // Remove any keys set to empty string
  Object.keys(merged).forEach(k => { if (!merged[k]) delete merged[k] })

  const { data, error } = await serviceDb()
    .from('integrations')
    .upsert({ company_id: companyId, service, credentials: merged, status: 'active', updated_at: new Date().toISOString() }, { onConflict: 'company_id,service' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id })
}

// DELETE /api/integrations?service=xxx — remove integration
export async function DELETE(req: NextRequest) {
  const companyId = await getCompanyId()
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const service = new URL(req.url).searchParams.get('service')
  if (!service) return NextResponse.json({ error: 'Missing service' }, { status: 400 })
  await serviceDb().from('integrations').delete().eq('company_id', companyId).eq('service', service)
  return NextResponse.json({ ok: true })
}
