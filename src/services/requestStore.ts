import { AppUser } from './userStore'

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

const INITIAL_REQUESTS: CustomerRequest[] = [
  {
    id: 'req-1',
    customerName: 'Ahmet Ulucak',
    customerPhone: '+90 542 606 42 58',
    subject: 'Kat planında teras genişliği revizyonu',
    category: 'Proje & Kat Planı',
    priority: 'Yüksek',
    status: 'İşlemde',
    assignedToUserName: 'Müşteri Temsilcisi',
    notes: 'Müşteri D-03 dairesinin teras çıkışı hakkında teknik mimari çizim talep ediyor.',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'req-2',
    customerName: 'Birgül Anar',
    customerPhone: '+90 537 878 05 33',
    subject: 'Banka konut kredisi oranları ve taksit planı',
    category: 'Ödeme & Finansman',
    priority: 'Orta',
    status: 'Açık',
    assignedToUserName: 'Müşteri Temsilcisi',
    notes: 'Anlaşmalı bankaların 120 ay konut kredisi faiz oranları tablosu iletilecek.',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

type Listener = () => void

class RequestStore {
  private requests: CustomerRequest[] = []
  private listeners: Set<Listener> = new Set()

  constructor() {
    this.loadFromStorage()
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
    return true
  }
}

export const requestStore = new RequestStore()
