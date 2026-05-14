import { NextRequest, NextResponse } from 'next/server'
import { createUserSession, getLastUsedAccountId, getUserByCredentials } from '@/lib/session'
import { getClientIp, rateLimit } from '@/lib/rate-limit'

function setSessionCookie(response: NextResponse, sessionId: string) {
  response.cookies.set('session', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60,
    path: '/',
  })
}

export async function POST(request: NextRequest) {
  const limited = rateLimit(`login:${getClientIp(request)}`, { limit: 10, windowMs: 15 * 60 * 1000 })
  if (!limited.allowed) {
    return NextResponse.json(
      { error: 'Too many login attempts. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfter) } },
    )
  }

  let body: { username?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const user = getUserByCredentials(body.username ?? '', body.password ?? '')
  if (!user) {
    return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
  }

  const session = createUserSession(user.id, getLastUsedAccountId(user.id))
  const response = NextResponse.json({ ok: true })
  setSessionCookie(response, session.id)
  return response
}
