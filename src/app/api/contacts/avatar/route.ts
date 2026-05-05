import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getValidGmailAccessToken } from '@/lib/gmail'
import { getAvatarByEmail } from '@/lib/gmail-utils'

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get('session')?.value
  if (!sessionId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const session = getSession(sessionId)
  if (!session) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const emailsParam = searchParams.get('emails')
  if (!emailsParam) {
    return NextResponse.json({ error: 'Missing emails param' }, { status: 400 })
  }

  const emails = emailsParam.split(',').map((e) => e.trim()).filter(Boolean)
  if (emails.length === 0) {
    return NextResponse.json({ error: 'No emails provided' }, { status: 400 })
  }
  if (emails.length > 50) {
    return NextResponse.json({ error: 'Max 50 emails per request' }, { status: 400 })
  }

  const accessToken = await getValidGmailAccessToken(session.account_id)

  // Fetch avatars for all emails in parallel
  const results = await Promise.all(
    emails.map(async (email) => {
      const avatarUrl = await getAvatarByEmail(email, accessToken)
      return [email, avatarUrl]
    })
  )

  return NextResponse.json(Object.fromEntries(results))
}
