'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useEmail } from '@/contexts/email-context'
import {
  Reply,
  ArrowRight,
  Trash2,
  Star,
  MoreHorizontal,
  Paperclip,
  ChevronDown,
  Download,
  Archive,
  Mail,
} from 'lucide-react'
import { useState } from 'react'

interface MessageHeaderProps {
  onReply: () => void
  onForward: () => void
  hideSubject?: boolean
}

export function MessageHeader({ onReply, onForward, hideSubject }: MessageHeaderProps) {
  const { selectedEmail, toggleStar, trashEmail, archiveEmail, markAsRead } = useEmail()
  const [showAllHeaders, setShowAllHeaders] = useState(false)

  if (!selectedEmail) return null

  const formatDate = (date: Date) => {
    return date.toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const downloadAttachment = (attachmentId: string, filename: string) => {
    const url = `/api/gmail/attachment?messageId=${encodeURIComponent(selectedEmail.id)}&attachmentId=${encodeURIComponent(attachmentId)}&filename=${encodeURIComponent(filename)}`
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  return (
    /* Low-chrome header: surface bg + subtle bottom border */
    <div className="border-b border-[var(--border)] bg-[var(--card)] px-4 pt-4 pb-3 shrink-0">

      {/* Subject — one line, truncate */}
      {!hideSubject && (
        <h2 className="font-mono text-[14px] font-semibold text-[var(--foreground)] mb-3 truncate pr-2">
          {selectedEmail.subject || '(no subject)'}
        </h2>
      )}

      {/* Sender row */}
      <div className="flex items-start gap-2.5 mb-3">
        {/* Avatar */}
        <div className="w-7 h-7 rounded-full bg-[var(--accent)]/15 flex items-center justify-center shrink-0 mt-0.5">
          <span className="font-mono text-[11px] text-[var(--accent)] font-semibold">
            {(selectedEmail.from.name || selectedEmail.from.email).charAt(0).toUpperCase()}
          </span>
        </div>

        {/* Name + email + date */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[13px] font-semibold text-[var(--foreground)] truncate">
              {selectedEmail.from.name || selectedEmail.from.email}
            </span>
            <span className="font-mono text-[11px] text-[var(--muted-foreground)] shrink-0">
              {formatDate(selectedEmail.date)}
            </span>
          </div>
          <span className="font-mono text-[11px] text-[var(--muted-foreground)] truncate block">
            {selectedEmail.from.email}
          </span>
        </div>
      </div>

      {/* Labels — compact */}
      {selectedEmail.labels.length > 0 && (
        <div className="flex gap-1 mb-3">
          {selectedEmail.labels.map((label) => (
            <Badge
              key={label}
              variant="outline"
              className="font-mono text-[10px] px-1.5 h-4"
            >
              {label}
            </Badge>
          ))}
        </div>
      )}

      {/* Actions row — compact, icon-first */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onReply}
          className="h-7 px-2 text-[12px] font-mono text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          <Reply className="w-3 h-3 mr-1" />
          Reply
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onForward}
          className="h-7 px-2 text-[12px] font-mono text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          <ArrowRight className="w-3 h-3 mr-1" />
          Forward
        </Button>

        {/* Trash */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          onClick={() => selectedEmail && trashEmail(selectedEmail.id)}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>

        {/* Archive */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          onClick={() => selectedEmail && archiveEmail(selectedEmail.id)}
        >
          <Archive className="w-3.5 h-3.5" />
        </Button>

        {/* Mark as Read / Unread */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          onClick={() => selectedEmail && markAsRead(selectedEmail.id, !selectedEmail.isRead)}
        >
          <Mail className="w-3.5 h-3.5" />
        </Button>

        {/* Star */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          onClick={() => selectedEmail && toggleStar(selectedEmail.id, selectedEmail.isStarred)}
        >
          <Star className={`w-3.5 h-3.5 ${selectedEmail?.isStarred ? 'fill-[var(--accent)] text-[var(--accent)]' : ''}`} />
        </Button>

        {/* Attachments */}
        {selectedEmail.hasAttachments && selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
          selectedEmail.attachments.length > 4 ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 font-mono text-[11px] h-7 px-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer rounded-sm hover:bg-[var(--surface-elevated)] transition-colors">
                <Paperclip className="w-3 h-3" />
                {selectedEmail.attachments.length}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-w-xs z-50 bg-[var(--popover)] border-[var(--border)]">
                {selectedEmail.attachments.map((att) => (
                  <DropdownMenuItem
                    key={att.id}
                    className="font-mono text-[12px] cursor-pointer text-[var(--popover-foreground)]"
                    onClick={() => downloadAttachment(att.id, att.filename)}
                  >
                    <Paperclip className="w-3 h-3 mr-1.5 shrink-0" />
                    <span className="truncate flex-1">{att.filename}</span>
                    <Download className="w-3 h-3 shrink-0" />
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            selectedEmail.attachments.map((att) => (
              <Button
                key={att.id}
                variant="ghost"
                size="sm"
                className="h-7 px-1.5 text-[11px] font-mono text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                onClick={() => downloadAttachment(att.id, att.filename)}
              >
                <Paperclip className="w-3 h-3 mr-1" />
                <span className="truncate max-w-[100px]">{att.filename}</span>
              </Button>
            ))
          )
        )}

        {/* More */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </Button>

        <div className="flex-1" />

        {/* Expand headers toggle */}
        <button
          onClick={() => setShowAllHeaders(!showAllHeaders)}
          className="flex items-center gap-1 font-mono text-[11px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          <ChevronDown className={`w-3 h-3 transition-transform ${showAllHeaders ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Expandable headers */}
      {showAllHeaders && (
        <div className="mt-3 p-3 bg-[var(--background)] border border-[var(--border)]">
          <p className="font-mono text-[11px] text-[var(--muted-foreground)] mb-1">Headers</p>
          {Object.entries(selectedEmail.headers).map(([key, value]) => (
            <div key={key} className="font-mono text-[11px]">
              <span className="text-[var(--muted-foreground)]">{key}: </span>
              <span className="break-all text-[var(--foreground)]">{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
