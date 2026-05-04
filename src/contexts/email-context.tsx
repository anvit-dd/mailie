'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'
import type { Email, EmailDetail, Folder, Draft } from '@/types/email'

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

function decodeBase64Url(base64Url: string): string {
  const base64 = base64Url
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(base64Url.length + (4 - (base64Url.length % 4)) % 4, '=')

  if (typeof window !== 'undefined') {
    return decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
  }
  const { Buffer } = require('buffer')
  return Buffer.from(base64, 'base64').toString('utf-8')
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function stripHtml(html: string): string {
  return decodeHtmlEntities(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ') // remove any remaining named entities
    .replace(/\s+/g, ' ')
    .trim()
}

function parseEmailAddress(headerValue: string): { name: string; email: string } {
  const match = headerValue.match(/^(.+?)\s*<(.+)>$/)
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() }
  }
  return { name: '', email: headerValue.trim() }
}

function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  const header = headers.find((h) => h.name.toLowerCase() === name.toLowerCase())
  return header?.value || ''
}

function extractBody(payload: any): { body: string; bodyPlain: string } {
  if (!payload) return { body: '', bodyPlain: '' }
  const { body, parts } = payload

  if (!parts) {
    const data = body?.data
    if (!data) return { body: '', bodyPlain: '' }
    const decoded = decodeBase64Url(data)
    const mimeType = payload.mimeType || 'text/plain'
    if (mimeType === 'text/html') {
      return { body: decoded, bodyPlain: stripHtml(decoded) }
    }
    return { body: '', bodyPlain: decoded }
  }

  for (const part of parts) {
    if (part.mimeType === 'text/html') {
      const data = part.body?.data
      if (data) {
        const decoded = decodeBase64Url(data)
        return { body: decoded, bodyPlain: stripHtml(decoded) }
      }
    }
  }

  for (const part of parts) {
    if (part.mimeType === 'text/plain') {
      const data = part.body?.data
      if (data) {
        const decoded = decodeBase64Url(data)
        return { body: '', bodyPlain: decoded }
      }
    }
  }

  for (const part of parts) {
    if (part.parts) {
      const nested = extractBody(part)
      if (nested.body || nested.bodyPlain) return nested
    }
  }

  return { body: '', bodyPlain: '' }
}

function extractAttachments(payload: any): Array<{ id: string; filename: string; mimeType: string; size: number }> {
  const attachments: Array<{ id: string; filename: string; mimeType: string; size: number }> = []

  function traverse(parts: any[]) {
    for (const part of parts) {
      if (part.filename && part.body?.attachmentId) {
        attachments.push({
          id: part.body.attachmentId,
          filename: part.filename,
          mimeType: part.mimeType,
          size: parseInt(part.body.size || '0'),
        })
      }
      if (part.parts) traverse(part.parts)
    }
  }

  if (payload.parts) traverse(payload.parts)
  return attachments
}

function gmailMessageToEmail(message: any): Email {
  const headers = message.payload?.headers || []
  const subject = getHeader(headers, 'Subject')
  const from = parseEmailAddress(getHeader(headers, 'From'))
  const toHeader = getHeader(headers, 'To')
  const dateStr = getHeader(headers, 'Date')
  const labelIds: string[] = message.labelIds || []
  const { bodyPlain } = extractBody(message.payload)
  const hasAttachments = !!(message.payload?.parts?.some((p: any) => p.filename) || message.payload?.body?.attachmentId)

  return {
    id: message.id,
    threadId: message.threadId,
    from,
    to: toHeader.split(',').map((t: string) => parseEmailAddress(t.trim())),
    subject: subject || '(no subject)',
    preview: (bodyPlain || '').slice(0, 120),
    date: new Date(dateStr),
    isRead: !labelIds.includes('UNREAD'),
    isStarred: labelIds.includes('STARRED'),
    labels: labelIds.filter((id: string) =>
      !['INBOX', 'UNREAD', 'CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL', 'CATEGORY_UPDATES', 'CATEGORY_FORUMS'].includes(id)
    ),
    hasAttachments,
  }
}

function gmailMessageToDetail(message: any): EmailDetail {
  const headers = message.payload?.headers || []
  const subject = getHeader(headers, 'Subject')
  const from = parseEmailAddress(getHeader(headers, 'From'))
  const toHeader = getHeader(headers, 'To')
  const dateStr = getHeader(headers, 'Date')
  const references = getHeader(headers, 'References')
  const inReplyTo = getHeader(headers, 'In-Reply-To')
  const labelIds: string[] = message.labelIds || []
  const { body, bodyPlain } = extractBody(message.payload)
  const attachments = extractAttachments(message.payload)
  const hasAttachments = attachments.length > 0 || !!(message.payload?.parts?.some((p: any) => p.filename) || message.payload?.body?.attachmentId)

  return {
    id: message.id,
    threadId: message.threadId,
    from,
    to: toHeader.split(',').map((t: string) => parseEmailAddress(t.trim())),
    subject: subject || '(no subject)',
    preview: (bodyPlain || '').slice(0, 120),
    date: new Date(dateStr),
    isRead: !labelIds.includes('UNREAD'),
    isStarred: labelIds.includes('STARRED'),
    labels: labelIds.filter((id: string) =>
      !['INBOX', 'UNREAD', 'CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL', 'CATEGORY_UPDATES', 'CATEGORY_FORUMS'].includes(id)
    ),
    hasAttachments,
    body,
    bodyPlain,
    attachments,
    headers: Object.fromEntries(headers.map((h: any) => [h.name, h.value])),
    references: references ? references.split(/\s+/).filter(Boolean) : undefined,
    inReplyTo,
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
  const [folders, setFolders] = useState<Folder[]>([
    { id: 'INBOX', name: 'Inbox', icon: 'inbox', unreadCount: 0 },
    { id: 'SENT', name: 'Sent', icon: 'send', unreadCount: 0 },
    { id: 'DRAFT', name: 'Drafts', icon: 'file', unreadCount: 0 },
    { id: 'TRASH', name: 'Trash', icon: 'trash', unreadCount: 0 },
  ])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Draft[]>([])

  const refreshEmails = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/gmail/messages?label=${currentFolder.id}&maxResults=25`)
      if (!res.ok) {
        throw new Error('Failed to fetch emails')
      }
      const data = await res.json()

      if (data.messages && data.messages.length > 0) {
        // Fetch full message data for each email
        const emailDetails = await Promise.all(
          data.messages.map((m: { id: string }) =>
            fetch(`/api/gmail/messages?id=${m.id}`).then(r => r.json())
          )
        )
        setEmails(emailDetails.map(gmailMessageToEmail))
      } else {
        setEmails([])
      }
    } catch (err: any) {
      console.error('Failed to refresh emails:', err)
      setError(err.message)
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
      if (!res.ok) throw new Error('Failed to load email')
      const message = await res.json()
      const detail = gmailMessageToDetail(message)

      // Mark as read if unread
      if (message.labelIds?.includes('UNREAD')) {
        fetch('/api/gmail/modify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId: id, removeLabels: ['UNREAD'] }),
        }).catch(console.error)
      }

      setSelectedEmail(detail)
    } catch (err: any) {
      console.error('Failed to load email:', err)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const saveDraft = useCallback((draft: Draft) => {
    setDrafts((prev) => {
      const existing = prev.findIndex((d) => d.id === draft.id)
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = { ...draft, id: draft.id || `draft_${Date.now()}` }
        return updated
      }
      return [...prev, { ...draft, id: `draft_${Date.now()}` }]
    })
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('mailie_drafts')
      const currentDrafts: Draft[] = stored ? JSON.parse(stored) : []
      const existing = currentDrafts.findIndex((d) => d.id === draft.id)
      if (existing >= 0) currentDrafts[existing] = draft
      else currentDrafts.push({ ...draft, id: `draft_${Date.now()}` })
      localStorage.setItem('mailie_drafts', JSON.stringify(currentDrafts))
    }
  }, [])

  const deleteDraft = useCallback((id: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id))
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('mailie_drafts')
      if (stored) {
        const currentDrafts: Draft[] = JSON.parse(stored)
        localStorage.setItem('mailie_drafts', JSON.stringify(currentDrafts.filter((d) => d.id !== id)))
      }
    }
  }, [])

  const updateDraft = useCallback((id: string, updates: Partial<Draft>) => {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...updates } : d)))
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
