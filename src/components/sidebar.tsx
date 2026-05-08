'use client'

import { startTransition } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useEmail } from '@/contexts/email-context'
import { useCompose } from '@/contexts/compose-context'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverPositioner, PopoverContent } from '@/components/ui/popover'
import { toast } from 'sonner'
import { useState, useEffect } from 'react'
import {
  Inbox,
  ShieldAlert,
  Send,
  File,
  Trash2,
  PenSquare,
  Settings,
  LogOut,
  Star,
  Tag,
} from 'lucide-react'

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  inbox: Inbox,
  star: Star,
  spam: ShieldAlert,
  send: Send,
  file: File,
  trash: Trash2,
}

interface SidebarProps {
  onSettingsOpen: () => void
}

export function Sidebar({ onSettingsOpen }: SidebarProps) {
  const { account, logout, provider } = useAuth()
  const { folders, currentFolder, setCurrentFolder } = useEmail()
  const { handleCompose } = useCompose()
  const [gmailLabels, setGmailLabels] = useState<Array<{ id: string; name: string; unreadCount: number }>>([])

  useEffect(() => {
    if (provider !== 'gmail') return

    async function fetchLabels() {
      try {
        const res = await fetch('/api/gmail/labels', { credentials: 'include' })
        if (!res.ok) return
        const data = await res.json() as { labels: Array<{ id: string; name: string; messagesUnreadCount?: number }> }
        // Filter to system labels that aren't already in the folders list
        const systemLabels = data.labels.filter((l) =>
          !['INBOX', 'SENT', 'DRAFT', 'TRASH', 'SPAM', 'STARRED', 'ARCHIVE', 'IMPORTANT'].includes(l.id)
        )
        setGmailLabels(systemLabels.map((l) => ({
          id: l.id,
          name: l.name,
          unreadCount: l.messagesUnreadCount ?? 0,
        })))
      } catch {
        // non-fatal
      }
    }

    void fetchLabels()
  }, [provider])

  const handleLogout = async () => {
    try {
      await logout()
      toast.success('Signed out', { description: 'See you next time 👋' })
    } catch {
      toast.error('Logout failed')
    }
  }

  return (
    /* Unified sidebar — single merged bar */
    <aside className="w-[180px] h-full flex flex-col bg-[var(--sidebar)] border-r border-[var(--sidebar-border)] shrink-0 overflow-hidden">
      {/* Logo row — no internal bottom border; single top border only */}
      <div className="flex items-center gap-2 px-3 py-3">
        <div className="w-7 h-7 rounded-sm bg-[var(--surface-deep)] flex items-center justify-center shrink-0">
          <span className="font-mono text-sm font-bold text-[var(--brand)] select-none">m</span>
        </div>
        <div className="flex-1" />
      </div>

      {/* Compose button — opens floating compose panel */}
      <div className="px-2 py-2">
        <button
          onClick={handleCompose}
          className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-sm font-mono text-[13px] bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 transition-opacity"
        >
          <div className="flex items-center gap-2">
            <PenSquare className="w-3.5 h-3.5 shrink-0" />
            <span>Compose</span>
          </div>
        </button>
      </div>

      {/* Folders */}
      <ScrollArea className="flex-1 py-2">
        <nav className="flex flex-col gap-0.5 px-2">
          {folders.map((folder) => {
            const Icon = iconMap[folder.icon] || Inbox
            const isActive = currentFolder.id === folder.id

            return (
              <button
                key={folder.id}
                onClick={() => {
                  startTransition(() => {
                    setCurrentFolder(folder)
                  })
                }}
                className={`
                  w-full flex items-center justify-between px-2 py-1.5
                  text-[13px] rounded-sm transition-colors font-mono
                  ${isActive
                    ? 'bg-[var(--surface-elevated)] text-[var(--sidebar-primary)] border-l-2 border-l-[var(--sidebar-primary)]'
                    : 'text-[var(--muted-foreground)] hover:bg-[var(--surface-elevated)] hover:text-[var(--sidebar-foreground)] border-l-2 border-l-transparent'
                  }
                `}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{folder.name}</span>
                </div>
                {folder.unreadCount > 0 && (
                  <Badge
                    variant={isActive ? 'default' : 'secondary'}
                    className="font-mono text-[10px] h-4 min-w-4 px-1 shrink-0"
                  >
                    {folder.unreadCount}
                  </Badge>
                )}
              </button>
            )
          })}
        </nav>

        {/* Gmail Labels — shown below folders for Gmail accounts */}
        {provider === 'gmail' && gmailLabels.length > 0 && (
          <div className="pb-2">
            <div className="px-4 py-2">
              <div className="flex items-center gap-1.5">
                <Tag className="w-3 h-3 text-[var(--muted-foreground)]" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                  Labels
                </span>
              </div>
            </div>
            <nav className="flex flex-col gap-0.5 px-2 pb-2">
              {gmailLabels.map((label) => {
                const isActive = currentFolder.id === label.id
                const activeClass = isActive
                  ? 'bg-[var(--surface-elevated)] text-[var(--sidebar-primary)]'
                  : 'text-[var(--muted-foreground)] hover:bg-[var(--surface-elevated)] hover:text-[var(--sidebar-foreground)]'
                return (
                  <button
                    key={label.id}
                    onClick={() => {
                      startTransition(() => {
                        setCurrentFolder({ id: label.id, name: label.name, icon: 'tag', unreadCount: label.unreadCount })
                      })
                    }}
                    className={'w-full flex items-center justify-between px-2 py-1.5 text-[12px] rounded-sm transition-colors font-mono ' + activeClass}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Tag className="w-3 h-3 shrink-0" />
                      <span className="truncate">{label.name}</span>
                    </div>
                    {label.unreadCount > 0 && (
                      <Badge
                        variant={isActive ? 'default' : 'secondary'}
                        className="font-mono text-[10px] h-4 min-w-4 px-1 shrink-0"
                      >
                        {label.unreadCount}
                      </Badge>
                    )}
                  </button>
                )
              })}
            </nav>
          </div>
        )}

        {provider === 'smtp_imap' && (
          <div className="pb-2">
            <div className="px-4 py-1">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                Folders
              </span>
            </div>
          </div>
        )}
      </ScrollArea>

      {/* Account */}
      <div className="p-2 border-t border-[var(--sidebar-border)]">
        {/* Settings — moved above user info */}
        <button
          onClick={onSettingsOpen}
          className="w-full flex items-center gap-2 px-1 py-1 mb-1 text-[11px] font-mono rounded-sm text-[var(--muted-foreground)] hover:bg-[var(--surface-elevated)] hover:text-[var(--sidebar-foreground)] transition-colors"
        >
          <Settings className="w-3.5 h-3.5 shrink-0" />
          <span>Settings</span>
        </button>

        {/* User — avatar + name as popover trigger for logout */}
        <PopoverRoot>
          <PopoverTrigger
            render={
              <button
                type="button"
                className="w-full flex items-center gap-2 px-1 py-1 rounded-sm hover:bg-[var(--surface-elevated)] transition-colors cursor-pointer"
              />
            }
          >
            <div className="w-6 h-6 rounded-full bg-[var(--surface-elevated)] flex items-center justify-center shrink-0">
              <span className="font-mono text-[10px] text-[var(--sidebar-primary)] font-semibold">
                {account?.name?.charAt(0).toUpperCase() || 'D'}
              </span>
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="font-mono text-[11px] truncate text-[var(--sidebar-foreground)]">
                {account?.name || 'Demo User'}
              </p>
              <p className="font-mono text-[10px] truncate text-[var(--muted-foreground)]">
                {account?.email || 'demo@mailie.dev'}
              </p>
            </div>
          </PopoverTrigger>
          <PopoverPortal>
            <PopoverPositioner side="top" align="start" sideOffset={4}>
              <PopoverContent className="p-1 min-w-[140px]">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-[12px] font-mono rounded-sm text-[var(--sidebar-foreground)] hover:bg-[var(--surface-elevated)] transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0" />
                  <span>Sign out</span>
                </button>
              </PopoverContent>
            </PopoverPositioner>
          </PopoverPortal>
        </PopoverRoot>
      </div>
    </aside>
  )
}
