const DEFAULT_APP_URL = 'http://localhost:3000'

function readEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]
    if (value) return value
  }
  return undefined
}

export function getAppUrl(): string {
  return (readEnv('APP_URL', 'NEXT_PUBLIC_APP_URL') ?? DEFAULT_APP_URL).replace(/\/+$/, '')
}

export function getGmailClientId(): string {
  const clientId = readEnv('GMAIL_CLIENT_ID', 'NEXT_PUBLIC_GMAIL_CLIENT_ID')
  if (!clientId) {
    throw new Error('Missing Gmail OAuth client ID')
  }
  return clientId
}

export function getGmailClientSecret(): string {
  const clientSecret = readEnv('GMAIL_CLIENT_SECRET')
  if (!clientSecret) {
    throw new Error('Missing Gmail OAuth client secret')
  }
  return clientSecret
}

export function getGmailRedirectUri(): string {
  return new URL('/api/auth/callback', getAppUrl()).toString()
}
