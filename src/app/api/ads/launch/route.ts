import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getCredentials, getCompanyIdForUser } from '@/lib/integrations'

async function getUserId(): Promise<string | null> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

async function launchMetaCampaign(name: string, dailyBudgetCents: number, creds: Record<string, string>) {
  const { access_token, ad_account_id } = creds
  if (!access_token || !ad_account_id) return { error: 'Missing Meta credentials', needs_setup: true }

  const base = `https://graph.facebook.com/v18.0/${ad_account_id}`

  const campRes = await fetch(`${base}/campaigns`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, objective: 'OUTCOME_TRAFFIC', status: 'PAUSED', access_token }),
  })
  const camp = await campRes.json()
  if (!campRes.ok || camp.error) return { error: camp.error?.message ?? JSON.stringify(camp) }

  const adSetRes = await fetch(`${base}/adsets`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `${name} – Ad Set`, campaign_id: camp.id,
      daily_budget: dailyBudgetCents, billing_event: 'IMPRESSIONS',
      optimization_goal: 'LINK_CLICKS', status: 'PAUSED',
      targeting: { geo_locations: { countries: ['US', 'GB', 'FR', 'DE'] }, age_min: 25, age_max: 55 },
      access_token,
    }),
  })
  const adSet = await adSetRes.json()
  if (!adSetRes.ok || adSet.error) return { error: adSet.error?.message ?? JSON.stringify(adSet) }

  return { campaignId: camp.id, adSetId: adSet.id }
}

export async function POST(req: NextRequest) {
  const { name, platform, budget_daily, ai_copy, company_id } = await req.json()

  let companyId = company_id
  if (!companyId) {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    companyId = await getCompanyIdForUser(userId)
  }
  if (!companyId) return NextResponse.json({ error: 'No company found' }, { status: 404 })

  const creds = await getCredentials(companyId, platform === 'meta' ? 'meta' : platform)

  if (platform === 'meta') {
    const result = await launchMetaCampaign(name, Math.round(budget_daily * 100), creds)
    if ('error' in result) return NextResponse.json({ ok: false, ...result }, { status: 503 })
    return NextResponse.json({ ok: true, ...result })
  }

  return NextResponse.json({
    ok: false,
    error: `${platform} ads launch not yet implemented. Add your credentials in Connections.`,
    needs_setup: true,
  })
}
