import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const revalidate = 60

const FAKE_MINIMUMS = {
  revenue: 511,   // Show at least $511 until real revenue exceeds it
  companies: 22,  // Show at least 22 until real company count exceeds it
}

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

/** Sum Stripe available balance across all connected Stripe integrations */
async function fetchStripeRevenue(): Promise<number> {
  try {
    const client = db()
    const { data: stripeIntegrations } = await client
      .from('integrations')
      .select('credentials')
      .eq('type', 'stripe')

    if (!stripeIntegrations?.length) return 0

    let totalCents = 0

    for (const integration of stripeIntegrations) {
      try {
        const creds = integration.credentials as { secret_key?: string }
        if (!creds?.secret_key) continue

        const res = await fetch('https://api.stripe.com/v1/balance', {
          headers: { Authorization: `Bearer ${creds.secret_key}` },
          signal: AbortSignal.timeout(5000),
        })
        if (!res.ok) continue

        const balance = await res.json()
        for (const fund of (balance.available ?? [])) {
          totalCents += fund.amount ?? 0
        }
      } catch {
        // Skip this integration on error
      }
    }

    return Math.round(totalCents / 100)
  } catch {
    return 0
  }
}

export async function GET() {
  const client = db()

  const [companiesRes, tasksRes, adsRes, stripeRevenue] = await Promise.all([
    client.from('companies').select('id', { count: 'exact', head: true }),
    client.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
    client.from('tasks').select('id', { count: 'exact', head: true }).eq('tag', 'ads').eq('status', 'completed'),
    fetchStripeRevenue(),
  ])

  const realCompanies = companiesRes.count ?? 0
  const realRevenue = stripeRevenue

  return NextResponse.json({
    revenue: Math.max(realRevenue, FAKE_MINIMUMS.revenue),
    companies: Math.max(realCompanies, FAKE_MINIMUMS.companies),
    ad_campaigns: adsRes.count ?? 0,
    tasks_done: tasksRes.count ?? 0,
    updated_at: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' },
  })
}
