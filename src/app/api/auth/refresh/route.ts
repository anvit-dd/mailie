import { NextRequest, NextResponse } from 'next/server'
import { getSession, getAccountWithTokens } from '@/lib/session'
import { db } from '@/lib/db'

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
  if (!account?.gmailTokens?.refresh_token) {
    return NextResponse.json({ error: 'No refresh token' }, { status: 401 })
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.NEXT_PUBLIC_GMAIL_CLIENT_ID!,
        client_secret: process.env.GMAIL_CLIENT_SECRET!,
        refresh_token: account.gmailTokens.refresh_token,
        grant_type: 'refresh_token',
      }),
    })

    if (!response.ok) {
      throw new Error('Token refresh failed')
    }

    const tokens = await response.json()
    const newExpiresAt = Date.now() + tokens.expires_in * 1000

    // Update stored tokens
    db.prepare(`
      UPDATE gmail_tokens SET access_token = ?, expires_at = ?, updated_at = ? WHERE account_id = ?
    `).run(tokens.access_token, newExpiresAt, Date.now(), account.id)

    return NextResponse.json({ access_token: tokens.access_token, expires_at: newExpiresAt })
  } catch (err) {
    console.error('Token refresh error:', err)
    return NextResponse.json({ error: 'Refresh failed' }, { status: 401 })
  }
}
