import { NextRequest, NextResponse } from 'next/server'
import { getSession, getAccountWithTokens } from '@/lib/session'
import { getValidGmailAccessToken } from '@/lib/gmail'
import { stripHtml } from '@/lib/gmail-utils'

interface AttachmentInput {
  filename: string
  mimeType: string
  data: string
}

interface InlineImageInput {
  cid: string
  filename: string
  mimeType: string
  data: string
}

function asStringArray(value: unknown): string[] | undefined {
  if (value === undefined) return undefined
  if (typeof value === 'string') return value.trim() ? [value.trim()] : []
  if (!Array.isArray(value)) return undefined
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
}

function wrapBase64(input: string): string {
  return input.match(/.{1,76}/g)?.join('\r\n') ?? input
}

function escapeHeaderValue(value: string): string {
  return value.replace(/"/g, '')
}

function sanitizeHeaderValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.replace(/[\r\n]+/g, ' ').trim()
  return normalized || undefined
}

function normalizeReferences(value: unknown): string | undefined {
  const raw = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').join(' ')
    : typeof value === 'string'
      ? value
      : ''
  const normalized = raw.replace(/[\r\n]+/g, ' ').split(/\s+/).filter(Boolean)
  return [...new Set(normalized)].join(' ') || undefined
}

function extractInlineImages(html: string): { html: string; images: InlineImageInput[] } {
  const images: InlineImageInput[] = []
  let index = 0

  const nextHtml = html.replace(
    /(<img\b[^>]*?\bsrc\s*=\s*)(["'])(data:(image\/[a-zA-Z0-9.+-]+);base64,([^"']+))\2/gi,
    (match: string, prefix: string, quote: string, _dataUrl: string, mimeType: string, base64Data: string) => {
      index += 1
      const extension = mimeType.split('/')[1]?.replace(/[^a-zA-Z0-9]/g, '') || 'png'
      const cid = `mailie-inline-${Date.now()}-${index}@mailie.local`

      images.push({
        cid,
        filename: `inline-${index}.${extension}`,
        mimeType,
        data: base64Data.replace(/\s/g, ''),
      })

      return `${prefix}${quote}cid:${cid}${quote}`
    }
  )

  return { html: nextHtml, images }
}

function buildPlainTextPart(text: string): string {
  return [
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    text,
  ].join('\r\n')
}

function buildHtmlPart(html: string): string {
  return [
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrapBase64(Buffer.from(html, 'utf-8').toString('base64')),
  ].join('\r\n')
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
  const { html, images: inlineImages } = extractInlineImages(params.body)
  const hasAttachments = Boolean(params.attachments?.length)
  const hasInlineImages = inlineImages.length > 0
  const innerBoundary = `mailie_alt_${Date.now()}_${Math.random().toString(16).slice(2)}`
  const relatedBoundary = `mailie_related_${Date.now()}_${Math.random().toString(16).slice(2)}`
  const mixedBoundary = `mailie_${Date.now()}_${Math.random().toString(16).slice(2)}`

  const headerLines: string[] = []
  headerLines.push(`To: ${params.to.join(', ')}`)
  if (params.cc?.length) headerLines.push(`Cc: ${params.cc.join(', ')}`)
  if (params.bcc?.length) headerLines.push(`Bcc: ${params.bcc.join(', ')}`)
  headerLines.push(`Subject: ${params.subject}`)
  headerLines.push('MIME-Version: 1.0')
  headerLines.push(
    `Content-Type: multipart/${hasAttachments ? 'mixed' : hasInlineImages ? 'related' : 'alternative'}; boundary="${hasAttachments ? mixedBoundary : hasInlineImages ? relatedBoundary : innerBoundary}"`
  )
  if (params.inReplyTo) headerLines.push(`In-Reply-To: ${params.inReplyTo}`)
  if (params.references) headerLines.push(`References: ${params.references}`)

  let bodyContentType: string
  let bodyPayload: string

  if (hasInlineImages) {
    const relatedLines: string[] = []
    relatedLines.push(`--${relatedBoundary}`)
    relatedLines.push(buildHtmlPart(html))
    relatedLines.push('')

    for (const image of inlineImages) {
      relatedLines.push(`--${relatedBoundary}`)
      relatedLines.push(`Content-Type: ${image.mimeType}; name="${escapeHeaderValue(image.filename)}"`)
      relatedLines.push('Content-Transfer-Encoding: base64')
      relatedLines.push(`Content-ID: <${image.cid}>`)
      relatedLines.push(`Content-Disposition: inline; filename="${escapeHeaderValue(image.filename)}"`)
      relatedLines.push('')
      relatedLines.push(wrapBase64(image.data))
      relatedLines.push('')
    }

    relatedLines.push(`--${relatedBoundary}--`)
    bodyContentType = `Content-Type: multipart/related; boundary="${relatedBoundary}"`
    bodyPayload = relatedLines.join('\r\n')
  } else {
    // Multipart/alternative is used for non-image HTML because Gmail API can
    // otherwise display bare text/html as plain source in some clients.
    const alternativeLines: string[] = []
    alternativeLines.push(`--${innerBoundary}`)
    alternativeLines.push(buildPlainTextPart(stripHtml(html)))
    alternativeLines.push('')
    alternativeLines.push(`--${innerBoundary}`)
    alternativeLines.push(buildHtmlPart(html))
    alternativeLines.push('')
    alternativeLines.push(`--${innerBoundary}--`)
    bodyContentType = `Content-Type: multipart/alternative; boundary="${innerBoundary}"`
    bodyPayload = alternativeLines.join('\r\n')
  }

  if (hasAttachments) {
    const mixedLines: string[] = []
    mixedLines.push(`--${mixedBoundary}`)
    mixedLines.push(bodyContentType)
    mixedLines.push('')
    mixedLines.push(bodyPayload)

    for (const attachment of params.attachments ?? []) {
      mixedLines.push('')
      mixedLines.push(`--${mixedBoundary}`)
      mixedLines.push(`Content-Type: ${attachment.mimeType}; name="${escapeHeaderValue(attachment.filename)}"`)
      mixedLines.push('Content-Transfer-Encoding: base64')
      mixedLines.push(`Content-Disposition: attachment; filename="${escapeHeaderValue(attachment.filename)}"`)
      mixedLines.push('')
      mixedLines.push(wrapBase64(attachment.data))
    }
    mixedLines.push('')
    mixedLines.push(`--${mixedBoundary}--`)
    return headerLines.join('\r\n') + '\r\n\r\n' + mixedLines.join('\r\n')
  }

  if (hasInlineImages) {
    return headerLines.join('\r\n') + '\r\n\r\n' + bodyPayload
  }

  // No attachments/images — multipart/alternative is the entire message body.
  return headerLines.join('\r\n') + '\r\n\r\n' + bodyPayload
}

export async function POST(request: NextRequest) {
  const sessionId = request.cookies.get('session')?.value
  if (!sessionId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const session = getSession(sessionId)
  if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const account = getAccountWithTokens(session.account_id)
  if (!account?.gmailTokens) return NextResponse.json({ error: 'No Gmail connection' }, { status: 401 })

  const accessToken = await getValidGmailAccessToken(session.account_id)

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { subject, inReplyTo, references, threadId, attachments } = body
  const to = asStringArray(body.to)
  const cc = asStringArray(body.cc)
  const bcc = asStringArray(body.bcc)
  const emailBody = typeof body.body === 'string'
    ? body.body
    : typeof body.html === 'string'
      ? body.html
      : ''

  if (!to?.length) {
    return NextResponse.json({ error: 'Missing required recipients' }, { status: 400 })
  }

  if (/\bsrc\s*=\s*["']blob:/i.test(emailBody)) {
    return NextResponse.json(
      { error: 'Inline images are still local blob URLs. Please retry after the editor finishes loading the image.' },
      { status: 400 }
    )
  }

  const rawMime = buildMimeMessage({
    to,
    subject: sanitizeHeaderValue(subject) ?? '',
    body: emailBody,
    cc,
    bcc,
    inReplyTo: sanitizeHeaderValue(inReplyTo),
    references: normalizeReferences(references),
    attachments: Array.isArray(attachments) ? attachments as AttachmentInput[] : undefined,
  })

  const raw = Buffer.from(rawMime)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const payload: Record<string, unknown> = { raw }
  if (typeof threadId === 'string' && threadId.trim()) payload.threadId = threadId.trim()

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
