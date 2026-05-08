'use client'

import { useEffect, useRef, useState } from 'react'
import { useEmail } from '@/contexts/email-context'
import { EmailListItem } from './email-list-item'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'

export function EmailList() {
  const {
    emails,
    selectedEmail,
    isLoadingList,
    refreshEmails,
    loadEmailDetail,
    setSelectedEmail,
    currentFolder,
    nextPageToken,
    pendingEmailId,
  } = useEmail()
  const selectedEmailRef = useRef(selectedEmail)
  const [searchInput, setSearchInput] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')

  useEffect(() => {
    selectedEmailRef.current = selectedEmail
  }, [selectedEmail])

  const handleSearchChange = (value: string) => {
    setSearchInput(value)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedQuery(searchInput)
    }, 250)
    return () => {
      window.clearTimeout(timer)
    }
  }, [searchInput])

  useEffect(() => {
    let active = true
    const run = async () => {
      const nextEmails = await refreshEmails(appliedQuery)
      if (!active) return
      const selectedId = selectedEmailRef.current?.id
      if (selectedId && !nextEmails.some((email) => email.id === selectedId)) {
        setSelectedEmail(null)
      }
    }
    void run()
    return () => {
      active = false
    }
  }, [currentFolder.id, appliedQuery, refreshEmails, setSelectedEmail])

  return (
    /* Zed editor canvas — darkest surface (#282C33) */
    <div className="flex flex-col h-full bg-[var(--editor-bg)] border-r border-[var(--border)]">

      {/* Toolbar — deep chrome (#3B414D) */}
      <div className="flex items-center gap-2 px-2 py-2 border-b border-[var(--border)] bg-[var(--surface-deep)] shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => refreshEmails(appliedQuery, { force: true })}
          className="h-7 w-7 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingList ? 'animate-spin' : ''}`} />
        </Button>
        <div className="flex-1 relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted-foreground)]" />
          <Input
            placeholder="Search..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="h-7 pl-7 pr-7 font-mono text-[13px] bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
          />
          {searchInput && (
            <button
              onClick={() => {
                setSearchInput('')
                setAppliedQuery('')
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Email list */}
      <ScrollArea className="relative flex-1 min-h-0">
        <div className={isLoadingList ? 'pointer-events-none opacity-60 transition-opacity duration-150' : ''}>
          {emails.length === 0 && !isLoadingList ? (
            <div className="flex flex-col items-center justify-center h-24 text-center px-4">
              <p className="font-mono text-[13px] text-[var(--muted-foreground)]">
                No emails
              </p>
            </div>
          ) : (
            <div className="h-0 min-h-full">
              {emails.map((email) => (
                <EmailListItem
                  key={email.id}
                  email={email}
                  isSelected={selectedEmail?.id === email.id || pendingEmailId === email.id}
                  onClick={() => loadEmailDetail(email.id)}
                />
              ))}
              {nextPageToken && (
                <div className="p-2">
                  <Button
                    variant="outline"
                    onClick={() => refreshEmails(appliedQuery, { append: true })}
                    disabled={isLoadingList}
                    className="w-full font-mono text-[11px] uppercase tracking-[0.15em] h-8 border-[var(--border)] text-[var(--muted-foreground)]"
                  >
                    {isLoadingList ? (
                      <>
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        Loading
                      </>
                    ) : (
                      'View more'
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
        {isLoadingList && emails.length > 0 && (
          <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center py-2">
            <div className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--background)]/90 px-3 py-1 shadow-sm backdrop-blur">
              <Loader2 className="w-3 h-3 animate-spin text-[var(--muted-foreground)]" />
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--muted-foreground)]">
                loading
              </span>
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
