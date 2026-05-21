'use client'

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'
import type { EmailDetail } from '@/types/email'
import { useAuth } from './auth-context'
import { toast } from 'sonner'

interface ReplyTo {
  to: string
  subject: string
  body: string
  inReplyTo?: string
  references?: string
  threadId?: string
}

interface ComposeContextValue {
  isComposeOpen: boolean
  setIsComposeOpen: (open: boolean) => void
  replyTo: ReplyTo | undefined
  setReplyTo: (reply: ReplyTo | undefined) => void
  composeNonce: number
  setComposeNonce: (nonce: number | ((prev: number) => number)) => void
  handleCompose: () => void
  handleReply: (email: EmailDetail) => void
  handleForward: () => void
}

const ComposeContext = createContext<ComposeContextValue | null>(null)

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function stripUnsafeReplyHtml(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\s+href\s*=\s*(['"])\s*javascript:[\s\S]*?\1/gi, '')
}

function stripQuotedPlainText(value: string): string {
  return value
    .split(/\n\s*-{2,}\s*Original Message\s*-{2,}/i)[0]
    .split(/\n\s*On .+ wrote:\s*$/im)[0]
    .split(/\n\s*>/)[0]
    .trim()
}

function stripQuotedHtml(html: string): string {
  const document = new DOMParser().parseFromString(html, 'text/html')
  document.querySelectorAll('blockquote, .gmail_quote, [data-mailie-reply-quote], [data-mailie-reply-header]').forEach((node) => node.remove())

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  let current = walker.nextNode()
  while (current) {
    nodes.push(current as Text)
    current = walker.nextNode()
  }

  for (const node of nodes) {
    const text = node.nodeValue ?? ''
    const originalIndex = text.search(/-{2,}\s*Original Message\s*-{2,}/i)
    const wroteIndex = text.search(/\bOn .+ wrote:/i)
    const cutIndex = [originalIndex, wroteIndex].filter((index) => index >= 0).sort((a, b) => a - b)[0]
    if (cutIndex === undefined) continue

    node.nodeValue = text.slice(0, cutIndex).trim()
    let sibling = node.parentElement?.nextSibling
    while (sibling) {
      const next = sibling.nextSibling
      sibling.parentNode?.removeChild(sibling)
      sibling = next
    }
  }

  return document.body.innerHTML.trim()
}

function formatReplyQuote(email: EmailDetail): string {
  const sender = email.from.name
    ? `${escapeHtml(email.from.name)} &lt;${escapeHtml(email.from.email)}&gt;`
    : escapeHtml(email.from.email)
  const date = email.date instanceof Date ? email.date : new Date(email.date)
  const dateLabel = Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  const htmlBody = email.body ? stripQuotedHtml(stripUnsafeReplyHtml(email.body)) : ''
  const plainBody = stripQuotedPlainText(email.bodyPlain || '')
  const originalBody = htmlBody || escapeHtml(plainBody).replace(/\n/g, '<br>')

  return [
    '<p><br></p>',
    '<div data-mailie-reply-header="true" style="margin-top:16px;margin-bottom:8px;color:#666;font-size:12px;">',
    `On ${escapeHtml(dateLabel)}, ${sender} wrote:`,
    '</div>',
    '<blockquote data-mailie-reply-quote="true" style="margin:0 0 0 8px;padding-left:12px;border-left:2px solid #d0d7de;color:#555;">',
    originalBody || '<p></p>',
    '</blockquote>',
  ].join('')
}

function getEmailHeader(headers: Record<string, string> | undefined, name: string): string | undefined {
  if (!headers) return undefined
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase())
  return entry?.[1]
}

function uniqueMessageIds(value: string): string {
  return [...new Set(value.split(/\s+/).map((item) => item.trim()).filter(Boolean))].join(' ')
}

export function ComposeProvider({ children }: { children: ReactNode }) {
  const { provider, account } = useAuth()
  const [isComposeOpen, setIsComposeOpen] = useState(false)
  const [replyTo, setReplyTo] = useState<ReplyTo | undefined>()
  const [composeNonce, setComposeNonce] = useState(0)

  const handleCompose = useCallback(() => {
    if (provider === 'smtp_imap' && !account?.capabilities.smtp) {
      toast.error('SMTP is not configured for this account')
      return
    }
    setReplyTo(undefined)
    setComposeNonce((n) => n + 1)
    setIsComposeOpen(true)
  }, [provider, account?.capabilities.smtp])

  const handleReply = useCallback((email: EmailDetail) => {
    if (provider === 'smtp_imap' && !account?.capabilities.smtp) {
      toast.error('SMTP is not configured for this account')
      return
    }
    const originalMessageId = getEmailHeader(email.headers, 'Message-ID')
    const previousReferences = email.references?.join(' ') || getEmailHeader(email.headers, 'References') || ''
    const references = uniqueMessageIds([previousReferences, originalMessageId].filter(Boolean).join(' '))

    setReplyTo({
      to: email.from.email,
      subject: email.subject.startsWith('Re:')
        ? email.subject
        : `Re: ${email.subject}`,
      body: formatReplyQuote(email),
      inReplyTo: originalMessageId || email.inReplyTo || undefined,
      references: references || undefined,
      threadId: email.threadId,
    })
    setComposeNonce((n) => n + 1)
    setIsComposeOpen(true)
  }, [provider, account?.capabilities.smtp])

  const handleForward = useCallback(() => {
    if (provider === 'smtp_imap' && !account?.capabilities.smtp) {
      toast.error('SMTP is not configured for this account')
      return
    }
    setReplyTo(undefined)
    setComposeNonce((n) => n + 1)
    setIsComposeOpen(true)
  }, [provider, account?.capabilities.smtp])

  return (
    <ComposeContext.Provider
      value={{
        isComposeOpen,
        setIsComposeOpen,
        replyTo,
        setReplyTo,
        composeNonce,
        setComposeNonce,
        handleCompose,
        handleReply,
        handleForward,
      }}
    >
      {children}
    </ComposeContext.Provider>
  )
}

export function useCompose(): ComposeContextValue {
  const ctx = useContext(ComposeContext)
  if (!ctx) throw new Error('useCompose must be used within <ComposeProvider>')
  return ctx
}
