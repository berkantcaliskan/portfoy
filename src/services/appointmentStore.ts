import { AppUser } from './userStore'
import { Department } from '@/types/department'
import { supabase, isSupabaseConfigured } from './supabaseClient'
import { syncService } from './syncService'
import { rowToAppointment } from './dbMapper'

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

const INITIAL_APPOINTMENTS: Appointment[] = []

type Listener = () => void

class AppointmentStore {
  private appointments: Appointment[] = []
  private listeners: Set<Listener> = new Set()
  private realtimeChannel: any = null

  constructor() {
    this.loadFromStorage()
    this.initRealtime()
  }

  public setLoadedAppointments(appointments: Appointment[]) {
    const byId = new Map<string, Appointment>()
    for (const a of appointments || []) byId.set(a.id, a)
    for (const local of this.appointments) {
      if (!byId.has(local.id)) {
        byId.set(local.id, local)
        syncService.saveAppointment(local)
      }
    }
    this.appointments = Array.from(byId.values())
    try {
      localStorage.setItem(STORAGE_KEY_APPOINTMENTS, JSON.stringify(this.appointments))
    } catch {}
    this.notify()
  }

  private initRealtime() {
    if (!isSupabaseConfigured() || this.realtimeChannel) return
    this.realtimeChannel = supabase
      .channel('realtime:appointments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const incoming = rowToAppointment(payload.new)
          if (!this.appointments.some((a) => a.id === incoming.id)) {
            this.appointments = [incoming, ...this.appointments]
            this.saveToStorage()
          }
        } else if (payload.eventType === 'UPDATE') {
          const incoming = rowToAppointment(payload.new)
          const idx = this.appointments.findIndex((a) => a.id === incoming.id)
          if (idx !== -1) {
            this.appointments[idx] = incoming
            this.saveToStorage()
          }
        } else if (payload.eventType === 'DELETE') {
          this.appointments = this.appointments.filter((a) => a.id !== (payload.old as any).id)
          this.saveToStorage()
        }
      })
      .subscribe()
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
    syncService.saveAppointment(newApt)
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
    syncService.saveAppointment(updated)
    return updated
  }

  public updateAppointment(
    id: string,
    updates: Partial<Omit<Appointment, 'id' | 'createdAt'>>
  ): Appointment | undefined {
    const index = this.appointments.findIndex((a) => a.id === id)
    if (index === -1) return undefined

    const updated: Appointment = {
      ...this.appointments[index],
      ...updates,
    }

    this.appointments[index] = updated
    this.saveToStorage()
    syncService.saveAppointment(updated)
    return updated
  }

  public deleteAppointment(id: string): boolean {
    const before = this.appointments.length
    this.appointments = this.appointments.filter((a) => a.id !== id)
    this.saveToStorage()
    syncService.deleteAppointment(id)
    return this.appointments.length < before
  }
}

export const appointmentStore = new AppointmentStore()
