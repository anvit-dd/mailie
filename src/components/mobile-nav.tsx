'use client'

import { startTransition } from 'react'
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
} from 'lucide-react'

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  inbox: Inbox,
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
  }

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" className="md:hidden h-9 w-9 shrink-0">
            <Menu className="w-5 h-5" />
          </Button>
        }
      />
      <SheetContent side="left" className="w-[260px] p-0 flex flex-col">
        {/* Logo */}
        <div className="p-4 border-b border-border">
          <h1 className="font-mono text-lg font-bold tracking-tight">
            <span className="text-accent">mailie</span>
            <span className="text-muted-foreground">_</span>
          </h1>
        </div>

        {/* Compose */}
        <div className="p-3">
          <Button
            onClick={() => {
              onCompose()
              // Sheet auto-closes on most platforms
            }}
            className="w-full font-mono text-sm bg-accent text-background hover:bg-accent/90"
          >
            <PenSquare className="w-4 h-4 mr-2" />
            Compose
          </Button>
        </div>

        {/* Folders */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {folders.map((folder) => {
            const Icon = iconMap[folder.icon] || Inbox
            const isActive = currentFolder.id === folder.id

            return (
              <button
                key={folder.id}
                onClick={() => handleFolderSelect(folder)}
                className={`
                  w-full flex items-center justify-between px-3 py-2.5
                  font-mono text-sm rounded-sm transition-colors
                  ${isActive
                    ? 'bg-accent/10 text-accent'
                    : 'text-muted-foreground hover:bg-surface-elevated hover:text-foreground'
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4" />
                  <span>{folder.name}</span>
                </div>
                {folder.unreadCount > 0 && (
                  <Badge
                    variant={isActive ? 'default' : 'secondary'}
                    className="font-mono text-xs h-5 min-w-5 px-1.5"
                  >
                    {folder.unreadCount}
                  </Badge>
                )}
              </button>
            )
          })}
        </nav>

        {/* Account */}
        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-sm bg-accent/20 flex items-center justify-center shrink-0">
              <span className="font-mono text-xs text-accent">
                {account?.name?.charAt(0).toUpperCase() || 'D'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-mono text-xs truncate">{account?.name || 'Demo User'}</p>
              <p className="font-mono text-[10px] text-muted-foreground truncate">
                {account?.email || 'demo@mailie.dev'}
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onSettingsOpen}>
              <Settings className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
