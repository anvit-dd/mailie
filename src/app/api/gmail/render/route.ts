import { NextRequest, NextResponse } from 'next/server'
import { getSession, getAccountWithTokens } from '@/lib/session'
import { escapeHtml, extractBody, type GmailMessage } from '@/lib/gmail-utils'
import { sanitizeAndProxyEmailHtml } from '@/lib/gmail-sanitize'
import { EMAIL_VIEWER_CSS } from '@/lib/gmail-viewer-css'
import { getValidGmailAccessToken } from '@/lib/gmail'

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get('session')?.value
  if (!sessionId) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const session = getSession(sessionId)
  if (!session) {
    return new NextResponse('Invalid session', { status: 401 })
  }

  const account = getAccountWithTokens(session.account_id)
  const accessToken = await getValidGmailAccessToken(session.account_id)
  if (!account?.gmailTokens) {
    return new NextResponse('No Gmail connection', { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const messageId = searchParams.get('id')

  if (!messageId) {
    return new NextResponse('Missing message ID', { status: 400 })
  }

  try {
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      return new NextResponse('Failed to fetch message', { status: response.status })
    }

    const message = (await response.json()) as GmailMessage
    const { body, bodyPlain } = extractBody(message.payload)
    const htmlBody = body || (bodyPlain ? `<pre style="white-space: pre-wrap;">${escapeHtml(bodyPlain)}</pre>` : '')
    const sanitizedHtml = htmlBody ? sanitizeAndProxyEmailHtml(htmlBody, messageId) : ''

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${EMAIL_VIEWER_CSS}
  </style>
</head>
<body class="email-body">${sanitizedHtml}</body>
</html>`

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Frame-Options': 'SAMEORIGIN',
      },
    })
  } catch (error) {
    console.error('Email render error:', error)
    return new NextResponse('Error loading email', { status: 500 })
  }
}
