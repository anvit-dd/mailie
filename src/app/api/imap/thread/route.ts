// GET /api/imap/thread?messageId=xxx&folder=xxx
// Groups IMAP messages by references/inReplyTo headers to build thread.

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { fetchMessage, searchMessages, type ImapMessageDetail } from '@/lib/imap'
import { db } from '@/lib/db'

function parseImapMessageId(id: string): { mailbox: string; uid: string } {
  const value = id.replace('imap:', '')
  const separatorIndex = value.lastIndexOf(':')
  return {
    mailbox: separatorIndex === -1 ? 'INBOX' : value.slice(0, separatorIndex),
    uid: separatorIndex === -1 ? value : value.slice(separatorIndex + 1),
  }
}

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get('session')?.value
  if (!sessionId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const session = getSession(sessionId)
  if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const account = db.prepare(`SELECT provider FROM accounts WHERE id = ?`).get(session.account_id) as { provider: string } | undefined
  if (!account || account.provider !== 'smtp_imap') {
    return NextResponse.json({ error: 'Not an SMTP/IMAP account' }, { status: 403 })
  }

  const messageId = request.nextUrl.searchParams.get('messageId')
  const folder = request.nextUrl.searchParams.get('folder') || 'INBOX'

  if (!messageId) return NextResponse.json({ error: 'messageId required' }, { status: 400 })

  const { uid } = parseImapMessageId(messageId)

  try {
    // Fetch the message to get its references/inReplyTo headers
    const msg: ImapMessageDetail = await fetchMessage(session.account_id, folder, uid)

    const inReplyTo = msg.inReplyTo
    const references = msg.references ?? []

    // Build a set of all message IDs that belong to this thread
    const threadIds = new Set<string>([messageId])
    if (inReplyTo) threadIds.add(inReplyTo)
    references.forEach((r) => threadIds.add(r))

    // Fetch recent messages from the folder
    const listData = await searchMessages(session.account_id, folder, {}, 50, 0)

    // Fetch full details for all candidate messages
    const details: ImapMessageDetail[] = []
    for (const m of listData.messages) {
      const detail = await fetchMessage(session.account_id, folder, m.uid)
      details.push(detail)
    }

    // Filter to messages that share references/inReplyTo
    const threadMessages = details.filter((m) => {
      const msgId = `imap:${folder}:${m.uid}`
      if (threadIds.has(msgId)) return true
      if (m.inReplyTo && threadIds.has(m.inReplyTo)) return true
      if (m.references?.some((r) => threadIds.has(r))) return true
      return false
    })

    // Sort by date ascending (chronological)
    threadMessages.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    const messages = threadMessages.map((m) => ({
      id: `imap:${folder}:${m.uid}`,
      threadId: messageId,
      subject: m.subject || '(no subject)',
      preview: '',
      from: { name: m.from.name ?? '', email: m.from.address },
      to: m.to.map((t) => ({ name: t.name ?? '', email: t.address })),
      date: new Date(m.date),
      body: m.bodyHtml ?? '',
      bodyPlain: m.bodyPlain ?? '',
      isRead: m.flags.includes('\\Seen'),
      isStarred: m.flags.includes('\\Flagged'),
      labels: m.flags.includes('\\Draft') ? ['DRAFT'] : [],
      hasAttachments: m.hasAttachments,
      attachments: m.attachments.map((a, i) => ({
        id: String(i),
        filename: a.filename,
        mimeType: a.contentType,
        size: a.size,
      })),
      headers: m.headers,
      inReplyTo: m.inReplyTo,
      references: m.references,
    }))

    return NextResponse.json({ messages })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
