import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateAccount, createSession } from '@/lib/session'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/?error=${error || 'no_code'}`)
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.NEXT_PUBLIC_GMAIL_CLIENT_ID!,
        client_secret: process.env.GMAIL_CLIENT_SECRET!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`,
      }),
    })

    if (!tokenResponse.ok) {
      throw new Error('Token exchange failed')
    }

    const tokens = await tokenResponse.json()

    // Get user profile
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
      expiresAt
    )

    // Create session
    const session = createSession(account.id)

    // Set session cookie and redirect
    const response = NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/`)
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
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/?error=auth_failed`)
  }
}
