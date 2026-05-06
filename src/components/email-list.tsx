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
    <div className="flex flex-col h-full border-r border-border bg-background">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-3 border-b border-border">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => refreshEmails(appliedQuery, { force: true })}
          className="h-8 w-8"
        >
          <RefreshCw className={`w-4 h-4 ${isLoadingList ? 'animate-spin' : ''}`} />
        </Button>
        <div className="flex-1 relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="h-8 pl-8 pr-8 font-mono text-sm bg-surface"
          />
          {searchInput && (
            <button
              onClick={() => {
                setSearchInput('')
                setAppliedQuery('')
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
            <div className="flex flex-col items-center justify-center h-32 text-center p-4">
              <p className="font-mono text-sm text-muted-foreground">
                No emails in this folder
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
                <div className="p-3">
                  <Button
                    variant="outline"
                    onClick={() => refreshEmails(appliedQuery, { append: true })}
                    disabled={isLoadingList}
                    className="w-full font-mono text-xs uppercase tracking-[0.2em] h-9"
                  >
                    {isLoadingList ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
        {isLoadingList && (
          <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center py-3">
            <div className="flex items-center gap-2 rounded-full border border-border bg-background/90 px-3 py-1.5 shadow-sm backdrop-blur">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                loading
              </span>
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
