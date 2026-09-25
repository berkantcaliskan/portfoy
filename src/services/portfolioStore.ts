import { PortfolioItem, PropertyType, PropertyStatus } from '@/types/portfolio'
import { Lead } from '@/types/lead'

// Clean slate: no imported or mock data
const INITIAL_PROPERTIES: PortfolioItem[] = []

const STORAGE_KEY_PROPERTIES = 'demirturk_properties_v2'
type Listener = () => void

class PortfolioStore {
  private properties: PortfolioItem[] = []
  private listeners: Set<Listener> = new Set()

  constructor() {
    this.loadFromStorage()
  }

  private loadFromStorage() {
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
    return [...this.properties]
  }

  public add(item: Omit<PortfolioItem, 'id' | 'createdAt'>): PortfolioItem {
    const newItem: PortfolioItem = {
      ...item,
      id: 'prop-' + Date.now(),
      createdAt: new Date().toISOString(),
    }
    this.properties = [newItem, ...this.properties]
    this.saveToStorage()
    return newItem
  }

  public updateStatus(id: string, status: PropertyStatus): void {
    const prop = this.properties.find(p => p.id === id)
    if (prop) {
      prop.status = status
      this.saveToStorage()
    }
  }

  public matchPropertiesForLead(lead: Lead): PortfolioItem[] {
    return this.properties.filter(p => {
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
