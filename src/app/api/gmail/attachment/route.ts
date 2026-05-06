import { NextRequest, NextResponse } from 'next/server'
import { getAccountWithTokens, getSession } from '@/lib/session'
import { getValidGmailAccessToken } from '@/lib/gmail'

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get('session')?.value
  if (!sessionId) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const session = getSession(sessionId)
  if (!session) {
    return new NextResponse('Invalid session', { status: 401 })
  }

  const account = getAccountWithTokens(session.account_id)
  if (!account?.gmailTokens) {
    return new NextResponse('No Gmail connection', { status: 401 })
  }

  const accessToken = await getValidGmailAccessToken(session.account_id)
  const { searchParams } = new URL(request.url)
  const messageId = searchParams.get('messageId')
  const attachmentId = searchParams.get('attachmentId')
  const filename = searchParams.get('filename') || 'attachment'
  const mimeType = searchParams.get('mimeType') || 'application/octet-stream'

  if (!messageId || !attachmentId) {
    return new NextResponse('Missing messageId or attachmentId', { status: 400 })
  }

  try {
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )

    if (!response.ok) {
      return new NextResponse('Failed to fetch attachment', { status: response.status })
    }

    const data = await response.json()
    const base64 = String(data.data || '').replace(/-/g, '+').replace(/_/g, '/')
    if (!base64) {
      return new NextResponse('Attachment has no data', { status: 502 })
    }

    const buffer = Buffer.from(base64, 'base64')
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename.replace(/"/g, '')}"`,
        'Cache-Control': 'private, no-store, max-age=0',
      },
    })
  } catch (error) {
    console.error('Attachment download error:', error)
    return new NextResponse('Error loading attachment', { status: 500 })
  }
}
