/**
 * SMTP client for sending mail from SMTP/IMAP accounts.
 * Uses nodemailer.
 */

import * as nodemailer from 'nodemailer'
import { db } from './db'
import { decrypt } from './crypto'

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export interface SmtpCredentials {
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  smtpUsername: string
  smtpPassword: string
  fromAddress: string
  fromName?: string
}

export interface SendEmailOptions {
  to: string
  cc?: string[]
  bcc?: string[]
  subject: string
  html?: string
  text?: string
  replyTo?: string
  inReplyTo?: string
  references?: string[]
  threadId?: string
  attachments?: Array<{
    filename: string
    content: Buffer | string
    contentType?: string
    cid?: string
  }>
}

// ─────────────────────────────────────────────────────────
// Credentials
// ─────────────────────────────────────────────────────────

function getSmtpCredentials(accountId: string, fromAddress: string, fromName?: string): SmtpCredentials {
  const row = db.prepare(`
    SELECT smtp_host, smtp_port, smtp_secure, smtp_username, smtp_password_encrypted
    FROM mail_credentials WHERE account_id = ?
  `).get(accountId) as {
    smtp_host: string
    smtp_port: number
    smtp_secure: number
    smtp_username: string
    smtp_password_encrypted: string
  } | undefined

  if (!row) throw new Error('No SMTP credentials found for this account')

  let password: string
  try {
    password = decrypt(row.smtp_password_encrypted)
  } catch {
    throw new Error('Failed to decrypt SMTP password — check MAILIE_ENCRYPTION_KEY')
  }

  return {
    smtpHost: row.smtp_host,
    smtpPort: row.smtp_port,
    smtpSecure: row.smtp_secure === 1,
    smtpUsername: row.smtp_username,
    smtpPassword: password,
    fromAddress,
    fromName,
  }
}

// ─────────────────────────────────────────────────────────
// Send
// ─────────────────────────────────────────────────────────

export async function sendEmail(
  accountId: string,
  opts: SendEmailOptions,
): Promise<{ messageId: string }> {
  const creds = getSmtpCredentials(accountId, opts.to.split(',')[0].trim())

  const transporter = nodemailer.createTransport({
    host: creds.smtpHost,
    port: creds.smtpPort,
    secure: creds.smtpSecure,
    auth: {
      user: creds.smtpUsername,
      pass: creds.smtpPassword,
    },
    logger: false,
  })

  const info = await transporter.sendMail({
    from: creds.fromName
      ? `"${creds.fromName}" <${creds.fromAddress}>`
      : creds.fromAddress,
    to: opts.to,
    cc: opts.cc?.join(', '),
    bcc: opts.bcc?.join(', '),
    replyTo: opts.replyTo,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    attachments: opts.attachments,
    headers: {
      ...(opts.inReplyTo ? { 'In-Reply-To': opts.inReplyTo } : {}),
      ...(opts.references ? { 'References': opts.references.join(' ') } : {}),
    },
  })

  return { messageId: info.messageId }
}

// ─────────────────────────────────────────────────────────
// Verify connection (test on signup)
// ─────────────────────────────────────────────────────────

export async function verifySmtpConnection(
  smtpHost: string,
  smtpPort: number,
  smtpSecure: boolean,
  smtpUsername: string,
  smtpPassword: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUsername,
      pass: smtpPassword,
    },
    connectionTimeout: 10_000,
  })

  try {
    await transporter.verify()
    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: msg }
  }
}

export async function verifyImapConnection(
  imapHost: string,
  imapPort: number,
  imapSecure: boolean,
  imapUsername: string,
  imapPassword: string,
): Promise<{ success: true } | { success: false; error: string }> {
  // imapflow is imported here to avoid circular deps
  const { ImapFlow } = await import('imapflow')
  const client = new ImapFlow({
    host: imapHost,
    port: imapPort,
    secure: imapSecure,
    auth: { user: imapUsername, pass: imapPassword },
    logger: false,
    connectionTimeout: 10_000,
  })

  try {
    await client.connect()
    await client.mailboxOpen('INBOX')
    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: msg }
  } finally {
    try {
      if (client.usable) {
        await client.logout()
      }
    } catch {
      // If connect failed, imapflow may have no active connection to close.
    }
  }
}
