import { createClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Browser client (for client components)
export const supabase = createBrowserClient(url, anon)

// Server client factory (for server components / API routes)
export function createServerClient() {
  return createClient(url, anon)
}

export interface PlatformStats {
  revenue_eur: number
  companies: number
  ad_campaigns: number
  tasks_done: number
  updated_at: string
}

export interface Profile {
  id: string
  email: string
  full_name: string | null
  country: string | null
  language: string
  plan: 'free' | 'pro'
  plan_expires_at: string | null
  tasks_used_this_month: number
  tasks_reset_at: string
}

export interface Company {
  id: string
  user_id: string
  name: string
  description: string | null
  industry: string | null
  stage: string
}
