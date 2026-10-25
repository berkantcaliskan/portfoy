import { AppUser } from './userStore'
import { supabase, isSupabaseConfigured } from './supabaseClient'
import { syncService } from './syncService'
import { rowToRequest } from './dbMapper'

export type RequestPriority = 'Düşük' | 'Orta' | 'Yüksek' | 'Acil'
export type RequestStatus = 'Açık' | 'İşlemde' | 'Çözüldü' | 'İptal'

export interface CustomerRequest {
  id: string
  customerName: string
  customerPhone: string
  subject: string
  category: 'Satış Öncesi Bilgi' | 'Proje & Kat Planı' | 'Ödeme & Finansman' | 'Satış Sonrası Destek' | 'Genel Talep'
  priority: RequestPriority
  status: RequestStatus
  assignedToUserName: string
  notes: string
  createdAt: string
  updatedAt: string
}

const STORAGE_KEY_REQUESTS = 'demirturk_requests_v2'

const INITIAL_REQUESTS: CustomerRequest[] = []

type Listener = () => void

class RequestStore {
  private requests: CustomerRequest[] = []
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

  public setLoadedRequests(requests: CustomerRequest[]) {
    const byId = new Map<string, CustomerRequest>()
    for (const r of requests || []) byId.set(r.id, r)
    for (const local of this.requests) {
      if (!byId.has(local.id)) {
        byId.set(local.id, local)
        syncService.saveRequest(local)
      }
    }
    this.requests = Array.from(byId.values())
    try {
      localStorage.setItem(STORAGE_KEY_REQUESTS, JSON.stringify(this.requests))
    } catch {}
    this.notify()
  }

  private initRealtime() {
    if (!isSupabaseConfigured() || this.realtimeChannel) return
    this.realtimeChannel = supabase
      .channel('realtime:customer_requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_requests' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const incoming = rowToRequest(payload.new)
          if (!this.requests.some((r) => r.id === incoming.id)) {
            this.requests = [incoming, ...this.requests]
            this.saveToStorage()
          }
        } else if (payload.eventType === 'UPDATE') {
          const incoming = rowToRequest(payload.new)
          const idx = this.requests.findIndex((r) => r.id === incoming.id)
          if (idx !== -1) {
            this.requests[idx] = incoming
            this.saveToStorage()
          }
        } else if (payload.eventType === 'DELETE') {
          this.requests = this.requests.filter((r) => r.id !== (payload.old as any).id)
          this.saveToStorage()
        }
      })
      .subscribe()
  }

  private loadFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_REQUESTS)
      this.requests = saved ? JSON.parse(saved) : INITIAL_REQUESTS
    } catch {
      this.requests = INITIAL_REQUESTS
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY_REQUESTS, JSON.stringify(this.requests))
    } catch (e) {
      console.error('RequestStore save error:', e)
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

  public async refreshFromSupabase(): Promise<void> {
    if (!isSupabaseConfigured()) return
    try {
      const { data, error } = await supabase
        .from('customer_requests')
        .select('*')
        .order('created_at', { ascending: false })
      if (!error && data) {
        this.setLoadedRequests(data.map(rowToRequest))
      }
    } catch (e) {
      console.error('[RequestStore] refreshFromSupabase error:', e)
    }
  }

  public getAll(): CustomerRequest[] {
    return [...this.requests]
  }

  public addRequest(
    data: Omit<CustomerRequest, 'id' | 'createdAt' | 'updatedAt'>
  ): CustomerRequest {
    const newReq: CustomerRequest = {
      ...data,
      id: 'req-' + Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    this.requests = [newReq, ...this.requests]
    this.saveToStorage()
    syncService.saveRequest(newReq)
    return newReq
  }

  public updateStatus(id: string, status: RequestStatus): boolean {
    const index = this.requests.findIndex((r) => r.id === id)
    if (index === -1) return false
    this.requests[index] = {
      ...this.requests[index],
      status,
      updatedAt: new Date().toISOString(),
    }
    this.saveToStorage()
    syncService.saveRequest(this.requests[index])
    return true
  }
}

export const requestStore = new RequestStore()
