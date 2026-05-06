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

// Script injected into the srcdoc iframe to:
// 1. Measure content height and post to parent (ResizeObserver + MutationObserver)
// 2. Intercept all link clicks and forward them to the parent to open in a new tab
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

  // Intercept all link clicks and forward to parent to open in new tab
  document.addEventListener('click', function(e) {
    var link = e.target.closest ? e.target.closest('a') : null;
    if (link && link.href) {
      e.preventDefault();
      try {
        parent.postMessage({ type: 'iframeLinkClick', url: link.href }, '*');
      } catch(err) {}
    }
  });
})();
</script>
`

function buildSrcdoc(html: string): string {
  // Emails are full HTML documents with <html>, <head>, <body>.
  // Inject the complete sanitized HTML directly as the iframe content so all
  // CSS selectors (body > .container, html body .card, etc.) remain valid.
  // Only inject our viewer CSS + viewport meta as an OVERLAY — prepend our
  // styles to <head> so they cascade correctly without breaking email selectors.
  //
  // The approach: parse the email HTML, prepend our viewer CSS to <head>, then
  // return the full document string as srcdoc.
  try {
    const parser = new DOMParser()
    const document = parser.parseFromString(html, 'text/html')
    const headEl = document.querySelector('head')
    if (headEl) {
      // Prepend our viewer CSS to <head> (it cascades before email styles)
      const viewerStyle = document.createElement('style')
      viewerStyle.textContent = EMAIL_VIEWER_CSS
      headEl.insertBefore(viewerStyle, headEl.firstChild)
    }
    const fullDoc = '<!DOCTYPE html>\n' + document.documentElement.outerHTML
    // Inject height measurement script by inserting it before </body>
    return fullDoc.replace('</body>', `${HEIGHT_MEASUREMENT_SCRIPT}</body>`)
  } catch {
    // Fallback: return as-is
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <meta http-equiv="Content-Security-Policy" content="script-src 'none'; frame-src 'none'; object-src 'none'; img-src 'self' https: data:;">
  <style>${EMAIL_VIEWER_CSS}</style>
</head>
<body>${html}</body>
</html>`.replace('</body>', `${HEIGHT_MEASUREMENT_SCRIPT}</body>`)
  }
}

function MessageBodyContent({ selectedEmail, noPadding }: { selectedEmail: EmailDetail; noPadding?: boolean }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [emailHtml, setEmailHtml] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Listen for link clicks from the iframe — open them in a new tab
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === 'iframeLinkClick' && event.data?.url) {
        window.open(event.data.url, '_blank', 'noopener,noreferrer')
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Fetch email body HTML when a new email is selected
  useEffect(() => {
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
  }, [selectedEmail.id])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Email body — optionally no padding when embedded in a padded container */}
      <div className={`flex-1 min-h-0 flex flex-col ${noPadding ? '' : 'p-4'}`}>
        {/* Email body scroll container — parent handles scrolling when noPadding */}
        <div
          ref={scrollRef}
          className={`flex-1 min-h-0 overflow-y-auto overscroll-y-contain ${noPadding ? '' : 'overflow-y-auto'}`}
        >
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
                height: '100%',
              }}
              sandbox="allow-same-origin allow-scripts"
              title={`Email: ${selectedEmail.subject}`}
              srcDoc={buildSrcdoc(emailHtml)}
            />
          )}

          {/* Plain text fallback (no HTML body) */}
          {!emailHtml && !isLoading && !error && selectedEmail.bodyPlain && (
            <pre className={`whitespace-pre-wrap ${noPadding ? 'p-3' : ''} text-sm`}>
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

        {/* Attachments */}
        {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
          <div className={`shrink-0 border-t border-border ${noPadding ? 'p-3' : 'px-4 pb-4 pt-2'}`}>
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
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => {
                      const url = `/api/gmail/attachment?messageId=${encodeURIComponent(selectedEmail.id)}&attachmentId=${encodeURIComponent(attachment.id)}&filename=${encodeURIComponent(attachment.filename)}&mimeType=${encodeURIComponent(attachment.mimeType)}`
                      const link = document.createElement('a')
                      link.href = url
                      link.download = attachment.filename
                      link.rel = 'noopener'
                      document.body.appendChild(link)
                      link.click()
                      link.remove()
                    }}
                  >
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

export function MessageBody({ noPadding }: { noPadding?: boolean }) {
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

  return <MessageBodyContent key={selectedEmail.id} selectedEmail={selectedEmail} noPadding={noPadding} />
}
