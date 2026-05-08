'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
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
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Loader2, PenSquare, Mail, Server } from 'lucide-react'

const DEFAULT_LIST_WIDTH = 320
const MIN_LIST_WIDTH = 200
const MAX_LIST_WIDTH = 600

type ProviderPreset = 'gmail' | 'outlook' | 'yahoo' | 'custom'

interface SmtpImapForm {
  email: string
  displayName: string
  smtpHost: string
  smtpPort: string
  smtpSecure: boolean
  smtpUsername: string
  smtpPassword: string
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
  custom: {},
}

// ─────────────────────────────────────────────────────────
// Auth Screen
// ─────────────────────────────────────────────────────────
function AuthScreen({
  onGmailLogin,
  smtpForm,
  setSmtpForm,
  onPresetChange,
  onConnect,
  isConnecting,
  connectError,
}: {
  onGmailLogin: () => void
  smtpForm: SmtpImapForm
  setSmtpForm: React.Dispatch<React.SetStateAction<SmtpImapForm>>
  onPresetChange: (p: ProviderPreset) => void
  onConnect: () => void
  isConnecting: boolean
  connectError: string
}) {
  const presetForSelect = (): ProviderPreset => {
    if (smtpForm.smtpHost.includes('gmail')) return 'gmail'
    if (smtpForm.smtpHost.includes('office365') || smtpForm.smtpHost.includes('outlook'))
      return 'outlook'
    if (smtpForm.smtpHost.includes('yahoo')) return 'yahoo'
    return 'custom'
  }

  return (
    <div className="flex items-center justify-center h-screen bg-[var(--background)]">
      <div className="text-center max-w-md px-6">

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
            connect
          </span>
          <div className="flex-1 h-px bg-[var(--border)]" />
        </div>

        {/* Auth Tabs */}
        <Tabs defaultValue="gmail" className="w-full">
          <TabsList className="w-full mb-6">
            <TabsTrigger value="gmail" className="flex-1 gap-2">
              <Mail className="w-3.5 h-3.5" />
              Gmail OAuth
            </TabsTrigger>
            <TabsTrigger value="smtp" className="flex-1 gap-2">
              <Server className="w-3.5 h-3.5" />
              SMTP / IMAP
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
                  value={presetForSelect()}
                  onValueChange={(v) => onPresetChange(v as ProviderPreset)}
                >
                  <SelectTrigger className="w-full h-8 font-mono text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gmail">Gmail (App Password)</SelectItem>
                    <SelectItem value="outlook">Outlook / Microsoft 365</SelectItem>
                    <SelectItem value="yahoo">Yahoo</SelectItem>
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
                    onChange={(e) => setSmtpForm((f) => ({ ...f, smtpHost: e.target.value }))}
                  />
                  <Input
                    placeholder="465"
                    type="number"
                    className="font-mono text-[13px] h-8"
                    value={smtpForm.smtpPort}
                    onChange={(e) => setSmtpForm((f) => ({ ...f, smtpPort: e.target.value }))}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={smtpForm.smtpSecure}
                    onCheckedChange={(checked) =>
                      setSmtpForm((f) => ({ ...f, smtpSecure: checked }))
                    }
                  />
                  <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                    TLS / SSL
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Username"
                    className="font-mono text-[13px] h-8"
                    value={smtpForm.smtpUsername}
                    onChange={(e) => setSmtpForm((f) => ({ ...f, smtpUsername: e.target.value }))}
                  />
                  <Input
                    type="password"
                    placeholder="Password / App Password"
                    className="font-mono text-[13px] h-8"
                    value={smtpForm.smtpPassword}
                    onChange={(e) => setSmtpForm((f) => ({ ...f, smtpPassword: e.target.value }))}
                  />
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
                    onChange={(e) => setSmtpForm((f) => ({ ...f, imapHost: e.target.value }))}
                  />
                  <Input
                    placeholder="993"
                    type="number"
                    className="font-mono text-[13px] h-8"
                    value={smtpForm.imapPort}
                    onChange={(e) => setSmtpForm((f) => ({ ...f, imapPort: e.target.value }))}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={smtpForm.imapSecure}
                    onCheckedChange={(checked) =>
                      setSmtpForm((f) => ({ ...f, imapSecure: checked }))
                    }
                  />
                  <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                    TLS / SSL
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Username"
                    className="font-mono text-[13px] h-8"
                    value={smtpForm.imapUsername}
                    onChange={(e) => setSmtpForm((f) => ({ ...f, imapUsername: e.target.value }))}
                  />
                  <Input
                    type="password"
                    placeholder="Password / App Password"
                    className="font-mono text-[13px] h-8"
                    value={smtpForm.imapPassword}
                    onChange={(e) => setSmtpForm((f) => ({ ...f, imapPassword: e.target.value }))}
                  />
                </div>
              </div>

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
                  !smtpForm.imapPassword
                }
                className="font-mono text-[13px] w-full bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 h-10 mt-2"
              >
                {isConnecting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {isConnecting ? 'Connecting…' : 'Connect Account'}
              </Button>

              <p className="font-mono text-[10px] text-[var(--muted-foreground)] text-center">
                Passwords are encrypted with AES-256-GCM before storage
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────────────────
export default function Home() {
  const { isAuthenticated, isLoading, login, provider } = useAuth()
  const { handleReply, handleForward, handleCompose } = useCompose()
  const { emails, selectedEmail, loadEmailDetail, toggleSelected, currentFolder, setCurrentFolder, folders, loadGmailUnreadCounts } = useEmail()
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false)
  // Drag handler — useRef for mutable values so effects can depend on them
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(DEFAULT_LIST_WIDTH)
  const [listWidth, setListWidth] = useState(DEFAULT_LIST_WIDTH)
  const [smtpPreset, setSmtpPreset] = useState<ProviderPreset>('gmail')

  // ── Keyboard shortcuts ──────────────────────────────────────────
  useMailKeyboardShortcuts({ onShowShortcutsHelp: () => setShowShortcutsHelp((v) => !v) })

  // ── Drag state refs ────────────────────────────────────────────
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [smtpForm, setSmtpForm] = useState<SmtpImapForm>({
    email: '',
    displayName: '',
    smtpHost: PRESETS.gmail.smtpHost!,
    smtpPort: PRESETS.gmail.smtpPort!,
    smtpSecure: PRESETS.gmail.smtpSecure!,
    smtpUsername: '',
    smtpPassword: '',
    imapHost: PRESETS.gmail.imapHost!,
    imapPort: PRESETS.gmail.imapPort!,
    imapSecure: PRESETS.gmail.imapSecure!,
    imapUsername: '',
    imapPassword: '',
  })
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectError, setConnectError] = useState('')

  function handlePresetChange(preset: ProviderPreset) {
    setSmtpPreset(preset)
    if (preset !== 'custom') {
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
  }

  async function handleSmtpConnect() {
    setIsConnecting(true)
    setConnectError('')
    try {
      const res = await fetch('/api/auth/smtp-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(smtpForm),
      })
      const data = await res.json()
      if (!res.ok) {
        setConnectError(data.error || 'Connection failed')
        return
      }
      window.location.reload()
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

  // ── Auth-gated useEffect — must stay in hooks order (before early returns) ──
  useEffect(() => {
    if (isAuthenticated && provider === 'gmail') {
      void loadGmailUnreadCounts()
    }
  }, [isAuthenticated, provider, loadGmailUnreadCounts])

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
    return (
      <AuthScreen
        onGmailLogin={login}
        smtpForm={smtpForm}
        setSmtpForm={setSmtpForm}
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
        <Sidebar onSettingsOpen={() => setIsSettingsOpen(true)} />
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
          <MobileNav onCompose={handleCompose} onSettingsOpen={() => setIsSettingsOpen(true)} />
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