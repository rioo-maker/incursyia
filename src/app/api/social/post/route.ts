import { NextRequest, NextResponse } from 'next/server'

// Twitter API v2 — POST /2/tweets
async function postToTwitter(text: string): Promise<{ id?: string; error?: string }> {
  const key = process.env.TWITTER_API_KEY
  const secret = process.env.TWITTER_API_SECRET
  const token = process.env.TWITTER_ACCESS_TOKEN
  const tokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET

  if (!key || !secret || !token || !tokenSecret) {
    return { error: 'Twitter credentials not configured' }
  }

  // OAuth 1.0a signature
  const method = 'POST'
  const url = 'https://api.twitter.com/2/tweets'
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonce = Math.random().toString(36).slice(2)

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: key,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: token,
    oauth_version: '1.0',
  }

  // Build base string
  const paramStr = Object.keys(oauthParams).sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(oauthParams[k])}`)
    .join('&')
  const baseStr = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(paramStr)}`
  const signingKey = `${encodeURIComponent(secret)}&${encodeURIComponent(tokenSecret)}`

  // HMAC-SHA1 via Web Crypto
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(signingKey), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
  const signatureBuffer = await crypto.subtle.sign('HMAC', keyMaterial, new TextEncoder().encode(baseStr))
  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
  oauthParams.oauth_signature = signature

  const authHeader = 'OAuth ' + Object.keys(oauthParams).sort()
    .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
    .join(', ')

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })

  const data = await res.json()
  if (!res.ok) return { error: data.detail ?? data.title ?? JSON.stringify(data) }
  return { id: data.data?.id }
}

// LinkedIn Share API v2
async function postToLinkedIn(text: string): Promise<{ id?: string; error?: string }> {
  const token = process.env.LINKEDIN_ACCESS_TOKEN
  const authorId = process.env.LINKEDIN_AUTHOR_ID // urn:li:person:xxx or urn:li:organization:xxx

  if (!token || !authorId) return { error: 'LinkedIn credentials not configured' }

  const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Restli-Protocol-Version': '2.0.0' },
    body: JSON.stringify({
      author: authorId,
      lifecycleState: 'PUBLISHED',
      specificContent: { 'com.linkedin.ugc.ShareContent': { shareCommentary: { text }, shareMediaCategory: 'NONE' } },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }),
  })

  const data = await res.json()
  if (!res.ok) return { error: data.message ?? JSON.stringify(data) }
  return { id: data.id }
}

export async function POST(req: NextRequest) {
  const { platform, content, postId } = await req.json()
  if (!content) return NextResponse.json({ error: 'No content' }, { status: 400 })

  let result: { id?: string; error?: string } = { error: 'Unsupported platform' }

  if (platform === 'twitter') result = await postToTwitter(content)
  else if (platform === 'linkedin') result = await postToLinkedIn(content)
  else {
    // Instagram & Facebook require Meta Business API — not yet configured
    return NextResponse.json({
      ok: false,
      error: `${platform} posting requires Meta Business API setup. Add META_ACCESS_TOKEN and META_AD_ACCOUNT_ID to env vars.`,
      needs_setup: true,
    })
  }

  if (result.error) return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true, external_id: result.id, postId })
}
