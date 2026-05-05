'use client'

import { useEmail } from '@/contexts/email-context'
import type { EmailDetail } from '@/types/email'
import { File, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EMAIL_VIEWER_CSS } from '@/lib/gmail-viewer-css'
import { useEffect, useRef, useState } from 'react'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// Script injected into the srcdoc iframe to measure height and post to parent.
// Uses ResizeObserver to track content height changes (images, collapsed sections, etc.)
// and posts the scrollHeight to the parent via postMessage.
const HEIGHT_MEASUREMENT_SCRIPT = `
<script>
(function() {
  var lastHeight = 0;
  var ticking = false;

  function sendHeight() {
    var h = Math.max(
      document.body.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.scrollHeight,
      document.documentElement.offsetHeight
    );
    if (h !== lastHeight) {
      lastHeight = h;
      try {
        parent.postMessage({ type: 'iframeHeight', height: h }, '*');
      } catch(e) {}
    }
    ticking = false;
  }

  function measure() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(sendHeight);
    }
  }

  if (document.body) {
    // Retry at increasing intervals to catch late-loading images
    window.addEventListener('load', function() {
      setTimeout(sendHeight, 150);
      setTimeout(sendHeight, 500);
      setTimeout(sendHeight, 1500);
      setTimeout(sendHeight, 3000);
    });

    if (typeof ResizeObserver !== 'undefined') {
      var ro = new ResizeObserver(measure);
      ro.observe(document.body);
      ro.observe(document.documentElement);
    }

    if (typeof MutationObserver !== 'undefined') {
      var mo = new MutationObserver(measure);
      mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
    }
  }

  // Initial measure
  if (document.readyState === 'complete') {
    setTimeout(sendHeight, 100);
  } else {
    window.addEventListener('load', function() { setTimeout(sendHeight, 100); });
  }
})();
</script>
`

function buildSrcdoc(html: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="script-src 'none'; frame-src 'none'; object-src 'none'; img-src 'self' https: data:;">
  <style>
    ${EMAIL_VIEWER_CSS}
    body { max-width: 100vw; overflow-x: hidden; }
    table, td, img, div, span { max-width: 100% !important; }
  </style>
  ${HEIGHT_MEASUREMENT_SCRIPT}
</head>
<body>${html}</body>
</html>`
}

function MessageBodyContent({ selectedEmail }: { selectedEmail: EmailDetail }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [emailHtml, setEmailHtml] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(selectedEmail.body))
  const [error, setError] = useState<string | null>(null)
  const [iframeHeight, setIframeHeight] = useState<number | undefined>(undefined)

  // Listen for height messages from the iframe
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === 'iframeHeight' && typeof event.data.height === 'number') {
        setIframeHeight(event.data.height)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Reset iframe height when email changes
  useEffect(() => {
    setIframeHeight(undefined)
  }, [selectedEmail.id])

  // Fetch email body HTML when a new email is selected
  useEffect(() => {
    if (!selectedEmail.body) {
      return
    }

    const controller = new AbortController()

    fetch(`/api/gmail/body?id=${selectedEmail.id}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load email')
        return res.json()
      })
      .then((data) => {
        setEmailHtml(data.html || '')
        setIsLoading(false)
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Failed to load email')
        setIsLoading(false)
      })

    return () => controller.abort()
  }, [selectedEmail.id, selectedEmail.body])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Padded wrapper — sits outside the scroll layer so padding doesn't add to scroll height */}
      <div className="p-4 flex-1 min-h-0 flex flex-col">
        {/* Email body scroll container */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain">
          {isLoading && (
            <div className="mb-3">
              <p className="font-mono text-xs text-muted-foreground animate-pulse">
                Loading content...
              </p>
            </div>
          )}

          {error && (
            <div className="mb-3">
              <p className="font-mono text-xs text-destructive">
                {error}
              </p>
            </div>
          )}

          {/* HTML email in sandboxed srcdoc iframe */}
          {emailHtml && (
            <iframe
              ref={iframeRef}
              className="block w-full border-0 bg-white"
              style={{
                display: 'block',
                width: '100%',
                height: iframeHeight ? `${iframeHeight}px` : '100%',
                overflow: 'auto',
              }}
              sandbox="allow-same-origin"
              title={`Email: ${selectedEmail.subject}`}
              srcDoc={buildSrcdoc(emailHtml)}
            />
          )}

          {/* Plain text fallback (no HTML body) */}
          {!emailHtml && !isLoading && !error && selectedEmail.bodyPlain && (
            <pre className="text-sm whitespace-pre-wrap">
              {selectedEmail.bodyPlain}
            </pre>
          )}

          {/* No content */}
          {!emailHtml && !isLoading && !error && !selectedEmail.bodyPlain && (
            <div>
              <p className="font-mono text-sm text-muted-foreground italic">
                No content
              </p>
            </div>
          )}
        </div>

        {/* Attachments — inside the padding wrapper */}
        {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
          <div className="shrink-0 px-4 pb-4 pt-2 border-t border-border">
            <p className="font-mono text-xs text-muted-foreground mb-2">
              Attachments ({selectedEmail.attachments.length})
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {selectedEmail.attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center gap-2 px-3 py-2 bg-surface-elevated rounded-sm border border-border shrink-0 min-w-0"
                >
                  <File className="w-4 h-4 text-accent shrink-0" />
                  <div className="min-w-0">
                    <p className="font-mono text-xs truncate max-w-[120px]">
                      {attachment.filename}
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {formatBytes(attachment.size)}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                    <Download className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function MessageBody() {
  const { selectedEmail } = useEmail()

  if (!selectedEmail) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="font-mono text-4xl text-muted-foreground mb-4 select-none">
            {'<-'}
          </div>
          <p className="font-mono text-sm text-muted-foreground">
            Select an email to read
          </p>
        </div>
      </div>
    )
  }

  return <MessageBodyContent key={selectedEmail.id} selectedEmail={selectedEmail} />
}
