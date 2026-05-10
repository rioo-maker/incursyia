import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const revalidate = 0

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function GET() {
  const client = db()

  const [companiesRes, tasksRes, adsRes] = await Promise.all([
    client.from('companies').select('id', { count: 'exact', head: true }),
    client.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
    client.from('tasks').select('id', { count: 'exact', head: true }).eq('tag', 'ads').eq('status', 'completed'),
  ])

  return NextResponse.json({
    revenue_eur: 0,
    companies: companiesRes.count ?? 0,
    ad_campaigns: adsRes.count ?? 0,
    tasks_done: tasksRes.count ?? 0,
    updated_at: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
