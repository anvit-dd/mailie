'use client'

import { useEmail } from '@/contexts/email-context'
import { EmailList } from './email-list'
import { MessageBody } from './message-body'
import { Button } from '@/components/ui/button'
import { ChevronLeft, Reply, ArrowRight, Trash2, Star } from 'lucide-react'

interface MobileEmailViewProps {
  onReply: () => void
  onForward: () => void
}

export function MobileEmailView({ onReply, onForward }: MobileEmailViewProps) {
  const { selectedEmail, setSelectedEmail } = useEmail()

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

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-background">
      {/* ── Top bar ─────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-2 py-2 border-b border-border bg-surface shrink-0">
        {/* Back */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => setSelectedEmail(null)}
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>

        {/* Subject — fills middle */}
        <span className="font-mono text-sm font-semibold truncate flex-1 min-w-0">
          {selectedEmail.subject || 'Email'}
        </span>

        {/* Quick actions — reply / forward as icons */}
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onReply}>
          <Reply className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onForward}>
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>

      {/* ── Sender row ──────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-border bg-surface">
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
          <span className="font-mono text-xs text-accent font-semibold">
            {(selectedEmail.from.name || selectedEmail.from.email).charAt(0).toUpperCase()}
          </span>
        </div>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <p className="font-mono text-xs font-semibold truncate">
            {selectedEmail.from.name || selectedEmail.from.email}
          </p>
          <p className="font-mono text-[10px] text-muted-foreground">
            to me · {formatTime(selectedEmail.date)}
          </p>
        </div>

        {/* More actions */}
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
          <Star className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* ── Email body ──────────────────────────────────── */}
      <div className="flex-1 min-h-0">
        <MessageBody noPadding />
      </div>
    </div>
  )
}
