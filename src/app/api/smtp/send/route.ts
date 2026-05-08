/**
 * POST /api/smtp/send
 * Send an email via SMTP for the authenticated SMTP/IMAP account.
 * Body: {
 *   to: string | string[],
 *   cc?: string[],
 *   bcc?: string[],
 *   subject: string,
 *   html: string,
 *   text?: string,
 *   replyTo?: string,
 *   inReplyTo?: string,
 *   references?: string[],
 *   threadId?: string,
 *   attachments?: Array<{ filename, content: base64, contentType, cid? }>
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sendEmail } from '@/lib/smtp'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  const sessionId = request.cookies.get('session')?.value
  if (!sessionId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const session = getSession(sessionId)
  if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const account = db.prepare(`SELECT provider, name FROM accounts WHERE id = ?`).get(session.account_id) as { provider: string; name: string | null } | undefined
  if (!account || account.provider !== 'smtp_imap') {
    return NextResponse.json({ error: 'Not an SMTP/IMAP account' }, { status: 403 })
  }

  const creds = db.prepare(`SELECT email FROM mail_credentials WHERE account_id = ?`).get(session.account_id) as { email: string } | undefined

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const to = Array.isArray(body.to) ? body.to.join(', ') : String(body.to ?? '')
  if (!to) return NextResponse.json({ error: '`to` is required' }, { status: 400 })

  // Decode base64 attachments
  const attachments = body.attachments
    ? (body.attachments as Array<{ filename: string; content: string; contentType?: string; cid?: string }>).map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.content, 'base64'),
        contentType: a.contentType ?? 'application/octet-stream',
        cid: a.cid,
      }))
    : undefined

  try {
    const result = await sendEmail(session.account_id, {
      to,
      cc: body.cc as string[] | undefined,
      bcc: body.bcc as string[] | undefined,
      subject: String(body.subject ?? ''),
      html: String(body.html ?? ''),
      text: body.text ? String(body.text) : undefined,
      replyTo: body.replyTo ? String(body.replyTo) : undefined,
      inReplyTo: body.inReplyTo ? String(body.inReplyTo) : undefined,
      references: body.references as string[] | undefined,
      threadId: body.threadId ? String(body.threadId) : undefined,
      attachments,
    })
    return NextResponse.json(result)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}