'use client'

import { startTransition, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useEmail } from '@/contexts/email-context'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
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
  Menu,
  Star,
  X,
} from 'lucide-react'

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  inbox: Inbox,
  star: Star,
  spam: ShieldAlert,
  send: Send,
  file: File,
  trash: Trash2,
}

interface MobileNavProps {
  onCompose: () => void
  onSettingsOpen: () => void
}

export function MobileNav({ onCompose, onSettingsOpen }: MobileNavProps) {
  const { account, logout } = useAuth()
  const { folders, currentFolder, setCurrentFolder } = useEmail()
  const [open, setOpen] = useState(false)

  const handleLogout = async () => {
    try {
      await logout()
      toast.success('Signed out', { description: 'See you next time 👋' })
    } catch {
      toast.error('Logout failed')
    }
  }

  const handleFolderSelect = (folder: typeof currentFolder) => {
    startTransition(() => {
      setCurrentFolder(folder)
    })
    setOpen(false)
  }

  const handleCompose = () => {
    onCompose()
    setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <button
            type="button"
            className="md:hidden inline-flex items-center justify-center rounded-lg cursor-pointer h-9 w-9 shrink-0 text-[var(--foreground)] hover:bg-[var(--surface-elevated)] transition-colors"
          />
        }
      >
        <Menu className="w-5 h-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-[260px] p-0 flex flex-col bg-[var(--sidebar)] border-[var(--border)]">
        {/* Header with logo + close */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--sidebar-border)]">
          <div className="flex items-center gap-2">
            {/* Zed purple logo mark */}
            <div className="w-7 h-7 flex items-center justify-center">
              <span className="font-mono text-base font-bold text-[var(--brand)] select-none">m</span>
            </div>
            <span className="font-mono text-sm font-bold text-[var(--sidebar-foreground)]">
              mailie
              <span className="text-[var(--muted-foreground)]">_</span>
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-[var(--muted-foreground)] hover:text-[var(--sidebar-foreground)]"
            onClick={() => setOpen(false)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Compose */}
        <div className="p-3">
          <Button
            onClick={handleCompose}
            className="w-full font-mono text-[13px] bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 h-9"
          >
            <PenSquare className="w-4 h-4 mr-2" />
            Compose
          </Button>
        </div>

        {/* Folders */}
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2">
          {folders.map((folder) => {
            const Icon = iconMap[folder.icon] || Inbox
            const isActive = currentFolder.id === folder.id

            return (
              <button
                key={folder.id}
                onClick={() => handleFolderSelect(folder)}
                className={`
                  w-full flex items-center justify-between px-2 py-1.5
                  font-mono text-[13px] rounded-sm transition-colors
                  ${isActive
                    ? 'bg-[var(--surface-elevated)] text-[var(--sidebar-primary)] border-l-2 border-l-[var(--sidebar-primary)]'
                    : 'text-[var(--muted-foreground)] hover:bg-[var(--surface-elevated)] hover:text-[var(--sidebar-foreground)] border-l-2 border-l-transparent'
                  }
                `}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="w-4 h-4 shrink-0" />
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

        {/* Account */}
        <div className="p-3 border-t border-[var(--sidebar-border)]">
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="w-7 h-7 rounded-full bg-[var(--surface-elevated)] flex items-center justify-center shrink-0">
              <span className="font-mono text-[10px] text-[var(--sidebar-primary)] font-semibold">
                {account?.name?.charAt(0).toUpperCase() || 'D'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-mono text-[12px] truncate text-[var(--sidebar-foreground)]">
                {account?.name || 'Demo User'}
              </p>
              <p className="font-mono text-[10px] truncate text-[var(--muted-foreground)]">
                {account?.email || 'demo@mailie.dev'}
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-[var(--muted-foreground)] hover:text-[var(--sidebar-foreground)]"
              onClick={() => { onSettingsOpen(); setOpen(false) }}
            >
              <Settings className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-[var(--muted-foreground)] hover:text-[var(--sidebar-foreground)]"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
