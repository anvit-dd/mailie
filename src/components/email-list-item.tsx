'use client'

import { Email } from '@/types/email'
import { Paperclip, Star, Trash2 } from 'lucide-react'
import { useEmail } from '@/contexts/email-context'
import Image from 'next/image'
import { Checkbox } from '@/components/ui/checkbox'

function formatRelativeDate(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHours / 24)

  if (diffHours < 1) {
    const diffMins = Math.floor(diffMs / (1000 * 60))
    return diffMins <= 0 ? 'now' : `${diffMins}m`
  }
  if (diffHours < 24) return `${diffHours}h`
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays}d`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

interface EmailListItemProps {
  email: Email
  isSelected: boolean
  onClick: () => void
  selectedIds: Set<string>
  toggleSelected: (id: string) => void
}

export function EmailListItem({ email, isSelected, onClick, selectedIds, toggleSelected }: EmailListItemProps) {
  const { avatarMap, toggleStar, trashEmail } = useEmail()
  const avatarUrl = avatarMap[email.from.email]
  const isChecked = selectedIds.has(email.id)

  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left px-3 py-2 transition-colors border-b border-[var(--border)] select-none
        hover:bg-[var(--surface-elevated)]
        ${isSelected
          ? 'bg-[var(--surface-elevated)] border-l-2 border-l-[var(--accent)]'
          : 'border-l-2 border-l-transparent'
        }
        ${isChecked ? 'bg-[var(--surface-deep)]' : ''}
      `}
    >
      <div className="flex items-center gap-2.5">
        {/* Bulk selection checkbox */}
        <div className="shrink-0" onClick={(e) => { e.stopPropagation(); toggleSelected(email.id) }}>
          <Checkbox
            checked={isChecked}
            onCheckedChange={() => toggleSelected(email.id)}
            className="cursor-pointer"
          />
        </div>
        {/* Sender avatar */}
        <div className="relative shrink-0">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={email.from.name || email.from.email}
              width={28}
              height={28}
              unoptimized
              className={`w-7 h-7 rounded-full object-cover ${email.isRead ? 'opacity-50' : ''}`}
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement
                const initial = (email.from.name || email.from.email).charAt(0).toUpperCase()
                const parent = target.parentElement
                if (parent) {
                  parent.innerHTML = email.isRead
                    ? `<div class="w-7 h-7 rounded-full bg-[var(--muted)] flex items-center justify-center"><span class="font-mono text-[10px] text-[var(--muted-foreground)] font-semibold">${initial}</span></div>`
                    : `<div class="w-7 h-7 rounded-full bg-[var(--accent)]/15 flex items-center justify-center"><span class="font-mono text-[10px] text-[var(--accent)] font-semibold">${initial}</span></div>`
                }
              }}
            />
          ) : (
            <div className={`w-7 h-7 rounded-full flex items-center justify-center ${email.isRead ? 'bg-[var(--muted)]' : 'bg-[var(--accent)]/15'}`}>
              <span className={`font-mono text-[10px] font-semibold ${email.isRead ? 'text-[var(--muted-foreground)]' : 'text-[var(--accent)]'}`}>
                {(email.from.name || email.from.email).charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          {/* Unread indicator dot — left-side accent dot */}
          {!email.isRead && (
            <span className="absolute top-0.5 left-0.5 w-1.5 h-1.5 rounded-full bg-[var(--accent)] ring-1 ring-[var(--background)]" />
          )}
        </div>

        {/* Content — 13px base, hierarchy via weight + muted color */}
        <div className="flex-1 min-w-0">
          {/* Top row: sender + date */}
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span
              className={`
                font-mono text-[13px] truncate
                ${email.isRead
                  ? 'font-normal text-[var(--muted-foreground)]'
                  : 'font-semibold text-[var(--foreground)]'
                }
              `}
            >
              {email.from.name || email.from.email}
            </span>
            <span className="font-mono text-[11px] text-[var(--muted-foreground)] shrink-0">
              {formatRelativeDate(email.date)}
            </span>
          </div>

          {/* Subject */}
          <p
            className={`
              font-mono text-[13px] truncate mb-0.5 leading-snug
              ${email.isRead ? 'font-normal text-[var(--muted-foreground)]' : 'text-[var(--foreground)]'}
            `}
          >
            {email.subject || '(no subject)'}
          </p>

          {/* Preview + indicators */}
          <div className="flex items-center gap-1.5">
            <p className="font-mono text-[12px] text-[var(--muted-foreground)] truncate flex-1 leading-snug">
              {email.preview}
            </p>
            <div className="flex items-center gap-1 shrink-0">
              {email.hasAttachments && (
                <Paperclip className="w-3 h-3 text-[var(--muted-foreground)]" />
              )}
              {email.isStarred ? (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); toggleStar(email.id, email.isStarred) }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); toggleStar(email.id, email.isStarred) } }}
                  className="p-0.5 rounded hover:bg-[var(--accent)]/20 transition-colors cursor-pointer"
                  aria-label="Unstar email"
                >
                  <Star className="w-3 h-3 fill-[var(--accent)] text-[var(--accent)]" />
                </span>
              ) : (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); toggleStar(email.id, email.isStarred) }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); toggleStar(email.id, email.isStarred) } }}
                  className="p-0.5 rounded hover:bg-[var(--accent)]/20 transition-colors cursor-pointer"
                  aria-label="Star email"
                >
                  <Star className="w-3 h-3 text-[var(--muted-foreground)]" />
                </span>
              )}
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); trashEmail(email.id) }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); trashEmail(email.id) } }}
                className="p-0.5 rounded hover:bg-[var(--destructive)]/20 transition-colors cursor-pointer"
                aria-label="Trash email"
              >
                <Trash2 className="w-3 h-3 text-[var(--muted-foreground)] hover:text-[var(--destructive)]" />
              </span>
            </div>
          </div>


        </div>
      </div>
    </button>
  )
}
