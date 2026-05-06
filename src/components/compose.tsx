'use client'

import { useEffect, useState, type ChangeEvent, type Dispatch, type KeyboardEvent, type SetStateAction } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useEmail } from '@/contexts/email-context'
import { toast } from 'sonner'
import { X, Send, Paperclip, Loader2 } from 'lucide-react'
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
    threadId?: string
  }
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function toBase64(arrayBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arrayBuffer)
  let binary = ''
  const chunkSize = 0x8000

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }

  return btoa(binary)
}

async function serializeAttachments(files: File[]) {
  return Promise.all(
    files.map(async (file) => ({
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      data: toBase64(await file.arrayBuffer()),
    }))
  )
}

export function Compose({ isOpen, onClose, replyTo }: ComposeProps) {
  const { saveDraft } = useEmail()

  const [to, setTo] = useState<string[]>(() => (replyTo?.to ? [replyTo.to] : []))
  const [toInput, setToInput] = useState('')
  const [cc, setCc] = useState<string[]>([])
  const [ccInput, setCcInput] = useState('')
  const [bcc, setBcc] = useState<string[]>([])
  const [bccInput, setBccInput] = useState('')
  const [showCc, setShowCc] = useState(false)
  const [showBcc, setShowBcc] = useState(false)
  const [subject, setSubject] = useState(
    replyTo?.subject ? (replyTo.subject.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject}`) : ''
  )
  const [body, setBody] = useState(replyTo?.body ?? '')
  const [attachments, setAttachments] = useState<File[]>([])
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  useEffect(() => {
    if (!isOpen || (!to.length && !cc.length && !bcc.length && !subject && !body)) return

    const interval = setInterval(() => {
      const draft: Draft = {
        to,
        cc,
        bcc,
        subject,
        body,
      }
      saveDraft(draft)
      setLastSaved(new Date())
    }, 30000)

    return () => clearInterval(interval)
  }, [isOpen, to, cc, bcc, subject, body, saveDraft])

  const addRecipient = (
    value: string,
    list: string[],
    setList: Dispatch<SetStateAction<string[]>>,
    setInput: Dispatch<SetStateAction<string>>
  ) => {
    const email = value.trim()
    if (!email || !isValidEmail(email)) return

    if (!list.includes(email)) {
      setList([...list, email])
    }
    setInput('')
  }

  const removeRecipient = (
    email: string,
    list: string[],
    setList: Dispatch<SetStateAction<string[]>>
  ) => {
    setList(list.filter((item) => item !== email))
  }

  const handleRecipientKeyDown = (
    e: KeyboardEvent<HTMLInputElement>,
    value: string,
    list: string[],
    setList: Dispatch<SetStateAction<string[]>>,
    setInput: Dispatch<SetStateAction<string>>
  ) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      addRecipient(value, list, setList, setInput)
    }
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      setAttachments([...attachments, ...Array.from(files)])
    }
    e.target.value = ''
  }

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index))
  }

  const handleSend = async () => {
    if (to.length === 0) {
      setSendError('Please add at least one recipient')
      return
    }

    setIsSending(true)
    setSendError(null)

    const loadingToast = toast.loading('Sending email...')

    try {
      const serializedAttachments = await serializeAttachments(attachments)
      const res = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          cc,
          bcc,
          subject,
          body,
          attachments: serializedAttachments,
          inReplyTo: replyTo?.inReplyTo,
          references: replyTo?.references,
          threadId: replyTo?.threadId,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to send email')
      }

      onClose()
      toast.success('Email sent', {
        description: `To: ${to.join(', ')}${cc.length ? ` · Cc: ${cc.join(', ')}` : ''}${bcc.length ? ' · Bcc: hidden' : ''}`,
      })

      setTo([])
      setToInput('')
      setCc([])
      setCcInput('')
      setBcc([])
      setBccInput('')
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
  }

  const handleSaveDraft = () => {
    const draft: Draft = {
      to,
      cc,
      bcc,
      subject,
      body,
    }
    saveDraft(draft)
    setLastSaved(new Date())
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 md:bg-transparent">
      <button
        type="button"
        aria-label="Close compose"
        className="absolute inset-0 z-0 h-full w-full cursor-default"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 z-10 md:inset-auto md:bottom-4 md:right-4 md:left-auto md:w-[min(92vw,560px)]">
        <div className="relative mx-auto flex h-[76dvh] flex-col overflow-hidden border border-border bg-background shadow-[0_24px_80px_rgba(0,0,0,0.45)] md:mx-0 md:h-[min(620px,calc(100dvh-2rem))] md:rounded-2xl">
          <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
            <h2 className="font-mono text-sm font-semibold">
              {replyTo ? 'Reply' : 'New Message'}
            </h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2 border-b border-border px-4 py-2">
            <span className="w-10 font-mono text-sm text-muted-foreground">To:</span>
            <div className="flex flex-1 flex-wrap gap-1">
              {to.map((email) => (
                <Badge
                  key={email}
                  variant="secondary"
                  className="font-mono text-xs gap-1 pr-1"
                >
                  {email}
                  <button
                    onClick={() => removeRecipient(email, to, setTo)}
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
                onKeyDown={(e) => handleRecipientKeyDown(e, toInput, to, setTo, setToInput)}
                onBlur={() => addRecipient(toInput, to, setTo, setToInput)}
                placeholder={to.length === 0 ? ' recipient@example.com' : ''}
                className="min-w-[200px] flex-1 border-none bg-transparent font-mono text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 border-b border-border px-4 py-2">
            <button
              type="button"
              onClick={() => setShowCc((value) => !value)}
              className="font-mono text-xs text-muted-foreground hover:text-foreground"
            >
              {showCc ? 'Hide Cc' : 'Cc'}
            </button>
            <span className="text-muted-foreground">·</span>
            <button
              type="button"
              onClick={() => setShowBcc((value) => !value)}
              className="font-mono text-xs text-muted-foreground hover:text-foreground"
            >
              {showBcc ? 'Hide Bcc' : 'Bcc'}
            </button>
          </div>

          {(showCc || cc.length > 0) && (
            <div className="flex items-center gap-2 border-b border-border px-4 py-2">
              <span className="w-10 font-mono text-sm text-muted-foreground">Cc:</span>
              <div className="flex flex-1 flex-wrap gap-1">
                {cc.map((email) => (
                  <Badge
                    key={email}
                    variant="secondary"
                    className="font-mono text-xs gap-1 pr-1"
                  >
                    {email}
                    <button
                      onClick={() => removeRecipient(email, cc, setCc)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
                <input
                  type="email"
                  value={ccInput}
                  onChange={(e) => setCcInput(e.target.value)}
                  onKeyDown={(e) => handleRecipientKeyDown(e, ccInput, cc, setCc, setCcInput)}
                  onBlur={() => addRecipient(ccInput, cc, setCc, setCcInput)}
                  placeholder={cc.length === 0 ? ' copy@example.com' : ''}
                  className="min-w-[200px] flex-1 border-none bg-transparent font-mono text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>
          )}

          {(showBcc || bcc.length > 0) && (
            <div className="flex items-center gap-2 border-b border-border px-4 py-2">
              <span className="w-10 font-mono text-sm text-muted-foreground">Bcc:</span>
              <div className="flex flex-1 flex-wrap gap-1">
                {bcc.map((email) => (
                  <Badge
                    key={email}
                    variant="secondary"
                    className="font-mono text-xs gap-1 pr-1"
                  >
                    {email}
                    <button
                      onClick={() => removeRecipient(email, bcc, setBcc)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
                <input
                  type="email"
                  value={bccInput}
                  onChange={(e) => setBccInput(e.target.value)}
                  onKeyDown={(e) => handleRecipientKeyDown(e, bccInput, bcc, setBcc, setBccInput)}
                  onBlur={() => addRecipient(bccInput, bcc, setBcc, setBccInput)}
                  placeholder={bcc.length === 0 ? ' hidden@example.com' : ''}
                  className="min-w-[200px] flex-1 border-none bg-transparent font-mono text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 border-b border-border px-4 py-2">
            <span className="w-10 font-mono text-sm text-muted-foreground">Sub:</span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="flex-1 border-none bg-transparent font-mono text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="flex-1 overflow-hidden p-4">
            <ScrollArea className="h-full">
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your message..."
                className="min-h-[180px] h-full resize-none border-none bg-transparent font-mono text-sm"
              />
            </ScrollArea>
          </div>

          {attachments.length > 0 && (
            <div className="border-t border-border px-4 py-2">
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

          {sendError && (
            <div className="border-t border-destructive/20 bg-destructive/10 px-4 py-2">
              <p className="font-mono text-xs text-destructive">{sendError}</p>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border bg-surface px-4 py-3">
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
    </div>
  )
}
