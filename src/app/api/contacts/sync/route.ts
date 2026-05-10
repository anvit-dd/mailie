import { NextRequest, NextResponse } from 'next/server'
import { getSession, getAccountWithTokens } from '@/lib/session'
import { getValidGmailAccessToken } from '@/lib/gmail'

const MAX_PAGES = 8
const MESSAGES_PER_PAGE = 100
const METADATA_CONCURRENCY = 12
const TIMEOUT_MS = 5000
const SCAN_BUDGET_MS = 12000

interface Contact {
  name: string
  email: string
}

interface GmailListResponse {
  messages?: Array<{ id: string }>
  nextPageToken?: string
}

interface GmailMetadataResponse {
  payload?: {
    headers?: Array<{ name: string; value: string }>
  }
}

function extractHeaderContacts(headerValue: string | undefined): Contact[] {
  if (!headerValue) return []

  const contacts: Contact[] = []
  const addressPattern = /(?:"?([^"<,]*)"?\s*)?<([^<>@\s]+@[^<>@\s]+)>|([^<>,\s]+@[^<>,\s]+)/g
  let match: RegExpExecArray | null

  while ((match = addressPattern.exec(headerValue)) !== null) {
    const email = match[2] || match[3]
    const name = (match[1] || '').trim()
    if (email) contacts.push({ email, name })
  }

  return contacts
}

function addContact(
  contacts: Map<string, Contact>,
  ownEmail: string,
  contact: Contact
) {
  const email = contact.email.trim()
  if (!email || email.toLowerCase() === ownEmail.toLowerCase()) return

  const key = email.toLowerCase()
  const existing = contacts.get(key)
  if (!existing || (!existing.name && contact.name)) {
    contacts.set(key, { email, name: contact.name.trim() })
  }
}

async function fetchWithTimeout(url: string, accessToken: string): Promise<Response | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    })
    return response
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get('session')?.value
  if (!sessionId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const session = getSession(sessionId)
  if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const account = getAccountWithTokens(session.account_id)
  if (!account?.gmailTokens) return NextResponse.json({ error: 'No Gmail connection' }, { status: 401 })

  const accessToken = await getValidGmailAccessToken(session.account_id)
  const startedAt = Date.now()
  const contacts = new Map<string, Contact>()
  const ids: string[] = []
  let pageToken: string | undefined

  for (let page = 0; page < MAX_PAGES; page++) {
    if (Date.now() - startedAt > SCAN_BUDGET_MS) break

    const params = new URLSearchParams({
      maxResults: String(MESSAGES_PER_PAGE),
      includeSpamTrash: 'false',
    })
    if (pageToken) params.set('pageToken', pageToken)

    const listResponse = await fetchWithTimeout(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
      accessToken
    )
    if (!listResponse?.ok) break

    const listData = await listResponse.json() as GmailListResponse
    if (!listData.messages?.length) break

    ids.push(...listData.messages.map((message) => message.id))
    pageToken = listData.nextPageToken
    if (!pageToken) break
  }

  for (let index = 0; index < ids.length; index += METADATA_CONCURRENCY) {
    if (Date.now() - startedAt > SCAN_BUDGET_MS) break

    const chunk = ids.slice(index, index + METADATA_CONCURRENCY)
    const results = await Promise.allSettled(
      chunk.map(async (id): Promise<GmailMetadataResponse | null> => {
        const params = new URLSearchParams({ format: 'metadata' })
        for (const header of ['From', 'To', 'Cc', 'Bcc']) {
          params.append('metadataHeaders', header)
        }

        const metadataResponse = await fetchWithTimeout(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?${params}`,
          accessToken
        )
        if (!metadataResponse?.ok) return null
        return metadataResponse.json() as Promise<GmailMetadataResponse>
      })
    )

    for (const result of results) {
      if (result.status !== 'fulfilled') continue

      const headers = result.value?.payload?.headers ?? []
      for (const headerName of ['from', 'to', 'cc', 'bcc']) {
        const headerValue = headers.find((header) => header.name.toLowerCase() === headerName)?.value
        for (const contact of extractHeaderContacts(headerValue)) {
          addContact(contacts, account.email, contact)
        }
      }
    }
  }

  return NextResponse.json({
    contacts: [...contacts.values()],
    nextPageToken: pageToken ?? null,
    scanned: ids.length,
  })
}
