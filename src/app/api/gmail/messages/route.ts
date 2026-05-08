import { NextRequest, NextResponse } from 'next/server'
import { getSession, getAccountWithTokens } from '@/lib/session'
import { getValidGmailAccessToken } from '@/lib/gmail'

async function requireAuth(request: NextRequest) {
  const sessionId = request.cookies.get('session')?.value
  if (!sessionId) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), account: null }
  const session = getSession(sessionId)
  if (!session) return { error: NextResponse.json({ error: 'Invalid session' }, { status: 401 }), account: null }
  const account = getAccountWithTokens(session.account_id)
  if (!account?.gmailTokens) return { error: NextResponse.json({ error: 'No Gmail connection' }, { status: 401 }), account: null }
  return { error: null, account, accountId: session.account_id }
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth.error) return auth.error

  const accessToken = await getValidGmailAccessToken(auth.accountId!)

  const { searchParams } = new URL(request.url)
  const label = searchParams.get('label') || 'INBOX'
  const pageToken = searchParams.get('pageToken') || undefined
  const maxResults = parseInt(searchParams.get('maxResults') || '25')
  const messageId = searchParams.get('id')
  const q = searchParams.get('q') || undefined

  // Single message detail
  if (messageId) {
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!response.ok) {
      const err = await response.json()
      return NextResponse.json({ error: err.error?.message }, { status: response.status })
    }
    return NextResponse.json(await response.json())
  }

  // List messages
  const params = new URLSearchParams({ maxResults: String(maxResults) })
  if (label) {
    const labelMap: Record<string, string> = {
      INBOX: 'INBOX',
      STARRED: 'STARRED',
      SPAM: 'SPAM',
      SENT: 'SENT',
      DRAFT: 'DRAFT',
      TRASH: 'TRASH',
    }
    params.set('labelIds', labelMap[label] || label)
  }
  if (pageToken) params.set('pageToken', pageToken)
  if (q) params.set('q', q)

  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!response.ok) {
    const err = await response.json()
    return NextResponse.json({ error: err.error?.message }, { status: response.status })
  }

  return NextResponse.json(await response.json())
}
