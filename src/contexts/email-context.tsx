'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'
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
  isLoading: boolean
  error: string | null
  setSelectedEmail: (email: EmailDetail | null) => void
  setCurrentFolder: (folder: Folder) => void
  refreshEmails: () => Promise<void>
  loadEmailDetail: (id: string) => Promise<void>
  drafts: Draft[]
  saveDraft: (draft: Draft) => void
  deleteDraft: (id: string) => void
  updateDraft: (id: string, draft: Partial<Draft>) => void
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
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Draft[]>(() => readStoredDrafts())

  const refreshEmails = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/gmail/messages?label=${currentFolder.id}&maxResults=25`)
      if (!res.ok) {
        throw new Error('Failed to fetch emails')
      }

      const data: { messages?: Array<{ id: string }> } = await res.json()

      if (data.messages && data.messages.length > 0) {
        const emailDetails = await Promise.all(
          data.messages.map(async (message) => {
            const response = await fetch(`/api/gmail/messages?id=${message.id}`)
            if (!response.ok) {
              throw new Error('Failed to fetch email detail')
            }
            return (await response.json()) as GmailMessage
          })
        )

        setEmails(emailDetails.map(gmailMessageToEmail))
      } else {
        setEmails([])
      }
    } catch (error: unknown) {
      console.error('Failed to refresh emails:', error)
      setError(getErrorMessage(error))
      setEmails([])
    } finally {
      setIsLoading(false)
    }
  }, [currentFolder.id])

  const loadEmailDetail = useCallback(async (id: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/gmail/messages?id=${id}`)
      if (!res.ok) {
        throw new Error('Failed to load email')
      }

      const message = (await res.json()) as GmailMessage
      const detail = gmailMessageToDetail(message)

      if (message.labelIds?.includes('UNREAD')) {
        fetch('/api/gmail/modify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId: id, removeLabels: ['UNREAD'] }),
        }).catch(console.error)
      }

      setSelectedEmail(detail)
    } catch (error: unknown) {
      console.error('Failed to load email:', error)
      setError(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }, [])

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
      const currentDrafts = readStoredDrafts()
      const draftId = draft.id || `draft_${Date.now()}`
      const nextDraft = { ...draft, id: draftId }
      const existing = currentDrafts.findIndex((item) => item.id === draft.id)
      if (existing >= 0) {
        currentDrafts[existing] = nextDraft
      } else {
        currentDrafts.push(nextDraft)
      }
      localStorage.setItem('mailie_drafts', JSON.stringify(currentDrafts))
    }
  }, [])

  const deleteDraft = useCallback((id: string) => {
    setDrafts((prev) => prev.filter((draft) => draft.id !== id))

    if (typeof window !== 'undefined') {
      const currentDrafts = readStoredDrafts()
      localStorage.setItem(
        'mailie_drafts',
        JSON.stringify(currentDrafts.filter((draft) => draft.id !== id))
      )
    }
  }, [])

  const updateDraft = useCallback((id: string, updates: Partial<Draft>) => {
    setDrafts((prev) => prev.map((draft) => (draft.id === id ? { ...draft, ...updates } : draft)))

    if (typeof window !== 'undefined') {
      const currentDrafts = readStoredDrafts()
      const updatedDrafts = currentDrafts.map((draft) => (draft.id === id ? { ...draft, ...updates } : draft))
      localStorage.setItem('mailie_drafts', JSON.stringify(updatedDrafts))
    }
  }, [])

  return (
    <EmailContext.Provider
      value={{
        emails,
        selectedEmail,
        currentFolder,
        folders,
        isLoading,
        error,
        setSelectedEmail,
        setCurrentFolder,
        refreshEmails,
        loadEmailDetail,
        drafts,
        saveDraft,
        deleteDraft,
        updateDraft,
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
