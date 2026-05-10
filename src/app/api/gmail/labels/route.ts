/**
 * GET /api/gmail/labels
 * Returns Gmail label list with unread counts.
 * Response: { labels: { id, name, unreadCount }[] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getValidGmailAccessToken } from '@/lib/gmail'

interface GmailLabel {
  id: string
  name: string
  type?: string
  color?: {
    textColor?: string
    backgroundColor?: string
  }
  threadsTotal?: number
  messagesTotal?: number
  messagesUnread?: number
  threadsUnread?: number
}

function formatLabelName(label: GmailLabel): string {
  const rawName = label.name || label.id
  const withoutCategoryPrefix = rawName.replace(/^CATEGORY_/i, '')
  const normalized = withoutCategoryPrefix.toLowerCase().replace(/_/g, ' ')
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : rawName
}

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get('session')?.value

  if (!sessionId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const session = getSession(sessionId)
  if (!session) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  try {
    const accessToken = await getValidGmailAccessToken(session.account_id)
    const res = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/labels?fields=labels(id,name,type,color,threadsTotal,messagesTotal,messagesUnread,threadsUnread)',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string; status?: string } }
      const message = err.error?.message ?? 'Failed to fetch labels'
      console.error('[gmail/labels] upstream error', {
        status: res.status,
        statusText: res.statusText,
        message,
        gmailStatus: err.error?.status,
      })
      return NextResponse.json(
        { error: message, upstreamStatus: res.status, gmailStatus: err.error?.status },
        { status: res.status }
      )
    }

    const data = await res.json() as { labels?: GmailLabel[] }
    const labels = (data.labels ?? []).map((label) => ({
      ...label,
      name: formatLabelName(label),
      messagesUnreadCount: label.messagesUnread ?? 0,
      messagesTotalThreads: label.threadsTotal ?? 0,
    }))

    return NextResponse.json({ labels })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const sessionId = request.cookies.get('session')?.value
  if (!sessionId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const session = getSession(sessionId)
  if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { name?: string }
  const name = body.name?.trim()
  if (!name) return NextResponse.json({ error: 'Label name required' }, { status: 400 })

  try {
    const accessToken = await getValidGmailAccessToken(session.account_id)
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
      return NextResponse.json({ error: err.error?.message ?? 'Failed to create label' }, { status: res.status })
    }

    const label = await res.json() as GmailLabel
    return NextResponse.json({ label: { ...label, name: formatLabelName(label) } })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
