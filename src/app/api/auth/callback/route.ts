import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateAccount, createSession } from '@/lib/session'
import { getAppUrl, getGmailClientId, getGmailClientSecret, getGmailRedirectUri } from '@/lib/gmail-config'

// GET: receives OAuth redirect from Google, validates state, exchanges code for tokens
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const appUrl = getAppUrl()

  console.log('[OAuth callback] URL:', request.url, '| code:', code, '| state:', state, '| error:', error)

  if (error || !code) {
    console.log('[OAuth callback] Missing code or error present — error:', error, 'code:', code)
    return NextResponse.redirect(`${appUrl}/?error=${error || 'no_code'}`)
  }

  // Validate state to prevent CSRF
  const expectedState = request.cookies.get('oauth_state')?.value
  if (!state || state !== expectedState) {
    console.warn('[OAuth callback] State mismatch — expected:', expectedState, 'got:', state)
    return NextResponse.redirect(`${appUrl}/?error=invalid_state`)
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: getGmailClientId(),
        client_secret: getGmailClientSecret(),
        code,
        grant_type: 'authorization_code',
        redirect_uri: getGmailRedirectUri(),
      }),
    })

    if (!tokenResponse.ok) {
      const body = await tokenResponse.text()
      console.error('[OAuth] Token exchange failed — status:', tokenResponse.status, '| body:', body)
      throw new Error('Token exchange failed')
    }

    const tokens = await tokenResponse.json()

    // Get Gmail profile (email)
    const profileResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })

    if (!profileResponse.ok) {
      throw new Error('Failed to get Gmail profile')
    }

    const profile = await profileResponse.json()
    const expiresAt = Date.now() + tokens.expires_in * 1000

    // Upsert account + tokens
    const account = getOrCreateAccount(
      profile.emailAddress,
      profile.emailAddress.split('@')[0],
      tokens.access_token,
      tokens.refresh_token,
      expiresAt,
      undefined
    )

    // Create session
    const session = createSession(account.id)

    // Set session cookie and redirect (clear oauth_state cookie)
    const response = NextResponse.redirect(`${appUrl}/`)
    response.cookies.delete('oauth_state')
    response.cookies.set('session', session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: new Date(session.expires_at),
      path: '/',
    })

    return response
  } catch (err) {
    console.error('OAuth callback error:', err)
    return NextResponse.redirect(`${appUrl}/?error=auth_failed`)
  }
}

export async function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
