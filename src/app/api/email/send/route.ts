import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getCredentials, getCompanyIdForUser } from '@/lib/integrations'

async function getUserId(): Promise<string | null> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

export async function POST(req: NextRequest) {
  const { to, subject, body, from_name, company_id } = await req.json()
  if (!to || !subject || !body) {
    return NextResponse.json({ error: 'Missing to, subject, or body' }, { status: 400 })
  }

  // Get company ID — from body (agent calls) or from auth session (user calls)
  let companyId = company_id
  if (!companyId) {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    companyId = await getCompanyIdForUser(userId)
  }
  if (!companyId) return NextResponse.json({ error: 'No company found' }, { status: 404 })

  // Get user's own Resend credentials
  const creds = await getCredentials(companyId, 'resend')
  const apiKey = creds.api_key ?? process.env.RESEND_API_KEY // fallback to platform key if set

  if (!apiKey) {
    return NextResponse.json({ error: 'Resend not configured', needs_setup: true }, { status: 503 })
  }

  const fromAddr = creds.from_email ?? process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'
  const fromLabel = from_name ? `${from_name} <${fromAddr}>` : fromAddr

  try {
    const resend = new Resend(apiKey)
    const { data, error } = await resend.emails.send({
      from: fromLabel,
      to: Array.isArray(to) ? to : [to],
      subject,
      html: body.replace(/\n/g, '<br>'),
      text: body,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, id: data?.id })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
