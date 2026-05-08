import { NextRequest, NextResponse } from 'next/server'
import { getSession, getAccountWithTokens } from '@/lib/session'
import { escapeHtml, extractBody, type GmailMessage } from '@/lib/gmail-utils'
import { sanitizeAndProxyEmailHtml } from '@/lib/gmail-sanitize'
import { getValidGmailAccessToken } from '@/lib/gmail'

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
    const theme = searchParams.get('theme') === 'dark'

    if (!messageId) {
      return NextResponse.json({ error: 'Missing message ID' }, { status: 400 })
    }

    try {
    // Always fetch from Gmail — body was not pre-fetched via GET
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch message' }, { status: response.status })
    }

    const message = (await response.json()) as GmailMessage
    const { body, bodyPlain } = extractBody(message.payload)

    const isPlainText = !body && Boolean(bodyPlain)
    const htmlBody = body || (bodyPlain ? `<pre style="white-space: pre-wrap;">${escapeHtml(bodyPlain)}</pre>` : '')
    const sanitizedHtml = htmlBody ? sanitizeAndProxyEmailHtml(htmlBody, messageId, theme) : ''

    return NextResponse.json({ html: sanitizedHtml, plainText: isPlainText, bodyPlain })
  } catch (error) {
    console.error('Email fetch error:', error)
    return NextResponse.json({ error: 'Error loading email' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const sessionId = request.cookies.get('session')?.value
  if (!sessionId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const session = getSession(sessionId)
  if (!session) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  const account = getAccountWithTokens(session.account_id)
  if (!account?.gmailTokens) {
    return NextResponse.json({ error: 'No Gmail connection' }, { status: 401 })
  }

  try {
    let messageId: string | undefined
    let bodyHtml: string | undefined
    let themeParam: string | undefined

    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const parsed = await request.json()
      ;({ id: messageId, bodyHtml, theme: themeParam } = parsed as { id: string; bodyHtml?: string; theme?: string })
    }

    if (!messageId) {
      return NextResponse.json({ error: 'Missing message ID' }, { status: 400 })
    }

    const isDark = themeParam === 'dark'

    // If pre-fetched bodyHtml was passed (from client cache), sanitize and return directly
    if (bodyHtml) {
      const sanitized = sanitizeAndProxyEmailHtml(bodyHtml, messageId, isDark)
      return NextResponse.json({ html: sanitized })
    }

    // Otherwise fetch from Gmail
    const accessToken = await getValidGmailAccessToken(session.account_id)
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch message' }, { status: response.status })
    }

    const message = (await response.json()) as GmailMessage
    const { body: emailBody, bodyPlain } = extractBody(message.payload)
    const isPlainText = !emailBody && Boolean(bodyPlain)
    const htmlBody = emailBody || (bodyPlain ? `<pre style="white-space: pre-wrap;">${escapeHtml(bodyPlain)}</pre>` : '')
    const sanitizedHtml = htmlBody ? sanitizeAndProxyEmailHtml(htmlBody, messageId, isDark) : ''

    return NextResponse.json({ html: sanitizedHtml, plainText: isPlainText, bodyPlain })
  } catch (error) {
    console.error('Email fetch error:', error)
    return NextResponse.json({ error: 'Error loading email' }, { status: 500 })
  }
}
