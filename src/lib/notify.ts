import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

interface TelegramConfig {
  bot_token: string
  chat_id: string
}

/**
 * Get Telegram config for a company (if configured and enabled).
 */
async function getTelegramConfig(companyId: string): Promise<TelegramConfig | null> {
  const { data } = await db()
    .from('notification_channels')
    .select('config, enabled')
    .eq('company_id', companyId)
    .eq('channel_type', 'telegram')
    .single()

  if (!data || !data.enabled) return null
  const config = data.config as { bot_token?: string; chat_id?: string } | null
  if (!config?.bot_token || !config?.chat_id) return null
  return { bot_token: config.bot_token, chat_id: config.chat_id }
}

/**
 * Send a Telegram message to a company's configured bot.
 * Silently fails (logs to console) — notifications should never break task execution.
 */
async function sendTelegram(config: TelegramConfig, text: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${config.bot_token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.chat_id,
        text,
        parse_mode: 'Markdown',
      }),
      signal: AbortSignal.timeout(10000),
    })
    const data = await res.json()
    if (!data.ok) {
      console.warn('[Telegram] Send failed:', data.description)
      return false
    }
    return true
  } catch (err) {
    console.warn('[Telegram] Network error:', err)
    return false
  }
}

// ─── Public notification functions ───────────────────────────────────────────

/**
 * Notify when an agent task is completed successfully.
 */
export async function notifyTaskCompleted(
  companyId: string,
  taskTitle: string,
  agentType: string,
  actionsExecuted: number
): Promise<void> {
  const config = await getTelegramConfig(companyId)
  if (!config) return

  const actions = actionsExecuted > 0 ? `\n📋 ${actionsExecuted} action(s) executed` : ''
  const text = `✅ *Task completed*\n\n🤖 Agent: ${agentType}\n📝 ${taskTitle}${actions}`
  await sendTelegram(config, text)
}

/**
 * Notify when an agent task fails.
 */
export async function notifyTaskFailed(
  companyId: string,
  taskTitle: string,
  agentType: string,
  error: string
): Promise<void> {
  const config = await getTelegramConfig(companyId)
  if (!config) return

  const shortError = error.length > 200 ? error.substring(0, 200) + '...' : error
  const text = `❌ *Task failed*\n\n🤖 Agent: ${agentType}\n📝 ${taskTitle}\n\n⚠️ Error: ${shortError}`
  await sendTelegram(config, text)
}

/**
 * Notify when a CEO report is generated.
 */
export async function notifyReportGenerated(
  companyId: string,
  reportTitle: string
): Promise<void> {
  const config = await getTelegramConfig(companyId)
  if (!config) return

  const text = `📊 *Weekly CEO Report ready*\n\n${reportTitle}\n\n👉 Check your dashboard for the full report.`
  await sendTelegram(config, text)
}

/**
 * Notify a generic event.
 */
export async function notifyEvent(
  companyId: string,
  emoji: string,
  title: string,
  detail?: string
): Promise<void> {
  const config = await getTelegramConfig(companyId)
  if (!config) return

  const text = `${emoji} *${title}*${detail ? `\n\n${detail}` : ''}`
  await sendTelegram(config, text)
}
