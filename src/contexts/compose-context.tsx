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
    setReplyTo({
      to: email.from.email,
      subject: email.subject.startsWith('Re:')
        ? email.subject
        : `Re: ${email.subject}`,
      body: '', // empty — no auto-quote, threading via headers only
      inReplyTo: email.inReplyTo || email.headers?.['Message-ID'] || undefined,
      references:
        email.references?.join(' ') ||
        email.headers?.['References'] ||
        undefined,
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
