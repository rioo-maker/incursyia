import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { getCredentials } from '@/lib/integrations'

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
  if (!user) return { supabase, companyId: null, userId: null }

  const { data } = await supabase
    .from('companies').select('id').eq('user_id', user.id).order('created_at').limit(1).single()
  return { supabase, companyId: data?.id ?? null, userId: user.id }
}

// GET /api/team — list team members for the user's company
export async function GET() {
  const { companyId } = await getSupabaseAndCompany()
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await db()
    .from('team_members')
    .select('*, profiles(full_name, email, avatar_url)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/team — invite a new team member
export async function POST(req: NextRequest) {
  const { companyId, userId } = await getSupabaseAndCompany()
  if (!companyId || !userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { email, role } = await req.json()
  if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 })

  const client = db()

  // Get company name for the invite email
  const { data: company } = await client.from('companies').select('name').eq('id', companyId).single()
  const companyName = company?.name ?? 'a company'

  const { data, error } = await client
    .from('team_invitations')
    .insert({
      company_id: companyId,
      email,
      role: role ?? 'member',
      invited_by: userId,
      status: 'pending',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ── Send invite email via Resend (if connected) ────────────────────────
  let emailSent = false
  try {
    const creds = await getCredentials(companyId, 'resend')
    if (creds.api_key) {
      const appUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app-topaz-chi-44.vercel.app')

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${creds.api_key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: creds.from_email || `IncursYIA <noreply@${creds.from_email?.split('@')[1] || 'incursyia.com'}>`,
          to: email,
          subject: `You're invited to join ${companyName} on IncursYIA`,
          html: `
            <div style="font-family:system-ui,sans-serif;max-width:500px;margin:0 auto;padding:40px 20px">
              <h2 style="color:#E8E8ED;margin-bottom:8px">You've been invited!</h2>
              <p style="color:#9CA3AF;line-height:1.6">
                You've been invited to join <strong style="color:#E8E8ED">${companyName}</strong> on IncursYIA as a <strong style="color:#D97757">${role ?? 'member'}</strong>.
              </p>
              <p style="color:#9CA3AF;line-height:1.6">
                IncursYIA is an AI co-founder that helps run your business autonomously.
              </p>
              <a href="${appUrl}/signup" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#D97757;color:#0C0C0C;border-radius:8px;text-decoration:none;font-weight:600">
                Accept Invitation →
              </a>
              <p style="color:#6B7280;font-size:12px;margin-top:24px">
                If you didn't expect this invitation, you can ignore this email.
              </p>
            </div>
          `,
        }),
        signal: AbortSignal.timeout(10000),
      })
      emailSent = res.ok
    }
  } catch {
    // Email sending is best-effort — don't fail the invitation
  }

  return NextResponse.json({ ...data, email_sent: emailSent })
}
