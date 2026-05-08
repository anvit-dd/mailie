import { NextRequest, NextResponse } from 'next/server'
import { getSession, getAccountWithTokens } from '@/lib/session'
import { getValidGmailAccessToken } from '@/lib/gmail'
import type { GmailMessage } from '@/lib/gmail-utils'

export async function POST(request: NextRequest) {
  const sessionId = request.cookies.get('session')?.value
  if (!sessionId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const session = getSession(sessionId)
  if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const account = getAccountWithTokens(session.account_id)
  if (!account?.gmailTokens) return NextResponse.json({ error: 'No Gmail connection' }, { status: 401 })

  const accessToken = await getValidGmailAccessToken(session.account_id)

  let ids: string[] = []
  try {
    const body = await request.json()
    ids = body?.ids ?? []
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'Missing or invalid ids' }, { status: 400 })
  }

  // Fetch all messages in parallel — server-side so no connection limit issues
  // format=full is required so callers get payload.body AND payload.parts (attachments)
  // Using format=metadata would omit both, breaking hasAttachments in the list AND
  // causing loadEmailDetail to always re-fetch (cache always misses since body/parts are undefined)
  const results = await Promise.allSettled(
    ids.map((id) =>
      fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      ).then((res) => {
        if (!res.ok) return null
        return res.json() as Promise<GmailMessage>
      })
    )
  )

  // Filter out failed fetches, maintain order
  const messages: GmailMessage[] = []
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      messages.push(result.value)
    }
  }

  return NextResponse.json({ messages })
}
