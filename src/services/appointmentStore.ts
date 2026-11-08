import { userStore, type AppUser } from './userStore'
import { isCentralCrm } from './crmRuntime'
import { CrmBackendError, createCrmBackendRepository, type CrmWriteCommand } from './crmBackendRepository'
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
  private revisions = new Map<string, number>()
  private accountId: string | null = null
  private generation = 0
  private readSequence = 0
  private pendingWrite: { key: string; command: CrmWriteCommand } | null = null
  private writing = false
  private readError = ''
  private listeners: Set<Listener> = new Set()
  private realtimeChannel: any = null

  constructor() {
    if (isCentralCrm()) return
    this.loadFromStorage()
    this.initRealtime()
    if (typeof window !== 'undefined') {
      window.addEventListener('demirturk:cloud-db-synced', () => {
        this.loadFromStorage()
        this.notify()
      })
    }
  }

  public setLoadedAppointments(appointments: Appointment[]) {
    if (isCentralCrm()) return
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
    if (isCentralCrm()) {
      const activeId = userStore.getCurrentUser()?.id
      return activeId && activeId === this.accountId && (!user || user.id === activeId) ? [...this.appointments] : []
    }
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

  public getReadError() {
    return this.readError
  }

  public setAccount(id: string | null) {
    if (!isCentralCrm() || this.accountId === id) return
    this.accountId = id
    this.generation++
    this.appointments = []
    this.revisions.clear()
    this.pendingWrite = null
    this.readError = ''
    this.notify()
  }

  private getRepository() {
    const client = userStore.getServerClient()
    if (!client || !this.accountId || this.accountId !== userStore.getCurrentUser()?.id) {
      throw new Error('Randevular için sunucu oturumu gerekli.')
    }
    return createCrmBackendRepository(client)
  }

  public async refreshFromBackend() {
    if (!isCentralCrm() || !this.accountId || this.writing) return
    const generation = this.generation
    const sequence = ++this.readSequence
    const records: Appointment[] = []
    const revisions = new Map<string, number>()
    try {
      const repository = this.getRepository()
      let cursor: string | null = ''
      do {
        const page = await repository.list('appointments', cursor, 100)
        if (generation !== this.generation || sequence !== this.readSequence) return
        for (const row of page.records) {
          records.push({ ...row.payload, id: row.id, createdByUserId: row.owner_id, createdByDepartment: row.department } as Appointment)
          revisions.set(row.id, row.revision)
        }
        if (page.next !== null && page.next <= cursor) throw new Error('Randevu listesi doğrulanamadı.')
        cursor = page.next
      } while (cursor !== null)
      this.appointments = records.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      this.revisions = revisions
      this.readError = ''
    } catch (error) {
      if (generation !== this.generation || sequence !== this.readSequence) return
      this.readError = error instanceof Error ? error.message : 'Randevular sunucudan okunamadı.'
    }
    this.notify()
  }

  private async writeBackend(key: string, appointment: Appointment, revision: number, archive = false) {
    if (this.writing) throw new Error('Önceki randevu işlemi sürüyor.')
    const repository = this.getRepository()
    const generation = this.generation
    if (this.pendingWrite && this.pendingWrite.key !== key) {
      throw new Error('Önce sonucu belirsiz kalan randevu işlemini aynı bilgilerle yeniden gönderin.')
    }
    const command = this.pendingWrite?.command ?? {
      requestId: crypto.randomUUID(), module: 'appointments', id: appointment.id,
      revision, payload: { ...appointment }, archive,
    }
    this.pendingWrite = { key, command }
    this.writing = true
    this.readSequence++
    try {
      const result = await repository.write(command)
      if (generation !== this.generation) throw new Error('Randevu işlemi sırasında oturum değişti.')
      const saved = command.payload as unknown as Appointment
      this.appointments = this.appointments.filter(row => row.id !== saved.id)
      if (!archive) this.appointments.unshift(saved)
      this.revisions.set(saved.id, result.revision)
      this.pendingWrite = null
      this.notify()
      return saved
    } catch (error) {
      if (generation === this.generation && error instanceof CrmBackendError &&
          !['request_failed', 'invalid_response'].includes(error.code)) this.pendingWrite = null
      throw error
    } finally {
      this.writing = false
      void this.refreshFromBackend()
    }
  }

  public async createAppointment(
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
  ): Promise<Appointment> {
    const newApt: Appointment = {
      id: isCentralCrm() ? 'apt-' + crypto.randomUUID() : 'apt-' + Date.now(),
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

    if (isCentralCrm()) return this.writeBackend(JSON.stringify(['create', data]), newApt, 0)

    this.appointments = [newApt, ...this.appointments]
    this.saveToStorage()
    syncService.saveAppointment(newApt)
    return newApt
  }

  public async updateStatus(
    id: string,
    status: AppointmentStatus,
    outcomeNote?: string
  ): Promise<Appointment | undefined> {
    if (isCentralCrm()) return this.updateAppointment(id, { status, ...(outcomeNote ? { outcomeNote } : {}) })
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

  public async updateAppointment(
    id: string,
    updates: Partial<Omit<Appointment, 'id' | 'createdAt'>>
  ): Promise<Appointment | undefined> {
    const index = this.appointments.findIndex((a) => a.id === id)
    if (index === -1) return undefined

    const updated: Appointment = {
      ...this.appointments[index],
      ...updates,
    }

    if (isCentralCrm()) {
      const revision = this.revisions.get(id)
      if (!revision) throw new Error('Randevu sürümü bulunamadı. Listeyi yenileyin.')
      return this.writeBackend(JSON.stringify(['update', id, updates]), updated, revision)
    }

    this.appointments[index] = updated
    this.saveToStorage()
    syncService.saveAppointment(updated)
    return updated
  }

  public async deleteAppointment(id: string): Promise<boolean> {
    if (isCentralCrm()) {
      const record = this.appointments.find(row => row.id === id)
      const revision = this.revisions.get(id)
      if (!record || !revision) throw new Error('Randevu bulunamadı. Listeyi yenileyin.')
      await this.writeBackend(JSON.stringify(['archive', id]), record, revision, true)
      return true
    }
    const before = this.appointments.length
    this.appointments = this.appointments.filter((a) => a.id !== id)
    this.saveToStorage()
    syncService.deleteAppointment(id)
    return this.appointments.length < before
  }
}

export const appointmentStore = new AppointmentStore()
