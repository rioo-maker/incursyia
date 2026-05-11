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
 * Picks up any new `todo` tasks for this company and runs them.
 * Fire-and-forget from the client — runs up to maxDuration seconds.
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

  // Get fresh todo tasks for this company (created in last 2 minutes = just created by chat)
  const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString()
  const { data: tasks } = await sdb()
    .from('tasks')
    .select('id, title, tag')
    .eq('company_id', company.id)
    .eq('status', 'todo')
    .gt('created_at', twoMinAgo)
    .order('created_at')
    .limit(5)

  if (!tasks?.length) return NextResponse.json({ ok: true, ran: 0 })

  // Run all tasks in parallel — don't block on each one sequentially
  const settled = await Promise.allSettled(tasks.map(task => runAgentTask(task.id)))
  const results = settled.map((r, i) =>
    r.status === 'fulfilled' ? `✓ ${tasks[i].title}` : `✗ ${tasks[i].title}: ${r.reason}`
  )

  return NextResponse.json({ ok: true, ran: tasks.length, results })
}
