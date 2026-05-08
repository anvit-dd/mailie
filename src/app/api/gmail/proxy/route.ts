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
  const accessToken = await getValidGmailAccessToken(session.account_id)
  if (!account?.gmailTokens) {
    return new NextResponse('No Gmail connection', { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const urlParam = searchParams.get('url')
  const cidParam = searchParams.get('cid')
  const messageIdParam = searchParams.get('messageId')

  if (!urlParam && !cidParam) {
    return new NextResponse('Missing image URL or CID', { status: 400 })
  }

  // Handle cid: inline attachment — fetch from Gmail Attachments API
  if (cidParam) {
    const cid = cidParam.replace(/^cid:/, '').replace(/<|>/g, '')
    const messageId = messageIdParam

    if (!messageId) {
      return new NextResponse('Missing messageId for CID lookup', { status: 400 })
    }

    try {
      // Fetch the full message to find the attachment by Content-ID
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (!msgRes.ok) {
        return new NextResponse('Failed to fetch message for attachment', { status: msgRes.status })
      }
      const msg = await msgRes.json()

      // Search through all parts for one with matching Content-ID header
      const attachmentData = findAttachmentByCid(msg.payload, cid)
      if (!attachmentData) {
        return new NextResponse('Attachment not found for CID', { status: 404 })
      }

      if (attachmentData.data) {
        return new NextResponse(Buffer.from(normalizeBase64Url(attachmentData.data), 'base64'), {
          headers: {
            'Content-Type': attachmentData.mimeType || 'image/*',
            'Cache-Control': 'private, no-store, max-age=0',
          },
        })
      }

      // Fetch the actual attachment bytes
      const attRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentData.attachmentId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (!attRes.ok) {
        return new NextResponse('Failed to fetch attachment data', { status: attRes.status })
      }
      const att = await attRes.json()
      const base64Data = normalizeBase64Url(att.data)
      if (!base64Data) {
        return new NextResponse('No data in attachment response', { status: 502 })
      }

      return new NextResponse(Buffer.from(base64Data, 'base64'), {
        headers: {
          'Content-Type': attachmentData.mimeType || 'image/*',
          'Cache-Control': 'private, no-store, max-age=0',
        },
      })
    } catch (error) {
      console.error('CID attachment proxy error:', error)
      return new NextResponse('Error loading CID attachment', { status: 500 })
    }
  }

  // Handle external URL proxy
  let imageUrl: URL
  try {
    imageUrl = new URL(urlParam!)
  } catch {
    return new NextResponse('Invalid image URL', { status: 400 })
  }

  if (imageUrl.protocol !== 'https:' && imageUrl.protocol !== 'http:') {
    return new NextResponse('Only http/https images are allowed', { status: 400 })
  }

  try {
    const response = await fetch(imageUrl.toString(), {
      headers: {
        Accept: 'image/*,*/*;q=0.8',
      },
      redirect: 'follow',
    })

    if (!response.ok || !response.body) {
      return new NextResponse('Failed to fetch image', { status: response.status || 502 })
    }

    const contentType = response.headers.get('content-type') || 'image/*'
    if (!contentType.startsWith('image/')) {
      return new NextResponse('Unsupported image type', { status: 415 })
    }

    return new NextResponse(response.body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, no-store, max-age=0',
      },
    })
  } catch (error) {
    console.error('Image proxy error:', error)
    return new NextResponse('Error loading image', { status: 500 })
  }
}

/** Recursively search message payload parts for attachment matching a Content-ID */
function findAttachmentByCid(
  payload: { parts?: Array<{ filename?: string; mimeType?: string; body?: { attachmentId?: string; data?: string; size?: number | string }; headers?: Array<{ name: string; value: string }>; parts?: unknown[] }> },
  cid: string
): { attachmentId?: string; data?: string; mimeType: string } | null {
  const parts = payload.parts
  if (!parts) return null

  for (const part of parts) {
    const contentIdHeader = part.headers?.find(
      (h: { name: string; value: string }) => h.name.toLowerCase() === 'content-id'
    )
    const partCid = contentIdHeader?.value?.replace(/<|>/g, '')
    if (partCid === cid && (part.body?.attachmentId || part.body?.data)) {
      return {
        attachmentId: part.body.attachmentId,
        data: part.body.data,
        mimeType: part.mimeType || 'image/*',
      }
    }
    if (part.parts) {
      const nested = findAttachmentByCid(part as { parts?: Array<{ filename?: string; mimeType?: string; body?: { attachmentId?: string; data?: string; size?: number | string }; headers?: Array<{ name: string; value: string }>; parts?: unknown[] }> }, cid)
      if (nested) return nested
    }
  }
  return null
}

function normalizeBase64Url(data: string | undefined): string {
  if (!data) return ''
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/')
  return base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=')
}
