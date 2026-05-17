import { PLAN_CONFIG } from './prompts'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export function getPlanLimits(plan: string) {
  return PLAN_CONFIG[plan as keyof typeof PLAN_CONFIG] ?? PLAN_CONFIG.free
}

export async function getTasksUsedThisMonth(companyId: string): Promise<number> {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { count } = await db()
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .gte('created_at', startOfMonth.toISOString())

  return count ?? 0
}

export async function getChatMessagesToday(userId: string): Promise<number> {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  // Count messages across all conversations for this user's companies
  const { data: companies } = await db()
    .from('companies')
    .select('id')
    .eq('user_id', userId)

  if (!companies?.length) return 0

  const companyIds = companies.map(c => c.id)
  const { data: convs } = await db()
    .from('conversations')
    .select('id')
    .in('company_id', companyIds)

  if (!convs?.length) return 0

  const { count } = await db()
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .in('conversation_id', convs.map(c => c.id))
    .eq('role', 'user')
    .gte('created_at', startOfDay.toISOString())

  return count ?? 0
}

export async function getReportsThisMonth(companyId: string): Promise<number> {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { count } = await db()
    .from('ceo_reports')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .gte('created_at', startOfMonth.toISOString())

  return count ?? 0
}

export async function checkTaskLimit(companyId: string, plan: string): Promise<{ allowed: boolean; used: number; limit: number }> {
  const limits = getPlanLimits(plan)
  const used = await getTasksUsedThisMonth(companyId)
  return { allowed: used < limits.tasks_per_month, used, limit: limits.tasks_per_month }
}

export async function checkChatLimit(userId: string, plan: string): Promise<{ allowed: boolean; used: number; limit: number }> {
  const limits = getPlanLimits(plan)
  const used = await getChatMessagesToday(userId)
  return { allowed: used < limits.chat_per_day, used, limit: limits.chat_per_day }
}
