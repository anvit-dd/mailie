'use client'

import { startTransition, useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useEmail } from '@/contexts/email-context'
import { useCompose } from '@/contexts/compose-context'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverPositioner, PopoverContent } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
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
  Plus,
  Loader2,
} from 'lucide-react'

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  inbox: Inbox,
  star: Star,
  spam: ShieldAlert,
  send: Send,
  file: File,
  trash: Trash2,
}

const labelPalette = [
  '#74ADE8',
  '#98C379',
  '#E5C07B',
  '#E06C75',
  '#56B6C2',
  '#C678DD',
  '#BF956A',
  '#A1C181',
  '#85C1FF',
  '#AAD581',
  '#FFD885',
  '#EA858B',
  '#6ED5DE',
  '#D398EB',
  '#D07277',
  '#DEC184',
]

interface SidebarLabel {
  id: string
  name: string
  unreadCount: number
  color: string
}

interface SidebarProps {
  onSettingsOpen: () => void
}

function applyLabelOrder(
  labels: SidebarLabel[],
  labelOrder: string[]
) {
  const orderIndex = new Map(labelOrder.map((id, index) => [id, index]))
  return [...labels].sort((a, b) => {
    const aIndex = orderIndex.get(a.id)
    const bIndex = orderIndex.get(b.id)
    if (aIndex != null && bIndex != null) return aIndex - bIndex
    if (aIndex != null) return -1
    if (bIndex != null) return 1
    return a.name.localeCompare(b.name)
  })
}

function getStableHash(value: string): number {
  let hash = 0
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  }
  return hash
}

function getRandomizedFallbackColors(labels: Array<{ id: string }>, accountEmail?: string): Map<string, string> {
  const seed = getStableHash(`${accountEmail ?? 'default'}:${labels.map((label) => label.id).join('|')}`)
  const colors = [...labelPalette]

  for (let index = colors.length - 1; index > 0; index--) {
    const swapIndex = (seed + index * 17) % (index + 1)
    const current = colors[index]
    colors[index] = colors[swapIndex]
    colors[swapIndex] = current
  }

  return new Map(labels.map((label, index) => [label.id, colors[index % colors.length]]))
}

export function Sidebar({ onSettingsOpen }: SidebarProps) {
  const { account, logout, provider } = useAuth()
  const accountEmail = account?.email
  const { folders, currentFolder, setCurrentFolder } = useEmail()
  const { handleCompose } = useCompose()
  const [gmailLabels, setGmailLabels] = useState<SidebarLabel[]>([])
  const [showLabelForm, setShowLabelForm] = useState(false)
  const [labelName, setLabelName] = useState('')
  const [isCreatingLabel, setIsCreatingLabel] = useState(false)
  const [hidingLabelId, setHidingLabelId] = useState<string | null>(null)
  const [draggingLabelId, setDraggingLabelId] = useState<string | null>(null)
  const [dropIndicator, setDropIndicator] = useState<{ id: string; position: 'before' | 'after' } | null>(null)

  function updateFolderRoute(folderId: string) {
    const url = new URL(window.location.href)
    url.searchParams.set('folder', folderId)
    url.searchParams.delete('email')
    window.history.pushState({ folderId }, '', url.toString())
  }

  const fetchLabels = useCallback(async () => {
    if (provider !== 'gmail') return

    try {
      const [labelsRes, prefsRes] = await Promise.all([
        fetch('/api/gmail/labels', { credentials: 'include' }),
        fetch('/api/preferences/labels', { credentials: 'include' }),
      ])
      if (!labelsRes.ok) {
        const error = await labelsRes.json().catch(() => ({})) as { error?: string; upstreamStatus?: number }
        console.warn('[gmail/labels] failed to load sidebar labels:', error.error ?? labelsRes.statusText, error.upstreamStatus ?? labelsRes.status)
        return
      }
      const data = await labelsRes.json() as {
        labels: Array<{
          id: string
          name: string
          type?: string
          color?: { backgroundColor?: string; textColor?: string }
          messagesUnreadCount?: number
        }>
      }
      const prefs = prefsRes.ok
        ? await prefsRes.json() as { hiddenLabelIds?: string[]; labelOrder?: string[] }
        : { hiddenLabelIds: [], labelOrder: [] }
      const hiddenLabelIds = new Set(prefs.hiddenLabelIds ?? [])
      const systemLabelIds = new Set([
        'INBOX',
        'SENT',
        'DRAFT',
        'TRASH',
        'SPAM',
        'STARRED',
        'UNREAD',
        'IMPORTANT',
        'CHAT',
      ])
      const userLabels = data.labels.filter((label) => !systemLabelIds.has(label.id) && !hiddenLabelIds.has(label.id))
      const fallbackColors = getRandomizedFallbackColors(userLabels, accountEmail)
      const mappedLabels = userLabels.map((label) => ({
        id: label.id,
        name: label.name,
        unreadCount: label.messagesUnreadCount ?? 0,
        color: label.color?.backgroundColor ?? fallbackColors.get(label.id) ?? labelPalette[0],
      }))
      setGmailLabels(applyLabelOrder(mappedLabels, prefs.labelOrder ?? []))
    } catch {
      // non-fatal
    }
  }, [provider, accountEmail])

  useEffect(() => {
    const fetchTimer = setTimeout(() => {
      void fetchLabels()
    }, 0)

    return () => clearTimeout(fetchTimer)
  }, [fetchLabels])

  const handleCreateLabel = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextName = labelName.trim()
    if (!nextName) return

    setIsCreatingLabel(true)
    try {
      const res = await fetch('/api/gmail/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: nextName }),
      })
      if (!res.ok) {
        const error = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(error.error ?? 'Failed to create label')
      }
      setLabelName('')
      setShowLabelForm(false)
      await fetchLabels()
      toast.success('Label added')
    } catch (error) {
      toast.error('Label create failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setIsCreatingLabel(false)
    }
  }

  const handleHideLabel = async (label: SidebarLabel) => {
    setHidingLabelId(label.id)
    try {
      const res = await fetch('/api/preferences/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ labelId: label.id }),
      })
      if (!res.ok) {
        const error = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(error.error ?? 'Failed to hide label')
      }
      if (currentFolder.id === label.id) {
        startTransition(() => {
          setCurrentFolder({ id: 'INBOX', name: 'Inbox', icon: 'inbox', unreadCount: 0 })
        })
      }
      setGmailLabels((prev) => prev.filter((item) => item.id !== label.id))
      toast.success('Label hidden')
    } catch (error) {
      toast.error('Label hide failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setHidingLabelId(null)
    }
  }

  const persistLabelOrder = async (labels: Array<{ id: string }>) => {
    try {
      await fetch('/api/preferences/labels', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ labelOrder: labels.map((label) => label.id) }),
      })
    } catch {
      // Ordering is best-effort; current UI order still updates optimistically.
    }
  }

  const moveLabel = (draggedId: string, targetId: string, position: 'before' | 'after') => {
    if (draggedId === targetId) return

    setGmailLabels((prev) => {
      const fromIndex = prev.findIndex((label) => label.id === draggedId)
      const toIndex = prev.findIndex((label) => label.id === targetId)
      if (fromIndex < 0 || toIndex < 0) return prev

      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      const targetIndexAfterRemoval = next.findIndex((label) => label.id === targetId)
      const insertIndex = position === 'after' ? targetIndexAfterRemoval + 1 : targetIndexAfterRemoval
      next.splice(insertIndex, 0, moved)
      void persistLabelOrder(next)
      return next
    })
  }

  const getDropPosition = (event: React.DragEvent<HTMLElement>): 'before' | 'after' => {
    const rect = event.currentTarget.getBoundingClientRect()
    return event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
  }

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
        {provider === 'smtp_imap' && (
          <div className="px-4 py-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
              Folders
            </span>
          </div>
        )}
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
                    updateFolderRoute(folder.id)
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
        {provider === 'gmail' && (
          <div className="pb-2">
            <div className="px-4 py-2">
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Tag className="w-3 h-3 text-[var(--muted-foreground)]" />
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                    Labels
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLabelForm((value) => !value)}
                  className="h-5 w-5 rounded-sm flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--sidebar-foreground)] hover:bg-[var(--surface-elevated)] transition-colors"
                  aria-label="Add label"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            {showLabelForm && (
              <form onSubmit={handleCreateLabel} className="px-2 pb-2 flex items-center gap-1.5">
                <Input
                  value={labelName}
                  onChange={(event) => setLabelName(event.target.value)}
                  placeholder="New label"
                  className="h-7 rounded-sm font-mono text-[11px]"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={isCreatingLabel || !labelName.trim()}
                  className="h-7 w-7 rounded-sm flex items-center justify-center bg-[var(--surface-elevated)] text-[var(--sidebar-foreground)] disabled:opacity-50"
                  aria-label="Create label"
                >
                  {isCreatingLabel ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                </button>
              </form>
            )}

            <nav className="flex flex-col gap-0.5 px-2 pb-2">
              {gmailLabels.map((label) => {
                const isActive = currentFolder.id === label.id
                const activeClass = isActive
                  ? 'bg-[var(--surface-elevated)] text-[var(--sidebar-primary)]'
                  : 'text-[var(--muted-foreground)] hover:bg-[var(--surface-elevated)] hover:text-[var(--sidebar-foreground)]'
                return (
                  <div
                    key={label.id}
                    draggable
                    onDragStart={(event) => {
                      setDraggingLabelId(label.id)
                      setDropIndicator(null)
                      event.dataTransfer.effectAllowed = 'move'
                      event.dataTransfer.setData('text/plain', label.id)
                    }}
                    onDragOver={(event) => {
                      event.preventDefault()
                      event.dataTransfer.dropEffect = 'move'
                      if (draggingLabelId && draggingLabelId !== label.id) {
                        setDropIndicator({ id: label.id, position: getDropPosition(event) })
                      }
                    }}
                    onDrop={(event) => {
                      event.preventDefault()
                      const draggedId = event.dataTransfer.getData('text/plain') || draggingLabelId
                      const position = dropIndicator?.id === label.id
                        ? dropIndicator.position
                        : getDropPosition(event)
                      if (draggedId) moveLabel(draggedId, label.id, position)
                      setDraggingLabelId(null)
                      setDropIndicator(null)
                    }}
                    onDragLeave={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                        setDropIndicator((current) => current?.id === label.id ? null : current)
                      }
                    }}
                    onDragEnd={() => {
                      setDraggingLabelId(null)
                      setDropIndicator(null)
                    }}
                    className={`group relative w-full flex items-center justify-between rounded-sm transition-colors font-mono ${activeClass} ${draggingLabelId === label.id ? 'opacity-50' : ''}`}
                  >
                    {dropIndicator?.id === label.id && dropIndicator.position === 'before' && (
                      <span className="absolute left-2 right-2 top-0 h-0.5 -translate-y-1 rounded-full bg-[var(--accent)]" />
                    )}
                    {dropIndicator?.id === label.id && dropIndicator.position === 'after' && (
                      <span className="absolute left-2 right-2 bottom-0 h-0.5 translate-y-1 rounded-full bg-[var(--accent)]" />
                    )}
                    <span
                      className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full opacity-80"
                      style={{ backgroundColor: label.color }}
                      aria-hidden="true"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        startTransition(() => {
                          setCurrentFolder({ id: label.id, name: label.name, icon: 'tag', unreadCount: label.unreadCount })
                          updateFolderRoute(label.id)
                        })
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-[12px]"
                    >
                      <Tag className="w-3 h-3 shrink-0" style={{ color: label.color }} />
                      <span className="truncate">{label.name}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void handleHideLabel(label)
                      }}
                      disabled={hidingLabelId === label.id}
                      className="mr-1 h-5 w-5 rounded-sm hidden group-hover:flex items-center justify-center text-[var(--muted-foreground)] hover:text-destructive disabled:opacity-50"
                      aria-label={`Hide ${label.name}`}
                    >
                      {hidingLabelId === label.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    </button>
                    {label.unreadCount > 0 && hidingLabelId !== label.id && (
                      <Badge
                        variant={isActive ? 'default' : 'secondary'}
                        className="font-mono text-[10px] h-4 min-w-4 px-1 shrink-0 group-hover:hidden"
                      >
                        {label.unreadCount}
                      </Badge>
                    )}
                  </div>
                )
              })}
            </nav>
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
