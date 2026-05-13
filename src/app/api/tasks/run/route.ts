import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runAgentTask } from '@/lib/brain'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const { taskId, language, debug } = await req.json()
  if (!taskId) return NextResponse.json({ error: 'Missing taskId' }, { status: 400 })

  // Debug mode: check env vars and task visibility
  if (debug) {
    const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY
    const keyPrefix = process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20) ?? 'NOT SET'
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'NOT SET'

    const client = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { data, error } = await client.from('tasks').select('id, status, tag').eq('id', taskId).single()

    return NextResponse.json({
      debug: true,
      hasServiceKey,
      keyPrefix,
      supabaseUrl: url,
      taskFound: !!data,
      taskData: data,
      queryError: error?.message ?? null,
    })
  }

  // Must await — fire-and-forget gets killed by Vercel serverless
  try {
    await runAgentTask(taskId, language)
    return NextResponse.json({ ok: true, taskId, status: 'completed' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, taskId, error: msg }, { status: 500 })
  }
}
