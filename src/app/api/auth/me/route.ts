import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserAndAccounts } from '@/lib/session'

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get('session')?.value
  if (!sessionId) {
    return NextResponse.json({ user: null })
  }

  const auth = getSessionUserAndAccounts(sessionId)
  if (!auth) {
    return NextResponse.json({ user: null })
  }

  return NextResponse.json({
    user: auth.user,
    activeAccount: auth.activeAccount,
    accounts: auth.accounts,
  })
}
