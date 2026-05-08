// Unified mail provider abstraction — Gmail and SMTP/IMAP both implement this interface.

export interface ListMessagesParams {
  folder: string
  query?: string
  pageToken?: string
  limit?: number
  // IMAP filter params (smtp_imap only)
  from?: string
  to?: string
  hasAttachment?: boolean
  unread?: boolean
  starred?: boolean
  dateAfter?: string
  dateBefore?: string
}

export interface ListMessagesResult {
  messages: Email[]
  nextPageToken: string | null
  total?: number
}

export interface Email {
  id: string
  threadId: string
  subject: string
  preview: string
  from: { name: string; email: string }
  to: { name: string; email: string }[]
  date: Date
  isRead: boolean
  isStarred: boolean
  hasAttachments: boolean
  labels: string[]
}

export interface EmailDetail {
  id: string
  threadId: string
  subject: string
  preview: string
  from: { name: string; email: string }
  to: { name: string; email: string }[]
  date: Date
  body: string
  bodyPlain: string
  isRead: boolean
  isStarred: boolean
  labels: string[]
  hasAttachments: boolean
  attachments: Array<{ id: string; filename: string; mimeType: string; size: number }>
  headers?: Record<string, string>
  inReplyTo?: string
  references?: string[]
}

export interface SendMessageParams {
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  body: string
  replyTo?: string
  inReplyTo?: string
  references?: string[]
  attachments?: Array<{ filename: string; contentType: string; data: string }>
}

export interface MailFolder {
  id: string
  name: string
  icon: string
  unreadCount: number
}

export interface MailProvider {
  readonly provider: 'gmail' | 'smtp_imap'
  listMessages(params: ListMessagesParams): Promise<ListMessagesResult>
  getMessage(id: string, folder?: string): Promise<EmailDetail>
  sendMessage(params: SendMessageParams): Promise<{ id: string }>
  modifyMessage(id: string, params: {
    archive?: boolean
    star?: boolean
    markRead?: boolean
    markUnread?: boolean
  }): Promise<void>
  trashMessage(id: string): Promise<void>
  moveMessage(id: string, folder: string, destination: string): Promise<void>
  listFolders(): Promise<MailFolder[]>
  getAttachment(messageId: string, attachmentId: string, folder?: string): Promise<{ data: string; mimeType: string; filename: string }>
  close?(): Promise<void>
}

export function createMailProvider(account: { provider: 'gmail' | 'smtp_imap' }): MailProvider {
  if (account.provider === 'smtp_imap') {
    // Lazy import to avoid circular issues
    const { ImapSmtpProvider } = require('./providers/imap-smtp-provider')
    return new ImapSmtpProvider()
  }
  const { GmailProvider } = require('./providers/gmail-provider')
  return new GmailProvider()
}