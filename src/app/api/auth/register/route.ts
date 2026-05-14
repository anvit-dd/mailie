import { NextRequest, NextResponse } from 'next/server'
import { createUser, createUserSession } from '@/lib/session'
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
  const limited = rateLimit(`register:${getClientIp(request)}`, { limit: 5, windowMs: 60 * 60 * 1000 })
  if (!limited.allowed) {
    return NextResponse.json(
      { error: 'Too many account creation attempts. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfter) } },
    )
  }

  let body: { username?: string; password?: string; phone?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const user = createUser(body.username ?? '', body.password ?? '', body.phone ?? '')
    const session = createUserSession(user.id, null)
    const response = NextResponse.json({ ok: true })
    setSessionCookie(response, session.id)
    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed'
    const status = message === 'Username already exists' ? 409 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
