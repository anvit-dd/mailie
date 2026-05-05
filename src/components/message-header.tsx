'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useEmail } from '@/contexts/email-context'
import {
  Reply,
  ArrowRight,
  Trash2,
  Star,
  MoreHorizontal,
  Paperclip,
  ChevronDown,
} from 'lucide-react'
import { useState } from 'react'

interface MessageHeaderProps {
  onReply: () => void
  onForward: () => void
  hideSubject?: boolean
}

export function MessageHeader({ onReply, onForward, hideSubject }: MessageHeaderProps) {
  const { selectedEmail } = useEmail()
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

  return (
    <div className="border-b border-border bg-surface p-4">
      {!hideSubject && (
        <h2 className="font-mono text-lg font-semibold mb-3">
          {selectedEmail.subject || '(no subject)'}
        </h2>
      )}

      {/* Sender info */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-sm bg-accent/10 flex items-center justify-center shrink-0">
          <span className="font-mono text-sm text-accent font-semibold">
            {(selectedEmail.from.name || selectedEmail.from.email).charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold">
              {selectedEmail.from.name || selectedEmail.from.email}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              &lt;{selectedEmail.from.email}&gt;
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-mono text-xs text-muted-foreground">
              to{' '}
              {selectedEmail.to.length === 1
                ? selectedEmail.to[0].name || selectedEmail.to[0].email
                : `${selectedEmail.to.length} recipients`}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              · {formatDate(selectedEmail.date)}
            </span>
          </div>
        </div>
      </div>

      {/* Labels */}
      {selectedEmail.labels.length > 0 && (
        <div className="flex gap-1 mb-3">
          {selectedEmail.labels.map((label) => (
            <Badge
              key={label}
              variant="outline"
              className="font-mono text-xs"
            >
              {label}
            </Badge>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onReply}
          className="font-mono text-xs h-8"
        >
          <Reply className="w-3 h-3 mr-1" />
          Reply
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onForward}
          className="font-mono text-xs h-8"
        >
          <ArrowRight className="w-3 h-3 mr-1" />
          Forward
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
        >
          <Star className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </Button>

        {selectedEmail.hasAttachments && (
          <div className="ml-auto flex items-center gap-1 text-muted-foreground">
            <Paperclip className="w-3.5 h-3.5" />
            <span className="font-mono text-xs">
              {selectedEmail.attachments?.length || ' attachment'}
            </span>
          </div>
        )}
      </div>

      {/* Expandable headers */}
      {showAllHeaders && (
        <div className="mt-3 p-3 bg-background rounded-sm border border-border">
          <p className="font-mono text-xs text-muted-foreground mb-1">Headers</p>
          {Object.entries(selectedEmail.headers).map(([key, value]) => (
            <div key={key} className="font-mono text-xs">
              <span className="text-muted-foreground">{key}: </span>
              <span className="break-all">{value}</span>
            </div>
          ))}
        </div>
      )}
      <button
        onClick={() => setShowAllHeaders(!showAllHeaders)}
        className="mt-2 font-mono text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
      >
        <ChevronDown className={`w-3 h-3 transition-transform ${showAllHeaders ? 'rotate-180' : ''}`} />
        {showAllHeaders ? 'Hide details' : 'Show details'}
      </button>
    </div>
  )
}
