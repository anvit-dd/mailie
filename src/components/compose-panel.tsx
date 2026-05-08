'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Compose } from './compose'
import { useCompose } from '@/contexts/compose-context'
import { ChevronDown, ChevronUp } from 'lucide-react'

const EXPANDED_HEIGHT = 700
const COLLAPSED_HEIGHT = 44

export function ComposePanel() {
  const { isComposeOpen, setIsComposeOpen, replyTo } = useCompose()
  const [mounted, setMounted] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!isComposeOpen) setIsCollapsed(false)
  }, [isComposeOpen])

  if (!mounted || !isComposeOpen) return null

  const subjectLabel = replyTo
    ? `Re: ${replyTo.subject || 'this message'}`
    : 'New Message'

  return createPortal(
    <div
      className="fixed bottom-0 left-0 right-0 md:bottom-4 md:right-4 z-50 w-full md:w-auto md:left-auto md:top-auto overflow-hidden"
      style={{
        width: 'min(560px, 100%)',
        height: isCollapsed ? COLLAPSED_HEIGHT : EXPANDED_HEIGHT,
        transition: 'height 200ms ease',
      }}
    >
      <div
        className="w-full h-full rounded-none md:rounded-xl shadow-[0_24px_80px_rgba(0,0,0,0.45)] border border-[var(--border)] bg-[var(--card)] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div
          className="flex items-center gap-2 px-4 py-2.5 bg-[var(--secondary)] border-b border-[var(--border)] shrink-0 cursor-pointer select-none"
          onClick={() => setIsCollapsed((c) => !c)}
        >
          <span className="font-mono text-[13px] font-semibold text-[var(--foreground)] flex-1 truncate pr-2">
            {subjectLabel}
          </span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setIsCollapsed((c) => !c) }}
            className="w-7 h-7 flex items-center justify-center rounded-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-elevated)] transition-colors shrink-0"
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setIsComposeOpen(false) }}
            className="w-7 h-7 flex items-center justify-center rounded-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-elevated)] transition-colors shrink-0"
          >
            <span className="font-mono text-[18px] leading-none mt-[-1px]">&times;</span>
          </button>
        </div>

        {/* Form — fills remaining height when expanded, hidden when collapsed */}
        {!isCollapsed && (
          <div className="flex-1 overflow-hidden">
            <Compose
              key={`panel-${replyTo?.subject ?? 'new'}`}
              isOpen={true}
              onClose={() => setIsComposeOpen(false)}
              inline={true}
              replyTo={replyTo}
            />
          </div>
        )}
      </div>

      {/* Collapsed bar overlay — replaces the panel content when minimized */}
      {isCollapsed && (
        <div
          className="absolute inset-0 flex items-center px-4 pointer-events-none"
          style={{ paddingTop: '1px' }}
        />
      )}
    </div>,
    document.body
  )
}
