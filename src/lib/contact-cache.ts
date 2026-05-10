export interface Contact {
  name: string
  email: string
}

const CONTACTS_CACHE_PREFIX = 'mailie_contacts_cache:v1'
const CONTACTS_SYNC_PREFIX = 'mailie_contacts_sync:v1'
export const CONTACTS_UPDATED_EVENT = 'mailie:contacts-updated'
const memoryCache = new Map<string, Contact[]>()
const syncRequests = new Map<string, Promise<Contact[]>>()

function cacheKey(provider: string, accountKey?: string) {
  return `${CONTACTS_CACHE_PREFIX}:${provider}:${accountKey ?? 'default'}`
}

function syncKey(provider: string, accountKey?: string) {
  return `${CONTACTS_SYNC_PREFIX}:${provider}:${accountKey ?? 'default'}`
}

function normalizeContacts(contacts: Contact[]): Contact[] {
  const seen = new Map<string, Contact>()

  for (const contact of contacts) {
    const email = contact.email.trim()
    if (!email) continue

    const lower = email.toLowerCase()
    const existing = seen.get(lower)
    if (!existing) {
      seen.set(lower, {
        name: contact.name?.trim() || '',
        email,
      })
      continue
    }

    if (!existing.name && contact.name?.trim()) {
      seen.set(lower, {
        name: contact.name.trim(),
        email: existing.email,
      })
    }
  }

  return [...seen.values()]
}

export function getContactsCacheKey(provider: string | null, accountKey?: string): string {
  return cacheKey(provider ?? 'unknown', accountKey)
}

export function readCachedContacts(provider: string | null, accountKey?: string): Contact[] {
  if (typeof window === 'undefined') return []

  const key = cacheKey(provider ?? 'unknown', accountKey)
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []

    const parsed = JSON.parse(raw) as { contacts?: Contact[] }
    return normalizeContacts(parsed.contacts ?? [])
  } catch {
    return []
  }
}

function writeCachedContacts(provider: string | null, accountKey: string | undefined, contacts: Contact[]) {
  if (typeof window === 'undefined') return

  const key = cacheKey(provider ?? 'unknown', accountKey)
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        updatedAt: Date.now(),
        contacts: normalizeContacts(contacts).slice(0, 1000),
      })
    )
  } catch {
    // Cache is best-effort.
  }
}

export function mergeCachedContacts(options: {
  provider: string | null
  accountKey?: string
  contacts: Contact[]
}): Contact[] {
  const { provider, accountKey, contacts } = options
  if (!provider || contacts.length === 0) {
    return readCachedContacts(provider, accountKey)
  }

  const key = cacheKey(provider, accountKey)
  const existing = memoryCache.get(key) ?? readCachedContacts(provider, accountKey)
  const merged = normalizeContacts([...contacts, ...existing]).slice(0, 1000)

  memoryCache.set(key, merged)
  writeCachedContacts(provider, accountKey, merged)

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CONTACTS_UPDATED_EVENT, { detail: { key } }))
  }

  return merged
}

export async function syncContactsFromMailbox(options: {
  provider: string | null
  accountKey?: string
  maxAgeMs?: number
}): Promise<Contact[]> {
  const { provider, accountKey, maxAgeMs = 24 * 60 * 60 * 1000 } = options
  if (provider !== 'gmail' || typeof window === 'undefined') {
    return readCachedContacts(provider, accountKey)
  }

  const key = syncKey(provider, accountKey)
  const lastSync = Number(localStorage.getItem(key) || '0')
  if (Date.now() - lastSync < maxAgeMs) {
    return readCachedContacts(provider, accountKey)
  }

  const existing = syncRequests.get(key)
  if (existing) return existing

  const request = fetch('/api/contacts/sync', { credentials: 'include' })
    .then(async (response) => {
      if (!response.ok) return readCachedContacts(provider, accountKey)

      const data = await response.json() as { contacts?: Contact[] }
      const merged = mergeCachedContacts({
        provider,
        accountKey,
        contacts: data.contacts ?? [],
      })
      localStorage.setItem(key, String(Date.now()))
      return merged
    })
    .finally(() => {
      syncRequests.delete(key)
    })

  syncRequests.set(key, request)
  return request
}
