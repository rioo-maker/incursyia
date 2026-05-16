import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

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

// POST /api/notifications/telegram — save config or send test message
export async function POST(req: NextRequest) {
  const { companyId } = await getSupabaseAndCompany()
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const client = db()

  // ── Test action: send a test message ───────────────────────────────────
  if (body.action === 'test') {
    // Try to get credentials from DB first
    const { data: channel } = await client
      .from('notification_channels')
      .select('config')
      .eq('company_id', companyId)
      .eq('channel_type', 'telegram')
      .single()

    const config = channel?.config as { bot_token?: string; chat_id?: string } | null
    const botToken = config?.bot_token
    const chatId = config?.chat_id

    if (!botToken || !chatId) {
      return NextResponse.json({ error: 'Telegram not configured. Save your bot token and chat ID first.' }, { status: 400 })
    }

    // First validate the bot token
    try {
      const meRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`, {
        signal: AbortSignal.timeout(8000),
      })
      const meData = await meRes.json()
      if (!meData.ok) {
        return NextResponse.json({ error: `Invalid bot token: ${meData.description}` }, { status: 400 })
      }
    } catch {
      return NextResponse.json({ error: 'Could not reach Telegram API — check your bot token' }, { status: 500 })
    }

    // Send test message
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: '✅ *IncursYIA connected successfully!*\n\nYou will receive notifications here when your AI agents complete tasks, encounter errors, or generate reports.',
            parse_mode: 'Markdown',
          }),
          signal: AbortSignal.timeout(10000),
        }
      )

      const result = await res.json()
      if (!result.ok) {
        if (result.description?.includes('chat not found')) {
          return NextResponse.json({ error: 'Chat ID not found. Make sure you sent /start to the bot first, or check the chat ID.' }, { status: 400 })
        }
        return NextResponse.json({ error: `Telegram error: ${result.description}` }, { status: 400 })
      }

      return NextResponse.json({ ok: true, message: 'Test message sent successfully' })
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Failed to send test message' },
        { status: 500 }
      )
    }
  }

  // ── Save/update Telegram config ────────────────────────────────────────
  const { bot_token, chat_id, events } = body
  if (!bot_token || !chat_id) {
    return NextResponse.json({ error: 'Missing bot_token or chat_id' }, { status: 400 })
  }

  // Validate bot token before saving
  try {
    const meRes = await fetch(`https://api.telegram.org/bot${bot_token}/getMe`, {
      signal: AbortSignal.timeout(8000),
    })
    const meData = await meRes.json()
    if (!meData.ok) {
      return NextResponse.json({ error: `Invalid bot token: ${meData.description}` }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Could not validate bot token — check the format' }, { status: 400 })
  }

  const { data, error } = await client
    .from('notification_channels')
    .upsert(
      {
        company_id: companyId,
        channel_type: 'telegram',
        config: { bot_token, chat_id },
        events: events ?? {},
        enabled: true,
      },
      { onConflict: 'company_id,channel_type' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id })
}
