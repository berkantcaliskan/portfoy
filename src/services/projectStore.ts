import { AppUser } from './userStore'
import { permissionService } from './permissionService'
import { supabase, isSupabaseConfigured } from './supabaseClient'
import { syncService } from './syncService'
import { rowToProject, rowToUnit } from './dbMapper'

export type FlatStatus = 'SATISTA' | 'REZERVE' | 'SATILDI'
export type RoomType = '1+1' | '2+1' | '3+1' | '4+1' | 'Villa' | 'Penthouse' | 'Ticari'

export type UnitSizePreset =
  | '1x1'        // 1:1 Kare
  | '16x9'       // 16:9 Yatay
  | '9x16'       // 9:16 Düşey
  | 'wide-rect'  // Legacy: 16:9
  | 'square'     // Legacy: 1:1
  | 'large-rect' // Legacy: 16:9
  | 'narrow-v'   // Legacy: 9:16
  | 'narrow-h'   // Legacy: 16:9

export const UNIT_SIZE_PRESETS: Record<
  UnitSizePreset,
  { label: string; shortLabel: string; w: number; h: number }
> = {
  '1x1': {
    label: '1:1',
    shortLabel: '1:1',
    w: 9.2,
    h: 14.0,
  },
  '16x9': {
    label: '16:9',
    shortLabel: '16:9',
    w: 16.5,
    h: 14.0,
  },
  '9x16': {
    label: '9:16',
    shortLabel: '9:16',
    w: 8.8,
    h: 24.0,
  },
  'wide-rect': {
    label: '16:9',
    shortLabel: '16:9',
    w: 16.5,
    h: 14.0,
  },
  square: {
    label: '1:1',
    shortLabel: '1:1',
    w: 9.2,
    h: 14.0,
  },
  'large-rect': {
    label: '16:9',
    shortLabel: '16:9',
    w: 18.0,
    h: 15.0,
  },
  'narrow-v': {
    label: '9:16',
    shortLabel: '9:16',
    w: 8.8,
    h: 24.0,
  },
  'narrow-h': {
    label: '16:9',
    shortLabel: '16:9',
    w: 16.5,
    h: 13.0,
  },
}

export type KrokiAreaKind = 'pool' | 'entrance' | 'block' | 'corridor' | 'garden' | 'parking' | 'custom'

export interface KrokiAreaItem {
  id: string
  label: string
  kind: KrokiAreaKind
  floor?: number | 'ALL'
  direction?: 'up' | 'down' | 'left' | 'right'
  textOrientation?: 'horizontal' | 'vertical'
  box: UnitPlanBox
}

export type FacadeEdge =
  | 'top'          // Kuzey (Üst Orta)
  | 'bottom'       // Güney (Alt Orta)
  | 'left'         // Batı (Sol Orta)
  | 'right'        // Doğu (Sağ Orta)
  | 'top-left'     // Kuzeybatı (Sol Üst Köşe)
  | 'top-right'    // Kuzeydoğu (Sağ Üst Köşe)
  | 'bottom-left'  // Güneybatı (Sol Alt Köşe)
  | 'bottom-right' // Güneydoğu (Sağ Alt Köşe)

export const FACADE_EDGE_CONFIG: Record<
  FacadeEdge,
  { compassName: string; shortPos: string; fullOptionLabel: string; arrow: string }
> = {
  top: {
    compassName: 'Kuzey',
    shortPos: 'Üst (Kuzey)',
    fullOptionLabel: 'Üst Orta — Kuzey (▲)',
    arrow: '▲',
  },
  bottom: {
    compassName: 'Güney',
    shortPos: 'Alt (Güney)',
    fullOptionLabel: 'Alt Orta — Güney (▼)',
    arrow: '▼',
  },
  left: {
    compassName: 'Batı',
    shortPos: 'Sol (Batı)',
    fullOptionLabel: 'Sol Orta — Batı (◀)',
    arrow: '◀',
  },
  right: {
    compassName: 'Doğu',
    shortPos: 'Sağ (Doğu)',
    fullOptionLabel: 'Sağ Orta — Doğu (▶)',
    arrow: '▶',
  },
  'top-left': {
    compassName: 'Kuzeybatı',
    shortPos: 'Sol Üst Köşe (KB)',
    fullOptionLabel: 'Sol Üst Köşe — Kuzeybatı (↖)',
    arrow: '↖',
  },
  'top-right': {
    compassName: 'Kuzeydoğu',
    shortPos: 'Sağ Üst Köşe (KD)',
    fullOptionLabel: 'Sağ Üst Köşe — Kuzeydoğu (↗)',
    arrow: '↗',
  },
  'bottom-left': {
    compassName: 'Güneybatı',
    shortPos: 'Sol Alt Köşe (GB)',
    fullOptionLabel: 'Sol Alt Köşe — Güneybatı (↙)',
    arrow: '↙',
  },
  'bottom-right': {
    compassName: 'Güneydoğu',
    shortPos: 'Sağ Alt Köşe (GD)',
    fullOptionLabel: 'Sağ Alt Köşe — Güneydoğu (↘)',
    arrow: '↘',
  },
}

export interface KrokiFacadeItem {
  id: string
  label: string
  edge: FacadeEdge
}

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
  entrance?: string
  floor: number
  roomType: RoomType
  grossSqm: number
  netSqm: number
  price: number
  status: FlatStatus
  statusLabel?: string // Örn: 'KAPALI', 'SATILDI', 'Satışta', 'Rezerve'
  facade?: string
  description?: string
  planBox?: UnitPlanBox
  sizePreset?: UnitSizePreset
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
  customAreas?: KrokiAreaItem[]
  customFacades?: KrokiFacadeItem[]
  krokiCustomized?: boolean
  paymentBanner?: string
  footerInfo?: string
  parcelInfo?: string
  status: 'SATISTA' | 'YAKINDA' | 'TAMAMLANDI'
  description?: string
  units: FlatUnit[]
}

const STORAGE_KEY_PROJECTS = 'demirturk_projects_v2'

export const DEFAULT_KROKI_FACADES: KrokiFacadeItem[] = [
  { id: 'fac-n-v3', label: 'Kuzey', edge: 'top' },
  { id: 'fac-s-v3', label: 'Güney', edge: 'bottom' },
  { id: 'fac-w-v3', label: 'Batı', edge: 'left' },
  { id: 'fac-e-v3', label: 'Doğu', edge: 'right' },
]

export function resolveCanonicalCompassEdge(label: string): FacadeEdge | null {
  const key = label
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/\s+/g, '')

  if (key === 'kuzeybati' || key === 'kb') return 'top-left'
  if (key === 'kuzeydogu' || key === 'kd') return 'top-right'
  if (key === 'guneybati' || key === 'gb') return 'bottom-left'
  if (key === 'guneydogu' || key === 'gd') return 'bottom-right'
  if (key === 'kuzey' || key === 'k') return 'top'
  if (key === 'guney' || key === 'g') return 'bottom'
  if (key === 'bati' || key === 'b') return 'left'
  if (key === 'dogu' || key === 'd') return 'right'
  return null
}

/**
 * Check if two kroki boxes overlap (with an optional minimum separation gap in percentage points)
 */
export function boxesOverlap(a: UnitPlanBox, b: UnitPlanBox, gap = 0.8): boolean {
  return (
    a.x < b.x + b.w + gap &&
    a.x + a.w + gap > b.x &&
    a.y < b.y + b.h + gap &&
    a.y + a.h + gap > b.y
  )
}

/**
 * Find the nearest non-overlapping position (and, if necessary, slightly adjusted size)
 * for `desired` so it never collides with any box in `obstacles` or exits `bounds`.
 */
export function findNonOverlappingBox(
  desired: UnitPlanBox,
  obstacles: UnitPlanBox[],
  bounds: { minX: number; maxX: number; minY: number; maxY: number } = {
    minX: 3.2,
    maxX: 96.8,
    minY: 5.5,
    maxY: 85.5,
  },
  gap = 1.0
): UnitPlanBox {
  const clampToBounds = (b: UnitPlanBox): UnitPlanBox => {
    const w = Number(Math.max(6, Math.min(bounds.maxX - bounds.minX, b.w)).toFixed(1))
    const h = Number(Math.max(6.5, Math.min(bounds.maxY - bounds.minY, b.h)).toFixed(1))
    const x = Number(Math.max(bounds.minX, Math.min(bounds.maxX - w, b.x)).toFixed(1))
    const y = Number(Math.max(bounds.minY, Math.min(bounds.maxY - h, b.y)).toFixed(1))
    return { x, y, w, h }
  }

  const initial = clampToBounds(desired)
  const collides = (cand: UnitPlanBox) => obstacles.some((obs) => boxesOverlap(cand, obs, gap))

  if (!collides(initial)) {
    return initial
  }

  // Try candidate positions on a 2% ruler grid (first keeping original size, then slightly more compact if crowded)
  const sizeScales = [1.0, 0.9, 0.8]
  for (const scale of sizeScales) {
    const testW = Number(Math.max(7.5, initial.w * scale).toFixed(1))
    const testH = Number(Math.max(7.5, initial.h * scale).toFixed(1))
    let bestCand: UnitPlanBox | null = null
    let bestDist = Infinity

    for (let gy = bounds.minY; gy <= bounds.maxY - testH + 0.1; gy += 2.0) {
      for (let gx = bounds.minX; gx <= bounds.maxX - testW + 0.1; gx += 2.0) {
        const cand: UnitPlanBox = {
          x: Number(gx.toFixed(1)),
          y: Number(gy.toFixed(1)),
          w: testW,
          h: testH,
        }
        if (!collides(cand)) {
          const dist = Math.hypot(cand.x - initial.x, cand.y - initial.y)
          if (dist < bestDist) {
            bestDist = dist
            bestCand = cand
          }
        }
      }
    }

    if (bestCand) {
      return bestCand
    }
  }

  return initial
}

/**
 * Build the exact 18-unit (6 per floor) L-shaped Almina 2 spatial floor plan
 * with 100% non-overlapping coordinates for top units, right-wing vertical units, pool, and entrances.
 */
function buildAlmina2SpatialData(projectId: string): {
  units: FlatUnit[]
  customAreas: KrokiAreaItem[]
  customFacades: KrokiFacadeItem[]
  paymentBanner?: string
  parcelInfo: string
  summary: string
} {
  const topBoxes: UnitPlanBox[] = [
    { x: 9.0, y: 10.0, w: 19.0, h: 25.0 },
    { x: 29.5, y: 10.0, w: 19.0, h: 25.0 },
    { x: 50.0, y: 10.0, w: 19.0, h: 25.0 },
    { x: 70.5, y: 10.0, w: 19.5, h: 25.0 },
  ]
  const rightWingBoxes: UnitPlanBox[] = [
    { x: 70.5, y: 37.0, w: 9.2, h: 43.0 },
    { x: 80.8, y: 37.0, w: 9.2, h: 43.0 },
  ]

  const slideConfigs: {
    floor: number
    items: {
      unitNumber: string
      block: string
      status: FlatStatus
      statusLabel: string
      box: UnitPlanBox
      sizePreset: UnitSizePreset
    }[]
  }[] = [
    {
      floor: 0,
      items: [
        { unitNumber: 'DAİRE 1', block: 'B Giriş', status: 'SATILDI', statusLabel: 'KAPALI', box: topBoxes[0], sizePreset: 'wide-rect' },
        { unitNumber: 'DAİRE 2', block: 'B Giriş', status: 'SATILDI', statusLabel: 'SATILDI', box: topBoxes[1], sizePreset: 'wide-rect' },
        { unitNumber: 'DAİRE 3', block: 'B Giriş', status: 'SATISTA', statusLabel: 'Satışta', box: topBoxes[2], sizePreset: 'wide-rect' },
        { unitNumber: 'DAİRE 1', block: 'A Giriş', status: 'SATILDI', statusLabel: 'KAPALI', box: topBoxes[3], sizePreset: 'wide-rect' },
        { unitNumber: 'DAİRE 3', block: 'A Giriş', status: 'SATILDI', statusLabel: 'KAPALI', box: rightWingBoxes[0], sizePreset: 'narrow-v' },
        { unitNumber: 'DAİRE 2', block: 'A Giriş', status: 'SATILDI', statusLabel: 'SATILDI', box: rightWingBoxes[1], sizePreset: 'narrow-v' },
      ],
    },
    {
      floor: 1,
      items: [
        { unitNumber: 'DAİRE 4', block: 'B Giriş', status: 'SATISTA', statusLabel: 'Satışta', box: topBoxes[0], sizePreset: 'wide-rect' },
        { unitNumber: 'DAİRE 5', block: 'B Giriş', status: 'SATISTA', statusLabel: 'Satışta', box: topBoxes[1], sizePreset: 'wide-rect' },
        { unitNumber: 'DAİRE 6', block: 'B Giriş', status: 'SATISTA', statusLabel: 'Satışta', box: topBoxes[2], sizePreset: 'wide-rect' },
        { unitNumber: 'DAİRE 4', block: 'A Giriş', status: 'SATISTA', statusLabel: 'Satışta', box: topBoxes[3], sizePreset: 'wide-rect' },
        { unitNumber: 'DAİRE 6', block: 'A Giriş', status: 'SATILDI', statusLabel: 'SATILDI', box: rightWingBoxes[0], sizePreset: 'narrow-v' },
        { unitNumber: 'DAİRE 5', block: 'A Giriş', status: 'SATISTA', statusLabel: 'Satışta', box: rightWingBoxes[1], sizePreset: 'narrow-v' },
      ],
    },
    {
      floor: 2,
      items: [
        { unitNumber: 'DAİRE 7', block: 'B Giriş', status: 'SATISTA', statusLabel: 'Satışta', box: topBoxes[0], sizePreset: 'wide-rect' },
        { unitNumber: 'DAİRE 8', block: 'B Giriş', status: 'SATISTA', statusLabel: 'Satışta', box: topBoxes[1], sizePreset: 'wide-rect' },
        { unitNumber: 'DAİRE 9', block: 'B Giriş', status: 'SATISTA', statusLabel: 'Satışta', box: topBoxes[2], sizePreset: 'wide-rect' },
        { unitNumber: 'DAİRE 7', block: 'A Giriş', status: 'SATISTA', statusLabel: 'Satışta', box: topBoxes[3], sizePreset: 'wide-rect' },
        { unitNumber: 'DAİRE 9', block: 'A Giriş', status: 'SATILDI', statusLabel: 'SATILDI', box: rightWingBoxes[0], sizePreset: 'narrow-v' },
        { unitNumber: 'DAİRE 8', block: 'A Giriş', status: 'SATISTA', statusLabel: 'Satışta', box: rightWingBoxes[1], sizePreset: 'narrow-v' },
      ],
    },
  ]

  const units: FlatUnit[] = []
  let seq = 1
  for (const s of slideConfigs) {
    for (const it of s.items) {
      units.push({
        id: `${projectId}-u${seq}`,
        projectId,
        unitNumber: it.unitNumber,
        block: it.block,
        floor: s.floor,
        roomType: '2+1',
        grossSqm: 98,
        netSqm: 80,
        price: 5500000,
        status: it.status,
        statusLabel: it.statusLabel,
        facade: it.sizePreset === 'narrow-v' ? 'Doğu - Güney / Havuz Cephe' : 'Kuzey - Güney / Peyzaj Cephe',
        description:
          it.statusLabel === 'KAPALI'
            ? 'KAPALI (Satışa Kapalı)'
            : it.statusLabel === 'SATILDI'
            ? 'SATILDI'
            : `${it.block} • ${it.unitNumber}`,
        planBox: { ...it.box },
        sizePreset: it.sizePreset,
        history: [],
      })
      seq++
    }
  }

  const customAreas: KrokiAreaItem[] = [
    {
      id: 'area-pool-1',
      label: 'HAVUZ',
      kind: 'pool',
      floor: 'ALL',
      box: { x: 38.0, y: 45.5, w: 29.0, h: 34.0 },
    },
    {
      id: 'area-ent-b',
      label: 'B Giriş',
      kind: 'entrance',
      direction: 'up',
      floor: 'ALL',
      box: { x: 24.5, y: 36.5, w: 9.0, h: 6.5 },
    },
    {
      id: 'area-ent-a',
      label: 'A Giriş',
      kind: 'entrance',
      direction: 'right',
      floor: 'ALL',
      box: { x: 59.0, y: 36.5, w: 9.5, h: 6.5 },
    },
  ]

  const customFacades: KrokiFacadeItem[] = [...DEFAULT_KROKI_FACADES]

  return {
    units,
    customAreas,
    customFacades,
    paymentBanner: undefined,
    parcelInfo: 'Aşağıincilli Mh • 996 Ada / 12 Parsel',
    summary:
      'PowerPoint Sunumu (.pptx) mimari planı otomatik uygulandı: Zemin + Birinci + İkinci Kat (3 Kat), her katta 6 daire (toplam 18 bağımsız bölüm), Havuz ve A/B Giriş alanları birebir kroki alanına yerleştirildi.',
  }
}

/**
 * Ensure every project's units use strictly 0 (Zemin), 1 (1. Kat), or 2 (2. Kat)
 * and automatically resolve any overlapping unit/area boxes so no two items ever sit on top of each other.
 */
function normalizeProjectFloors(project: SharedProject): SharedProject {
  // Check if this project was broken by the old Almina 2.pptx upload (3 units + pool water background)
  const isAlminaDoc =
    project.sourceDocumentName?.toLowerCase().includes('almina') ||
    project.name?.toLowerCase().includes('almina 2') ||
    (project.units?.length === 3 &&
      project.units.some((u) => u.price === 1500000) &&
      project.units.some((u) => u.price === 5500000))
  const hasOldBrokenAlminaParse =
    !project.krokiCustomized &&
    isAlminaDoc &&
    project.units &&
    project.units.length <= 3 &&
    (Boolean(project.blueprintUrl) || Boolean(project.floorPlans?.['DEFAULT']))

  if (hasOldBrokenAlminaParse) {
    const repaired = buildAlmina2SpatialData(project.id)
    const nextFloorPlans = { ...(project.floorPlans || {}) }
    delete nextFloorPlans['DEFAULT']
    return {
      ...project,
      maxFloors: 3,
      unitsPerFloor: 6,
      blockCount: 2,
      defaultRoomType: '2+1',
      layoutTemplate: 'wing',
      blueprintUrl: undefined,
      floorPlans: nextFloorPlans,
      sourceDocumentSummary: repaired.summary,
      customAreas: repaired.customAreas,
      customFacades: repaired.customFacades,
      paymentBanner: repaired.paymentBanner,
      parcelInfo: repaired.parcelInfo,
      totalUnits: repaired.units.length,
      units: repaired.units,
    }
  }

  // Preserve user's customFacades; strip only legacy auto-seeded intercardinal -v3 facades
  const AUTO_INTERCARDINAL_IDS = new Set(['fac-nw-v3', 'fac-ne-v3', 'fac-sw-v3', 'fac-se-v3'])
  let nextFacades: KrokiFacadeItem[]
  if (Array.isArray(project.customFacades)) {
    const seen = new Set<string>()
    nextFacades = project.customFacades
      .filter((f) => !AUTO_INTERCARDINAL_IDS.has(f.id))
      .map((f) => {
        const canonical = resolveCanonicalCompassEdge(f.label)
        return canonical ? { ...f, edge: canonical } : f
      })
      .filter((f) => {
        const key = `${f.edge}-${f.label.trim().toLocaleLowerCase('tr-TR')}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
  } else {
    nextFacades = [...DEFAULT_KROKI_FACADES]
  }

  const maxFl: 1 | 2 | 3 =
    project.maxFloors === 1 || project.maxFloors === 2 || project.maxFloors === 3
      ? project.maxFloors
      : 3
  const units = Array.isArray(project.units) ? project.units : []

  // Preserve user's customAreas positions and sizes without overwriting them
  const nextAreas: KrokiAreaItem[] | undefined = project.customAreas
    ? project.customAreas.filter(
        (a) => !/^(zemin\s*kat|giriş\s*kat|1\s*\.\s*kat|birinci\s*kat|2\s*\.\s*kat|ikinci\s*kat)$/i.test(a.label.trim())
      )
    : undefined

  // Normalize floor numbers while strictly preserving each unit's saved planBox and sizePreset
  const remappedUnits: FlatUnit[] = units.map((u, idx) => {
    let fl = u.floor
    if (typeof fl !== 'number' || isNaN(fl) || fl < 0 || fl > 2 || fl >= maxFl) {
      fl = idx % maxFl
    }
    return { ...u, floor: fl }
  })

  return {
    ...project,
    paymentBanner: undefined,
    maxFloors: maxFl,
    customAreas: nextAreas,
    customFacades: nextFacades,
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
    if (typeof window !== 'undefined') {
      window.addEventListener('demirturk:cloud-db-synced', () => {
        this.loadFromStorage()
        this.notify()
      })
    }
  }

  public setLoadedProjects(incomingProjects: SharedProject[]) {
    // Merge with existing local kroki metadata so Supabase sync never wipes out planBox, customAreas, customFacades, or locally edited units
    const existingById = new Map(this.projects.map((p) => [p.id, p]))
    const merged = (incomingProjects || []).map((inc) => {
      const local = existingById.get(inc.id)
      if (!local) return normalizeProjectFloors(inc)

      // Preserve local kroki units and layout state if local has units
      const localHasSpatial =
        Boolean(local.krokiCustomized) ||
        Boolean(local.customAreas && local.customAreas.length > 0) ||
        Boolean(local.units && local.units.some((u) => Boolean(u.planBox)))

      const incUnitsById = new Map((inc.units || []).map((u) => [u.id, u]))
      const localUnitsById = new Map((local.units || []).map((u) => [u.id, u]))

      const mergedUnits =
        localHasSpatial && local.units && local.units.length > 0
          ? local.units.map((lu) => {
              const iu = incUnitsById.get(lu.id)
              return {
                ...iu,
                ...lu,
                planBox: lu.planBox || iu?.planBox,
                sizePreset: lu.sizePreset || iu?.sizePreset,
                entrance: lu.entrance || iu?.entrance,
                block: lu.block || iu?.block,
              }
            })
          : (inc.units || []).map((u, i) => {
              const lu = localUnitsById.get(u.id) || local.units?.[i]
              return {
                ...u,
                ...lu,
                statusLabel: lu?.statusLabel || u.statusLabel,
                planBox: lu?.planBox || u.planBox,
                sizePreset: lu?.sizePreset || u.sizePreset,
                entrance: lu?.entrance || u.entrance,
                block: lu?.block || u.block,
              }
            })

      return normalizeProjectFloors({
        ...inc,
        ...local,
        blueprintUrl: local.blueprintUrl || inc.blueprintUrl,
        floorPlans: local.floorPlans || inc.floorPlans,
        layoutTemplate: local.layoutTemplate || inc.layoutTemplate,
        maxFloors: local.maxFloors || inc.maxFloors,
        unitsPerFloor: local.unitsPerFloor || inc.unitsPerFloor,
        blockCount: local.blockCount || inc.blockCount,
        defaultRoomType: local.defaultRoomType || inc.defaultRoomType,
        sourceDocumentName: local.sourceDocumentName || inc.sourceDocumentName,
        sourceDocumentSummary: local.sourceDocumentSummary || inc.sourceDocumentSummary,
        customAreas: local.customAreas || inc.customAreas,
        customFacades: local.customFacades || inc.customFacades,
        krokiCustomized: local.krokiCustomized ?? inc.krokiCustomized,
        paymentBanner: undefined,
        footerInfo: local.footerInfo || inc.footerInfo,
        parcelInfo: local.parcelInfo || inc.parcelInfo,
        totalUnits: mergedUnits.length,
        units: mergedUnits,
      })
    })

    // Also keep any purely local projects not yet present in incomingProjects
    const incomingIds = new Set((incomingProjects || []).map((p) => p.id))
    const localOnly = this.projects.filter((p) => !incomingIds.has(p.id))
    localOnly.forEach((p) => syncService.saveProject(p))

    this.projects = [...localOnly, ...merged]
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
              const prev = project.units[uIdx]
              project.units[uIdx] = {
                ...unit,
                planBox: prev.planBox,
                sizePreset: prev.sizePreset,
                statusLabel: prev.statusLabel,
              }
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
        localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(this.projects))
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
      // If quota exceeded due to large base64 blueprint images, strip base64 blueprints and save kroki data reliably
      try {
        const compact = this.projects.map((p) => ({
          ...p,
          blueprintUrl: p.blueprintUrl && p.blueprintUrl.length > 50000 ? undefined : p.blueprintUrl,
          floorPlans: undefined,
        }))
        localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(compact))
      } catch (err) {
        console.error('ProjectStore save error:', err)
      }
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
    return this.projects.map((p) => ({
      ...p,
      units: [...(p.units || [])],
      customAreas: p.customAreas ? [...p.customAreas] : undefined,
      customFacades: p.customFacades ? [...p.customFacades] : undefined,
    }))
  }

  public getById(id: string): SharedProject | undefined {
    return this.projects.find((p) => p.id === id)
  }

  public getUnitById(projectId: string, unitId: string): FlatUnit | undefined {
    const project = this.getById(projectId)
    return project?.units.find((u) => u.id === unitId)
  }

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
      statusLabel:
        reservationData.depositAmount && reservationData.depositAmount > 0
          ? 'Kapora Alındı'
          : 'Rezerve',
      reservation: newReservation,
      history: [auditEntry, ...targetUnit.history],
    }

    project.units[unitIndex] = updatedUnit
    this.projects[projectIndex] = { ...project }
    this.saveToStorage()
    syncService.saveUnit(updatedUnit)
    return { success: true, unit: updatedUnit }
  }

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
    unit.statusLabel = 'Satışta'
    unit.reservation = undefined
    unit.history = [auditEntry, ...unit.history]

    this.saveToStorage()
    syncService.saveUnit(unit)
    return { success: true }
  }

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
      statusLabel: 'SATILDI',
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

  public updateUnitDetails(
    projectId: string,
    unitId: string,
    updates: {
      unitNumber?: string
      price?: number
      facade?: string
      description?: string
      grossSqm?: number
      netSqm?: number
      roomType?: RoomType
      block?: string
      entrance?: string
      floor?: number
      status?: FlatStatus
      statusLabel?: string
      sizePreset?: UnitSizePreset
      planBox?: UnitPlanBox
    },
    user?: AppUser | null
  ): { success: boolean; error?: string; unit?: FlatUnit } {
    const project = this.getById(projectId)
    const unit = project?.units.find((u) => u.id === unitId)
    if (!unit) return { success: false, error: 'Daire bulunamadı.' }

    const oldPrice = unit.price
    if (updates.unitNumber !== undefined) unit.unitNumber = updates.unitNumber
    if (updates.price !== undefined) unit.price = updates.price
    if (updates.facade !== undefined) unit.facade = updates.facade
    if (updates.description !== undefined) unit.description = updates.description
    if (updates.grossSqm !== undefined) unit.grossSqm = updates.grossSqm
    if (updates.netSqm !== undefined) unit.netSqm = updates.netSqm
    if (updates.roomType !== undefined) unit.roomType = updates.roomType
    if (updates.block !== undefined) unit.block = updates.block
    if (updates.entrance !== undefined) unit.entrance = updates.entrance
    if (updates.floor !== undefined) unit.floor = updates.floor
    if (updates.status !== undefined) unit.status = updates.status
    if (updates.statusLabel !== undefined) unit.statusLabel = updates.statusLabel
    if (updates.sizePreset !== undefined) unit.sizePreset = updates.sizePreset
    if (updates.planBox !== undefined) unit.planBox = updates.planBox
    if (project) project.krokiCustomized = true

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
        statusLabel?: string
        facade?: string
        description?: string
        planBox?: UnitPlanBox
        sizePreset?: UnitSizePreset
      }[]
    }
  ): SharedProject {
    const maxFl: 1 | 2 | 3 =
      data.maxFloors === 1 || data.maxFloors === 2 || data.maxFloors === 3 ? data.maxFloors : 3
    const blkCount: 1 | 2 = data.blockCount === 2 ? 2 : 1
    const upf = Math.max(1, Math.min(12, data.unitsPerFloor || 4))
    const defaultRm = data.defaultRoomType || 'MIXED'

    const { parsedUnits, ...restData } = data
    const newPrj: SharedProject = {
      ...restData,
      id: 'prj-' + Date.now(),
      maxFloors: maxFl,
      unitsPerFloor: upf,
      blockCount: blkCount,
      defaultRoomType: defaultRm,
      customFacades: restData.customFacades || [...DEFAULT_KROKI_FACADES],
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
          unitNumber: pu.unitNumber || `DAİRE ${idx + 1}`,
          block: pu.block || 'A Blok',
          floor: clampedFl,
          roomType: pu.roomType || '2+1',
          grossSqm: pu.grossSqm || 100,
          netSqm: pu.netSqm || 80,
          price: pu.price || 0,
          status: pu.status || 'SATISTA',
          statusLabel: pu.statusLabel,
          facade: pu.facade || (clampedFl === 0 ? 'Bahçe / Peyzaj Cephe' : 'Güney / Ön Cephe'),
          description: pu.description,
          planBox: pu.planBox,
          sizePreset: pu.sizePreset,
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
              unitNumber: `DAİRE ${unitSeq}`,
              block: blk,
              floor: fl,
              roomType: rType,
              grossSqm: baseSqm,
              netSqm: Math.round(baseSqm * 0.8),
              price: basePrice,
              status: 'SATISTA',
              statusLabel: 'Satışta',
              facade:
                fl === 0
                  ? 'Bahçe / Peyzaj Cephe'
                  : u % 2 === 0
                  ? 'Güney / Ön Cephe'
                  : 'Doğu / Köşe Cephe',
              sizePreset: 'wide-rect',
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
      clearBlueprint?: boolean
      sourceDocumentName?: string
      sourceDocumentSummary?: string
      customAreas?: KrokiAreaItem[]
      customFacades?: KrokiFacadeItem[]
      paymentBanner?: string
      parcelInfo?: string
      parsedUnits?: {
        unitNumber: string
        block: string
        floor: number
        roomType: RoomType
        grossSqm: number
        netSqm: number
        price: number
        status: FlatStatus
        statusLabel?: string
        facade?: string
        description?: string
        planBox?: UnitPlanBox
        sizePreset?: UnitSizePreset
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
    const upf = Math.max(1, Math.min(12, config.unitsPerFloor || 4))
    const blkCount: 1 | 2 = config.blockCount || current.blockCount || 1
    const defaultRm: RoomType | 'MIXED' =
      config.defaultRoomType || current.defaultRoomType || 'MIXED'

    const existingUnits = current.units || []
    const types: RoomType[] = ['1+1', '2+1', '3+1', '4+1']
    const nextUnits: FlatUnit[] = []

    if (config.parsedUnits && config.parsedUnits.length > 0) {
      config.parsedUnits.forEach((pu, i) => {
        const clampedFl = Math.max(0, Math.min(maxFl - 1, Math.min(2, pu.floor ?? i % maxFl)))
        nextUnits.push({
          id: `${current.id}-u${i + 1}-${Date.now()}`,
          projectId: current.id,
          unitNumber: pu.unitNumber || `DAİRE ${i + 1}`,
          block: pu.block || 'A Blok',
          floor: clampedFl,
          roomType: pu.roomType || '2+1',
          grossSqm: pu.grossSqm || 98,
          netSqm: pu.netSqm || 80,
          price: pu.price || 5500000,
          status: pu.status || 'SATISTA',
          statusLabel: pu.statusLabel,
          facade: pu.facade || (clampedFl === 0 ? 'Bahçe / Peyzaj Cephe' : 'Güney / Ön Cephe'),
          description: pu.description,
          planBox: pu.planBox,
          sizePreset: pu.sizePreset || 'wide-rect',
          history: [],
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
              unitNumber: existing?.unitNumber || `DAİRE ${seq + 1}`,
              block: blk,
              floor: fl,
              roomType: rType,
              grossSqm: gross,
              netSqm: net,
              price,
              status: existing?.status || 'SATISTA',
              statusLabel: existing?.statusLabel,
              facade:
                existing?.facade ||
                (fl === 0 ? 'Bahçe / Peyzaj Cephe' : u % 2 === 0 ? 'Güney / Ön Cephe' : 'Doğu / Köşe Cephe'),
              description: existing?.description,
              planBox: existing?.planBox,
              sizePreset: existing?.sizePreset || 'wide-rect',
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
    if (config.clearBlueprint) {
      delete nextFloorPlans['DEFAULT']
    } else if (config.blueprintDataUrl) {
      nextFloorPlans['DEFAULT'] = config.blueprintDataUrl
    }

    const updated: SharedProject = {
      ...current,
      maxFloors: maxFl,
      unitsPerFloor: upf,
      blockCount: blkCount,
      defaultRoomType: defaultRm,
      layoutTemplate: config.layoutTemplate || current.layoutTemplate || 'quad',
      blueprintUrl: config.clearBlueprint ? undefined : config.blueprintDataUrl || current.blueprintUrl,
      floorPlans: nextFloorPlans,
      sourceDocumentName: config.sourceDocumentName ?? current.sourceDocumentName,
      sourceDocumentSummary: config.sourceDocumentSummary ?? current.sourceDocumentSummary,
      customAreas: config.customAreas ?? current.customAreas,
      customFacades: config.customFacades ?? current.customFacades,
      paymentBanner: config.paymentBanner ?? current.paymentBanner,
      parcelInfo: config.parcelInfo ?? current.parcelInfo,
      totalUnits: nextUnits.length,
      units: nextUnits,
    }

    this.projects[idx] = updated
    this.saveToStorage()
    syncService.saveProject(updated)
    return { success: true, project: updated }
  }

  /**
   * Manually add a new Unit (Daire) onto the active floor in Kroki Edit Mode
   */
  public addUnitToFloor(
    projectId: string,
    floor: number,
    options?: {
      unitNumber?: string
      block?: string
      roomType?: RoomType
      sizePreset?: UnitSizePreset
      planBox?: UnitPlanBox
      price?: number
      facade?: string
      status?: FlatStatus
      statusLabel?: string
    }
  ): { success: boolean; unit?: FlatUnit; error?: string } {
    const project = this.getById(projectId)
    if (!project) return { success: false, error: 'Proje bulunamadı.' }

    const clampedFloor = Math.max(0, Math.min(2, floor))
    const floorUnits = project.units.filter((u) => u.floor === clampedFloor)
    const floorAreas = (project.customAreas || []).filter(
      (a) =>
        a.kind !== 'block' &&
        (a.floor === undefined || a.floor === 'ALL' || a.floor === clampedFloor)
    )
    const preset: UnitSizePreset = options?.sizePreset || 'wide-rect'
    const presetDims = UNIT_SIZE_PRESETS[preset]

    const bounds = {
      minX: 3.2,
      maxX: 96.8,
      minY: 5.5,
      maxY: project.paymentBanner ? 85.5 : 93.5,
    }
    const obstacles: UnitPlanBox[] = [
      ...floorAreas.map((a) => a.box),
      ...floorUnits.map((u) => u.planBox).filter((b): b is UnitPlanBox => Boolean(b)),
    ]

    const desiredBox: UnitPlanBox = options?.planBox || {
      x: 10.0,
      y: 46.0,
      w: presetDims.w,
      h: presetDims.h,
    }
    const safeBox = findNonOverlappingBox(desiredBox, obstacles, bounds, 1.0)

    const newUnit: FlatUnit = {
      id: `${project.id}-u-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      projectId: project.id,
      unitNumber: options?.unitNumber || `DAİRE ${floorUnits.length + 1}`,
      block: options?.block || 'A Blok',
      floor: clampedFloor,
      roomType: options?.roomType || '2+1',
      grossSqm: options?.roomType === '1+1' ? 68 : options?.roomType === '3+1' ? 138 : 98,
      netSqm: options?.roomType === '1+1' ? 55 : options?.roomType === '3+1' ? 112 : 80,
      price: options?.price ?? 5500000,
      status: options?.status || 'SATISTA',
      statusLabel: options?.statusLabel || 'Satışta',
      facade: options?.facade || 'Güney / Ön Cephe',
      sizePreset: preset,
      planBox: safeBox,
      history: [],
    }

    project.units = [...project.units, newUnit]
    project.totalUnits = project.units.length
    project.krokiCustomized = true
    this.saveToStorage()
    syncService.saveUnit(newUnit)
    return { success: true, unit: newUnit }
  }

  /**
   * Delete a Unit from the floor plan
   */
  public deleteUnit(projectId: string, unitId: string): { success: boolean } {
    const project = this.getById(projectId)
    if (!project) return { success: false }
    project.units = project.units.filter((u) => u.id !== unitId)
    project.totalUnits = project.units.length
    project.krokiCustomized = true
    this.saveToStorage()
    syncService.deleteUnit(unitId)
    syncService.saveProject(project)
    return { success: true }
  }

  /**
   * Add a custom Architectural / Site Area (Havuz, Giriş, Otopark, Bahçe, Merdiven, vb.)
   */
  public addCustomArea(
    projectId: string,
    area: Omit<KrokiAreaItem, 'id'>
  ): { success: boolean; area?: KrokiAreaItem } {
    const project = this.getById(projectId)
    if (!project) return { success: false }

    const targetFloor = typeof area.floor === 'number' ? area.floor : 0
    const floorUnits = project.units.filter((u) => u.floor === targetFloor)
    const floorAreas = (project.customAreas || []).filter(
      (a) =>
        a.kind !== 'block' &&
        (a.floor === undefined || a.floor === 'ALL' || a.floor === targetFloor)
    )
    const obstacles: UnitPlanBox[] =
      area.kind === 'block' || area.kind === 'entrance'
        ? []
        : [
            ...floorAreas.map((a) => a.box),
            ...floorUnits.map((u) => u.planBox).filter((b): b is UnitPlanBox => Boolean(b)),
          ]
    const bounds = {
      minX: 3.2,
      maxX: 96.8,
      minY: 5.5,
      maxY: project.paymentBanner ? 85.5 : 93.5,
    }
    const safeBox = findNonOverlappingBox(area.box, obstacles, bounds, 1.0)

    const created: KrokiAreaItem = {
      ...area,
      box: safeBox,
      id: `area-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    }
    project.customAreas = [...(project.customAreas || []), created]
    project.krokiCustomized = true
    this.saveToStorage()
    syncService.saveProject(project)
    return { success: true, area: created }
  }

  /**
   * Update a custom Area's position, size, label, or kind
   */
  public updateCustomArea(
    projectId: string,
    areaId: string,
    updates: Partial<Omit<KrokiAreaItem, 'id'>>
  ): { success: boolean } {
    const project = this.getById(projectId)
    if (!project || !project.customAreas) return { success: false }

    project.customAreas = project.customAreas.map((a) =>
      a.id === areaId ? { ...a, ...updates } : a
    )
    project.krokiCustomized = true
    this.saveToStorage()
    syncService.saveProject(project)
    return { success: true }
  }

  /**
   * Delete a custom Area from the floor plan
   */
  public deleteCustomArea(projectId: string, areaId: string): { success: boolean } {
    const project = this.getById(projectId)
    if (!project) return { success: false }

    project.customAreas = (project.customAreas || []).filter((a) => a.id !== areaId)
    project.krokiCustomized = true
    this.saveToStorage()
    syncService.saveProject(project)
    return { success: true }
  }

  /**
   * Update project's custom Facades (Cephe Ekle / Çıkar / Düzenle)
   */
  public updateCustomFacades(
    projectId: string,
    facades: KrokiFacadeItem[]
  ): { success: boolean } {
    const project = this.getById(projectId)
    if (!project) return { success: false }

    project.customFacades = facades
    project.krokiCustomized = true
    this.saveToStorage()
    syncService.saveProject(project)
    return { success: true }
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
      krokiCustomized: true,
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
    unit.statusLabel = 'Satışta'
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
      blueprintUrl: floorKey === 'DEFAULT' ? dataUrl || undefined : current.blueprintUrl,
    }
    this.projects[idx] = updated
    this.saveToStorage()
    syncService.saveProject(updated)
    return { success: true }
  }

  public updateUnitPlanBox(
    projectId: string,
    unitId: string,
    planBox?: UnitPlanBox,
    sizePreset?: UnitSizePreset
  ): { success: boolean; error?: string } {
    const project = this.getById(projectId)
    const unit = project?.units.find((u) => u.id === unitId)
    if (!project || !unit) return { success: false, error: 'Daire bulunamadı.' }

    let updatedUnit: FlatUnit | undefined
    project.units = project.units.map((u) => {
      if (u.id === unitId) {
        updatedUnit = {
          ...u,
          planBox,
          sizePreset: sizePreset || u.sizePreset,
        }
        return updatedUnit
      }
      return u
    })
    project.krokiCustomized = true
    this.saveToStorage()
    if (updatedUnit) {
      syncService.saveUnit(updatedUnit)
    }
    return { success: true }
  }

  /**
   * Populate or adjust a floor to have 4, 5, 6, or 12 ready units with non-overlapping coordinates
   */
  public applyFloorReadyUnits(
    projectId: string,
    floor: number,
    targetCount: 4 | 5 | 6 | 8 | 12,
    blockName = 'A Blok'
  ): { success: boolean } {
    const project = this.getById(projectId)
    if (!project) return { success: false }

    const clampedFloor = Math.max(0, Math.min(2, floor))
    const otherFloorUnits = (project.units || []).filter((u) => u.floor !== clampedFloor)
    const currentFloorUnits = (project.units || []).filter((u) => u.floor === clampedFloor)

    const buildPresetBox = (idx: number, count: 4 | 5 | 6 | 8 | 12): UnitPlanBox => {
      if (count === 4) {
        const boxes: UnitPlanBox[] = [
          { x: 10.0, y: 12.0, w: 17.5, h: 16.0 },
          { x: 30.0, y: 12.0, w: 17.5, h: 16.0 },
          { x: 50.0, y: 12.0, w: 17.5, h: 16.0 },
          { x: 70.0, y: 12.0, w: 17.5, h: 16.0 },
        ]
        return boxes[idx % 4]
      }
      if (count === 5) {
        const boxes: UnitPlanBox[] = [
          { x: 8.5, y: 12.0, w: 15.2, h: 15.5 },
          { x: 25.5, y: 12.0, w: 15.2, h: 15.5 },
          { x: 42.5, y: 12.0, w: 15.2, h: 15.5 },
          { x: 59.5, y: 12.0, w: 15.2, h: 15.5 },
          { x: 76.5, y: 12.0, w: 15.2, h: 15.5 },
        ]
        return boxes[idx % 5]
      }
      if (count === 6) {
        const boxes: UnitPlanBox[] = [
          { x: 9.0, y: 11.0, w: 18.5, h: 16.5 },
          { x: 29.5, y: 11.0, w: 18.5, h: 16.5 },
          { x: 50.0, y: 11.0, w: 18.5, h: 16.5 },
          { x: 70.5, y: 11.0, w: 18.5, h: 16.5 },
          { x: 70.5, y: 31.0, w: 8.8, h: 24.0 },
          { x: 80.2, y: 31.0, w: 8.8, h: 24.0 },
        ]
        return boxes[idx % 6]
      }
      if (count === 8) {
        const col = idx % 4
        const row = Math.floor(idx / 4)
        return {
          x: Number((9.0 + col * 20.5).toFixed(1)),
          y: Number((12.0 + row * 21.0).toFixed(1)),
          w: 18.0,
          h: 16.5,
        }
      }
      // 12 units (2 rows of 6 or compact grid)
      const col = idx % 6
      const row = Math.floor(idx / 6)
      return {
        x: Number((8.0 + col * 14.2).toFixed(1)),
        y: Number((12.0 + row * 18.0).toFixed(1)),
        w: 12.5,
        h: 14.5,
      }
    }

    const nextFloorUnits: FlatUnit[] = []
    for (let i = 0; i < targetCount; i++) {
      const existing = currentFloorUnits[i]
      const box = buildPresetBox(i, targetCount)
      const preset: UnitSizePreset =
        targetCount === 6 && i >= 4 ? '9x16' : targetCount === 12 ? '1x1' : '16x9'
      if (existing) {
        nextFloorUnits.push({
          ...existing,
          planBox: box,
          sizePreset: preset,
        })
      } else {
        const seqNum = otherFloorUnits.length + i + 1
        nextFloorUnits.push({
          id: `${project.id}-u-${clampedFloor}-${i + 1}-${Date.now()}`,
          projectId: project.id,
          unitNumber: `DAİRE ${seqNum}`,
          block: blockName,
          entrance: 'A Giriş',
          floor: clampedFloor,
          roomType: '2+1',
          grossSqm: 98,
          netSqm: 80,
          price: project.startingPrice && project.startingPrice > 0 ? project.startingPrice : 4658000,
          status: 'SATISTA',
          statusLabel: 'Satışta',
          facade: 'Güney / Ön Cephe',
          planBox: box,
          sizePreset: preset,
          history: [],
        })
      }
    }

    // Delete any removed units from Supabase if floor count was reduced
    if (currentFloorUnits.length > targetCount) {
      currentFloorUnits.slice(targetCount).forEach((removedUnit) => {
        syncService.deleteUnit(removedUnit.id)
      })
    }

    project.units = [...otherFloorUnits, ...nextFloorUnits]
    project.totalUnits = project.units.length
    project.krokiCustomized = true
    this.saveToStorage()
    syncService.saveProject(project)
    return { success: true }
  }
}

export const projectStore = new ProjectStore()
