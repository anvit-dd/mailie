export interface EmailAddress {
  name: string
  email: string
}

export interface Attachment {
  id: string
  filename: string
  mimeType: string
  size: number
  url?: string
}

export interface Email {
  id: string
  threadId: string
  from: EmailAddress
  to: EmailAddress[]
  subject: string
  preview: string
  date: Date
  isRead: boolean
  isStarred: boolean
  labels: string[]
  hasAttachments: boolean
}

export interface EmailDetail extends Email {
  body: string
  bodyPlain: string
  bodyHtml?: string // Used by test emails to store HTML directly
  attachments: Attachment[]
  headers: Record<string, string>
  references?: string[]
  inReplyTo?: string
}

export interface Folder {
  id: string
  name: string
  icon: string
  unreadCount: number
}

export interface Account {
  email: string
  name: string
  picture?: string
}

export interface Draft {
  id?: string
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  body: string
  references?: string
  inReplyTo?: string
  originalMessageId?: string
}
