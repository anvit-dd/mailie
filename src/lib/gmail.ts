import type { GmailMessage, GmailMessagePayload } from '@/lib/gmail-utils'

const BASE_URL = 'https://gmail.googleapis.com/gmail/v1/users/me'

interface GmailApiError {
  error?: {
    message?: string
  }
}

interface GmailMessageRef {
  id: string
  threadId: string
}

async function readJson<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>
}

async function fetchWithAuth(url: string, accessToken: string, options: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as GmailApiError
    throw new Error(error.error?.message || 'Gmail API error')
  }

  return response
}

export async function getProfile(
  accessToken: string
): Promise<{ emailAddress: string; messagesTotal: number; threadsTotal: number }> {
  const response = await fetchWithAuth(`${BASE_URL}/profile`, accessToken)
  return readJson(response)
}

export async function listMessages(
  accessToken: string,
  label?: string,
  pageToken?: string,
  maxResults = 25
): Promise<{ messages: GmailMessageRef[]; nextPageToken?: string; resultSizeEstimate?: number }> {
  const params = new URLSearchParams({
    maxResults: maxResults.toString(),
  })

  if (label) {
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
  return readJson(response)
}

export async function getMessage(accessToken: string, messageId: string): Promise<GmailMessage> {
  const response = await fetchWithAuth(`${BASE_URL}/messages/${messageId}?format=full`, accessToken)
  return readJson(response)
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

export async function sendEmail(accessToken: string, params: SendEmailParams): Promise<GmailMessageRef> {
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
  const encodedMessage = btoa(emailContent).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  const response = await fetchWithAuth(`${BASE_URL}/messages/send`, accessToken, {
    method: 'POST',
    body: JSON.stringify({ raw: encodedMessage }),
  })

  return readJson(response)
}

export async function modifyMessage(
  accessToken: string,
  messageId: string,
  addLabels: string[] = [],
  removeLabels: string[] = []
): Promise<void> {
  const body: { addLabelIds?: string[]; removeLabelIds?: string[] } = {}

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

export type { GmailMessage, GmailMessagePayload }
