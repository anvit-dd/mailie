'use client'

import { useState } from 'react'
import { useEmail } from '@/contexts/email-context'
import { useAuth } from '@/contexts/auth-context'
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverPositioner, PopoverContent } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Filter, X, Calendar, Paperclip, Star, MailOpen, Search } from 'lucide-react'

interface SearchFiltersProps {
  searchInput: string
  onSearchChange: (v: string) => void
}

interface FilterState {
  from: string
  to: string
  hasAttachment: boolean
  unread: boolean
  starred: boolean
  dateAfter: string
  dateBefore: string
}

function buildGmailQuery(filters: FilterState): string {
  const parts: string[] = []

  if (filters.from.trim()) {
    const from = filters.from.trim().replace(/"/g, '')
    parts.push(`from:${filters.from.includes(' ') ? `"${from}"` : from}`)
  }
  if (filters.to.trim()) {
    const to = filters.to.trim().replace(/"/g, '')
    parts.push(`to:${filters.to.includes(' ') ? `"${to}"` : to}`)
  }
  if (filters.hasAttachment) parts.push('has:attachment')
  if (filters.unread) parts.push('is:unread')
  if (filters.starred) parts.push('is:starred')
  if (filters.dateAfter) parts.push(`after:${filters.dateAfter}`)
  if (filters.dateBefore) parts.push(`before:${filters.dateBefore}`)

  return parts.join(' ')
}

function buildImapFilters(filters: FilterState): Record<string, string> {
  const result: Record<string, string> = {}
  if (filters.from.trim()) result['from'] = filters.from.trim()
  if (filters.to.trim()) result['to'] = filters.to.trim()
  if (filters.hasAttachment) result['hasAttachment'] = 'true'
  if (filters.unread) result['unread'] = 'true'
  if (filters.starred) result['starred'] = 'true'
  if (filters.dateAfter) result['dateAfter'] = filters.dateAfter
  if (filters.dateBefore) result['dateBefore'] = filters.dateBefore
  return result
}

export function SearchFilters({ searchInput, onSearchChange }: SearchFiltersProps) {
  const { refreshEmails, currentFolder } = useEmail()
  const { provider } = useAuth()
  const [open, setOpen] = useState(false)
  const [filters, setFilters] = useState<FilterState>({
    from: '',
    to: '',
    hasAttachment: false,
    unread: false,
    starred: false,
    dateAfter: '',
    dateBefore: '',
  })

  const activeCount = [
    filters.from,
    filters.to,
    filters.hasAttachment,
    filters.unread,
    filters.starred,
    filters.dateAfter,
    filters.dateBefore,
  ].filter(Boolean).length

  function handleApply() {
    // Build combined query: search input text + filter constraints
    const filterQuery = provider === 'smtp_imap'
      ? ''  // IMAP uses separate filter params
      : buildGmailQuery(filters)

    // For IMAP, use the search input as subject search + filter params
    // For Gmail, use combined query
    const combinedQuery = searchInput
      ? filterQuery
        ? `${searchInput} ${filterQuery}`
        : searchInput
      : filterQuery

    if (provider === 'smtp_imap') {
      const imapFilters = buildImapFilters(filters)
      const params = new URLSearchParams()
      params.set('folder', currentFolder.id)
      Object.entries(imapFilters).forEach(([k, v]) => params.set(k, v))
      void refreshEmails(params.toString())
    } else {
      void refreshEmails(combinedQuery)
    }
    setOpen(false)
  }

  function handleClear() {
    setFilters({
      from: '',
      to: '',
      hasAttachment: false,
      unread: false,
      starred: false,
      dateAfter: '',
      dateBefore: '',
    })
    // Re-run search with just the text input
    void refreshEmails(searchInput)
    setOpen(false)
  }

  function updateFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((f) => ({ ...f, [key]: value }))
  }

  return (
    <PopoverRoot open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 font-mono text-[12px] h-8 px-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          />
        }
      >
        <Filter className="w-3.5 h-3.5" />
        Filters
        {activeCount > 0 && (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[var(--accent)] text-[10px] font-bold text-[var(--primary-foreground)]">
            {activeCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverPortal>
        <PopoverPositioner
          align="start"
          side="bottom"
          sideOffset={4}
          className="w-80"
        >
          <PopoverContent className="space-y-3 p-4">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-2">
              Filter Emails
            </p>

            {/* From */}
            <div className="space-y-1">
              <label className="font-mono text-[11px] text-[var(--muted-foreground)]">From</label>
              <Input
                placeholder="sender@example.com"
                className="font-mono text-[12px] h-8"
                value={filters.from}
                onChange={(e) => updateFilter('from', e.target.value)}
              />
            </div>

            {/* To */}
            <div className="space-y-1">
              <label className="font-mono text-[11px] text-[var(--muted-foreground)]">To</label>
              <Input
                placeholder="recipient@example.com"
                className="font-mono text-[12px] h-8"
                value={filters.to}
                onChange={(e) => updateFilter('to', e.target.value)}
              />
            </div>

            {/* Date range */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="font-mono text-[11px] text-[var(--muted-foreground)] flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> After
                </label>
                <Input
                  type="date"
                  className="font-mono text-[12px] h-8"
                  value={filters.dateAfter}
                  onChange={(e) => updateFilter('dateAfter', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="font-mono text-[11px] text-[var(--muted-foreground)] flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Before
                </label>
                <Input
                  type="date"
                  className="font-mono text-[12px] h-8"
                  value={filters.dateBefore}
                  onChange={(e) => updateFilter('dateBefore', e.target.value)}
                />
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-2 pt-1">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="font-mono text-[12px] text-[var(--foreground)] flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                  Has attachment
                </span>
                <Switch
                  checked={filters.hasAttachment}
                  onCheckedChange={(v) => updateFilter('hasAttachment', v)}
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="font-mono text-[12px] text-[var(--foreground)] flex items-center gap-1.5">
                  <MailOpen className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                  Unread
                </span>
                <Switch
                  checked={filters.unread}
                  onCheckedChange={(v) => updateFilter('unread', v)}
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="font-mono text-[12px] text-[var(--foreground)] flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                  Starred
                </span>
                <Switch
                  checked={filters.starred}
                  onCheckedChange={(v) => updateFilter('starred', v)}
                />
              </label>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              <Button
                size="sm"
                className="font-mono text-[12px] h-8 bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90"
                onClick={handleApply}
              >
                Apply
              </Button>
              {activeCount > 0 && (
                <button
                  onClick={handleClear}
                  className="font-mono text-[11px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] underline-offset-2 hover:underline transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>
          </PopoverContent>
        </PopoverPositioner>
      </PopoverPortal>
    </PopoverRoot>
  )
}