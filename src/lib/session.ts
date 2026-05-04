import { db, type Account, type Session } from './db'
import { randomBytes } from 'crypto'

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export function createSession(accountId: string): Session {
  const id = randomBytes(32).toString('hex')
  const now = Date.now()
  const expiresAt = now + SESSION_DURATION_MS

  db.prepare(`
    INSERT INTO sessions (id, account_id, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `).run(id, accountId, expiresAt, now)

  return { id, account_id: accountId, expires_at: expiresAt, created_at: now }
}

export function getSession(sessionId: string): Session | null {
  const session = db.prepare(`
    SELECT * FROM sessions WHERE id = ? AND expires_at > ?
  `).get(sessionId, Date.now()) as Session | undefined

  return session ?? null
}

export function getAccountWithTokens(accountId: string): (Account & { gmailTokens: { access_token: string; refresh_token: string | null; expires_at: number } | null }) | null {
  const account = db.prepare(`SELECT * FROM accounts WHERE id = ?`).get(accountId) as Account | undefined
  if (!account) return null

  const tokens = db.prepare(`SELECT * FROM gmail_tokens WHERE account_id = ?`).get(accountId) as { access_token: string; refresh_token: string | null; expires_at: number } | undefined

  return { ...account, gmailTokens: tokens ?? null }
}

export function deleteSession(sessionId: string): void {
  db.prepare(`DELETE FROM sessions WHERE id = ?`).run(sessionId)
}

export function deleteAccountSessions(accountId: string): void {
  db.prepare(`DELETE FROM sessions WHERE account_id = ?`).run(accountId)
}

export function getOrCreateAccount(email: string, name: string | null, accessToken: string, refreshToken: string | null, expiresAt: number): Account {
  const existing = db.prepare(`SELECT * FROM accounts WHERE email = ?`).get(email) as Account | undefined
  if (existing) {
    // Update tokens
    db.prepare(`
      INSERT INTO gmail_tokens (account_id, access_token, refresh_token, expires_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(account_id) DO UPDATE SET
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at
    `).run(existing.id, accessToken, refreshToken, expiresAt, Date.now())
    return existing
  }

  const id = randomBytes(16).toString('hex')
  const createdAt = Date.now()

  db.prepare(`INSERT INTO accounts (id, email, name, created_at) VALUES (?, ?, ?, ?)`).run(id, email, name, createdAt)

  db.prepare(`
    INSERT INTO gmail_tokens (account_id, access_token, refresh_token, expires_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, accessToken, refreshToken, expiresAt, Date.now())

  return { id, email, name, created_at: createdAt }
}
