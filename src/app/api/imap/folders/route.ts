/**
 * GET /api/imap/folders
 * Returns the folder list for the authenticated SMTP/IMAP account.
 * Requires: session cookie (account must be smtp_imap provider)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { listFolders } from '@/lib/imap'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get('session')?.value
  if (!sessionId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const session = getSession(sessionId)
  if (!session) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  const account = db.prepare(`SELECT provider FROM accounts WHERE id = ?`).get(session.account_id) as { provider: string } | undefined
  if (!account || account.provider !== 'smtp_imap') {
    return NextResponse.json({ error: 'Not an SMTP/IMAP account' }, { status: 403 })
  }

  try {
    const folders = await listFolders(session.account_id)
    return NextResponse.json({ folders })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}