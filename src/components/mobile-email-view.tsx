'use client'

import { useEmail } from '@/contexts/email-context'
import { EmailList } from './email-list'
import { MessageHeader } from './message-header'
import { MessageBody } from './message-body'
import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'

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

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-background">
      {/* Mobile top bar — back button + subject on same line */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => setSelectedEmail(null)}
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <span className="font-mono text-sm truncate flex-1">
          {selectedEmail.subject || 'Email'}
        </span>
      </div>

      {/* Email header — no subject (already in top bar) */}
      <MessageHeader onReply={onReply} onForward={onForward} hideSubject />

      {/* Email body — fills remaining space */}
      <div className="flex-1 min-h-0">
        <MessageBody />
      </div>
    </div>
  )
}
