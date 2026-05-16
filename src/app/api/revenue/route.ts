import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
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

export async function GET() {
  const { companyId } = await getSupabaseAndCompany()
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const client = db()

  // Find Stripe integration for this company
  const { data: stripeIntegration } = await client
    .from('integrations')
    .select('credentials')
    .eq('company_id', companyId)
    .eq('service', 'stripe')
    .single()

  const creds = stripeIntegration?.credentials as { secret_key?: string } | null
  const hasStripe = !!creds?.secret_key

  let balance = 0
  let charges: unknown[] = []

  if (hasStripe) {
    // Fetch Stripe balance
    try {
      const balanceRes = await fetch('https://api.stripe.com/v1/balance', {
        headers: { Authorization: `Bearer ${creds!.secret_key}` },
        signal: AbortSignal.timeout(5000),
      })
      if (balanceRes.ok) {
        const balanceData = await balanceRes.json()
        for (const fund of (balanceData.available ?? [])) {
          balance += fund.amount ?? 0
        }
        balance = Math.round(balance / 100)
      }
    } catch {
      // Stripe balance fetch failed — continue with 0
    }

    // Fetch recent charges
    try {
      const chargesRes = await fetch('https://api.stripe.com/v1/charges?limit=10', {
        headers: { Authorization: `Bearer ${creds!.secret_key}` },
        signal: AbortSignal.timeout(5000),
      })
      if (chargesRes.ok) {
        const chargesData = await chargesRes.json()
        charges = chargesData.data ?? []
      }
    } catch {
      // Stripe charges fetch failed — continue with empty
    }
  }

  // Fetch historical revenue snapshots
  const { data: snapshots } = await client
    .from('revenue_snapshots')
    .select('*')
    .eq('company_id', companyId)
    .order('snapshot_date', { ascending: false })
    .limit(30)

  return NextResponse.json({
    has_stripe: hasStripe,
    balance,
    charges,
    snapshots: snapshots ?? [],
  })
}
