import { NextRequest, NextResponse } from 'next/server'
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

// ─── Twitter via OAuth 1.0a ───────────────────────────────────────────────────
async function postToTwitter(text: string, creds: Record<string, string>) {
  const { api_key, api_secret, access_token, access_token_secret } = creds
  if (!api_key || !api_secret || !access_token || !access_token_secret) {
    return { error: 'Missing Twitter credentials', needs_setup: true }
  }

  const method = 'POST'
  const url = 'https://api.twitter.com/2/tweets'
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonce = Math.random().toString(36).slice(2)

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: api_key, oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1', oauth_timestamp: timestamp,
    oauth_token: access_token, oauth_version: '1.0',
  }

  const paramStr = Object.keys(oauthParams).sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(oauthParams[k])}`).join('&')
  const baseStr = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(paramStr)}`
  const signingKey = `${encodeURIComponent(api_secret)}&${encodeURIComponent(access_token_secret)}`

  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(signingKey), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(baseStr))
  oauthParams.oauth_signature = btoa(String.fromCharCode(...new Uint8Array(sig)))

  const authHeader = 'OAuth ' + Object.keys(oauthParams).sort()
    .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`) .join(', ')

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  const data = await res.json()
  if (!res.ok) return { error: data.detail ?? data.title ?? JSON.stringify(data) }
  return { id: data.data?.id }
}

// ─── LinkedIn ─────────────────────────────────────────────────────────────────
async function postToLinkedIn(text: string, creds: Record<string, string>) {
  const { access_token, author_id } = creds
  if (!access_token || !author_id) return { error: 'Missing LinkedIn credentials', needs_setup: true }

  const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json', 'X-Restli-Protocol-Version': '2.0.0' },
    body: JSON.stringify({
      author: author_id,
      lifecycleState: 'PUBLISHED',
      specificContent: { 'com.linkedin.ugc.ShareContent': { shareCommentary: { text }, shareMediaCategory: 'NONE' } },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }),
  })
  const data = await res.json()
  if (!res.ok) return { error: data.message ?? JSON.stringify(data) }
  return { id: data.id }
}

// ─── TikTok Content Posting API v2 ───────────────────────────────────────────
async function postToTikTok(text: string, videoUrl: string | undefined, creds: Record<string, string>) {
  const { access_token } = creds
  if (!access_token) return { error: 'Missing TikTok access token', needs_setup: true }

  // Text-only post (photo post mode with caption)
  // For video: requires a video URL or upload
  const body: Record<string, unknown> = {
    post_info: {
      title: text.slice(0, 150),
      privacy_level: 'PUBLIC_TO_EVERYONE',
      disable_duet: false,
      disable_comment: false,
      disable_stitch: false,
    },
    source_info: videoUrl
      ? { source: 'PULL_FROM_URL', video_url: videoUrl }
      : { source: 'PULL_FROM_URL', video_url: '' }, // placeholder — TikTok requires video
  }

  // TikTok requires a video — if no video URL, use the Direct Post API with a caption note
  if (!videoUrl) {
    return { error: 'TikTok requires a video URL. Add a video_url to your post.', needs_video: true }
  }

  const res = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method: 'POST',
    headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok || data.error?.code !== 'ok') return { error: data.error?.message ?? JSON.stringify(data) }
  return { id: data.data?.publish_id }
}

// ─── Meta (Facebook / Instagram) ─────────────────────────────────────────────
async function postToMeta(platform: string, text: string, creds: Record<string, string>) {
  const { access_token, page_id } = creds
  if (!access_token || !page_id) return { error: `Missing Meta credentials (access_token + page_id)`, needs_setup: true }

  const url = platform === 'instagram'
    ? `https://graph.facebook.com/v18.0/${page_id}/media`
    : `https://graph.facebook.com/v18.0/${page_id}/feed`

  const body = platform === 'instagram'
    ? { caption: text, access_token }
    : { message: text, access_token }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok || data.error) return { error: data.error?.message ?? JSON.stringify(data) }
  return { id: data.id ?? data.creation_id }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { platform, content, video_url, company_id } = await req.json()
  if (!content) return NextResponse.json({ error: 'No content' }, { status: 400 })

  let companyId = company_id
  if (!companyId) {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    companyId = await getCompanyIdForUser(userId)
  }
  if (!companyId) return NextResponse.json({ error: 'No company found' }, { status: 404 })

  const serviceName = ['facebook', 'instagram'].includes(platform) ? 'meta' : platform
  const creds = await getCredentials(companyId, serviceName)

  let result: { id?: string; error?: string; needs_setup?: boolean; needs_video?: boolean }

  if (platform === 'twitter') result = await postToTwitter(content, creds)
  else if (platform === 'linkedin') result = await postToLinkedIn(content, creds)
  else if (platform === 'tiktok') result = await postToTikTok(content, video_url, creds)
  else if (platform === 'facebook' || platform === 'instagram') result = await postToMeta(platform, content, creds)
  else result = { error: `Unsupported platform: ${platform}`, needs_setup: true }

  if (result.error) return NextResponse.json({ ok: false, ...result }, { status: result.needs_setup ? 503 : 400 })
  return NextResponse.json({ ok: true, external_id: result.id })
}
