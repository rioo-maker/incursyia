import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getCredentials, getCompanyIdForUser } from '@/lib/integrations'

/**
 * Deploy a project to Vercel via the Vercel API.
 * Called by the engineering agent after generating code.
 */
export async function POST(req: NextRequest) {
  const { project_name, files, framework, company_id } = await req.json()
  // files: { [path]: content } — e.g. { "index.html": "<html>..." }

  let companyId = company_id
  if (!companyId) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: company } = await supabase.from('companies').select('id').eq('user_id', user.id).limit(1).single()
    companyId = company?.id
  }

  const creds = await getCredentials(companyId, 'vercel')
  if (!creds.api_token) {
    return NextResponse.json({ error: 'Vercel not connected. Add your Vercel API token in Connections.', needs_setup: true }, { status: 503 })
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
