'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useEmail } from '@/contexts/email-context'
import { Sidebar } from '@/components/sidebar'
import { MobileNav } from '@/components/mobile-nav'
import { EmailList } from '@/components/email-list'
import { MessageView } from '@/components/message-view'
import { MessageSheet } from '@/components/message-sheet'
import { Compose } from '@/components/compose'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

const DEFAULT_LIST_WIDTH = 320
const MIN_LIST_WIDTH = 200
const MAX_LIST_WIDTH = 600

export default function Home() {
  const { isAuthenticated, isLoading, login } = useAuth()
  const { selectedEmail } = useEmail()
  const [isComposeOpen, setIsComposeOpen] = useState(false)
  const [composeNonce, setComposeNonce] = useState(0)
  const [replyTo, setReplyTo] = useState<ComposeProps['replyTo'] | undefined>()
  const [listWidth, setListWidth] = useState(DEFAULT_LIST_WIDTH)
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)

  // Handle drag resize of the email list
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    isDragging.current = true
    dragStartX.current = e.clientX
    dragStartWidth.current = listWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [listWidth])

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!isDragging.current) return
      const delta = e.clientX - dragStartX.current
      const newWidth = Math.min(MAX_LIST_WIDTH, Math.max(MIN_LIST_WIDTH, dragStartWidth.current + delta))
      setListWidth(newWidth)
    }
    function handleMouseUp() {
      if (!isDragging.current) return
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  interface ComposeProps {
    replyTo?: {
      to: string
      subject: string
      body: string
      inReplyTo?: string
      references?: string
      threadId?: string
    }
  }

  const handleReply = useCallback(() => {
    if (!selectedEmail) return
    setReplyTo({
      to: selectedEmail.from.email,
      subject: selectedEmail.subject.startsWith('Re:')
        ? selectedEmail.subject
        : `Re: ${selectedEmail.subject}`,
      body: (() => {
        // Only quote the NEW content of this email (after the last --- Original Message --- separator)
        // bodyPlain contains the FULL email including any previously quoted content
        // We don't want to re-quote the entire thread, just this message's fresh content
        const parts = (selectedEmail.bodyPlain || selectedEmail.body || '').split(/--- Original Message ---\s*/i)
        const lastPart = parts[parts.length - 1].trim()
        return lastPart
      })(),
      inReplyTo: selectedEmail.inReplyTo || selectedEmail.headers?.['Message-ID'] || undefined,
      references: selectedEmail.references?.join(' ') || selectedEmail.headers?.['References'] || undefined,
      threadId: selectedEmail.threadId,
    })
    setComposeNonce((value) => value + 1)
    setIsComposeOpen(true)
  }, [selectedEmail])

  const handleForward = () => {
    setReplyTo(undefined)
    setComposeNonce((value) => value + 1)
    setIsComposeOpen(true)
  }

  const handleCompose = () => {
    setReplyTo(undefined)
    setComposeNonce((value) => value + 1)
    setIsComposeOpen(true)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center max-w-md px-6">
          {/* Logo */}
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 border-2 border-white rounded-sm mb-4">
              <span className="text-3xl font-bold text-white">m</span>
            </div>
            <h1 className="text-5xl font-mono font-bold mb-2 tracking-tight">
              <span className="text-white">mailie</span>
              <span className="text-muted-foreground">_</span>
            </h1>
            <p className="font-mono text-sm text-muted-foreground">
              Minimal brutalist email client
            </p>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-8">
            <div className="flex-1 h-px bg-border" />
            <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">connect</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Gmail connect */}
          <Button
            onClick={login}
            size="lg"
            className="font-mono text-sm w-full bg-white text-black hover:bg-gray-200 h-11"
          >
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Connect Gmail
          </Button>

          <div className="mt-6 space-y-1">
            <p className="font-mono text-[10px] text-muted-foreground">
              OAuth2 · no password stored · tokens encrypted
            </p>
            <p className="font-mono text-[10px] text-muted-foreground">
              Sign in with your Google account to continue
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:flex">
        <Sidebar onCompose={handleCompose} />
      </div>

      {/* Mobile: hamburger nav + email list side by side */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top bar for mobile */}
        <div className="flex items-center gap-2 p-3 border-b border-border md:hidden bg-surface">
          <MobileNav onCompose={handleCompose} />
          <span className="font-mono text-base font-bold tracking-tight">
            <span className="text-accent">mailie</span>
            <span className="text-muted-foreground">_</span>
          </span>
        </div>

        {/* Email list + message view stacked on mobile */}
        <div className="flex flex-1 min-h-0">
          {/* Email list — full width on mobile, resizable on desktop */}
          <div className="shrink-0" style={{ width: listWidth }}>
            <EmailList />
          </div>

          {/* Drag handle */}
          <div
            className="hidden md:block w-1 hover:bg-accent/50 cursor-col-resize transition-colors shrink-0"
            onMouseDown={handleDragStart}
          />

          {/* Message view — desktop only (mobile uses MessageSheet) */}
          <div className="hidden md:flex flex-1 min-w-0">
            <MessageView onReply={handleReply} onForward={handleForward} />
          </div>
        </div>
      </div>

      {/* Mobile: message opens as full-screen sheet */}
      <MessageSheet onReply={handleReply} onForward={handleForward} />

      {/* Compose Dialog */}
      <Compose
        key={`${composeNonce}-${replyTo?.subject ?? 'new'}`}
        isOpen={isComposeOpen}
        onClose={() => {
          setIsComposeOpen(false)
          setReplyTo(undefined)
        }}
        replyTo={replyTo}
      />
    </div>
  )
}
