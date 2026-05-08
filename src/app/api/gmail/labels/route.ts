/**
 * GET /api/gmail/labels
 * Returns Gmail label list with unread counts.
 * Response: { labels: { id, name, unreadCount }[] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getValidGmailAccessToken } from '@/lib/gmail'

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get('session')?.value

  if (!sessionId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const session = getSession(sessionId)
  if (!session) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  try {
    const accessToken = await getValidGmailAccessToken(session.account_id)
    const res = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/labels?fields=labels(id,name,threadsTotal,messagesTotal,unreadMessages)',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json({ error: err.error?.message ?? 'Failed to fetch labels' }, { status: 502 })
    }

    const data = await res.json()
    return NextResponse.json({ labels: data.labels ?? [] })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}