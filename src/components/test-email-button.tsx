'use client'

import { useState } from 'react'
import { useEmail } from '@/contexts/email-context'
import { Button } from '@/components/ui/button'
import type { EmailDetail } from '@/types/email'
import { FlaskConical, X, ExternalLink } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface TestEmailType {
  id: string
  label: string
  description: string
  badge?: string
}

const TEST_EMAIL_TYPES: TestEmailType[] = [
  { id: 'plain-text', label: 'Plain Text', description: 'No background set, tests default white rendering' },
  { id: 'no-bg', label: 'No-BG HTML', description: 'Standard HTML email, no bgcolor on body', badge: '⚠️' },
  { id: 'white-bg', label: 'White BG', description: 'Explicit white background, should render clean' },
  { id: 'dark-bg', label: 'Dark BG', description: 'Explicit dark background with light text' },
  { id: 'table-heavy', label: 'Table Layout', description: 'EduPath-style table-heavy email' },
  { id: 'linkedin-style', label: 'LinkedIn Style', description: 'Nested tables, dark header sections' },
  { id: 'font-tag-no-bg', label: 'Font Tag', description: 'Old <font> tag without bgcolor, tests CSS override' },
  { id: 'long-content', label: 'Long Content', description: '60 paragraphs, tests scroll behavior' },
  { id: 'wide-content', label: 'Wide Content', description: 'Very wide table, tests horizontal scroll' },
  { id: 'image-heavy', label: 'Image Heavy', description: 'Various image sizes, tests image rendering' },
]

async function loadTestEmailHtml(type: string): Promise<string> {
  const res = await fetch(`/api/test-emails?type=${type}`)
  const data = await res.json()
  return data.html || ''
}

function createTestEmail(type: TestEmailType, html: string): EmailDetail {
  const now = new Date()
  return {
    id: `test-${type.id}-${Date.now()}`,
    threadId: `test-thread-${type.id}`,
    from: {
      name: type.id === 'dark-bg' ? 'Dark Mode Test' : type.id === 'linkedin-style' ? 'LinkedIn' : 'Test Sender',
      email: type.id === 'linkedin-style' ? 'notifications@linkedin.com' : 'test@example.com',
    },
    to: [{ name: 'Anvit', email: 'anvit@gmail.com' }],
    subject: `[TEST] ${type.label} — Email Renderer Test`,
    preview: type.description,
    date: now,
    isRead: false,
    isStarred: false,
    labels: ['CATEGORY_PERSONAL', 'INBOX'],
    hasAttachments: false,
    body: '', // Will be loaded via API
    bodyHtml: html, // Store the HTML for the API to serve
    bodyPlain: '',
    attachments: [],
    headers: {},
  }
}

// Override fetch to intercept test email body requests
function setupTestFetchInterceptor(html: string) {
  const originalFetch = window.fetch.bind(window)
  window.fetch = function(input: RequestInfo | URL, init?: RequestInit) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url
    if (url.includes('/api/gmail/body?id=test-')) {
      // Return the stored HTML
      return Promise.resolve(new Response(JSON.stringify({ html }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
    }
    return originalFetch(input, init)
  }
  return () => {
    window.fetch = originalFetch
  }
}

export function TestEmailButton() {
  const { loadEmailDetail, setSelectedEmail } = useEmail()
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [cleanup, setCleanup] = useState<(() => void) | null>(null)

  async function handleSelectEmail(type: TestEmailType) {
    setLoading(true)
    setIsOpen(false)

    try {
      const html = await loadTestEmailHtml(type.id)
      const testEmail = createTestEmail(type, html)

      // Set up fetch interceptor so /api/gmail/body returns our test HTML
      const restoreFetch = setupTestFetchInterceptor(html)
      setCleanup(() => restoreFetch)

      // Set the email in context — the body API call will use our interceptor
      await loadEmailDetail(testEmail.id)
    } catch (err) {
      console.error('Failed to load test email:', err)
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setIsOpen(false)
    if (cleanup) {
      cleanup()
      setCleanup(null)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); else setIsOpen(open) }}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 relative group"
            title="Test Email Renderer"
          />
        }
        onClick={() => setIsOpen(true)}
      >
        <FlaskConical className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors" />
        {/* Pulsing dot to indicate test mode */}
        <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
      </DialogTrigger>

      <DialogContent className="font-mono text-sm border-border bg-surface-elevated max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground">
            <FlaskConical className="w-4 h-4" />
            Email Renderer Test Suite
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Injects dummy emails to test iframe rendering, scroll behavior, and dark mode isolation.
          </p>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 min-h-0 -mx-6 px-6">
          <div className="space-y-1 pb-4">
            {TEST_EMAIL_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => handleSelectEmail(type)}
                disabled={loading}
                className="w-full text-left px-3 py-2.5 rounded-sm hover:bg-accent/10 border border-transparent hover:border-border transition-all disabled:opacity-50 group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground group-hover:text-accent transition-colors">
                    {type.badge ? `${type.badge} ` : ''}{type.label}
                  </span>
                  <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{type.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="shrink-0 pt-3 border-t border-border mt-2 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {cleanup ? '🧪 Test mode active' : 'Ready'}
          </p>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleClose}>
            <X className="w-3 h-3 mr-1" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
