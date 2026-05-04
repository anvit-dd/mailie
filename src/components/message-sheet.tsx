'use client'

import { Sheet, SheetContent } from '@/components/ui/sheet'
import { MessageView } from './message-view'
import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'
import { useEmail } from '@/contexts/email-context'

interface MessageSheetProps {
  onReply: () => void
  onForward: () => void
}

export function MessageSheet({ onReply, onForward }: MessageSheetProps) {
  const { selectedEmail, setSelectedEmail } = useEmail()

  return (
    <Sheet open={!!selectedEmail} onOpenChange={(open) => {
      if (!open) setSelectedEmail(null)
    }}>
      <SheetContent side="bottom" className="h-[95dvh] p-0 flex flex-col">
        {/* Mobile header with back button */}
        <div className="flex items-center gap-2 p-3 border-b border-border">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => setSelectedEmail(null)}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <span className="font-mono text-sm truncate flex-1">
            {selectedEmail?.subject || 'Email'}
          </span>
        </div>

        {/* Message content */}
        <div className="flex-1 overflow-hidden">
          <MessageView onReply={onReply} onForward={onForward} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
