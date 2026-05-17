import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { getTasksUsedThisMonth, getChatMessagesToday } from '@/lib/limits'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

async function getAuthUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// GET /api/license — check current plan status
export async function GET() {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const client = db()

  const { data: profile } = await client
    .from('profiles')
    .select('plan, plan_expires_at')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  let plan = profile.plan ?? 'free'
  let planExpiresAt = profile.plan_expires_at

  // Auto-downgrade if plan expired
  if (plan !== 'free' && planExpiresAt && new Date(planExpiresAt) < new Date()) {
    await client
      .from('profiles')
      .update({ plan: 'free', plan_expires_at: null })
      .eq('id', user.id)

    // Also mark the license key as expired
    await client
      .from('license_keys')
      .update({ status: 'expired' })
      .eq('activated_by', user.id)
      .eq('status', 'active')

    plan = 'free'
    planExpiresAt = null
  }

  // Get usage stats
  const { data: company } = await client
    .from('companies')
    .select('id')
    .eq('user_id', user.id)
    .order('created_at')
    .limit(1)
    .single()

  let tasksUsed = 0
  let chatUsed = 0

  if (company) {
    tasksUsed = await getTasksUsedThisMonth(company.id)
  }
  chatUsed = await getChatMessagesToday(user.id)

  const daysRemaining = planExpiresAt
    ? Math.max(0, Math.ceil((new Date(planExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null

  return NextResponse.json({
    plan,
    plan_expires_at: planExpiresAt,
    days_remaining: daysRemaining,
    tasks_used: tasksUsed,
    chat_used: chatUsed,
  })
}

// POST /api/license — activate a license key
export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { key } = await req.json()
  if (!key || typeof key !== 'string') {
    return NextResponse.json({ error: 'Missing license key' }, { status: 400 })
  }

  const trimmedKey = key.trim().toUpperCase()
  const client = db()

  // Look up the key
  const { data: license } = await client
    .from('license_keys')
    .select('*')
    .eq('key', trimmedKey)
    .single()

  if (!license) {
    return NextResponse.json({ error: 'Invalid license key' }, { status: 400 })
  }

  if (license.status !== 'unused') {
    return NextResponse.json({ error: 'This license key has already been used' }, { status: 400 })
  }

  // Calculate expiry
  const now = new Date()
  const expiresAt = new Date(now.getTime() + license.duration_days * 24 * 60 * 60 * 1000)

  // Activate the key
  const { error: keyError } = await client
    .from('license_keys')
    .update({
      activated_by: user.id,
      activated_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      status: 'active',
    })
    .eq('id', license.id)

  if (keyError) {
    return NextResponse.json({ error: 'Failed to activate key' }, { status: 500 })
  }

  // Update user profile
  const { error: profileError } = await client
    .from('profiles')
    .update({
      plan: license.plan,
      plan_expires_at: expiresAt.toISOString(),
    })
    .eq('id', user.id)

  if (profileError) {
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    plan: license.plan,
    expires_at: expiresAt.toISOString(),
    days_remaining: license.duration_days,
  })
}
