'use client'

import { startTransition } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useEmail } from '@/contexts/email-context'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
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
} from 'lucide-react'

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  inbox: Inbox,
  spam: ShieldAlert,
  send: Send,
  file: File,
  trash: Trash2,
}

interface SidebarProps {
  onCompose: () => void
}

export function Sidebar({ onCompose }: SidebarProps) {
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

  return (
    <aside className="w-[180px] h-full flex flex-col border-r border-border bg-surface">
      {/* Logo */}
      <div className="p-4 border-b border-border">
        <h1 className="font-mono text-lg font-bold tracking-tight">
          <span className="text-accent">mailie</span>
          <span className="text-muted-foreground">_</span>
        </h1>
      </div>

      {/* Compose Button */}
      <div className="p-3">
        <Button
          onClick={onCompose}
          className="w-full font-mono text-sm bg-accent text-background hover:bg-accent/90"
        >
          <PenSquare className="w-4 h-4 mr-2" />
          Compose
        </Button>
      </div>

      {/* Folders */}
      <ScrollArea className="flex-1">
        <nav className="p-2 space-y-1">
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
                  w-full flex items-center justify-between px-3 py-2
                  font-mono text-sm rounded-sm transition-colors
                  ${isActive
                    ? 'bg-accent/10 text-accent border-l-2 border-accent'
                    : 'text-muted-foreground hover:bg-surface-elevated hover:text-foreground'
                  }
                `}
              >
                <div className="flex items-center gap-2">
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
      </ScrollArea>

      {/* Account */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-sm bg-accent/20 flex items-center justify-center">
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
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Settings className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleLogout}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </aside>
  )
}
