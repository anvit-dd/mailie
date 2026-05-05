import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateAccount, createSession } from '@/lib/session'
import { getAppUrl, getGmailClientId, getGmailClientSecret, getGmailRedirectUri } from '@/lib/gmail-config'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const appUrl = getAppUrl()

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/?error=${error || 'no_code'}`)
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
      throw new Error('Token exchange failed')
    }

    const tokens = await tokenResponse.json()

    // Get user profile info + avatar from People API
    let picture: string | undefined
    try {
      const peopleResponse = await fetch(
        'https://people.googleapis.com/v1/people/me?personFields=photos,names',
        { headers: { Authorization: `Bearer ${tokens.access_token}` } }
      )
      if (peopleResponse.ok) {
        const people = await peopleResponse.json()
        picture = people.photos?.[0]?.url
      }
    } catch {
      // Non-fatal — avatar is optional
    }

    // Get Gmail profile (email)
    const profileResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })

    if (!profileResponse.ok) {
      throw new Error('Failed to get Gmail profile')
    }

    const profile = await profileResponse.json()
    const expiresAt = Date.now() + tokens.expires_in * 1000

    // Upsert account + tokens + picture
    const account = getOrCreateAccount(
      profile.emailAddress,
      profile.emailAddress.split('@')[0],
      tokens.access_token,
      tokens.refresh_token,
      expiresAt,
      picture
    )

    // Create session
    const session = createSession(account.id)

    // Set session cookie and redirect
    const response = NextResponse.redirect(`${appUrl}/`)
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
