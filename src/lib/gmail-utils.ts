import type { Attachment, Email, EmailAddress, EmailDetail, Folder } from '@/types/email'

export interface GmailMessageHeader {
  name: string
  value: string
}

export interface GmailMessageBody {
  data?: string
  attachmentId?: string
  size?: number | string
}

export interface GmailMessagePart {
  mimeType?: string
  filename?: string
  body?: GmailMessageBody
  parts?: GmailMessagePart[]
}

export interface GmailMessagePayload {
  mimeType?: string
  body?: GmailMessageBody
  parts?: GmailMessagePart[]
  headers?: GmailMessageHeader[]
}

export interface GmailMessage {
  id: string
  threadId: string
  labelIds?: string[]
  payload?: GmailMessagePayload
}

function decodeUtf8(bytes: string): string {
  if (typeof atob === 'function') {
    return decodeURIComponent(
      atob(bytes)
        .split('')
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join('')
    )
  }

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes, 'base64').toString('utf-8')
  }

  return ''
}

export function decodeBase64Url(base64Url: string): string {
  const base64 = base64Url
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(base64Url.length + (4 - (base64Url.length % 4)) % 4, '=')

  return decodeUtf8(base64)
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

export function stripHtml(html: string): string {
  return decodeHtmlEntities(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function getHeader(headers: GmailMessageHeader[], name: string): string {
  const header = headers.find((item) => item.name.toLowerCase() === name.toLowerCase())
  return header?.value ?? ''
}

export function parseEmailAddress(headerValue: string): EmailAddress {
  const match = headerValue.match(/^(.+?)\s*<(.+)>$/)
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() }
  }

  return { name: '', email: headerValue.trim() }
}

export function extractBody(payload?: GmailMessagePayload): { body: string; bodyPlain: string } {
  if (!payload) return { body: '', bodyPlain: '' }

  const { body, parts } = payload

  if (!parts) {
    const data = body?.data
    if (!data) return { body: '', bodyPlain: '' }

    const decoded = decodeBase64Url(data)
    const mimeType = payload.mimeType || 'text/plain'

    if (mimeType === 'text/html') {
      return { body: decoded, bodyPlain: stripHtml(decoded) }
    }

    return { body: '', bodyPlain: decoded }
  }

  for (const part of parts) {
    if (part.mimeType === 'text/html') {
      const data = part.body?.data
      if (data) {
        const decoded = decodeBase64Url(data)
        return { body: decoded, bodyPlain: stripHtml(decoded) }
      }
    }
  }

  for (const part of parts) {
    if (part.mimeType === 'text/plain') {
      const data = part.body?.data
      if (data) {
        const decoded = decodeBase64Url(data)
        return { body: '', bodyPlain: decoded }
      }
    }
  }

  for (const part of parts) {
    if (part.parts) {
      const nested = extractBody(part)
      if (nested.body || nested.bodyPlain) return nested
    }
  }

  return { body: '', bodyPlain: '' }
}

export function extractAttachments(payload: GmailMessagePayload | undefined, messageId: string): Attachment[] {
  const attachments: Attachment[] = []

  function traverse(parts: GmailMessagePart[]): void {
    for (const part of parts) {
      if (part.filename && part.body?.attachmentId) {
        attachments.push({
          id: part.body.attachmentId,
          filename: part.filename,
          mimeType: part.mimeType ?? 'application/octet-stream',
          size: Number.parseInt(String(part.body.size ?? '0'), 10),
          url: `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${part.body.attachmentId}`,
        })
      }

      if (part.parts) {
        traverse(part.parts)
      }
    }
  }

  if (payload?.parts) {
    traverse(payload.parts)
  }

  return attachments
}

export function gmailMessageToEmail(message: GmailMessage): Email {
  const headers = message.payload?.headers ?? []
  const subject = getHeader(headers, 'Subject')
  const from = parseEmailAddress(getHeader(headers, 'From'))
  const toHeader = getHeader(headers, 'To')
  const dateStr = getHeader(headers, 'Date')
  const labelIds = message.labelIds ?? []
  const { bodyPlain } = extractBody(message.payload)
  const hasAttachments = Boolean(
    message.payload?.parts?.some((part) => Boolean(part.filename)) || message.payload?.body?.attachmentId
  )

  return {
    id: message.id,
    threadId: message.threadId,
    from,
    to: toHeader.split(',').map((recipient) => parseEmailAddress(recipient.trim())),
    subject: subject || '(no subject)',
    preview: bodyPlain.slice(0, 120),
    date: new Date(dateStr),
    isRead: !labelIds.includes('UNREAD'),
    isStarred: labelIds.includes('STARRED'),
    labels: labelIds.filter(
      (id) => !['INBOX', 'UNREAD', 'CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL', 'CATEGORY_UPDATES', 'CATEGORY_FORUMS'].includes(id)
    ),
    hasAttachments,
  }
}

export function gmailMessageToDetail(message: GmailMessage): EmailDetail {
  const headers = message.payload?.headers ?? []
  const subject = getHeader(headers, 'Subject')
  const from = parseEmailAddress(getHeader(headers, 'From'))
  const toHeader = getHeader(headers, 'To')
  const dateStr = getHeader(headers, 'Date')
  const references = getHeader(headers, 'References')
  const inReplyTo = getHeader(headers, 'In-Reply-To')
  const labelIds = message.labelIds ?? []
  const { body, bodyPlain } = extractBody(message.payload)
  const attachments = extractAttachments(message.payload, message.id)
  const hasAttachments = attachments.length > 0 || Boolean(
    message.payload?.parts?.some((part) => Boolean(part.filename)) || message.payload?.body?.attachmentId
  )

  return {
    id: message.id,
    threadId: message.threadId,
    from,
    to: toHeader.split(',').map((recipient) => parseEmailAddress(recipient.trim())),
    subject: subject || '(no subject)',
    preview: bodyPlain.slice(0, 120) || body.replace(/<[^>]*>/g, '').slice(0, 120),
    date: new Date(dateStr),
    isRead: !labelIds.includes('UNREAD'),
    isStarred: labelIds.includes('STARRED'),
    labels: labelIds.filter(
      (id) => !['INBOX', 'UNREAD', 'CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL', 'CATEGORY_UPDATES', 'CATEGORY_FORUMS'].includes(id)
    ),
    hasAttachments,
    body,
    bodyPlain,
    attachments,
    headers: Object.fromEntries(headers.map((header) => [header.name, header.value])),
    references: references ? references.split(/\s+/).filter(Boolean) : undefined,
    inReplyTo,
  }
}

export function getFolders(): Folder[] {
  return [
    { id: 'INBOX', name: 'Inbox', icon: 'inbox', unreadCount: 0 },
    { id: 'SENT', name: 'Sent', icon: 'send', unreadCount: 0 },
    { id: 'DRAFT', name: 'Drafts', icon: 'file', unreadCount: 0 },
    { id: 'TRASH', name: 'Trash', icon: 'trash', unreadCount: 0 },
  ]
}
