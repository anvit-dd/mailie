/**
 * GET /api/imap/messages/[id]
 * Fetch a single message with body + attachments.
 * Accessible only by the owning SMTP/IMAP account.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { fetchMessage } from '@/lib/imap'
import { db } from '@/lib/db'

export async function GET(
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

  const folder = request.nextUrl.searchParams.get('folder') ?? 'INBOX'

  try {
    const message = await fetchMessage(session.account_id, folder, uid)
    return NextResponse.json(message)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}