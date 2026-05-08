'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useTheme } from '@/contexts/theme-context'
import { Button } from '@/components/ui/button'
import { Sun, Moon, Wifi, Shield, Bell, Info } from 'lucide-react'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function SettingRow({
  icon: Icon,
  label,
  description,
  right,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  description?: string
  right?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 py-3 px-1">
      <div className="w-8 h-8 rounded-sm bg-[var(--secondary)] flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-[var(--muted-foreground)]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-[var(--foreground)]">{label}</p>
        {description && (
          <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">{description}</p>
        )}
      </div>
      {right}
    </div>
  )
}

function ThemeSelector() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex gap-1 p-1 bg-[var(--secondary)] rounded-sm">
      {[
        { value: 'light' as const, label: 'Light', icon: Sun },
        { value: 'dark' as const, label: 'Dark', icon: Moon },
      ].map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={`
            flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-sm text-[12px] font-mono
            transition-colors cursor-pointer
            ${theme === value
              ? 'bg-[var(--background)] text-[var(--foreground)] shadow-sm'
              : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }
          `}
        >
          <Icon className="w-3.5 h-3.5" />
          {label}
        </button>
      ))}
    </div>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted-foreground)] px-1 pt-4 pb-2">
      {children}
    </p>
  )
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm bg-[var(--popover)] border-[var(--border)]">
        <DialogHeader>
          <DialogTitle className="font-mono text-[14px] text-[var(--foreground)]">Settings</DialogTitle>
          <DialogDescription className="font-mono text-[11px] text-[var(--muted-foreground)]">
            Customize your mailie experience.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <SectionHeader>Appearance</SectionHeader>
          <SettingRow
            icon={Moon}
            label="Theme"
            description="Switch between light and dark mode"
            right={<ThemeSelector />}
          />

          <SectionHeader>Account</SectionHeader>
          <SettingRow
            icon={Wifi}
            label="Connected"
            description="Gmail via OAuth"
            right={<span className="text-[11px] font-mono text-[var(--status-active)]">Active</span>}
          />

          <SettingRow
            icon={Shield}
            label="Security"
            description="End-to-end encryption"
            right={
              <span className="text-[11px] font-mono text-[var(--muted-foreground)]">Coming soon</span>
            }
          />

          <SectionHeader>Notifications</SectionHeader>
          <SettingRow
            icon={Bell}
            label="Push notifications"
            description="Get notified for new emails"
            right={
              <span className="text-[11px] font-mono text-[var(--muted-foreground)]">Coming soon</span>
            }
          />

          <SectionHeader>About</SectionHeader>
          <SettingRow
            icon={Info}
            label="mailie_"
            description="Minimal email client"
            right={<span className="text-[11px] font-mono text-[var(--muted-foreground)]">v0.1</span>}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
