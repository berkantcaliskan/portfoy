import { AppUser } from './userStore'
import { permissionService } from './permissionService'
import { supabase, isSupabaseConfigured } from './supabaseClient'
import { syncService } from './syncService'
import { rowToProject, rowToUnit } from './dbMapper'

export type FlatStatus = 'SATISTA' | 'REZERVE' | 'SATILDI'
export type RoomType = '1+1' | '2+1' | '3+1' | '4+1' | 'Villa' | 'Penthouse' | 'Ticari'

export interface FlatAuditEntry {
  id: string
  fromStatus: FlatStatus
  toStatus: FlatStatus
  changedByUserId: string
  changedByUserName: string
  changedAt: string
  reason: string
}

export interface FlatReservation {
  reservedByUserId: string
  reservedByUserName: string
  customerName: string
  customerId?: string
  reservedAt: string
  expiresAt: string // Rezervasyon bitiş tarihi
  depositAmount?: number
  note?: string
}

export interface FlatSale {
  soldByUserId: string
  soldByUserName: string
  customerName: string
  customerId?: string
  soldAt: string
  salePrice: number
  contractNo?: string
  paymentPlan?: string
}

export type BlueprintLayoutTemplate = 'quad' | 'corridor' | 'wing' | 'villa'

export interface UnitPlanBox {
  x: number // percentage 0..100
  y: number // percentage 0..100
  w: number // percentage 5..100
  h: number // percentage 5..100
}

export interface FlatUnit {
  id: string
  projectId: string
  unitNumber: string
  block?: string
  floor: number
  roomType: RoomType
  grossSqm: number
  netSqm: number
  price: number
  status: FlatStatus
  facade?: string
  description?: string
  planBox?: UnitPlanBox
  reservation?: FlatReservation
  sale?: FlatSale
  history: FlatAuditEntry[]
}

export interface SharedProject {
  id: string
  code: string
  name: string
  location: string
  city: string
  district?: string
  mevki?: string
  type: string
  totalUnits: number
  deliveryDate: string
  startingPrice?: number
  imageUrl: string
  blueprintUrl?: string
  floorPlans?: Record<string, string>
  layoutTemplate?: BlueprintLayoutTemplate
  maxFloors?: 1 | 2 | 3
  unitsPerFloor?: number
  blockCount?: 1 | 2
  defaultRoomType?: RoomType | 'MIXED'
  sourceDocumentName?: string
  sourceDocumentSummary?: string
  status: 'SATISTA' | 'YAKINDA' | 'TAMAMLANDI'
  description?: string
  units: FlatUnit[]
}

const STORAGE_KEY_PROJECTS = 'demirturk_projects_v2'

/**
 * Ensure every project's units use strictly 0 (Zemin), 1 (1. Kat), or 2 (2. Kat) (Max 3 floors)
 */
function normalizeProjectFloors(project: SharedProject): SharedProject {
  const maxFl: 1 | 2 | 3 =
    project.maxFloors === 1 || project.maxFloors === 2 || project.maxFloors === 3
      ? project.maxFloors
      : 3
  const units = Array.isArray(project.units) ? project.units : []
  const needsRemap = units.some((u) => u.floor < 0 || u.floor >= maxFl || u.floor > 2)
  if (!needsRemap && project.maxFloors) return project

  const remappedUnits = units.map((u, idx) => {
    let fl = u.floor
    if (typeof fl !== 'number' || isNaN(fl) || fl < 0 || fl > 2 || fl >= maxFl) {
      fl = idx % maxFl
    }
    return {
      ...u,
      floor: fl,
    }
  })

  return {
    ...project,
    maxFloors: maxFl,
    units: remappedUnits,
  }
}

type Listener = () => void

class ProjectStore {
  private projects: SharedProject[] = []
  private listeners: Set<Listener> = new Set()
  private realtimeChannel: any = null

  constructor() {
    this.loadFromStorage()
    this.initRealtime()
  }

  public setLoadedProjects(projects: SharedProject[]) {
    this.projects = (projects || []).map(normalizeProjectFloors)
    try {
      localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(this.projects))
    } catch {}
    this.notify()
  }

  private initRealtime() {
    if (!isSupabaseConfigured() || this.realtimeChannel) return
    this.realtimeChannel = supabase
      .channel('realtime:projects')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const incoming = rowToProject(payload.new)
          if (!this.projects.some((p) => p.id === incoming.id)) {
            this.projects = [incoming, ...this.projects]
            this.saveToStorage()
          }
        } else if (payload.eventType === 'UPDATE') {
          const incoming = rowToProject(payload.new)
          const idx = this.projects.findIndex((p) => p.id === incoming.id)
          if (idx !== -1) {
            this.projects[idx] = { ...this.projects[idx], ...incoming, units: this.projects[idx].units }
            this.saveToStorage()
          }
        } else if (payload.eventType === 'DELETE') {
          const deletedId = (payload.old as any)?.id
          if (deletedId) {
            this.projects = this.projects.filter((p) => p.id !== deletedId)
            this.saveToStorage()
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'units' }, (payload) => {
        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
          const unit = rowToUnit(payload.new)
          const project = this.projects.find((p) => p.id === unit.projectId)
          if (project) {
            const uIdx = project.units.findIndex((u) => u.id === unit.id)
            if (uIdx !== -1) {
              project.units[uIdx] = unit
            } else {
              project.units.push(unit)
            }
            this.saveToStorage()
          }
        } else if (payload.eventType === 'DELETE') {
          const deletedId = (payload.old as any)?.id
          if (deletedId) {
            this.projects.forEach((p) => {
              p.units = p.units.filter((u) => u.id !== deletedId)
            })
            this.saveToStorage()
          }
        }
      })
      .subscribe()
  }

  private loadFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PROJECTS)
      if (saved) {
        const parsed = JSON.parse(saved)
        this.projects = Array.isArray(parsed) ? parsed.map(normalizeProjectFloors) : []
      } else {
        this.projects = []
      }
    } catch {
      this.projects = []
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(this.projects))
    } catch (e) {
      console.error('ProjectStore save error:', e)
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

  public getAll(): SharedProject[] {
    return [...this.projects]
  }

  public getById(id: string): SharedProject | undefined {
    return this.projects.find((p) => p.id === id)
  }

  public getUnitById(projectId: string, unitId: string): FlatUnit | undefined {
    const project = this.getById(projectId)
    return project?.units.find((u) => u.id === unitId)
  }

  /**
   * CONFLICT PREVENTION (Race-Lock):
   * Atomically checks status before reserving.
   * If not 'SATISTA', throws a hard error preventing double reservation.
   */
  public reserveUnit(
    projectId: string,
    unitId: string,
    user: AppUser,
    reservationData: {
      customerName: string
      customerId?: string
      expiresAt: string
      depositAmount?: number
      note?: string
    }
  ): { success: boolean; error?: string; unit?: FlatUnit } {
    const projectIndex = this.projects.findIndex((p) => p.id === projectId)
    if (projectIndex === -1) return { success: false, error: 'Proje bulunamadı.' }

    const project = this.projects[projectIndex]
    const unitIndex = project.units.findIndex((u) => u.id === unitId)
    if (unitIndex === -1) return { success: false, error: 'Daire bulunamadı.' }

    const targetUnit = project.units[unitIndex]

    // AUTHORITATIVE RACE-LOCK CHECK
    if (targetUnit.status === 'REZERVE') {
      const byWhom = targetUnit.reservation?.reservedByUserName || 'Başka bir danışman'
      return {
        success: false,
        error: `ÇAKIŞMA UYARISI: Bu daire zaten ${byWhom} tarafından rezerve edilmiştir. Rezervasyon süresi dolmadan veya iptal edilmeden yeni rezervasyon yapılamaz.`,
      }
    }

    if (targetUnit.status === 'SATILDI') {
      return {
        success: false,
        error: `Bu daire zaten satılmıştır ve üzerinde rezervasyon işlemi yapılamaz.`,
      }
    }

    const newReservation: FlatReservation = {
      reservedByUserId: user.id,
      reservedByUserName: user.fullName,
      customerName: reservationData.customerName.trim(),
      customerId: reservationData.customerId,
      reservedAt: new Date().toISOString(),
      expiresAt: reservationData.expiresAt,
      depositAmount: reservationData.depositAmount,
      note: reservationData.note,
    }

    const auditEntry: FlatAuditEntry = {
      id: 'aud-' + Date.now(),
      fromStatus: 'SATISTA',
      toStatus: 'REZERVE',
      changedByUserId: user.id,
      changedByUserName: user.fullName,
      changedAt: new Date().toISOString(),
      reason: `Rezervasyon oluşturuldu: ${reservationData.customerName} (${user.fullName})`,
    }

    const updatedUnit: FlatUnit = {
      ...targetUnit,
      status: 'REZERVE',
      reservation: newReservation,
      history: [auditEntry, ...targetUnit.history],
    }

    project.units[unitIndex] = updatedUnit
    this.projects[projectIndex] = { ...project }
    this.saveToStorage()
    syncService.saveUnit(updatedUnit)
    return { success: true, unit: updatedUnit }
  }

  /**
   * Cancel reservation
   */
  public cancelReservation(
    projectId: string,
    unitId: string,
    user: AppUser,
    reason: string
  ): { success: boolean; error?: string } {
    const project = this.getById(projectId)
    if (!project) return { success: false, error: 'Proje bulunamadı.' }

    const unit = project.units.find((u) => u.id === unitId)
    if (!unit) return { success: false, error: 'Daire bulunamadı.' }

    if (unit.status !== 'REZERVE') {
      return { success: false, error: 'Bu daire şu an rezerve durumda değil.' }
    }

    // Permission check: only reserving user or admin/manager can cancel
    const isOwner = unit.reservation?.reservedByUserId === user.id
    const isAuthorized = isOwner || user.role === 'ADMIN' || user.isManager
    if (!isAuthorized) {
      return {
        success: false,
        error: 'Bu rezervasyonu yalnızca oluşturan danışman veya yönetici iptal edebilir.',
      }
    }

    const auditEntry: FlatAuditEntry = {
      id: 'aud-' + Date.now(),
      fromStatus: 'REZERVE',
      toStatus: 'SATISTA',
      changedByUserId: user.id,
      changedByUserName: user.fullName,
      changedAt: new Date().toISOString(),
      reason: `Rezervasyon iptal edildi: ${reason}`,
    }

    unit.status = 'SATISTA'
    unit.reservation = undefined
    unit.history = [auditEntry, ...unit.history]

    this.saveToStorage()
    syncService.saveUnit(unit)
    return { success: true }
  }

  /**
   * Finalize Sale
   */
  public sellUnit(
    projectId: string,
    unitId: string,
    user: AppUser,
    saleData: {
      customerName: string
      customerId?: string
      salePrice: number
      contractNo?: string
      paymentPlan?: string
    }
  ): { success: boolean; error?: string; unit?: FlatUnit } {
    const projectIndex = this.projects.findIndex((p) => p.id === projectId)
    if (projectIndex === -1) return { success: false, error: 'Proje bulunamadı.' }

    const project = this.projects[projectIndex]
    const unitIndex = project.units.findIndex((u) => u.id === unitId)
    if (unitIndex === -1) return { success: false, error: 'Daire bulunamadı.' }

    const targetUnit = project.units[unitIndex]

    if (targetUnit.status === 'SATILDI') {
      return { success: false, error: 'Bu daire zaten satılmıştır.' }
    }

    if (targetUnit.status === 'REZERVE') {
      const isOwner = targetUnit.reservation?.reservedByUserId === user.id
      if (!isOwner && user.role !== 'ADMIN' && !user.isManager) {
        return {
          success: false,
          error: `Bu daire ${targetUnit.reservation?.reservedByUserName} adına rezerve edilmiştir. Satış işlemini yalnızca rezervasyon sahibi veya yönetici gerçekleştirebilir.`,
        }
      }
    }

    const newSale: FlatSale = {
      soldByUserId: user.id,
      soldByUserName: user.fullName,
      customerName: saleData.customerName,
      customerId: saleData.customerId,
      soldAt: new Date().toISOString(),
      salePrice: saleData.salePrice,
      contractNo: saleData.contractNo || `SZL-${Date.now().toString().slice(-5)}`,
      paymentPlan: saleData.paymentPlan,
    }

    const auditEntry: FlatAuditEntry = {
      id: 'aud-' + Date.now(),
      fromStatus: targetUnit.status,
      toStatus: 'SATILDI',
      changedByUserId: user.id,
      changedByUserName: user.fullName,
      changedAt: new Date().toISOString(),
      reason: `Satış tamamlandı: ${saleData.customerName} (${saleData.salePrice.toLocaleString('tr-TR')} TL)`,
    }

    const updatedUnit: FlatUnit = {
      ...targetUnit,
      status: 'SATILDI',
      reservation: undefined,
      sale: newSale,
      history: [auditEntry, ...targetUnit.history],
    }

    project.units[unitIndex] = updatedUnit
    this.projects[projectIndex] = { ...project }
    this.saveToStorage()
    syncService.saveUnit(updatedUnit)
    return { success: true, unit: updatedUnit }
  }

  /**
   * Update Unit Price (Protected by permission: canEditProjectPrice)
   */
  public updateUnitPrice(
    projectId: string,
    unitId: string,
    user: AppUser,
    newPrice: number
  ): { success: boolean; error?: string } {
    if (!permissionService.canEditProjectPrice(user)) {
      return {
        success: false,
        error: 'Proje veya daire fiyatını güncelleme yetkiniz bulunmamaktadır.',
      }
    }

    const project = this.getById(projectId)
    const unit = project?.units.find((u) => u.id === unitId)
    if (!unit) return { success: false, error: 'Daire bulunamadı.' }

    const oldPrice = unit.price
    unit.price = newPrice
    unit.history.unshift({
      id: 'aud-' + Date.now(),
      fromStatus: unit.status,
      toStatus: unit.status,
      changedByUserId: user.id,
      changedByUserName: user.fullName,
      changedAt: new Date().toISOString(),
      reason: `Fiyat güncellendi: ${oldPrice.toLocaleString('tr-TR')} TL ➔ ${newPrice.toLocaleString('tr-TR')} TL`,
    })

    this.saveToStorage()
    syncService.saveUnit(unit)
    return { success: true }
  }

  /**
   * Update Unit Details (Price, Facade, Description, RoomType, Sqm, Block, Floor)
   */
  public updateUnitDetails(
    projectId: string,
    unitId: string,
    updates: {
      price?: number
      facade?: string
      description?: string
      grossSqm?: number
      netSqm?: number
      roomType?: RoomType
      block?: string
      floor?: number
    },
    user?: AppUser | null
  ): { success: boolean; error?: string; unit?: FlatUnit } {
    const project = this.getById(projectId)
    const unit = project?.units.find((u) => u.id === unitId)
    if (!unit) return { success: false, error: 'Daire bulunamadı.' }

    const oldPrice = unit.price
    if (updates.price !== undefined) unit.price = updates.price
    if (updates.facade !== undefined) unit.facade = updates.facade
    if (updates.description !== undefined) unit.description = updates.description
    if (updates.grossSqm !== undefined) unit.grossSqm = updates.grossSqm
    if (updates.netSqm !== undefined) unit.netSqm = updates.netSqm
    if (updates.roomType !== undefined) unit.roomType = updates.roomType
    if (updates.block !== undefined) unit.block = updates.block
    if (updates.floor !== undefined) unit.floor = updates.floor

    const reasons: string[] = []
    if (updates.price !== undefined && updates.price !== oldPrice) {
      reasons.push(`Fiyat: ${updates.price.toLocaleString('tr-TR')} TL`)
    }
    if (updates.facade) reasons.push(`Cephe: ${updates.facade}`)
    if (updates.description) reasons.push(`Not güncellendi`)

    if (reasons.length > 0) {
      unit.history.unshift({
        id: 'aud-' + Date.now(),
        fromStatus: unit.status,
        toStatus: unit.status,
        changedByUserId: user?.id || 'sys',
        changedByUserName: user?.fullName || 'Danışman',
        changedAt: new Date().toISOString(),
        reason: `Daire detayları güncellendi (${reasons.join(', ')})`,
      })
    }

    this.saveToStorage()
    syncService.saveUnit(unit)
    return { success: true, unit }
  }

  public addProject(
    data: Omit<SharedProject, 'id' | 'units'> & {
      parsedUnits?: {
        unitNumber: string
        block: string
        floor: number
        roomType: RoomType
        grossSqm: number
        netSqm: number
        price: number
        status: FlatStatus
        facade?: string
        description?: string
      }[]
    }
  ): SharedProject {
    const maxFl: 1 | 2 | 3 =
      data.maxFloors === 1 || data.maxFloors === 2 || data.maxFloors === 3 ? data.maxFloors : 3
    const blkCount: 1 | 2 = data.blockCount === 2 ? 2 : 1
    const upf = Math.max(1, Math.min(8, data.unitsPerFloor || 4))
    const defaultRm = data.defaultRoomType || 'MIXED'

    const { parsedUnits, ...restData } = data
    const newPrj: SharedProject = {
      ...restData,
      id: 'prj-' + Date.now(),
      maxFloors: maxFl,
      unitsPerFloor: upf,
      blockCount: blkCount,
      defaultRoomType: defaultRm,
      units: [],
    }

    const types: RoomType[] = ['1+1', '2+1', '3+1', '4+1']
    const flats: FlatUnit[] = []

    if (parsedUnits && parsedUnits.length > 0) {
      parsedUnits.forEach((pu, idx) => {
        const clampedFl = Math.max(0, Math.min(maxFl - 1, Math.min(2, pu.floor ?? idx % maxFl)))
        flats.push({
          id: `${newPrj.id}-u${idx + 1}`,
          projectId: newPrj.id,
          unitNumber: pu.unitNumber || `D-${(idx + 1).toString().padStart(2, '0')}`,
          block: pu.block || 'A Blok',
          floor: clampedFl,
          roomType: pu.roomType || '2+1',
          grossSqm: pu.grossSqm || 100,
          netSqm: pu.netSqm || 80,
          price: pu.price || 0,
          status: pu.status || 'SATISTA',
          facade: pu.facade || (clampedFl === 0 ? 'Bahçe / Peyzaj Cephe' : 'Güney / Ön Cephe'),
          description: pu.description,
          history: [],
        })
      })
    } else {
      const blocks = blkCount === 2 ? ['A Blok', 'B Blok'] : ['A Blok']
      let unitSeq = 1
      for (const blk of blocks) {
        for (let fl = 0; fl < maxFl; fl++) {
          for (let u = 0; u < upf; u++) {
            const rType: RoomType =
              defaultRm !== 'MIXED' ? defaultRm : types[(unitSeq - 1) % types.length]
            const baseSqm =
              rType === '1+1'
                ? 68
                : rType === '2+1'
                ? 98
                : rType === '3+1'
                ? 142
                : rType === '4+1'
                ? 185
                : 230
            const basePrice =
              data.startingPrice && data.startingPrice > 0
                ? data.startingPrice + fl * 75000
                : baseSqm * 46000 + fl * 75000

            flats.push({
              id: `${newPrj.id}-u${unitSeq}`,
              projectId: newPrj.id,
              unitNumber: `D-${unitSeq.toString().padStart(2, '0')}`,
              block: blk,
              floor: fl, // 0 = Zemin, 1 = 1. Kat, 2 = 2. Kat
              roomType: rType,
              grossSqm: baseSqm,
              netSqm: Math.round(baseSqm * 0.8),
              price: basePrice,
              status: 'SATISTA',
              facade: fl === 0 ? 'Bahçe / Peyzaj Cephe' : u % 2 === 0 ? 'Güney / Ön Cephe' : 'Doğu / Köşe Cephe',
              history: [],
            })
            unitSeq++
          }
        }
      }
    }

    newPrj.totalUnits = flats.length
    newPrj.units = flats
    this.projects = [newPrj, ...this.projects]
    this.saveToStorage()
    syncService.saveProject(newPrj)
    return newPrj
  }

  /**
   * Reconfigure an existing project's 3-floor Kroki layout (automatically from uploaded doc or manually via controls)
   */
  public reconfigureProjectKroki(
    projectId: string,
    config: {
      maxFloors: 1 | 2 | 3
      unitsPerFloor: number
      blockCount?: 1 | 2
      defaultRoomType?: RoomType | 'MIXED'
      layoutTemplate?: BlueprintLayoutTemplate
      blueprintDataUrl?: string
      sourceDocumentName?: string
      sourceDocumentSummary?: string
      parsedUnits?: {
        unitNumber: string
        block: string
        floor: number
        roomType: RoomType
        grossSqm: number
        netSqm: number
        price: number
        status: FlatStatus
        facade?: string
      }[]
    }
  ): { success: boolean; project?: SharedProject; error?: string } {
    const idx = this.projects.findIndex((p) => p.id === projectId)
    if (idx === -1) return { success: false, error: 'Proje bulunamadı.' }

    const current = this.projects[idx]
    const maxFl: 1 | 2 | 3 =
      config.maxFloors === 1 || config.maxFloors === 2 || config.maxFloors === 3
        ? config.maxFloors
        : 3
    const upf = Math.max(1, Math.min(8, config.unitsPerFloor || 4))
    const blkCount: 1 | 2 = config.blockCount || current.blockCount || 1
    const defaultRm: RoomType | 'MIXED' =
      config.defaultRoomType || current.defaultRoomType || 'MIXED'

    const existingUnits = current.units || []
    const types: RoomType[] = ['1+1', '2+1', '3+1', '4+1']
    const nextUnits: FlatUnit[] = []

    if (config.parsedUnits && config.parsedUnits.length > 0) {
      config.parsedUnits.forEach((pu, i) => {
        const clampedFl = Math.max(0, Math.min(maxFl - 1, Math.min(2, pu.floor ?? i % maxFl)))
        const existingMatch = existingUnits[i]
        nextUnits.push({
          id: existingMatch?.id || `${current.id}-u${i + 1}-${Date.now()}`,
          projectId: current.id,
          unitNumber: pu.unitNumber || `D-${(i + 1).toString().padStart(2, '0')}`,
          block: pu.block || 'A Blok',
          floor: clampedFl,
          roomType: pu.roomType || '2+1',
          grossSqm: pu.grossSqm || 100,
          netSqm: pu.netSqm || 80,
          price: pu.price || existingMatch?.price || 4600000,
          status: existingMatch?.status !== 'SATISTA' && existingMatch ? existingMatch.status : pu.status || 'SATISTA',
          facade: pu.facade || (clampedFl === 0 ? 'Bahçe / Peyzaj Cephe' : 'Güney / Ön Cephe'),
          reservation: existingMatch?.reservation,
          sale: existingMatch?.sale,
          history: existingMatch?.history || [],
        })
      })
    } else {
      const blocks = blkCount === 2 ? ['A Blok', 'B Blok'] : ['A Blok']
      let seq = 0
      for (const blk of blocks) {
        for (let fl = 0; fl < maxFl; fl++) {
          for (let u = 0; u < upf; u++) {
            const existing = existingUnits[seq]
            const rType: RoomType =
              defaultRm !== 'MIXED'
                ? defaultRm
                : existing?.roomType || types[seq % types.length]
            const baseSqm =
              rType === '1+1'
                ? 68
                : rType === '2+1'
                ? 98
                : rType === '3+1'
                ? 142
                : rType === '4+1'
                ? 185
                : 230
            const gross = defaultRm !== 'MIXED' ? baseSqm : existing?.grossSqm || baseSqm
            const net = Math.round(gross * 0.8)
            const price =
              existing && existing.price > 0
                ? existing.price
                : gross * 46000 + fl * 75000

            nextUnits.push({
              id: existing?.id || `${current.id}-u${seq + 1}-${Date.now()}`,
              projectId: current.id,
              unitNumber: `D-${(seq + 1).toString().padStart(2, '0')}`,
              block: blk,
              floor: fl, // 0: Zemin, 1: 1. Kat, 2: 2. Kat
              roomType: rType,
              grossSqm: gross,
              netSqm: net,
              price,
              status: existing?.status || 'SATISTA',
              facade:
                existing?.facade ||
                (fl === 0 ? 'Bahçe / Peyzaj Cephe' : u % 2 === 0 ? 'Güney / Ön Cephe' : 'Doğu / Köşe Cephe'),
              description: existing?.description,
              reservation: existing?.reservation,
              sale: existing?.sale,
              history: existing?.history || [],
            })
            seq++
          }
        }
      }
    }

    const nextFloorPlans = { ...(current.floorPlans || {}) }
    if (config.blueprintDataUrl) {
      nextFloorPlans['DEFAULT'] = config.blueprintDataUrl
    }

    const updated: SharedProject = {
      ...current,
      maxFloors: maxFl,
      unitsPerFloor: upf,
      blockCount: blkCount,
      defaultRoomType: defaultRm,
      layoutTemplate: config.layoutTemplate || current.layoutTemplate || 'quad',
      blueprintUrl: config.blueprintDataUrl || current.blueprintUrl,
      floorPlans: nextFloorPlans,
      sourceDocumentName: config.sourceDocumentName ?? current.sourceDocumentName,
      sourceDocumentSummary: config.sourceDocumentSummary ?? current.sourceDocumentSummary,
      totalUnits: nextUnits.length,
      units: nextUnits,
    }

    this.projects[idx] = updated
    this.saveToStorage()
    syncService.saveProject(updated)
    return { success: true, project: updated }
  }

  public updateProject(
    projectId: string,
    updates: Partial<Omit<SharedProject, 'id' | 'units'>>
  ): { success: boolean; project?: SharedProject; error?: string } {
    const idx = this.projects.findIndex((p) => p.id === projectId)
    if (idx === -1) return { success: false, error: 'Proje bulunamadı.' }

    const current = this.projects[idx]
    const updated: SharedProject = {
      ...current,
      ...updates,
      id: current.id,
      units: current.units,
    }

    this.projects[idx] = updated
    this.saveToStorage()
    syncService.saveProject(updated)
    return { success: true, project: updated }
  }

  public deleteProject(projectId: string): { success: boolean; error?: string } {
    const idx = this.projects.findIndex((p) => p.id === projectId)
    if (idx === -1) return { success: false, error: 'Proje bulunamadı.' }

    this.projects.splice(idx, 1)
    this.saveToStorage()
    syncService.deleteProject(projectId)
    return { success: true }
  }

  public cancelSale(
    projectId: string,
    unitId: string,
    user: AppUser,
    reason: string = 'Satış işlemi geri alındı / iptal edildi.'
  ): { success: boolean; error?: string; unit?: FlatUnit } {
    const project = this.getById(projectId)
    if (!project) return { success: false, error: 'Proje bulunamadı.' }

    const unit = project.units.find((u) => u.id === unitId)
    if (!unit) return { success: false, error: 'Daire bulunamadı.' }

    if (unit.status !== 'SATILDI') {
      return { success: false, error: 'Bu daire satılmış durumda değil.' }
    }

    const prevCustomer = unit.sale?.customerName || 'Müşteri'
    const prevPrice = unit.sale?.salePrice ? ` (${unit.sale.salePrice.toLocaleString('tr-TR')} TL)` : ''

    const auditEntry: FlatAuditEntry = {
      id: 'aud-' + Date.now(),
      fromStatus: 'SATILDI',
      toStatus: 'SATISTA',
      changedByUserId: user.id,
      changedByUserName: user.fullName,
      changedAt: new Date().toISOString(),
      reason: `Satış işlemi geri alındı: ${prevCustomer}${prevPrice}. Gerekçe: ${reason}`,
    }

    unit.status = 'SATISTA'
    unit.sale = undefined
    unit.history = [auditEntry, ...unit.history]

    this.saveToStorage()
    syncService.saveUnit(unit)
    return { success: true, unit }
  }

  public updateFloorPlan(
    projectId: string,
    floorKey: string,
    dataUrl: string | null
  ): { success: boolean; error?: string } {
    const idx = this.projects.findIndex((p) => p.id === projectId)
    if (idx === -1) return { success: false, error: 'Proje bulunamadı.' }

    const current = this.projects[idx]
    const nextFloorPlans = { ...(current.floorPlans || {}) }
    if (dataUrl) {
      nextFloorPlans[floorKey] = dataUrl
    } else {
      delete nextFloorPlans[floorKey]
    }

    const updated: SharedProject = {
      ...current,
      floorPlans: nextFloorPlans,
      blueprintUrl: floorKey === 'DEFAULT' ? (dataUrl || undefined) : current.blueprintUrl,
    }
    this.projects[idx] = updated
    this.saveToStorage()
    syncService.saveProject(updated)
    return { success: true }
  }

  public updateUnitPlanBox(
    projectId: string,
    unitId: string,
    planBox?: UnitPlanBox
  ): { success: boolean; error?: string } {
    const project = this.getById(projectId)
    const unit = project?.units.find((u) => u.id === unitId)
    if (!unit) return { success: false, error: 'Daire bulunamadı.' }

    unit.planBox = planBox
    this.saveToStorage()
    syncService.saveUnit(unit)
    return { success: true }
  }
}

export const projectStore = new ProjectStore()
