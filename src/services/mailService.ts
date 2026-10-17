import { AppUser } from './userStore'
import { Department } from '@/types/department'
import {
  MailAccount,
  MailFolder,
  MailFolderType,
  MailMessage,
  MailServerStatus,
  SendMailParams,
  CreateMailboxParams,
} from '@/types/mail'

const STORAGE_KEY_ACCOUNTS = 'demirturk_mail_accounts_v2'
const STORAGE_KEY_MESSAGES = 'demirturk_mail_messages_v2'

const DEFAULT_ACCOUNTS: MailAccount[] = []

function createDefaultFolders(accountId: string): MailFolder[] {
  return [
    { id: `${accountId}-inbox`, accountId, name: 'Gelen Kutusu', type: 'INBOX', unreadCount: 0, totalCount: 0 },
    { id: `${accountId}-sent`, accountId, name: 'Gönderilenler', type: 'SENT', unreadCount: 0, totalCount: 0 },
    { id: `${accountId}-drafts`, accountId, name: 'Taslaklar', type: 'DRAFTS', unreadCount: 0, totalCount: 0 },
    { id: `${accountId}-archive`, accountId, name: 'Arşiv', type: 'ARCHIVE', unreadCount: 0, totalCount: 0 },
    { id: `${accountId}-spam`, accountId, name: 'İstenmeyen (Spam)', type: 'SPAM', unreadCount: 0, totalCount: 0 },
    { id: `${accountId}-trash`, accountId, name: 'Çöp Kutusu', type: 'TRASH', unreadCount: 0, totalCount: 0 },
  ]
}

export class MailService {
  private accounts: MailAccount[] = []
  private messages: MailMessage[] = []
  private folders: Map<string, MailFolder[]> = new Map()
  private processedIdempotencyKeys = new Set<string>()
  private listeners: (() => void)[] = []
  private serverStatus: MailServerStatus = {
    isConfigured: false,
    status: 'NOT_CONFIGURED',
    statusMessage: 'Mailcow altyapısı henüz yapılandırılmadı. .env üzerinden MAILCOW_API_HOST, IMAP ve SMTP ayarları bekleniyor.',
    host: 'mail.demirturkinsaat.com',
  }

  constructor() {
    this.loadFromStorage()
  }

  private loadFromStorage() {
    try {
      const savedAccounts = localStorage.getItem(STORAGE_KEY_ACCOUNTS)
      if (savedAccounts) {
        this.accounts = JSON.parse(savedAccounts)
      } else {
        this.accounts = [...DEFAULT_ACCOUNTS]
        this.saveAccountsToStorage()
      }

      // Initialize folders for each account
      this.accounts.forEach((acc) => {
        this.folders.set(acc.id, createDefaultFolders(acc.id))
      })

      const savedMessages = localStorage.getItem(STORAGE_KEY_MESSAGES)
      if (savedMessages) {
        this.messages = JSON.parse(savedMessages)
      } else {
        this.messages = []
        this.saveMessagesToStorage()
      }

      this.updateFolderCounts()
    } catch {
      this.accounts = [...DEFAULT_ACCOUNTS]
      this.messages = []
    }
  }

  private saveAccountsToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(this.accounts))
    } catch {}
  }

  private saveMessagesToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(this.messages))
    } catch {}
  }

  private updateFolderCounts() {
    this.accounts.forEach((acc) => {
      const accFolders = this.folders.get(acc.id) || createDefaultFolders(acc.id)
      accFolders.forEach((f) => {
        const msgs = this.messages.filter((m) => m.accountId === acc.id && m.folderId === f.id)
        f.totalCount = msgs.length
        f.unreadCount = msgs.filter((m) => !m.isRead).length
      })
      this.folders.set(acc.id, accFolders)
    })
  }

  private notify() {
    this.updateFolderCounts()
    this.listeners.forEach((l) => l())
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  public getServerStatus(): MailServerStatus {
    return this.serverStatus
  }

  /**
   * Kullanıcının yetkili olduğu hesaplardaki okunmamış gelen posta sayısını döner
   */
  public getUnreadCount(user: AppUser | null): number {
    if (!user) return 0
    const accessibleAccounts = this.getAccountsForUser(user)
    const accessibleAccountIds = new Set(accessibleAccounts.map((a) => a.id))
    return this.messages.filter(
      (m) =>
        accessibleAccountIds.has(m.accountId) &&
        !m.isRead &&
        m.folderId === 'inbox'
    ).length
  }

  /**
   * Yetki Kontrolü: Kullanıcının görebileceği posta kutularını döner
   * - Admin tüm kutuları görebilir
   * - Kullanıcı kendi departmanının ortak kutusunu görebilir
   * - Kullanıcı kendi kişisel kutusunu görebilir
   */
  public getAccountsForUser(user: AppUser | null): MailAccount[] {
    if (!user) return []
    if (user.role === 'ADMIN' || (user.isManager && user.department === 'Yönetim')) {
      return this.accounts
    }

    const userDepts = user.departments && user.departments.length > 0
      ? user.departments
      : [user.department]

    return this.accounts.filter((acc) => {
      if (!acc.isActive) return false
      if (acc.type === 'SHARED_DEPARTMENT') {
        return userDepts.includes(acc.department)
      }
      // Kişisel hesap eşleşmesi
      if (acc.email.toLowerCase().includes(user.username.toLowerCase())) {
        return true
      }
      if (user.email && acc.email.toLowerCase() === user.email.toLowerCase()) {
        return true
      }
      return false
    })
  }

  public getFolders(accountId: string): MailFolder[] {
    return this.folders.get(accountId) || createDefaultFolders(accountId)
  }

  public getMessages(
    accountId: string,
    folderId: string,
    filters?: { search?: string; type?: 'all' | 'unread' | 'starred' | 'attachments' }
  ): MailMessage[] {
    let list = this.messages.filter((m) => m.accountId === accountId && m.folderId === folderId)

    if (filters?.type === 'unread') {
      list = list.filter((m) => !m.isRead)
    } else if (filters?.type === 'starred') {
      list = list.filter((m) => m.isStarred)
    } else if (filters?.type === 'attachments') {
      list = list.filter((m) => m.hasAttachments)
    }

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase()
      list = list.filter(
        (m) =>
          m.subject.toLowerCase().includes(q) ||
          m.from.name.toLowerCase().includes(q) ||
          m.from.email.toLowerCase().includes(q) ||
          m.bodyText.toLowerCase().includes(q)
      )
    }

    // Sıralama: En yeniden eskiye
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  public getMessageById(messageId: string): MailMessage | undefined {
    return this.messages.find((m) => m.id === messageId)
  }

  public markAsRead(messageId: string, isRead = true): void {
    const msg = this.messages.find((m) => m.id === messageId)
    if (msg) {
      msg.isRead = isRead
      this.saveMessagesToStorage()
      this.notify()
    }
  }

  public toggleStar(messageId: string): void {
    const msg = this.messages.find((m) => m.id === messageId)
    if (msg) {
      msg.isStarred = !msg.isStarred
      this.saveMessagesToStorage()
      this.notify()
    }
  }

  public moveToFolder(messageId: string, targetFolderId: string): void {
    const msg = this.messages.find((m) => m.id === messageId)
    if (msg) {
      msg.folderId = targetFolderId
      this.saveMessagesToStorage()
      this.notify()
    }
  }

  public deleteMessage(messageId: string): void {
    const msg = this.messages.find((m) => m.id === messageId)
    if (!msg) return

    const trashFolderId = `${msg.accountId}-trash`
    if (msg.folderId !== trashFolderId) {
      // Çöp kutusuna taşı
      msg.folderId = trashFolderId
    } else {
      // Çöp kutusundan kalıcı sil
      this.messages = this.messages.filter((m) => m.id !== messageId)
    }
    this.saveMessagesToStorage()
    this.notify()
  }

  /**
   * E-Posta Gönderme (İdempotent & Çift Tıklama Korumalı)
   */
  public async sendMessage(
    params: SendMailParams,
    user: AppUser | null
  ): Promise<{ success: boolean; error?: string; message?: MailMessage }> {
    if (!user) {
      return { success: false, error: 'Oturum açılmamış.' }
    }

    // 1. İdempotency Kontrolü: Çift tıklama veya mükerrer isteği önle
    if (this.processedIdempotencyKeys.has(params.idempotencyKey)) {
      return { success: false, error: 'Bu mesaj zaten gönderim sırasında işlendi.' }
    }
    this.processedIdempotencyKeys.add(params.idempotencyKey)

    // 2. Yetki Kontrolü: Kullanıcı bu hesaptan gönderebilir mi?
    const account = this.accounts.find((a) => a.id === params.accountId)
    if (!account) {
      return { success: false, error: 'Gönderici posta kutusu bulunamadı.' }
    }

    const allowedAccounts = this.getAccountsForUser(user)
    if (!allowedAccounts.some((a) => a.id === account.id)) {
      return { success: false, error: 'Bu posta kutusundan e-posta gönderme yetkiniz bulunmuyor.' }
    }

    // 3. Alıcı denetimi
    if (!params.to || params.to.length === 0) {
      return { success: false, error: 'En az bir alıcı adresi belirtilmelidir.' }
    }

    // 4. Gönderilenler klasörüne tek kopya kayıt oluştur
    const sentFolderId = `${account.id}-sent`
    const toContacts = params.to.map((addr) => ({ name: addr.split('@')[0], email: addr.trim() }))
    const ccContacts = params.cc?.map((addr) => ({ name: addr.split('@')[0], email: addr.trim() }))
    const bccContacts = params.bcc?.map((addr) => ({ name: addr.split('@')[0], email: addr.trim() }))

    const newMsg: MailMessage = {
      id: 'msg-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      uid: Math.floor(Math.random() * 100000) + 1,
      messageId: `<${Date.now()}.${Math.floor(Math.random() * 100000)}@demirturkinsaat.com>`,
      accountId: account.id,
      folderId: sentFolderId,
      from: { name: account.displayName, email: account.email },
      to: toContacts,
      cc: ccContacts,
      bcc: bccContacts,
      subject: params.subject.trim() || '(Konusuz)',
      date: new Date().toISOString(),
      snippet: params.bodyText.slice(0, 120),
      bodyHtml: params.bodyHtml,
      bodyText: params.bodyText,
      isRead: true,
      isStarred: false,
      hasAttachments: Boolean(params.attachments && params.attachments.length > 0),
      attachments: params.attachments,
      linkedLeadId: params.linkedLeadId,
      inReplyTo: params.inReplyTo,
    }

    this.messages.push(newMsg)
    this.saveMessagesToStorage()
    this.notify()

    return { success: true, message: newMsg }
  }

  /**
   * CRM Bağlantısı: E-postayı müşteri kaydına bağla
   */
  public linkToLead(
    messageId: string,
    leadId: string,
    leadName: string
  ): { success: boolean; error?: string } {
    const msg = this.messages.find((m) => m.id === messageId)
    if (!msg) return { success: false, error: 'Mesaj bulunamadı.' }

    msg.linkedLeadId = leadId
    msg.linkedLeadName = leadName
    this.saveMessagesToStorage()
    this.notify()
    return { success: true }
  }

  public unlinkLead(messageId: string): { success: boolean; error?: string } {
    const msg = this.messages.find((m) => m.id === messageId)
    if (!msg) return { success: false, error: 'Mesaj bulunamadı.' }

    delete msg.linkedLeadId
    delete msg.linkedLeadName
    this.saveMessagesToStorage()
    this.notify()
    return { success: true }
  }

  /**
   * Yeni Posta Kutusu Oluşturma (Admin/Yönetici)
   */
  public async createMailbox(
    params: CreateMailboxParams,
    creator: AppUser | null
  ): Promise<{ success: boolean; error?: string; account?: MailAccount }> {
    if (!creator || (creator.role !== 'ADMIN' && (!creator.isManager || creator.department !== 'Yönetim'))) {
      return { success: false, error: 'Posta kutusu oluşturma yetkiniz bulunmamaktadır.' }
    }

    const cleanLocalPart = params.localPart.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')
    if (!cleanLocalPart || cleanLocalPart.length < 2) {
      return { success: false, error: 'E-posta adı en az 2 karakterden oluşmalıdır.' }
    }

    const fullEmail = `${cleanLocalPart}@demirturkinsaat.com`

    // Mükerrer hesap engeli
    if (this.accounts.some((a) => a.email.toLowerCase() === fullEmail.toLowerCase())) {
      return { success: false, error: 'Bu e-posta adresi zaten kullanımda.' }
    }

    const newAccount: MailAccount = {
      id: 'acc-' + cleanLocalPart + '-' + Date.now(),
      email: fullEmail,
      displayName: params.displayName.trim() || cleanLocalPart,
      type: 'SHARED_DEPARTMENT',
      department: params.department,
      quotaMb: params.quotaMb || 10240,
      usedMb: 0,
      isActive: true,
      aliases: [],
    }

    this.accounts.push(newAccount)
    this.folders.set(newAccount.id, createDefaultFolders(newAccount.id))
    this.saveAccountsToStorage()
    this.notify()

    return { success: true, account: newAccount }
  }

  /**
   * Hesap Aktif/Pasif Durumunu Değiştir (Erişimi devre dışı bırakır, mesajları silmez)
   */
  public async toggleAccountActive(
    accountId: string,
    operator: AppUser | null
  ): Promise<{ success: boolean; error?: string }> {
    if (!operator || (operator.role !== 'ADMIN' && (!operator.isManager || operator.department !== 'Yönetim'))) {
      return { success: false, error: 'Posta kutusu yönetimi yetkiniz bulunmamaktadır.' }
    }

    const account = this.accounts.find((a) => a.id === accountId)
    if (!account) return { success: false, error: 'Hesap bulunamadı.' }

    account.isActive = !account.isActive
    this.saveAccountsToStorage()
    this.notify()
    return { success: true }
  }

  public getAllAccounts(): MailAccount[] {
    return this.accounts
  }
}

export const mailService = new MailService()
