/**
 * POST /api/auth/smtp-connect
 * Validates SMTP/IMAP credentials, encrypts passwords, creates account + session.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { encrypt } from '@/lib/crypto'
import { createSession } from '@/lib/session'
import { verifySmtpConnection, verifyImapConnection } from '@/lib/smtp'
import { randomBytes } from 'crypto'

function parsePort(value: string, fieldName: string): { port: number } | { error: string } {
  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { error: `${fieldName} must be a valid TCP port` }
  }
  return { port }
}

export async function POST(request: NextRequest) {
  let body: {
    email: string
    displayName: string
    smtpHost: string
    smtpPort: string
    smtpSecure: boolean
    smtpUsername: string
    smtpPassword: string
    imapHost: string
    imapPort: string
    imapSecure: boolean
    imapUsername: string
    imapPassword: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    email: rawEmail,
    displayName: rawDisplayName,
    smtpHost: rawSmtpHost,
    smtpPort: rawSmtpPort,
    smtpSecure,
    smtpUsername: rawSmtpUsername,
    smtpPassword: rawSmtpPassword,
    imapHost: rawImapHost,
    imapPort: rawImapPort,
    imapSecure,
    imapUsername: rawImapUsername,
    imapPassword: rawImapPassword,
  } = body

  const email = rawEmail?.trim().toLowerCase()
  const displayName = rawDisplayName?.trim()
  const smtpHost = rawSmtpHost?.trim()
  const smtpPort = rawSmtpPort?.trim()
  const smtpPassword = rawSmtpPassword ?? ''
  const imapHost = rawImapHost?.trim()
  const imapPort = rawImapPort?.trim()
  const smtpUsername = rawSmtpUsername?.trim()
  const imapUsername = rawImapUsername?.trim()
  const hasSmtpConfig = Boolean(smtpHost || smtpPort || smtpUsername || smtpPassword)
  const hasImapConfig = Boolean(imapHost || imapPort || imapUsername || rawImapPassword)
  const imapPassword = hasImapConfig ? (rawImapPassword || smtpPassword) : ''

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }
  if (!hasSmtpConfig && !hasImapConfig) {
    return NextResponse.json({ error: 'Add SMTP, IMAP, or both server settings' }, { status: 400 })
  }
  if (hasSmtpConfig && (!smtpHost || !smtpPort || !smtpPassword)) {
    return NextResponse.json({ error: 'SMTP host, port, and password are required when SMTP is configured' }, { status: 400 })
  }
  if (hasImapConfig && (!imapHost || !imapPort || !imapPassword)) {
    return NextResponse.json({ error: 'IMAP host, port, and password are required when IMAP is configured' }, { status: 400 })
  }

  const parsedSmtpPort = hasSmtpConfig ? parsePort(smtpPort, 'SMTP port') : { port: 0 }
  if ('error' in parsedSmtpPort) {
    return NextResponse.json({ error: parsedSmtpPort.error }, { status: 400 })
  }
  const parsedImapPort = hasImapConfig ? parsePort(imapPort, 'IMAP port') : { port: 0 }
  if ('error' in parsedImapPort) {
    return NextResponse.json({ error: parsedImapPort.error }, { status: 400 })
  }

  // For Resend SMTP, the username is always "resend" regardless of email
  const isResend = smtpHost?.toLowerCase() === 'smtp.resend.com'
  const resolvedSmtpUsername = isResend ? 'resend' : (smtpUsername || email)
  const resolvedImapUsername = imapUsername || smtpUsername || email

  // 1. Verify SMTP
  if (hasSmtpConfig) {
    const smtpResult = await verifySmtpConnection(
      smtpHost,
      parsedSmtpPort.port,
      smtpSecure,
      resolvedSmtpUsername,
      smtpPassword,
    )
    if (!smtpResult.success) {
      return NextResponse.json({ error: `SMTP: ${smtpResult.error}` }, { status: 400 })
    }
  }

  // 2. Verify IMAP when configured.
  if (hasImapConfig) {
    const result = await verifyImapConnection(
      imapHost,
      parsedImapPort.port,
      imapSecure,
      resolvedImapUsername,
      imapPassword,
    )
    if (!result.success) {
      return NextResponse.json({ error: `IMAP: ${result.error}` }, { status: 400 })
    }
  }

  // 3. Encrypt passwords
  let smtpEncrypted: string
  let imapEncrypted: string | undefined
  try {
    smtpEncrypted = hasSmtpConfig ? encrypt(smtpPassword) : ''
    if (hasImapConfig) {
      imapEncrypted = encrypt(imapPassword)
    }
  } catch {
    return NextResponse.json({ error: 'Encryption failed — check MAILIE_ENCRYPTION_KEY' }, { status: 500 })
  }

  const now = Date.now()

  // 4. Upsert account
  const existing = db.prepare(`SELECT id FROM accounts WHERE email = ?`).get(email) as { id: string } | undefined
  let accountId: string

  if (existing) {
    accountId = existing.id
    db.prepare(`
      UPDATE accounts SET name = ?, provider = 'smtp_imap' WHERE id = ?
    `).run(displayName || null, accountId)
    // Update credentials
    db.prepare(`
      INSERT INTO mail_credentials
        (account_id, email, display_name, smtp_host, smtp_port, smtp_secure,
         smtp_username, smtp_password_encrypted, imap_host, imap_port, imap_secure,
         imap_username, imap_password_encrypted, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(account_id) DO UPDATE SET
        email = excluded.email, display_name = excluded.display_name,
        smtp_host = excluded.smtp_host, smtp_port = excluded.smtp_port,
        smtp_secure = excluded.smtp_secure, smtp_username = excluded.smtp_username,
        smtp_password_encrypted = excluded.smtp_password_encrypted,
        imap_host = excluded.imap_host, imap_port = excluded.imap_port,
        imap_secure = excluded.imap_secure, imap_username = excluded.imap_username,
        imap_password_encrypted = excluded.imap_password_encrypted,
        updated_at = excluded.updated_at
    `).run(
      accountId, email, displayName || null,
      smtpHost || '', parsedSmtpPort.port, smtpSecure ? 1 : 0,
      hasSmtpConfig ? resolvedSmtpUsername : '', smtpEncrypted,
      imapHost || '', parsedImapPort.port, imapSecure ? 1 : 0,
      hasImapConfig ? resolvedImapUsername : '', imapEncrypted ?? '',
      now, now,
    )
  } else {
    accountId = randomBytes(16).toString('hex')
    db.prepare(`
      INSERT INTO accounts (id, email, name, provider, created_at)
      VALUES (?, ?, ?, 'smtp_imap', ?)
    `).run(accountId, email, displayName || null, now)

    db.prepare(`
      INSERT INTO mail_credentials
        (account_id, email, display_name, smtp_host, smtp_port, smtp_secure,
         smtp_username, smtp_password_encrypted, imap_host, imap_port, imap_secure,
         imap_username, imap_password_encrypted, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      accountId, email, displayName || null,
      smtpHost || '', parsedSmtpPort.port, smtpSecure ? 1 : 0,
      hasSmtpConfig ? resolvedSmtpUsername : '', smtpEncrypted,
      imapHost || '', parsedImapPort.port, imapSecure ? 1 : 0,
      hasImapConfig ? resolvedImapUsername : '', imapEncrypted ?? '',
      now, now,
    )
  }

  // 5. Create session
  const session = createSession(accountId)

  const response = NextResponse.json({ ok: true })
  response.cookies.set('session', session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60,
    path: '/',
  })

  return response
}
