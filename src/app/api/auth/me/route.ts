import { NextRequest, NextResponse } from 'next/server'
import { getSession, getAccountWithTokens } from '@/lib/session'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get('session')?.value
  if (!sessionId) {
    return NextResponse.json({ user: null })
  }

  const session = getSession(sessionId)
  if (!session) {
    return NextResponse.json({ user: null })
  }

  const account = getAccountWithTokens(session.account_id)
  if (!account) {
    return NextResponse.json({ user: null })
  }

  const mailCredentials = account.provider === 'smtp_imap'
    ? db.prepare(`
      SELECT smtp_host, smtp_port, smtp_username, smtp_password_encrypted,
             imap_host, imap_port, imap_username, imap_password_encrypted
      FROM mail_credentials WHERE account_id = ?
    `).get(account.id) as {
      smtp_host: string | null
      smtp_port: number | null
      smtp_username: string | null
      smtp_password_encrypted: string | null
      imap_host: string | null
      imap_port: number | null
      imap_username: string | null
      imap_password_encrypted: string | null
    } | undefined
    : undefined
  const capabilities = account.provider === 'smtp_imap'
    ? {
        smtp: Boolean(mailCredentials?.smtp_host && mailCredentials.smtp_port && mailCredentials.smtp_username && mailCredentials.smtp_password_encrypted),
        imap: Boolean(mailCredentials?.imap_host && mailCredentials.imap_port && mailCredentials.imap_username && mailCredentials.imap_password_encrypted),
      }
    : { smtp: true, imap: true }

  return NextResponse.json({
    user: {
      id: account.id,
      email: account.email,
      name: account.name,
      provider: account.provider,
      capabilities,
    },
  })
}
