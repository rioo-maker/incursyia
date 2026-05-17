import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runAgentTask } from '@/lib/brain'
import { checkTaskLimit } from '@/lib/limits'

export const runtime = 'nodejs'
export const maxDuration = 300

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(req: NextRequest) {
  const { taskId, language } = await req.json()
  if (!taskId) return NextResponse.json({ error: 'Missing taskId' }, { status: 400 })

  try {
    const client = db()

    // Get the task's company_id
    const { data: task } = await client
      .from('tasks')
      .select('company_id')
      .eq('id', taskId)
      .single()

    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

    // Get company owner's user_id
    const { data: company } = await client
      .from('companies')
      .select('user_id')
      .eq('id', task.company_id)
      .single()

    if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

    // Get owner's plan
    const { data: profile } = await client
      .from('profiles')
      .select('plan, plan_expires_at')
      .eq('id', company.user_id)
      .single()

    let plan = profile?.plan ?? 'free'

    // Auto-downgrade if expired
    if (plan !== 'free' && profile?.plan_expires_at && new Date(profile.plan_expires_at) < new Date()) {
      plan = 'free'
    }

    // Check task limit
    const taskCheck = await checkTaskLimit(task.company_id, plan)
    if (!taskCheck.allowed) {
      // Update task status to blocked with message
      await client
        .from('tasks')
        .update({
          status: 'blocked',
          error: `Task limit reached (${taskCheck.used}/${taskCheck.limit} this month). ${plan === 'free' ? 'Upgrade to Pro for 30 tasks/month.' : ''}`,
        })
        .eq('id', taskId)

      return NextResponse.json({
        ok: false,
        taskId,
        error: `Task limit reached (${taskCheck.used}/${taskCheck.limit})`,
        used: taskCheck.used,
        limit: taskCheck.limit,
      }, { status: 429 })
    }

    await runAgentTask(taskId, language)
    return NextResponse.json({ ok: true, taskId, status: 'completed' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, taskId, error: msg }, { status: 500 })
  }
}
