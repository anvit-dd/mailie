'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Compose } from './compose'
import { useCompose } from '@/contexts/compose-context'
import { ChevronDown, ChevronUp } from 'lucide-react'

const COLLAPSED_HEIGHT = 44

export function ComposePanel() {
  const { isComposeOpen, setIsComposeOpen, replyTo } = useCompose()
  const [mounted, setMounted] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true))
    return () => window.cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (isComposeOpen) return
    const frame = window.requestAnimationFrame(() => setIsCollapsed(false))
    return () => window.cancelAnimationFrame(frame)
  }, [isComposeOpen])

  if (!mounted || !isComposeOpen) return null

  const subjectLabel = replyTo
    ? (replyTo.subject || 'Reply')
    : 'New Message'

  return createPortal(
    <div
      // Mobile: full screen overlay (top-0 bottom-0 left-0 right-0)
      // Desktop: floating bottom-right anchored panel
      className="fixed inset-0 md:static z-50 overflow-hidden"
    >
      {/* Mobile overlay backdrop + panel */}
      <div className="md:hidden fixed inset-0 z-50 flex items-end">
        <div
          className="w-full bg-[var(--card)] rounded-t-xl shadow-[0_24px_80px_rgba(0,0,0,0.45)] border-t border-x border-[var(--border)] flex flex-col overflow-hidden"
          style={{ height: isCollapsed ? COLLAPSED_HEIGHT : '100dvh' }}
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
          {/* Form */}
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
      </div>

      {/* Desktop: floating bottom-right panel */}
      <div
        className="hidden md:flex fixed bottom-0 right-0 z-50 flex-col rounded-t-xl shadow-[0_24px_80px_rgba(0,0,0,0.45)] border-t border-x border-[var(--border)] bg-[var(--card)] overflow-hidden"
        style={{
          width: 'min(560px, 100vw)',
          maxHeight: isCollapsed ? COLLAPSED_HEIGHT : 'clamp(500px, 92vh, 900px)',
        }}
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
        {/* Form */}
        {!isCollapsed && (
          <div className="flex-1 overflow-hidden">
            <Compose
              key={`panel-desktop-${replyTo?.subject ?? 'new'}`}
              isOpen={true}
              onClose={() => setIsComposeOpen(false)}
              inline={true}
              replyTo={replyTo}
            />
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
