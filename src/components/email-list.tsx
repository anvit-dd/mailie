'use client'

import { useEffect } from 'react'
import { useEmail } from '@/contexts/email-context'
import { EmailListItem } from './email-list-item'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { RefreshCw, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

export function EmailList() {
  const {
    emails,
    selectedEmail,
    isLoading,
    refreshEmails,
    loadEmailDetail,
    setSelectedEmail,
    currentFolder,
  } = useEmail()

  useEffect(() => {
    setSelectedEmail(null)
    refreshEmails()
  }, [currentFolder.id, refreshEmails, setSelectedEmail])

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
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
        <div className="flex-1 relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            className="h-8 pl-8 font-mono text-sm bg-surface"
          />
        </div>
      </div>

      {/* Email list */}
      <ScrollArea className="flex-1 min-h-0">
        {isLoading && emails.length === 0 ? (
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
                isSelected={selectedEmail?.id === email.id}
                onClick={() => loadEmailDetail(email.id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
