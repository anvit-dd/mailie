import { NextRequest, NextResponse } from 'next/server'
import { getSession, getAccountWithTokens } from '@/lib/session'

// Decode base64url on server
function decodeBase64Url(base64Url: string): string {
  const base64 = base64Url
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(base64Url.length + (4 - (base64Url.length % 4)) % 4, '=')
  const { Buffer } = require('buffer')
  return Buffer.from(base64, 'base64').toString('utf-8')
}

function extractBody(payload: any): string {
  if (!payload) return ''
  const { body, parts } = payload

  if (!parts) {
    const data = body?.data
    if (!data) return ''
    return decodeBase64Url(data)
  }

  for (const part of parts) {
    if (part.mimeType === 'text/html') {
      const data = part.body?.data
      if (data) return decodeBase64Url(data)
    }
  }

  for (const part of parts) {
    if (part.mimeType === 'text/plain') {
      const data = part.body?.data
      if (data) return `<pre style="white-space: pre-wrap;">${decodeBase64Url(data)}</pre>`
    }
  }

  for (const part of parts) {
    if (part.parts) {
      const nested = extractBody(part)
      if (nested) return nested
    }
  }

  return ''
}

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
  if (!account?.gmailTokens) {
    return new NextResponse('No Gmail connection', { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const messageId = searchParams.get('id')

  if (!messageId) {
    return new NextResponse('Missing message ID', { status: 400 })
  }

  try {
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
      {
        headers: {
          Authorization: `Bearer ${account.gmailTokens.access_token}`,
        },
      }
    )

    if (!response.ok) {
      return new NextResponse('Failed to fetch message', { status: response.status })
    }

    const message = await response.json()
    const htmlBody = extractBody(message.payload)

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    /* Reset */
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; }

    body {
      background: #0c0c0c;
      color: #d0d0d0;
      font-family: 'Geist Mono', 'SF Mono', 'Fira Code', 'Fira Mono', 'Roboto Mono', monospace;
      font-size: 14px;
      line-height: 1.7;
      padding: 20px;
      word-break: break-word;
      overflow-wrap: break-word;
      width: 100%;
      min-height: 100%;
    }

    /* Email containers often use tables for layout — allow full width */
    table { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: 0.875em; }
    td, th { border: 1px solid #2a2a2a; padding: 8px 12px; text-align: left; }
    th { background: #1a1a1a; font-weight: 600; }
    tr:nth-child(even) { background: #111111; }

    /* Typography */
    p { margin: 0 0 1em 0; }
    h1, h2, h3, h4, h5, h6 { color: #ffffff; font-weight: 600; margin: 1.2em 0 0.5em 0; line-height: 1.3; }
    h1 { font-size: 1.4em; } h2 { font-size: 1.2em; } h3 { font-size: 1.05em; }
    ul, ol { margin: 1em 0; padding-left: 1.5em; }
    li { margin: 0.3em 0; }

    /* Links & media */
    a { color: #ffffff; text-decoration: underline; }
    img { max-width: 100%; height: auto; display: block; margin: 0.5em 0; }

    /* Block elements */
    blockquote { border-left: 3px solid #444; padding-left: 14px; margin: 1em 0; color: #888; }
    pre { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 2px; padding: 12px; overflow-x: auto; margin: 1em 0; font-size: 0.85em; }
    code { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 2px; padding: 1px 5px; font-size: 0.85em; color: #d0d0d0; }
    pre code { background: none; border: none; padding: 0; }
    hr { border: none; border-top: 1px solid #2a2a2a; margin: 1.5em 0; }

    /* Gmail wrapper divs — keep them snug */
    div { margin: 0; }
    div[class] { margin: 0 0 1em 0; }

    /* Nested tables */
    table table { width: auto; }

    /* Some emails use inline background colors — override to dark */
    [style*="background"] { background-color: transparent !important; }
    [style*="background-color"] { background-color: transparent !important; }
  </style>
</head>
<body>${htmlBody}</body>
</html>`

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Frame-Options': 'SAMEORIGIN',
      },
    })
  } catch (err) {
    console.error('Email render error:', err)
    return new NextResponse('Error loading email', { status: 500 })
  }
}
