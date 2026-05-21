'use client'

import { useEffect, useMemo, useState } from 'react'
import { useEmail } from '@/contexts/email-context'
import { useAuth } from '@/contexts/auth-context'
import { MessageHeader } from './message-header'
import { MessageBody } from './message-body'
import { Button } from '@/components/ui/button'
import { Reply, ArrowRight } from 'lucide-react'
import type { EmailDetail } from '@/types/email'

interface MessageViewProps {
  onReply: (email: EmailDetail) => void
  onForward: () => void
}

export function MessageView({ onReply, onForward }: MessageViewProps) {
  const { selectedEmail } = useEmail()
  const { provider } = useAuth()
  const [threadMessages, setThreadMessages] = useState<EmailDetail[]>([])
  const [isThreadLoading, setIsThreadLoading] = useState(false)

  useEffect(() => {
    if (!selectedEmail) {
      return
    }

    const controller = new AbortController()
    const email = selectedEmail

    async function fetchThread() {
      setIsThreadLoading(true)
      try {
        const url = provider === 'gmail'
          ? `/api/gmail/thread?threadId=${encodeURIComponent(email.threadId || email.id)}`
          : `/api/imap/thread?messageId=${encodeURIComponent(email.id)}`
        const res = await fetch(url, { credentials: 'include', signal: controller.signal })
        if (!res.ok) throw new Error('Failed to load thread')
        const data = await res.json() as { messages?: EmailDetail[] }
        setThreadMessages(Array.isArray(data.messages) ? data.messages : [])
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        setThreadMessages([email])
      } finally {
        if (!controller.signal.aborted) setIsThreadLoading(false)
      }
    }

    void fetchThread()

    return () => controller.abort()
  }, [selectedEmail, provider])

  const messages = useMemo(() => {
    const source = threadMessages.length ? threadMessages : selectedEmail ? [selectedEmail] : []
    return [...source].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [threadMessages, selectedEmail])

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
      {isThreadLoading && (
        <div className="px-4 py-2 border-b border-[var(--border)] bg-[var(--card)]">
          <p className="font-mono text-[11px] text-[var(--muted-foreground)]">Loading conversation...</p>
        </div>
      )}
      {messages.length <= 1 ? (
        <MessageBody />
      ) : (
      <div className="flex-1 min-h-0 overflow-y-auto bg-[var(--editor-bg)]">
        <div className="mx-auto w-full max-w-[1100px] space-y-3 p-3 sm:p-4">
          {messages.map((message) => (
            <article
              key={message.id}
              className="overflow-hidden border border-[var(--border)] bg-[var(--card)] shadow-sm"
            >
              <div className="flex items-start gap-3 border-b border-[var(--border)] px-3 py-3 sm:px-4">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/15">
                  <span className="font-mono text-[12px] font-semibold text-[var(--accent)]">
                    {(message.from.name || message.from.email).charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="font-mono text-[13px] font-semibold text-[var(--foreground)]">
                      {message.from.name || message.from.email}
                    </span>
                    <span className="min-w-0 truncate font-mono text-[11px] text-[var(--muted-foreground)]">
                      &lt;{message.from.email}&gt;
                    </span>
                    <span className="ml-auto shrink-0 font-mono text-[11px] text-[var(--muted-foreground)]">
                      {new Date(message.date).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-[var(--muted-foreground)]">
                    To: {message.to.map((item) => item.name || item.email).join(', ') || 'me'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-[var(--muted-foreground)]"
                    onClick={() => onReply(message)}
                    title="Reply"
                  >
                    <Reply className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-[var(--muted-foreground)]"
                    onClick={onForward}
                    title="Forward"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="h-[min(70vh,720px)] min-h-[260px] bg-white">
                <MessageBody email={message} noPadding />
              </div>
            </article>
          ))}
        </div>
      </div>
      )}
    </div>
  )
}
