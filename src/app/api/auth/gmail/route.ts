import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { getGmailClientId, getGmailRedirectUri } from '@/lib/gmail-config'
import { getSession } from '@/lib/session'

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get('session')?.value
  if (!sessionId || !getSession(sessionId)) {
    return NextResponse.json({ error: 'Master login required' }, { status: 401 })
  }

  const state = randomBytes(16).toString('hex')

  let clientId: string
  let redirectUri: string

  try {
    clientId = getGmailClientId()
    redirectUri = getGmailRedirectUri()
  } catch {
    return NextResponse.json({ error: 'Gmail OAuth not configured' }, { status: 500 })
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/userinfo.profile',
    ].join(' '),
    access_type: 'offline',
    prompt: 'consent',
  })

  const response = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
  response.cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutes
    path: '/',
  })
  return response
}
