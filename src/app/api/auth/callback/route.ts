import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateAccount, getSession, setActiveAccount } from '@/lib/session'
import { getAppUrl, getGmailClientId, getGmailClientSecret, getGmailRedirectUri } from '@/lib/gmail-config'

// GET: receives OAuth redirect from Google, validates state, exchanges code for tokens
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const appUrl = getAppUrl()
  const sessionId = request.cookies.get('session')?.value
  const existingSession = sessionId ? getSession(sessionId) : null

  if (!existingSession || !sessionId) {
    return NextResponse.redirect(`${appUrl}/?error=login_required`)
  }

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/?error=${error || 'no_code'}`)
  }

  // Validate state to prevent CSRF
  const expectedState = request.cookies.get('oauth_state')?.value
  if (!state || state !== expectedState) {
    console.warn('[OAuth callback] State mismatch')
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
      console.error('[OAuth] Token exchange failed — status:', tokenResponse.status)
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
      existingSession.user_id,
      profile.emailAddress,
      profile.emailAddress.split('@')[0],
      tokens.access_token,
      tokens.refresh_token,
      expiresAt,
      undefined
    )

    setActiveAccount(sessionId, account.id)

    // Set session cookie and redirect (clear oauth_state cookie)
    const response = NextResponse.redirect(`${appUrl}/`)
    response.cookies.delete('oauth_state')

    return response
  } catch (err) {
    console.error('OAuth callback error:', err)
    return NextResponse.redirect(`${appUrl}/?error=auth_failed`)
  }
}

export async function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
