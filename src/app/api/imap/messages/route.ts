/**
 * GET /api/imap/messages
 * Search/fetch messages from a folder for the authenticated SMTP/IMAP account.
 *
 * Query params:
 *   folder  — folder path (default: INBOX)
 *   limit   — max results (default: 25)
 *   offset  — skip N results (default: 0)
 *   search  — optional JSON search criteria object
 *             e.g. ?search={"from":"alice","subject":"report"}
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { searchMessages } from '@/lib/imap'
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

  const { searchParams } = request.nextUrl
  const folder = searchParams.get('folder') ?? 'INBOX'
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '25', 10), 100)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)

  let searchCriteria: Record<string, unknown> = {}
  const searchRaw = searchParams.get('search')
  if (searchRaw) {
    try {
      searchCriteria = JSON.parse(searchRaw)
    } catch {
      return NextResponse.json({ error: 'Invalid search JSON' }, { status: 400 })
    }
  }

  try {
    const result = await searchMessages(session.account_id, folder, searchCriteria, limit, offset)
    return NextResponse.json(result)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}