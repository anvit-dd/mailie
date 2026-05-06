'use client'

import { Email } from '@/types/email'
import { Badge } from '@/components/ui/badge'
import { Paperclip, Star } from 'lucide-react'
import { useEmail } from '@/contexts/email-context'
import Image from 'next/image'

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
  const { avatarMap } = useEmail()
  const avatarUrl = avatarMap[email.from.email]

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
      <div className="flex items-start gap-2.5">
        {/* Sender avatar */}
        <div className="mt-0.5 shrink-0">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={email.from.name || email.from.email}
              width={32}
              height={32}
              unoptimized
              className={`w-8 h-8 rounded-full object-cover ${email.isRead ? 'opacity-60' : ''}`}
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement
                // People API returned a photo but it's broken — replace with initials
                const initial = (email.from.name || email.from.email).charAt(0).toUpperCase()
                const parent = target.parentElement
                if (parent) {
                  parent.innerHTML = email.isRead
                    ? `<div class="w-8 h-8 rounded-full bg-muted/30 flex items-center justify-center"><span class="font-mono text-[10px] text-muted-foreground font-semibold">${initial}</span></div>`
                    : `<div class="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center"><span class="font-mono text-xs text-accent font-semibold">${initial}</span></div>`
                }
              }}
            />
          ) : (
            // No avatar URL — show initials
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${email.isRead ? 'bg-muted/30' : 'bg-accent/15'}`}>
              <span className={`font-mono text-xs font-semibold ${email.isRead ? 'text-[10px] text-muted-foreground' : 'text-xs text-accent'}`}>
                {(email.from.name || email.from.email).charAt(0).toUpperCase()}
              </span>
            </div>
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

          {/* Labels — always reserve height so rows stay uniform */}
          <div className={`flex gap-1 mt-1 ${email.labels.length === 0 ? 'h-4' : ''}`}>
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
        </div>
      </div>
    </button>
  )
}
