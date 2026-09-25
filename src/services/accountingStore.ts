import { AppUser } from './userStore'
import { permissionService } from './permissionService'

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

function getFutureDate(days: number): string {
  const d = new Date(Date.now() + 86400000 * days)
  return d.toISOString().split('T')[0]
}

const INITIAL_COLLECTIONS: CollectionRecord[] = [
  {
    id: 'col-1',
    customerName: 'Ahmet Ulucak',
    projectName: 'Demirtürk Panorama Rezidans',
    unitNumber: 'D-03',
    type: 'DEPOSIT',
    amount: 150000,
    dueDate: getFutureDate(-2),
    paidDate: getFutureDate(-2),
    status: 'COLLECTED',
    paymentMethod: 'Banka Havalesi (Garanti BBVA)',
    receiptNo: 'DK-2026-8812',
    notes: 'Daire ön kapora bedeli tahsil edildi.',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'col-2',
    customerName: 'Murat Şahin',
    projectName: 'Demirtürk Panorama Rezidans',
    unitNumber: 'D-07',
    type: 'DOWN_PAYMENT',
    amount: 2600000,
    dueDate: getFutureDate(5),
    status: 'PENDING',
    paymentMethod: 'EFT / Blokeli Çek',
    notes: '%50 Peşinat sözleşme günü ödenecek.',
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: 'col-3',
    customerName: 'Yahya Şahin',
    projectName: 'Demirtürk Panorama Rezidans',
    unitNumber: 'D-11',
    type: 'INSTALLMENT',
    amount: 125000,
    dueDate: getFutureDate(-3),
    status: 'OVERDUE',
    notes: 'Eylül 2026 taksit ödemesi 3 gün gecikmede.',
    createdAt: new Date(Date.now() - 86400000 * 15).toISOString(),
  },
]

const INITIAL_PAYMENTS: PaymentRecord[] = [
  {
    id: 'pay-1',
    title: 'D-07 Satış Başarı Komisyonu',
    payee: 'Satış Danışmanı (Berkant)',
    category: 'COMMISSION',
    amount: 104000,
    dueDate: getFutureDate(10),
    status: 'PENDING',
    notes: 'Daire teslim peşinat tahsilatına bağlı prim.',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'pay-2',
    title: 'Kaba İnşaat & Beton Şantiye Hakedişi #4',
    payee: 'Demir İnşaat Taahhüt Ltd.',
    category: 'CONSTRUCTION',
    amount: 1450000,
    dueDate: getFutureDate(3),
    status: 'PENDING',
    invoiceNo: 'FTR-2026-904',
    notes: 'Panorama A Blok 6. kat döşeme hakedişi.',
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
  },
  {
    id: 'pay-3',
    title: 'Meta Ads Reklam Harcaması (Eylül)',
    payee: 'Meta Platforms Ireland Ltd.',
    category: 'MARKETING',
    amount: 85000,
    dueDate: getFutureDate(-1),
    paidDate: getFutureDate(-1),
    status: 'PAID',
    invoiceNo: 'FB-INV-2026-981',
    notes: 'Instagram & Facebook lead toplama kampanyaları bütçesi.',
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
]

type Listener = () => void

class AccountingStore {
  private collections: CollectionRecord[] = []
  private payments: PaymentRecord[] = []
  private listeners: Set<Listener> = new Set()

  constructor() {
    this.loadFromStorage()
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
    return { success: true }
  }
}

export const accountingStore = new AccountingStore()
