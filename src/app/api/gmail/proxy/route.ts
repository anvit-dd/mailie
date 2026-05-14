import { NextRequest, NextResponse } from 'next/server'
import { getAccountWithTokens, getSession } from '@/lib/session'
import { getValidGmailAccessToken } from '@/lib/gmail'
import { assertPublicHostname } from '@/lib/network-security'

const MAX_PROXY_BYTES = 5 * 1024 * 1024
const MAX_REDIRECTS = 3

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
  const urlParam = searchParams.get('url')
  const cidParam = searchParams.get('cid')
  const messageIdParam = searchParams.get('messageId')

  if (!urlParam && !cidParam) {
    return new NextResponse('Missing image URL or CID', { status: 400 })
  }

  // ── CID (inline attachment) images ─────────────────────────────────────────
  if (cidParam) {
    const cid = cidParam.replace(/^cid:/, '').replace(/<|>/g, '')
    const messageId = messageIdParam

    if (!messageId) {
      return new NextResponse('Missing messageId for CID lookup', { status: 400 })
    }

    try {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (!msgRes.ok) {
        console.error('[gmail/proxy] failed to fetch message for CID', {
          messageId,
          status: msgRes.status,
          statusText: msgRes.statusText,
        })
        return new NextResponse('Failed to fetch message for attachment', { status: msgRes.status })
      }
      const msg = await msgRes.json()

      const attachmentData = findAttachmentByCid(msg.payload, cid)
      if (!attachmentData) {
        return new NextResponse('Attachment not found for CID', { status: 404 })
      }

      // Inline data embedded directly in the message (already decoded)
      if (attachmentData.data) {
        const buf = Buffer.from(normalizeBase64Url(attachmentData.data), 'base64')
        if (buf.length > MAX_PROXY_BYTES) {
          return new NextResponse('Image too large', { status: 413 })
        }
        const contentType = normalizeImageContentType(attachmentData.mimeType) || detectMimeFromMagic(buf)
        if (!contentType || contentType === 'image/svg+xml') {
          return new NextResponse('Unsupported image type', { status: 415 })
        }
        return new NextResponse(buf, {
          headers: {
            'Content-Type': contentType,
            'Content-Length': String(buf.length),
            'Cache-Control': 'private, no-store, max-age=0',
          },
        })
      }

      // Fetch attachment bytes from Gmail Attachments API
      const attRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentData.attachmentId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (!attRes.ok) {
        console.error('[gmail/proxy] failed to fetch attachment data', {
          messageId,
          attachmentId: attachmentData.attachmentId,
          status: attRes.status,
          statusText: attRes.statusText,
        })
        return new NextResponse('Failed to fetch attachment data', { status: attRes.status })
      }
      const att = await attRes.json()
      const base64Data = normalizeBase64Url(att.data)
      if (!base64Data) {
        return new NextResponse('No data in attachment response', { status: 502 })
      }

      const buf = Buffer.from(base64Data, 'base64')
      if (buf.length > MAX_PROXY_BYTES) {
        return new NextResponse('Image too large', { status: 413 })
      }
      const contentType = normalizeImageContentType(attachmentData.mimeType) || detectMimeFromMagic(buf)
      if (!contentType || contentType === 'image/svg+xml') {
        return new NextResponse('Unsupported image type', { status: 415 })
      }
      return new NextResponse(buf, {
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(buf.length),
          'Cache-Control': 'private, no-store, max-age=0',
        },
      })
    } catch (error) {
      console.error('CID attachment proxy error:', error)
      return new NextResponse('Error loading CID attachment', { status: 500 })
    }
  }

  // ── External URL proxy ───────────────────────────────────────────────────────
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
    const response = await fetchPublicImage(imageUrl)

    if (!response.ok) {
      return new NextResponse('Failed to fetch image', { status: response.status || 502 })
    }

    const declaredLength = Number(response.headers.get('content-length') ?? '0')
    if (declaredLength > MAX_PROXY_BYTES) {
      return new NextResponse('Image too large', { status: 413 })
    }

    // Collect ALL bytes first — streaming a ReadableStream through NextResponse
    // can cause chunked-encoding issues with binary data in some Next.js configs.
    const arrayBuffer = await response.arrayBuffer()
    const buf = Buffer.from(arrayBuffer)
    if (buf.length > MAX_PROXY_BYTES) {
      return new NextResponse('Image too large', { status: 413 })
    }

    const rawContentType = response.headers.get('content-type')

    // No Content-Type header: try to detect from magic bytes
    let contentType: string
    if (rawContentType) {
      contentType = normalizeImageContentType(rawContentType) || 'application/octet-stream'
    } else {
      contentType = detectMimeFromMagic(buf) || 'application/octet-stream'
    }

    if (!contentType.startsWith('image/') || contentType === 'image/svg+xml') {
      return new NextResponse('Unsupported image type', { status: 415 })
    }

    return new NextResponse(buf, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(buf.length),
        'Cache-Control': 'private, no-store, max-age=0',
      },
    })
  } catch (error) {
    console.error('Image proxy error:', error)
    return new NextResponse('Error loading image', { status: 500 })
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function fetchPublicImage(initialUrl: URL): Promise<Response> {
  let currentUrl = initialUrl

  for (let i = 0; i <= MAX_REDIRECTS; i += 1) {
    await assertPublicHostname(currentUrl.hostname)
    const response = await fetch(currentUrl.toString(), {
      redirect: 'manual',
      headers: { Accept: 'image/*' },
    })

    if (response.status < 300 || response.status >= 400) return response

    const location = response.headers.get('location')
    if (!location) return response
    currentUrl = new URL(location, currentUrl)
    if (currentUrl.protocol !== 'https:' && currentUrl.protocol !== 'http:') {
      throw new Error('Invalid redirect protocol')
    }
  }

  throw new Error('Too many redirects')
}

/** Recursively find an inline attachment part by its Content-ID header. */
function findAttachmentByCid(
  payload: {
    parts?: Array<{
      filename?: string
      mimeType?: string
      body?: { attachmentId?: string; data?: string; size?: number | string }
      headers?: Array<{ name: string; value: string }>
      parts?: unknown[]
    }>
  },
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
        mimeType: part.mimeType || 'application/octet-stream',
      }
    }
    if (part.parts) {
      const nested = findAttachmentByCid(
        part as {
          parts?: Array<{
            filename?: string
            mimeType?: string
            body?: { attachmentId?: string; data?: string; size?: number | string }
            headers?: Array<{ name: string; value: string }>
            parts?: unknown[]
          }>
        },
        cid
      )
      if (nested) return nested
    }
  }
  return null
}

/** Magic-byte signatures for common image formats. */
function detectMimeFromMagic(buf: Buffer): string | null {
  if (buf.length < 4) return null
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png'
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif'
  if (buf[0] === 0x57 && buf[1] === 0x45 && buf[2] === 0x42 && buf[3] === 0x50) return 'image/webp'
  if (buf[0] === 0x42 && buf[1] === 0x4d) return 'image/bmp'
  if (buf[0] === 0x49 && buf[1] === 0x49 && buf[2] === 0x2a && buf[3] === 0x00) return 'image/tiff'
  if (buf[0] === 0x4d && buf[1] === 0x4d && buf[2] === 0x00 && buf[3] === 0x2a) return 'image/tiff'
  if (buf[0] === 0x00 && buf[1] === 0x00 && buf[2] === 0x01 && buf[3] === 0x00) return 'image/x-icon'
  return null
}

/** Normalize a raw Content-Type header to a known image MIME string, or null. */
function normalizeImageContentType(raw: string): string | null {
  const ct = raw.toLowerCase().split(';', 1)[0].trim()
  const KNOWN: Record<string, string> = {
    'image/apng': 'image/apng',
    'image/avif': 'image/avif',
    'image/gif': 'image/gif',
    'image/jpeg': 'image/jpeg',
    'image/png': 'image/png',
    'image/webp': 'image/webp',
    'image/bmp': 'image/bmp',
    'image/tiff': 'image/tiff',
    'image/x-icon': 'image/x-icon',
  }
  if (KNOWN[ct]) return KNOWN[ct]
  if (ct.startsWith('image/')) return ct // pass through unknown image/* types
  return null
}

function normalizeBase64Url(data: string | undefined): string {
  if (!data) return ''
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/')
  return base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
}
