// IMAP/SMTP implementation of MailProvider — uses existing IMAP API routes.

import type { MailProvider, ListMessagesParams, ListMessagesResult, EmailDetail, SendMessageParams, MailFolder, Email } from '../mail-provider'

function parseImapMessageId(id: string): { mailbox: string; uid: string } {
  const value = id.replace('imap:', '')
  const separatorIndex = value.lastIndexOf(':')
  return {
    mailbox: separatorIndex === -1 ? 'INBOX' : value.slice(0, separatorIndex),
    uid: separatorIndex === -1 ? value : value.slice(separatorIndex + 1),
  }
}

export class ImapSmtpProvider implements MailProvider {
  readonly provider = 'smtp_imap' as const

  async listMessages(params: ListMessagesParams): Promise<ListMessagesResult> {
    const searchParams = new URLSearchParams()
    searchParams.set('folder', params.folder)
    searchParams.set('limit', String(params.limit ?? 25))
    if (params.pageToken) {
      const offset = (parseInt(params.pageToken, 10) - 1) * 25
      searchParams.set('offset', String(offset))
    }
    if (params.query) searchParams.set('search', JSON.stringify({ subject: params.query }))
    // IMAP-specific filter params
    if (params.from) searchParams.set('from', params.from)
    if (params.to) searchParams.set('to', params.to)
    if (params.hasAttachment) searchParams.set('hasAttachment', 'true')
    if (params.unread) searchParams.set('unread', 'true')
    if (params.starred) searchParams.set('starred', 'true')
    if (params.dateAfter) searchParams.set('dateAfter', params.dateAfter)
    if (params.dateBefore) searchParams.set('dateBefore', params.dateBefore)

    const res = await fetch(`/api/imap/messages?${searchParams.toString()}`, { credentials: 'include' })
    if (!res.ok) throw new Error('Failed to list IMAP messages')

    const data = await res.json() as {
      messages: Array<{
        uid: string; subject: string
        from: { name: string | null; address: string }
        to: { name: string | null; address: string }[]
        date: string; flags: string[]; hasAttachments: boolean; size: number
      }>
      total: number
    }

    const emails: Email[] = data.messages.map((m) => ({
      id: `imap:${params.folder}:${m.uid}`,
      threadId: `imap:${params.folder}:${m.uid}`,
      subject: m.subject || '(no subject)',
      preview: '',
      from: { name: m.from.name ?? '', email: m.from.address },
      to: m.to.map((t) => ({ name: t.name ?? '', email: t.address })),
      date: new Date(m.date),
      isRead: m.flags.includes('\\Seen'),
      isStarred: m.flags.includes('\\Flagged'),
      hasAttachments: m.hasAttachments,
      labels: m.flags.includes('\\Draft') ? ['DRAFT'] : [],
    }))

    return {
      messages: emails,
      nextPageToken: data.messages.length === 25 ? String(Math.floor(data.total / 25) + 1) : null,
      total: data.total,
    }
  }

  async getMessage(id: string, folder?: string): Promise<EmailDetail> {
    const { mailbox, uid } = parseImapMessageId(id)
    const targetFolder = folder ?? mailbox
    const res = await fetch(`/api/imap/messages/${uid}?folder=${encodeURIComponent(targetFolder)}`, { credentials: 'include' })
    if (!res.ok) throw new Error('Failed to get IMAP message')

    const msg: {
      uid: string; subject: string
      from: { name: string | null; address: string }
      to: { name: string | null; address: string }[]
      date: string; flags: string[]; hasAttachments: boolean
      bodyHtml: string | null; bodyPlain: string | null
      attachments: Array<{ filename: string; contentType: string; size: number; cid?: string }>
      headers: Record<string, string>
      inReplyTo?: string; references?: string[]
    } = await res.json()

    return {
      id: `imap:${targetFolder}:${msg.uid}`,
      threadId: `imap:${targetFolder}:${msg.uid}`,
      subject: msg.subject || '(no subject)',
      preview: '',
      from: { name: msg.from.name ?? '', email: msg.from.address },
      to: msg.to.map((t) => ({ name: t.name ?? '', email: t.address })),
      date: new Date(msg.date),
      body: msg.bodyHtml ?? '',
      bodyPlain: msg.bodyPlain ?? '',
      isRead: msg.flags.includes('\\Seen'),
      isStarred: msg.flags.includes('\\Flagged'),
      labels: msg.flags.includes('\\Draft') ? ['DRAFT'] : [],
      hasAttachments: msg.hasAttachments,
      attachments: msg.attachments.map((a, i) => ({
        id: String(i),
        filename: a.filename,
        mimeType: a.contentType,
        size: a.size,
      })),
      headers: msg.headers,
      inReplyTo: msg.inReplyTo,
      references: msg.references,
    }
  }

  async sendMessage(params: SendMessageParams): Promise<{ id: string }> {
    const res = await fetch('/api/smtp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: params.to,
        cc: params.cc,
        bcc: params.bcc,
        subject: params.subject,
        body: params.body,
        inReplyTo: params.inReplyTo,
        references: params.references,
      }),
      credentials: 'include',
    })
    if (!res.ok) throw new Error('Failed to send email via SMTP')
    return res.json()
  }

  async modifyMessage(id: string, params: {
    archive?: boolean; star?: boolean; markRead?: boolean; markUnread?: boolean
  }): Promise<void> {
    const { mailbox, uid } = parseImapMessageId(id)
    if (params.star !== undefined) {
      await fetch(`/api/imap/messages/${uid}/flags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: mailbox, flagged: params.star }),
        credentials: 'include',
      })
    }
    if (params.markRead !== undefined || params.markUnread !== undefined) {
      await fetch(`/api/imap/messages/${uid}/flags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: mailbox, seen: params.markRead ?? !params.markUnread }),
        credentials: 'include',
      })
    }
  }

  async trashMessage(id: string): Promise<void> {
    const { mailbox, uid } = parseImapMessageId(id)
    await fetch(`/api/imap/messages/${uid}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: mailbox, destination: 'Trash' }),
      credentials: 'include',
    })
  }

  async moveMessage(id: string, folder: string, destination: string): Promise<void> {
    const { mailbox, uid } = parseImapMessageId(id)
    await fetch(`/api/imap/messages/${uid}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: mailbox, destination }),
      credentials: 'include',
    })
  }

  async listFolders(): Promise<MailFolder[]> {
    const res = await fetch('/api/imap/folders', { credentials: 'include' })
    if (!res.ok) throw new Error('Failed to list IMAP folders')
    const data = await res.json() as { folders: Array<{ name: string; path: string; uidValidity: number }> }

    const iconMap: Record<string, string> = {
      'INBOX': 'inbox',
      'Sent': 'send',
      'Sent Messages': 'send',
      'Drafts': 'file',
      'Trash': 'trash',
      'Spam': 'alert-circle',
      'Junk': 'alert-circle',
      'Archive': 'archive',
      'All Mail': 'archive',
    }

    return data.folders.map((f) => ({
      id: f.path,
      name: f.name,
      icon: iconMap[f.name] ?? 'folder',
      unreadCount: 0, // IMAP folders would need separate fetch to get unread counts
    }))
  }

  async getAttachment(messageId: string, attachmentId: string, folder?: string): Promise<{ data: string; mimeType: string; filename: string }> {
    const { mailbox, uid } = parseImapMessageId(messageId)
    const targetFolder = folder ?? mailbox
    // IMAP attachment download — fetch through proxy
    const res = await fetch(
      `/api/imap/messages/${uid}/attachment/${attachmentId}?folder=${encodeURIComponent(targetFolder)}`,
      { credentials: 'include' }
    )
    if (!res.ok) throw new Error('Failed to get IMAP attachment')
    return res.json()
  }
}
