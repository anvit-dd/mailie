import { NextRequest, NextResponse } from 'next/server'
import { getActiveAccountAuth } from './session'

export function requireActiveAccount(request: NextRequest) {
  const sessionId = request.cookies.get('session')?.value
  if (!sessionId) {
    return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }), auth: null }
  }

  const auth = getActiveAccountAuth(sessionId)
  if (!auth) {
    return { error: NextResponse.json({ error: 'No active mailbox selected' }, { status: 409 }), auth: null }
  }

  return { error: null, auth }
}

export function requireGmailAccount(request: NextRequest) {
  const result = requireActiveAccount(request)
  if (result.error || !result.auth) return result
  if (result.auth.account.provider !== 'gmail' || !result.auth.account.gmailTokens) {
    return { error: NextResponse.json({ error: 'Active mailbox is not Gmail' }, { status: 403 }), auth: null }
  }
  return result
}

export function requireImapAccount(request: NextRequest) {
  const result = requireActiveAccount(request)
  if (result.error || !result.auth) return result
  if (result.auth.account.provider !== 'smtp_imap') {
    return { error: NextResponse.json({ error: 'Active mailbox is not SMTP/IMAP' }, { status: 403 }), auth: null }
  }
  if (!result.auth.capabilities.imap) {
    return { error: NextResponse.json({ error: 'IMAP is not configured for active mailbox' }, { status: 403 }), auth: null }
  }
  return result
}

export function requireSmtpAccount(request: NextRequest) {
  const result = requireActiveAccount(request)
  if (result.error || !result.auth) return result
  if (result.auth.account.provider !== 'smtp_imap') {
    return { error: NextResponse.json({ error: 'Active mailbox is not SMTP/IMAP' }, { status: 403 }), auth: null }
  }
  if (!result.auth.capabilities.smtp) {
    return { error: NextResponse.json({ error: 'SMTP is not configured for active mailbox' }, { status: 403 }), auth: null }
  }
  return result
}
