import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

/**
 * Fetch stored credentials for a service + company.
 * Uses a SECURITY DEFINER RPC to bypass RLS — works even without service_role key.
 */
export async function getCredentials(companyId: string, service: string): Promise<Record<string, string>> {
  const { data } = await db().rpc('get_integration_credentials', {
    p_company_id: companyId,
    p_service: service,
  })
  return (data as Record<string, string>) ?? {}
}

/**
 * Fetch all connected service names for a company.
 * Uses a SECURITY DEFINER RPC to bypass RLS.
 */
export async function getCompanyIntegrations(companyId: string): Promise<string[]> {
  const { data } = await db().rpc('get_company_integrations', {
    p_company_id: companyId,
  })
  return (data as { service: string }[] ?? []).map(r => r.service)
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
