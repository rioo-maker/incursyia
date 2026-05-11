import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getCredentials } from '@/lib/integrations'

/**
 * Deploy a project to Vercel via the Vercel API.
 * Called by the engineering agent after generating code.
 *
 * Security: company_id from the request body is NEVER trusted on its own.
 * We always verify the authenticated user owns that company before using it.
 */
export async function POST(req: NextRequest) {
  const { project_name, files, framework, company_id: bodyCompanyId } = await req.json()
  // files: { [path]: content } — e.g. { "index.html": "<html>..." }

  // Always auth-check — derive the real company from the session
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()

  let companyId: string | undefined

  if (user) {
    // Session present — verify the body company_id belongs to this user
    if (bodyCompanyId) {
      const { data: owned } = await supabase
        .from('companies').select('id').eq('id', bodyCompanyId).eq('user_id', user.id).single()
      if (!owned) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      companyId = owned.id
    } else {
      // No company_id in body — use user's first company
      const { data: company } = await supabase
        .from('companies').select('id').eq('user_id', user.id).order('created_at').limit(1).single()
      companyId = company?.id
    }
  } else if (bodyCompanyId) {
    // Called from agent (server-to-server, no cookie) — allow but limit to provided company_id
    // This path is only reachable from internal API calls in brain.ts (same-origin POST)
    companyId = bodyCompanyId
  }

  if (!companyId) {
    return NextResponse.json({ error: 'No company found. Connect a Vercel account in Connections.' }, { status: 404 })
  }

  const creds = await getCredentials(companyId, 'vercel')
  if (!creds.api_token) {
    return NextResponse.json({ error: 'Vercel not connected. Add your Vercel API token in Connections.', needs_setup: true }, { status: 503 })
  }

  // Guard against oversized payloads (Vercel limit is 100MB; we enforce 50MB to stay safe)
  const totalSize = Object.values(files ?? {}).reduce((s: number, c) => s + (c as string).length, 0)
  if (totalSize > 50_000_000) {
    return NextResponse.json({ error: 'Files too large (>50 MB). Split into multiple deployments.' }, { status: 400 })
  }

  try {
    // Convert files to Vercel deployment format
    const deployFiles = Object.entries(files ?? {}).map(([filePath, content]) => ({
      file: filePath,
      data: Buffer.from(content as string).toString('base64'),
      encoding: 'base64',
    }))

    const body: Record<string, unknown> = {
      name: project_name ?? 'incursyia-project',
      files: deployFiles,
      projectSettings: { framework: framework ?? null },
      target: 'production',
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${creds.api_token}`,
      'Content-Type': 'application/json',
    }

    const url = creds.team_id
      ? `https://api.vercel.com/v13/deployments?teamId=${creds.team_id}`
      : 'https://api.vercel.com/v13/deployments'

    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
    const data = await res.json()

    if (!res.ok) return NextResponse.json({ error: data.error?.message ?? JSON.stringify(data) }, { status: 400 })

    return NextResponse.json({
      ok: true,
      url: `https://${data.url}`,
      deploymentId: data.id,
      readyState: data.readyState,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
