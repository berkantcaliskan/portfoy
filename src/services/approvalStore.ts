import { AppUser } from './userStore'
import { Department } from '@/types/department'
import { permissionService } from './permissionService'

export type ApprovalType = 'İskonto / İndirim' | 'Kapora İadesi' | 'Rezervasyon Uzatma' | 'Özel Ödeme Planı'
export type ApprovalStatus = 'BEKLEMEDE' | 'ONAYLANDI' | 'REDDEDILDI'

export interface ApprovalRequest {
  id: string
  type: ApprovalType
  title: string
  customerName: string
  projectName: string
  unitNumber?: string
  amount?: number
  reason: string
  requestedByUserId: string
  requestedByUserName: string
  requestedDepartment: Department
  status: ApprovalStatus
  reviewedByUserId?: string
  reviewedByUserName?: string
  reviewedAt?: string
  reviewNotes?: string
  createdAt: string
}

const STORAGE_KEY_APPROVALS = 'demirturk_approvals_v2'

const INITIAL_APPROVALS: ApprovalRequest[] = [
  {
    id: 'app-1',
    type: 'İskonto / İndirim',
    title: 'D-03 Peşin Alım İçin %3 İlave İskonto',
    customerName: 'Ahmet Ulucak',
    projectName: 'Demirtürk Panorama Rezidans',
    unitNumber: 'D-03',
    amount: 145000,
    reason: 'Müşteri toplam tutarı 3 iş günü içinde tek seferde peşin ödemeyi taahhüt ediyor.',
    requestedByUserId: 'usr-sales-1',
    requestedByUserName: 'Satış Danışmanı',
    requestedDepartment: 'Satış',
    status: 'BEKLEMEDE',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'app-2',
    type: 'Rezervasyon Uzatma',
    title: 'D-14 Rezervasyonunun 5 Gün Uzatılması',
    customerName: 'Canan Güneş',
    projectName: 'Demirtürk Panorama Rezidans',
    unitNumber: 'D-14',
    reason: 'Müşteri yurt dışı transfer onayını bekliyor, kapora ödemesi 5 gün içinde tamamlanacak.',
    requestedByUserId: 'usr-sales-2',
    requestedByUserName: 'Satış Temsilcisi',
    requestedDepartment: 'Satış',
    status: 'BEKLEMEDE',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
]

type Listener = () => void

class ApprovalStore {
  private approvals: ApprovalRequest[] = []
  private listeners: Set<Listener> = new Set()

  constructor() {
    this.loadFromStorage()
  }

  private loadFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_APPROVALS)
      this.approvals = saved ? JSON.parse(saved) : INITIAL_APPROVALS
    } catch {
      this.approvals = INITIAL_APPROVALS
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY_APPROVALS, JSON.stringify(this.approvals))
    } catch (e) {
      console.error('ApprovalStore save error:', e)
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

  public getAll(): ApprovalRequest[] {
    return [...this.approvals]
  }

  public requestApproval(
    data: Omit<ApprovalRequest, 'id' | 'status' | 'createdAt'>,
    user: AppUser
  ): ApprovalRequest {
    const newReq: ApprovalRequest = {
      ...data,
      id: 'app-' + Date.now(),
      requestedByUserId: user.id,
      requestedByUserName: user.fullName,
      requestedDepartment: user.department,
      status: 'BEKLEMEDE',
      createdAt: new Date().toISOString(),
    }
    this.approvals = [newReq, ...this.approvals]
    this.saveToStorage()
    return newReq
  }

  public decideApproval(
    id: string,
    decision: 'ONAYLANDI' | 'REDDEDILDI',
    user: AppUser,
    notes?: string
  ): { success: boolean; error?: string } {
    if (!permissionService.canApproveDiscounts(user)) {
      return {
        success: false,
        error: 'Bu talebi onaylama veya reddetme yetkiniz bulunmamaktadır. Yönetici yetkisi gereklidir.',
      }
    }

    const index = this.approvals.findIndex((a) => a.id === id)
    if (index === -1) return { success: false, error: 'Talep bulunamadı.' }

    this.approvals[index] = {
      ...this.approvals[index],
      status: decision,
      reviewedByUserId: user.id,
      reviewedByUserName: user.fullName,
      reviewedAt: new Date().toISOString(),
      reviewNotes: notes,
    }

    this.saveToStorage()
    return { success: true }
  }
}

export const approvalStore = new ApprovalStore()
