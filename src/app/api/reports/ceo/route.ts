import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { ollamaChat, AGENT_MODELS } from '@/lib/ollama'
import { notifyReportGenerated } from '@/lib/notify'
import { getReportsThisMonth } from '@/lib/limits'

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

// GET /api/reports/ceo — list CEO reports for the user's company
export async function GET() {
  const { companyId } = await getSupabaseAndCompany()
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await db()
    .from('ceo_reports')
    .select('*')
    .eq('company_id', companyId)
    .order('week_start', { ascending: false })
    .limit(10)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/reports/ceo — generate a new CEO report
export async function POST(req: NextRequest) {
  const { supabase, companyId } = await getSupabaseAndCompany()
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get the user's plan
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await db()
    .from('profiles')
    .select('plan, plan_expires_at')
    .eq('id', user.id)
    .single()

  let plan = profile?.plan ?? 'free'
  if (plan !== 'free' && profile?.plan_expires_at && new Date(profile.plan_expires_at) < new Date()) {
    plan = 'free'
  }

  if (plan === 'free') {
    return NextResponse.json({ error: 'CEO Reports are a Pro feature. Upgrade to Pro to generate weekly reports.' }, { status: 403 })
  }

  // Check monthly limit for Pro (4 reports/month)
  const reportsUsed = await getReportsThisMonth(companyId)
  if (reportsUsed >= 4) {
    return NextResponse.json({ error: `You've reached the CEO report limit this month (${reportsUsed}/4).` }, { status: 429 })
  }

  const client = db()
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const weekStart = weekAgo.toISOString().split('T')[0]
  const weekEnd = now.toISOString().split('T')[0]

  // ── Gather metrics for the past week ────────────────────────────────────

  const [tasksRes, revenueRes, agentActivityRes, socialRes, emailsRes] = await Promise.all([
    // Tasks completed this week
    client
      .from('tasks')
      .select('id, title, tag, status')
      .eq('company_id', companyId)
      .eq('status', 'completed')
      .gte('completed_at', weekAgo.toISOString()),

    // Revenue snapshots this week
    client
      .from('revenue_snapshots')
      .select('*')
      .eq('company_id', companyId)
      .gte('snapshot_date', weekStart)
      .lte('snapshot_date', weekEnd),

    // Agent activity (autonomous runs)
    client
      .from('autonomous_runs')
      .select('id, created_at')
      .eq('company_id', companyId)
      .gte('created_at', weekAgo.toISOString()),

    // Social posts this week
    client
      .from('tasks')
      .select('id, title')
      .eq('company_id', companyId)
      .eq('tag', 'social')
      .eq('status', 'completed')
      .gte('completed_at', weekAgo.toISOString()),

    // Emails sent this week
    client
      .from('tasks')
      .select('id, title')
      .eq('company_id', companyId)
      .eq('tag', 'email')
      .eq('status', 'completed')
      .gte('completed_at', weekAgo.toISOString()),
  ])

  const metrics = {
    tasks_completed: tasksRes.data?.length ?? 0,
    task_titles: (tasksRes.data ?? []).map(t => t.title).slice(0, 20),
    revenue_snapshots: revenueRes.data ?? [],
    agent_runs: agentActivityRes.data?.length ?? 0,
    social_posts: socialRes.data?.length ?? 0,
    emails_sent: emailsRes.data?.length ?? 0,
    week_start: weekStart,
    week_end: weekEnd,
  }

  // ── Generate report via AI ──────────────────────────────────────────────

  const report = await ollamaChat(
    [
      {
        role: 'user',
        content: `Generate the weekly CEO report for ${weekStart} to ${weekEnd}.\n\nMetrics:\n${JSON.stringify(metrics, null, 2)}`,
      },
    ],
    {
      model: AGENT_MODELS.brain,
      system: 'You are a CEO report writer. Generate a concise weekly business report covering key accomplishments, metrics, and priorities for the coming week. Use clear sections with headers. Be data-driven and actionable.',
      temperature: 0.5,
    }
  )

  // ── Save to database ───────────────────────────────────────────────────

  const { data, error } = await client
    .from('ceo_reports')
    .insert({
      company_id: companyId,
      week_start: weekStart,
      week_end: weekEnd,
      content: report,
      metrics,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ── Notify via Telegram ────────────────────────────────────────────────
  await notifyReportGenerated(companyId, `Report ${weekStart} → ${weekEnd}`)

  return NextResponse.json(data)
}
