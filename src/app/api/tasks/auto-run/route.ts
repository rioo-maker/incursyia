import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { runAgentTask } from '@/lib/brain'

export const runtime = 'nodejs'
export const maxDuration = 300

function sdb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

/**
 * Called by the chat UI immediately after the brain responds.
 * Picks up todo tasks for this company and runs them sequentially.
 * Runs up to 3 tasks per invocation to stay within Vercel's 300s timeout.
 * The chat UI can call this repeatedly, or the cron job sweeps remaining tasks.
 */
export async function POST(req: NextRequest) {
  // Auth check
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: company } = await supabase
    .from('companies').select('id').eq('user_id', user.id).order('created_at').limit(1).single()
  if (!company) return NextResponse.json({ error: 'No company' }, { status: 404 })

  // Get ALL todo tasks — no time filter (the old 2-min window caused tasks to be stuck forever)
  const { data: tasks } = await sdb()
    .from('tasks')
    .select('id, title, tag')
    .eq('company_id', company.id)
    .eq('status', 'todo')
    .order('created_at')
    .limit(3) // 3 tasks max per call (~90s each = ~270s total, within 300s limit)

  if (!tasks?.length) return NextResponse.json({ ok: true, ran: 0, remaining: 0 })

  // Count total remaining to inform client
  const { count } = await sdb()
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', company.id)
    .eq('status', 'todo')

  // Run tasks sequentially — each Ollama call takes 30-90s
  const results: string[] = []
  for (const task of tasks) {
    try {
      await runAgentTask(task.id)
      results.push(`✓ ${task.title}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      results.push(`✗ ${task.title}: ${msg}`)
    }
  }

  const remaining = (count ?? 0) - tasks.length
  return NextResponse.json({ ok: true, ran: tasks.length, remaining, results })
}
