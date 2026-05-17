'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'

export interface CompanyCtx {
  userId: string
  companyId: string
  companyName: string
  conversationId: string | null
}

export interface Company {
  id: string
  name: string
  role: string // 'owner' | 'admin' | 'editor' | 'viewer'
}

export interface Invitation {
  id: string
  company_name: string
  role: string
  invited_by_email: string
}

interface CompaniesResult {
  companies: Company[]
  current: CompanyCtx | null
  switchCompany: (id: string) => void
  invitations: Invitation[]
}

const LS_KEY = 'incursyia_company'

/** Backward-compatible hook: returns current company context */
export function useCompany(): CompanyCtx | null {
  const { current } = useCompanies()
  return current
}

/** Full multi-company hook */
export function useCompanies(): CompaniesResult {
  const [companies, setCompanies] = useState<Company[]>([])
  const [current, setCurrent] = useState<CompanyCtx | null>(null)
  const [invitations, setInvitations] = useState<Invitation[]>([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return

      // 1. Fetch owned companies
      const { data: ownedCompanies } = await supabase
        .from('companies')
        .select('id, name')
        .eq('user_id', user.id)
        .order('created_at')

      const owned: Company[] = (ownedCompanies ?? []).map(c => ({
        id: c.id,
        name: c.name,
        role: 'owner',
      }))

      // 2. Fetch companies where user is a team member
      const { data: memberships } = await supabase
        .from('team_members')
        .select('company_id, role, companies(id, name)')
        .eq('user_id', user.id)
        .eq('status', 'active')

      const memberCompanies: Company[] = (memberships ?? [])
        .filter((m: any) => m.companies)
        .map((m: any) => ({
          id: m.companies.id,
          name: m.companies.name,
          role: m.role ?? 'viewer',
        }))

      // 3. Combine, deduplicate (owned takes priority)
      const ownedIds = new Set(owned.map(c => c.id))
      const all = [...owned, ...memberCompanies.filter(c => !ownedIds.has(c.id))]
      if (cancelled) return
      setCompanies(all)

      // 4. Determine which company to select
      let selectedId: string | null = null
      if (typeof window !== 'undefined') {
        selectedId = localStorage.getItem(LS_KEY)
      }

      // Validate that selectedId is in the list
      const validSelection = selectedId && all.some(c => c.id === selectedId)
      const activeCompany = validSelection
        ? all.find(c => c.id === selectedId)!
        : all[0]

      if (!activeCompany) {
        setCurrent(null)
        return
      }

      // 5. Get conversation for the selected company
      const { data: conv } = await supabase
        .from('conversations')
        .select('id')
        .eq('company_id', activeCompany.id)
        .order('created_at')
        .limit(1)
        .single()

      if (cancelled) return
      setCurrent({
        userId: user.id,
        companyId: activeCompany.id,
        companyName: activeCompany.name,
        conversationId: conv?.id ?? null,
      })

      // 6. Fetch pending invitations for this user's email
      const { data: pendingInvitations } = await supabase
        .from('team_invitations')
        .select('id, role, status, company_id, invited_by, companies(name)')
        .eq('email', user.email)
        .eq('status', 'pending')

      if (cancelled) return

      const invites: Invitation[] = (pendingInvitations ?? []).map((inv: any) => ({
        id: inv.id,
        company_name: inv.companies?.name ?? 'Unknown',
        role: inv.role ?? 'member',
        invited_by_email: '', // We'll keep it simple - the notification has this info
      }))

      setInvitations(invites)
    }

    load()
    return () => { cancelled = true }
  }, [])

  const switchCompany = useCallback((id: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LS_KEY, id)
      window.location.reload()
    }
  }, [])

  return { companies, current, switchCompany, invitations }
}
