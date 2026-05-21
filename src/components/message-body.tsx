'use client'

import { useEmail } from '@/contexts/email-context'
import type { EmailDetail } from '@/types/email'
import { File, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EMAIL_VIEWER_CSS } from '@/lib/gmail-viewer-css'
import { stripHtml } from '@/lib/gmail-utils'
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

  // Detect "plain text" HTML — no <style> blocks, no inline CSS, no bgcolor/color attributes.
  // These emails look like raw text with no styling; we make the background transparent
  // so the host app's dark/light theme shows through the iframe edges.
  function isPlainTextEmail(doc: Document): boolean {
    // Check for <style> blocks (CSS rules in the email)
    if (doc.querySelector('style')) return false
    // Check for inline style attributes with meaningful properties
    const styledEls = doc.querySelectorAll('[style]')
    for (const el of styledEls) {
      const style = el.getAttribute('style') || ''
      if (/background|bgcolor|color\s*:|font-size|font-family|margin|padding|border/i.test(style)) {
        return false
      }
    }
    // Check for bgcolor attributes on body, table, td, tr, div
    for (const tag of ['body', 'table', 'td', 'tr', 'div', 'center', 'font']) {
      const els = doc.querySelectorAll(tag)
      for (const el of els) {
        if (el.hasAttribute('bgcolor')) return false
        if (el.hasAttribute('text')) return false
        if (el.hasAttribute('link')) return false
        if (el.hasAttribute('vlink')) return false
        if (el.hasAttribute('alink')) return false
      }
    }
    // Check for font tags with color/size attrs
    if (doc.querySelector('font[size], font[color]')) return false
    // Check for <link> tags (often external stylesheets)
    if (doc.querySelector('link[rel="stylesheet"]')) return false
    return true
  }

  try {
    const parser = new DOMParser()
    const document = parser.parseFromString(html, 'text/html')
    const plainText = isPlainTextEmail(document)

    // Plain text email should render as a stable email document, not inherit
    // the app theme. Keep it black-on-white in both light and dark mode.
    const htmlEl = document.documentElement
    const existingBg = htmlEl.getAttribute('style') || ''
    const iframeBg = '#ffffff'
    const iframeFg = '#18181b'
    htmlEl.setAttribute(
      'style',
      existingBg +
        (existingBg ? ' ' : '') +
        `--iframe-bg: ${iframeBg}; --iframe-fg: ${iframeFg}; color-scheme: light;`
    )
    htmlEl.setAttribute('data-plain-text', String(plainText))

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
    const iframeBg = '#ffffff'
    const iframeFg = '#18181b'
    // Fallback: return as-is with fixed email colors.
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <meta http-equiv="Content-Security-Policy" content="script-src 'none'; frame-src 'none'; object-src 'none'; img-src 'self' https: data:;">
  <style>:root{--iframe-bg:${iframeBg};--iframe-fg:${iframeFg};color-scheme:light;}</style>
  <style>${EMAIL_VIEWER_CSS}</style>
</head>
<body>${html}</body>
</html>`.replace('</body>', `${HEIGHT_MEASUREMENT_SCRIPT}</body>`)
  }
}

function htmlToPlainText(html: string): string {
  try {
    const parser = new DOMParser()
    const document = parser.parseFromString(html, 'text/html')
    document.querySelectorAll('script, style, noscript, meta, title').forEach((node) => node.remove())
    return stripHtml(document.body.innerHTML)
  } catch {
    return stripHtml(html)
  }
}

function shouldRenderAsPlainText(html: string, apiPlainText: boolean): boolean {
  if (apiPlainText) return true
  if (/<(img|svg|video|audio|canvas|iframe|form|button|input|select|textarea)\b/i.test(html)) return false

  const text = htmlToPlainText(html)
  if (text.length < 80) return false

  let bodyHtml = html
  try {
    const parser = new DOMParser()
    const document = parser.parseFromString(html, 'text/html')
    document.querySelectorAll('script, style, noscript, meta, title').forEach((node) => node.remove())
    bodyHtml = document.body.innerHTML
  } catch {
    bodyHtml = html.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<style\b[\s\S]*?<\/style>/gi, '')
  }

  const tagNames = Array.from(bodyHtml.matchAll(/<\/?\s*([a-z0-9:-]+)/gi), (match) => match[1].toLowerCase())
  const allowedTextWrapperTags = new Set([
    'div',
    'span',
    'p',
    'pre',
    'br',
    'b',
    'strong',
    'i',
    'em',
    'u',
    'font',
    'center',
    'table',
    'tbody',
    'thead',
    'tfoot',
    'tr',
    'td',
    'th',
    'a',
  ])

  return tagNames.every((tagName) => allowedTextWrapperTags.has(tagName))
}

function MessageBodyContent({ selectedEmail, noPadding }: { selectedEmail: EmailDetail; noPadding?: boolean }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const requestIdRef = useRef(0)
  const [emailHtml, setEmailHtml] = useState<string | null>(null)
  const [isPlainTextHtml, setIsPlainTextHtml] = useState(false)
  const [plainTextBody, setPlainTextBody] = useState('')
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
    const currentRequestId = ++requestIdRef.current

    const loadingTimer = setTimeout(() => {
      setIsLoading(true)
      setEmailHtml(null)
      setError(null)
    }, 0)

    if (selectedEmail.id.startsWith('imap:')) {
      const timer = setTimeout(() => {
        if (currentRequestId !== requestIdRef.current) return
        const html = selectedEmail.body || ''
        const plainText = shouldRenderAsPlainText(html, !selectedEmail.body && Boolean(selectedEmail.bodyPlain))
        setIsPlainTextHtml(plainText)
        setPlainTextBody(plainText ? htmlToPlainText(html) || selectedEmail.bodyPlain : selectedEmail.bodyPlain)
        setEmailHtml(html)
        setIsLoading(false)
      }, 0)

      return () => {
        clearTimeout(loadingTimer)
        clearTimeout(timer)
      }
    }

    const controller = new AbortController()

    fetch(`/api/gmail/body?id=${selectedEmail.id}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const error = await res.json().catch(() => ({})) as { error?: string }
          throw new Error(error.error || 'Failed to load email')
        }
        return res.json()
      })
      .then((data) => {
        // Ignore stale responses from older in-flight requests
        if (currentRequestId !== requestIdRef.current) return
        const html = String(data.html || '')
        const plainText = shouldRenderAsPlainText(html, Boolean(data.plainText))
        setIsPlainTextHtml(plainText)
        setPlainTextBody(plainText ? htmlToPlainText(html) || String(data.bodyPlain || '') : '')
        setEmailHtml(html)
        setIsLoading(false)
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return
        if (currentRequestId !== requestIdRef.current) return
        setError(err instanceof Error ? err.message : 'Failed to load email')
        setIsLoading(false)
      })

    return () => {
      clearTimeout(loadingTimer)
      controller.abort()
    }
  }, [selectedEmail.id, selectedEmail.body, selectedEmail.bodyPlain])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Email body padding belongs to the email surface, so the padded area stays white. */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Email body — non-scrolling wrapper, iframe fills height and scrolls internally */}
        <div
          ref={scrollRef}
          className={`flex-1 min-h-0 ${noPadding ? '' : 'overflow-hidden'}`}
        >
          {isLoading && (
            <div className="mb-3">
              <p className={`font-mono text-xs text-muted-foreground animate-pulse ${noPadding ? 'px-3 pt-3' : 'px-4 pt-4'}`}>
                Loading content...
              </p>
            </div>
          )}

          {error && (
            <div className="mb-3">
              <p className={`font-mono text-xs text-destructive ${noPadding ? 'px-3 pt-3' : 'px-4 pt-4'}`}>
                {error}
              </p>
            </div>
          )}

          {/* HTML email in sandboxed srcdoc iframe */}
          {emailHtml && !isPlainTextHtml && (
            <iframe
              ref={iframeRef}
              className="block w-full border-0"
              style={{
                display: 'block',
                width: '100%',
                height: '100%',
                background: '#ffffff',
                padding: noPadding ? 12 : 16,
                boxSizing: 'border-box',
              }}
              sandbox="allow-scripts allow-same-origin"
              title={`Email: ${selectedEmail.subject}`}
              srcDoc={buildSrcdoc(emailHtml)}
            />
          )}

          {/* Plain text fallback (no HTML body) */}
          {(isPlainTextHtml || (!emailHtml && !isLoading && !error && selectedEmail.bodyPlain)) && (
            <pre className={`min-h-full w-full whitespace-pre-wrap bg-white text-sm text-[#18181b] ${noPadding ? 'p-3' : 'p-4'}`}>
              {plainTextBody || selectedEmail.bodyPlain}
            </pre>
          )}

          {/* No content */}
          {!emailHtml && !isLoading && !error && !selectedEmail.bodyPlain && (
            <div className={noPadding ? 'p-3' : 'p-4'}>
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

export function MessageBody({ noPadding, email }: { noPadding?: boolean; email?: EmailDetail }) {
  const { selectedEmail } = useEmail()
  const message = email ?? selectedEmail

  if (!message) {
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

  return <MessageBodyContent selectedEmail={message} noPadding={noPadding} />
}
