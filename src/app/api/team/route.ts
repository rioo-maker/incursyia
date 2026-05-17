import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

async function getSupabaseAndUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

async function getCompanyId(supabase: any, userId: string, companyId?: string) {
  // If companyId is provided, verify user owns it
  if (companyId) {
    const { data } = await supabase
      .from('companies').select('id').eq('id', companyId).eq('user_id', userId).single()
    return data?.id ?? null
  }
  // Otherwise get from localStorage-selected or first company
  const { data } = await supabase
    .from('companies').select('id').eq('user_id', userId).order('created_at').limit(1).single()
  return data?.id ?? null
}

// GET /api/team — list team members for the user's company
export async function GET(req: NextRequest) {
  const { supabase, user } = await getSupabaseAndUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = req.nextUrl.searchParams.get('company_id')
  const resolvedCompanyId = await getCompanyId(supabase, user.id, companyId ?? undefined)
  if (!resolvedCompanyId) return NextResponse.json({ error: 'No company found' }, { status: 404 })

  const client = db()

  // Get team members
  const { data: members, error } = await client
    .from('team_members')
    .select('*')
    .eq('company_id', resolvedCompanyId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get pending invitations for this company
  const { data: invitations } = await client
    .from('team_invitations')
    .select('*')
    .eq('company_id', resolvedCompanyId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  return NextResponse.json({ members: members ?? [], invitations: invitations ?? [] })
}

// POST /api/team — invite a new team member (in-app only, no email)
export async function POST(req: NextRequest) {
  const { supabase, user } = await getSupabaseAndUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { email, role, company_id } = await req.json()
  if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 })

  const resolvedCompanyId = await getCompanyId(supabase, user.id, company_id)
  if (!resolvedCompanyId) return NextResponse.json({ error: 'No company found' }, { status: 404 })

  const client = db()

  // Get company name
  const { data: company } = await client.from('companies').select('name').eq('id', resolvedCompanyId).single()
  const companyName = company?.name ?? 'a company'

  // Check if invitation already exists and is pending
  const { data: existing } = await client
    .from('team_invitations')
    .select('id')
    .eq('company_id', resolvedCompanyId)
    .eq('email', email.trim())
    .eq('status', 'pending')
    .limit(1)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'An invitation is already pending for this email' }, { status: 409 })
  }

  // Create the invitation
  const { data: invitation, error } = await client
    .from('team_invitations')
    .insert({
      company_id: resolvedCompanyId,
      email: email.trim(),
      role: role ?? 'member',
      invited_by: user.id,
      status: 'pending',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Check if the invited user already has an account
  const { data: invitedUsers } = await client.auth.admin.listUsers()
  const invitedUser = invitedUsers?.users?.find(
    (u: any) => u.email?.toLowerCase() === email.trim().toLowerCase()
  )

  // If they exist, create an in-app notification
  if (invitedUser) {
    await client
      .from('in_app_notifications')
      .insert({
        user_id: invitedUser.id,
        type: 'team_invite',
        title: `Invitation to join ${companyName}`,
        body: `You've been invited to join ${companyName} as ${role ?? 'member'}`,
        metadata: {
          invitation_id: invitation.id,
          company_id: resolvedCompanyId,
          company_name: companyName,
          role: role ?? 'member',
        },
      })
  }

  return NextResponse.json({ ...invitation, user_exists: !!invitedUser })
}

// PATCH /api/team — accept or decline an invitation
export async function PATCH(req: NextRequest) {
  const { user } = await getSupabaseAndUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { invitation_id, action } = await req.json()
  if (!invitation_id || !['accept', 'decline'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const client = db()

  // Fetch the invitation and verify it belongs to this user's email
  const { data: invitation } = await client
    .from('team_invitations')
    .select('*')
    .eq('id', invitation_id)
    .eq('email', user.email)
    .eq('status', 'pending')
    .single()

  if (!invitation) {
    return NextResponse.json({ error: 'Invitation not found or already processed' }, { status: 404 })
  }

  if (action === 'accept') {
    // Create team_members row
    const { error: memberErr } = await client
      .from('team_members')
      .insert({
        company_id: invitation.company_id,
        user_id: user.id,
        email: user.email,
        role: invitation.role ?? 'member',
        status: 'active',
        invited_by: invitation.invited_by,
      })

    if (memberErr) return NextResponse.json({ error: memberErr.message }, { status: 500 })

    // Update invitation status
    await client
      .from('team_invitations')
      .update({ status: 'accepted' })
      .eq('id', invitation_id)
  } else {
    // Decline: just update status
    await client
      .from('team_invitations')
      .update({ status: 'declined' })
      .eq('id', invitation_id)
  }

  // Mark related notification as read
  await client
    .from('in_app_notifications')
    .update({ read: true })
    .eq('user_id', user.id)
    .eq('type', 'team_invite')
    .filter('metadata->>invitation_id', 'eq', invitation_id)

  return NextResponse.json({ success: true, action })
}
