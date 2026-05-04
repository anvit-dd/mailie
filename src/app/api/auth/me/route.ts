import { NextRequest, NextResponse } from 'next/server'
import { getSession, getAccountWithTokens } from '@/lib/session'

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get('session')?.value
  if (!sessionId) {
    return NextResponse.json({ user: null })
  }

  const session = getSession(sessionId)
  if (!session) {
    return NextResponse.json({ user: null })
  }

  const account = getAccountWithTokens(session.account_id)
  if (!account) {
    return NextResponse.json({ user: null })
  }

  return NextResponse.json({
    user: {
      id: account.id,
      email: account.email,
      name: account.name,
    },
  })
}
