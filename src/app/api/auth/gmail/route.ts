import { NextResponse } from 'next/server'
import { getGmailClientId, getGmailRedirectUri } from '@/lib/gmail-config'

export async function GET() {
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
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
    ].join(' '),
    access_type: 'offline',
    prompt: 'consent',
  })

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}
