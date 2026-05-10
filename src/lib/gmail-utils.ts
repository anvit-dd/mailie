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
  snippet?: string
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
    // Normalize line endings first
    .replace(/\r\n?/g, '\n')
    // Drop non-content blocks before removing tags so CSS/JS text is not displayed
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, '')
    // Convert structural tags to explicit line breaks
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<(p|div|li|tr|h[1-6])[^>]*>/gi, '\n')
    // Remove all remaining tags without adding spaces that flatten lines
    .replace(/<[^>]*>/g, '')
    // Collapse spaces/tabs only (preserve \n)
    .replace(/[ \t\f\v\u00a0]+/g, ' ')
    // Trim spacing around line breaks
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    // Collapse very large vertical gaps
    .replace(/\n{3,}/g, '\n\n')
    // Strip leading/trailing whitespace from each line
    .split('\n')
    .map((line) => line.trim())
    // Keep intentional blank lines, but remove trailing-only empties
    .filter((line, index, arr) => !(line.length === 0 && index === arr.length - 1))
    .join('\n')
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
  const previewSource = message.snippet?.trim() || bodyPlain

  return {
    id: message.id,
    threadId: message.threadId,
    from,
    to: toHeader.split(',').map((recipient) => parseEmailAddress(recipient.trim())),
    subject: subject || '(no subject)',
    preview: (() => {
      const source = previewSource
      if (!source) return ''
      // Extract only the NEW content (after last --- Original Message ---) for the preview
      const parts = source.split(/--- Original Message ---\s*/i)
      const latestContent = parts[parts.length - 1].trim()
      return latestContent.slice(0, 120)
    })(),
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
  const fromAddress = parseEmailAddress(getHeader(headers, 'From'))
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
    from: fromAddress,
    to: toHeader.split(',').map((recipient) => parseEmailAddress(recipient.trim())),
    subject: subject || '(no subject)',
    preview: (() => {
      const parts = bodyPlain.split(/--- Original Message ---\s*/i)
      return parts[parts.length - 1].trim().slice(0, 120)
    })(),
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
    { id: 'STARRED', name: 'Starred', icon: 'star', unreadCount: 0 },
    { id: 'SPAM', name: 'Spam', icon: 'spam', unreadCount: 0 },
    { id: 'SENT', name: 'Sent', icon: 'send', unreadCount: 0 },
    { id: 'DRAFT', name: 'Drafts', icon: 'file', unreadCount: 0 },
    { id: 'TRASH', name: 'Trash', icon: 'trash', unreadCount: 0 },
  ]
}
