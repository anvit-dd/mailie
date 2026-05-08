// GET /api/imap/thread?messageId=xxx&folder=xxx
// Groups IMAP messages by references/inReplyTo headers to build thread.

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

function parseImapMessageId(id: string): { mailbox: string; uid: string } {
  const parts = id.replace('imap:', '').split(':')
  return { mailbox: parts[0], uid: parts[1] }
}

interface ImapMessageDetail {
  uid: string; subject: string
  from: { name: string | null; address: string }
  to: { name: string | null; address: string }[]
  date: string; flags: string[]; hasAttachments: boolean
  bodyHtml: string | null; bodyPlain: string | null
  attachments: Array<{ filename: string; contentType: string; size: number; cid?: string }>
  headers: Record<string, string>; inReplyTo?: string; references?: string[]
}

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get('session')?.value
  if (!sessionId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const session = getSession(sessionId)
  if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const messageId = request.nextUrl.searchParams.get('messageId')
  const folder = request.nextUrl.searchParams.get('folder') || 'INBOX'

  if (!messageId) return NextResponse.json({ error: 'messageId required' }, { status: 400 })

  const { uid } = parseImapMessageId(messageId)

  // Fetch the message to get its references/inReplyTo headers
  const msgRes = await fetch(
    `/api/imap/messages/${uid}?folder=${encodeURIComponent(folder)}`,
    { credentials: 'include' }
  )
  if (!msgRes.ok) return NextResponse.json({ error: 'Failed to fetch message' }, { status: 502 })
  const msg: ImapMessageDetail = await msgRes.json()

  const inReplyTo = msg.inReplyTo
  const references = msg.references ?? []

  // Build a set of all message IDs that belong to this thread
  const threadIds = new Set<string>([messageId])
  if (inReplyTo) threadIds.add(inReplyTo)
  references.forEach((r) => threadIds.add(r))

  // Fetch recent messages from the folder
  const listRes = await fetch(`/api/imap/messages?folder=${encodeURIComponent(folder)}&limit=50`, { credentials: 'include' })
  if (!listRes.ok) return NextResponse.json({ error: 'Failed to search folder' }, { status: 502 })

  const listData = await listRes.json() as {
    messages: Array<{ uid: string; subject: string; from: { name: string | null; address: string }; to: { name: string | null; address: string }[]; date: string; flags: string[]; hasAttachments: boolean; size: number }>
    total: number
  }

  // Fetch full details for all candidate messages
  const details: ImapMessageDetail[] = []
  for (const m of listData.messages) {
    const res = await fetch(`/api/imap/messages/${m.uid}?folder=${encodeURIComponent(folder)}`, { credentials: 'include' })
    if (res.ok) {
      const detail: ImapMessageDetail = await res.json()
      details.push(detail)
    }
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
}