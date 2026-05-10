'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import {
  CONTACTS_UPDATED_EVENT,
  mergeCachedContacts,
  readCachedContacts,
  type Contact,
} from '@/lib/contact-cache'

// Load contacts from localStorage (collected from sent/received emails)
const CONTACTS_KEY = 'mailie_contacts'

function loadLocalContacts(): Contact[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(CONTACTS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveContact(email: string, name?: string) {
  const contacts = loadLocalContacts()
  const existing = contacts.findIndex((c) => c.email.toLowerCase() === email.toLowerCase())
  if (existing >= 0) {
    if (name && !contacts[existing].name) {
      contacts[existing].name = name
    }
  } else {
    contacts.push({ email, name: name || '' })
  }
  // Keep most recent 200 contacts
  localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts.slice(-200)))
}

// Call this when sending an email to record the recipient
export function recordContact(email: string, name?: string) {
  saveContact(email, name)
}

export function recordAccountContact(
  provider: string | null,
  accountKey: string | undefined,
  email: string,
  name?: string
) {
  saveContact(email, name)
  mergeCachedContacts({
    provider,
    accountKey,
    contacts: [{ email, name: name || '' }],
  })
}

interface ContactAutocompleteProps {
  value: string
  onChange: (value: string) => void
  /** Called with the email when user selects a contact from the dropdown */
  onAdd?: (email: string) => void
  onSelectContact?: (contact: Contact) => void
  placeholder?: string
  className?: string
  excludeEmails?: string[]
}

export function ContactAutocomplete({
  value,
  onChange,
  onAdd,
  onSelectContact,
  placeholder = 'To',
  className,
  excludeEmails = [],
}: ContactAutocompleteProps) {
  const { provider, account } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [localContacts, setLocalContacts] = useState<Contact[]>(() => loadLocalContacts())
  const [gmailContacts, setGmailContacts] = useState<Contact[]>(
    () => readCachedContacts(provider, account?.email)
  )

  const excludeSet = useMemo(
    () => new Set(excludeEmails.map((e) => e.toLowerCase())),
    [excludeEmails]
  )

  const allContacts = useMemo(() => {
    const merged = provider === 'gmail' ? [...gmailContacts] : []
    for (const contact of localContacts) {
      if (!merged.some((existing) => existing.email.toLowerCase() === contact.email.toLowerCase())) {
        merged.push(contact)
      }
    }
    return merged
  }, [gmailContacts, localContacts, provider])

  useEffect(() => {
    function refreshContacts() {
      setLocalContacts(loadLocalContacts())
      setGmailContacts(readCachedContacts(provider, account?.email))
    }

    window.addEventListener(CONTACTS_UPDATED_EVENT, refreshContacts)
    return () => window.removeEventListener(CONTACTS_UPDATED_EVENT, refreshContacts)
  }, [provider, account?.email])

  const suggestions = useMemo(() => {
    if (!value.trim()) return []

    const query = value.toLowerCase()
    return allContacts
      .filter((contact) => {
        const matches =
          contact.email.toLowerCase().includes(query) ||
          contact.name.toLowerCase().includes(query)
        return matches && !excludeSet.has(contact.email.toLowerCase())
      })
      .slice(0, 8)
  }, [value, allContacts, excludeSet])

  const showDropdown = isDropdownOpen && suggestions.length > 0

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setFocusedIndex((i) => Math.min(i + 1, suggestions.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setFocusedIndex((i) => Math.max(i - 1, 0))
        break
      case 'Enter':
      case 'Tab':
        if (focusedIndex >= 0 && suggestions[focusedIndex]) {
          e.preventDefault()
          selectContact(suggestions[focusedIndex])
        }
        break
      case 'Escape':
        setIsDropdownOpen(false)
        setFocusedIndex(-1)
        break
    }
  }

  function selectContact(contact: Contact) {
    onAdd?.(contact.email)
    onSelectContact?.(contact)
    setIsDropdownOpen(false)
    setFocusedIndex(-1)
    onChange('')
    inputRef.current?.focus()
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value)
    setIsDropdownOpen(Boolean(e.target.value.trim()))
    setFocusedIndex(-1)
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    handleKeyDown(e)

    if (e.key === 'Enter' && !e.shiftKey && focusedIndex < 0 && value.trim()) {
      const email = value.trim()
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        e.preventDefault()
        onAdd?.(email)
        onChange('')
        setIsDropdownOpen(false)
        setFocusedIndex(-1)
      }
    }
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false)
        setFocusedIndex(-1)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="email"
        value={value}
        onChange={handleInputChange}
        onFocus={() => setIsDropdownOpen(Boolean(value.trim()))}
        onKeyDown={handleInputKeyDown}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute z-50 top-full left-0 mt-1 w-[min(420px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] bg-[var(--card)] border border-[var(--border)] rounded-sm shadow-xl max-h-60 overflow-y-auto"
        >
          {suggestions.map((contact, idx) => (
            <button
              key={contact.email}
              onClick={() => selectContact(contact)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                idx === focusedIndex
                  ? 'bg-[var(--surface-deep)]'
                  : 'hover:bg-[var(--surface-deep)]'
              }`}
            >
              <div className="w-6 h-6 rounded-full bg-[var(--accent)]/15 flex items-center justify-center shrink-0">
                <span className="font-mono text-[10px] text-[var(--accent)] font-semibold">
                  {(contact.name || contact.email).charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                {contact.name && (
                  <p className="font-mono text-[12px] text-[var(--foreground)] truncate">{contact.name}</p>
                )}
                <p className="font-mono text-[11px] text-[var(--muted-foreground)] truncate">{contact.email}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
