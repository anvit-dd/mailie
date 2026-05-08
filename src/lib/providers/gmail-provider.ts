// Gmail implementation of MailProvider — uses existing Gmail API routes.

import type { MailProvider, ListMessagesParams, ListMessagesResult, EmailDetail, SendMessageParams, MailFolder, Email } from '../mail-provider'

// Gmail API raw message type
interface GmailMessage {
  id: string
  threadId?: string
  snippet?: string
  internalDate?: string
  labelIds?: string[]
  payload?: {
    headers?: Array<{ name: string; value: string }>
    body?: { data?: string; attachmentId?: string; size?: number }
    parts?: Array<{
      filename?: string
      mimeType?: string
      body?: { data?: string; attachmentId?: string; size?: number }
    }>
  }
}

export class GmailProvider implements MailProvider {
  readonly provider = 'gmail' as const

  async listMessages(params: ListMessagesParams): Promise<ListMessagesResult> {
    const url = new URL('/api/gmail/messages', window.location.origin)
    url.searchParams.set('label', params.folder)
    if (params.query) url.searchParams.set('q', params.query)
    if (params.pageToken) url.searchParams.set('pageToken', params.pageToken)
    url.searchParams.set('maxResults', String(params.limit ?? 25))

    const res = await fetch(url.toString(), { credentials: 'include' })
    if (!res.ok) throw new Error('Failed to list Gmail messages')

    const data = await res.json() as { messages?: Array<{ id: string }>; nextPageToken?: string | null }

    if (!data.messages?.length) return { messages: [], nextPageToken: null }

    // Batch fetch envelope data for all message IDs
    const batchRes = await fetch('/api/gmail/messages/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: data.messages.map((m) => m.id) }),
      credentials: 'include',
    })

    if (!batchRes.ok) throw new Error('Failed to batch fetch Gmail messages')
    const { messages: rawMessages } = await batchRes.json() as { messages: GmailMessage[] }

    const emails: Email[] = rawMessages.map((m) => {
      const headers = m.payload?.headers
      const fromHeader = headers?.find((h) => h.name.toLowerCase() === 'from')
      const subjectHeader = headers?.find((h) => h.name.toLowerCase() === 'subject')
      const fromMatch = fromHeader?.value?.match(/<(.*?)>/)
      return {
        id: m.id,
        threadId: m.threadId ?? m.id,
        subject: subjectHeader?.value ?? '(no subject)',
        preview: m.snippet ?? '',
        from: {
          name: fromHeader?.value?.replace(/<.*?>/, '').trim() ?? '',
          email: fromMatch?.[1] ?? fromHeader?.value ?? '',
        },
        to: [],
        date: new Date(m.internalDate ? parseInt(m.internalDate, 10) : Date.now()),
        isRead: !(m.labelIds?.includes('UNREAD')),
        isStarred: m.labelIds?.includes('STARRED') ?? false,
        hasAttachments: m.payload?.parts?.some((p) => Boolean(p.filename)) ?? false,
        labels: m.labelIds ?? [],
      }
    })

    return { messages: emails, nextPageToken: data.nextPageToken ?? null }
  }

  async getMessage(id: string): Promise<EmailDetail> {
    const res = await fetch(`/api/gmail/messages?id=${encodeURIComponent(id)}`, { credentials: 'include' })
    if (!res.ok) throw new Error('Failed to get Gmail message')
    const m: GmailMessage = await res.json()

    const headers = m.payload?.headers
    const fromHeader = headers?.find((h) => h.name.toLowerCase() === 'from')
    const subjectHeader = headers?.find((h) => h.name.toLowerCase() === 'subject')
    const toHeader = headers?.find((h) => h.name.toLowerCase() === 'to')
    const inReplyToHeader = headers?.find((h) => h.name.toLowerCase() === 'in-reply-to')
    const referencesHeader = headers?.find((h) => h.name.toLowerCase() === 'references')
    const fromMatch = fromHeader?.value?.match(/<(.*?)>/)

    // Extract body
    let body = ''
    let bodyPlain = ''
    const parts = m.payload?.parts ?? []

    for (const part of parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        body = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'))
        break
      }
    }
    if (!body) {
      for (const part of parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          bodyPlain = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'))
          break
        }
      }
    }

    // Attachments
    const attachments = (m.payload?.parts ?? [])
      .filter((p) => Boolean(p.filename) && p.body?.attachmentId)
      .map((p) => ({
        id: p.body!.attachmentId!,
        filename: p.filename!,
        mimeType: p.mimeType ?? 'application/octet-stream',
        size: p.body?.size ?? 0,
      }))

    return {
      id: m.id,
      threadId: m.threadId ?? m.id,
      subject: subjectHeader?.value ?? '(no subject)',
      preview: m.snippet ?? '',
      from: {
        name: fromHeader?.value?.replace(/<.*?>/, '').trim() ?? '',
        email: fromMatch?.[1] ?? fromHeader?.value ?? '',
      },
      to: toHeader?.value ? [{ name: '', email: toHeader.value }] : [],
      date: new Date(m.internalDate ? parseInt(m.internalDate, 10) : Date.now()),
      body,
      bodyPlain,
      isRead: !(m.labelIds?.includes('UNREAD')),
      isStarred: m.labelIds?.includes('STARRED') ?? false,
      labels: m.labelIds ?? [],
      hasAttachments: attachments.length > 0,
      attachments,
      inReplyTo: inReplyToHeader?.value,
      references: referencesHeader?.value?.split(' ').filter(Boolean),
    }
  }

  async sendMessage(params: SendMessageParams): Promise<{ id: string }> {
    const res = await fetch('/api/gmail/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: params.to,
        cc: params.cc,
        bcc: params.bcc,
        subject: params.subject,
        body: params.body,
        replyTo: params.replyTo,
        inReplyTo: params.inReplyTo,
        references: params.references,
      }),
      credentials: 'include',
    })
    if (!res.ok) throw new Error('Failed to send Gmail message')
    return res.json()
  }

  async modifyMessage(id: string, params: {
    archive?: boolean; star?: boolean; markRead?: boolean; markUnread?: boolean
  }): Promise<void> {
    const addLabels: string[] = []
    const removeLabels: string[] = []
    if (params.archive) { addLabels.push('ARCHIVE'); removeLabels.push('INBOX') }
    if (params.star) addLabels.push('STARRED')
    else if (params.star === false) removeLabels.push('STARRED')
    if (params.markRead) removeLabels.push('UNREAD')
    if (params.markUnread) addLabels.push('UNREAD')

    const res = await fetch('/api/gmail/modify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: id, addLabels, removeLabels }),
      credentials: 'include',
    })
    if (!res.ok) throw new Error('Failed to modify Gmail message')
  }

  async trashMessage(id: string): Promise<void> {
    const res = await fetch('/api/gmail/trash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: id }),
      credentials: 'include',
    })
    if (!res.ok) throw new Error('Failed to trash Gmail message')
  }

  async moveMessage(id: string, _folder: string, destination: string): Promise<void> {
    if (destination === 'Archive') {
      await this.modifyMessage(id, { archive: true })
      return
    }
    if (destination === 'Trash') {
      await this.trashMessage(id)
      return
    }
    // General label apply
    const res = await fetch('/api/gmail/modify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: id, addLabels: [destination.toUpperCase()], removeLabels: [] }),
      credentials: 'include',
    })
    if (!res.ok) throw new Error('Failed to move Gmail message')
  }

  async listFolders(): Promise<MailFolder[]> {
    const res = await fetch('/api/gmail/labels', { credentials: 'include' })
    if (!res.ok) throw new Error('Failed to list Gmail labels')
    const data = await res.json() as { labels: Array<{ id: string; name: string; messagesTotalThreads?: number; messagesUnreadCount?: number }> }

    const iconMap: Record<string, string> = {
      'INBOX': 'inbox',
      'SENT': 'send',
      'DRAFT': 'file',
      'TRASH': 'trash',
      'SPAM': 'alert-circle',
      'STARRED': 'star',
      'ARCHIVE': 'archive',
      'IMPORTANT': 'flag',
    }

    return data.labels.map((label) => ({
      id: label.id,
      name: label.name,
      icon: iconMap[label.id] ?? 'folder',
      unreadCount: label.messagesUnreadCount ?? 0,
    }))
  }

  async getAttachment(messageId: string, attachmentId: string): Promise<{ data: string; mimeType: string; filename: string }> {
    const res = await fetch(`/api/gmail/attachment?messageId=${encodeURIComponent(messageId)}&attachmentId=${encodeURIComponent(attachmentId)}`, { credentials: 'include' })
    if (!res.ok) throw new Error('Failed to get Gmail attachment')
    return res.json()
  }
}