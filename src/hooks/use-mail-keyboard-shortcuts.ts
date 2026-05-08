'use client'

import { useEffect, useCallback } from 'react'
import { useEmail } from '@/contexts/email-context'
import { useCompose } from '@/contexts/compose-context'
import { useAuth } from '@/contexts/auth-context'

interface UseMailKeyboardShortcutsOptions {
  onShowShortcutsHelp: () => void
}

export function useMailKeyboardShortcuts({ onShowShortcutsHelp }: UseMailKeyboardShortcutsOptions) {
  const {
    emails,
    selectedEmail,
    loadEmailDetail,
    toggleSelected,
    selectAll,
    clearSelected,
    currentFolder,
    setCurrentFolder,
    folders,
    markAsRead,
    archiveEmail,
    toggleStar,
  } = useEmail()
  const { handleCompose } = useCompose()
  const { provider } = useAuth()

  const isInput = useCallback((target: EventTarget | null): boolean => {
    if (!target || !(target instanceof HTMLElement)) return false
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return true
    if (target.closest?.('.ProseMirror')) return true
    if (target.closest?.('[contenteditable="true"]')) return true
    return false
  }, [])

  useEffect(() => {
    let pendingGKey = false
    let pendingGTimer: ReturnType<typeof setTimeout> | null = null

    function handleKeyDown(e: KeyboardEvent) {
      // Never trigger in inputs / contenteditable
      if (isInput(e.target)) return

      const key = e.key
      const ctrl = e.ctrlKey || e.metaKey

      // ── g-prefixed shortcuts (gi, gs, gd, ga, gt) ─────────────
      if (key === 'g' && !ctrl && !e.shiftKey) {
        if (pendingGKey) return // already pending
        pendingGKey = true
        if (pendingGTimer) clearTimeout(pendingGTimer)
        pendingGTimer = setTimeout(() => { pendingGKey = false }, 500)
        return
      }

      // Cancel pending g if another key pressed
      if (pendingGKey && key !== 'g') {
        pendingGKey = false
        if (pendingGTimer) { clearTimeout(pendingGTimer); pendingGTimer = null }
      }

      // ── g + second key ───────────────────────────────────────
      if (pendingGKey && key.length === 1) {
        pendingGKey = false
        if (pendingGTimer) { clearTimeout(pendingGTimer); pendingGTimer = null }

        const goToFolder = (folderId: string) => {
          const folder = folders.find((f) => f.id === folderId)
          if (folder) setCurrentFolder(folder)
        }

        switch (key) {
          case 'i': goToFolder('INBOX'); break
          case 's': goToFolder('SENT'); break
          case 'd': goToFolder('DRAFT'); break
          case 'a': goToFolder('ARCHIVE'); break
          case 't': goToFolder('TRASH'); break
        }
        return
      }

      // ── Single-key shortcuts ─────────────────────────────────
      switch (key) {
        case 'j': {
          // Next email
          const currentIdx = emails.findIndex((em) => em.id === selectedEmail?.id)
          if (currentIdx < emails.length - 1) {
            loadEmailDetail(emails[currentIdx + 1].id)
          }
          break
        }
        case 'k': {
          // Previous email
          const currentIdx = emails.findIndex((em) => em.id === selectedEmail?.id)
          if (currentIdx > 0) {
            loadEmailDetail(emails[currentIdx - 1].id)
          }
          break
        }
        case 'Enter':
        case 'o': {
          // Open selected email (no-op if already selected)
          if (!selectedEmail && emails.length > 0) {
            loadEmailDetail(emails[0].id)
          }
          break
        }
        case 'x': {
          if (selectedEmail) toggleSelected(selectedEmail.id)
          break
        }
        case 'e': {
          // Archive selected email
          if (selectedEmail) archiveEmail(selectedEmail.id)
          break
        }
        case 's': {
          // Star/unstar — only trigger if not in compose (compose uses its own star handling)
          if (selectedEmail) void toggleStar(selectedEmail.id, selectedEmail.isStarred)
          break
        }
        case 'u': {
          // Mark unread (Shift+u = Shift+U = mark read, handled below)
          if (selectedEmail && !e.shiftKey) {
            void markAsRead(selectedEmail.id, false)
          }
          break
        }
        case 'U': {
          // Shift+U = mark read
          if (selectedEmail) {
            void markAsRead(selectedEmail.id, true)
          }
          break
        }
        case 'c': {
          // Compose — but not when compose panel is open
          void handleCompose()
          break
        }
        case '/': {
          // Focus search — dispatch custom event that email-list listens for
          document.dispatchEvent(new CustomEvent('mailie:focus-search'))
          e.preventDefault()
          break
        }
        case '?':
          onShowShortcutsHelp()
          break
        case 'Escape':
          clearSelected()
          onShowShortcutsHelp()
          break
      }

      // Ctrl/Cmd shortcuts
      if (ctrl) {
        switch (key) {
          case 'a': {
            selectAll(emails.map((e) => e.id))
            break
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [
    emails, selectedEmail, loadEmailDetail, toggleSelected, selectAll, clearSelected,
    setCurrentFolder, folders, markAsRead, archiveEmail, toggleStar, handleCompose,
    isInput, onShowShortcutsHelp,
  ])
}