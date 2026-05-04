import { NextRequest, NextResponse } from 'next/server'
import { getSession, getAccountWithTokens } from '@/lib/session'

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

  const { searchParams } = new URL(request.url)
  const messageId = searchParams.get('id')

  if (!messageId) {
    return NextResponse.json({ error: 'Missing message ID' }, { status: 400 })
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
      return NextResponse.json({ error: 'Failed to fetch message' }, { status: response.status })
    }

    const message = await response.json()
    const bodyHtml = extractBody(message.payload)

    // Return just the raw email HTML body (not a full document)
    // message-body.tsx will inject it into an iframe via srcdoc with our dark-mode wrapper
    return NextResponse.json({ html: bodyHtml })
  } catch (err) {
    console.error('Email fetch error:', err)
    return NextResponse.json({ error: 'Error loading email' }, { status: 500 })
  }
}
