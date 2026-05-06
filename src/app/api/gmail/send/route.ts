import { NextRequest, NextResponse } from 'next/server'
import { getSession, getAccountWithTokens } from '@/lib/session'
import { getValidGmailAccessToken } from '@/lib/gmail'
import { stripHtml } from '@/lib/gmail-utils'

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
  // Multipart/alternative is always used — even without attachments — because
  // Gmail API silently converts bare text/html to text/plain (no rendering).
  const innerBoundary = `mailie_alt_${Date.now()}_${Math.random().toString(16).slice(2)}`
  const headerLines: string[] = []
  headerLines.push(`To: ${params.to.join(', ')}`)
  if (params.cc?.length) headerLines.push(`Cc: ${params.cc.join(', ')}`)
  if (params.bcc?.length) headerLines.push(`Bcc: ${params.bcc.join(', ')}`)
  headerLines.push(`Subject: ${params.subject}`)
  headerLines.push('MIME-Version: 1.0')
  headerLines.push(`Content-Type: multipart/alternative; boundary="${innerBoundary}"`)
  if (params.inReplyTo) headerLines.push(`In-Reply-To: ${params.inReplyTo}`)
  if (params.references) headerLines.push(`References: ${params.references}`)

  // Part 1: plain text (Gmail API auto-generates this anyway, but we provide it)
  const bodyLines: string[] = []
  bodyLines.push('')
  bodyLines.push(`--${innerBoundary}`)
  bodyLines.push('Content-Type: text/plain; charset=utf-8')
  bodyLines.push('Content-Transfer-Encoding: 7bit')
  bodyLines.push('')
  bodyLines.push(stripHtml(params.body))

  // Part 2: HTML (TipTap already outputs proper HTML — send raw)
  // Use base64 encoding for the HTML part — most reliable for Gmail API
  const htmlBytes = Buffer.from(params.body, 'utf-8')
  const htmlBase64 = htmlBytes.toString('base64')
  const wrappedHtmlBase64 = wrapBase64(htmlBase64)
  bodyLines.push('')
  bodyLines.push(`--${innerBoundary}`)
  bodyLines.push('Content-Type: text/html; charset=utf-8')
  bodyLines.push('Content-Transfer-Encoding: base64')
  bodyLines.push('')
  bodyLines.push(wrappedHtmlBase64)
  bodyLines.push(`--${innerBoundary}--`)

  if (hasAttachments) {
    const mixedBoundary = `mailie_${Date.now()}_${Math.random().toString(16).slice(2)}`
    const mixedLines: string[] = []
    mixedLines.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`)
    mixedLines.push('')
    mixedLines.push(`--${mixedBoundary}`)
    mixedLines.push(headerLines.join('\r\n') + '\r\n\r\n' + bodyLines.join('\r\n'))
    for (const attachment of params.attachments ?? []) {
      mixedLines.push('')
      mixedLines.push(`--${mixedBoundary}`)
      mixedLines.push(`Content-Type: ${attachment.mimeType}; name="${attachment.filename.replace(/"/g, '')}"`)
      mixedLines.push('Content-Transfer-Encoding: base64')
      mixedLines.push(`Content-Disposition: attachment; filename="${attachment.filename.replace(/"/g, '')}"`)
      mixedLines.push('')
      mixedLines.push(wrapBase64(attachment.data))
    }
    mixedLines.push('')
    mixedLines.push(`--${mixedBoundary}--`)
    return mixedLines.join('\r\n')
  }

  // No attachments — multipart/alternative is the entire message body
  return headerLines.join('\r\n') + '\r\n\r\n' + bodyLines.join('\r\n')
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
