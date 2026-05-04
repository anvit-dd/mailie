'use client'

import { Email } from '@/types/email'
import { Badge } from '@/components/ui/badge'
import { Paperclip, Star } from 'lucide-react'

function formatRelativeDate(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHours / 24)

  if (diffHours < 1) {
    const diffMins = Math.floor(diffMs / (1000 * 60))
    return diffMins <= 0 ? 'now' : `${diffMins}m`
  }

  if (diffHours < 24) {
    return `${diffHours}h`
  }

  if (diffDays === 1) {
    return 'yesterday'
  }

  if (diffDays < 7) {
    return `${diffDays}d`
  }

  // Show date for older messages
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

interface EmailListItemProps {
  email: Email
  isSelected: boolean
  onClick: () => void
}

export function EmailListItem({ email, isSelected, onClick }: EmailListItemProps) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left p-3 border-b border-border transition-colors
        hover:bg-surface-elevated
        ${isSelected
          ? 'bg-surface-elevated border-l-2 border-l-accent'
          : 'border-l-2 border-l-transparent'
        }
      `}
    >
      <div className="flex items-start gap-2">
        {/* Unread indicator */}
        <div className="mt-1.5">
          {!email.isRead && (
            <div className="w-2 h-2 rounded-full bg-accent" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Top row: sender + date */}
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span
              className={`
                font-mono text-xs truncate
                ${email.isRead ? 'text-muted-foreground' : 'text-foreground font-semibold'}
              `}
            >
              {email.from.name || email.from.email}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground shrink-0">
              {formatRelativeDate(email.date)}
            </span>
          </div>

          {/* Subject */}
          <p
            className={`
              font-mono text-sm truncate mb-0.5
              ${email.isRead ? 'text-muted-foreground' : 'text-foreground'}
            `}
          >
            {email.subject || '(no subject)'}
          </p>

          {/* Preview + badges */}
          <div className="flex items-center gap-2">
            <p className="font-mono text-[11px] text-muted-foreground truncate flex-1">
              {email.preview}
            </p>
            <div className="flex items-center gap-1 shrink-0">
              {email.isStarred && (
                <Star className="w-3 h-3 fill-accent text-accent" />
              )}
              {email.hasAttachments && (
                <Paperclip className="w-3 h-3 text-muted-foreground" />
              )}
            </div>
          </div>

          {/* Labels */}
          {email.labels.length > 0 && (
            <div className="flex gap-1 mt-1">
              {email.labels.slice(0, 2).map((label) => (
                <Badge
                  key={label}
                  variant="outline"
                  className="font-mono text-[9px] px-1 py-0 h-4"
                >
                  {label}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
  )
}
