'use client'

import { useEffect } from 'react'
import { useEmail } from '@/contexts/email-context'
import { EmailListItem } from './email-list-item'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { RefreshCw, Search, X } from 'lucide-react'
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
    searchQuery,
    setSearchQuery,
    pendingEmailId,
  } = useEmail()

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    // Debounce the API call — searchQuery dep in useEffect handles the actual fetch
  }

  useEffect(() => {
    setSelectedEmail(null)
    refreshEmails()
  }, [currentFolder.id, searchQuery, refreshEmails, setSelectedEmail])

  return (
    <div className="flex flex-col h-full border-r border-border bg-background">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-3 border-b border-border">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => refreshEmails()}
          className="h-8 w-8"
        >
          <RefreshCw className={`w-4 h-4 ${isLoadingList ? 'animate-spin' : ''}`} />
        </Button>
        <div className="flex-1 relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="h-8 pl-8 pr-8 font-mono text-sm bg-surface"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Email list */}
      <ScrollArea className="flex-1 min-h-0">
        {isLoadingList && emails.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : emails.length === 0 ? (
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
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
