'use client'

import { useState, useEffect } from 'react'
import { useEmail } from '@/contexts/email-context'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

const SIGNATURE_KEY = 'mailie_signature'
const TEMPLATES_KEY = 'mailie_templates'

export interface Template {
  id: string
  name: string
  subject: string
  body: string
  createdAt: number
}

function loadSignature(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(SIGNATURE_KEY) ?? ''
}

function loadTemplates(): Template[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveSignature(sig: string) {
  localStorage.setItem(SIGNATURE_KEY, sig)
}

function saveTemplates(templates: Template[]) {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates))
}

// Hook for compose to get/set signature and templates
export function useSignature() {
  const [signature, setSignatureState] = useState('')
  const [templates, setTemplatesState] = useState<Template[]>([])

  useEffect(() => {
    setSignatureState(loadSignature())
    setTemplatesState(loadTemplates())
  }, [])

  function setSignature(sig: string) {
    saveSignature(sig)
    setSignatureState(sig)
    toast('Signature saved', { duration: 2000 })
  }

  function addTemplate(template: Omit<Template, 'id' | 'createdAt'>) {
    const newTemplate: Template = {
      ...template,
      id: `tmpl_${Date.now()}`,
      createdAt: Date.now(),
    }
    const updated = [newTemplate, ...templates]
    saveTemplates(updated)
    setTemplatesState(updated)
    toast(`Template "${template.name}" saved`, { duration: 2000 })
    return newTemplate
  }

  function deleteTemplate(id: string) {
    const updated = templates.filter((t) => t.id !== id)
    saveTemplates(updated)
    setTemplatesState(updated)
    toast('Template deleted', { duration: 2000 })
  }

  function updateTemplate(id: string, updates: Partial<Omit<Template, 'id' | 'createdAt'>>) {
    const updated = templates.map((t) => t.id === id ? { ...t, ...updates } : t)
    saveTemplates(updated)
    setTemplatesState(updated)
  }

  return {
    signature,
    setSignature,
    templates,
    addTemplate,
    deleteTemplate,
    updateTemplate,
  }
}

// Signature editor dialog component
interface SignatureEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialValue: string
  onSave: (sig: string) => void
}

export function SignatureEditor({ open, onOpenChange, initialValue, onSave }: SignatureEditorProps) {
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    setValue(initialValue)
  }, [initialValue, open])

  function handleSave() {
    onSave(value)
    onOpenChange(false)
  }

  return (
    <div className="space-y-3">
      <p className="font-mono text-[11px] text-[var(--muted-foreground)]">
        This signature will be appended to every email you compose.
        Supports HTML formatting.
      </p>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Best regards,&#10;Anvit"
        className="font-mono text-[13px] min-h-[120px]"
      />
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onOpenChange(false)}
          className="font-mono text-[12px] h-8"
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          className="font-mono text-[12px] h-8 bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90"
        >
          Save Signature
        </Button>
      </div>
    </div>
  )
}

// Template manager component
interface TemplateManagerProps {
  templates: Template[]
  onSelect: (template: Template) => void
  onDelete: (id: string) => void
  onCreateNew: () => void
}

export function TemplateManager({ templates, onSelect, onDelete, onCreateNew }: TemplateManagerProps) {
  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center px-4">
        <p className="font-mono text-[12px] text-[var(--muted-foreground)] mb-3">
          No templates yet
        </p>
        <Button
          size="sm"
          onClick={onCreateNew}
          className="font-mono text-[12px] h-8 bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90"
        >
          Create Template
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
          {templates.length} template{templates.length !== 1 ? 's' : ''}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCreateNew}
          className="h-6 px-2 font-mono text-[11px] text-[var(--accent)]"
        >
          + New
        </Button>
      </div>
      {templates.map((tmpl) => (
        <div
          key={tmpl.id}
          className="flex items-center gap-2 px-3 py-2 rounded-sm border border-[var(--border)] bg-[var(--surface-deep)] hover:bg-[var(--surface-elevated)] transition-colors cursor-pointer group"
          onClick={() => onSelect(tmpl)}
        >
          <div className="flex-1 min-w-0">
            <p className="font-mono text-[12px] text-[var(--foreground)] truncate">{tmpl.name}</p>
            <p className="font-mono text-[10px] text-[var(--muted-foreground)] truncate">{tmpl.subject}</p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(tmpl.id) }}
            className="opacity-0 group-hover:opacity-100 text-[var(--muted-foreground)] hover:text-[var(--destructive)] transition-opacity font-mono text-[11px] shrink-0"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}

// Template editor dialog
interface TemplateEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialTemplate?: Template
  onSave: (template: Omit<Template, 'id' | 'createdAt'>) => void
}

export function TemplateEditor({ open, onOpenChange, initialTemplate, onSave }: TemplateEditorProps) {
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  useEffect(() => {
    if (initialTemplate) {
      setName(initialTemplate.name)
      setSubject(initialTemplate.subject)
      setBody(initialTemplate.body)
    } else {
      setName('')
      setSubject('')
      setBody('')
    }
  }, [initialTemplate, open])

  function handleSave() {
    if (!name.trim() || !subject.trim()) return
    onSave({ name: name.trim(), subject: subject.trim(), body })
    onOpenChange(false)
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label className="font-mono text-[11px] text-[var(--muted-foreground)]">Template Name</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Follow up"
          className="font-mono text-[13px] h-8"
        />
      </div>
      <div className="space-y-1">
        <label className="font-mono text-[11px] text-[var(--muted-foreground)]">Subject</label>
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Re: {{subject}}"
          className="font-mono text-[13px] h-8"
        />
      </div>
      <div className="space-y-1">
        <label className="font-mono text-[11px] text-[var(--muted-foreground)]">Body</label>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Hi {{name}},&#10;&#10;..."
          className="font-mono text-[13px] min-h-[150px]"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onOpenChange(false)}
          className="font-mono text-[12px] h-8"
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!name.trim() || !subject.trim()}
          className="font-mono text-[12px] h-8 bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90"
        >
          Save Template
        </Button>
      </div>
    </div>
  )
}