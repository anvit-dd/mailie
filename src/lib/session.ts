import { db, type Account, type Session } from './db'
import { randomBytes } from 'crypto'
import { decrypt, encrypt } from './crypto'

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

  if (!tokens) return { ...account, gmailTokens: null }

  return {
    ...account,
    gmailTokens: {
      access_token: decryptToken(tokens.access_token),
      refresh_token: tokens.refresh_token ? decryptToken(tokens.refresh_token) : null,
      expires_at: tokens.expires_at,
    },
  }
}

export function deleteSession(sessionId: string): void {
  db.prepare(`DELETE FROM sessions WHERE id = ?`).run(sessionId)
}

export function deleteAccountSessions(accountId: string): void {
  db.prepare(`DELETE FROM sessions WHERE account_id = ?`).run(accountId)
}

export function encryptToken(token: string): string {
  return encrypt(token)
}

export function decryptToken(token: string): string {
  try {
    return decrypt(token)
  } catch {
    // Legacy rows stored tokens in plaintext. Return as-is so next refresh/login can rewrite encrypted.
    return token
  }
}

function isEncryptedToken(token: string | null): boolean {
  if (!token) return true
  try {
    decrypt(token)
    return true
  } catch {
    return false
  }
}

export function encryptExistingPlaintextGmailTokens(): void {
  const rows = db.prepare(`
    SELECT account_id, access_token, refresh_token FROM gmail_tokens
  `).all() as Array<{ account_id: string; access_token: string; refresh_token: string | null }>

  const update = db.prepare(`
    UPDATE gmail_tokens SET access_token = ?, refresh_token = ?, updated_at = ? WHERE account_id = ?
  `)

  for (const row of rows) {
    const accessToken = isEncryptedToken(row.access_token) ? row.access_token : encryptToken(row.access_token)
    const refreshToken = isEncryptedToken(row.refresh_token) ? row.refresh_token : encryptToken(row.refresh_token!)
    if (accessToken !== row.access_token || refreshToken !== row.refresh_token) {
      update.run(accessToken, refreshToken, Date.now(), row.account_id)
    }
  }
}

try {
  encryptExistingPlaintextGmailTokens()
} catch {
  // Encryption key may be missing during first setup; token writes will fail until configured.
}

export function getOrCreateAccount(email: string, name: string | null, accessToken: string, refreshToken: string | null, expiresAt: number, picture?: string | null): Account {
  const encryptedAccessToken = encryptToken(accessToken)
  const encryptedRefreshToken = refreshToken ? encryptToken(refreshToken) : null
  const existing = db.prepare(`SELECT * FROM accounts WHERE email = ?`).get(email) as Account | undefined
  if (existing) {
    // Update tokens + picture
    db.prepare(`
      INSERT INTO gmail_tokens (account_id, access_token, refresh_token, expires_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(account_id) DO UPDATE SET
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at
    `).run(existing.id, encryptedAccessToken, encryptedRefreshToken, expiresAt, Date.now())
    db.prepare(`UPDATE accounts SET name = ?, provider = 'gmail' WHERE id = ?`).run(name ?? existing.name, existing.id)
    // Update picture if provided
    if (picture !== undefined) {
      db.prepare(`UPDATE accounts SET name = ?, picture = ? WHERE id = ?`).run(name, picture, existing.id)
    }
    return { ...existing, name: name ?? existing.name, picture: picture ?? existing.picture, provider: 'gmail' as const }
  }

  const id = randomBytes(16).toString('hex')
  const createdAt = Date.now()

  db.prepare(`INSERT INTO accounts (id, email, name, picture, provider, created_at) VALUES (?, ?, ?, ?, 'gmail', ?)`).run(id, email, name, picture ?? null, createdAt)

  db.prepare(`
    INSERT INTO gmail_tokens (account_id, access_token, refresh_token, expires_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, encryptedAccessToken, encryptedRefreshToken, expiresAt, Date.now())

  return { id, email, name: name ?? null, picture: picture ?? null, provider: 'gmail' as const, created_at: createdAt }
}
