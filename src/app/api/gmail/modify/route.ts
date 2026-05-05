import { NextRequest, NextResponse } from 'next/server'
import { getSession, getAccountWithTokens } from '@/lib/session'
import { getValidGmailAccessToken } from '@/lib/gmail'

export async function POST(request: NextRequest) {
  const sessionId = request.cookies.get('session')?.value
  if (!sessionId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const session = getSession(sessionId)
  if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const account = getAccountWithTokens(session.account_id)
  const accessToken = await getValidGmailAccessToken(session.account_id)
  if (!account?.gmailTokens) return NextResponse.json({ error: 'No Gmail connection' }, { status: 401 })

  const { messageId, addLabels, removeLabels } = await request.json()
  if (!messageId) return NextResponse.json({ error: 'messageId required' }, { status: 400 })

  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ addLabelIds: addLabels || [], removeLabelIds: removeLabels || [] }),
    }
  )

  if (!response.ok) {
    const err = await response.json()
    return NextResponse.json({ error: err.error?.message }, { status: response.status })
  }

  return NextResponse.json(await response.json())
}
