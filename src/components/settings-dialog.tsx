'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useTheme } from '@/contexts/theme-context'
import { useAuth } from '@/contexts/auth-context'
import { useSignature } from '@/components/signature-templates'
import { Sun, Moon, Wifi, Shield, Info, Mail, Database, Server, User } from 'lucide-react'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const LOCAL_DATA_KEYS = [
  'mailie_drafts',
  'mailie_contacts',
  'mailie_contacts_last_sync',
  'mailie_signature',
  'mailie_templates',
]

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
    <div className="grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2 px-1 py-3 lg:grid-cols-[2rem_minmax(18rem,1fr)_auto]">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-[var(--secondary)]">
        <Icon className="h-4 w-4 text-[var(--muted-foreground)]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="break-words font-mono text-[13px] text-[var(--foreground)]">{label}</p>
        {description && (
          <p className="mt-0.5 break-words font-mono text-[11px] leading-relaxed text-[var(--muted-foreground)]">
            {description}
          </p>
        )}
      </div>
      {right && <div className="col-start-2 shrink-0 pt-0.5 lg:col-start-auto">{right}</div>}
    </div>
  )
}

function ThemeSelector() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex gap-1 rounded-sm bg-[var(--secondary)] p-1">
      {[
        { value: 'light' as const, label: 'Light', icon: Sun },
        { value: 'dark' as const, label: 'Dark', icon: Moon },
      ].map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          className={`
            flex min-w-24 items-center justify-center gap-1.5 rounded-sm px-2 py-1.5 font-mono text-[12px]
            transition-colors
            ${theme === value
              ? 'bg-[var(--background)] text-[var(--foreground)] shadow-sm'
              : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }
          `}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-1 pb-2 pt-4 font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
      {children}
    </p>
  )
}

function getLocalDataSize() {
  if (typeof window === 'undefined') return 0
  return LOCAL_DATA_KEYS.reduce((total, key) => total + (localStorage.getItem(key)?.length ?? 0), 0)
}

function formatBytes(chars: number) {
  const bytes = chars * 2
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { user, account, accounts } = useAuth()
  const { signature, setSignature, templates } = useSignature()
  const [signatureDraft, setSignatureDraft] = useState('')
  const [localDataSize, setLocalDataSize] = useState(0)
  const [status, setStatus] = useState('')

  const providerLabel = account?.provider === 'gmail' ? 'Gmail OAuth' : 'SMTP/IMAP'
  const capabilityText = useMemo(() => {
    if (!account) return 'No active mailbox'
    const caps = [
      account.capabilities.smtp ? 'SMTP' : null,
      account.capabilities.imap ? 'IMAP' : null,
      account.provider === 'gmail' ? 'Gmail API' : null,
    ].filter(Boolean)
    return caps.join(' / ')
  }, [account])

  useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => {
      setSignatureDraft(signature)
      setLocalDataSize(getLocalDataSize())
      setStatus('')
    })
    return () => window.cancelAnimationFrame(frame)
  }, [open, signature])

  function saveSignatureDraft() {
    setSignature(signatureDraft)
    setStatus('Signature saved')
  }

  function clearLocalData() {
    LOCAL_DATA_KEYS.forEach((key) => localStorage.removeItem(key))
    setSignatureDraft('')
    setLocalDataSize(0)
    setStatus('Local drafts, contacts, signature, and templates cleared')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] w-[min(96vw,920px)] max-w-none overflow-x-hidden overflow-y-auto border-[var(--border)] bg-[var(--popover)] p-6 sm:max-w-[920px] sm:p-8">
        <DialogHeader>
          <DialogTitle className="font-mono text-[14px] text-[var(--foreground)]">Settings</DialogTitle>
          <DialogDescription className="font-mono text-[11px] text-[var(--muted-foreground)]">
            Account, mailbox, compose, and local data controls.
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

          <SectionHeader>Master account</SectionHeader>
          <SettingRow
            icon={User}
            label={user?.username ?? 'Not signed in'}
            description={user?.phone ? `Phone ${user.phone}` : 'Master user session'}
            right={<Badge variant="outline" className="font-mono text-[10px]">User</Badge>}
          />

          <SectionHeader>Mailbox</SectionHeader>
          <SettingRow
            icon={account?.provider === 'gmail' ? Mail : Server}
            label={account?.email ?? 'No active mailbox'}
            description={account ? providerLabel : 'Switch mailbox to select one'}
            right={<span className="font-mono text-[11px] text-[var(--status-active)]">Active</span>}
          />
          <SettingRow
            icon={Wifi}
            label="Capabilities"
            description={capabilityText}
            right={<Badge variant="outline" className="font-mono text-[10px]">{accounts.length} saved</Badge>}
          />

          <SectionHeader>Security</SectionHeader>
          <SettingRow
            icon={Shield}
            label="Stored credentials"
            description="Gmail tokens and SMTP/IMAP passwords are encrypted at rest"
            right={<Badge variant="outline" className="font-mono text-[10px]">AES-256-GCM</Badge>}
          />
          <p className="px-1 pb-2 font-mono text-[11px] leading-relaxed text-[var(--muted-foreground)]">
            Master password stored as salted scrypt hash. Raw mailbox secrets never return to browser.
          </p>

          <SectionHeader>Compose</SectionHeader>
          <div className="space-y-2 px-1">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-start">
              <div>
                <p className="font-mono text-[13px] text-[var(--foreground)]">Default signature</p>
                <p className="mt-0.5 font-mono text-[11px] text-[var(--muted-foreground)]">
                  Appended to new composed mail.
                </p>
              </div>
              <Badge variant="outline" className="font-mono text-[10px]">
                {templates.length} templates
              </Badge>
            </div>
            <Textarea
              value={signatureDraft}
              onChange={(event) => setSignatureDraft(event.target.value)}
              placeholder="Best regards,"
              className="min-h-24 font-mono text-[12px]"
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={saveSignatureDraft} className="h-8 font-mono text-[12px]">
                Save signature
              </Button>
            </div>
          </div>

          <SectionHeader>Local data</SectionHeader>
          <SettingRow
            icon={Database}
            label="Browser storage"
            description="Drafts, contacts, signature, and templates on this device"
            right={<span className="font-mono text-[11px] text-[var(--muted-foreground)]">{formatBytes(localDataSize)}</span>}
          />
          <div className="px-1">
            <Button
              variant="outline"
              size="sm"
              onClick={clearLocalData}
              className="h-8 w-full font-mono text-[12px]"
            >
              Clear local compose data
            </Button>
          </div>

          <Separator className="my-4" />

          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
              <Info className="h-4 w-4" />
              <span className="font-mono text-[11px]">mailie_ v0.1</span>
            </div>
            {status && <span className="font-mono text-[11px] text-[var(--status-active)]">{status}</span>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
