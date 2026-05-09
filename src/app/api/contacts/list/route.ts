// GET /api/contacts/list
// Returns a deduplicated list of all email addresses the user has
// sent to or received from — built from their actual email history.

import { NextRequest, NextResponse } from 'next/server'
import { getSession, getAccountWithTokens } from '@/lib/session'
import { getValidGmailAccessToken } from '@/lib/gmail'

function extractEmails(headerValue: string | undefined): string[] {
  if (!headerValue) return []
  const matches = (headerValue.match(/[^\s<>,]+@[^\s<>,]+/g) as string[]) ?? []
  // Dedupe while preserving order
  const seen = new Set<string>()
  return matches.filter((e) => {
    const lower = e.toLowerCase()
    if (seen.has(lower)) return false
    seen.add(lower)
    return true
  })
}

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get('session')?.value
  if (!sessionId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const session = getSession(sessionId)
  if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const account = getAccountWithTokens(session.account_id)
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 401 })

  const accessToken = await getValidGmailAccessToken(session.account_id)
  const emailMap = new Map<string, { name: string; email: string }>()
  let pageToken: string | undefined
  const maxPages = 3  // 3 pages × 100 = 300 messages; plenty for autocomplete
  const messagesPerPage = 100

  const TIMEOUT_MS = 8000 // per-page Gmail API timeout

  async function fetchWithTimeout(url: string, token: string): Promise<Response | null> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      })
      clearTimeout(timer)
      return res
    } catch {
      clearTimeout(timer)
      return null
    }
  }

  try {
    for (let page = 0; page < maxPages; page++) {
      const params = new URLSearchParams({
        maxResults: String(messagesPerPage),
        includeSpamTrash: 'false',
      })
      if (pageToken) params.set('pageToken', pageToken)

      const listRes = await fetchWithTimeout(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
        accessToken
      )
      if (!listRes?.ok) break

      const listData = await listRes.json() as {
        messages?: Array<{ id: string }>
        nextPageToken?: string
      }
      if (!listData.messages?.length) break

      const ids = listData.messages.map((m) => m.id)

      // Fetch headers sequentially to avoid burst rate-limiting
      const METADATA_HEADERS = 'From,To,Cc,Bcc'
      for (const id of ids) {
        const metaRes = await fetchWithTimeout(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=${METADATA_HEADERS}`,
          accessToken
        )
        if (!metaRes) continue
        const msg = await metaRes.json().catch(() => null)
        if (!msg?.payload?.headers) continue
        const headers = msg.payload.headers as Array<{ name: string; value: string }>
        const from = extractEmails(headers.find((h) => h.name.toLowerCase() === 'from')?.value)
        const to = extractEmails(headers.find((h) => h.name.toLowerCase() === 'to')?.value)
        const cc = extractEmails(headers.find((h) => h.name.toLowerCase() === 'cc')?.value)
        for (const email of [...to, ...cc, ...from]) {
          if (email && email !== account.email) {
            emailMap.set(email.toLowerCase(), { name: '', email })
          }
        }
      }

      pageToken = listData.nextPageToken
      if (!pageToken) break
    }
  } catch (err) {
    console.error('contacts/list error:', err)
  }

  const contacts = [...emailMap.values()].map(({ name, email }) => ({ name, email }))
  return NextResponse.json({ contacts })
}