import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

export async function POST(req: NextRequest) {
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 503 })
  }

  const { to, subject, body, from_name } = await req.json()
  if (!to || !subject || !body) {
    return NextResponse.json({ error: 'Missing to, subject, or body' }, { status: 400 })
  }

  const fromAddr = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'
  const fromLabel = from_name ? `${from_name} <${fromAddr}>` : fromAddr

  try {
    const { data, error } = await getResend().emails.send({
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
