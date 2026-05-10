import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { streamBrainResponse } from '@/lib/brain'
import { getCountryFromRequest, getLanguageFromCountry } from '@/lib/geo'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { message, history, conversationId: bodyConvId } = body

  if (!message) {
    return new Response('Missing message', { status: 400 })
  }

  // Get authenticated user
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Language: geo header first, then profile fallback
  const geoCountry = getCountryFromRequest(req.headers)
  let language = getLanguageFromCountry(geoCountry)
  let companyName = 'your company'
  let companyId: string | undefined
  let conversationId: string | undefined
  let plan = 'free'

  if (user) {
    // Load profile for stored language preference
    const { data: profile } = await supabase
      .from('profiles')
      .select('language, plan')
      .eq('id', user.id)
      .single()

    if (profile) {
      if (!geoCountry) language = profile.language ?? 'en'
      plan = profile.plan ?? 'free'
    }

    // Load user's company + conversation
    const { data: company } = await supabase
      .from('companies')
      .select('id, name')
      .eq('user_id', user.id)
      .order('created_at')
      .limit(1)
      .single()

    if (company) {
      companyId = company.id
      companyName = company.name

      // Get or create conversation
      const { data: conv } = await supabase
        .from('conversations')
        .select('id')
        .eq('company_id', company.id)
        .order('created_at')
        .limit(1)
        .single()

      if (conv) {
        conversationId = conv.id
      } else {
        const { data: newConv } = await supabase
          .from('conversations')
          .insert({ company_id: company.id, title: 'Main chat' })
          .select()
          .single()
        conversationId = newConv?.id
      }
    }
  }

  // Fallback conversationId from body (e.g. analytics demo page)
  if (!conversationId) {
    conversationId = bodyConvId ?? '00000000-0000-0000-0000-000000000002'
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const token of streamBrainResponse(
          conversationId!,
          message,
          history ?? [],
          { language, companyName, companyId, plan }
        )) {
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
