import { NextRequest, NextResponse } from 'next/server'
import { getSession, getAccountWithTokens } from '@/lib/session'
import { escapeHtml, extractBody, type GmailMessage } from '@/lib/gmail-utils'

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
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`, {
      headers: {
        Authorization: `Bearer ${account.gmailTokens.access_token}`,
      },
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch message' }, { status: response.status })
    }

    const message = (await response.json()) as GmailMessage
    const { body, bodyPlain } = extractBody(message.payload)
    const htmlBody = body || (bodyPlain ? `<pre style="white-space: pre-wrap;">${escapeHtml(bodyPlain)}</pre>` : '')

    return NextResponse.json({ html: htmlBody })
  } catch (error) {
    console.error('Email fetch error:', error)
    return NextResponse.json({ error: 'Error loading email' }, { status: 500 })
  }
}
