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

async function getSupabaseAndCompany() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, companyId: null }

  const { data } = await supabase
    .from('companies').select('id').eq('user_id', user.id).order('created_at').limit(1).single()
  return { supabase, companyId: data?.id ?? null }
}

// GET /api/templates — list all business templates
export async function GET() {
  const { data, error } = await db()
    .from('business_templates')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/templates — apply a template to a company
export async function POST(req: NextRequest) {
  const { companyId } = await getSupabaseAndCompany()
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { template_id, company_id } = await req.json()
  const targetCompanyId = company_id ?? companyId
  if (!template_id) return NextResponse.json({ error: 'Missing template_id' }, { status: 400 })

  const client = db()

  // Fetch the template
  const { data: template, error: templateError } = await client
    .from('business_templates')
    .select('*')
    .eq('id', template_id)
    .single()

  if (templateError || !template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  const config = template.config as {
    initial_tasks?: Array<{ title: string; description?: string; tag?: string; priority?: string }>
    category?: string
    industry?: string
    description?: string
  }

  // Create initial tasks from the template
  if (config?.initial_tasks?.length) {
    const tasks = config.initial_tasks.map(task => ({
      company_id: targetCompanyId,
      title: task.title,
      description: task.description ?? '',
      tag: task.tag ?? 'general',
      priority: task.priority ?? 'medium',
      status: 'todo',
    }))

    const { error: tasksError } = await client.from('tasks').insert(tasks)
    if (tasksError) {
      return NextResponse.json({ error: tasksError.message }, { status: 500 })
    }
  }

  // Update company description/industry based on template category
  const updates: Record<string, string> = {}
  if (config?.description) updates.description = config.description
  if (config?.industry) updates.industry = config.industry
  if (config?.category) updates.industry = config.category

  if (Object.keys(updates).length > 0) {
    await client
      .from('companies')
      .update(updates)
      .eq('id', targetCompanyId)
  }

  return NextResponse.json({
    ok: true,
    tasks_created: config?.initial_tasks?.length ?? 0,
    template: template.name ?? template.id,
  })
}
