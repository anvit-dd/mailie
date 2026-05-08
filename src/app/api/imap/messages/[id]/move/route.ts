/**
 * POST /api/imap/messages/[id]/move
 * Move a message to a different folder.
 * Body: { folder: string, destination: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { moveMessage } from '@/lib/imap'
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

  let body: { folder: string; destination: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.folder || !body.destination) {
    return NextResponse.json({ error: 'folder and destination are required' }, { status: 400 })
  }

  try {
    await moveMessage(session.account_id, body.folder, uid, body.destination)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}