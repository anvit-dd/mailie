'use client'

import { useEmail } from '@/contexts/email-context'
import { MessageHeader } from './message-header'
import { MessageBody } from './message-body'
import type { EmailDetail } from '@/types/email'

interface MessageViewProps {
  onReply: (email: EmailDetail) => void
  onForward: () => void
}

export function MessageView({ onReply, onForward }: MessageViewProps) {
  const { selectedEmail } = useEmail()

  if (!selectedEmail) {
    return (
      <div className="flex items-center justify-center h-full bg-[var(--editor-bg)]">
        <div className="text-center">
          <div className="font-mono text-4xl text-[var(--muted-foreground)] mb-4 select-none opacity-40">
            {'<'}{'-'}
          </div>
          <p className="font-mono text-[13px] text-[var(--muted-foreground)]">
            Select an email to read
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full w-full min-w-0 flex-1 bg-[var(--editor-bg)]">
      <MessageHeader onReply={() => selectedEmail && onReply(selectedEmail)} onForward={onForward} />
      <MessageBody />
    </div>
  )
}
