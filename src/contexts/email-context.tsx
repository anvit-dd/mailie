'use client'

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import type { Draft, Email, EmailDetail, Folder } from '@/types/email'
import {
  gmailMessageToDetail,
  gmailMessageToEmail,
  getFolders,
  type GmailMessage,
} from '@/lib/gmail-utils'

interface EmailContextType {
  emails: Email[]
  selectedEmail: EmailDetail | null
  currentFolder: Folder
  folders: Folder[]
  isLoadingList: boolean
  isLoadingEmail: boolean
  error: string | null
  pendingEmailId: string | null
  nextPageToken: string | null
  setSelectedEmail: (email: EmailDetail | null) => void
  setCurrentFolder: (folder: Folder) => void
  refreshEmails: (query?: string, options?: { force?: boolean; append?: boolean }) => Promise<Email[]>
  loadEmailDetail: (id: string) => Promise<void>
  drafts: Draft[]
  saveDraft: (draft: Draft) => void
  deleteDraft: (id: string) => void
  updateDraft: (id: string, draft: Partial<Draft>) => void
  avatarMap: Record<string, string>
  toggleStar: (emailId: string, isStarred: boolean) => Promise<void>
  trashEmail: (emailId: string) => Promise<void>
}

const EmailContext = createContext<EmailContextType | undefined>(undefined)

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Unknown error'
}

function readStoredDrafts(): Draft[] {
  if (typeof window === 'undefined') return []

  const stored = localStorage.getItem('mailie_drafts')
  if (!stored) return []

  try {
    return JSON.parse(stored) as Draft[]
  } catch {
    return []
  }
}

export function EmailProvider({ children }: { children: React.ReactNode }) {
  const [emails, setEmails] = useState<Email[]>([])
  const [selectedEmail, setSelectedEmail] = useState<EmailDetail | null>(null)
  const [currentFolder, setCurrentFolder] = useState<Folder>({
    id: 'INBOX',
    name: 'Inbox',
    icon: 'inbox',
    unreadCount: 0,
  })
  const folders = getFolders()
  const [isLoadingList, setIsLoadingList] = useState(false)
  const [isLoadingEmail, setIsLoadingEmail] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingEmailId, setPendingEmailId] = useState<string | null>(null)
  const [nextPageToken, setNextPageToken] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Draft[]>(() => readStoredDrafts())
  const [avatarMap, setAvatarMap] = useState<Record<string, string>>({})

  // Cache full GmailMessage objects to avoid re-fetching when opening emails
  const [emailCache, setEmailCache] = useState<Record<string, GmailMessage>>({})
  const emailsRef = useRef<Email[]>([])
  const selectedEmailRef = useRef<EmailDetail | null>(null)
  // Keep a ref in sync with cache so loadEmailDetail can read it without needing it in deps
  const emailCacheRef = useRef<Record<string, GmailMessage>>({})
  const refreshAbortRef = useRef<AbortController | null>(null)
  const refreshRequestIdRef = useRef(0)
  const nextPageTokenRef = useRef<string | null>(null)

  const lastFiredRequestKeyRef = useRef<string | undefined>(undefined)

  // Reset debounce when folder changes so navigation always fires
  useEffect(() => {
    lastFiredRequestKeyRef.current = undefined
  }, [currentFolder.id])

  useEffect(() => {
    emailCacheRef.current = emailCache
  }, [emailCache])

  useEffect(() => {
    emailsRef.current = emails
  }, [emails])

  useEffect(() => {
    selectedEmailRef.current = selectedEmail
  }, [selectedEmail])

  useEffect(() => {
    nextPageTokenRef.current = nextPageToken
  }, [nextPageToken])

  const refreshEmails = useCallback(async (query = '', options?: { force?: boolean; append?: boolean }): Promise<Email[]> => {
    const pageToken = options?.append ? nextPageTokenRef.current ?? undefined : undefined
    const requestKey = `${currentFolder.id}::${query}::${pageToken || 'first'}`
    if (!options?.force && requestKey === lastFiredRequestKeyRef.current) return emailsRef.current
    lastFiredRequestKeyRef.current = requestKey
    const requestId = ++refreshRequestIdRef.current
    refreshAbortRef.current?.abort()
    const controller = new AbortController()
    refreshAbortRef.current = controller

    const isCurrentRequest = () => refreshRequestIdRef.current === requestId

    setIsLoadingList(true)
    setError(null)
    if (!options?.append) {
      setNextPageToken(null)
    }
    let nextEmails: Email[] = []

    try {
      // Step 1: get list of message IDs
      const res = await fetch(
        `/api/gmail/messages?label=${currentFolder.id}&maxResults=25${query ? `&q=${encodeURIComponent(query)}` : ''}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`,
        { signal: controller.signal }
      )
      if (!isCurrentRequest()) return emailsRef.current
      if (!res.ok) {
        throw new Error('Failed to fetch emails')
      }

      const data: { messages?: Array<{ id: string }>; nextPageToken?: string | null } = await res.json()

      if (data.messages && data.messages.length > 0) {
        const messageIds = data.messages.map((m) => m.id)

        // Step 2: batch-fetch all full message objects in ONE request
        const batchRes = await fetch('/api/gmail/messages/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: messageIds }),
          signal: controller.signal,
        })

        if (!isCurrentRequest()) return emailsRef.current
        if (!batchRes.ok) {
          throw new Error('Failed to fetch email batch')
        }

        const { messages }: { messages: GmailMessage[] } = await batchRes.json()

        // Cache all fetched messages using functional update to avoid stale closure
        setEmailCache((prev) => {
          const next = new Map(Object.entries(prev))
          for (const msg of messages) {
            next.set(msg.id, msg)
          }
          return Object.fromEntries(next)
        })

        const mappedEmails = messages.map(gmailMessageToEmail)
        nextEmails = options?.append ? [...emailsRef.current, ...mappedEmails] : mappedEmails
        setEmails(nextEmails)
        setNextPageToken(data.nextPageToken ?? null)

        // Fetch avatars for all unique sender emails in one batch call
        const uniqueEmails = [...new Set(messages.map((m) => {
          const fromHeader = m.payload?.headers?.find((h: { name: string; value: string }) => h.name.toLowerCase() === 'from')
          const emailMatch = fromHeader?.value?.match(/<(.+?)>/)
          return emailMatch ? emailMatch[1] : fromHeader?.value ?? ''
        }).filter(Boolean))]

        if (uniqueEmails.length > 0) {
          try {
            const avatarRes = await fetch(`/api/contacts/avatar?emails=${uniqueEmails.join(',')}`, {
              signal: controller.signal,
            })
            if (!isCurrentRequest()) return emailsRef.current
            if (avatarRes.ok) {
              const avatarData: Record<string, string> = await avatarRes.json()
              // Merge: keep previously cached avatars, add new ones
              setAvatarMap((prev) => ({ ...prev, ...avatarData }))
            }
          } catch {
            // Non-fatal — avatars are optional
          }
        }
      } else {
        nextEmails = []
        setEmails([])
        setNextPageToken(null)
      }
    } catch (error: unknown) {
      if (controller.signal.aborted || !isCurrentRequest()) {
        return emailsRef.current
      }
      console.error('Failed to refresh emails:', error)
      setError(getErrorMessage(error))
      nextEmails = []
      setEmails([])
      setNextPageToken(null)
    } finally {
      if (isCurrentRequest()) {
        setIsLoadingList(false)
      }
    }
    return nextEmails
  }, [currentFolder.id])

  const loadEmailDetail = useCallback(async (id: string) => {
    // Optimistic: immediately mark this email as pending so the list highlights it right away
    setPendingEmailId(id)
    setIsLoadingEmail(true)
    setError(null)

    try {
      // Check cache first — message was likely already fetched in refreshEmails
      let message: GmailMessage | null = emailCacheRef.current[id] ?? null

      if (!message || !message.payload?.body && !message.payload?.parts) {
        const res = await fetch(`/api/gmail/messages?id=${id}`)
        if (!res.ok) {
          throw new Error('Failed to load email')
        }
        message = (await res.json()) as GmailMessage

        // Cache it for next time — functional update, no deps needed
        setEmailCache((prev) => ({ ...prev, [id]: message! }))
      }

      const detail = gmailMessageToDetail(message)

      // Mark as read (fire-and-forget) + optimistic update in emails list
      if (message.labelIds?.includes('UNREAD')) {
        fetch('/api/gmail/modify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId: id, removeLabels: ['UNREAD'] }),
        }).catch(console.error)
        // Optimistic: update emails[] so the unread badge disappears immediately
        setEmails((prev) =>
          prev.map((email) =>
            email.id === id ? { ...email, isRead: true } : email
          )
        )
      }

      setSelectedEmail(detail)
    } catch (error: unknown) {
      console.error('Failed to load email:', error)
      setError(getErrorMessage(error))
    } finally {
      setIsLoadingEmail(false)
      setPendingEmailId(null)
    }
  }, [])

  // Strip base64 image data URLs from HTML before saving to localStorage.
  // Base64 images are large (megabytes) and will QuotaExceededError.
  // They can't be restored in draft form anyway — user re-attaches them.
  function stripBase64Images(html: string): string {
    return html.replace(/<img[^>]*src="data:image\/[^"]+"[^>]*>/g, '<img src="/draft-image-placeholder.png" alt="[image]" />')
  }

  const saveDraft = useCallback((draft: Draft) => {
    setDrafts((prev) => {
      const draftId = draft.id || `draft_${Date.now()}`
      const nextDraft = { ...draft, id: draftId }
      const existing = prev.findIndex((item) => item.id === draft.id)
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = nextDraft
        return updated
      }
      return [...prev, nextDraft]
    })

    if (typeof window !== 'undefined') {
      try {
        const currentDrafts = readStoredDrafts()
        const draftId = draft.id || `draft_${Date.now()}`
        // Strip base64 images from body to avoid localStorage quota limits
        const bodyForStorage = stripBase64Images(draft.body)
        const nextDraft = { ...draft, id: draftId, body: bodyForStorage }
        const existing = currentDrafts.findIndex((item) => item.id === draft.id)
        if (existing >= 0) {
          currentDrafts[existing] = nextDraft
        } else {
          currentDrafts.push(nextDraft)
        }
        localStorage.setItem('mailie_drafts', JSON.stringify(currentDrafts))
      } catch (err) {
        // QuotaExceededError or other localStorage error — fail silently
        console.warn('[mailie] Failed to save draft to localStorage:', err)
      }
    }
  }, [])

  const deleteDraft = useCallback((id: string) => {
    setDrafts((prev) => prev.filter((draft) => draft.id !== id))

    if (typeof window !== 'undefined') {
      try {
        const currentDrafts = readStoredDrafts()
        localStorage.setItem(
          'mailie_drafts',
          JSON.stringify(currentDrafts.filter((draft) => draft.id !== id))
        )
      } catch (err) {
        console.warn('[mailie] Failed to delete draft from localStorage:', err)
      }
    }
  }, [])

  const updateDraft = useCallback((id: string, updates: Partial<Draft>) => {
    setDrafts((prev) => prev.map((draft) => (draft.id === id ? { ...draft, ...updates } : draft)))

    if (typeof window !== 'undefined') {
      try {
        const currentDrafts = readStoredDrafts()
        const updatedDrafts = currentDrafts.map((draft) => {
          if (draft.id !== id) return draft
          // Strip base64 images if body is being updated
          const bodyForStorage = updates.body ? stripBase64Images(updates.body) : draft.body
          return { ...draft, ...updates, body: bodyForStorage }
        })
        localStorage.setItem('mailie_drafts', JSON.stringify(updatedDrafts))
      } catch (err) {
        console.warn('[mailie] Failed to update draft in localStorage:', err)
      }
    }
  }, [])

  const toggleStar = useCallback(async (emailId: string, isStarred: boolean) => {
    // Optimistic update — update the email in the list immediately
    setEmails((prev) =>
      prev.map((email) =>
        email.id === emailId ? { ...email, isStarred: !isStarred } : email
      )
    )
    // Also update selectedEmail if it's the one being starred/unstarred
    setSelectedEmail((prev) =>
      prev?.id === emailId ? { ...prev, isStarred: !isStarred } : prev
    )

    try {
      const res = await fetch('/api/gmail/modify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: emailId,
          addLabels: isStarred ? [] : ['STARRED'],
          removeLabels: isStarred ? ['STARRED'] : [],
        }),
      })
      if (!res.ok) throw new Error('Failed to toggle star')
    } catch (err) {
      console.error('Failed to toggle star:', err)
      // Revert optimistic update on failure
      setEmails((prev) =>
        prev.map((email) =>
          email.id === emailId ? { ...email, isStarred } : email
        )
      )
      setSelectedEmail((prev) =>
        prev?.id === emailId ? { ...prev, isStarred } : prev
      )
    }
  }, [])

  const trashEmail = useCallback(async (emailId: string) => {
    // Optimistic remove from list
    let removedEmail: Email | undefined
    setEmails((prev) => {
      removedEmail = prev.find((e) => e.id === emailId)
      return prev.filter((e) => e.id !== emailId)
    })
    // Clear selection if deleted email was selected
    setSelectedEmail((prev) => (prev?.id === emailId ? null : prev))

    try {
      const res = await fetch('/api/gmail/trash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: emailId }),
      })
      if (!res.ok) throw new Error('Failed to trash email')
    } catch (err) {
      console.error('Failed to trash email:', err)
      // Revert on failure
      if (removedEmail) {
        setEmails((prev) => [removedEmail!, ...prev])
      }
    }
  }, [])

  return (
    <EmailContext.Provider
      value={{
        emails,
        selectedEmail,
        currentFolder,
        folders,
        isLoadingList,
        isLoadingEmail,
        error,
        pendingEmailId,
        nextPageToken,
        setSelectedEmail,
        setCurrentFolder,
        refreshEmails,
        loadEmailDetail,
        drafts,
        saveDraft,
        deleteDraft,
        updateDraft,
        avatarMap,
        toggleStar,
        trashEmail,
      }}
    >
      {children}
    </EmailContext.Provider>
  )
}

export function useEmail(): EmailContextType {
  const context = useContext(EmailContext)
  if (context === undefined) {
    throw new Error('useEmail must be used within an EmailProvider')
  }
  return context
}
