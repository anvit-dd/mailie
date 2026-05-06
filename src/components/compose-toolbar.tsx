'use client'

import { type Editor } from '@tiptap/react'
import {
  Bold, Italic, Underline, Strikethrough, Code, Link,
  List, ListOrdered, Quote, Minus, Undo, Redo,
  Image, Heading1, Heading2, Heading3, CodeSquare
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { clsx } from 'clsx'
import { useState, useRef } from 'react'

interface ComposeToolbarProps {
  editor: Editor
}

export function ComposeToolbar({ editor }: ComposeToolbarProps) {
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const imageInputRef = useRef<HTMLInputElement>(null)

  function insertLink() {
    if (!linkUrl) return
    const url = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    setLinkUrl('')
    setShowLinkInput(false)
  }

  function handleImageAttach() {
    imageInputRef.current?.click()
  }

  function handleImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const src = ev.target?.result as string
      editor.chain().focus().setImage({ src }).run()
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // Group toolbar buttons into logical rows
  const row1: Array<{ icon: React.ReactNode; label: string; action: () => void; isActive?: boolean; disabled?: boolean }> = [
    {
      icon: <Undo className="w-4 h-4" />,
      label: 'Undo',
      action: () => editor.chain().focus().undo().run(),
      disabled: !editor.can().undo(),
    },
    {
      icon: <Redo className="w-4 h-4" />,
      label: 'Redo',
      action: () => editor.chain().focus().redo().run(),
      disabled: !editor.can().redo(),
    },
    { icon: <Heading1 className="w-4 h-4" />, label: 'H1', action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), isActive: editor.isActive('heading', { level: 1 }) },
    { icon: <Heading2 className="w-4 h-4" />, label: 'H2', action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), isActive: editor.isActive('heading', { level: 2 }) },
    { icon: <Heading3 className="w-4 h-4" />, label: 'H3', action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), isActive: editor.isActive('heading', { level: 3 }) },
    { icon: <Bold className="w-4 h-4" />, label: 'Bold', action: () => editor.chain().focus().toggleBold().run(), isActive: editor.isActive('bold') },
    { icon: <Italic className="w-4 h-4" />, label: 'Italic', action: () => editor.chain().focus().toggleItalic().run(), isActive: editor.isActive('italic') },
    { icon: <Underline className="w-4 h-4" />, label: 'Underline', action: () => editor.chain().focus().toggleUnderline().run(), isActive: editor.isActive('underline') },
    { icon: <Strikethrough className="w-4 h-4" />, label: 'Strikethrough', action: () => editor.chain().focus().toggleStrike().run(), isActive: editor.isActive('strike') },
    { icon: <Code className="w-4 h-4" />, label: 'Inline code', action: () => editor.chain().focus().toggleCode().run(), isActive: editor.isActive('code') },
    { icon: <CodeSquare className="w-4 h-4" />, label: 'Code block', action: () => editor.chain().focus().toggleCodeBlock().run(), isActive: editor.isActive('codeBlock') },
  ]

  const row2: Array<{ icon: React.ReactNode; label: string; action: () => void; isActive?: boolean }> = [
    { icon: <Quote className="w-4 h-4" />, label: 'Quote', action: () => editor.chain().focus().toggleBlockquote().run(), isActive: editor.isActive('blockquote') },
    {
      icon: <Minus className="w-4 h-4" />,
      label: 'Horizontal rule',
      action: () => editor.chain().focus().setHorizontalRule().run(),
    },
    { icon: <List className="w-4 h-4" />, label: 'Bullet list', action: () => editor.chain().focus().toggleBulletList().run(), isActive: editor.isActive('bulletList') },
    { icon: <ListOrdered className="w-4 h-4" />, label: 'Ordered list', action: () => editor.chain().focus().toggleOrderedList().run(), isActive: editor.isActive('orderedList') },
    {
      icon: <Link className="w-4 h-4" />,
      label: 'Link',
      action: () => {
        if (editor.isActive('link')) {
          editor.chain().focus().unsetLink().run()
        } else {
          setShowLinkInput(true)
        }
      },
      isActive: editor.isActive('link'),
    },
    { icon: <Image className="w-4 h-4" />, label: 'Insert image', action: handleImageAttach },
  ]

  return (
    <>
      {/* Hidden file input for inline images */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageFileChange}
      />

      <div className="flex flex-col gap-1 mb-3 pb-2 border-b border-border">
        {/* Row 1 — text formatting */}
        <div className="flex items-center gap-0.5 flex-wrap">
          {row1.map(({ icon, label, action, isActive, disabled }) => (
            <Button
              key={label}
              variant="ghost"
              size="icon"
              className={clsx(
                'h-7 w-7 shrink-0',
                isActive && 'bg-accent/20 text-accent'
              )}
              onClick={action}
              disabled={disabled}
              title={label}
              type="button"
            >
              {icon}
            </Button>
          ))}
        </div>

        {/* Row 2 — block elements */}
        <div className="flex items-center gap-0.5 flex-wrap">
          {row2.map(({ icon, label, action, isActive }) => (
            <Button
              key={label}
              variant="ghost"
              size="icon"
              className={clsx(
                'h-7 w-7 shrink-0',
                isActive && 'bg-accent/20 text-accent'
              )}
              onClick={action}
              title={label}
              type="button"
            >
              {icon}
            </Button>
          ))}

          {/* Link input inline */}
          {showLinkInput && (
            <div className="flex items-center gap-1 ml-1">
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') insertLink(); if (e.key === 'Escape') setShowLinkInput(false) }}
                placeholder="https://..."
                autoFocus
                className="h-7 w-48 border border-border bg-background rounded-sm px-2 font-mono text-xs outline-none focus:border-accent"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={insertLink}
                type="button"
              >
                <Link className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => setShowLinkInput(false)}
                type="button"
              >
                <span className="font-mono text-xs">✕</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
