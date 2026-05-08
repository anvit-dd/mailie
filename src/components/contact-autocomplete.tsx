'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { toast } from 'sonner'

export interface Contact {
  name: string
  email: string
}

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
  const { provider } = useAuth()
  const [suggestions, setSuggestions] = useState<Contact[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const localContacts = useState<Contact[]>(() => loadLocalContacts())[0]

  // Fetch Gmail contacts when provider is gmail
  const [gmailContacts, setGmailContacts] = useState<Contact[]>([])

  // Stable excludeEmails set for the filter effect
  const excludeSet = useMemo(() => new Set(excludeEmails.map((e) => e.toLowerCase())), [excludeEmails])

  // Compute all contacts (local + Gmail, deduplicated) — stable reference
  const allContacts = useMemo(() => {
    const merged = [...gmailContacts]
    for (const c of localContacts) {
      if (!merged.some((ac) => ac.email.toLowerCase() === c.email.toLowerCase())) {
        merged.push(c)
      }
    }
    return merged
  }, [gmailContacts, localContacts])

  useEffect(() => {
    if (provider !== 'gmail') return

    async function fetchGmailContacts() {
      try {
        const res = await fetch('/api/contacts/list', { credentials: 'include' })
        if (!res.ok) return
        const data = await res.json() as { contacts?: Array<{ name?: string; email: string }> }
        if (data.contacts) {
          setGmailContacts(data.contacts.map((c) => ({ name: c.name || '', email: c.email })))
        }
      } catch {
        // Non-fatal
      }
    }

    void fetchGmailContacts()
  }, [provider])

  useEffect(() => {
    if (!value.trim()) {
      setSuggestions([])
      setShowDropdown(false)
      return
    }

    const query = value.toLowerCase()
    const filtered = allContacts
      .filter((c) => {
        const matches = c.email.toLowerCase().includes(query) || c.name.toLowerCase().includes(query)
        const notExcluded = !excludeSet.has(c.email.toLowerCase())
        return matches && notExcluded
      })
      .slice(0, 8)

    setSuggestions(filtered)
    setShowDropdown(filtered.length > 0)
    setFocusedIndex(-1)
  }, [value, allContacts, excludeSet])

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
        setShowDropdown(false)
        setFocusedIndex(-1)
        break
    }
  }

  function selectContact(contact: Contact) {
    // Add to recipient list immediately (not just as text input)
    onAdd?.(contact.email)
    onSelectContact?.(contact)
    setShowDropdown(false)
    setFocusedIndex(-1)
    // Clear the input after selecting
    onChange('')
    inputRef.current?.focus()
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value)
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    handleKeyDown(e)
    // Add raw typed email on Enter (when not selecting from suggestions)
    if (e.key === 'Enter' && !e.shiftKey && focusedIndex < 0 && value.trim()) {
      const email = value.trim()
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        e.preventDefault()
        onAdd?.(email)
        onChange('')
      }
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false)
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
        onKeyDown={handleInputKeyDown}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {showDropdown && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 top-full left-0 right-0 mt-1 bg-[var(--card)] border border-[var(--border)] rounded-sm shadow-xl max-h-60 overflow-y-auto"
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