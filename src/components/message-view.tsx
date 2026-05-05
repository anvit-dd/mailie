'use client'

import { useEmail } from '@/contexts/email-context'
import { MessageHeader } from './message-header'
import { MessageBody } from './message-body'
import { RefreshCw } from 'lucide-react'

interface MessageViewProps {
  onReply: () => void
  onForward: () => void
}

export function MessageView({ onReply, onForward }: MessageViewProps) {
  const { selectedEmail } = useEmail()

  if (!selectedEmail) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="font-mono text-5xl text-muted-foreground mb-4 select-none">
            {'<'}{'-'}
          </div>
          <p className="font-mono text-sm text-muted-foreground">
            Select an email to read
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full w-full min-w-0 flex-1">
      <MessageHeader onReply={onReply} onForward={onForward} />
      <MessageBody />
    </div>
  )
}
