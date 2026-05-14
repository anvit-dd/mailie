import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'

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

  const account = db.prepare(`
    SELECT id, provider FROM accounts WHERE id = ? AND user_id = ?
  `).get(body.accountId, session.user_id) as { id: string; provider: string } | undefined

  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  if (account.provider !== 'smtp_imap') {
    return NextResponse.json({ error: 'Only SMTP/IMAP accounts can be deleted here' }, { status: 400 })
  }

  db.transaction(() => {
    db.prepare(`UPDATE sessions SET active_account_id = NULL, account_id = NULL WHERE active_account_id = ? OR account_id = ?`)
      .run(account.id, account.id)
    db.prepare(`DELETE FROM accounts WHERE id = ? AND user_id = ? AND provider = 'smtp_imap'`)
      .run(account.id, session.user_id)
  })()

  return NextResponse.json({ ok: true })
}
