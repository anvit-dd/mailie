// GET /api/gmail/thread?threadId=xxx
// Fetches all messages in a Gmail thread using Gmail API threads.get.

import { NextRequest, NextResponse } from 'next/server'
import { getSession, getAccountWithTokens } from '@/lib/session'
import { getValidGmailAccessToken } from '@/lib/gmail'

async function requireAuth(request: NextRequest) {
  const sessionId = request.cookies.get('session')?.value
  if (!sessionId) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), account: null, accountId: null }
  const session = getSession(sessionId)
  if (!session) return { error: NextResponse.json({ error: 'Invalid session' }, { status: 401 }), account: null, accountId: null }
  const account = getAccountWithTokens(session.account_id)
  if (!account?.gmailTokens) return { error: NextResponse.json({ error: 'No Gmail connection' }, { status: 401 }), account: null, accountId: null }
  return { error: null, account, accountId: session.account_id }
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth.error) return auth.error

  const accessToken = await getValidGmailAccessToken(auth.accountId!)

  const threadId = request.nextUrl.searchParams.get('threadId')
  if (!threadId) return NextResponse.json({ error: 'threadId required' }, { status: 400 })

  const url = `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=FULL`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: `Gmail API error: ${err}` }, { status: 502 })
  }

  const thread = await res.json() as {
    id: string
    messages: Array<{
      id: string; threadId: string; snippet: string; internalDate: string
      labelIds?: string[]
      payload: {
        headers: Array<{ name: string; value: string }>
        body?: { data?: string }
        parts?: Array<{
          filename?: string; mimeType?: string
          body?: { data?: string; attachmentId?: string; size?: number }
        }>
      }
    }>
  }

  const messages = thread.messages.map((m) => {
    const headers = m.payload.headers
    const fromHeader = headers.find((h) => h.name.toLowerCase() === 'from')
    const subjectHeader = headers.find((h) => h.name.toLowerCase() === 'subject')
    const toHeader = headers.find((h) => h.name.toLowerCase() === 'to')
    const inReplyToHeader = headers.find((h) => h.name.toLowerCase() === 'in-reply-to')
    const referencesHeader = headers.find((h) => h.name.toLowerCase() === 'references')
    const fromMatch = fromHeader?.value?.match(/<(.*?)>/)

    let body = ''
    let bodyPlain = ''
    for (const part of (m.payload.parts ?? [])) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        body = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'))
        break
      }
    }
    if (!body) {
      for (const part of (m.payload.parts ?? [])) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          bodyPlain = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'))
          break
        }
      }
    }

    const attachments = (m.payload.parts ?? [])
      .filter((p) => Boolean(p.filename) && p.body?.attachmentId)
      .map((p) => ({
        id: p.body!.attachmentId!,
        filename: p.filename!,
        mimeType: p.mimeType ?? 'application/octet-stream',
        size: p.body?.size ?? 0,
      }))

    return {
      id: m.id,
      threadId: m.threadId,
      subject: subjectHeader?.value ?? '(no subject)',
      preview: m.snippet ?? '',
      from: {
        name: fromHeader?.value?.replace(/<.*?>/, '').trim() ?? '',
        email: fromMatch?.[1] ?? fromHeader?.value ?? '',
      },
      to: toHeader?.value ? [{ name: '', email: toHeader.value }] : [],
      date: new Date(parseInt(m.internalDate, 10)),
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
  })

  return NextResponse.json({ messages })
}