import { userStore } from './userStore'
import { isCentralCrm } from './crmRuntime'
import { createCrmServerCollection } from './crmServerCollection'
import { PortfolioItem, PropertyStatus } from '@/types/portfolio'
import { Lead } from '@/types/lead'

// Clean slate: no imported or mock data
const INITIAL_PROPERTIES: PortfolioItem[] = []

const STORAGE_KEY_PROPERTIES = 'demirturk_properties_v2'
type Listener = () => void

class PortfolioStore {
  private backend = createCrmServerCollection<PortfolioItem>('properties', () => { const user=userStore.getCurrentUser(),client=userStore.getServerClient(); return user&&client?{id:user.id,client}:null })
  public setAccount(id: string|null) { this.backend.setAccount(id) }
  public async refreshFromBackend() { await this.backend.refresh(); this.notify() }
  public getReadError() { return this.backend.getError() }

  private properties: PortfolioItem[] = []
  private listeners: Set<Listener> = new Set()

  constructor() {
    this.backend.subscribe(() => this.notify())
    if (isCentralCrm()) return
    this.loadFromStorage()
  }

  private loadFromStorage() {
    if (isCentralCrm()) return
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PROPERTIES)
      this.properties = saved ? JSON.parse(saved) : INITIAL_PROPERTIES
    } catch {
      this.properties = INITIAL_PROPERTIES
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY_PROPERTIES, JSON.stringify(this.properties))
    } catch (e) {
      console.error('Storage save error:', e)
    }
    this.notify()
  }

  private notify() {
    this.listeners.forEach(cb => cb())
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  public getAll(): PortfolioItem[] {
    if (isCentralCrm()) return this.backend.getAll()
    return [...this.properties]
  }

  public async add(item: Omit<PortfolioItem, 'id' | 'createdAt'>): Promise<PortfolioItem> {
    const newItem: PortfolioItem = {
      ...item,
      id: isCentralCrm() ? crypto.randomUUID() : 'prop-' + Date.now(),
      createdAt: new Date().toISOString(),
    }
    if (isCentralCrm()) return this.backend.save(JSON.stringify(newItem),newItem)
    this.properties = [newItem, ...this.properties]
    this.saveToStorage()
    return newItem
  }

  public async updateStatus(id: string, status: PropertyStatus): Promise<void> {
    if (isCentralCrm()) { const prior=this.getAll().find(p=>p.id===id); if(!prior)throw Error('Kayıt bulunamadı.'); await this.backend.save(JSON.stringify([id,status]),{...prior,status}); return }
    const prop = this.properties.find(p => p.id === id)
    if (prop) {
      prop.status = status
      this.saveToStorage()
    }
  }

  public matchPropertiesForLead(lead: Lead): PortfolioItem[] {
    return this.getAll().filter(p => {
      if (p.status === 'SOLD') return false
      // Match housing type if specified
      if (lead.preferredHousingType && p.type.toLowerCase().includes(lead.preferredHousingType.toLowerCase())) {
        return true
      }
      // Match budget if property is within lead budget +/- 20%
      if (lead.budget && p.price <= lead.budget * 1.25) {
        return true
      }
      return false
    })
  }
}

export const portfolioStore = new PortfolioStore()
