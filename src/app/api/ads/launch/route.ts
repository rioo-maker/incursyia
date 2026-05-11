import { NextRequest, NextResponse } from 'next/server'

// Meta Marketing API — create a campaign
async function launchMetaCampaign(name: string, dailyBudgetCents: number, adCopy: string) {
  const token = process.env.META_ACCESS_TOKEN
  const accountId = process.env.META_AD_ACCOUNT_ID // act_XXXXXXXXXX

  if (!token || !accountId) return { error: 'META_ACCESS_TOKEN and META_AD_ACCOUNT_ID not configured' }

  const base = `https://graph.facebook.com/v18.0/${accountId}`

  // 1. Create campaign
  const campRes = await fetch(`${base}/campaigns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, objective: 'OUTCOME_TRAFFIC', status: 'PAUSED', access_token: token }),
  })
  const camp = await campRes.json()
  if (!campRes.ok || camp.error) return { error: camp.error?.message ?? JSON.stringify(camp) }

  // 2. Create ad set
  const adSetRes = await fetch(`${base}/adsets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `${name} – Ad Set`,
      campaign_id: camp.id,
      daily_budget: dailyBudgetCents,
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'LINK_CLICKS',
      status: 'PAUSED',
      targeting: { geo_locations: { countries: ['US', 'GB', 'FR', 'DE'] }, age_min: 25, age_max: 55 },
      access_token: token,
    }),
  })
  const adSet = await adSetRes.json()
  if (!adSetRes.ok || adSet.error) return { error: adSet.error?.message ?? JSON.stringify(adSet) }

  return { campaignId: camp.id, adSetId: adSet.id }
}

export async function POST(req: NextRequest) {
  const { name, platform, budget_daily, ai_copy, company_id } = await req.json()

  if (platform === 'meta') {
    const result = await launchMetaCampaign(name, Math.round(budget_daily * 100), ai_copy ?? '')
    if (result.error) {
      return NextResponse.json({ ok: false, error: result.error, needs_setup: !process.env.META_ACCESS_TOKEN }, { status: 400 })
    }
    return NextResponse.json({ ok: true, ...result })
  }

  if (platform === 'google') {
    return NextResponse.json({
      ok: false,
      error: 'Google Ads requires Google Ads API OAuth setup. Add GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CUSTOMER_ID to env vars.',
      needs_setup: true,
    })
  }

  return NextResponse.json({ ok: false, error: `${platform} launch not yet implemented`, needs_setup: true })
}
