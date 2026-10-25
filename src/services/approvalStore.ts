import { AppUser } from './userStore'
import { Department } from '@/types/department'
import { permissionService } from './permissionService'
import { supabase, isSupabaseConfigured } from './supabaseClient'
import { syncService } from './syncService'
import { rowToApproval } from './dbMapper'

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

const INITIAL_APPROVALS: ApprovalRequest[] = []

type Listener = () => void

class ApprovalStore {
  private approvals: ApprovalRequest[] = []
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

  public setLoadedApprovals(approvals: ApprovalRequest[]) {
    const byId = new Map<string, ApprovalRequest>()
    for (const a of approvals || []) byId.set(a.id, a)
    for (const local of this.approvals) {
      if (!byId.has(local.id)) {
        byId.set(local.id, local)
        syncService.saveApproval(local)
      }
    }
    this.approvals = Array.from(byId.values())
    try {
      localStorage.setItem(STORAGE_KEY_APPROVALS, JSON.stringify(this.approvals))
    } catch {}
    this.notify()
  }

  private initRealtime() {
    if (!isSupabaseConfigured() || this.realtimeChannel) return
    this.realtimeChannel = supabase
      .channel('realtime:approvals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'approvals' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const incoming = rowToApproval(payload.new)
          if (!this.approvals.some((a) => a.id === incoming.id)) {
            this.approvals = [incoming, ...this.approvals]
            this.saveToStorage()
          }
        } else if (payload.eventType === 'UPDATE') {
          const incoming = rowToApproval(payload.new)
          const idx = this.approvals.findIndex((a) => a.id === incoming.id)
          if (idx !== -1) {
            this.approvals[idx] = incoming
            this.saveToStorage()
          }
        }
      })
      .subscribe()
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
    syncService.saveApproval(newReq)
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
    syncService.saveApproval(this.approvals[index])
    return { success: true }
  }
}

export const approvalStore = new ApprovalStore()
