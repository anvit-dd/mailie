/**
 * IMAP client for SMTP/IMAP mail accounts.
 * Uses imapflow for the connection and mailparser for MIME parsing.
 */

import { ImapFlow } from 'imapflow'
import { simpleParser, type ParsedMail, type AddressObject, type HeaderValue, type StructuredHeader } from 'mailparser'
import { db } from './db'
import { decrypt } from './crypto'

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export interface ImapFolder {
  path: string
  name: string
  delimiter: string
  flags: string[]
  specialUse?: string
  subscribed: boolean
}

export interface ImapMessageSummary {
  uid: string
  seq: number
  subject: string
  from: { name: string | null; address: string }
  to: { name: string | null; address: string }[]
  date: Date
  flags: string[]
  hasAttachments: boolean
  threadId?: string
  inReplyTo?: string
  references?: string[]
  size: number
}

export interface ImapAttachment {
  filename: string
  contentType: string
  size: number
  cid?: string
}

export interface ImapMessageDetail extends ImapMessageSummary {
  bodyHtml: string | null
  bodyPlain: string | null
  attachments: ImapAttachment[]
  headers: Record<string, string>
}

// ─────────────────────────────────────────────────────────
// Connection helpers
// ─────────────────────────────────────────────────────────

function getImapCredentials(accountId: string) {
  const row = db.prepare(`
    SELECT imap_host, imap_port, imap_secure, imap_username, imap_password_encrypted
    FROM mail_credentials WHERE account_id = ?
  `).get(accountId) as {
    imap_host: string
    imap_port: number
    imap_secure: number
    imap_username: string
    imap_password_encrypted: string
  } | undefined

  if (!row) throw new Error('No IMAP credentials found for this account')

  let password: string
  try {
    password = decrypt(row.imap_password_encrypted)
  } catch {
    throw new Error('Failed to decrypt IMAP password — check MAILIE_ENCRYPTION_KEY')
  }

  return {
    host: row.imap_host,
    port: row.imap_port,
    secure: row.imap_secure === 1,
    user: row.imap_username,
    pass: password,
  }
}

async function withImap<T>(
  accountId: string,
  fn: (client: ImapFlow) => Promise<T>,
): Promise<T> {
  const opts = getImapCredentials(accountId)
  const client = new ImapFlow({ ...opts, logger: false })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.logout()
  }
}

// ─────────────────────────────────────────────────────────
// Folders
// ─────────────────────────────────────────────────────────

export async function listFolders(accountId: string): Promise<ImapFolder[]> {
  return withImap(accountId, async (client) => {
    const entries = await client.list()
    return entries.map((e) => ({
      path: e.path,
      name: e.name,
      delimiter: e.delimiter,
      flags: Array.from(e.flags),
      specialUse: e.specialUse,
      subscribed: e.subscribed,
    }))
  })
}

// ─────────────────────────────────────────────────────────
// Messages
// ─────────────────────────────────────────────────────────

export async function searchMessages(
  accountId: string,
  folder: string,
  criteria: Record<string, unknown> = {},
  limit = 25,
  offset = 0,
): Promise<{ messages: ImapMessageSummary[]; total: number }> {
  return withImap(accountId, async (client) => {
    const mailbox = await client.mailboxOpen(folder)
    const total = mailbox.exists

    const searchCriteria: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(criteria)) {
      if (k !== 'all') searchCriteria[k] = v
    }

    const uids = await client.search(searchCriteria, { uid: true })
    if (!uids || uids.length === 0) return { messages: [], total }

    const page = uids.slice(offset, offset + limit)
    if (page.length === 0) return { messages: [], total }

    const pageStr = page.join(',')
    const results: ImapMessageSummary[] = []

    for await (const item of client.fetch(pageStr, {
      uid: true,
      flags: true,
      envelope: true,
      size: true,
    }, { uid: true })) {
      const e = item.envelope
      const fromAddr = e?.from?.[0]
      results.push({
        uid: String(item.uid),
        seq: item.seq,
        subject: e?.subject ?? '',
        from: {
          name: fromAddr?.name ?? null,
          address: fromAddr?.address ?? '',
        },
        to: (e?.to ?? []).map((a) => ({ name: a.name ?? null, address: a.address ?? '' })),
        date: e?.date ? new Date(e.date) : new Date(0),
        flags: item.flags ? Array.from(item.flags) : [],
        hasAttachments: false,
        threadId: item.threadId ? String(item.threadId) : undefined,
        inReplyTo: undefined,
        references: undefined,
        size: item.size ?? 0,
      })
    }

    return { messages: results, total }
  })
}

// Convert AddressObject to our type
// AddressObject: { value: EmailAddress[], html: string, text: string }
// EmailAddress: { address: string, name: string | null }
function addressObjToAddresses(value: AddressObject | AddressObject[] | undefined): { name: string | null; address: string }[] {
  if (!value) return []
  const list: AddressObject[] = Array.isArray(value) ? value : [value]
  return list.flatMap((ao) => (ao.value ?? []).map((a) => ({
    name: a.name ?? null,
    address: a.address ?? '',
  })))
}

// Convert HeaderValue to string[]
function headerValueToStrings(val: HeaderValue): string[] {
  if (typeof val === 'string') return [val]
  if (Array.isArray(val)) {
    return val.flatMap((v) => {
      if (typeof v === 'string') return [v]
      if ('value' in v && typeof (v as StructuredHeader).value === 'string') return [(v as StructuredHeader).value]
      return []
    })
  }
  if (val instanceof Date) return [val.toISOString()]
  return []
}

export async function fetchMessage(
  accountId: string,
  folder: string,
  uid: string,
): Promise<ImapMessageDetail> {
  return withImap(accountId, async (client) => {
    const raw = await client.fetchOne(uid, {
      uid: true,
      flags: true,
      envelope: true,
      size: true,
      source: true,
      threadId: true,
    }, { uid: true })

    if (!raw) throw new Error(`Message ${uid} not found in ${folder}`)

    const sourceBuf = raw.source && Buffer.isBuffer(raw.source) ? raw.source : Buffer.alloc(0)
    const parsed: ParsedMail = await simpleParser(sourceBuf)

    const attachments: ImapAttachment[] = parsed.attachments.map((a) => ({
      filename: a.filename ?? 'attachment',
      contentType: a.contentType ?? 'application/octet-stream',
      size: a.size,
      cid: a.cid ?? undefined,
    }))

    // headers — use parsed.headers Map
    const headerRecord: Record<string, string> = {}
    const headerEntries = Array.from(parsed.headers.entries()) as [string, HeaderValue][]
    for (const [k, v] of headerEntries) {
      headerRecord[k] = Array.isArray(v) ? v.join(', ') : String(v)
    }

    // inReplyTo — from parsed headers
    const inReplyToRaw = parsed.headers.get('in-reply-to')
    const inReplyTo = inReplyToRaw ? headerValueToStrings(inReplyToRaw as HeaderValue)[0] : undefined

    // references — collect all matching headers
    const refsRaw = parsed.headers.get('references')
    const references = refsRaw ? headerValueToStrings(refsRaw as HeaderValue) : undefined

    return {
      uid: String(raw.uid),
      seq: raw.seq,
      subject: parsed.subject ?? raw.envelope?.subject ?? '',
      from: {
        name: parsed.from?.value?.[0]?.name ?? null,
        address: parsed.from?.value?.[0]?.address ?? '',
      },
      to: addressObjToAddresses(parsed.to),
      date: parsed.date ? new Date(parsed.date) : new Date(0),
      flags: raw.flags ? Array.from(raw.flags) : [],
      hasAttachments: attachments.length > 0,
      threadId: raw.threadId ? String(raw.threadId) : undefined,
      inReplyTo,
      references,
      size: raw.size ?? 0,
      // mailparser html is string|false — convert false to null
      bodyHtml: parsed.html === false ? null : (parsed.html ?? null),
      bodyPlain: parsed.text ?? null,
      attachments,
      headers: headerRecord,
    }
  })
}

// ─────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────

const TRASH_CANDIDATES = ['[Gmail]/Trash', 'Trash', 'INBOX/Trash']
const ARCHIVE_CANDIDATES = ['[Gmail]/All Mail', 'Archive', 'INBOX/Archive', 'All Mail']

export async function trashMessage(
  accountId: string,
  folder: string,
  uid: string,
): Promise<void> {
  return withImap(accountId, async (client) => {
    for (const trash of TRASH_CANDIDATES) {
      try {
        const ok = await client.messageMove(uid, trash, { uid: true })
        if (ok) return
      } catch {
        // try next
      }
    }
    await client.messageFlagsAdd(uid, ['\\Deleted'], { uid: true })
  })
}

export async function archiveMessage(
  accountId: string,
  folder: string,
  uid: string,
): Promise<void> {
  return withImap(accountId, async (client) => {
    for (const archive of ARCHIVE_CANDIDATES) {
      try {
        const ok = await client.messageMove(uid, archive, { uid: true })
        if (ok) return
      } catch {
        // try next
      }
    }
  })
}

export async function setSeen(
  accountId: string,
  folder: string,
  uid: string,
  seen: boolean,
): Promise<void> {
  return withImap(accountId, async (client) => {
    if (seen) {
      await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true })
    } else {
      await client.messageFlagsRemove(uid, ['\\Seen'], { uid: true })
    }
  })
}

export async function moveMessage(
  accountId: string,
  sourceFolder: string,
  uid: string,
  destinationFolder: string,
): Promise<void> {
  return withImap(accountId, async (client) => {
    const ok = await client.messageMove(uid, destinationFolder, { uid: true })
    if (!ok) throw new Error(`Failed to move message ${uid} to ${destinationFolder}`)
  })
}