'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useEmail } from '@/contexts/email-context'
import { toast } from 'sonner'
import {
  X,
  Send,
  Paperclip,
  File,
  Loader2,
} from 'lucide-react'
import type { Draft } from '@/types/email'

interface ComposeProps {
  isOpen: boolean
  onClose: () => void
  replyTo?: {
    to: string
    subject: string
    body: string
    inReplyTo?: string
    references?: string
  }
}

export function Compose({ isOpen, onClose, replyTo }: ComposeProps) {
  const { saveDraft } = useEmail()

  const [to, setTo] = useState<string[]>(() => (replyTo?.to ? [replyTo.to] : []))
  const [toInput, setToInput] = useState('')
  const [subject, setSubject] = useState(
    replyTo?.subject ? (replyTo.subject.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject}`) : ''
  )
  const [body, setBody] = useState(replyTo?.body ? `\n\n--- Original Message ---\n${replyTo.body}\n\n` : '')
  const [attachments, setAttachments] = useState<File[]>([])
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  // Auto-save draft every 30 seconds
  useEffect(() => {
    if (!isOpen || (!to.length && !subject && !body)) return

    const interval = setInterval(() => {
      const draft: Draft = {
        to,
        subject,
        body,
      }
      saveDraft(draft)
      setLastSaved(new Date())
    }, 30000)

    return () => clearInterval(interval)
  }, [isOpen, to, subject, body, saveDraft])

  const addToRecipient = useCallback(() => {
    const email = toInput.trim()
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (!to.includes(email)) {
        setTo([...to, email])
      }
      setToInput('')
    }
  }, [toInput, to])

  const removeToRecipient = useCallback((email: string) => {
    setTo(to.filter((t) => t !== email))
  }, [to])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        addToRecipient()
      }
    },
    [addToRecipient]
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files) {
        setAttachments([...attachments, ...Array.from(files)])
      }
      e.target.value = ''
    },
    [attachments]
  )

  const removeAttachment = useCallback(
    (index: number) => {
      setAttachments(attachments.filter((_, i) => i !== index))
    },
    [attachments]
  )

  const handleSend = useCallback(async () => {
    // Validate
    if (to.length === 0) {
      setSendError('Please add at least one recipient')
      return
    }

    if (!subject.trim()) {
      setSendError('Please add a subject')
      return
    }

    setIsSending(true)
    setSendError(null)

    const loadingToast = toast.loading('Sending email...')

    try {
      const res = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, body: body }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to send email')
      }

      onClose()
      toast.success('Email sent', { description: `To: ${to.join(', ')}` })

      // Reset form
      setTo([])
      setSubject('')
      setBody('')
      setAttachments([])
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to send email'
      console.error('Send error:', error)
      toast.error('Failed to send', { description: message })
      setSendError(message)
    } finally {
      toast.dismiss(loadingToast)
      setIsSending(false)
    }
  }, [to, subject, body, onClose])

  const handleSaveDraft = useCallback(() => {
    const draft: Draft = {
      to,
      subject,
      body,
    }
    saveDraft(draft)
    setLastSaved(new Date())
  }, [to, subject, body, saveDraft])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl h-[80vh] bg-background border border-border rounded-sm flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
          <h2 className="font-mono text-sm font-semibold">
            {replyTo ? 'Reply' : 'New Message'}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Recipients */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
          <span className="font-mono text-sm text-muted-foreground w-10">To:</span>
          <div className="flex-1 flex flex-wrap gap-1">
            {to.map((email) => (
              <Badge
                key={email}
                variant="secondary"
                className="font-mono text-xs gap-1 pr-1"
              >
                {email}
                <button
                  onClick={() => removeToRecipient(email)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
            <input
              type="email"
              value={toInput}
              onChange={(e) => setToInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={addToRecipient}
              placeholder={to.length === 0 ? ' recipient@example.com' : ''}
              className="flex-1 min-w-[200px] bg-transparent border-none outline-none font-mono text-sm placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Subject */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
          <span className="font-mono text-sm text-muted-foreground w-10">Sub:</span>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="flex-1 bg-transparent border-none outline-none font-mono text-sm placeholder:text-muted-foreground"
          />
        </div>

        {/* Body */}
        <div className="flex-1 p-4 overflow-hidden">
          <ScrollArea className="h-full">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message..."
              className="h-full min-h-[200px] font-mono text-sm resize-none bg-transparent border-none"
            />
          </ScrollArea>
        </div>

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="px-4 py-2 border-t border-border">
            <div className="flex flex-wrap gap-2">
              {attachments.map((file, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="font-mono text-xs gap-1"
                >
                  <Paperclip className="w-3 h-3" />
                  {file.name}
                  <button
                    onClick={() => removeAttachment(index)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {sendError && (
          <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20">
            <p className="font-mono text-xs text-destructive">{sendError}</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-surface">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => document.getElementById('attachment-input')?.click()}
            >
              <Paperclip className="w-4 h-4" />
              <input
                id="attachment-input"
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSaveDraft}
              className="font-mono text-xs h-8"
            >
              Save draft
            </Button>
            {lastSaved && (
              <span className="font-mono text-[10px] text-muted-foreground">
                Saved {lastSaved.toLocaleTimeString()}
              </span>
            )}
          </div>
          <Button
            onClick={handleSend}
            disabled={isSending}
            className="font-mono text-xs bg-accent text-background hover:bg-accent/90"
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
