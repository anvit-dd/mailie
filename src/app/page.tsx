'use client'

import { startTransition, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useCompose } from '@/contexts/compose-context'
import { useEmail } from '@/contexts/email-context'
import { useMailKeyboardShortcuts } from '@/hooks/use-mail-keyboard-shortcuts'
import { Sidebar } from '@/components/sidebar'
import { MobileNav } from '@/components/mobile-nav'
import { EmailList } from '@/components/email-list'
import { MessageView } from '@/components/message-view'
import { MobileEmailView } from '@/components/mobile-email-view'
import { SettingsDialog } from '@/components/settings-dialog'
import { ComposePanel } from '@/components/compose-panel'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  PopoverRoot,
  PopoverTrigger,
  PopoverPortal,
  PopoverPositioner,
  PopoverContent,
} from '@/components/ui/popover'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { ArrowLeft, ChevronDown, Loader2, PenSquare, Mail, Server, Plus, Trash2 } from 'lucide-react'
import { getCountries, getCountryCallingCode } from 'libphonenumber-js'
import type { CountryCode } from 'libphonenumber-js'

const DEFAULT_LIST_WIDTH = 320
const MIN_LIST_WIDTH = 200
const MAX_LIST_WIDTH = 600

const SYSTEM_FOLDER_IDS = new Set(['INBOX', 'SENT', 'DRAFT', 'TRASH', 'SPAM', 'STARRED'])

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })

const COUNTRY_CODES = getCountries()
  .map((country) => ({
    value: country,
    label: regionNames.of(country) ?? country,
    code: `+${getCountryCallingCode(country)}`,
  }))
  .sort((a, b) => a.label.localeCompare(b.label))

function CountryCodeCombobox({
  value,
  onChange,
}: {
  value: CountryCode
  onChange: (value: CountryCode) => void
}) {
  const [open, setOpen] = useState(false)
  const selectedCountry = COUNTRY_CODES.find((country) => country.value === value) ?? COUNTRY_CODES[0]

  return (
    <PopoverRoot open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className="h-9 justify-between gap-2 px-3 font-mono text-[12px]"
          />
        }
      >
        <span className="truncate">
          {selectedCountry.code} {selectedCountry.label}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" />
      </PopoverTrigger>
      <PopoverPortal>
        <PopoverPositioner align="start" side="bottom" sideOffset={4} className="w-[280px]">
          <PopoverContent className="p-0">
            <Command>
              <CommandInput placeholder="Search country..." className="font-mono text-[12px]" />
              <CommandList>
                <CommandEmpty className="font-mono text-[12px]">No country found.</CommandEmpty>
                <CommandGroup>
                  {COUNTRY_CODES.map((country) => (
                    <CommandItem
                      key={country.value}
                      value={`${country.label} ${country.code} ${country.value}`}
                      data-checked={country.value === value}
                      className="font-mono text-[12px]"
                      onSelect={() => {
                        onChange(country.value)
                        setOpen(false)
                      }}
                    >
                      <span className="w-12 shrink-0 text-[var(--muted-foreground)]">{country.code}</span>
                      <span className="truncate">{country.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </PopoverPositioner>
      </PopoverPortal>
    </PopoverRoot>
  )
}

type ProviderPreset =
  | 'gmail'
  | 'outlook'
  | 'yahoo'
  | 'icloud'
  | 'fastmail'
  | 'zoho'
  | 'aol'
  | 'gmx'
  | 'proton'
  | 'custom'

interface SmtpImapForm {
  email: string
  displayName: string
  useSmtp: boolean
  smtpHost: string
  smtpPort: string
  smtpSecure: boolean
  smtpUsername: string
  smtpPassword: string
  useImap: boolean
  imapHost: string
  imapPort: string
  imapSecure: boolean
  imapUsername: string
  imapPassword: string
}

const PRESETS: Record<ProviderPreset, Partial<SmtpImapForm>> = {
  gmail: {
    smtpHost: 'smtp.gmail.com',
    smtpPort: '465',
    smtpSecure: true,
    imapHost: 'imap.gmail.com',
    imapPort: '993',
    imapSecure: true,
  },
  outlook: {
    smtpHost: 'smtp.office365.com',
    smtpPort: '587',
    smtpSecure: false,
    imapHost: 'outlook.office365.com',
    imapPort: '993',
    imapSecure: true,
  },
  yahoo: {
    smtpHost: 'smtp.mail.yahoo.com',
    smtpPort: '465',
    smtpSecure: true,
    imapHost: 'imap.mail.yahoo.com',
    imapPort: '993',
    imapSecure: true,
  },
  icloud: {
    smtpHost: 'smtp.mail.me.com',
    smtpPort: '587',
    smtpSecure: false,
    imapHost: 'imap.mail.me.com',
    imapPort: '993',
    imapSecure: true,
  },
  fastmail: {
    smtpHost: 'smtp.fastmail.com',
    smtpPort: '465',
    smtpSecure: true,
    imapHost: 'imap.fastmail.com',
    imapPort: '993',
    imapSecure: true,
  },
  zoho: {
    smtpHost: 'smtp.zoho.com',
    smtpPort: '465',
    smtpSecure: true,
    imapHost: 'imap.zoho.com',
    imapPort: '993',
    imapSecure: true,
  },
  aol: {
    smtpHost: 'smtp.aol.com',
    smtpPort: '465',
    smtpSecure: true,
    imapHost: 'imap.aol.com',
    imapPort: '993',
    imapSecure: true,
  },
  gmx: {
    smtpHost: 'mail.gmx.com',
    smtpPort: '465',
    smtpSecure: true,
    imapHost: 'imap.gmx.com',
    imapPort: '993',
    imapSecure: true,
  },
  proton: {
    smtpHost: '127.0.0.1',
    smtpPort: '1025',
    smtpSecure: false,
    imapHost: '127.0.0.1',
    imapPort: '1143',
    imapSecure: false,
  },
  custom: {},
}

// ─────────────────────────────────────────────────────────
// Auth Screen
// ─────────────────────────────────────────────────────────
function MasterAuthScreen() {
  const { login, register } = useAuth()
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [registerUsername, setRegisterUsername] = useState('')
  const [registerCountryCode, setRegisterCountryCode] = useState<CountryCode>('US')
  const [registerPhone, setRegisterPhone] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin() {
    setIsSubmitting(true)
    setError('')
    try {
      const result = await login(loginUsername, loginPassword)
      if (!result.ok) setError(result.error ?? 'Login failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleRegister() {
    setIsSubmitting(true)
    setError('')
    try {
      if (registerPassword !== registerPasswordConfirm) {
        setError('Passwords do not match')
        return
      }

      const phone = registerPhone.trim().startsWith('+')
        ? registerPhone.trim()
        : `+${getCountryCallingCode(registerCountryCode)} ${registerPhone.trim()}`
      const result = await register(registerUsername, registerPassword, phone)
      if (!result.ok) setError(result.error ?? 'Registration failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="h-screen overflow-y-auto bg-[var(--background)]">
      <div className="flex min-h-screen items-start justify-center px-4 py-6 sm:items-center sm:px-6 sm:py-12">
        <div className="w-full max-w-md text-center">
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 border border-[var(--border)] mb-4">
              <span className="font-mono text-2xl font-bold text-[var(--brand)]">m</span>
            </div>
            <h1 className="text-4xl font-mono font-bold mb-2 tracking-tight text-[var(--foreground)]">
              mailie<span className="text-[var(--muted-foreground)]">_</span>
            </h1>
            <p className="font-mono text-[13px] text-[var(--muted-foreground)]">
              Master account
            </p>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="w-full mb-6">
              <TabsTrigger value="login" className="flex-1">Login</TabsTrigger>
              <TabsTrigger value="register" className="flex-1">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <div className="space-y-3 text-left">
                <Input value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} placeholder="username" className="font-mono text-[13px] h-9" />
                <Input value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} type="password" placeholder="password" className="font-mono text-[13px] h-9" />
                <Button onClick={handleLogin} disabled={isSubmitting || !loginUsername || !loginPassword} className="w-full font-mono text-[13px] h-10">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Login
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="register">
              <div className="space-y-3 text-left">
                <Input value={registerUsername} onChange={(e) => setRegisterUsername(e.target.value)} placeholder="username" className="font-mono text-[13px] h-9" />
                <div className="grid grid-cols-[minmax(170px,210px)_1fr] gap-2">
                  <CountryCodeCombobox
                    value={registerCountryCode}
                    onChange={setRegisterCountryCode}
                  />
                  <Input value={registerPhone} onChange={(e) => setRegisterPhone(e.target.value)} placeholder="phone number" className="font-mono text-[13px] h-9" />
                </div>
                <Input value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} type="password" placeholder="password" className="font-mono text-[13px] h-9" />
                <Input value={registerPasswordConfirm} onChange={(e) => setRegisterPasswordConfirm(e.target.value)} type="password" placeholder="re-enter password" className="font-mono text-[13px] h-9" />
                <Button onClick={handleRegister} disabled={isSubmitting || !registerUsername || !registerPhone || !registerPassword || !registerPasswordConfirm} className="w-full font-mono text-[13px] h-10">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Create account
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          {error && <p className="mt-4 font-mono text-[12px] text-[var(--destructive)]">{error}</p>}
        </div>
      </div>
    </div>
  )
}

function MailboxChooser({
  onConnectSmtp,
  onSelected,
}: {
  onConnectSmtp: () => void
  onSelected?: () => void
}) {
  const { accounts, connectGmail, selectAccount, logout, user, refreshAuth } = useAuth()
  const [error, setError] = useState('')
  const [selectingId, setSelectingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const savedGmailAccount = accounts.find((account) => account.provider === 'gmail')

  async function openAccount(accountId: string) {
    setSelectingId(accountId)
    setError('')
    const result = await selectAccount(accountId)
    if (!result.ok) setError(result.error ?? 'Account select failed')
    if (result.ok) onSelected?.()
    setSelectingId(null)
  }

  function handleGmailAction() {
    if (savedGmailAccount) {
      void openAccount(savedGmailAccount.id)
      return
    }
    connectGmail()
  }

  async function deleteSmtpAccount(accountId: string, label: string) {
    const confirmed = window.confirm(`Delete SMTP/IMAP mailbox "${label}"? This removes saved server credentials from this device.`)
    if (!confirmed) return

    setDeletingId(accountId)
    setError('')
    try {
      const res = await fetch('/api/auth/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      })
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Failed to delete mailbox')
        return
      }
      await refreshAuth()
    } catch {
      setError('Network error — failed to delete mailbox')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="h-screen overflow-y-auto bg-[var(--background)]">
      <div className="flex min-h-screen items-start justify-center px-4 py-6 sm:items-center sm:px-6 sm:py-12">
        <div className="w-full max-w-2xl">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 grid h-12 w-12 place-items-center border border-[var(--border)] bg-[var(--card)]">
              <span className="font-mono text-xl font-bold text-[var(--brand)]">m</span>
            </div>
            <h1 className="font-mono text-4xl font-bold leading-none text-[var(--foreground)]">
              mailie<span className="text-[var(--muted-foreground)]">_</span>
            </h1>
            <p className="mt-3 font-mono text-[12px] text-[var(--muted-foreground)]">
              {user?.username ? `Logged in as ${user.username}` : 'Choose mailbox'}
            </p>
          </div>

          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-widest text-[var(--muted-foreground)]">
                Mailboxes
              </p>
              <p className="mt-1 font-mono text-[11px] text-[var(--muted-foreground)]">
                Open saved mailbox or add another connection.
              </p>
            </div>
            <span className="shrink-0 border border-[var(--border)] px-2 py-1 font-mono text-[10px] text-[var(--muted-foreground)]">
              {accounts.length} saved
            </span>
          </div>

          <div className="space-y-2 text-left">
            {accounts.length === 0 && (
              <div className="border border-dashed border-[var(--border)] bg-[var(--card)] p-6 text-center font-mono text-[12px] text-[var(--muted-foreground)]">
                No saved mailboxes yet.
              </div>
            )}
            {accounts.map((account) => (
              <div
                key={account.id}
                className="group grid grid-cols-[auto_1fr_auto] items-center gap-4 border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-[var(--primary)] hover:bg-[var(--surface-elevated)]"
              >
                <div className="grid h-10 w-10 place-items-center border border-[var(--border)] bg-[var(--background)] text-[var(--brand)]">
                  {account.provider === 'gmail' ? <Mail className="h-4 w-4" /> : <Server className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <p className="truncate font-mono text-[15px] font-semibold text-[var(--foreground)]">
                      {account.name || account.email}
                    </p>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                      {account.provider === 'gmail' ? 'Google OAuth' : 'SMTP/IMAP'}
                    </span>
                  </div>
                  <p className="mt-1 truncate font-mono text-[12px] text-[var(--muted-foreground)]">
                    {account.email}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {account.capabilities.smtp && <span className="border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--muted-foreground)]">SMTP</span>}
                    {account.capabilities.imap && <span className="border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--muted-foreground)]">IMAP</span>}
                    {account.provider === 'gmail' && <span className="border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--muted-foreground)]">GMAIL</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {account.provider === 'smtp_imap' && (
                    <Button
                      size="icon-sm"
                      variant="outline"
                      onClick={() => void deleteSmtpAccount(account.id, account.name || account.email)}
                      disabled={deletingId === account.id}
                      className="h-9 w-9 text-[var(--destructive)] hover:text-[var(--destructive)]"
                      aria-label={`Delete ${account.name || account.email}`}
                      title="Delete SMTP/IMAP mailbox"
                    >
                      {deletingId === account.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => void openAccount(account.id)}
                    disabled={selectingId === account.id || deletingId === account.id}
                    className="h-9 min-w-20 font-mono text-[12px]"
                  >
                    {selectingId === account.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Open'}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {error && <p className="mb-3 font-mono text-[12px] text-[var(--destructive)]">{error}</p>}

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Button onClick={handleGmailAction} className="h-11 gap-2 font-mono text-[12px]">
              <Mail className="h-4 w-4" />
              {savedGmailAccount ? 'Open Gmail' : 'Connect Gmail'}
            </Button>
            <Button onClick={onConnectSmtp} variant="outline" className="h-11 gap-2 font-mono text-[12px]">
              <Plus className="h-4 w-4" />
              Add via SMTP/IMAP
            </Button>
          </div>
          <div className="mt-6 flex justify-center">
            <button onClick={() => void logout()} className="font-mono text-[11px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function AuthScreen({
  initialTab,
  isAddingMailbox,
  onBack,
  onGmailLogin,
  smtpForm,
  setSmtpForm,
  selectedPreset,
  onPresetChange,
  onConnect,
  isConnecting,
  connectError,
}: {
  initialTab: 'gmail' | 'smtp'
  isAddingMailbox: boolean
  onBack?: () => void
  onGmailLogin: () => void
  smtpForm: SmtpImapForm
  setSmtpForm: React.Dispatch<React.SetStateAction<SmtpImapForm>>
  selectedPreset: ProviderPreset
  onPresetChange: (p: ProviderPreset) => void
  onConnect: () => void
  isConnecting: boolean
  connectError: string
}) {
  const [showAdvancedMailSettings, setShowAdvancedMailSettings] = useState(false)
  const showServerSettings = showAdvancedMailSettings || selectedPreset === 'custom'

  return (
    <div className="h-screen overflow-y-auto bg-[var(--background)]">
      <div className="flex min-h-screen items-start justify-center px-4 py-6 sm:items-center sm:px-6 sm:py-12">
        <div className="w-full max-w-md text-center">
        {onBack && (
          <div className="mb-4 flex justify-start">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="gap-2 font-mono text-[12px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </div>
        )}

        {/* Logo */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 border border-[var(--border)] mb-4">
            <span className="font-mono text-2xl font-bold text-[var(--brand)]">m</span>
          </div>
          <h1 className="text-4xl font-mono font-bold mb-2 tracking-tight text-[var(--foreground)]">
            mailie<span className="text-[var(--muted-foreground)]">_</span>
          </h1>
          <p className="font-mono text-[13px] text-[var(--muted-foreground)]">
            Minimal email client
          </p>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex-1 h-px bg-[var(--border)]" />
          <span className="font-mono text-[11px] text-[var(--muted-foreground)] uppercase tracking-widest">
            {isAddingMailbox ? 'add mailbox' : 'connect'}
          </span>
          <div className="flex-1 h-px bg-[var(--border)]" />
        </div>

        {/* Auth Tabs */}
        <Tabs defaultValue={initialTab} className="w-full">
          <TabsList className="w-full mb-6">
            <TabsTrigger value="gmail" className="flex-1 gap-2">
              <Mail className="w-3.5 h-3.5" />
              Gmail OAuth
            </TabsTrigger>
            <TabsTrigger value="smtp" className="flex-1 gap-2">
              <Server className="w-3.5 h-3.5" />
              {isAddingMailbox ? 'Add via SMTP/IMAP' : 'SMTP / IMAP'}
            </TabsTrigger>
          </TabsList>

          {/* ── Gmail Tab ── */}
          <TabsContent value="gmail">
            <Button
              onClick={onGmailLogin}
              size="lg"
              className="font-mono text-[13px] w-full bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 h-10"
            >
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Connect Gmail
            </Button>
            <div className="mt-6 flex flex-col gap-1">
              <p className="font-mono text-[10px] text-[var(--muted-foreground)]">
                OAuth2 · no password stored · tokens encrypted
              </p>
              <p className="font-mono text-[10px] text-[var(--muted-foreground)]">
                Sign in with your Google account to continue
              </p>
            </div>
          </TabsContent>

          {/* ── SMTP/IMAP Tab ── */}
          <TabsContent value="smtp">
            <div className="space-y-3 text-left">

              {/* Provider Preset */}
              <div className="space-y-1">
                <label className="font-mono text-[11px] text-[var(--muted-foreground)] uppercase tracking-widest">
                  Provider
                </label>
                <Select
                  value={selectedPreset}
                  onValueChange={(v) => onPresetChange(v as ProviderPreset)}
                >
                  <SelectTrigger className="w-full h-8 font-mono text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gmail">Gmail (App Password)</SelectItem>
                    <SelectItem value="outlook">Outlook / Microsoft 365</SelectItem>
                    <SelectItem value="yahoo">Yahoo</SelectItem>
                    <SelectItem value="icloud">iCloud Mail</SelectItem>
                    <SelectItem value="fastmail">Fastmail</SelectItem>
                    <SelectItem value="zoho">Zoho Mail</SelectItem>
                    <SelectItem value="aol">AOL Mail</SelectItem>
                    <SelectItem value="gmx">GMX Mail</SelectItem>
                    <SelectItem value="proton">Proton Mail Bridge</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="font-mono text-[11px] text-[var(--muted-foreground)] uppercase tracking-widest">
                  Email
                </label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  className="font-mono text-[13px] h-8"
                  value={smtpForm.email}
                  onChange={(e) => setSmtpForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>

              {/* Display Name */}
              <div className="space-y-1">
                <label className="font-mono text-[11px] text-[var(--muted-foreground)] uppercase tracking-widest">
                  Display Name
                </label>
                <Input
                  placeholder="Your Name"
                  className="font-mono text-[13px] h-8"
                  value={smtpForm.displayName}
                  onChange={(e) => setSmtpForm((f) => ({ ...f, displayName: e.target.value }))}
                />
              </div>

              {/* Credentials */}
              <div className="space-y-1">
                <label className="font-mono text-[11px] text-[var(--muted-foreground)] uppercase tracking-widest">
                  Password
                </label>
                <Input
                  type="password"
                  placeholder="Password / app password"
                  className="font-mono text-[13px] h-8"
                  value={smtpForm.smtpPassword}
                  onChange={(e) => {
                    const password = e.target.value
                    setSmtpForm((f) => ({
                      ...f,
                      smtpPassword: password,
                      imapPassword: password,
                    }))
                  }}
                />
                <p className="font-mono text-[10px] text-[var(--muted-foreground)]">
                  Used for both incoming and outgoing mail.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAdvancedMailSettings((value) => !value)}
                className="font-mono text-[11px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
              >
                {showServerSettings ? 'Hide server settings' : 'Advanced server settings'}
              </button>

              {showServerSettings && (
                <div className="space-y-3 rounded-sm border border-[var(--border)] p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center gap-2">
                      <Switch
                        checked={smtpForm.useSmtp}
                        onCheckedChange={(checked) =>
                          setSmtpForm((f) => ({ ...f, useSmtp: checked }))
                        }
                      />
                      <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                        SMTP
                      </span>
                    </label>
                    <label className="flex items-center gap-2">
                      <Switch
                        checked={smtpForm.useImap}
                        onCheckedChange={(checked) =>
                          setSmtpForm((f) => ({ ...f, useImap: checked }))
                        }
                      />
                      <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                        IMAP
                      </span>
                    </label>
                  </div>

                  <div className="space-y-1">
                    <label className="font-mono text-[11px] text-[var(--muted-foreground)] uppercase tracking-widest">
                      Username override
                    </label>
                    <Input
                      placeholder="Defaults to email"
                      className="font-mono text-[13px] h-8"
                      value={smtpForm.smtpUsername}
                      disabled={!smtpForm.useSmtp && !smtpForm.useImap}
                      onChange={(e) => {
                        const username = e.target.value
                        setSmtpForm((f) => ({
                          ...f,
                          smtpUsername: username,
                          imapUsername: username,
                        }))
                      }}
                    />
                  </div>

                  {/* SMTP */}
                  <div className="space-y-1">
                    <label className="font-mono text-[11px] text-[var(--muted-foreground)] uppercase tracking-widest">
                      SMTP
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        placeholder="smtp.example.com"
                        className="col-span-2 font-mono text-[13px] h-8"
                        value={smtpForm.smtpHost}
                        disabled={!smtpForm.useSmtp}
                        onChange={(e) => setSmtpForm((f) => ({ ...f, smtpHost: e.target.value }))}
                      />
                      <Input
                        placeholder="465"
                        type="number"
                        className="font-mono text-[13px] h-8"
                        value={smtpForm.smtpPort}
                        disabled={!smtpForm.useSmtp}
                        onChange={(e) => setSmtpForm((f) => ({ ...f, smtpPort: e.target.value }))}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={smtpForm.smtpSecure}
                        disabled={!smtpForm.useSmtp}
                        onCheckedChange={(checked) =>
                          setSmtpForm((f) => ({ ...f, smtpSecure: checked }))
                        }
                      />
                      <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                        TLS / SSL
                      </span>
                    </div>
                  </div>

                  {/* IMAP */}
                  <div className="space-y-1">
                    <label className="font-mono text-[11px] text-[var(--muted-foreground)] uppercase tracking-widest">
                      IMAP
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        placeholder="imap.example.com"
                        className="col-span-2 font-mono text-[13px] h-8"
                        value={smtpForm.imapHost}
                        disabled={!smtpForm.useImap}
                        onChange={(e) => setSmtpForm((f) => ({ ...f, imapHost: e.target.value }))}
                      />
                      <Input
                        placeholder="993"
                        type="number"
                        className="font-mono text-[13px] h-8"
                        value={smtpForm.imapPort}
                        disabled={!smtpForm.useImap}
                        onChange={(e) => setSmtpForm((f) => ({ ...f, imapPort: e.target.value }))}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={smtpForm.imapSecure}
                        disabled={!smtpForm.useImap}
                        onCheckedChange={(checked) =>
                          setSmtpForm((f) => ({ ...f, imapSecure: checked }))
                        }
                      />
                      <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                        TLS / SSL
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {connectError && (
                <p className="font-mono text-[12px] text-[var(--destructive)]">{connectError}</p>
              )}

              <Button
                onClick={onConnect}
                size="lg"
                disabled={
                  isConnecting ||
                  !smtpForm.email ||
                  !smtpForm.smtpPassword ||
                  (!smtpForm.useSmtp && !smtpForm.useImap)
                }
                className="font-mono text-[13px] w-full bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 h-10 mt-2"
              >
                {isConnecting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {isConnecting ? 'Connecting…' : isAddingMailbox ? 'Add via SMTP/IMAP' : 'Connect Account'}
              </Button>

              <p className="font-mono text-[10px] text-[var(--muted-foreground)] text-center">
                Passwords are encrypted with AES-256-GCM before storage
              </p>
            </div>
          </TabsContent>
        </Tabs>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────────────────
export default function Home() {
  const { isAuthenticated, hasActiveAccount, isLoading, connectGmail, provider, refreshAuth } = useAuth()
  const { handleReply, handleForward, handleCompose } = useCompose()
  const { currentFolder, setCurrentFolder, folders, loadGmailUnreadCounts } = useEmail()
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false)
  // Drag handler — useRef for mutable values so effects can depend on them
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(DEFAULT_LIST_WIDTH)
  const [listWidth, setListWidth] = useState(DEFAULT_LIST_WIDTH)
  const [routeNonce, setRouteNonce] = useState(0)

  // ── Keyboard shortcuts ──────────────────────────────────────────
  useMailKeyboardShortcuts({ onShowShortcutsHelp: () => setShowShortcutsHelp((v) => !v) })

  // ── Drag state refs ────────────────────────────────────────────
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [smtpForm, setSmtpForm] = useState<SmtpImapForm>({
    email: '',
    displayName: '',
    useSmtp: true,
    smtpHost: PRESETS.gmail.smtpHost!,
    smtpPort: PRESETS.gmail.smtpPort!,
    smtpSecure: PRESETS.gmail.smtpSecure!,
    smtpUsername: '',
    smtpPassword: '',
    useImap: true,
    imapHost: PRESETS.gmail.imapHost!,
    imapPort: PRESETS.gmail.imapPort!,
    imapSecure: PRESETS.gmail.imapSecure!,
    imapUsername: '',
    imapPassword: '',
  })
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectError, setConnectError] = useState('')
  const [selectedPreset, setSelectedPreset] = useState<ProviderPreset>('gmail')
  const [showMailboxConnect, setShowMailboxConnect] = useState(false)
  const [showMailboxChooser, setShowMailboxChooser] = useState(false)
  const [connectInitialTab, setConnectInitialTab] = useState<'gmail' | 'smtp'>('gmail')

  function handlePresetChange(preset: ProviderPreset) {
    setSelectedPreset(preset)
    if (preset === 'custom') {
      setSmtpForm((f) => ({
        ...f,
        smtpHost: '',
        smtpPort: '',
        imapHost: '',
        imapPort: '',
      }))
      return
    }

    const p = PRESETS[preset]
    setSmtpForm((f) => ({
      ...f,
      smtpHost: p.smtpHost!,
      smtpPort: p.smtpPort!,
      smtpSecure: p.smtpSecure!,
      imapHost: p.imapHost!,
      imapPort: p.imapPort!,
      imapSecure: p.imapSecure!,
    }))
  }

  async function handleSmtpConnect() {
    setIsConnecting(true)
    setConnectError('')
    const payload = {
      ...smtpForm,
      smtpHost: smtpForm.useSmtp ? smtpForm.smtpHost : '',
      smtpPort: smtpForm.useSmtp ? smtpForm.smtpPort : '',
      smtpUsername: smtpForm.useSmtp ? (smtpForm.smtpUsername || smtpForm.email) : '',
      smtpPassword: smtpForm.useSmtp ? smtpForm.smtpPassword : '',
      imapHost: smtpForm.useImap ? smtpForm.imapHost : '',
      imapPort: smtpForm.useImap ? smtpForm.imapPort : '',
      imapUsername: smtpForm.useImap ? (smtpForm.imapUsername || smtpForm.smtpUsername || smtpForm.email) : '',
      imapPassword: smtpForm.useImap ? (smtpForm.imapPassword || smtpForm.smtpPassword) : '',
    }
    try {
      const res = await fetch('/api/auth/smtp-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setConnectError(data.error || 'Connection failed')
        return
      }
      setShowMailboxConnect(false)
      setShowMailboxChooser(false)
      await refreshAuth()
    } catch {
      setConnectError('Network error — please try again')
    } finally {
      setIsConnecting(false)
    }
  }

  function handleDragStart(e: React.MouseEvent) {
    isDragging.current = true
    dragStartX.current = e.clientX
    dragStartWidth.current = listWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  // ── Drag resize email list ──────────────────────────────────────
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!isDragging.current) return
      const delta = e.clientX - dragStartX.current
      const next = Math.max(MIN_LIST_WIDTH, Math.min(MAX_LIST_WIDTH, dragStartWidth.current + delta))
      setListWidth(next)
    }
    function onMouseUp() {
      if (!isDragging.current) return
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, []) // stable — all mutation via refs
  useEffect(() => {
    if (isAuthenticated && provider === 'gmail') {
      void loadGmailUnreadCounts()
    }
  }, [isAuthenticated, provider, loadGmailUnreadCounts])

  useEffect(() => {
    function handlePopState() {
      setRouteNonce((nonce) => nonce + 1)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return

    async function applyFolderFromRoute() {
      const folderId = new URLSearchParams(window.location.search).get('folder')
      if (!folderId || currentFolder.id === folderId) return

      const systemFolder = folders.find((folder) => folder.id === folderId)
      if (systemFolder) {
        startTransition(() => {
          setCurrentFolder(systemFolder)
        })
        return
      }

      if (provider !== 'gmail' || SYSTEM_FOLDER_IDS.has(folderId)) return

      try {
        const res = await fetch('/api/gmail/labels', { credentials: 'include' })
        if (!res.ok) return

        const data = await res.json() as {
          labels?: Array<{ id: string; name: string; messagesUnreadCount?: number }>
        }
        const label = data.labels?.find((item) => item.id === folderId)
        if (!label) return

        startTransition(() => {
          setCurrentFolder({
            id: label.id,
            name: label.name,
            icon: 'tag',
            unreadCount: label.messagesUnreadCount ?? 0,
          })
        })
      } catch {
        // Route hydration is best-effort.
      }
    }

    void applyFolderFromRoute()
  }, [isAuthenticated, provider, currentFolder.id, folders, setCurrentFolder, routeNonce])

  // ── Early returns below ────────────────────────────────────────

  // Loading
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--background)]">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--muted-foreground)]" />
      </div>
    )
  }

  // Not authenticated — show auth screen
  if (!isAuthenticated) {
    return <MasterAuthScreen />
  }

  if ((!hasActiveAccount || showMailboxChooser) && !showMailboxConnect) {
    return (
      <MailboxChooser
        onConnectSmtp={() => {
          setConnectInitialTab('smtp')
          setShowMailboxChooser(false)
          setShowMailboxConnect(true)
        }}
        onSelected={() => setShowMailboxChooser(false)}
      />
    )
  }

  if (showMailboxConnect) {
    return (
      <AuthScreen
        initialTab={connectInitialTab}
        isAddingMailbox={true}
        onBack={() => {
          setShowMailboxConnect(false)
          setShowMailboxChooser(true)
        }}
        onGmailLogin={connectGmail}
        smtpForm={smtpForm}
        setSmtpForm={setSmtpForm}
        selectedPreset={selectedPreset}
        onPresetChange={handlePresetChange}
        onConnect={handleSmtpConnect}
        isConnecting={isConnecting}
        connectError={connectError}
      />
    )
  }

  // Authenticated — main app shell
  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar onSettingsOpen={() => setIsSettingsOpen(true)} onSwitchMailbox={() => setShowMailboxChooser(true)} />
      </div>

      {/* Desktop: email list + message view */}
      <div className="hidden md:flex flex-1 min-w-0">
        <div className="shrink-0 min-w-0" style={{ width: listWidth }}>
          <EmailList />
        </div>
        <div
          className="w-1 hover:bg-[var(--accent)]/40 cursor-col-resize transition-colors shrink-0"
          onMouseDown={handleDragStart}
        />
        <div className="flex-1 min-w-0">
          <MessageView onReply={handleReply} onForward={handleForward} />
        </div>
      </div>

      {/* Mobile */}
      <div className="flex flex-col flex-1 min-w-0 md:hidden">
        <div className="flex items-center gap-2 p-3 border-b border-[var(--border)] bg-[var(--card)] shrink-0">
          <MobileNav onCompose={handleCompose} onSettingsOpen={() => setIsSettingsOpen(true)} onSwitchMailbox={() => setShowMailboxChooser(true)} />
          <span className="font-mono text-sm font-bold tracking-tight text-[var(--foreground)]">
            mailie<span className="text-[var(--muted-foreground)]">_</span>
          </span>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-[var(--foreground)] hover:bg-[var(--surface-elevated)]"
            onClick={handleCompose}
            aria-label="Compose new email"
          >
            <PenSquare className="w-4 h-4" />
          </Button>
        </div>
        <MobileEmailView onReply={handleReply} onForward={handleForward} />
      </div>

      {/* Settings Dialog */}
      <SettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />

      {/* Keyboard shortcuts help overlay */}
      {showShortcutsHelp && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
          onClick={() => setShowShortcutsHelp(false)}
        >
          <div
            className="bg-[var(--card)] border border-[var(--border)] rounded-sm shadow-2xl p-6 max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-mono text-[13px] font-semibold text-[var(--foreground)]">
                Keyboard Shortcuts
              </h2>
              <button
                onClick={() => setShowShortcutsHelp(false)}
                className="w-6 h-6 flex items-center justify-center rounded-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-elevated)] transition-colors font-mono text-sm"
              >
                ✕
              </button>
            </div>
            <table className="w-full font-mono text-[12px]">
              <tbody>
                {[
                  ['c', 'Compose'],
                  ['/', 'Focus search'],
                  ['j', 'Next email'],
                  ['k', 'Previous email'],
                  ['Enter / o', 'Open email'],
                  ['e', 'Archive'],
                  ['s', 'Star / unstar'],
                  ['u', 'Mark unread'],
                  ['Shift+U', 'Mark read'],
                  ['x', 'Toggle select'],
                  ['gi', 'Go to Inbox'],
                  ['gs', 'Go to Sent'],
                  ['gd', 'Go to Drafts'],
                  ['ga', 'Go to Archive'],
                  ['gt', 'Go to Trash'],
                  ['?', 'Show shortcuts'],
                  ['Esc', 'Clear / close'],
                ].map(([key, desc]) => (
                  <tr key={key} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-1.5 pr-4 text-[var(--muted-foreground)]">{desc}</td>
                    <td className="py-1.5 font-semibold text-[var(--foreground)] text-right">
                      <kbd className="inline-block px-1.5 py-0.5 bg-[var(--surface-deep)] border border-[var(--border)] rounded-sm text-[11px]">
                        {key}
                      </kbd>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Floating compose panel */}
      <ComposePanel />
    </div>
  )
}
