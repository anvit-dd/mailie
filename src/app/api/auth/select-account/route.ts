import { NextRequest, NextResponse } from 'next/server'
import { getSession, getSessionUserAndAccounts, setActiveAccount } from '@/lib/session'

export async function POST(request: NextRequest) {
  const sessionId = request.cookies.get('session')?.value
  if (!sessionId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const session = getSession(sessionId)
  if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  let body: { accountId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.accountId) return NextResponse.json({ error: 'accountId is required' }, { status: 400 })

  try {
    setActiveAccount(session.id, body.accountId)
    const auth = getSessionUserAndAccounts(session.id)
    const account = auth?.accounts.find((item) => item.id === body.accountId)
    return NextResponse.json({ account })
  } catch {
    return NextResponse.json({ error: 'Account not found' }, { status: 403 })
  }
}
