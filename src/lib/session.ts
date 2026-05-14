import { db, type Account, type Session, type User } from './db'
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { decrypt, encrypt } from './crypto'

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export type PublicUser = Pick<User, 'id' | 'username' | 'phone'>

export type AccountWithTokens = Account & {
  gmailTokens: { access_token: string; refresh_token: string | null; expires_at: number } | null
}

export type AccountCapabilities = { smtp: boolean; imap: boolean }

export type MailAccountSummary = {
  id: string
  email: string
  name: string | null
  provider: 'gmail' | 'smtp_imap'
  capabilities: AccountCapabilities
  lastUsedAt: number | null
}

export type ActiveAccountAuth = {
  session: Session
  user: PublicUser
  account: AccountWithTokens
  capabilities: AccountCapabilities
}

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, 64)
  return { hash: hash.toString('base64'), salt: salt.toString('base64') }
}

export function verifyPassword(password: string, salt: string, hash: string): boolean {
  const expected = Buffer.from(hash, 'base64')
  const actual = scryptSync(password, Buffer.from(salt, 'base64'), expected.length)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase()
}

export function validateUsername(username: string): string | null {
  if (!/^[a-z0-9_]{3,32}$/.test(username)) {
    return 'Username must be 3-32 characters and use only lowercase letters, numbers, and underscores'
  }
  return null
}

export function normalizePhone(phone: string): string {
  return phone.trim().replace(/[\s\-()]/g, '')
}

export function validatePhone(phone: string): string | null {
  if (!/^\+?\d{7,15}$/.test(phone)) {
    return 'Phone number must contain 7-15 digits and may start with +'
  }
  return null
}

export function createUser(username: string, password: string, phone: string): PublicUser {
  const normalizedUsername = normalizeUsername(username)
  const normalizedPhone = normalizePhone(phone)
  const usernameError = validateUsername(normalizedUsername)
  if (usernameError) throw new Error(usernameError)
  const phoneError = validatePhone(normalizedPhone)
  if (phoneError) throw new Error(phoneError)
  if (password.length < 8) throw new Error('Password must be at least 8 characters')

  const existing = db.prepare(`SELECT id FROM users WHERE username = ?`).get(normalizedUsername)
  if (existing) throw new Error('Username already exists')

  const id = randomBytes(16).toString('hex')
  const now = Date.now()
  const { hash, salt } = hashPassword(password)
  const firstUser = (db.prepare(`SELECT COUNT(*) as count FROM users`).get() as { count: number }).count === 0

  db.transaction(() => {
    db.prepare(`
      INSERT INTO users (id, username, phone, password_hash, password_salt, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, normalizedUsername, normalizedPhone, hash, salt, now, now)

    if (firstUser) {
      db.prepare(`UPDATE accounts SET user_id = ?, last_used_at = COALESCE(last_used_at, ?) WHERE user_id IS NULL`).run(id, now)
    }
  })()

  return { id, username: normalizedUsername, phone: normalizedPhone }
}

export function getUserByCredentials(username: string, password: string): PublicUser | null {
  const normalizedUsername = normalizeUsername(username)
  const user = db.prepare(`SELECT * FROM users WHERE username = ?`).get(normalizedUsername) as User | undefined
  if (!user) return null
  if (!verifyPassword(password, user.password_salt, user.password_hash)) return null
  return { id: user.id, username: user.username, phone: user.phone }
}

export function getCurrentUser(sessionId: string): PublicUser | null {
  const session = getSession(sessionId)
  if (!session) return null
  const user = db.prepare(`SELECT id, username, phone FROM users WHERE id = ?`).get(session.user_id) as PublicUser | undefined
  return user ?? null
}

export function createUserSession(userId: string, activeAccountId: string | null = null): Session {
  const id = randomBytes(32).toString('hex')
  const now = Date.now()
  const expiresAt = now + SESSION_DURATION_MS

  db.prepare(`
    INSERT INTO sessions (id, account_id, user_id, active_account_id, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, activeAccountId, userId, activeAccountId, expiresAt, now)

  return { id, account_id: activeAccountId ?? '', user_id: userId, active_account_id: activeAccountId, expires_at: expiresAt, created_at: now }
}

export function createSession(accountId: string): Session {
  const account = db.prepare(`SELECT user_id FROM accounts WHERE id = ?`).get(accountId) as { user_id: string | null } | undefined
  if (!account?.user_id) throw new Error('Cannot create mailbox session without owner user')
  return createUserSession(account.user_id, accountId)
}

export function getSession(sessionId: string): Session | null {
  const session = db.prepare(`
    SELECT * FROM sessions WHERE id = ? AND expires_at > ? AND user_id IS NOT NULL
  `).get(sessionId, Date.now()) as Session | undefined

  if (!session) return null
  return { ...session, account_id: session.active_account_id ?? session.account_id ?? '' }
}

export function setActiveAccount(sessionId: string, accountId: string | null): void {
  const session = getSession(sessionId)
  if (!session) throw new Error('Invalid session')

  if (accountId) {
    const account = db.prepare(`SELECT id FROM accounts WHERE id = ? AND user_id = ?`).get(accountId, session.user_id)
    if (!account) throw new Error('Account not found')
    db.prepare(`UPDATE accounts SET last_used_at = ? WHERE id = ?`).run(Date.now(), accountId)
  }

  db.prepare(`UPDATE sessions SET active_account_id = ?, account_id = ? WHERE id = ?`).run(accountId, accountId, sessionId)
}

export function deleteSession(sessionId: string): void {
  db.prepare(`DELETE FROM sessions WHERE id = ?`).run(sessionId)
}

export function deleteAccountSessions(accountId: string): void {
  db.prepare(`DELETE FROM sessions WHERE active_account_id = ? OR account_id = ?`).run(accountId, accountId)
}

export function encryptToken(token: string): string {
  return encrypt(token)
}

export function decryptToken(token: string): string {
  try {
    return decrypt(token)
  } catch {
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

export function getAccountWithTokens(accountId: string): AccountWithTokens | null {
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

export function getAccountCapabilities(accountId: string, provider: Account['provider']): AccountCapabilities {
  if (provider === 'gmail') return { smtp: true, imap: true }

  const row = db.prepare(`
    SELECT smtp_host, smtp_port, smtp_username, smtp_password_encrypted,
           imap_host, imap_port, imap_username, imap_password_encrypted
    FROM mail_credentials WHERE account_id = ?
  `).get(accountId) as {
    smtp_host: string | null
    smtp_port: number | null
    smtp_username: string | null
    smtp_password_encrypted: string | null
    imap_host: string | null
    imap_port: number | null
    imap_username: string | null
    imap_password_encrypted: string | null
  } | undefined

  return {
    smtp: Boolean(row?.smtp_host && row.smtp_port && row.smtp_username && row.smtp_password_encrypted),
    imap: Boolean(row?.imap_host && row.imap_port && row.imap_username && row.imap_password_encrypted),
  }
}

export function toMailAccountSummary(account: Account): MailAccountSummary {
  return {
    id: account.id,
    email: account.email,
    name: account.name,
    provider: account.provider,
    capabilities: getAccountCapabilities(account.id, account.provider),
    lastUsedAt: account.last_used_at ?? null,
  }
}

export function listUserAccounts(userId: string): MailAccountSummary[] {
  const accounts = db.prepare(`
    SELECT * FROM accounts WHERE user_id = ? ORDER BY COALESCE(last_used_at, created_at) DESC
  `).all(userId) as Account[]

  return accounts.map(toMailAccountSummary)
}

export function getActiveAccountWithTokens(sessionId: string): AccountWithTokens | null {
  const session = getSession(sessionId)
  if (!session?.active_account_id) return null
  const account = getAccountWithTokens(session.active_account_id)
  if (!account || account.user_id !== session.user_id) return null
  return account
}

export function getActiveAccountAuth(sessionId: string): ActiveAccountAuth | null {
  const session = getSession(sessionId)
  if (!session?.active_account_id) return null
  const user = db.prepare(`SELECT id, username, phone FROM users WHERE id = ?`).get(session.user_id) as PublicUser | undefined
  if (!user) return null
  const account = getAccountWithTokens(session.active_account_id)
  if (!account || account.user_id !== session.user_id) return null
  return { session, user, account, capabilities: getAccountCapabilities(account.id, account.provider) }
}

export function getSessionUserAndAccounts(sessionId: string): { user: PublicUser; activeAccount: MailAccountSummary | null; accounts: MailAccountSummary[] } | null {
  const session = getSession(sessionId)
  if (!session) return null
  const user = db.prepare(`SELECT id, username, phone FROM users WHERE id = ?`).get(session.user_id) as PublicUser | undefined
  if (!user) return null
  const accounts = listUserAccounts(session.user_id)
  const activeAccount = accounts.find((account) => account.id === session.active_account_id) ?? null
  return { user, activeAccount, accounts }
}

export function getLastUsedAccountId(userId: string): string | null {
  const row = db.prepare(`
    SELECT id FROM accounts WHERE user_id = ? ORDER BY COALESCE(last_used_at, created_at) DESC LIMIT 1
  `).get(userId) as { id: string } | undefined
  return row?.id ?? null
}

export function getOrCreateAccount(userId: string, email: string, name: string | null, accessToken: string, refreshToken: string | null, expiresAt: number, picture?: string | null): Account {
  const encryptedAccessToken = encryptToken(accessToken)
  const encryptedRefreshToken = refreshToken ? encryptToken(refreshToken) : null
  const existing = db.prepare(`SELECT * FROM accounts WHERE email = ?`).get(email) as Account | undefined
  const now = Date.now()

  if (existing) {
    if (existing.user_id && existing.user_id !== userId) {
      throw new Error('Mailbox already belongs to another user')
    }
    db.prepare(`
      INSERT INTO gmail_tokens (account_id, access_token, refresh_token, expires_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(account_id) DO UPDATE SET
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at
    `).run(existing.id, encryptedAccessToken, encryptedRefreshToken, expiresAt, now)
    db.prepare(`UPDATE accounts SET name = ?, picture = COALESCE(?, picture), provider = 'gmail', user_id = ?, last_used_at = ? WHERE id = ?`)
      .run(name ?? existing.name, picture ?? null, userId, now, existing.id)
    return { ...existing, name: name ?? existing.name, picture: picture ?? existing.picture, provider: 'gmail' as const, user_id: userId, last_used_at: now }
  }

  const id = randomBytes(16).toString('hex')
  db.prepare(`
    INSERT INTO accounts (id, email, name, picture, user_id, last_used_at, provider, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'gmail', ?)
  `).run(id, email, name, picture ?? null, userId, now, now)

  db.prepare(`
    INSERT INTO gmail_tokens (account_id, access_token, refresh_token, expires_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, encryptedAccessToken, encryptedRefreshToken, expiresAt, now)

  return { id, email, name: name ?? null, picture: picture ?? null, user_id: userId, last_used_at: now, provider: 'gmail' as const, created_at: now }
}
