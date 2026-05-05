import type { GmailMessage, GmailMessagePayload } from '@/lib/gmail-utils'
import { getAccountWithTokens } from '@/lib/session'
import { getGmailClientId, getGmailClientSecret } from '@/lib/gmail-config'
import { db } from '@/lib/db'

const BASE_URL = 'https://gmail.googleapis.com/gmail/v1/users/me'

// Returns a valid access token, refreshing if expired or about to expire.
// Call this BEFORE every Gmail API call instead of using account.gmailTokens.access_token directly.
export async function getValidGmailAccessToken(accountId: string): Promise<string> {
  const account = getAccountWithTokens(accountId)
  if (!account?.gmailTokens?.refresh_token) {
    throw new Error('No Gmail refresh token')
  }

  const now = Date.now()
  const bufferMs = 5 * 60 * 1000 // refresh 5 min before expiry

  // Token is still valid (with 5-min buffer)
  if (account.gmailTokens.expires_at > now + bufferMs) {
    return account.gmailTokens.access_token
  }

  // Token expired or about to expire — refresh it
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: getGmailClientId(),
      client_secret: getGmailClientSecret(),
      refresh_token: account.gmailTokens.refresh_token,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    throw new Error('Token refresh failed')
  }

  const tokens = await response.json()
  const newExpiresAt = Date.now() + tokens.expires_in * 1000

  db.prepare(`
    UPDATE gmail_tokens SET access_token = ?, expires_at = ?, updated_at = ? WHERE account_id = ?
  `).run(tokens.access_token, newExpiresAt, Date.now(), account.id)

  return tokens.access_token
}

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
