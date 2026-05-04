import { NextRequest, NextResponse } from 'next/server'
import { getSession, getAccountWithTokens } from '@/lib/session'

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get('session')?.value
  if (!sessionId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const session = getSession(sessionId)
  if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const account = getAccountWithTokens(session.account_id)
  if (!account?.gmailTokens) return NextResponse.json({ error: 'No Gmail connection' }, { status: 401 })

  const response = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/profile',
    { headers: { Authorization: `Bearer ${account.gmailTokens.access_token}` } }
  )

  if (!response.ok) {
    const err = await response.json()
    return NextResponse.json({ error: err.error?.message }, { status: response.status })
  }

  return NextResponse.json(await response.json())
}
