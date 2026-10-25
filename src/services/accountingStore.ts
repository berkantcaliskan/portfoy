import { AppUser } from './userStore'
import { permissionService } from './permissionService'
import { supabase, isSupabaseConfigured } from './supabaseClient'
import { syncService } from './syncService'
import { rowToCollection, rowToPayment } from './dbMapper'

export type CollectionType = 'DEPOSIT' | 'DOWN_PAYMENT' | 'INSTALLMENT' | 'FULL_PAYMENT'
export type CollectionStatus = 'COLLECTED' | 'PENDING' | 'OVERDUE' | 'REFUNDED'

export interface CollectionRecord {
  id: string
  customerName: string
  customerId?: string
  projectName: string
  unitNumber: string
  type: CollectionType
  amount: number
  dueDate: string
  paidDate?: string
  status: CollectionStatus
  paymentMethod?: string
  receiptNo?: string
  notes?: string
  refundReason?: string
  refundedByUserName?: string
  createdAt: string
}

export type PaymentCategory = 'COMMISSION' | 'CONSTRUCTION' | 'MARKETING' | 'OFFICE' | 'TAX'
export type PaymentStatus = 'PAID' | 'PENDING' | 'OVERDUE'

export interface PaymentRecord {
  id: string
  title: string
  payee: string
  category: PaymentCategory
  amount: number
  dueDate: string
  paidDate?: string
  status: PaymentStatus
  invoiceNo?: string
  notes?: string
  createdAt: string
}

const STORAGE_KEY_COLLECTIONS = 'demirturk_collections_v2'
const STORAGE_KEY_PAYMENTS = 'demirturk_payments_v2'

const INITIAL_COLLECTIONS: CollectionRecord[] = []
const INITIAL_PAYMENTS: PaymentRecord[] = []

type Listener = () => void

class AccountingStore {
  private collections: CollectionRecord[] = []
  private payments: PaymentRecord[] = []
  private listeners: Set<Listener> = new Set()
  private realtimeChannel: any = null

  constructor() {
    this.loadFromStorage()
    this.initRealtime()
    if (typeof window !== 'undefined') {
      window.addEventListener('demirturk:cloud-db-synced', () => {
        this.loadFromStorage()
        this.notify()
      })
    }
  }

  public setLoadedAccounting(collections: CollectionRecord[], payments: PaymentRecord[]) {
    const colMap = new Map<string, CollectionRecord>()
    for (const c of collections || []) colMap.set(c.id, c)
    for (const lc of this.collections) {
      if (!colMap.has(lc.id)) {
        colMap.set(lc.id, lc)
        syncService.saveCollection(lc)
      }
    }

    const payMap = new Map<string, PaymentRecord>()
    for (const p of payments || []) payMap.set(p.id, p)
    for (const lp of this.payments) {
      if (!payMap.has(lp.id)) {
        payMap.set(lp.id, lp)
        syncService.savePayment(lp)
      }
    }

    this.collections = Array.from(colMap.values())
    this.payments = Array.from(payMap.values())
    try {
      localStorage.setItem(STORAGE_KEY_COLLECTIONS, JSON.stringify(this.collections))
      localStorage.setItem(STORAGE_KEY_PAYMENTS, JSON.stringify(this.payments))
    } catch {}
    this.notify()
  }

  private initRealtime() {
    if (!isSupabaseConfigured() || this.realtimeChannel) return
    this.realtimeChannel = supabase
      .channel('realtime:accounting')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'collections' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const incoming = rowToCollection(payload.new)
          if (!this.collections.some((c) => c.id === incoming.id)) {
            this.collections = [incoming, ...this.collections]
            this.saveToStorage()
          }
        } else if (payload.eventType === 'UPDATE') {
          const incoming = rowToCollection(payload.new)
          const idx = this.collections.findIndex((c) => c.id === incoming.id)
          if (idx !== -1) {
            this.collections[idx] = incoming
            this.saveToStorage()
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const incoming = rowToPayment(payload.new)
          if (!this.payments.some((p) => p.id === incoming.id)) {
            this.payments = [incoming, ...this.payments]
            this.saveToStorage()
          }
        } else if (payload.eventType === 'UPDATE') {
          const incoming = rowToPayment(payload.new)
          const idx = this.payments.findIndex((p) => p.id === incoming.id)
          if (idx !== -1) {
            this.payments[idx] = incoming
            this.saveToStorage()
          }
        }
      })
      .subscribe()
  }

  private loadFromStorage() {
    try {
      const savedCol = localStorage.getItem(STORAGE_KEY_COLLECTIONS)
      const savedPay = localStorage.getItem(STORAGE_KEY_PAYMENTS)
      this.collections = savedCol ? JSON.parse(savedCol) : INITIAL_COLLECTIONS
      this.payments = savedPay ? JSON.parse(savedPay) : INITIAL_PAYMENTS
    } catch {
      this.collections = INITIAL_COLLECTIONS
      this.payments = INITIAL_PAYMENTS
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY_COLLECTIONS, JSON.stringify(this.collections))
      localStorage.setItem(STORAGE_KEY_PAYMENTS, JSON.stringify(this.payments))
    } catch (e) {
      console.error('AccountingStore save error:', e)
    }
    this.notify()
  }

  private notify() {
    this.listeners.forEach((cb) => cb())
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  public getCollections(): CollectionRecord[] {
    return [...this.collections]
  }

  public getPayments(): PaymentRecord[] {
    return [...this.payments]
  }

  public markCollectionAsPaid(id: string, receiptNo?: string): boolean {
    const index = this.collections.findIndex((c) => c.id === id)
    if (index === -1) return false

    this.collections[index] = {
      ...this.collections[index],
      status: 'COLLECTED',
      paidDate: new Date().toISOString().split('T')[0],
      receiptNo: receiptNo || `DK-${Date.now().toString().slice(-6)}`,
    }

    this.saveToStorage()
    syncService.saveCollection(this.collections[index])
    return true
  }

  public addCollection(data: Omit<CollectionRecord, 'id' | 'createdAt'>): CollectionRecord {
    const newRecord: CollectionRecord = {
      ...data,
      id: 'col-' + Date.now(),
      createdAt: new Date().toISOString(),
    }
    this.collections = [newRecord, ...this.collections]
    this.saveToStorage()
    syncService.saveCollection(newRecord)
    return newRecord
  }

  public addPayment(data: Omit<PaymentRecord, 'id' | 'createdAt'>): PaymentRecord {
    const newRecord: PaymentRecord = {
      ...data,
      id: 'pay-' + Date.now(),
      createdAt: new Date().toISOString(),
    }
    this.payments = [newRecord, ...this.payments]
    this.saveToStorage()
    syncService.savePayment(newRecord)
    return newRecord
  }

  public markPaymentAsPaid(id: string): boolean {
    const index = this.payments.findIndex((p) => p.id === id)
    if (index === -1) return false

    this.payments[index] = {
      ...this.payments[index],
      status: 'PAID',
      paidDate: new Date().toISOString().split('T')[0],
    }

    this.saveToStorage()
    syncService.savePayment(this.payments[index])
    return true
  }

  /**
   * Refund Deposit (Authorized only if user has canRefundDeposit permission)
   */
  public refundDeposit(
    id: string,
    user: AppUser,
    reason: string
  ): { success: boolean; error?: string } {
    if (!permissionService.canRefundDeposit(user)) {
      return {
        success: false,
        error: 'Kapora iadesi yapma yetkiniz bulunmamaktadır. Muhasebe veya Yönetim yetkisi gereklidir.',
      }
    }

    const index = this.collections.findIndex((c) => c.id === id)
    if (index === -1) return { success: false, error: 'Tahsilat kaydı bulunamadı.' }

    const col = this.collections[index]
    if (col.type !== 'DEPOSIT') {
      return { success: false, error: 'Yalnızca kapora kayıtları için iade işlemi başlatılabilir.' }
    }

    this.collections[index] = {
      ...col,
      status: 'REFUNDED',
      refundReason: reason,
      refundedByUserName: user.fullName,
      notes: `${col.notes || ''}\n[İade]: ${reason} (${user.fullName})`,
    }

    this.saveToStorage()
    syncService.saveCollection(this.collections[index])
    return { success: true }
  }
}

export const accountingStore = new AccountingStore()
