'use client'

import { useEffect, useState, type ChangeEvent, type Dispatch, type KeyboardEvent, type SetStateAction } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useEmail } from '@/contexts/email-context'
import { toast } from 'sonner'
import { X, Send, Paperclip, Loader2 } from 'lucide-react'
import type { Draft } from '@/types/email'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { TextStyle, FontSize } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { Highlight } from '@tiptap/extension-highlight'
import { TextAlign } from '@tiptap/extension-text-align'
import { FontFamily } from '@tiptap/extension-font-family'
import { ComposeToolbar } from './compose-toolbar'

interface ComposeProps {
  isOpen: boolean
  onClose: () => void
  /** Render as an inline panel inside the sidebar instead of a modal overlay */
  inline?: boolean
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

export function Compose({ isOpen, onClose, inline = false, replyTo }: ComposeProps) {
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
  const [attachments, setAttachments] = useState<File[]>([])
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  // Initialize body HTML — empty for mailie replies (no auto-quote policy),
  // or the raw replyTo.body if it contains HTML from a forwarded email.
  const initialBodyHtml = replyTo?.body || ''

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextStyle,
      FontSize,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      FontFamily.configure({
        types: ['textStyle'],
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
        resize: { enabled: true },
        HTMLAttributes: {
          class: 'rounded-sm max-w-full',
        },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
      }),
      Placeholder.configure({
        placeholder: 'Write your message...',
      }),
    ],
    content: initialBodyHtml,
    editorProps: {
      attributes: {
        class: 'min-h-[180px] outline-none font-sans text-sm text-foreground',
        style: 'font-family: Arial, Helvetica, sans-serif',
      },
    },
    onUpdate: ({ editor }) => {
      // bodyHtml drives draft saving — keep in sync
      setBodyHtml(editor.getHTML())
    },
  })

  // Track bodyHtml for draft saving
  const [bodyHtml, setBodyHtml] = useState(initialBodyHtml)

  // Sync bodyHtml when replyTo changes (e.g., switching between reply contexts)
  useEffect(() => {
    if (editor && replyTo?.body) {
      editor.commands.setContent(replyTo.body)
      setBodyHtml(replyTo.body)
    }
  }, [replyTo?.body, editor])

  // Auto-save draft every 30 seconds
  useEffect(() => {
    if (!isOpen || !editor) return

    const interval = setInterval(() => {
      const draft: Draft = {
        to,
        cc,
        bcc,
        subject,
        body: editor.getHTML(), // store HTML for formatted draft restore
      }
      saveDraft(draft)
      setLastSaved(new Date())
    }, 30000)

    return () => clearInterval(interval)
  }, [isOpen, to, cc, bcc, subject, editor, saveDraft])

  // Destroy editor on close to prevent memory leaks
  useEffect(() => {
    if (!isOpen) {
      editor?.destroy()
    }
  }, [isOpen, editor])

  // Reset form state when compose opens fresh (no replyTo)
  useEffect(() => {
    if (isOpen && !replyTo) {
      setTo([])
      setCc([])
      setBcc([])
      setSubject('')
      setAttachments([])
      setSendError(null)
      setLastSaved(null)
      editor?.commands.clearContent()
      setBodyHtml('')
    }
  }, [isOpen, replyTo, editor])

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
    if (!files) return

    const imageFiles: File[] = []
    const docFiles: File[] = []

    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        imageFiles.push(file)
      } else {
        docFiles.push(file)
      }
    }

    // Images → embed inline in editor as base64 data URL
    for (const file of imageFiles) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const src = ev.target?.result as string
        editor?.chain().focus().setImage({ src }).run()
      }
      reader.readAsDataURL(file)
    }

    // Documents → regular attachments (sent as MIME parts)
    if (docFiles.length > 0) {
      setAttachments((prev) => [...prev, ...docFiles])
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

    if (!editor || editor.isEmpty) {
      setSendError('Please write a message')
      return
    }

    setIsSending(true)
    setSendError(null)

    const loadingToast = toast.loading('Sending email...')

    try {
      const serializedAttachments = await serializeAttachments(attachments)
      const body = editor.getHTML()

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
      setAttachments([])
      setBodyHtml('')
      editor?.commands.clearContent()
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
    if (!editor) return
    const draft: Draft = {
      to,
      cc,
      bcc,
      subject,
      body: editor.getHTML(),
    }
    saveDraft(draft)
    setLastSaved(new Date())
  }

  if (!isOpen) return null

  // ── Inline panel mode (rendered inside the sidebar) ──────────────────────
  if (inline) {
    return (
      <div className="flex flex-col h-full border-t border-[var(--sidebar-border)] bg-[var(--card)]">
        {/* Inline header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
          <h2 className="font-mono text-xs font-semibold text-[var(--foreground)]">
            {replyTo ? 'Reply' : 'New Message'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-elevated)] transition-colors"
            aria-label="Close compose"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* To */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-[var(--border)]">
          <span className="w-6 font-mono text-[11px] text-muted-foreground shrink-0">To:</span>
          <div className="flex flex-1 flex-wrap gap-1">
            {to.map((email) => (
              <Badge
                key={email}
                variant="secondary"
                className="font-mono text-[10px] gap-0.5 pr-0.5 h-5"
              >
                {email}
                <button
                  onClick={() => removeRecipient(email, to, setTo)}
                  className="hover:text-destructive"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </Badge>
            ))}
            <input
              type="email"
              value={toInput}
              onChange={(e) => setToInput(e.target.value)}
              onKeyDown={(e) => handleRecipientKeyDown(e, toInput, to, setTo, setToInput)}
              onBlur={() => addRecipient(toInput, to, setTo, setToInput)}
              placeholder={to.length === 0 ? ' recipient' : ''}
              className="min-w-[80px] flex-1 border-none bg-transparent font-mono text-[11px] outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Subject */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-[var(--border)]">
          <span className="w-6 font-mono text-[11px] text-muted-foreground shrink-0">Sub:</span>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="flex-1 border-none bg-transparent font-mono text-[11px] outline-none placeholder:text-muted-foreground text-[var(--foreground)]"
          />
        </div>

        {/* Editor — scrolls internally */}
        <div className="flex-1 overflow-y-auto p-2">
          {editor && <ComposeToolbar editor={editor} />}
          <EditorContent
            editor={editor}
            className="[&_.ProseMirror]:min-h-[120px] [&_.ProseMirror]:outline-none [&_.ProseMirror]:font-sans [&_.ProseMirror]:text-[12px] [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none"
          />
        </div>

        {/* Inline footer */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-[var(--border)]">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => document.getElementById('inline-attachment-input')?.click()}
            >
              <Paperclip className="w-3 h-3" />
              <input
                id="inline-attachment-input"
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
            </Button>
          </div>
          <div className="flex items-center gap-1">
            {sendError && (
              <span className="font-mono text-[10px] text-destructive mr-1">{sendError}</span>
            )}
            <Button
              onClick={handleSend}
              disabled={isSending}
              size="sm"
              className="font-mono text-[11px] h-6 px-2 bg-accent text-background hover:bg-accent/90"
            >
              {isSending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Send className="w-3 h-3" />
              )}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ── Modal overlay mode ────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-black/50 md:bg-transparent">
      <button
        type="button"
        aria-label="Close compose"
        className="absolute inset-0 z-0 h-full w-full cursor-default"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 z-10 md:inset-auto md:bottom-4 md:right-4 md:left-auto md:left-[calc(50%-280px)] md:w-[min(92vw,560px)]">
        <div className="relative mx-auto flex h-[76dvh] flex-col overflow-hidden border border-border bg-background shadow-[0_24px_80px_rgba(0,0,0,0.45)] md:mx-0 md:h-[min(620px,calc(100dvh-2rem))] md:rounded-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
            <h2 className="font-mono text-sm font-semibold">
              {replyTo ? 'Reply' : 'New Message'}
            </h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* To */}
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

          {/* Cc / Bcc toggles */}
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

          {/* Cc field */}
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

          {/* Bcc field */}
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

          {/* Subject */}
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

          {/* Editor area */}
          <div className="flex-1 overflow-hidden p-4">
            <ScrollArea className="h-full">
              {editor && <ComposeToolbar editor={editor} />}
              <EditorContent
                editor={editor}
                className="[&_.ProseMirror]:min-h-[180px] [&_.ProseMirror]:outline-none [&_.ProseMirror]:font-sans [&_.ProseMirror]:text-sm [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none"
              />
            </ScrollArea>
          </div>

          {/* Attachments */}
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

          {/* Error */}
          {sendError && (
            <div className="border-t border-destructive/20 bg-destructive/10 px-4 py-2">
              <p className="font-mono text-xs text-destructive">{sendError}</p>
            </div>
          )}

          {/* Footer */}
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
