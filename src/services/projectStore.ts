import { AppUser } from './userStore'
import { permissionService } from './permissionService'

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
  type: string
  totalUnits: number
  deliveryDate: string
  startingPrice: number
  imageUrl: string
  status: 'SATISTA' | 'YAKINDA' | 'TAMAMLANDI'
  units: FlatUnit[]
}

const STORAGE_KEY_PROJECTS = 'demirturk_projects_v2'

function generateInitialFlats(projectId: string, code: string): FlatUnit[] {
  const types: RoomType[] = ['1+1', '2+1', '3+1', '4+1', 'Penthouse']
  const flats: FlatUnit[] = []

  for (let i = 1; i <= 24; i++) {
    const floor = Math.floor((i - 1) / 4) + 1
    const rType = types[(i - 1) % types.length]
    const baseSqm = rType === '1+1' ? 65 : rType === '2+1' ? 95 : rType === '3+1' ? 140 : rType === '4+1' ? 190 : 260
    const basePrice = (baseSqm * 48000) + (floor * 50000)

    flats.push({
      id: `${projectId}-u${i}`,
      projectId,
      unitNumber: `D-${i.toString().padStart(2, '0')}`,
      block: i <= 12 ? 'A Blok' : 'B Blok',
      floor,
      roomType: rType,
      grossSqm: baseSqm,
      netSqm: Math.round(baseSqm * 0.78),
      price: basePrice,
      status: i === 3 ? 'REZERVE' : i === 7 ? 'SATILDI' : 'SATISTA',
      reservation: i === 3 ? {
        reservedByUserId: 'usr-demo-sales',
        reservedByUserName: 'Satış Danışmanı',
        customerName: 'Ahmet Ulucak',
        reservedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        expiresAt: new Date(Date.now() + 86400000 * 3).toISOString(),
        depositAmount: 150000,
        note: 'Ön kapora alındı, sözleşme hazırlanıyor.',
      } : undefined,
      sale: i === 7 ? {
        soldByUserId: 'usr-demo-sales',
        soldByUserName: 'Satış Danışmanı',
        customerName: 'Murat Şahin',
        soldAt: new Date(Date.now() - 86400000 * 5).toISOString(),
        salePrice: 5200000,
        contractNo: 'SZL-2026-042',
        paymentPlan: '%50 Peşin + 24 Ay Taksit',
      } : undefined,
      history: [
        {
          id: 'aud-init',
          fromStatus: 'SATISTA',
          toStatus: i === 3 ? 'REZERVE' : i === 7 ? 'SATILDI' : 'SATISTA',
          changedByUserId: 'system',
          changedByUserName: 'Sistem',
          changedAt: new Date(Date.now() - 86400000 * 10).toISOString(),
          reason: 'Başlangıç envanter girişi',
        },
      ],
    })
  }

  return flats
}

const INITIAL_PROJECTS: SharedProject[] = [
  {
    id: 'prj-1',
    code: 'PRJ-101',
    name: 'Demirtürk Panorama Rezidans',
    location: 'Kadıköy, İstanbul',
    city: 'İstanbul',
    type: 'Rezidans & Yaşam',
    totalUnits: 24,
    deliveryDate: 'Aralık 2026',
    startingPrice: 3850000,
    imageUrl: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
    status: 'SATISTA',
    units: generateInitialFlats('prj-1', 'PRJ-101'),
  },
  {
    id: 'prj-2',
    code: 'PRJ-102',
    name: 'Demirtürk Ege Vadi Villaları',
    location: 'Urla, İzmir',
    city: 'İzmir',
    type: 'Müstakil Villa',
    totalUnits: 12,
    deliveryDate: 'Haziran 2027',
    startingPrice: 12500000,
    imageUrl: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80',
    status: 'SATISTA',
    units: [],
  },
]

type Listener = () => void

class ProjectStore {
  private projects: SharedProject[] = []
  private listeners: Set<Listener> = new Set()

  constructor() {
    this.loadFromStorage()
  }

  private loadFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PROJECTS)
      if (saved) {
        const parsed = JSON.parse(saved)
        this.projects = Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_PROJECTS
      } else {
        this.projects = INITIAL_PROJECTS
      }

      // Ensure units are initialized for projects
      this.projects = this.projects.map((p) => {
        if (!p.units || p.units.length === 0) {
          return {
            ...p,
            units: generateInitialFlats(p.id, p.code),
          }
        }
        return p
      })
    } catch {
      this.projects = INITIAL_PROJECTS
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
    return { success: true }
  }

  public addProject(data: Omit<SharedProject, 'id' | 'units'>): SharedProject {
    const newPrj: SharedProject = {
      ...data,
      id: 'prj-' + Date.now(),
      units: [],
    }
    newPrj.units = generateInitialFlats(newPrj.id, newPrj.code)
    this.projects = [newPrj, ...this.projects]
    this.saveToStorage()
    return newPrj
  }
}

export const projectStore = new ProjectStore()
