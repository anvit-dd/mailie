'use client'

import { useEffect } from 'react'
import { useEmail } from '@/contexts/email-context'
import { EmailList } from './email-list'
import { MessageBody } from './message-body'
import { Button } from '@/components/ui/button'
import type { EmailDetail } from '@/types/email'
import {
  ChevronLeft,
  Reply,
  ArrowRight,
  Trash2,
  Star,
  Paperclip,
} from 'lucide-react'

interface MobileEmailViewProps {
  onReply: (email: EmailDetail) => void
  onForward: () => void
}

export function MobileEmailView({ onReply, onForward }: MobileEmailViewProps) {
  const { selectedEmail, setSelectedEmail, loadEmailDetail, toggleStar } = useEmail()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const emailId = params.get('email')
    if (emailId) {
      loadEmailDetail(emailId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (selectedEmail) {
      const url = new URL(window.location.href)
      url.searchParams.set('email', selectedEmail.id)
      window.history.pushState({ emailId: selectedEmail.id }, '', url.toString())
    }
  }, [selectedEmail?.id])

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search)
      if (!params.get('email')) {
        setSelectedEmail(null)
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [setSelectedEmail])

  if (!selectedEmail) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <EmailList />
      </div>
    )
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  const handleBack = () => {
    setSelectedEmail(null)
    const url = new URL(window.location.href)
    url.searchParams.delete('email')
    window.history.pushState({}, '', url.toString())
  }

  const downloadFirstAttachment = () => {
    const att = selectedEmail.attachments?.[0]
    if (att) {
      const url = `/api/gmail/attachment?messageId=${encodeURIComponent(selectedEmail.id)}&attachmentId=${encodeURIComponent(att.id)}&filename=${encodeURIComponent(att.filename)}`
      const link = document.createElement('a')
      link.href = url
      link.download = att.filename
      link.rel = 'noopener'
      document.body.appendChild(link)
      link.click()
      link.remove()
    }
  }

  return (
    /* Editor canvas bg for email body, card bg for chrome */
    <div className="flex flex-col flex-1 min-h-0 bg-[var(--editor-bg)]">

      {/* ── Top bar ── deep chrome */}
      <div className="flex items-center gap-1.5 px-2 py-2 border-b border-[var(--border)] bg-[var(--card)] shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          onClick={handleBack}
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>

        <span className="font-mono text-[13px] font-semibold text-[var(--foreground)] truncate flex-1 min-w-0">
          {selectedEmail.subject || 'Email'}
        </span>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          onClick={() => selectedEmail && onReply(selectedEmail)}
        >
          <Reply className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          onClick={onForward}
        >
          <ArrowRight className="w-4 h-4" />
        </Button>
        {selectedEmail.hasAttachments && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            onClick={downloadFirstAttachment}
          >
            <Paperclip className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* ── Sender row ── surface bg */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--border)] bg-[var(--card)]">
        <div className="w-7 h-7 rounded-full bg-[var(--accent)]/15 flex items-center justify-center shrink-0">
          <span className="font-mono text-[11px] text-[var(--accent)] font-semibold">
            {(selectedEmail.from.name || selectedEmail.from.email).charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[12px] font-semibold text-[var(--foreground)] truncate">
            {selectedEmail.from.name || selectedEmail.from.email}
          </p>
          <p className="font-mono text-[11px] text-[var(--muted-foreground)]">
            to me · {formatTime(selectedEmail.date)}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          onClick={() => selectedEmail && toggleStar(selectedEmail.id, selectedEmail.isStarred)}
        >
          <Star className={`w-3.5 h-3.5 ${selectedEmail?.isStarred ? 'fill-[var(--accent)] text-[var(--accent)]' : ''}`} />
        </Button>
      </div>

      {/* ── Email body ── editor canvas */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <MessageBody noPadding />
      </div>
    </div>
  )
}
