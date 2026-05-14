import { NextRequest, NextResponse } from 'next/server'
import { runAgentTask } from '@/lib/brain'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const { taskId, language } = await req.json()
  if (!taskId) return NextResponse.json({ error: 'Missing taskId' }, { status: 400 })

  try {
    await runAgentTask(taskId, language)
    return NextResponse.json({ ok: true, taskId, status: 'completed' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, taskId, error: msg }, { status: 500 })
  }
}
