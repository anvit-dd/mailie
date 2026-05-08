'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useEmail } from '@/contexts/email-context'
import { useCompose } from '@/contexts/compose-context'
import { Sidebar } from '@/components/sidebar'
import { MobileNav } from '@/components/mobile-nav'
import { EmailList } from '@/components/email-list'
import { MessageView } from '@/components/message-view'
import { MobileEmailView } from '@/components/mobile-email-view'
import { SettingsDialog } from '@/components/settings-dialog'
import { ComposePanel } from '@/components/compose-panel'
import { Button } from '@/components/ui/button'
import { Loader2, PenSquare } from 'lucide-react'

const DEFAULT_LIST_WIDTH = 320
const MIN_LIST_WIDTH = 200
const MAX_LIST_WIDTH = 600

export default function Home() {
  const { isAuthenticated, isLoading, login } = useAuth()
  const { selectedEmail } = useEmail()
  const { handleReply, handleForward, handleCompose } = useCompose()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--background)]">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--muted-foreground)]" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--background)]">
        <div className="text-center max-w-md px-6">
          {/* Logo */}
          <div className="mb-8">
            {/* Zed-style logo mark */}
            <div className="inline-flex items-center justify-center w-14 h-14 border border-[var(--border)] mb-4">
              <span className="font-mono text-2xl font-bold text-[#8B5CF6]">m</span>
            </div>
            <h1 className="text-4xl font-mono font-bold mb-2 tracking-tight text-[var(--foreground)]">
              mailie<span className="text-[var(--muted-foreground)]">_</span>
            </h1>
            <p className="font-mono text-[13px] text-[var(--muted-foreground)]">
              Minimal email client
            </p>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-8">
            <div className="flex-1 h-px bg-[var(--border)]" />
            <span className="font-mono text-[11px] text-[var(--muted-foreground)] uppercase tracking-widest">connect</span>
            <div className="flex-1 h-px bg-[var(--border)]" />
          </div>

          {/* Gmail connect */}
          <Button
            onClick={login}
            size="lg"
            className="font-mono text-[13px] w-full bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 h-10"
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
            <p className="font-mono text-[10px] text-[var(--muted-foreground)]">
              OAuth2 · no password stored · tokens encrypted
            </p>
            <p className="font-mono text-[10px] text-[var(--muted-foreground)]">
              Sign in with your Google account to continue
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar onSettingsOpen={() => setIsSettingsOpen(true)} />
      </div>

      {/* Desktop: email list + message view */}
      <div className="hidden md:flex flex-1 min-w-0">
        <div className="shrink-0 min-w-0" style={{ width: listWidth }}>
          <EmailList />
        </div>
        <div
          className="w-1 hover:bg-[var(--accent)]/40 cursor-col-resize transition-colors shrink-0"
          onMouseDown={handleDragStart}
        />
        <div className="flex-1 min-w-0">
          <MessageView onReply={handleReply} onForward={handleForward} />
        </div>
      </div>

      {/* Mobile: full-screen email list OR full-screen email */}
      <div className="flex flex-col flex-1 min-w-0 md:hidden">
        {/* Mobile top bar */}
        <div className="flex items-center gap-2 p-3 border-b border-[var(--border)] bg-[var(--card)] shrink-0">
          <MobileNav onCompose={handleCompose} onSettingsOpen={() => setIsSettingsOpen(true)} />
          <span className="font-mono text-sm font-bold tracking-tight text-[var(--foreground)]">
            mailie<span className="text-[var(--muted-foreground)]">_</span>
          </span>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-[var(--foreground)] hover:bg-[var(--surface-elevated)]"
            onClick={handleCompose}
            aria-label="Compose new email"
          >
            <PenSquare className="w-4 h-4" />
          </Button>
        </div>

        {/* Mobile email list + full-screen email */}
        <MobileEmailView onReply={handleReply} onForward={handleForward} />
      </div>

      {/* Settings Dialog */}
      <SettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
      />

      {/* Floating compose panel (portal'd to body) — persists across route changes */}
      <ComposePanel />
    </div>
  )
}
