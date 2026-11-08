import { userStore } from './userStore'
import { isCentralCrm } from './crmRuntime'
import { createCrmServerCollection } from './crmServerCollection'
import { trashStore } from './trashStore'

export type ContactCategory = 'EKIP' | 'MUSTERI' | 'ORTAK' | 'DIGER'

export interface Contact {
  id: string
  fullName: string
  phone: string
  email?: string
  category: ContactCategory
  company?: string
  title?: string
  notes?: string
  createdAt: string
}

const STORAGE_KEY_CONTACTS = 'demirturk_contacts_v2'

class ContactStore {
  private backend = createCrmServerCollection<Contact>('contacts', () => { const user=userStore.getCurrentUser(),client=userStore.getServerClient(); return user&&client?{id:user.id,client}:null })
  public setAccount(id: string|null) { this.backend.setAccount(id) }
  public async refreshFromBackend() { await this.backend.refresh(); this.notify() }
  public getReadError() { return this.backend.getError() }

  private contacts: Contact[] = []
  private listeners: (() => void)[] = []

  constructor() {
    this.backend.subscribe(() => this.notify())
    if (isCentralCrm()) return
    this.loadFromStorage()
    if (typeof window !== 'undefined') {
      window.addEventListener('demirturk:cloud-db-synced', () => {
        this.loadFromStorage()
        this.notify()
      })
    }
  }

  private loadFromStorage() {
    if (isCentralCrm()) return
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONTACTS)
      if (saved) {
        this.contacts = JSON.parse(saved)
      } else {
        // Clean slate: start with empty array
        this.contacts = []
      }
    } catch {
      this.contacts = []
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY_CONTACTS, JSON.stringify(this.contacts))
    } catch {
      // ignore
    }
    this.notify()
  }

  private notify() {
    this.listeners.forEach((listener) => listener())
  }

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  getAll(): Contact[] {
    if (isCentralCrm()) return this.backend.getAll()
    return [...this.contacts]
  }

  getById(id: string): Contact | undefined {
    return this.getAll().find((c) => c.id === id)
  }

  async add(contact: Omit<Contact, 'id' | 'createdAt'>): Promise<Contact> {
    const newContact: Contact = {
      ...contact,
      id: isCentralCrm() ? crypto.randomUUID() : 'cnt-' + Date.now(),
      createdAt: new Date().toISOString(),
    }
    if (isCentralCrm()) return this.backend.save(JSON.stringify(newContact), newContact)
    this.contacts = [newContact, ...this.contacts]
    this.saveToStorage()
    return newContact
  }

  async update(id: string, updates: Partial<Omit<Contact, 'id' | 'createdAt'>>): Promise<Contact | null> {
    if (isCentralCrm()) { const prior=this.getById(id); return prior?this.backend.save(JSON.stringify([id,updates]),{...prior,...updates,id}):null }
    const idx = this.contacts.findIndex((c) => c.id === id)
    if (idx === -1) return null
    this.contacts[idx] = { ...this.contacts[idx], ...updates }
    this.saveToStorage()
    return this.contacts[idx]
  }

  async delete(id: string): Promise<boolean> {
    if (isCentralCrm()) { const prior=this.getById(id); if(!prior)return false; await this.backend.save('archive:'+id,prior,true); return true }
    const target = this.contacts.find((c) => c.id === id)
    if (target) {
      trashStore.addItemToTrash(STORAGE_KEY_CONTACTS, target)
    }
    const initialLen = this.contacts.length
    this.contacts = this.contacts.filter((c) => c.id !== id)
    if (this.contacts.length !== initialLen) {
      this.saveToStorage()
      return true
    }
    return false
  }
}

export const contactStore = new ContactStore()
