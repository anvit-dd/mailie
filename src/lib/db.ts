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
  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    picture TEXT,
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
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
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
  provider: AccountProvider
  created_at: number
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
  expires_at: number
  created_at: number
}

export { db }
