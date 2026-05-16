import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

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

// GET /api/marketplace — list published marketplace skills with install status
export async function GET() {
  const { companyId } = await getSupabaseAndCompany()
  const client = db()

  const { data: skills, error } = await client
    .from('marketplace_skills')
    .select('*')
    .eq('status', 'published')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If user is logged in, check which skills are installed
  let installedIds: Set<string> = new Set()
  if (companyId) {
    const { data: installed } = await client
      .from('installed_skills')
      .select('skill_id')
      .eq('company_id', companyId)

    installedIds = new Set((installed ?? []).map(i => i.skill_id))
  }

  const result = (skills ?? []).map(skill => ({
    ...skill,
    installed: installedIds.has(skill.id),
  }))

  return NextResponse.json(result)
}

// POST /api/marketplace — install a skill
export async function POST(req: NextRequest) {
  const { companyId } = await getSupabaseAndCompany()
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { skill_id } = await req.json()
  if (!skill_id) return NextResponse.json({ error: 'Missing skill_id' }, { status: 400 })

  const { data, error } = await db()
    .from('installed_skills')
    .insert({ company_id: companyId, skill_id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id })
}

// DELETE /api/marketplace — uninstall a skill
export async function DELETE(req: NextRequest) {
  const { companyId } = await getSupabaseAndCompany()
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { skill_id } = await req.json()
  if (!skill_id) return NextResponse.json({ error: 'Missing skill_id' }, { status: 400 })

  const { error } = await db()
    .from('installed_skills')
    .delete()
    .eq('company_id', companyId)
    .eq('skill_id', skill_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
