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
  private contacts: Contact[] = []
  private listeners: (() => void)[] = []

  constructor() {
    this.loadFromStorage()
    if (typeof window !== 'undefined') {
      window.addEventListener('demirturk:cloud-db-synced', () => {
        this.loadFromStorage()
        this.notify()
      })
    }
  }

  private loadFromStorage() {
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
    return [...this.contacts]
  }

  getById(id: string): Contact | undefined {
    return this.contacts.find((c) => c.id === id)
  }

  add(contact: Omit<Contact, 'id' | 'createdAt'>): Contact {
    const newContact: Contact = {
      ...contact,
      id: 'cnt-' + Date.now(),
      createdAt: new Date().toISOString(),
    }
    this.contacts = [newContact, ...this.contacts]
    this.saveToStorage()
    return newContact
  }

  update(id: string, updates: Partial<Omit<Contact, 'id' | 'createdAt'>>): Contact | null {
    const idx = this.contacts.findIndex((c) => c.id === id)
    if (idx === -1) return null
    this.contacts[idx] = { ...this.contacts[idx], ...updates }
    this.saveToStorage()
    return this.contacts[idx]
  }

  delete(id: string): boolean {
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
