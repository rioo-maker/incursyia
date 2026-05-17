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

async function getUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// GET /api/invitations — fetch pending invitations for the authenticated user
export async function GET() {
  const user = await getUser()
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const client = db()

  const { data, error } = await client
    .from('team_invitations')
    .select('id, email, role, status, created_at, company_id, invited_by, companies(id, name)')
    .eq('email', user.email)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enrich with inviter info
  const enriched = await Promise.all(
    (data ?? []).map(async (inv: any) => {
      let inviterName = 'Unknown'
      if (inv.invited_by) {
        const { data: profile } = await client
          .from('profiles')
          .select('full_name, email')
          .eq('id', inv.invited_by)
          .single()
        inviterName = profile?.full_name ?? profile?.email ?? 'Unknown'
      }
      return {
        id: inv.id,
        company_name: inv.companies?.name ?? 'Unknown',
        company_id: inv.company_id,
        role: inv.role ?? 'member',
        invited_by_email: inviterName,
        created_at: inv.created_at,
      }
    })
  )

  return NextResponse.json(enriched)
}

// POST /api/invitations — accept or decline an invitation
export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { action, invitation_id } = await req.json()
  if (!invitation_id || !['accept', 'decline'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request. Need action (accept/decline) and invitation_id' }, { status: 400 })
  }

  const client = db()

  // Fetch and verify the invitation
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
    // Check if user is already a member
    const { data: existingMember } = await client
      .from('team_members')
      .select('id')
      .eq('company_id', invitation.company_id)
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (!existingMember) {
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
    }

    // Update invitation status
    await client
      .from('team_invitations')
      .update({ status: 'accepted' })
      .eq('id', invitation_id)
  } else {
    // Decline
    await client
      .from('team_invitations')
      .update({ status: 'declined' })
      .eq('id', invitation_id)
  }

  // Mark related notifications as read
  await client
    .from('in_app_notifications')
    .update({ read: true })
    .eq('user_id', user.id)
    .eq('type', 'team_invite')
    .filter('metadata->>invitation_id', 'eq', invitation_id)

  return NextResponse.json({ success: true, action })
}
