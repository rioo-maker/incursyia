import { NextRequest } from 'next/server'
import { streamBrainResponse } from '@/lib/brain'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const { conversationId, message, history } = await req.json()

  if (!conversationId || !message) {
    return new Response('Missing conversationId or message', { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const token of streamBrainResponse(conversationId, message, history ?? [])) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`))
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
