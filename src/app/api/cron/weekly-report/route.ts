import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ollamaChat, AGENT_MODELS } from '@/lib/ollama'

export const runtime = 'nodejs'
export const maxDuration = 300

const CRON_SECRET = process.env.CRON_SECRET ?? ''

function sdb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function GET(req: NextRequest) {
  // Auth — Vercel cron sends the CRON_SECRET header
  const auth = req.headers.get('authorization')
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const startedAt = Date.now()
  const client = sdb()
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const weekStart = weekAgo.toISOString().split('T')[0]
  const weekEnd = now.toISOString().split('T')[0]

  const results: {
    company: string
    report_id?: string
    error?: string
  }[] = []

  try {
    // Get all companies
    const { data: companies } = await client
      .from('companies')
      .select('id, name')
      .limit(50)

    if (!companies?.length) {
      return Response.json({ ok: true, message: 'No companies found', results: [] })
    }

    for (const company of companies) {
      // Check time limit — stop at 240s to be safe
      if (Date.now() - startedAt > 240_000) {
        results.push({ company: company.name, error: 'Skipped — approaching time limit' })
        continue
      }

      try {
        // Gather week's metrics for this company
        const [tasksRes, revenueRes, agentActivityRes, socialRes, emailsRes] = await Promise.all([
          client
            .from('tasks')
            .select('id, title, tag')
            .eq('company_id', company.id)
            .eq('status', 'completed')
            .gte('completed_at', weekAgo.toISOString()),

          client
            .from('revenue_snapshots')
            .select('*')
            .eq('company_id', company.id)
            .gte('snapshot_date', weekStart)
            .lte('snapshot_date', weekEnd),

          client
            .from('autonomous_runs')
            .select('id')
            .eq('company_id', company.id)
            .gte('created_at', weekAgo.toISOString()),

          client
            .from('tasks')
            .select('id')
            .eq('company_id', company.id)
            .eq('tag', 'social')
            .eq('status', 'completed')
            .gte('completed_at', weekAgo.toISOString()),

          client
            .from('tasks')
            .select('id')
            .eq('company_id', company.id)
            .eq('tag', 'email')
            .eq('status', 'completed')
            .gte('completed_at', weekAgo.toISOString()),
        ])

        const metrics = {
          company_name: company.name,
          tasks_completed: tasksRes.data?.length ?? 0,
          task_titles: (tasksRes.data ?? []).map(t => t.title).slice(0, 20),
          revenue_snapshots: revenueRes.data ?? [],
          agent_runs: agentActivityRes.data?.length ?? 0,
          social_posts: socialRes.data?.length ?? 0,
          emails_sent: emailsRes.data?.length ?? 0,
          week_start: weekStart,
          week_end: weekEnd,
        }

        // Generate report via AI
        const report = await ollamaChat(
          [
            {
              role: 'user',
              content: `Generate the weekly CEO report for ${company.name} covering ${weekStart} to ${weekEnd}.\n\nMetrics:\n${JSON.stringify(metrics, null, 2)}`,
            },
          ],
          {
            model: AGENT_MODELS.brain,
            system: 'You are a CEO report writer. Generate a concise weekly business report covering key accomplishments, metrics, and priorities for the coming week. Use clear sections with headers. Be data-driven and actionable.',
            temperature: 0.5,
          }
        )

        // Save to database
        const { data: saved, error: saveError } = await client
          .from('ceo_reports')
          .insert({
            company_id: company.id,
            week_start: weekStart,
            week_end: weekEnd,
            content: report,
            metrics,
          })
          .select('id')
          .single()

        if (saveError) {
          results.push({ company: company.name, error: saveError.message })
        } else {
          results.push({ company: company.name, report_id: saved.id })
        }
      } catch (err) {
        results.push({
          company: company.name,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    const elapsed = Math.round((Date.now() - startedAt) / 1000)
    const generated = results.filter(r => r.report_id).length

    return Response.json({
      ok: true,
      elapsed_seconds: elapsed,
      companies_total: companies.length,
      reports_generated: generated,
      results,
    })
  } catch (err) {
    return Response.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
