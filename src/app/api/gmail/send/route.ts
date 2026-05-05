import { NextRequest, NextResponse } from 'next/server'
import { getSession, getAccountWithTokens } from '@/lib/session'
import { getValidGmailAccessToken } from '@/lib/gmail'

export async function POST(request: NextRequest) {
  const sessionId = request.cookies.get('session')?.value
  if (!sessionId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const session = getSession(sessionId)
  if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const account = getAccountWithTokens(session.account_id)
  if (!account?.gmailTokens) return NextResponse.json({ error: 'No Gmail connection' }, { status: 401 })

  const accessToken = await getValidGmailAccessToken(session.account_id)

  const body = await request.json()
  const { to, subject, body: emailBody, cc, bcc, inReplyTo, references, threadId } = body

  if (!to || !subject || !emailBody) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Build raw MIME email
  const lines: string[] = []
  lines.push(`To: ${Array.isArray(to) ? to.join(', ') : to}`)
  if (cc?.length) lines.push(`Cc: ${cc.join(', ')}`)
  if (bcc?.length) lines.push(`Bcc: ${bcc.join(', ')}`)
  lines.push(`Subject: ${subject}`)
  lines.push('Content-Type: text/html; charset=utf-8')
  lines.push('MIME-Version: 1.0')
  if (inReplyTo) lines.push(`In-Reply-To: ${inReplyTo}`)
  if (references) lines.push(`References: ${references}`)
  // Convert plain-text newlines to <br> for HTML rendering
  const htmlBody = emailBody.replace(/\n/g, '<br>')
  lines.push('')
  lines.push(htmlBody)

  const raw = Buffer.from(lines.join('\r\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const payload: Record<string, unknown> = { raw }
  if (threadId) payload.threadId = threadId

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const err = await response.json()
    return NextResponse.json({ error: err.error?.message }, { status: response.status })
  }

  return NextResponse.json(await response.json())
}
