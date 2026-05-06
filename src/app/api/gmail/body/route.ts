import { NextRequest, NextResponse } from 'next/server'
import { getSession, getAccountWithTokens } from '@/lib/session'
import { escapeHtml, extractBody, type GmailMessage } from '@/lib/gmail-utils'
import { sanitizeAndProxyEmailHtml } from '@/lib/gmail-sanitize'
import { getValidGmailAccessToken } from '@/lib/gmail'

function isPlainTextLikeHtml(html: string): boolean {
  const normalized = html.trim()
  if (!normalized) return true

  if (/<(img|svg|video|audio|canvas|iframe|form|button|input|select|textarea)\b/i.test(normalized)) return false
  if (/<style\b/i.test(normalized)) return false
  if (/on[a-z]+\s*=/i.test(normalized)) return false

  const tagNames = Array.from(normalized.matchAll(/<\/?\s*([a-z0-9:-]+)/gi), (match) => match[1].toLowerCase())
  const allowedTextWrapperTags = new Set([
    'html',
    'head',
    'body',
    'meta',
    'title',
    'div',
    'span',
    'p',
    'br',
    'b',
    'strong',
    'i',
    'em',
    'u',
    'font',
    'center',
    'table',
    'tbody',
    'thead',
    'tfoot',
    'tr',
    'td',
    'th',
    'a',
  ])

  return tagNames.every((tagName) => allowedTextWrapperTags.has(tagName))
}

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get('session')?.value
  if (!sessionId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const session = getSession(sessionId)
  if (!session) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  const account = getAccountWithTokens(session.account_id)
  const accessToken = await getValidGmailAccessToken(session.account_id)
  if (!account?.gmailTokens) {
    return NextResponse.json({ error: 'No Gmail connection' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const messageId = searchParams.get('id')

  if (!messageId) {
    return NextResponse.json({ error: 'Missing message ID' }, { status: 400 })
  }

  try {
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch message' }, { status: response.status })
    }

    const message = (await response.json()) as GmailMessage
    const { body, bodyPlain } = extractBody(message.payload)
    const isPlainText = !body && Boolean(bodyPlain)
    const htmlBody = body || (bodyPlain ? `<pre style="white-space: pre-wrap;">${escapeHtml(bodyPlain)}</pre>` : '')
    const sanitizedHtml = htmlBody ? sanitizeAndProxyEmailHtml(htmlBody, messageId) : ''
    const plainTextLike = isPlainText || (Boolean(body) && isPlainTextLikeHtml(body))

    return NextResponse.json({
      html: sanitizedHtml,
      plainText: plainTextLike,
      bodyPlain: bodyPlain || '',
    })
  } catch (error) {
    console.error('Email fetch error:', error)
    return NextResponse.json({ error: 'Error loading email' }, { status: 500 })
  }
}
