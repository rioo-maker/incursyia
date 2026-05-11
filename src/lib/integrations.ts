import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

/**
 * Fetch stored credentials for a service + company.
 * Used inside API routes (server-side only).
 */
export async function getCredentials(companyId: string, service: string): Promise<Record<string, string>> {
  const { data } = await db()
    .from('integrations')
    .select('credentials')
    .eq('company_id', companyId)
    .eq('service', service)
    .single()
  return (data?.credentials as Record<string, string>) ?? {}
}

/**
 * Fetch the company ID for a given user ID.
 */
export async function getCompanyIdForUser(userId: string): Promise<string | null> {
  const { data } = await db()
    .from('companies')
    .select('id')
    .eq('user_id', userId)
    .order('created_at')
    .limit(1)
    .single()
  return data?.id ?? null
}
