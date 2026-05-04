'use client'

import { useEmail } from '@/contexts/email-context'
import { File, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useEffect, useRef, useState } from 'react'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function buildSrcdoc(html: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="script-src 'none'; frame-src 'none'; object-src 'none';">
  <style>
    /* Reset */
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; }

    body {
      background: #0c0c0c;
      color: #d0d0d0;
      font-family: 'Geist Mono', 'SF Mono', 'Fira Code', 'Fira Mono', 'Roboto Mono', monospace;
      font-size: 14px;
      line-height: 1.65;
      padding: 0;
      word-break: break-word;
      overflow-wrap: break-word;
    }

    /* Dark-mode overrides — neutralize white backgrounds, preserve readability */
    body, td, th, div, p, span, font {
      background-color: #0c0c0c !important;
      color: #d0d0d0 !important;
      border-color: #2a2a2a !important;
    }

    /* Preserve white text for links */
    a { color: #ffffff !important; text-decoration: underline; }

    /* Typography */
    p { margin: 0 0 1em 0; line-height: 1.6; }
    h1, h2, h3, h4, h5, h6 {
      color: #ffffff !important;
      font-weight: 600;
      margin: 1.2em 0 0.5em 0;
      line-height: 1.3;
    }
    h1 { font-size: 1.4em; } h2 { font-size: 1.2em; } h3 { font-size: 1.05em; }
    ul, ol { margin: 0.8em 0; padding-left: 1.5em; }
    li { margin: 0.25em 0; }
    blockquote {
      border-left: 3px solid #444 !important;
      padding-left: 14px;
      margin: 1em 0;
      color: #888 !important;
      background: transparent !important;
    }
    pre {
      background: #1a1a1a !important;
      border: 1px solid #2a2a2a !important;
      border-radius: 2px;
      padding: 12px;
      overflow-x: auto;
      margin: 1em 0;
      font-size: 0.85em;
      color: #d0d0d0 !important;
    }
    code {
      background: #1a1a1a !important;
      border: 1px solid #2a2a2a !important;
      border-radius: 2px;
      padding: 1px 5px;
      font-size: 0.85em;
      color: #d0d0d0 !important;
    }
    pre code { background: none !important; border: none !important; padding: 0; }
    img { max-width: 100%; height: auto; display: block; margin: 0.5em 0; }
    hr { border: none; border-top: 1px solid #2a2a2a !important; margin: 1.5em 0; }

    /* Tables — common in email HTML, must respect container width */
    table {
      border-collapse: collapse !important;
      width: 100% !important;
      max-width: 100% !important;
      font-size: 0.875em;
      margin: 1em 0;
    }
    td, th {
      border: 1px solid #2a2a2a !important;
      padding: 8px 12px;
      text-align: left;
      background: transparent !important;
      color: #d0d0d0 !important;
    }
    th {
      background: #1a1a1a !important;
      font-weight: 600;
      color: #ffffff !important;
    }
    tr:nth-child(even) td { background: #111111 !important; }

    /* Gmail/email structural elements — be snug */
    td > p:last-child, div > p:last-child { margin-bottom: 0; }
    td, th { vertical-align: top; }

    /* Ensure links are readable */
    font[color] { color: inherit !important; }

    /* Hide elements that override our dark bg */
    [style*="background: white"], [style*="background:#fff"], [style*="background-color:#fff"] {
      background-color: #0c0c0c !important;
    }

    /* srcdoc iframe auto-height marker */
    html::after {
      content: '';
      display: block;
      height: 0;
    }
  </style>
</head>
<body>${html}</body>
</html>`
}

export function MessageBody() {
  const { selectedEmail } = useEmail()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [iframeHeight, setIframeHeight] = useState(400)
  const [emailHtml, setEmailHtml] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch email body HTML when a new email is selected
  useEffect(() => {
    if (!selectedEmail?.id || !selectedEmail.body) {
      setEmailHtml(null)
      return
    }

    setIsLoading(true)
    setError(null)
    setEmailHtml(null)

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
        if (err.name === 'AbortError') return
        setError(err.message)
        setIsLoading(false)
      })

    return () => controller.abort()
  }, [selectedEmail?.id])

  // Resize iframe to content using postMessage
  useEffect(() => {
    if (!emailHtml || !iframeRef.current) return

    const iframe = iframeRef.current

    const handleLoad = () => {
      try {
        // srcdoc iframe is same-origin enough to read scrollHeight
        const doc = iframe.contentDocument
        if (doc && doc.body) {
          // Add padding to scrollHeight
          const height = doc.body.scrollHeight + 20
          setIframeHeight(Math.min(Math.max(height, 200), 1200))
        }
      } catch {
        setIframeHeight(500)
      }
    }

    iframe.addEventListener('load', handleLoad)
    return () => iframe.removeEventListener('load', handleLoad)
  }, [emailHtml])

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

  return (
    <div className="flex flex-col h-full">
      {/* Email body — scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-4">
          {isLoading && (
            <p className="font-mono text-xs text-muted-foreground mb-3 animate-pulse">
              Loading content...
            </p>
          )}

          {error && (
            <p className="font-mono text-xs text-destructive mb-3">
              {error}
            </p>
          )}

          {/* HTML email in sandboxed srcdoc iframe */}
          {emailHtml && (
            <iframe
              ref={iframeRef}
              className="w-full border-0 bg-[#0c0c0c]"
              style={{ height: `${iframeHeight}px` }}
              sandbox="allow-same-origin"
              title={`Email: ${selectedEmail.subject}`}
              srcDoc={buildSrcdoc(emailHtml)}
            />
          )}

          {/* Plain text fallback (no HTML body) */}
          {!emailHtml && !isLoading && !error && selectedEmail.bodyPlain && (
            <pre className="font-mono text-sm whitespace-pre-wrap text-[#d0d0d0]">
              {selectedEmail.bodyPlain}
            </pre>
          )}

          {/* No content */}
          {!emailHtml && !isLoading && !error && !selectedEmail.bodyPlain && (
            <p className="font-mono text-sm text-muted-foreground italic">
              No content
            </p>
          )}
        </div>
      </div>

      {/* Attachments — fixed at bottom */}
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
  )
}
