import { NextRequest, NextResponse } from 'next/server'
import { getSession, getAccountWithTokens } from '@/lib/session'
import { getValidGmailAccessToken } from '@/lib/gmail'
import { escapeHtml } from '@/lib/gmail-utils'

interface AttachmentInput {
  filename: string
  mimeType: string
  data: string
}

function wrapBase64(input: string): string {
  return input.match(/.{1,76}/g)?.join('\r\n') ?? input
}

function buildMimeMessage(params: {
  to: string[]
  subject: string
  body: string
  cc?: string[]
  bcc?: string[]
  inReplyTo?: string
  references?: string
  attachments?: AttachmentInput[]
}): string {
  const hasAttachments = Boolean(params.attachments?.length)
  const boundary = `mailie_${Date.now()}_${Math.random().toString(16).slice(2)}`
  const innerBoundary = `mailie_alt_${Date.now()}_${Math.random().toString(16).slice(2)}`
  const lines: string[] = []

  lines.push(`To: ${params.to.join(', ')}`)
  if (params.cc?.length) lines.push(`Cc: ${params.cc.join(', ')}`)
  if (params.bcc?.length) lines.push(`Bcc: ${params.bcc.join(', ')}`)
  lines.push(`Subject: ${params.subject}`)
  lines.push('MIME-Version: 1.0')

  if (params.inReplyTo) lines.push(`In-Reply-To: ${params.inReplyTo}`)
  if (params.references) lines.push(`References: ${params.references}`)

  if (hasAttachments) {
    lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`)
    lines.push('')
    lines.push(`--${boundary}`)
    lines.push(`Content-Type: multipart/alternative; boundary="${innerBoundary}"`)
    lines.push('')
    lines.push(`--${innerBoundary}`)
    lines.push('Content-Type: text/plain; charset=utf-8')
    lines.push('Content-Transfer-Encoding: 7bit')
    lines.push('')
    lines.push(params.body)
    lines.push('')
    lines.push(`--${innerBoundary}`)
    lines.push('Content-Type: text/html; charset=utf-8')
    lines.push('Content-Transfer-Encoding: 7bit')
    lines.push('')
    lines.push(escapeHtml(params.body).replace(/\n/g, '<br>'))
    lines.push('')
    lines.push(`--${innerBoundary}--`)

    for (const attachment of params.attachments ?? []) {
      lines.push('')
      lines.push(`--${boundary}`)
      lines.push(`Content-Type: ${attachment.mimeType}; name="${attachment.filename.replace(/"/g, '')}"`)
      lines.push('Content-Transfer-Encoding: base64')
      lines.push(`Content-Disposition: attachment; filename="${attachment.filename.replace(/"/g, '')}"`)
      lines.push('')
      lines.push(wrapBase64(attachment.data))
    }

    lines.push('')
    lines.push(`--${boundary}--`)
    return lines.join('\r\n')
  }

  lines.push('Content-Type: text/html; charset=utf-8')
  lines.push('Content-Transfer-Encoding: 7bit')
  lines.push('')
  lines.push(escapeHtml(params.body).replace(/\n/g, '<br>'))

  return lines.join('\r\n')
}

export async function POST(request: NextRequest) {
  const sessionId = request.cookies.get('session')?.value
  if (!sessionId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const session = getSession(sessionId)
  if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const account = getAccountWithTokens(session.account_id)
  if (!account?.gmailTokens) return NextResponse.json({ error: 'No Gmail connection' }, { status: 401 })

  const accessToken = await getValidGmailAccessToken(session.account_id)

  const body = await request.json()
  const { to, subject, body: emailBody, cc, bcc, inReplyTo, references, threadId, attachments } = body

  if (!to) {
    return NextResponse.json({ error: 'Missing required recipients' }, { status: 400 })
  }

  const rawMime = buildMimeMessage({
    to: Array.isArray(to) ? to : [to],
    subject,
    body: emailBody,
    cc,
    bcc,
    inReplyTo,
    references,
    attachments,
  })

  const raw = Buffer.from(rawMime)
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
