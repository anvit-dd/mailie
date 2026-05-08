'use client'

import { type Editor } from '@tiptap/react'
import { NodeSelection } from '@tiptap/pm/state'
import {
  Bold, Italic, Underline, Strikethrough, Code,
  List, ListOrdered, Quote, Minus, Undo, Redo,
  Image, AlignLeft, AlignCenter, AlignRight,
  ChevronDown, Palette, Highlighter, ArrowLeft, Crop,
  Shrink, Expand
} from 'lucide-react'
import ReactCrop, { type Crop as CropType, centerCrop, makeAspectCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { Button } from '@/components/ui/button'
import { clsx } from 'clsx'
import { useState, useRef } from 'react'
import {
  PopoverRoot,
  PopoverTrigger,
  PopoverPortal,
  PopoverPositioner,
  PopoverContent,
} from '@/components/ui/popover'

interface ComposeToolbarProps {
  editor: Editor
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

type ImageAlign = 'left' | 'center' | 'right'

function normalizeImageAlign(value: unknown): ImageAlign {
  return value === 'center' || value === 'right' ? value : 'left'
}

function getActiveImageAttrs(editor: Editor): { src?: string; width?: number; height?: number; align: ImageAlign } | null {
  const node = editor.state.selection instanceof NodeSelection ? editor.state.selection.node : null
  if (node?.type.name === 'image') {
    return {
      src: typeof node.attrs.src === 'string' ? node.attrs.src : undefined,
      width: toNumber(node.attrs.width),
      height: toNumber(node.attrs.height),
      align: normalizeImageAlign(node.attrs.align),
    }
  }

  if (!editor.isActive('image')) return null

  const attrs = editor.getAttributes('image')
  if (!attrs.src) return null

  return {
    src: typeof attrs.src === 'string' ? attrs.src : undefined,
    width: toNumber(attrs.width),
    height: toNumber(attrs.height),
    align: normalizeImageAlign(attrs.align),
  }
}

function resizeSelectedImage(editor: Editor, scale: number) {
  const attrs = getActiveImageAttrs(editor)
  if (!attrs) return

  const width = attrs.width ?? 320
  const height = attrs.height ?? 240
  const nextWidth = Math.max(80, Math.min(720, Math.round(width * scale)))
  const nextHeight = Math.max(60, Math.round(height * (nextWidth / width)))

  editor.chain().focus().updateAttributes('image', {
    width: nextWidth,
    height: nextHeight,
  }).run()
}

function setImageAlign(editor: Editor, align: ImageAlign) {
  editor.chain().focus().updateAttributes('image', { align }).run()

  requestAnimationFrame(() => {
    const container = editor.view.dom.querySelector<HTMLElement>(
      '.ProseMirror-selectednode[data-resize-container]'
    )
    if (container) {
      container.dataset.align = align
      container.querySelector('img')?.setAttribute('data-align', align)
    }
  })
}

function getImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const image = new window.Image()
    image.onload = () => {
      const maxWidth = 480
      const naturalWidth = image.naturalWidth || maxWidth
      const naturalHeight = image.naturalHeight || maxWidth
      const scale = naturalWidth > maxWidth ? maxWidth / naturalWidth : 1

      resolve({
        width: Math.round(naturalWidth * scale),
        height: Math.round(naturalHeight * scale),
      })
    }
    image.onerror = () => resolve({ width: 320, height: 240 })
    image.src = src
  })
}

// --- Font families ---
const FONT_FAMILIES = [
  { label: 'Sans-serif', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Serif', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Mono', value: '"Courier New", Courier, monospace' },
  { label: 'Impact', value: 'Impact, Haettenschweiler, sans-serif' },
  { label: 'Comic', value: '"Comic Sans MS", cursive, sans-serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
]

// --- Font sizes ---
const FONT_SIZES = [
  { label: 'Small', value: '12px' },
  { label: 'Normal', value: '14px' },
  { label: 'Large', value: '18px' },
  { label: 'Huge', value: '24px' },
]

// --- Text color palette (Zed + email-safe colors) ---
const TEXT_COLORS = [
  '#18181b', '#71717a', '#EF4444', '#F97316', '#EAB308',
  '#22C55E', '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899',
  '#FFFFFF', '#A9AFBC',
]

// --- Highlight colors ---
const HIGHLIGHT_COLORS = [
  '#EAB308', '#22C55E', '#F97316', '#EF4444', '#3B82F6',
  '#8B5CF6', '#EC4899', '#06B6D4', '#18181b',
]

// Separator component
function Sep() {
  return <div className="w-px h-4 bg-border mx-0.5 shrink-0" />
}

// Toolbar button
function TbBtn({
  onClick,
  isActive,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  isActive?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      disabled={disabled}
      title={title}
      type="button"
      className={clsx(
        'h-7 w-7 shrink-0',
        isActive && 'bg-accent/20 text-accent'
      )}
    >
      {children}
    </Button>
  )
}

// Dropdown select button
function TbSelect({
  value,
  onChange,
  options,
  title,
}: {
  value: string
  onChange: (v: string) => void
  options: Array<{ label: string; value: string }>
  title?: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      title={title}
      className="h-7 pl-2 pr-6 border border-border bg-background text-xs font-mono text-foreground outline-none focus:border-accent appearance-none cursor-pointer rounded-sm shrink-0"
      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23A9AFBC' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center' }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}

// Color swatch picker popover
function ColorPicker({
  colors,
  currentColor,
  onSelect,
  title,
  icon,
}: {
  colors: string[]
  currentColor?: string
  onSelect: (color: string) => void
  title: string
  icon: React.ReactNode
}) {
  return (
    <PopoverRoot>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            title={title}
            type="button"
            className={clsx(
              'h-7 w-7 shrink-0 relative',
              currentColor && 'text-accent'
            )}
          >
            {icon}
            {currentColor && (
              <span
                className="absolute bottom-0.5 left-0.5 right-0.5 h-0.5 rounded-full"
                style={{ backgroundColor: currentColor }}
              />
            )}
          </Button>
        }
      />
      <PopoverPortal>
        <PopoverPositioner side="bottom" align="start" sideOffset={4}>
          <PopoverContent className="p-2 bg-background border-border rounded-sm w-auto">
            <p className="font-mono text-[10px] text-muted-foreground mb-2 uppercase tracking-widest">{title}</p>
            <div className="grid grid-cols-6 gap-1">
          {colors.map((color) => (
            <button
              key={color}
              title={color}
              onClick={() => onSelect(color)}
              className={clsx(
                'w-6 h-6 rounded-sm border border-transparent hover:border-accent transition-colors',
                currentColor === color && 'border-accent'
              )}
              style={{
                backgroundColor: color,
                border: color === '#FFFFFF' ? '1px solid #d4d4d8' : undefined,
              }}
              type="button"
            />
          ))}
        </div>
        {/* Clear color button */}
        <button
          onClick={() => onSelect('')}
          className="mt-2 w-full font-mono text-[10px] text-muted-foreground hover:text-foreground text-left px-1 py-0.5 rounded hover:bg-surface-elevated transition-colors"
          type="button"
        >
          Clear
        </button>
          </PopoverContent>
        </PopoverPositioner>
      </PopoverPortal>
    </PopoverRoot>
  )
}

// Remove color from mark
function removeColor(mark: string, editor: Editor) {
  editor.chain().focus().extendMarkRange(mark).unsetMark(mark).run()
}

export function ComposeToolbar({ editor }: ComposeToolbarProps) {
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [cropModalSrc, setCropModalSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState<CropType>()

  // Current active states
  const isInHeading = editor.isActive('heading')
  const currentHeadingLevel = isInHeading
    ? (editor.getAttributes('heading').level as 1 | 2 | 3 | undefined)
    : undefined
  const currentFontFamily = editor.getAttributes('textStyle').fontFamily as string | undefined
  const currentFontSize = editor.getAttributes('textStyle').fontSize as string | undefined
  const currentTextColor = editor.getAttributes('textStyle').color as string | undefined
  const currentHighlightColor = editor.getAttributes('highlight').color as string | undefined
  const activeImage = getActiveImageAttrs(editor)
  const currentTextAlign = activeImage?.align ?? (editor.getAttributes('paragraph').textAlign as string | undefined)

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
    reader.onload = async (ev) => {
      const src = ev.target?.result as string
      const { width, height } = await getImageDimensions(src)
      editor.chain().focus().setImage({ src, width, height }).run()
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function handleFontFamilyChange(value: string) {
    editor.chain().focus().extendMarkRange('textStyle').setFontFamily(value).run()
  }

  function handleFontSizeChange(value: string) {
    editor.chain().focus().extendMarkRange('textStyle').setFontSize(value).run()
  }

  function handleTextColor(color: string) {
    editor.chain().focus().extendMarkRange('textStyle').setColor(color).run()
  }

  function handleHighlight(color: string) {
    editor.chain().focus().extendMarkRange('highlight').setHighlight({ color }).run()
  }

  function handleHeading(level: 1 | 2 | 3 | 0) {
    if (level === 0) {
      editor.chain().focus().setParagraph().run()
    } else {
      editor.chain().focus().setHeading({ level }).run()
    }
  }

  const headingLabel = isInHeading ? `H${currentHeadingLevel}` : 'Para'
  const fontFamilyLabel = FONT_FAMILIES.find((f) => f.value === currentFontFamily)?.label ?? 'Sans'
  const fontSizeLabel = FONT_SIZES.find((s) => s.value === currentFontSize)?.label ?? 'Normal'

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

      <div className="flex flex-col gap-1.5 mb-3 pb-2 border-b border-border">
        {/* Row 1 — history, inline formatting, font controls */}
        <div className="flex items-center gap-0.5 flex-wrap">
          {/* History */}
          <TbBtn
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Undo"
          >
            <Undo className="w-3.5 h-3.5" />
          </TbBtn>
          <TbBtn
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Redo"
          >
            <Redo className="w-3.5 h-3.5" />
          </TbBtn>

          <Sep />

          {/* Inline format group */}
          <TbBtn
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive('bold')}
            title="Bold"
          >
            <Bold className="w-3.5 h-3.5" />
          </TbBtn>
          <TbBtn
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive('italic')}
            title="Italic"
          >
            <Italic className="w-3.5 h-3.5" />
          </TbBtn>
          <TbBtn
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            isActive={editor.isActive('underline')}
            title="Underline"
          >
            <Underline className="w-3.5 h-3.5" />
          </TbBtn>
          <TbBtn
            onClick={() => editor.chain().focus().toggleStrike().run()}
            isActive={editor.isActive('strike')}
            title="Strikethrough"
          >
            <Strikethrough className="w-3.5 h-3.5" />
          </TbBtn>
          <TbBtn
            onClick={() => editor.chain().focus().toggleCode().run()}
            isActive={editor.isActive('code')}
            title="Inline code"
          >
            <Code className="w-3.5 h-3.5" />
          </TbBtn>

          <Sep />

          {/* Heading + font family + font size in one cluster */}
          {/* Heading selector */}
          <PopoverRoot>
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  title="Heading"
                  type="button"
                  className={clsx(
                    'h-7 px-2 w-auto gap-1 shrink-0 font-mono text-[11px]',
                    isInHeading ? 'text-accent bg-accent/10' : 'text-foreground'
                  )}
                >
                  {headingLabel}
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                </Button>
              }
            />
            <PopoverPortal>
              <PopoverPositioner side="bottom" align="start" sideOffset={4}>
                <PopoverContent className="p-1 bg-background border-border rounded-sm w-32">
                  {[
                    { label: 'Paragraph', level: 0 as const },
                    { label: 'Heading 1', level: 1 as const },
                    { label: 'Heading 2', level: 2 as const },
                    { label: 'Heading 3', level: 3 as const },
                  ].map(({ label, level }) => (
                    <button
                      key={level}
                      onClick={() => handleHeading(level)}
                      className={clsx(
                        'w-full text-left px-2 py-1 font-mono text-xs hover:bg-surface-elevated rounded-sm transition-colors',
                        (level === 0 && !isInHeading) || currentHeadingLevel === level
                          ? 'text-accent'
                          : 'text-foreground'
                      )}
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </PopoverContent>
              </PopoverPositioner>
            </PopoverPortal>
          </PopoverRoot>

          {/* Font family */}
          <TbSelect
            value={currentFontFamily ?? ''}
            onChange={handleFontFamilyChange}
            options={FONT_FAMILIES.map((f) => ({
              label: f.label,
              value: f.value,
            }))}
            title="Font family"
          />

          {/* Font size */}
          <TbSelect
            value={currentFontSize ?? ''}
            onChange={handleFontSizeChange}
            options={FONT_SIZES.map((f) => ({
              label: f.label,
              value: f.value,
            }))}
            title="Font size"
          />

          <Sep />

          {/* Text color */}
          <ColorPicker
            colors={TEXT_COLORS}
            currentColor={currentTextColor}
            onSelect={handleTextColor}
            title="Text color"
            icon={<Palette className="w-3.5 h-3.5" />}
          />

          {/* Highlight */}
          <ColorPicker
            colors={HIGHLIGHT_COLORS}
            currentColor={currentHighlightColor}
            onSelect={handleHighlight}
            title="Highlight"
            icon={<Highlighter className="w-3.5 h-3.5" />}
          />

          <Sep />

          {/* Text alignment */}
          <TbBtn
            onClick={() => activeImage ? setImageAlign(editor, 'left') : editor.chain().focus().setTextAlign('left').run()}
            isActive={currentTextAlign === 'left'}
            title="Align left"
          >
            <AlignLeft className="w-3.5 h-3.5" />
          </TbBtn>
          <TbBtn
            onClick={() => activeImage ? setImageAlign(editor, 'center') : editor.chain().focus().setTextAlign('center').run()}
            isActive={currentTextAlign === 'center'}
            title="Align center"
          >
            <AlignCenter className="w-3.5 h-3.5" />
          </TbBtn>
          <TbBtn
            onClick={() => activeImage ? setImageAlign(editor, 'right') : editor.chain().focus().setTextAlign('right').run()}
            isActive={currentTextAlign === 'right'}
            title="Align right"
          >
            <AlignRight className="w-3.5 h-3.5" />
          </TbBtn>
        </div>

        {/* Row 2 — block elements, lists, insert */}
        <div className="flex items-center gap-0.5 flex-wrap">
          {/* Block elements */}
          <TbBtn
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            isActive={editor.isActive('blockquote')}
            title="Quote"
          >
            <Quote className="w-3.5 h-3.5" />
          </TbBtn>
          <TbBtn
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="Horizontal rule"
          >
            <Minus className="w-3.5 h-3.5" />
          </TbBtn>

          <Sep />

          {/* Lists */}
          <TbBtn
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive('bulletList')}
            title="Bullet list"
          >
            <List className="w-3.5 h-3.5" />
          </TbBtn>
          <TbBtn
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive('orderedList')}
            title="Ordered list"
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </TbBtn>

          <Sep />

          {/* Link + image insert */}
          <TbBtn
            onClick={() => {
              if (editor.isActive('link')) {
                editor.chain().focus().unsetLink().run()
              } else {
                setShowLinkInput(true)
              }
            }}
            isActive={editor.isActive('link')}
            title={editor.isActive('link') ? 'Remove link' : 'Insert link'}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </TbBtn>
          <TbBtn
            onClick={handleImageAttach}
            title="Insert image"
          >
            <Image className="w-3.5 h-3.5" />
          </TbBtn>
          <TbBtn
            onClick={() => {
              if (activeImage?.src) setCropModalSrc(activeImage.src)
            }}
            isActive={false}
            disabled={!activeImage?.src}
            title="Crop image"
          >
            <Crop className="w-3.5 h-3.5" />
          </TbBtn>
          <TbBtn
            onClick={() => resizeSelectedImage(editor, 0.85)}
            disabled={!activeImage}
            title="Shrink image"
          >
            <Shrink className="w-3.5 h-3.5" />
          </TbBtn>
          <TbBtn
            onClick={() => resizeSelectedImage(editor, 1.15)}
            disabled={!activeImage}
            title="Expand image"
          >
            <Expand className="w-3.5 h-3.5" />
          </TbBtn>

          {/* Inline link input */}
          {showLinkInput && (
            <div className="flex items-center gap-1 ml-1">
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') insertLink()
                  if (e.key === 'Escape') setShowLinkInput(false)
                }}
                placeholder="https://..."
                autoFocus
                className="h-7 w-48 border border-border bg-background rounded-sm px-2 font-mono text-xs outline-none focus:border-accent"
              />
              <TbBtn onClick={insertLink} title="Apply link">
                <ArrowLeft className="w-3.5 h-3.5" />
              </TbBtn>
              <TbBtn onClick={() => setShowLinkInput(false)} title="Cancel">
                <span className="font-mono text-[10px]">✕</span>
              </TbBtn>
            </div>
          )}
        </div>
      </div>

      {/* Image crop modal */}
      {cropModalSrc && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70">
          <div className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-2xl max-w-lg w-full mx-4 max-h-[80dvh] overflow-auto">
            <div className="flex items-center justify-between">
              <p className="font-mono text-sm font-semibold text-foreground">Crop Image</p>
              <button
                type="button"
                onClick={() => { setCropModalSrc(null); setCrop(undefined) }}
                className="w-6 h-6 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="flex justify-center overflow-auto">
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                className="max-w-full"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cropModalSrc} alt="Crop preview" />
              </ReactCrop>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setCropModalSrc(null); setCrop(undefined) }}
                className="font-mono text-xs h-7"
              >
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                disabled={!crop || !crop.width || !crop.height}
                onClick={async () => {
                  if (!crop || !crop.width || !crop.height) return

                  // Create an offscreen canvas to apply the crop
                  const img = new window.Image()
                  img.crossOrigin = 'anonymous'
                  img.src = cropModalSrc
                  await new Promise<void>((resolve, reject) => {
                    img.onload = () => resolve()
                    img.onerror = reject
                  })

                  const canvas = document.createElement('canvas')
                  const scaleX = img.naturalWidth / img.width
                  const scaleY = img.naturalHeight / img.height
                  canvas.width = (crop.width / 100) * img.width * scaleX
                  canvas.height = (crop.height / 100) * img.height * scaleY

                  const ctx = canvas.getContext('2d')!
                  ctx.drawImage(
                    img,
                    (crop.x / 100) * img.width * scaleX,
                    (crop.y / 100) * img.height * scaleY,
                    canvas.width,
                    canvas.height,
                    0,
                    0,
                    canvas.width,
                    canvas.height
                  )

                  const croppedDataUrl = canvas.toDataURL('image/png')

                  // Replace the selected image node with the cropped data URL
                  if (getActiveImageAttrs(editor)) {
                    const { width, height } = await getImageDimensions(croppedDataUrl)
                    editor.chain().focus().updateAttributes('image', {
                      src: croppedDataUrl,
                      width,
                      height,
                    }).run()
                  }

                  setCropModalSrc(null)
                  setCrop(undefined)
                }}
                className="font-mono text-xs h-7 bg-accent text-background hover:bg-accent/90"
              >
                Apply Crop
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
