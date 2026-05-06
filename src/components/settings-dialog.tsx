'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog'
import { useTheme } from '@/contexts/theme-context'
import { Button } from '@/components/ui/button'
import { Sun, Moon, Monitor, ChevronRight, Wifi, Shield, Bell, Info } from 'lucide-react'

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
      <div className="w-8 h-8 rounded-sm bg-secondary flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {right}
    </div>
  )
}

function ThemeSelector() {
  const { theme, setTheme } = useTheme()

  const options = [
    { value: 'light' as const, label: 'Light', icon: Sun },
    { value: 'dark' as const, label: 'Dark', icon: Moon },
    { value: 'dark' as const, label: 'System', icon: Monitor },
  ]

  return (
    <div className="flex gap-1 p-1 bg-secondary rounded-md">
      {[
        { value: 'light' as const, label: 'Light', icon: Sun },
        { value: 'dark' as const, label: 'Dark', icon: Moon },
      ].map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={`
            flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-sm text-xs font-mono
            transition-colors cursor-pointer
            ${theme === value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
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
    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground px-1 pt-4 pb-2">
      {children}
    </p>
  )
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-mono text-base">Settings</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            Customize your mailie experience.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <SectionHeader>Appearance</SectionHeader>
          <SettingRow
            icon={theme => <Moon {...theme} />}
            label="Theme"
            description="Switch between light and dark mode"
            right={<ThemeSelector />}
          />

          <SectionHeader>Account</SectionHeader>
          <SettingRow
            icon={Wifi}
            label="Connected"
            description="Gmail via OAuth"
            right={<span className="text-xs font-mono text-green-500">Active</span>}
          />

          <SettingRow
            icon={Shield}
            label="Security"
            description="End-to-end encryption"
            right={
              <span className="text-xs font-mono text-muted-foreground">Coming soon</span>
            }
          />

          <SectionHeader>Notifications</SectionHeader>
          <SettingRow
            icon={Bell}
            label="Push notifications"
            description="Get notified for new emails"
            right={
              <span className="text-xs font-mono text-muted-foreground">Coming soon</span>
            }
          />

          <SectionHeader>About</SectionHeader>
          <SettingRow
            icon={Info}
            label="mailie_"
            description="Minimal email client"
            right={<span className="text-xs font-mono text-muted-foreground">v0.1</span>}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
