'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useCompany } from '@/lib/useCompany'

interface TeamMember {
  id: string
  email: string
  role: string
  status: string
  created_at: string
  user_id: string | null
}

interface PendingInvitation {
  id: string
  email: string
  role: string
  status: string
  created_at: string
}

interface NotificationChannel {
  id: string
  channel_type: string
  config: Record<string, string>
  events: Record<string, boolean>
  enabled: boolean
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, ...style }}>
      {children}
    </div>
  )
}

const ROLES = ['admin', 'editor', 'viewer']

const ROLE_COLOR: Record<string, string> = {
  owner: '#FCD34D', admin: 'var(--accent)', editor: '#93C5FD', viewer: 'var(--text-muted)', member: 'var(--text-muted)',
}

const STATUS_COLOR: Record<string, { color: string; bg: string }> = {
  active: { color: '#6EE7A0', bg: 'rgba(110,231,160,.1)' },
  pending: { color: '#FCD34D', bg: 'rgba(252,211,77,.1)' },
  declined: { color: '#F87171', bg: 'rgba(248,113,113,.1)' },
}

const EVENTS = [
  { key: 'task_completed', label: 'Task completed', desc: 'When an agent finishes a task' },
  { key: 'agent_error', label: 'Agent error', desc: 'When an agent encounters an error' },
  { key: 'deploy_success', label: 'Deploy success', desc: 'When a deployment completes' },
  { key: 'weekly_report', label: 'Weekly report', desc: 'When a new CEO report is generated' },
]

interface PlanInfo {
  plan: string
  plan_expires_at: string | null
  days_remaining: number | null
  tasks_used: number
  chat_used: number
}

export default function SettingsPage() {
  const company = useCompany()
  const [tab, setTab] = useState<'team' | 'notifications' | 'plan'>('team')

  // Plan state
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null)
  const [licenseKey, setLicenseKey] = useState('')
  const [activating, setActivating] = useState(false)
  const [planMessage, setPlanMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Team state
  const [members, setMembers] = useState<TeamMember[]>([])
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([])
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('editor')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')

  // Notification state
  const [notifChannel, setNotifChannel] = useState<NotificationChannel | null>(null)
  const [botToken, setBotToken] = useState('')
  const [chatId, setChatId] = useState('')
  const [events, setEvents] = useState<Record<string, boolean>>({
    task_completed: true,
    agent_error: true,
    deploy_success: false,
    weekly_report: true,
  })
  const [savingNotif, setSavingNotif] = useState(false)
  const [savedNotif, setSavedNotif] = useState(false)
  const [testingTelegram, setTestingTelegram] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  // Load team members & pending invitations via API
  const loadTeam = async () => {
    if (!company) return
    try {
      const res = await fetch(`/api/team?company_id=${company.companyId}`)
      if (res.ok) {
        const data = await res.json()
        setMembers(data.members ?? [])
        setPendingInvitations(data.invitations ?? [])
      }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (!company) return
    loadTeam()
    const sub = supabase.channel('team_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_members', filter: `company_id=eq.${company.companyId}` }, loadTeam)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_invitations', filter: `company_id=eq.${company.companyId}` }, loadTeam)
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [company])

  // Load notification channel
  useEffect(() => {
    if (!company) return
    supabase.from('notification_channels').select('*')
      .eq('company_id', company.companyId)
      .eq('channel_type', 'telegram')
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) {
          const ch = data as NotificationChannel
          setNotifChannel(ch)
          setBotToken(ch.config?.bot_token ?? '')
          setChatId(ch.config?.chat_id ?? '')
          setEvents(ch.events ?? {
            task_completed: true,
            agent_error: true,
            deploy_success: false,
            weekly_report: true,
          })
        }
      })
  }, [company])

  // Load plan info
  const loadPlanInfo = async () => {
    try {
      const res = await fetch('/api/license')
      if (res.ok) {
        const data = await res.json()
        setPlanInfo(data)
      }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    loadPlanInfo()
  }, [])

  const activateLicense = async () => {
    if (!licenseKey.trim()) return
    setActivating(true)
    setPlanMessage(null)
    try {
      const res = await fetch('/api/license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: licenseKey.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setPlanMessage({ type: 'success', text: `Pro plan activated! Expires ${new Date(data.expires_at).toLocaleDateString()}.` })
        setLicenseKey('')
        loadPlanInfo()
      } else {
        setPlanMessage({ type: 'error', text: data.error ?? 'Activation failed' })
      }
    } catch {
      setPlanMessage({ type: 'error', text: 'Network error' })
    }
    setActivating(false)
  }

  const inviteMember = async () => {
    if (!company || !inviteEmail.trim()) return
    setInviting(true)
    setInviteError('')

    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
          company_id: company.companyId,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setInviteError(data.error ?? 'Failed to send invitation')
      } else {
        setInviteEmail('')
        setInviteRole('editor')
        setShowInvite(false)
        loadTeam()
      }
    } catch {
      setInviteError('Network error')
    }

    setInviting(false)
  }

  const removeMember = async (id: string) => {
    if (!company) return
    await supabase.from('team_members').delete().eq('id', id)
    loadTeam()
  }

  const saveNotifications = async () => {
    if (!company) return
    setSavingNotif(true)
    const payload = {
      company_id: company.companyId,
      channel_type: 'telegram',
      config: { bot_token: botToken, chat_id: chatId },
      events,
      enabled: true,
    }
    if (notifChannel) {
      await supabase.from('notification_channels').update(payload).eq('id', notifChannel.id)
    } else {
      await supabase.from('notification_channels').insert(payload)
    }
    setSavingNotif(false)
    setSavedNotif(true)
    setTimeout(() => setSavedNotif(false), 2000)
    // Refresh
    const { data } = await supabase.from('notification_channels').select('*')
      .eq('company_id', company.companyId)
      .eq('channel_type', 'telegram')
      .limit(1)
      .single()
    if (data) setNotifChannel(data as NotificationChannel)
  }

  const testTelegram = async () => {
    if (!botToken || !chatId) {
      setTestResult('Please fill in both bot token and chat ID')
      return
    }
    setTestingTelegram(true)
    setTestResult(null)
    try {
      // First save the config, then test via our API (avoids CORS issues)
      await saveNotifications()
      const res = await fetch('/api/notifications/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test' }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setTestResult('Test message sent successfully!')
      } else {
        setTestResult(`Error: ${data.error ?? 'Unknown error'}`)
      }
    } catch {
      setTestResult('Failed to connect to Telegram')
    }
    setTestingTelegram(false)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px',
    background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)',
    borderRadius: 8, color: 'var(--text-primary)',
    fontFamily: 'var(--font-body)', fontSize: 13, outline: 'none',
  }

  return (
    <div style={{ padding: '32px 36px', maxWidth: 800 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 28, color: 'var(--text-primary)', marginBottom: 4 }}>
          Settings
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)' }}>
          {company ? `${company.companyName} workspace settings` : 'Manage your workspace'}
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {(['team', 'notifications', 'plan'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '7px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-body)', fontSize: 12, textTransform: 'capitalize',
              background: tab === t ? 'var(--accent-subtle)' : 'rgba(255,255,255,.04)',
              color: tab === t ? 'var(--accent)' : 'var(--text-muted)',
              fontWeight: tab === t ? 600 : 400,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* TEAM TAB */}
      {tab === 'team' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Active Members */}
          <Card>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Team Members</span>
              <button
                onClick={() => setShowInvite(true)}
                style={{
                  padding: '6px 14px', background: 'var(--accent)', border: 'none', borderRadius: 6,
                  color: '#0C0C0C', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Invite
              </button>
            </div>

            {/* Invite form */}
            {showInvite && (
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-deep)' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                      Email
                    </label>
                    <input
                      type="email"
                      placeholder="teammate@company.com"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ width: 130 }}>
                    <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                      Role
                    </label>
                    <select
                      value={inviteRole}
                      onChange={e => setInviteRole(e.target.value)}
                      style={inputStyle}
                    >
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <button
                    onClick={inviteMember}
                    disabled={inviting || !inviteEmail.trim()}
                    style={{
                      padding: '10px 18px', background: inviting ? 'rgba(217,119,87,.4)' : 'var(--accent)',
                      border: 'none', borderRadius: 8, color: '#0C0C0C',
                      fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {inviting ? '...' : 'Send Invite'}
                  </button>
                  <button
                    onClick={() => { setShowInvite(false); setInviteError('') }}
                    style={{
                      padding: '10px 14px', background: 'transparent',
                      border: '1px solid var(--border-subtle)', borderRadius: 8,
                      color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: 13, cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
                {inviteError && (
                  <div style={{
                    marginTop: 8, padding: '8px 12px',
                    background: 'rgba(248,113,113,.08)', border: '1px solid rgba(248,113,113,.2)',
                    borderRadius: 6, fontFamily: 'var(--font-body)', fontSize: 12, color: '#F87171',
                  }}>
                    {inviteError}
                  </div>
                )}
              </div>
            )}

            {/* Members list */}
            <div style={{ padding: '8px 0' }}>
              {members.length === 0 && pendingInvitations.length === 0 ? (
                <div style={{ padding: '20px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                  No team members yet -- invite your first teammate
                </div>
              ) : (
                <>
                  {/* Active members */}
                  {members.map(m => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: 'rgba(217,119,87,.15)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--accent)',
                      }}>
                        {(m.email ?? '?').charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-primary)' }}>
                          {m.email ?? 'Team member'}
                        </div>
                        <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)' }}>
                          Joined {new Date(m.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <span style={{
                        fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600,
                        color: ROLE_COLOR[m.role] ?? 'var(--text-muted)',
                        background: 'rgba(255,255,255,.04)', padding: '3px 10px', borderRadius: 20,
                        textTransform: 'capitalize',
                      }}>
                        {m.role}
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600,
                        color: STATUS_COLOR[m.status]?.color ?? 'var(--text-muted)',
                        background: STATUS_COLOR[m.status]?.bg ?? 'rgba(255,255,255,.04)',
                        padding: '3px 10px', borderRadius: 20,
                        textTransform: 'capitalize',
                      }}>
                        {m.status}
                      </span>
                      <button
                        onClick={() => removeMember(m.id)}
                        style={{
                          padding: '4px 10px', background: 'transparent',
                          border: '1px solid var(--border-subtle)', borderRadius: 6,
                          color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: 11, cursor: 'pointer',
                        }}
                      >
                        {'✕'}
                      </button>
                    </div>
                  ))}

                  {/* Pending invitations */}
                  {pendingInvitations.map(inv => (
                    <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)', opacity: 0.7 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: 'rgba(252,211,77,.1)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: '#FCD34D',
                      }}>
                        {inv.email.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-primary)' }}>
                          {inv.email}
                        </div>
                        <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)' }}>
                          Invited {new Date(inv.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <span style={{
                        fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600,
                        color: ROLE_COLOR[inv.role] ?? 'var(--text-muted)',
                        background: 'rgba(255,255,255,.04)', padding: '3px 10px', borderRadius: 20,
                        textTransform: 'capitalize',
                      }}>
                        {inv.role}
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600,
                        color: '#FCD34D', background: 'rgba(252,211,77,.1)',
                        padding: '3px 10px', borderRadius: 20,
                      }}>
                        Pending
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* PLAN TAB */}
      {tab === 'plan' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Current Plan */}
          <Card>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Current Plan</span>
              <span style={{
                padding: '3px 12px', borderRadius: 20,
                fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em',
                background: planInfo?.plan === 'pro' ? 'rgba(217,119,87,.15)' : 'rgba(255,255,255,.06)',
                color: planInfo?.plan === 'pro' ? 'var(--accent)' : 'var(--text-muted)',
              }}>
                {planInfo?.plan === 'pro' ? 'Pro' : 'Free'}
              </span>
            </div>
            <div style={{ padding: '20px' }}>
              {planInfo?.plan === 'pro' && planInfo.plan_expires_at && (
                <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(217,119,87,.06)', border: '1px solid rgba(217,119,87,.15)', borderRadius: 8 }}>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-secondary)' }}>
                    Expires: {new Date(planInfo.plan_expires_at).toLocaleDateString()}
                  </div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {planInfo.days_remaining} day{planInfo.days_remaining !== 1 ? 's' : ''} remaining
                  </div>
                </div>
              )}

              {/* Usage stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div style={{ padding: '14px 16px', background: 'var(--bg-deep)', borderRadius: 8 }}>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 }}>Tasks this month</div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {planInfo?.tasks_used ?? 0}/{planInfo?.plan === 'pro' ? 30 : 5}
                  </div>
                  <div style={{
                    marginTop: 6, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.06)', overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%', borderRadius: 2, background: 'var(--accent)',
                      width: `${Math.min(100, ((planInfo?.tasks_used ?? 0) / (planInfo?.plan === 'pro' ? 30 : 5)) * 100)}%`,
                      transition: 'width .3s',
                    }} />
                  </div>
                </div>
                <div style={{ padding: '14px 16px', background: 'var(--bg-deep)', borderRadius: 8 }}>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 }}>Chat today</div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {planInfo?.chat_used ?? 0}/{planInfo?.plan === 'pro' ? 100 : 10}
                  </div>
                  <div style={{
                    marginTop: 6, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.06)', overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%', borderRadius: 2, background: '#93C5FD',
                      width: `${Math.min(100, ((planInfo?.chat_used ?? 0) / (planInfo?.plan === 'pro' ? 100 : 10)) * 100)}%`,
                      transition: 'width .3s',
                    }} />
                  </div>
                </div>
              </div>

              {/* License key input */}
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 20 }}>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  Activate License Key
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    type="text"
                    placeholder="INCY-XXXX-XXXX-XXXX"
                    value={licenseKey}
                    onChange={e => setLicenseKey(e.target.value.toUpperCase())}
                    maxLength={19}
                    style={{
                      ...inputStyle,
                      flex: 1,
                      fontFamily: 'monospace',
                      letterSpacing: '.08em',
                      fontSize: 14,
                    }}
                  />
                  <button
                    onClick={activateLicense}
                    disabled={activating || !licenseKey.trim()}
                    style={{
                      padding: '10px 20px',
                      background: activating ? 'rgba(217,119,87,.4)' : 'var(--accent)',
                      border: 'none', borderRadius: 8, color: '#0C0C0C',
                      fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {activating ? 'Activating...' : 'Activate Key'}
                  </button>
                </div>
                {planMessage && (
                  <div style={{
                    marginTop: 10, padding: '8px 12px', borderRadius: 6,
                    fontFamily: 'var(--font-body)', fontSize: 12,
                    background: planMessage.type === 'success' ? 'rgba(110,231,160,.08)' : 'rgba(248,113,113,.08)',
                    border: `1px solid ${planMessage.type === 'success' ? 'rgba(110,231,160,.2)' : 'rgba(248,113,113,.2)'}`,
                    color: planMessage.type === 'success' ? '#6EE7A0' : '#F87171',
                  }}>
                    {planMessage.text}
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Plan comparison */}
          <Card>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Plan Details</span>
            </div>
            <div style={{ padding: '8px 0' }}>
              {[
                { label: 'Tasks / month', free: '5', pro: '30' },
                { label: 'Chat messages / day', free: '10', pro: '100' },
                { label: 'Companies', free: '1', pro: '3' },
                { label: 'Team members', free: '0', pro: '3' },
                { label: 'CEO Reports / month', free: '--', pro: '4' },
                { label: 'Telegram notifications', free: '--', pro: 'Yes' },
                { label: 'Marketplace skills', free: '--', pro: 'Unlimited' },
              ].map(row => (
                <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', padding: '10px 20px', borderBottom: '1px solid var(--border-subtle)', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-secondary)' }}>{row.label}</span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>{row.free}</span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--accent)', textAlign: 'center', fontWeight: 600 }}>{row.pro}</span>
                </div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', padding: '10px 20px', alignItems: 'center' }}>
                <span />
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>Free</span>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--accent)', textAlign: 'center', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>Pro</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* NOTIFICATIONS TAB */}
      {tab === 'notifications' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Telegram setup */}
          <Card>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Telegram Notifications</span>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                    Bot Token
                  </label>
                  <input
                    type="password"
                    placeholder="123456:ABC-DEF..."
                    value={botToken}
                    onChange={e => setBotToken(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                    Chat ID
                  </label>
                  <input
                    type="text"
                    placeholder="-1001234567890"
                    value={chatId}
                    onChange={e => setChatId(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={testTelegram}
                    disabled={testingTelegram}
                    style={{
                      padding: '8px 16px', background: 'transparent',
                      border: '1px solid var(--border-subtle)', borderRadius: 7,
                      color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', fontSize: 12, cursor: 'pointer',
                    }}
                  >
                    {testingTelegram ? 'Sending...' : 'Test Connection'}
                  </button>
                  {testResult && (
                    <span style={{
                      fontFamily: 'var(--font-body)', fontSize: 12,
                      color: testResult.includes('success') ? '#6EE7A0' : '#F87171',
                      alignSelf: 'center',
                    }}>
                      {testResult}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ margin: '20px 0 8px', padding: '10px 14px', background: 'var(--bg-deep)', borderRadius: 8 }}>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--accent)', fontWeight: 600, marginBottom: 6, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  How to set up
                </div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                  1. Message @BotFather on Telegram and create a new bot<br />
                  2. Copy the bot token you receive<br />
                  3. Add the bot to your group or start a chat with it<br />
                  4. Get your chat ID from @userinfobot
                </div>
              </div>
            </div>
          </Card>

          {/* Event toggles */}
          <Card>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Event Notifications</span>
            </div>
            <div style={{ padding: '8px 0' }}>
              {EVENTS.map(ev => (
                <div key={ev.key} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-primary)', marginBottom: 2 }}>
                      {ev.label}
                    </div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)' }}>
                      {ev.desc}
                    </div>
                  </div>
                  <button
                    onClick={() => setEvents(prev => ({ ...prev, [ev.key]: !prev[ev.key] }))}
                    style={{
                      width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                      background: events[ev.key] ? 'var(--accent)' : 'rgba(255,255,255,.08)',
                      position: 'relative', transition: 'background .2s',
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%', background: '#fff',
                      position: 'absolute', top: 3,
                      left: events[ev.key] ? 23 : 3,
                      transition: 'left .2s',
                    }} />
                  </button>
                </div>
              ))}
            </div>
          </Card>

          {/* Save button */}
          <div>
            <button
              onClick={saveNotifications}
              disabled={savingNotif}
              style={{
                padding: '10px 24px',
                background: savingNotif ? 'rgba(217,119,87,.4)' : 'var(--accent)',
                border: 'none', borderRadius: 8, color: '#0C0C0C',
                fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {savedNotif ? 'Saved!' : savingNotif ? 'Saving...' : 'Save Notification Settings'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
