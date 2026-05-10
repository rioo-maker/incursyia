import { NextRequest, NextResponse } from 'next/server'
import { runAgentTask } from '@/lib/brain'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const { taskId } = await req.json()
  if (!taskId) return NextResponse.json({ error: 'Missing taskId' }, { status: 400 })

  // Fire and forget — client polls via realtime
  runAgentTask(taskId).catch(console.error)

  return NextResponse.json({ ok: true, taskId })
}
