import { AppUser } from './userStore'
import { Department } from '@/types/department'

export type AppointmentType = 'ONLINE' | 'OFFICE' | 'ON_SITE'
export type AppointmentStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'

export interface Appointment {
  id: string
  leadId?: string
  customerName: string
  customerPhone: string
  date: string // YYYY-MM-DD
  time: string // HH:mm
  location: string
  type: AppointmentType
  status: AppointmentStatus
  assignedToUserId?: string
  assignedToUserName: string
  createdByUserId: string
  createdByDepartment: Department
  projectName?: string
  notes?: string
  outcomeNote?: string
  createdAt: string
}

const STORAGE_KEY_APPOINTMENTS = 'demirturk_appointments_v2'

function getTodayString(): string {
  const d = new Date()
  return d.toISOString().split('T')[0]
}

const INITIAL_APPOINTMENTS: Appointment[] = [
  {
    id: 'apt-1',
    customerName: 'Ahmet Ulucak',
    customerPhone: '+90 542 606 42 58',
    date: getTodayString(),
    time: '14:30',
    location: 'Demirtürk Panorama Satış Ofisi',
    type: 'ON_SITE',
    status: 'SCHEDULED',
    assignedToUserName: 'Satış Danışmanı',
    createdByUserId: 'usr-rel-1',
    createdByDepartment: 'Müşteri İlişkileri',
    projectName: 'Demirtürk Panorama Rezidans',
    notes: '2+1 deniz manzaralı daire sunumu ve ödeme planı görüşmesi.',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'apt-2',
    customerName: 'Birgül Anar',
    customerPhone: '+90 537 878 05 33',
    date: getTodayString(),
    time: '16:00',
    location: 'Google Meet (Online Sunum)',
    type: 'ONLINE',
    status: 'SCHEDULED',
    assignedToUserName: 'Satış Danışmanı',
    createdByUserId: 'usr-rel-1',
    createdByDepartment: 'Müşteri İlişkileri',
    projectName: 'Demirtürk Ege Vadi Villaları',
    notes: 'Yatırım amaçlı villa portföyü online katalog sunumu.',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
]

type Listener = () => void

class AppointmentStore {
  private appointments: Appointment[] = []
  private listeners: Set<Listener> = new Set()

  constructor() {
    this.loadFromStorage()
  }

  private loadFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_APPOINTMENTS)
      if (saved) {
        const parsed = JSON.parse(saved)
        this.appointments = Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_APPOINTMENTS
      } else {
        this.appointments = INITIAL_APPOINTMENTS
      }
    } catch {
      this.appointments = INITIAL_APPOINTMENTS
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY_APPOINTMENTS, JSON.stringify(this.appointments))
    } catch (e) {
      console.error('AppointmentStore save error:', e)
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

  public getAll(user?: AppUser | null): Appointment[] {
    if (!user) return [...this.appointments]
    if (user.role === 'ADMIN' || user.scope === 'ALL') return [...this.appointments]
    if (user.scope === 'ASSIGNED_ONLY') {
      return this.appointments.filter(
        (a) => a.assignedToUserId === user.id || a.assignedToUserName === user.fullName
      )
    }
    // Scope DEPARTMENT
    return [...this.appointments]
  }

  public createAppointment(
    data: {
      leadId?: string
      customerName: string
      customerPhone: string
      date: string
      time: string
      location?: string
      type: AppointmentType
      assignedToUserId?: string
      assignedToUserName: string
      projectName?: string
      notes?: string
    },
    user: AppUser
  ): Appointment {
    const newApt: Appointment = {
      id: 'apt-' + Date.now(),
      leadId: data.leadId,
      customerName: data.customerName.trim(),
      customerPhone: data.customerPhone.trim(),
      date: data.date,
      time: data.time,
      location: data.location || 'Merkez Satış Ofisi',
      type: data.type,
      status: 'SCHEDULED',
      assignedToUserId: data.assignedToUserId,
      assignedToUserName: data.assignedToUserName || user.fullName,
      createdByUserId: user.id,
      createdByDepartment: user.department,
      projectName: data.projectName,
      notes: data.notes,
      createdAt: new Date().toISOString(),
    }

    this.appointments = [newApt, ...this.appointments]
    this.saveToStorage()
    return newApt
  }

  public updateStatus(
    id: string,
    status: AppointmentStatus,
    outcomeNote?: string
  ): Appointment | undefined {
    const index = this.appointments.findIndex((a) => a.id === id)
    if (index === -1) return undefined

    const updated: Appointment = {
      ...this.appointments[index],
      status,
      outcomeNote: outcomeNote || this.appointments[index].outcomeNote,
    }

    this.appointments[index] = updated
    this.saveToStorage()
    return updated
  }

  public deleteAppointment(id: string): boolean {
    const before = this.appointments.length
    this.appointments = this.appointments.filter((a) => a.id !== id)
    this.saveToStorage()
    return this.appointments.length < before
  }
}

export const appointmentStore = new AppointmentStore()
