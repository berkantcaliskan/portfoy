import { Department } from './department'

export type MailAccountType = 'PERSONAL' | 'SHARED_DEPARTMENT'

export interface MailAccount {
  id: string
  email: string
  displayName: string
  type: MailAccountType
  department: Department
  quotaMb: number
  usedMb: number
  isActive: boolean
  aliases?: string[]
  assignedUserIds?: string[]
  smtpHost?: string
  imapHost?: string
}

export type MailFolderType = 'INBOX' | 'SENT' | 'DRAFTS' | 'ARCHIVE' | 'SPAM' | 'TRASH' | 'CUSTOM'

export interface MailFolder {
  id: string
  accountId: string
  name: string
  type: MailFolderType
  unreadCount: number
  totalCount: number
}

export interface MailAttachment {
  id: string
  name: string
  size: number
  type: string
  dataUrl?: string
}

export interface MailContact {
  name: string
  email: string
}

export interface MailMessage {
  id: string
  uid: number
  messageId: string
  accountId: string
  folderId: string
  from: MailContact
  to: MailContact[]
  cc?: MailContact[]
  bcc?: MailContact[]
  subject: string
  date: string
  snippet: string
  bodyHtml?: string
  bodyText: string
  isRead: boolean
  isStarred: boolean
  hasAttachments: boolean
  attachments?: MailAttachment[]
  linkedLeadId?: string
  linkedLeadName?: string
  inReplyTo?: string
}

export interface MailServerStatus {
  isConfigured: boolean
  status: 'NOT_CONFIGURED' | 'CONNECTING' | 'READY' | 'ERROR'
  statusMessage: string
  host?: string
}

export interface SendMailParams {
  accountId: string
  from: string
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  bodyHtml: string
  bodyText: string
  attachments?: MailAttachment[]
  idempotencyKey: string
  inReplyTo?: string
  linkedLeadId?: string
}

export interface CreateMailboxParams {
  localPart: string
  displayName: string
  department: Department
  quotaMb: number
}
