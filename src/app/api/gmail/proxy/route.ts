import { NextRequest, NextResponse } from 'next/server'
import { getAccountWithTokens, getSession } from '@/lib/session'

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

  const { searchParams } = new URL(request.url)
  const urlParam = searchParams.get('url')

  if (!urlParam) {
    return new NextResponse('Missing image URL', { status: 400 })
  }

  let imageUrl: URL
  try {
    imageUrl = new URL(urlParam)
  } catch {
    return new NextResponse('Invalid image URL', { status: 400 })
  }

  if (imageUrl.protocol !== 'https:') {
    return new NextResponse('Only https images are allowed', { status: 400 })
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
