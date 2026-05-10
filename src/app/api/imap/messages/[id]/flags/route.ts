/**
 * POST /api/imap/messages/[id]/flags
 * Add/remove flags on a message.
 * Body: { folder: string, add?: string[], remove?: string[] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { setFlagged, setSeen } from '@/lib/imap'
import { db } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: uid } = await params

  const sessionId = request.cookies.get('session')?.value
  if (!sessionId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const session = getSession(sessionId)
  if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const account = db.prepare(`SELECT provider FROM accounts WHERE id = ?`).get(session.account_id) as { provider: string } | undefined
  if (!account || account.provider !== 'smtp_imap') {
    return NextResponse.json({ error: 'Not an SMTP/IMAP account' }, { status: 403 })
  }

  let body: { folder: string; add?: string[]; remove?: string[]; seen?: boolean; flagged?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { folder } = body
  if (!folder) return NextResponse.json({ error: 'folder is required' }, { status: 400 })

  // Convenience: set \Seen flag
  if (body.seen !== undefined) {
    try {
      await setSeen(session.account_id, folder, uid, body.seen)
      return NextResponse.json({ ok: true })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return NextResponse.json({ error: msg }, { status: 502 })
    }
  }

  if (body.flagged !== undefined) {
    try {
      await setFlagged(session.account_id, folder, uid, body.flagged)
      return NextResponse.json({ ok: true })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return NextResponse.json({ error: msg }, { status: 502 })
    }
  }

  return NextResponse.json({ ok: true })
}
