import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(url, key)

export interface PlatformStats {
  revenue_eur: number
  companies: number
  ad_campaigns: number
  tasks_done: number
  updated_at: string
}
