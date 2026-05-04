import { Email, EmailDetail, Folder, Attachment, EmailAddress } from '@/types/email'

const BASE_URL = 'https://gmail.googleapis.com/gmail/v1/users/me'

async function fetchWithAuth(url: string, accessToken: string, options: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || 'Gmail API error')
  }

  return response
}

export async function getProfile(accessToken: string): Promise<{ emailAddress: string; messagesTotal: number; threadsTotal: number }> {
  const response = await fetchWithAuth(`${BASE_URL}/profile`, accessToken)
  return response.json()
}

export async function listMessages(
  accessToken: string,
  label?: string,
  pageToken?: string,
  maxResults = 25
): Promise<{ messages: { id: string; threadId: string }[]; nextPageToken?: string; resultSizeEstimate?: number }> {
  const params = new URLSearchParams({
    maxResults: maxResults.toString(),
  })

  if (label) {
    // Map folder IDs to Gmail label IDs
    const labelMap: Record<string, string> = {
      INBOX: 'INBOX',
      SENT: 'SENT',
      DRAFT: 'DRAFT',
      TRASH: 'TRASH',
    }
    params.set('labelIds', labelMap[label] || label)
  }

  if (pageToken) {
    params.set('pageToken', pageToken)
  }

  const response = await fetchWithAuth(`${BASE_URL}/messages?${params.toString()}`, accessToken)
  return response.json()
}

export async function getMessage(accessToken: string, messageId: string): Promise<any> {
  const response = await fetchWithAuth(`${BASE_URL}/messages/${messageId}?format=full`, accessToken)
  return response.json()
}

function decodeBase64Url(base64Url: string): string {
  // Replace URL-safe characters and add padding
  const base64 = base64Url
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(base64Url.length + (4 - (base64Url.length % 4)) % 4, '=')

  // Decode in browser-safe way
  if (typeof window !== 'undefined') {
    return decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
  }

  // Node.js environment
  const { Buffer } = require('buffer')
  return Buffer.from(base64, 'base64').toString('utf-8')
}

function getHeader(headers: any[], name: string): string {
  const header = headers.find((h) => h.name.toLowerCase() === name.toLowerCase())
  return header?.value || ''
}

function parseEmailAddress(headerValue: string): EmailAddress {
  // Handle formats: "Name <email@domain.com>" or "email@domain.com"
  const match = headerValue.match(/^(.+?)\s*<(.+)>$/)
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() }
  }
  return { name: '', email: headerValue.trim() }
}

function extractBody(payload: any): { body: string; bodyPlain: string } {
  if (!payload) return { body: '', bodyPlain: '' }

  const { body, parts } = payload

  // Single part message
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

  // Multi-part message - find the best body
  for (const part of parts) {
    if (part.mimeType === 'text/html') {
      const data = part.body?.data
      if (data) {
        const decoded = decodeBase64Url(data)
        return { body: decoded, bodyPlain: stripHtml(decoded) }
      }
    }
  }

  // Fall back to plain text
  for (const part of parts) {
    if (part.mimeType === 'text/plain') {
      const data = part.body?.data
      if (data) {
        const decoded = decodeBase64Url(data)
        return { body: '', bodyPlain: decoded }
      }
    }
  }

  // Try nested parts
  for (const part of parts) {
    if (part.parts) {
      const nested = extractBody(part)
      if (nested.body || nested.bodyPlain) {
        return nested
      }
    }
  }

  return { body: '', bodyPlain: '' }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractAttachments(payload: any, accessToken: string): Attachment[] {
  const attachments: Attachment[] = []

  function traverseParts(parts: any[]): void {
    for (const part of parts) {
      if (part.filename && part.body?.attachmentId) {
        attachments.push({
          id: part.body.attachmentId,
          filename: part.filename,
          mimeType: part.mimeType,
          size: parseInt(part.body.size || '0'),
          url: `${BASE_URL}/messages/${payload.messageId || 'unknown'}/attachments/${part.body.attachmentId}`,
        })
      }

      if (part.parts) {
        traverseParts(part.parts)
      }
    }
  }

  if (payload.parts) {
    traverseParts(payload.parts)
  }

  return attachments
}

export async function getEmailDetail(accessToken: string, messageId: string): Promise<EmailDetail> {
  const message = await getMessage(accessToken, messageId)

  const headers = message.payload?.headers || []
  const subject = getHeader(headers, 'Subject')
  const from = parseEmailAddress(getHeader(headers, 'From'))
  const toHeader = getHeader(headers, 'To')
  const dateStr = getHeader(headers, 'Date')
  const references = getHeader(headers, 'References')
  const inReplyTo = getHeader(headers, 'In-Reply-To')
  const messageIdHeader = getHeader(headers, 'Message-ID')

  const { body, bodyPlain } = extractBody(message.payload)
  const attachments = extractAttachments(message.payload, accessToken)

  // Check for attachments in the main body
  const hasAttachments = attachments.length > 0 ||
    message.payload?.parts?.some((p: any) => p.filename) ||
    message.payload?.body?.attachmentId

  // Parse labels (Gmail-specific)
  const labelIds = message.labelIds || []
  const labelNames = labelIds
    .filter((id: string) => !['INBOX', 'UNREAD', 'CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL', 'CATEGORY_UPDATES', 'CATEGORY_FORUMS'].includes(id))
    .map((id: string) => id.toLowerCase())

  const isRead = !labelIds.includes('UNREAD')
  const isStarred = labelIds.includes('STARRED')

  return {
    id: message.id,
    threadId: message.threadId,
    from,
    to: toHeader.split(',').map((t: string) => parseEmailAddress(t.trim())),
    subject: subject || '(no subject)',
    preview: bodyPlain.slice(0, 120) || body.replace(/<[^>]*>/g, '').slice(0, 120),
    date: new Date(dateStr),
    isRead,
    isStarred,
    labels: labelNames,
    hasAttachments,
    body,
    bodyPlain,
    attachments,
    headers: Object.fromEntries(headers.map((h: any) => [h.name, h.value])),
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

export interface SendEmailParams {
  to: string[]
  subject: string
  body: string
  inReplyTo?: string
  references?: string
  cc?: string[]
  bcc?: string[]
}

export async function sendEmail(accessToken: string, params: SendEmailParams): Promise<{ id: string; threadId: string }> {
  // Build the email MIME message
  const lines: string[] = []

  lines.push(`To: ${params.to.join(', ')}`)

  if (params.cc && params.cc.length > 0) {
    lines.push(`Cc: ${params.cc.join(', ')}`)
  }

  if (params.bcc && params.bcc.length > 0) {
    lines.push(`Bcc: ${params.bcc.join(', ')}`)
  }

  lines.push(`Subject: ${params.subject}`)
  lines.push('Content-Type: text/html; charset=utf-8')
  lines.push('MIME-Version: 1.0')

  if (params.inReplyTo) {
    lines.push(`In-Reply-To: ${params.inReplyTo}`)
  }

  if (params.references) {
    lines.push(`References: ${params.references}`)
  }

  lines.push('')
  lines.push(params.body)

  const emailContent = lines.join('\r\n')
  const encodedMessage = btoa(emailContent)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const response = await fetchWithAuth(`${BASE_URL}/messages/send`, accessToken, {
    method: 'POST',
    body: JSON.stringify({ raw: encodedMessage }),
  })

  return response.json()
}

export async function modifyMessage(
  accessToken: string,
  messageId: string,
  addLabels: string[] = [],
  removeLabels: string[] = []
): Promise<void> {
  const body: any = {}

  if (addLabels.length > 0) {
    body.addLabelIds = addLabels
  }

  if (removeLabels.length > 0) {
    body.removeLabelIds = removeLabels
  }

  await fetchWithAuth(`${BASE_URL}/messages/${messageId}/modify`, accessToken, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function trashMessage(accessToken: string, messageId: string): Promise<void> {
  await fetchWithAuth(`${BASE_URL}/messages/${messageId}/trash`, accessToken, {
    method: 'POST',
  })
}

export async function untrashMessage(accessToken: string, messageId: string): Promise<void> {
  await fetchWithAuth(`${BASE_URL}/messages/${messageId}/modify`, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      removeLabelIds: ['TRASH'],
    }),
  })
}

export async function markAsRead(accessToken: string, messageId: string): Promise<void> {
  await modifyMessage(accessToken, messageId, [], ['UNREAD'])
}

export async function markAsUnread(accessToken: string, messageId: string): Promise<void> {
  await modifyMessage(accessToken, messageId, ['UNREAD'], [])
}

export async function starMessage(accessToken: string, messageId: string): Promise<void> {
  await modifyMessage(accessToken, messageId, ['STARRED'], [])
}

export async function unstarMessage(accessToken: string, messageId: string): Promise<void> {
  await modifyMessage(accessToken, messageId, [], ['STARRED'])
}
