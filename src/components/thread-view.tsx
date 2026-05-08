'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { MessageBody } from './message-body'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, X, Mail, Paperclip } from 'lucide-react'
import type { EmailDetail } from '@/lib/mail-provider'

interface ThreadViewProps {
  threadId: string
  subject: string
  onBack: () => void
  onReply: (message: EmailDetail) => void
  onForward: (message: EmailDetail) => void
}

function formatDate(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  } else if (days === 1) {
    return 'Yesterday'
  } else if (days < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' })
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: days > 365 ? 'numeric' : undefined })
  }
}

export function ThreadView({ threadId, subject, onBack, onReply, onForward }: ThreadViewProps) {
  const { provider } = useAuth()
  const [messages, setMessages] = useState<EmailDetail[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    async function fetchThread() {
      setIsLoading(true)
      setError(null)
      try {
        let url: string
        if (provider === 'gmail') {
          url = `/api/gmail/thread?threadId=${encodeURIComponent(threadId)}`
        } else {
          // IMAP — group by references for now, fetch first message's thread
          const firstMsg = messages[0]
          if (!firstMsg) {
            setMessages([])
            return
          }
          url = `/api/imap/thread?messageId=${encodeURIComponent(firstMsg.id)}&folder=INBOX`
        }

        const res = await fetch(url, { credentials: 'include' })
        if (!res.ok) throw new Error('Failed to load thread')
        const data = await res.json() as { messages: EmailDetail[] }
        setMessages(data.messages)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setIsLoading(false)
      }
    }

    void fetchThread()
  }, [threadId, provider])

  const currentMessage = messages[currentIndex]

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-[var(--background)]">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--card)]">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-7 w-7">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <Skeleton className="h-4 w-48 mb-1" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="flex-1 p-6 space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-2 p-4 border border-[var(--border)] rounded-sm">
              <div className="flex items-center gap-3">
                <Skeleton className="w-8 h-8 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-3 w-32 mb-1" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col h-full bg-[var(--background)]">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--card)]">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-7 w-7">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="font-mono text-[13px] text-[var(--destructive)]">{error}</span>
        </div>
      </div>
    )
  }

  if (!messages.length) {
    return (
      <div className="flex flex-col h-full bg-[var(--background)]">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--card)]">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-7 w-7">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="font-mono text-[13px] text-[var(--muted-foreground)]">No messages in thread</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[var(--background)]">
      {/* Thread header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--card)] shrink-0">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-7 w-7 shrink-0">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[13px] font-semibold text-[var(--foreground)] truncate">
            {subject || '(no subject)'}
          </p>
          <p className="font-mono text-[11px] text-[var(--muted-foreground)]">
            {messages.length} message{messages.length !== 1 ? 's' : ''} in thread
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed((c) => !c)}
          className="h-7 w-7 shrink-0"
          title={collapsed ? 'Expand all' : 'Collapse all'}
        >
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </Button>
      </div>

      {/* Thread messages */}
      <div className="flex-1 overflow-y-auto">
        {collapsed ? (
          // Collapsed overview
          <div className="p-4 space-y-2">
            {messages.map((msg, idx) => (
              <div
                key={msg.id}
                className="flex items-center gap-3 px-3 py-2 rounded-sm border border-[var(--border)] bg-[var(--card)] cursor-pointer hover:bg-[var(--surface-deep)] transition-colors"
                onClick={() => { setCurrentIndex(idx); setCollapsed(false) }}
              >
                <div className="w-6 h-6 rounded-full bg-[var(--accent)]/15 flex items-center justify-center shrink-0">
                  <span className="font-mono text-[11px] text-[var(--accent)] font-semibold">
                    {(msg.from.name || msg.from.email).charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-[12px] text-[var(--foreground)] truncate">
                    {msg.from.name || msg.from.email}
                  </p>
                  <p className="font-mono text-[11px] text-[var(--muted-foreground)] truncate">
                    {msg.subject}
                  </p>
                </div>
                <span className="font-mono text-[10px] text-[var(--muted-foreground)] shrink-0">
                  {formatDate(msg.date)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          // Expanded — show messages individually with navigation
          <div className="relative">
            {/* Message navigation */}
            {messages.length > 1 && (
              <div className="sticky top-0 z-10 flex items-center justify-center gap-4 px-4 py-2 bg-[var(--surface-deep)] border-b border-[var(--border)]">
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                  className="h-7 w-7"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                  {currentIndex + 1} / {messages.length}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={currentIndex === messages.length - 1}
                  onClick={() => setCurrentIndex((i) => Math.min(messages.length - 1, i + 1))}
                  className="h-7 w-7"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}

            {currentMessage && (
              <div className="p-4 space-y-4">
                {/* Message card */}
                <div className="border border-[var(--border)] rounded-sm bg-[var(--card)] overflow-hidden">
                  {/* Message header */}
                  <div className="flex items-start gap-3 px-4 py-3 border-b border-[var(--border)]">
                    <div className="w-8 h-8 rounded-full bg-[var(--accent)]/15 flex items-center justify-center shrink-0">
                      <span className="font-mono text-[13px] text-[var(--accent)] font-semibold">
                        {(currentMessage.from.name || currentMessage.from.email).charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[13px] font-semibold text-[var(--foreground)]">
                          {currentMessage.from.name || currentMessage.from.email}
                        </span>
                        {currentMessage.from.name && (
                          <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                            &lt;{currentMessage.from.email}&gt;
                          </span>
                        )}
                        <span className="font-mono text-[10px] text-[var(--muted-foreground)] ml-auto">
                          {formatDate(currentMessage.date)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                          To: {currentMessage.to.map((t) => t.name || t.email).join(', ')}
                        </span>
                      </div>
                      {currentMessage.attachments.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <Paperclip className="w-3 h-3 text-[var(--muted-foreground)]" />
                          <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
                            {currentMessage.attachments.length} attachment{currentMessage.attachments.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Message body */}
                  <div className="px-4 py-3">
                    <div
                      className="prose prose-sm max-w-none text-[var(--foreground)]"
                      dangerouslySetInnerHTML={{
                        __html: currentMessage.body || currentMessage.bodyPlain.replace(/\n/g, '<br>')
                      }}
                    />
                  </div>

                  {/* Attachments */}
                  {currentMessage.attachments.length > 0 && (
                    <div className="px-4 py-3 border-t border-[var(--border)]">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-2">
                        Attachments
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {currentMessage.attachments.map((att) => (
                          <a
                            key={att.id}
                            href={`/api/gmail/attachment?messageId=${currentMessage.id}&attachmentId=${att.id}`}
                            download={att.filename}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-sm border border-[var(--border)] bg-[var(--surface-deep)] hover:bg-[var(--surface-elevated)] transition-colors font-mono text-[11px] text-[var(--foreground)]"
                          >
                            <Paperclip className="w-3 h-3" />
                            <span className="truncate max-w-[150px]">{att.filename}</span>
                            <span className="text-[var(--muted-foreground)] text-[10px]">
                              ({att.size > 1024 ? `${Math.round(att.size / 1024)}KB` : `${att.size}B`})
                            </span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Reply/Forward actions */}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onReply(currentMessage)}
                    className="font-mono text-[12px] h-8 border-[var(--border)]"
                  >
                    Reply
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onForward(currentMessage)}
                    className="font-mono text-[12px] h-8 border-[var(--border)]"
                  >
                    Forward
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}