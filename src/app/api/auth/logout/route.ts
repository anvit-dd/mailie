import { NextRequest, NextResponse } from 'next/server'
import { deleteSession } from '@/lib/session'

export async function POST(request: NextRequest) {
  const sessionId = request.cookies.get('session')?.value
  if (sessionId) {
    deleteSession(sessionId)
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set('session', '', { expires: new Date(0), path: '/' })
  return response
}
