import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'data', 'mailie.db')

// Ensure data directory exists
import fs from 'fs'
const dataDir = path.dirname(DB_PATH)
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    picture TEXT,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    last_used_at INTEGER,
    provider TEXT DEFAULT 'gmail' NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS gmail_tokens (
    account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS mail_credentials (
    account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT,
    smtp_host TEXT NOT NULL,
    smtp_port INTEGER NOT NULL,
    smtp_secure INTEGER NOT NULL,
    smtp_username TEXT NOT NULL,
    smtp_password_encrypted TEXT NOT NULL,
    imap_host TEXT NOT NULL,
    imap_port INTEGER NOT NULL,
    imap_secure INTEGER NOT NULL,
    imap_username TEXT NOT NULL,
    imap_password_encrypted TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    account_id TEXT REFERENCES accounts(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    active_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS account_preferences (
    account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    hidden_gmail_label_ids TEXT NOT NULL DEFAULT '[]',
    gmail_label_order TEXT NOT NULL DEFAULT '[]',
    updated_at INTEGER NOT NULL
  );
`)

// Migrate old schema: add picture column if missing (CREATE TABLE IF NOT EXISTS won't alter existing tables)
try {
  db.exec(`ALTER TABLE accounts ADD COLUMN picture TEXT`)
} catch {
  // Column already exists — ignore
}

try {
  db.exec(`ALTER TABLE accounts ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE`)
} catch {
  // Column already exists — ignore
}

try {
  db.exec(`ALTER TABLE accounts ADD COLUMN last_used_at INTEGER`)
} catch {
  // Column already exists — ignore
}

// Migrate mail_credentials: make imap_password_encrypted nullable (was NOT NULL before SMTP-only logins)
try {
  db.exec(`ALTER TABLE mail_credentials ADD COLUMN imap_password_encrypted_temp TEXT`)
  db.exec(`UPDATE mail_credentials SET imap_password_encrypted_temp = imap_password_encrypted`)
  db.exec(`ALTER TABLE mail_credentials DROP COLUMN imap_password_encrypted`)
  db.exec(`ALTER TABLE mail_credentials ADD COLUMN imap_password_encrypted TEXT`)
  db.exec(`UPDATE mail_credentials SET imap_password_encrypted = imap_password_encrypted_temp`)
  db.exec(`ALTER TABLE mail_credentials DROP COLUMN imap_password_encrypted_temp`)
} catch (e: unknown) {
  // Some step failed — likely already migrated or fresh DB, safe to ignore
  if (e instanceof Error && !e.message.includes('duplicate column')) {
    // only re-throw if it's not the "column already exists" kind of error
  }
}

// Migrate old schema: add provider column if missing
try {
  db.exec(`ALTER TABLE accounts ADD COLUMN provider TEXT DEFAULT 'gmail'`)
} catch {
  // Column already exists — ignore
}

try {
  db.exec(`ALTER TABLE sessions ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE`)
} catch {
  // Column already exists — ignore
}

try {
  db.exec(`ALTER TABLE sessions ADD COLUMN active_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL`)
} catch {
  // Column already exists — ignore
}

try {
  const columns = db.prepare(`PRAGMA table_info(sessions)`).all() as Array<{ name: string; notnull: number }>
  const accountIdColumn = columns.find((column) => column.name === 'account_id')
  if (accountIdColumn?.notnull) {
    db.exec(`
      CREATE TABLE sessions_new (
        id TEXT PRIMARY KEY,
        account_id TEXT REFERENCES accounts(id) ON DELETE CASCADE,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        active_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
      INSERT INTO sessions_new (id, account_id, user_id, active_account_id, expires_at, created_at)
      SELECT id, account_id, user_id, active_account_id, expires_at, created_at FROM sessions;
      DROP TABLE sessions;
      ALTER TABLE sessions_new RENAME TO sessions;
    `)
  }
} catch {
  // Best-effort migration; fresh schema already has nullable account_id.
}

try {
  db.exec(`ALTER TABLE account_preferences ADD COLUMN gmail_label_order TEXT NOT NULL DEFAULT '[]'`)
} catch {
  // Column already exists — ignore
}

export type AccountProvider = 'gmail' | 'smtp_imap'

export interface Account {
  id: string
  email: string
  name: string | null
  picture?: string | null
  user_id?: string | null
  last_used_at?: number | null
  provider: AccountProvider
  created_at: number
}

export interface User {
  id: string
  username: string
  phone: string
  password_hash: string
  password_salt: string
  created_at: number
  updated_at: number
}

export interface GmailTokens {
  account_id: string
  access_token: string
  refresh_token: string | null
  expires_at: number
  updated_at: number
}

export interface Session {
  id: string
  account_id: string
  user_id: string
  active_account_id: string | null
  expires_at: number
  created_at: number
}

export { db }
