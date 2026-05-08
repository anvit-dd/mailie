'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { X, FileText, File, Image, FileSpreadsheet, Eye } from 'lucide-react'

interface AttachmentPreviewProps {
  attachments: Array<{ id: string; filename: string; mimeType: string; size: number; url?: string }>
  messageId: string
  onClose: () => void
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return Image
  if (mimeType.includes('pdf')) return FileText
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return FileSpreadsheet
  return File
}

function getPreviewUrl(attachment: { id: string; filename: string; mimeType: string; url?: string }, messageId: string): string {
  if (attachment.url) return attachment.url
  // For Gmail attachments, use the attachment API
  return `/api/gmail/attachment?messageId=${encodeURIComponent(messageId)}&attachmentId=${encodeURIComponent(attachment.id)}`
}

function AttachmentThumbnail({ attachment, messageId, onPreview }: {
  attachment: { id: string; filename: string; mimeType: string; size: number; url?: string }
  messageId: string
  onPreview: (att: typeof attachment) => void
}) {
  const isImage = attachment.mimeType.startsWith('image/')
  const Icon = getFileIcon(attachment.mimeType)
  const previewUrl = getPreviewUrl(attachment, messageId)

  if (isImage) {
    return (
      <div className="relative group inline-block">
        <img
          src={previewUrl}
          alt={attachment.filename}
          className="w-20 h-20 object-cover rounded-sm border border-[var(--border)] cursor-pointer hover:border-[var(--accent)] transition-colors"
          onClick={() => onPreview(attachment)}
          onError={(e) => {
            // Fallback to icon if image fails to load
            const target = e.currentTarget
            target.style.display = 'none'
            const parent = target.parentElement
            if (parent) {
              const iconDiv = document.createElement('div')
              iconDiv.className = 'w-20 h-20 flex flex-col items-center justify-center rounded-sm border border-[var(--border)] bg-[var(--surface-deep)] cursor-pointer'
              iconDiv.innerHTML = `<span class="text-[var(--muted-foreground)]"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg></span>`
              parent.appendChild(iconDiv)
            }
          }}
        />
        <button
          onClick={() => onPreview(attachment)}
          className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-sm"
        >
          <Eye className="w-5 h-5 text-white" />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => onPreview(attachment)}
      className="w-20 h-20 flex flex-col items-center justify-center rounded-sm border border-[var(--border)] bg-[var(--surface-deep)] hover:border-[var(--accent)] transition-colors cursor-pointer"
    >
      <Icon className="w-8 h-8 text-[var(--muted-foreground)] mb-1" />
      <span className="font-mono text-[9px] text-[var(--muted-foreground)] text-center px-1 truncate w-full">
        {attachment.filename.split('.').pop()?.toUpperCase() || 'FILE'}
      </span>
    </button>
  )
}

export function AttachmentPreview({ attachments, messageId, onClose }: AttachmentPreviewProps) {
  const [previewAttachment, setPreviewAttachment] = useState<typeof attachments[0] | null>(null)
  const isImage = previewAttachment?.mimeType.startsWith('image/')
  const previewUrl = previewAttachment ? getPreviewUrl(previewAttachment, messageId) : ''

  return (
    <>
      {/* Thumbnail strip */}
      <div className="flex flex-wrap gap-2 p-3 border-t border-[var(--border)]">
        {attachments.map((att) => (
          <AttachmentThumbnail
            key={att.id}
            attachment={att}
            messageId={messageId}
            onPreview={setPreviewAttachment}
          />
        ))}
      </div>

      {/* Full preview dialog */}
      <Dialog open={!!previewAttachment} onOpenChange={(open) => !open && setPreviewAttachment(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col bg-[var(--card)] border-[var(--border)] p-0">
          <DialogHeader className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <DialogTitle className="font-mono text-[13px] text-[var(--foreground)] truncate max-w-[400px]">
              {previewAttachment?.filename}
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPreviewAttachment(null)}
              className="h-7 w-7 shrink-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </DialogHeader>

          <div className="flex-1 overflow-auto flex items-center justify-center p-4">
            {previewAttachment && (
              isImage ? (
                <img
                  src={previewUrl}
                  alt={previewAttachment.filename}
                  className="max-w-full max-h-full object-contain"
                />
              ) : previewAttachment.mimeType.includes('pdf') ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-full min-h-[400px]"
                  title={previewAttachment.filename}
                />
              ) : previewAttachment.mimeType.startsWith('text/') || previewAttachment.mimeType.includes('csv') ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-full min-h-[400px]"
                  title={previewAttachment.filename}
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-center">
                  <File className="w-16 h-16 text-[var(--muted-foreground)]" />
                  <p className="font-mono text-[13px] text-[var(--foreground)]">{previewAttachment.filename}</p>
                  <p className="font-mono text-[11px] text-[var(--muted-foreground)]">
                    {(previewAttachment.size / 1024).toFixed(1)} KB
                  </p>
                  <a
                    href={previewUrl}
                    download={previewAttachment.filename}
                    className="font-mono text-[12px] text-[var(--accent)] hover:underline"
                  >
                    Download to view
                  </a>
                </div>
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}