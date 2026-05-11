'use client'
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export interface CompanyCtx {
  userId: string
  companyId: string
  companyName: string
  conversationId: string | null
}

export function useCompany(): CompanyCtx | null {
  const [ctx, setCtx] = useState<CompanyCtx | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: company } = await supabase
        .from('companies').select('id, name')
        .eq('user_id', user.id).order('created_at').limit(1).single()
      if (!company) return
      const { data: conv } = await supabase
        .from('conversations').select('id')
        .eq('company_id', company.id).order('created_at').limit(1).single()
      setCtx({ userId: user.id, companyId: company.id, companyName: company.name, conversationId: conv?.id ?? null })
    })
  }, [])

  return ctx
}
