import React, { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Layers,
  Upload,
  Compass,
  Check,
  RotateCcw,
  Edit2,
  History,
  User,
  Clock,
  CheckCircle2,
  TurkishLira,
  Trash2,
  Sparkles,
  FileSpreadsheet,
  Eye,
  Plus,
  X,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Waves,
  Maximize2,
  Copy,
  Building2,
  DoorOpen,
  MapPin,
  Calendar,
} from 'lucide-react'
import {
  SharedProject,
  FlatUnit,
  BlueprintLayoutTemplate,
  UnitPlanBox,
  UnitSizePreset,
  UNIT_SIZE_PRESETS,
  KrokiAreaItem,
  KrokiAreaKind,
  KrokiFacadeItem,
  FacadeEdge,
  FACADE_EDGE_CONFIG,
  DEFAULT_KROKI_FACADES,
  resolveCanonicalCompassEdge,
  RoomType,
  FlatStatus,
  projectStore,
  boxesOverlap,
  findNonOverlappingBox,
} from '@/services/projectStore'
import { formatCurrency } from '@/utils/formatters'
import {
  parseProjectDocumentFile,
  compressImageToDataUrl,
  inferSizePresetFromBox,
} from '@/utils/projectDocumentParser'

const ALL_FACADE_EDGES: FacadeEdge[] = [
  'top-left',
  'top',
  'top-right',
  'left',
  'right',
  'bottom-left',
  'bottom',
  'bottom-right',
]

const SELECTABLE_SIZE_PRESETS: UnitSizePreset[] = ['1x1', '16x9', '9x16']

interface ProjectFloorPlanViewProps {
  project: SharedProject
  canEditPrice: boolean
  isManagerOrAdmin: boolean
  onReserveUnit: (unit: FlatUnit) => void
  onSellUnit: (unit: FlatUnit) => void
  onCancelReserve: (unit: FlatUnit) => void
  onEditPrice: (unit: FlatUnit) => void
  onEditUnit: (unit: FlatUnit) => void
  onOpenHistory: (unit: FlatUnit) => void
  onProjectUpdated: () => void
}

export const FLOOR_LABELS: Record<number, { short: string; full: string; sub: string }> = {
  0: { short: 'Zemin Kat', full: 'Zemin Kat (Giriş / Bahçe)', sub: '0. Kat • Zemin Seviyesi' },
  1: { short: 'Birinci Kat', full: 'Birinci Kat (1. Kat)', sub: '1. Kat • Orta Katman' },
  2: { short: 'İkinci Kat', full: 'İkinci Kat (2. Kat)', sub: '2. Kat • Üst Katman' },
}

// Compute default percentage coordinates for units on a floor when no custom planBox exists
function getDefaultUnitPlanBox(
  indexOnFloor: number,
  totalOnFloor: number,
  template: BlueprintLayoutTemplate,
  sizePreset?: UnitSizePreset
): UnitPlanBox {
  const presetDims = sizePreset ? UNIT_SIZE_PRESETS[sizePreset] : undefined

  if (template === 'quad' && totalOnFloor <= 4) {
    const quadPositions: UnitPlanBox[] = [
      { x: 9.0, y: 11.0, w: 38, h: 32 },
      { x: 53.0, y: 11.0, w: 37, h: 32 },
      { x: 9.0, y: 49.0, w: 38, h: 31 },
      { x: 53.0, y: 49.0, w: 37, h: 31 },
    ]
    const base = quadPositions[indexOnFloor % 4]
    return presetDims ? { ...base, w: presetDims.w, h: presetDims.h } : base
  }

  if (template === 'corridor') {
    const topCount = Math.ceil(totalOnFloor / 2)
    const isTop = indexOnFloor < topCount
    const colIndex = isTop ? indexOnFloor : indexOnFloor - topCount
    const colsInRow = isTop ? topCount : Math.max(1, totalOnFloor - topCount)
    const gap = 2.0
    const w = Math.floor((81 - (colsInRow - 1) * gap) / colsInRow)
    const x = 9.0 + colIndex * (w + gap)
    const y = isTop ? 11.0 : 50.0
    return {
      x,
      y,
      w: presetDims ? presetDims.w : w,
      h: presetDims ? presetDims.h : 30,
    }
  }

  if (template === 'wing') {
    // L-Shaped 6-unit wing layout inside facade safe-zone (4 horizontal on top, 2 narrow vertical on bottom-right)
    const wingPositions: UnitPlanBox[] = [
      { x: 9.0, y: 10.0, w: 19.0, h: 25.0 },
      { x: 29.5, y: 10.0, w: 19.0, h: 25.0 },
      { x: 50.0, y: 10.0, w: 19.0, h: 25.0 },
      { x: 70.5, y: 10.0, w: 19.5, h: 25.0 },
      { x: 70.5, y: 37.0, w: 9.2, h: 43.0 },
      { x: 80.8, y: 37.0, w: 9.2, h: 43.0 },
    ]
    if (indexOnFloor < wingPositions.length) {
      const base = wingPositions[indexOnFloor]
      return presetDims ? { ...base, w: presetDims.w, h: presetDims.h } : base
    }
  }

  const cols = totalOnFloor <= 2 ? Math.max(1, totalOnFloor) : totalOnFloor <= 4 ? 2 : totalOnFloor === 8 ? 4 : 3
  const rows = Math.ceil(totalOnFloor / cols)
  const col = indexOnFloor % cols
  const row = Math.floor(indexOnFloor / cols)
  const w = Math.floor((81 - (cols - 1) * 2.5) / cols)
  const h = Math.floor((69 - (rows - 1) * 3.0) / rows)
  return {
    x: 9.0 + col * (w + 2.5),
    y: 11.0 + row * (h + 3.0),
    w: presetDims ? presetDims.w : w,
    h: presetDims ? presetDims.h : h,
  }
}

export const ProjectFloorPlanView: React.FC<ProjectFloorPlanViewProps> = ({
  project,
  canEditPrice,
  onReserveUnit,
  onSellUnit,
  onCancelReserve,
  onEditPrice,
  onEditUnit,
  onOpenHistory,
  onProjectUpdated,
}) => {
  const units = project.units || []

  // Max 3 floors: 0 (Zemin), 1 (Birinci Kat), 2 (İkinci Kat)
  const configuredMaxFloors: 1 | 2 | 3 =
    project.maxFloors === 1 || project.maxFloors === 2 || project.maxFloors === 3
      ? project.maxFloors
      : 3

  const floors = useMemo(() => {
    const arr: number[] = []
    for (let fl = 0; fl < configuredMaxFloors; fl++) {
      arr.push(fl)
    }
    return arr
  }, [configuredMaxFloors])

  const [selectedFloor, setSelectedFloor] = useState<number>(0)

  useEffect(() => {
    if (!floors.includes(selectedFloor)) {
      setSelectedFloor(floors[0] ?? 0)
    }
  }, [floors, selectedFloor])

  // Custom Areas (HAVUZ, A Giriş, B Giriş, Blok, Otopark, Bahçe vb.) visible on this floor
  const floorAreas = (project.customAreas || []).filter(
    (a) => a.floor === undefined || a.floor === 'ALL' || a.floor === selectedFloor
  )

  // Helper to resolve a unit's Block name and Entrance name cleanly
  const resolveUnitBlockAndEntrance = (u: FlatUnit): { blockName: string; entranceName: string } => {
    const rawBlock = (u.block || '').trim()
    const rawEntrance = (u.entrance || '').trim()

    // Check if the unit's center is inside a custom Block area on this floor
    const unitBox = u.planBox
    if (unitBox) {
      const cx = unitBox.x + unitBox.w / 2
      const cy = unitBox.y + unitBox.h / 2
      const enclosingBlockArea = floorAreas.find(
        (a) =>
          a.kind === 'block' &&
          cx >= a.box.x &&
          cx <= a.box.x + a.box.w &&
          cy >= a.box.y &&
          cy <= a.box.y + a.box.h
      )
      if (enclosingBlockArea) {
        const bName = enclosingBlockArea.label.trim()
        const eName =
          rawEntrance ||
          (/giriş/i.test(rawBlock) ? rawBlock : bName.replace(/blok/i, 'Giriş').trim() || 'A Giriş')
        return { blockName: bName, entranceName: eName }
      }
    }

    if (/giriş/i.test(rawBlock)) {
      const eName = rawEntrance || rawBlock
      const bName = rawBlock.replace(/giriş/i, 'Blok').trim() || 'A Blok'
      return { blockName: bName, entranceName: eName }
    }

    const bName = rawBlock || 'A Blok'
    const eName =
      rawEntrance ||
      (/^[a-zA-ZçğıöşüÇĞİÖŞÜ]\s*blok$/i.test(bName)
        ? bName.replace(/blok/i, 'Giriş')
        : 'A Giriş')
    return { blockName: bName, entranceName: eName }
  }

  // Distinct blocks (from custom 'block' areas + units + default A/B Blok)
  const blocks = useMemo(() => {
    const set = new Set<string>()
    ;(project.customAreas || [])
      .filter((a) => a.kind === 'block')
      .forEach((a) => {
        if (a.label.trim()) set.add(a.label.trim())
      })
    units.forEach((u) => {
      const { blockName } = resolveUnitBlockAndEntrance(u)
      if (blockName) set.add(blockName)
    })
    if (set.size === 0) {
      set.add('A Blok')
    }
    if (set.size === 1 && project.blockCount === 2) {
      set.add('B Blok')
    }
    return Array.from(set)
  }, [project.customAreas, units, project.blockCount, selectedFloor])

  // Selectable Entrances for Left Bar ("A Giriş", "B Giriş" + custom entrance areas)
  const selectableEntrances = useMemo(() => {
    const map = new Map<string, { label: string; areaId?: string }>()
    const entranceAreas = (project.customAreas || []).filter((a) => a.kind === 'entrance')
    entranceAreas.forEach((a) => {
      const key = a.label.trim().toLocaleLowerCase('tr-TR')
      if (key && !map.has(key)) {
        map.set(key, { label: a.label.trim(), areaId: a.id })
      }
    })
    ;['A Giriş', 'B Giriş'].forEach((defEnt) => {
      const key = defEnt.toLocaleLowerCase('tr-TR')
      if (!map.has(key)) {
        map.set(key, { label: defEnt })
      }
    })
    return Array.from(map.values())
  }, [project.customAreas])

  // Highlighted Entrance state (blinks/flashes when clicked in Left Bar)
  const [highlightedEntrance, setHighlightedEntrance] = useState<{
    label: string
    areaId?: string
    tick: number
  } | null>(null)

  useEffect(() => {
    if (!highlightedEntrance) return
    const timer = window.setTimeout(() => {
      setHighlightedEntrance(null)
    }, 3400)
    return () => window.clearTimeout(timer)
  }, [highlightedEntrance])

  // Default to 'ALL' (Tüm Plan)
  const [selectedBlock, setSelectedBlock] = useState<string>('ALL')

  useEffect(() => {
    if (selectedBlock !== 'ALL' && !blocks.includes(selectedBlock)) {
      setSelectedBlock('ALL')
    }
  }, [blocks, selectedBlock])

  // Units filtered by block (or all units if 'ALL')
  const blockUnits = useMemo(() => {
    if (selectedBlock === 'ALL') return units
    return units.filter((u) => {
      const { blockName } = resolveUnitBlockAndEntrance(u)
      return (
        blockName.toLocaleLowerCase('tr-TR') === selectedBlock.toLocaleLowerCase('tr-TR') ||
        (u.block || '').toLocaleLowerCase('tr-TR') === selectedBlock.toLocaleLowerCase('tr-TR')
      )
    })
  }, [units, selectedBlock, floorAreas])

  // Units on active floor
  const floorUnits = blockUnits.filter(
    (u) => Math.max(0, Math.min(2, u.floor)) === selectedFloor
  )

  // Selected unit for right-side inspector panel (null by default -> shows Project Info!)
  const [activeUnitId, setActiveUnitId] = useState<string | null>(null)
  // Selected custom area in edit mode
  const [activeAreaId, setActiveAreaId] = useState<string | null>(null)

  useEffect(() => {
    if (activeUnitId && !floorUnits.some((u) => u.id === activeUnitId)) {
      setActiveUnitId(null)
    }
  }, [floorUnits.length, selectedFloor, selectedBlock, activeUnitId])

  const activeUnit = activeUnitId ? floorUnits.find((u) => u.id === activeUnitId) || null : null

  // Architectural Layout Template
  const layoutTemplate: BlueprintLayoutTemplate = project.layoutTemplate || 'quad'

  // Floor Plan Image key: specific floor key or fallback to DEFAULT project blueprint
  const floorKey = `${selectedBlock}::${selectedFloor}`
  const specificFloorPlan = project.floorPlans?.[floorKey]
  const defaultFloorPlan = project.floorPlans?.['DEFAULT'] || project.blueprintUrl
  const activeFloorPlanUrl = specificFloorPlan || defaultFloorPlan || null

  // Clean up bogus floor-title custom areas and initialize missing unit planBox once (never overwrite user edits)
  useEffect(() => {
    let mutated = false
    const allAreas = project.customAreas || []

    allAreas.forEach((a) => {
      if (/^(zemin\s*kat|giriş\s*kat|1\s*\.\s*kat|birinci\s*kat|2\s*\.\s*kat|ikinci\s*kat)$/i.test(a.label.trim())) {
        projectStore.deleteCustomArea(project.id, a.id)
        mutated = true
      }
    })

    floorUnits.forEach((u, idx) => {
      if (!u.planBox) {
        const defBox = getDefaultUnitPlanBox(idx, floorUnits.length, layoutTemplate, u.sizePreset)
        projectStore.updateUnitPlanBox(project.id, u.id, defBox, u.sizePreset)
        mutated = true
      }
    })

    if (mutated) {
      onProjectUpdated()
    }
  }, [project.id, selectedFloor])

  // Custom Facades (Kuzey, Güney, Doğu, Batı vb. — ara yönler varsayılan olarak gelmez)
  const customFacades: KrokiFacadeItem[] = useMemo(() => {
    const AUTO_INTERCARDINAL_IDS = new Set(['fac-nw-v3', 'fac-ne-v3', 'fac-sw-v3', 'fac-se-v3'])
    const raw = Array.isArray(project.customFacades)
      ? project.customFacades.filter((f) => !AUTO_INTERCARDINAL_IDS.has(f.id))
      : DEFAULT_KROKI_FACADES

    // Normalize compass directions to their exact corner/edge and deduplicate so facades never overlap
    const seen = new Set<string>()
    const normalized: KrokiFacadeItem[] = []
    raw.forEach((f) => {
      const canonical = resolveCanonicalCompassEdge(f.label)
      const validEdge: FacadeEdge =
        canonical || (ALL_FACADE_EDGES.includes(f.edge) ? f.edge : 'top')
      const key = `${validEdge}-${f.label.trim().toLocaleLowerCase('tr-TR')}`
      if (!seen.has(key)) {
        seen.add(key)
        normalized.push({ ...f, edge: validEdge })
      }
    })
    return normalized
  }, [project.customFacades])

  // Document parse feedback state (only shown once immediately after a new plan upload)
  const [isParsingDoc, setIsParsingDoc] = useState<boolean>(false)
  const [docFeedback, setDocFeedback] = useState<string | null>(null)

  // Manual Config states synced with project
  const currentUnitsPerFloor = useMemo(() => {
    if (project.unitsPerFloor) return project.unitsPerFloor
    return Math.max(1, Math.min(12, floorUnits.length || 4))
  }, [project.unitsPerFloor, floorUnits.length])

  const currentBlockCount: 1 | 2 = blocks.length >= 2 ? 2 : 1
  const currentRoomTypeSetting: RoomType | 'MIXED' = project.defaultRoomType || 'MIXED'

  // Interactive "Düzenle" Mode (Add/Edit/Delete/Move/Resize Units, Areas, and Facades)
  const [isLayoutEditMode, setIsLayoutEditMode] = useState(false)
  const [isFreeMoveMode, setIsFreeMoveMode] = useState(false)
  const [isCtrlPressed, setIsCtrlPressed] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.ctrlKey || e.metaKey) {
        setIsCtrlPressed(true)
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control' || (!e.ctrlKey && !e.metaKey)) {
        setIsCtrlPressed(false)
      }
    }
    const handleWindowBlur = () => {
      setIsCtrlPressed(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleWindowBlur)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [])
  const [planOpacity, setPlanOpacity] = useState<number>(85)
  const canvasRef = useRef<HTMLDivElement>(null)
  const fileInputUniversalRef = useRef<HTMLInputElement>(null)
  const fileInputFloorRef = useRef<HTMLInputElement>(null)

  // Modals / Popovers for "+ Daire", "+ Alan", "+ Cephe", "+ Blok", "+ Giriş", "+ Alt Bilgi"
  const [showAddUnitForm, setShowAddUnitForm] = useState(false)
  const [newUnitDraft, setNewUnitDraft] = useState<{
    unitNumber: string
    block: string
    entrance: string
    roomType: RoomType
    sizePreset: UnitSizePreset
    price: number
    status: FlatStatus
    statusLabel: string
  }>({
    unitNumber: '',
    block: blocks[0] || 'A Blok',
    entrance: 'A Giriş',
    roomType: '2+1',
    sizePreset: '16x9',
    price: 5500000,
    status: 'SATISTA',
    statusLabel: 'Satışta',
  })

  const [showAddAreaForm, setShowAddAreaForm] = useState(false)
  const [newAreaDraft, setNewAreaDraft] = useState<{
    label: string
    kind: KrokiAreaKind
    sizePreset: UnitSizePreset
    direction: 'up' | 'down' | 'left' | 'right'
    allFloors: boolean
  }>({
    label: 'HAVUZ',
    kind: 'pool',
    sizePreset: '16x9',
    direction: 'up',
    allFloors: true,
  })

  const [showAddBlockForm, setShowAddBlockForm] = useState(false)
  const [newBlockDraft, setNewBlockDraft] = useState<{
    label: string
    includeEntrance: boolean
    entranceLabel: string
    entranceVertical: boolean
    allFloors: boolean
  }>({
    label: 'A Blok',
    includeEntrance: true,
    entranceLabel: 'A Giriş',
    entranceVertical: true,
    allFloors: true,
  })

  const [showAddEntranceForm, setShowAddEntranceForm] = useState(false)
  const [newEntranceDraft, setNewEntranceDraft] = useState<{
    label: string
    textOrientation: 'horizontal' | 'vertical'
    direction: 'up' | 'down' | 'left' | 'right'
    allFloors: boolean
  }>({
    label: 'A Giriş',
    textOrientation: 'vertical',
    direction: 'up',
    allFloors: true,
  })

  const [showAddFacadeForm, setShowAddFacadeForm] = useState(false)
  const [newFacadeDraft, setNewFacadeDraft] = useState<{
    label: string
    edge: FacadeEdge
  }>({
    label: 'Deniz Cephesi',
    edge: 'bottom',
  })
  const [editingFacadeId, setEditingFacadeId] = useState<string | null>(null)
  const [editingFacadeText, setEditingFacadeText] = useState<string>('')
  const [customUnitFacadeInput, setCustomUnitFacadeInput] = useState<string>('')

  // "+ Alt Bilgi" (Peşinat, vade, kampanya vb. isteğe bağlı alt bilgi)
  const [showAddFooterInfoForm, setShowAddFooterInfoForm] = useState(false)
  const [footerInfoDraft, setFooterInfoDraft] = useState<string>(project.footerInfo || '')

  const closeAllEditForms = () => {
    setShowAddUnitForm(false)
    setShowAddAreaForm(false)
    setShowAddFacadeForm(false)
    setShowAddBlockForm(false)
    setShowAddEntranceForm(false)
    setShowAddFooterInfoForm(false)
  }

  // Sol menüden bir girişe ("A Giriş", "B Giriş" vb.) tıklandığında o girişi yanıp sönme efektiyle vurgula
  const handleSelectEntranceFromSidebar = (entLabel: string, areaId?: string) => {
    const existing = (project.customAreas || []).find(
      (a) =>
        a.kind === 'entrance' &&
        (a.id === areaId || a.label.trim().toLocaleLowerCase('tr-TR') === entLabel.trim().toLocaleLowerCase('tr-TR'))
    )
    if (existing) {
      setHighlightedEntrance({
        label: existing.label,
        areaId: existing.id,
        tick: Date.now(),
      })
      return
    }

    // Eğer planda henüz bu giriş kutusu yoksa otomatik olarak uygun giriş noktasına ekle ve yanıp söndür
    const isB = /b\s*giriş/i.test(entLabel)
    const created = projectStore.addCustomArea(project.id, {
      label: entLabel,
      kind: 'entrance',
      direction: isB ? 'up' : 'right',
      textOrientation: 'horizontal',
      floor: 'ALL',
      box: isB
        ? { x: 24.5, y: 36.5, w: 9.0, h: 6.5 }
        : { x: 59.0, y: 36.5, w: 9.5, h: 6.5 },
    })
    onProjectUpdated()
    setHighlightedEntrance({
      label: entLabel,
      areaId: created.area?.id,
      tick: Date.now(),
    })
  }

  useEffect(() => {
    setFooterInfoDraft(project.footerInfo || '')
  }, [project.id, project.footerInfo])

  const handleSaveFooterInfo = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = footerInfoDraft.trim()
    projectStore.updateProject(project.id, {
      footerInfo: trimmed || undefined,
      paymentBanner: undefined,
    })
    setShowAddFooterInfoForm(false)
    onProjectUpdated()
  }

  const handleRemoveFooterInfo = () => {
    setFooterInfoDraft('')
    projectStore.updateProject(project.id, {
      footerInfo: undefined,
      paymentBanner: undefined,
    })
    setShowAddFooterInfoForm(false)
    onProjectUpdated()
  }

  // Blok içi elementlerin blokla birlikte eşdeğer ölçeklenmesi için относительный (bağıl) kayıt tipi
  type BlockChildSnapshot = {
    kind: 'unit' | 'area'
    id: string
    relX: number
    relY: number
    relW: number
    relH: number
  }

  // Unified Drag & Apple-Widget Corner Resize State for both Units and Areas
  const [interactionState, setInteractionState] = useState<{
    targetType: 'unit' | 'area'
    targetId: string
    mode: 'move' | 'resize'
    startX: number
    startY: number
    initialBox: UnitPlanBox
    blockChildren?: BlockChildSnapshot[]
  } | null>(null)

  // Blok silinirken "Yalnızca Bloğu Sil" / "Elementlerle Birlikte Sil" seçim diyaloğu
  const [blockDeleteModal, setBlockDeleteModal] = useState<{
    blockId: string
    blockLabel: string
    childUnitIds: string[]
    childAreaIds: string[]
  } | null>(null)

  const isBoxCenterInsideBlock = (inner: UnitPlanBox, outer: UnitPlanBox): boolean => {
    const cx = inner.x + inner.w / 2
    const cy = inner.y + inner.h / 2
    return (
      cx >= outer.x - 0.4 &&
      cx <= outer.x + outer.w + 0.4 &&
      cy >= outer.y - 0.4 &&
      cy <= outer.y + outer.h + 0.4
    )
  }

  // Bir daire bloğun içine yerleştirildiğinde o bloğa ait olmasını sağlar
  const assignUnitToContainingBlockIfAny = (unitId: string, unitBox: UnitPlanBox) => {
    const containingBlock = floorAreas.find(
      (a) => a.kind === 'block' && isBoxCenterInsideBlock(unitBox, a.box)
    )
    if (containingBlock) {
      projectStore.updateUnitDetails(project.id, unitId, {
        block: containingBlock.label,
      })
    }
  }

  // Bloğun içindeki daireleri ve diğer elementleri yakalar (blok büyür/küçülür/taşınırsa birlikte ölçeklenir)
  const captureBlockChildren = (blockId: string, blockBox: UnitPlanBox): BlockChildSnapshot[] => {
    const children: BlockChildSnapshot[] = []
    const bw = Math.max(1, blockBox.w)
    const bh = Math.max(1, blockBox.h)

    floorUnits.forEach((u, idx) => {
      const uBox =
        u.planBox || getDefaultUnitPlanBox(idx, floorUnits.length, layoutTemplate, u.sizePreset)
      if (isBoxCenterInsideBlock(uBox, blockBox)) {
        children.push({
          kind: 'unit',
          id: u.id,
          relX: (uBox.x - blockBox.x) / bw,
          relY: (uBox.y - blockBox.y) / bh,
          relW: uBox.w / bw,
          relH: uBox.h / bh,
        })
      }
    })

    floorAreas.forEach((a) => {
      if (a.id === blockId || a.kind === 'block') return
      if (isBoxCenterInsideBlock(a.box, blockBox)) {
        children.push({
          kind: 'area',
          id: a.id,
          relX: (a.box.x - blockBox.x) / bw,
          relY: (a.box.y - blockBox.y) / bh,
          relW: a.box.w / bw,
          relH: a.box.h / bh,
        })
      }
    })

    return children
  }

  const applyBlockTransformToChildren = (
    blockLabel: string,
    nextBlockBox: UnitPlanBox,
    children?: BlockChildSnapshot[]
  ) => {
    if (!children || children.length === 0) return
    children.forEach((child) => {
      const scaledBox: UnitPlanBox = {
        x: Number(Math.max(0.8, Math.min(96.0, nextBlockBox.x + child.relX * nextBlockBox.w)).toFixed(1)),
        y: Number(Math.max(0.8, Math.min(95.0, nextBlockBox.y + child.relY * nextBlockBox.h)).toFixed(1)),
        w: Number(Math.max(3.6, Math.min(92.0, child.relW * nextBlockBox.w)).toFixed(1)),
        h: Number(Math.max(4.2, Math.min(90.0, child.relH * nextBlockBox.h)).toFixed(1)),
      }
      if (child.kind === 'unit') {
        projectStore.updateUnitPlanBox(project.id, child.id, scaledBox)
        projectStore.updateUnitDetails(project.id, child.id, { block: blockLabel })
      } else {
        projectStore.updateCustomArea(project.id, child.id, { box: scaledBox })
      }
    })
  }

  // Mıknatıs (Snap) Hizalama Kılavuz Çizgileri
  const [snapGuides, setSnapGuides] = useState<{ xLines: number[]; yLines: number[] }>({
    xLines: [],
    yLines: [],
  })

  // Daire Sağ Tık Bağlam Menüsü State'i
  const [unitContextMenu, setUnitContextMenu] = useState<{
    unitId: string
    x: number
    y: number
  } | null>(null)
  const unitContextMenuRef = useRef<HTMLDivElement>(null)

  // Havuz ve Diğer Daire Dışı Alanların Sağ Tık Bağlam Menüsü State'i
  const [areaContextMenu, setAreaContextMenu] = useState<{
    areaId: string
    x: number
    y: number
  } | null>(null)
  const areaContextMenuRef = useRef<HTMLDivElement>(null)
  const [areaLabelEditDraft, setAreaLabelEditDraft] = useState('')

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        unitContextMenuRef.current &&
        !unitContextMenuRef.current.contains(e.target as Node)
      ) {
        setUnitContextMenu(null)
      }
      if (
        areaContextMenuRef.current &&
        !areaContextMenuRef.current.contains(e.target as Node)
      ) {
        setAreaContextMenu(null)
      }
    }
    const handleWindowScroll = () => {
      setUnitContextMenu(null)
      setAreaContextMenu(null)
    }
    if (unitContextMenu || areaContextMenu) {
      window.addEventListener('mousedown', handleOutsideClick)
      window.addEventListener('scroll', handleWindowScroll, true)
    }
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick)
      window.removeEventListener('scroll', handleWindowScroll, true)
    }
  }, [unitContextMenu, areaContextMenu])

  // Daireyi ilk default haline / konumuna ve ilk ölçeğine getir
  const handleResetUnitToInitial = (targetUnitId: string) => {
    const uIdx = floorUnits.findIndex((u) => u.id === targetUnitId)
    const targetUnit = floorUnits[uIdx]
    if (!targetUnit) return

    const defaultPreset: UnitSizePreset =
      layoutTemplate === 'wing' && uIdx >= 4 && uIdx < 6 ? 'narrow-v' : 'wide-rect'

    const initialBox = getDefaultUnitPlanBox(
      Math.max(0, uIdx),
      floorUnits.length,
      layoutTemplate,
       undefined
    )
    const safeInitialBox = clampBoxAvoidingFacades(
      initialBox,
      'move',
      targetUnitId,
      true,
      true
    )
    projectStore.updateUnitPlanBox(project.id, targetUnitId, safeInitialBox, defaultPreset)
    setUnitContextMenu(null)
    onProjectUpdated()
  }

  // Dairenin yatay/dikey yönünü 90 derece çevir (En <-> Boy takası)
  const handleRotateUnitBox = (targetUnitId: string) => {
    const uIdx = floorUnits.findIndex((u) => u.id === targetUnitId)
    const targetUnit = floorUnits[uIdx]
    if (!targetUnit) return
    const currentBox =
      targetUnit.planBox ||
      getDefaultUnitPlanBox(Math.max(0, uIdx), floorUnits.length, layoutTemplate, targetUnit.sizePreset)
    const rotatedRaw: UnitPlanBox = {
      x: currentBox.x,
      y: currentBox.y,
      w: Math.max(8, Math.min(45, Math.round(currentBox.h * 0.65))),
      h: Math.max(12, Math.min(48, Math.round(currentBox.w * 1.45))),
    }
    const nextBox = clampBoxAvoidingFacades(rotatedRaw, 'move', targetUnitId, true, true)
    const detectedPreset = inferSizePresetFromBox(nextBox)
    projectStore.updateUnitPlanBox(project.id, targetUnitId, nextBox, detectedPreset)
    setUnitContextMenu(null)
    onProjectUpdated()
  }

  // Dairenin konum ve ölçeğini diğer katlardaki aynı sıradaki dairelere de uygula
  const handleSyncUnitBoxToOtherFloors = (targetUnitId: string) => {
    const uIdx = floorUnits.findIndex((u) => u.id === targetUnitId)
    const targetUnit = floorUnits[uIdx]
    if (!targetUnit) return
    const sourceBox =
      targetUnit.planBox ||
      getDefaultUnitPlanBox(Math.max(0, uIdx), floorUnits.length, layoutTemplate, targetUnit.sizePreset)

    floors.forEach((fl) => {
      if (fl === selectedFloor) return
      const otherFloorUnits = blockUnits.filter(
        (u) => Math.max(0, Math.min(2, u.floor)) === fl
      )
      const matchingUnit = otherFloorUnits[uIdx]
      if (matchingUnit) {
        projectStore.updateUnitPlanBox(
          project.id,
          matchingUnit.id,
          { ...sourceBox },
          targetUnit.sizePreset
        )
      }
    })
    setUnitContextMenu(null)
    onProjectUpdated()
  }

  // Daire durumunu bağlam menüsünden hızlı güncelle
  const handleQuickSetStatus = (
    targetUnitId: string,
    status: FlatStatus,
    customLabel?: string
  ) => {
    const statusLabel =
      customLabel ||
      (status === 'SATISTA' ? 'Satışta' : status === 'REZERVE' ? 'Rezerve' : 'SATILDI')
    projectStore.updateUnitDetails(project.id, targetUnitId, { status, statusLabel })
    setUnitContextMenu(null)
    onProjectUpdated()
  }

  // Daireyi kopyala / çoğalt
  const handleDuplicateUnit = (targetUnitId: string) => {
    const targetIdx = floorUnits.findIndex((u) => u.id === targetUnitId)
    const targetUnit = floorUnits[targetIdx]
    if (!targetUnit) return

    // Mevcut dairelerin konumlarını sabitle ki yeni daire eklendiğinde kaymasınlar
    floorUnits.forEach((u, idx) => {
      if (!u.planBox) {
        const b = getDefaultUnitPlanBox(idx, floorUnits.length, layoutTemplate, u.sizePreset)
        projectStore.updateUnitPlanBox(project.id, u.id, b, u.sizePreset)
      }
    })

    const srcBox =
      targetUnit.planBox ||
      getDefaultUnitPlanBox(targetIdx, floorUnits.length, layoutTemplate, targetUnit.sizePreset)
    const candidateBox = clampBoxAvoidingFacades(
      {
        x: srcBox.x + srcBox.w + 2.0 <= 96.8 - srcBox.w ? srcBox.x + srcBox.w + 2.0 : srcBox.x,
        y: srcBox.x + srcBox.w + 2.0 <= 96.8 - srcBox.w ? srcBox.y : srcBox.y + srcBox.h + 2.0,
        w: srcBox.w,
        h: srcBox.h,
      },
      'move',
      undefined,
      true,
      true
    )

    const res = projectStore.addUnitToFloor(project.id, selectedFloor, {
      unitNumber: `${targetUnit.unitNumber} (Kopya)`,
      block: targetUnit.block,
      roomType: targetUnit.roomType,
      sizePreset: targetUnit.sizePreset || 'wide-rect',
      planBox: candidateBox,
      price: targetUnit.price,
      status: targetUnit.status,
      statusLabel: targetUnit.statusLabel,
    })
    if (res.success && res.unit) {
      setActiveUnitId(res.unit.id)
      setUnitContextMenu(null)
      onProjectUpdated()
    }
  }

  // Daireyi kaldır
  const handleDeleteUnitQuick = (targetUnitId: string) => {
    projectStore.deleteUnit(project.id, targetUnitId)
    if (activeUnitId === targetUnitId) {
      setActiveUnitId(null)
    }
    setUnitContextMenu(null)
    onProjectUpdated()
  }

  // Havuz ve diğer daire dışı alanı ilk varsayılan boyut/konumuna getir
  const handleResetAreaToInitial = (targetAreaId: string) => {
    const targetArea = floorAreas.find((a) => a.id === targetAreaId)
    if (!targetArea) return

    const defaultBox: UnitPlanBox =
      targetArea.kind === 'pool'
        ? { x: 35.0, y: 44.0, w: 30.0, h: 25.0 }
        : targetArea.kind === 'garden'
        ? { x: 8.0, y: 48.0, w: 26.0, h: 24.0 }
        : targetArea.kind === 'parking'
        ? { x: 66.0, y: 48.0, w: 24.0, h: 22.0 }
        : targetArea.kind === 'entrance'
        ? targetArea.textOrientation === 'vertical'
          ? { x: 6.5, y: 34.0, w: 5.2, h: 17.5 }
          : { x: 45.0, y: 36.5, w: 9.5, h: 6.5 }
        : targetArea.kind === 'block'
        ? { x: 6.5, y: 7.5, w: 86.0, h: 76.0 }
        : { x: 38.0, y: 46.0, w: 24.0, h: 20.0 }

    const safeBox =
      targetArea.kind === 'block' || targetArea.kind === 'entrance'
        ? defaultBox
        : clampBoxAvoidingFacades(defaultBox, 'move', targetAreaId, true, true)

    if (targetArea.kind === 'block') {
      const children = captureBlockChildren(targetArea.id, targetArea.box)
      projectStore.updateCustomArea(project.id, targetAreaId, { box: safeBox })
      applyBlockTransformToChildren(targetArea.label, safeBox, children)
    } else {
      projectStore.updateCustomArea(project.id, targetAreaId, { box: safeBox })
    }
    setAreaContextMenu(null)
    onProjectUpdated()
  }

  // Havuz ve diğer daire dışı alanı yatay/dikey 90° çevir (En <-> Boy takası)
  const handleRotateAreaBox = (targetAreaId: string) => {
    const targetArea = floorAreas.find((a) => a.id === targetAreaId)
    if (!targetArea) return

    const currentBox = targetArea.box
    const isEntrance = targetArea.kind === 'entrance'
    const isBlock = targetArea.kind === 'block'

    const rotatedRaw: UnitPlanBox = isEntrance
      ? {
          x: currentBox.x,
          y: currentBox.y,
          w: Number(Math.max(4.5, Math.min(30, currentBox.h * 0.65)).toFixed(1)),
          h: Number(Math.max(5.5, Math.min(35, currentBox.w * 1.55)).toFixed(1)),
        }
      : {
          x: currentBox.x,
          y: currentBox.y,
          w: Math.max(8, Math.min(88, Math.round(currentBox.h * 0.72))),
          h: Math.max(10, Math.min(82, Math.round(currentBox.w * 1.35))),
        }

    const nextBox =
      isBlock || isEntrance
        ? rotatedRaw
        : clampBoxAvoidingFacades(rotatedRaw, 'move', targetAreaId, true, true)

    const currentVertical =
      targetArea.textOrientation === 'vertical' ||
      (isEntrance && currentBox.h > currentBox.w * 1.35)

    const blockChildren = isBlock ? captureBlockChildren(targetArea.id, currentBox) : undefined

    projectStore.updateCustomArea(project.id, targetAreaId, {
      box: nextBox,
      ...(isEntrance || targetArea.textOrientation
        ? { textOrientation: currentVertical ? 'horizontal' : 'vertical' }
        : {}),
    })
    if (isBlock && blockChildren) {
      applyBlockTransformToChildren(targetArea.label, nextBox, blockChildren)
    }
    setAreaContextMenu(null)
    onProjectUpdated()
  }

  // Havuz ve diğer daire dışı alanı çoğalt / kopyala
  const handleDuplicateArea = (targetAreaId: string) => {
    const targetArea = floorAreas.find((a) => a.id === targetAreaId)
    if (!targetArea) return

    const srcBox = targetArea.box
    const shiftedBox: UnitPlanBox = {
      x: srcBox.x + srcBox.w + 2.0 <= 96.8 - srcBox.w ? srcBox.x + srcBox.w + 2.0 : srcBox.x + 3.0,
      y: srcBox.x + srcBox.w + 2.0 <= 96.8 - srcBox.w ? srcBox.y : srcBox.y + srcBox.h + 2.0,
      w: srcBox.w,
      h: srcBox.h,
    }
    const candidateBox =
      targetArea.kind === 'block' || targetArea.kind === 'entrance'
        ? shiftedBox
        : clampBoxAvoidingFacades(shiftedBox, 'move', undefined, true, true)

    const res = projectStore.addCustomArea(project.id, {
      label: `${targetArea.label} (Kopya)`,
      kind: targetArea.kind,
      direction: targetArea.direction,
      textOrientation: targetArea.textOrientation,
      floor: targetArea.floor,
      box: candidateBox,
    })
    if (res.success && res.area) {
      setActiveAreaId(res.area.id)
      setAreaContextMenu(null)
      onProjectUpdated()
    }
  }

  // Bloğu yalnızca çerçeve olarak veya içindeki elementlerle birlikte sil
  const handleExecuteBlockDeletion = (
    blockId: string,
    mode: 'only-block' | 'with-elements',
    unitIdsToDelete: string[] = [],
    areaIdsToDelete: string[] = []
  ) => {
    if (mode === 'with-elements') {
      unitIdsToDelete.forEach((uid) => {
        projectStore.deleteUnit(project.id, uid)
        if (activeUnitId === uid) setActiveUnitId(null)
      })
      areaIdsToDelete.forEach((aid) => {
        projectStore.deleteCustomArea(project.id, aid)
        if (activeAreaId === aid) setActiveAreaId(null)
      })
    }
    projectStore.deleteCustomArea(project.id, blockId)
    if (activeAreaId === blockId) {
      setActiveAreaId(null)
    }
    setBlockDeleteModal(null)
    setAreaContextMenu(null)
    onProjectUpdated()
  }

  // Havuz, blok ve diğer daire dışı alanı kaldır (Blok ise "Yalnızca Bloğu Sil" / "Elementlerle Birlikte Sil" seçeneği çıkar)
  const handleDeleteAreaQuick = (targetAreaId: string) => {
    const targetArea = floorAreas.find((a) => a.id === targetAreaId)
    if (targetArea && targetArea.kind === 'block') {
      const children = captureBlockChildren(targetArea.id, targetArea.box)
      const childUnitIds = children.filter((c) => c.kind === 'unit').map((c) => c.id)
      const childAreaIds = children.filter((c) => c.kind === 'area').map((c) => c.id)
      setAreaContextMenu(null)
      setBlockDeleteModal({
        blockId: targetArea.id,
        blockLabel: targetArea.label,
        childUnitIds,
        childAreaIds,
      })
      return
    }

    projectStore.deleteCustomArea(project.id, targetAreaId)
    if (activeAreaId === targetAreaId) {
      setActiveAreaId(null)
    }
    setAreaContextMenu(null)
    onProjectUpdated()
  }

  // Alan başlığını bağlam menüsünden kaydet
  const handleSaveAreaLabelFromContext = (targetAreaId: string) => {
    const trimmed = areaLabelEditDraft.trim()
    if (!trimmed) return
    projectStore.updateCustomArea(project.id, targetAreaId, { label: trimmed })
    onProjectUpdated()
  }

  // Automatic Document & Plan Upload (Word, PDF, PPTX, Excel, CSV, Image)
  const handleUniversalDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsParsingDoc(true)
    try {
      const parsed = await parseProjectDocumentFile(file)
      projectStore.reconfigureProjectKroki(project.id, {
        maxFloors: parsed.floorCount,
        unitsPerFloor: parsed.unitsPerFloor,
        blockCount: parsed.blockCount,
        defaultRoomType: parsed.defaultRoomType,
        layoutTemplate: parsed.layoutTemplate,
        blueprintDataUrl: parsed.extractedBlueprintDataUrl,
        clearBlueprint: parsed.clearBlueprint,
        sourceDocumentName: parsed.fileName,
        sourceDocumentSummary: parsed.summary,
        customAreas: parsed.customAreas,
        customFacades: parsed.customFacades,
        paymentBanner: parsed.paymentBanner,
        parcelInfo: parsed.parcelInfo,
        parsedUnits: parsed.parsedUnits.length > 0 ? parsed.parsedUnits : undefined,
      })
      setDocFeedback(parsed.summary)
      window.setTimeout(() => {
        setDocFeedback(null)
      }, 5000)
      setSelectedFloor(0)
      setSelectedBlock('ALL')
      onProjectUpdated()
    } catch (err) {
      console.error('Belge analiz hatası:', err)
      setDocFeedback('Belge okunurken bir sorun oluştu, mevcut kroki korundu.')
    } finally {
      setIsParsingDoc(false)
      e.target.value = ''
    }
  }

  // Upload floor-specific background image or document
  const handleUploadFloorSpecific = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      if (file.type.startsWith('image/')) {
        const dataUrl = await compressImageToDataUrl(file)
        projectStore.updateFloorPlan(project.id, floorKey, dataUrl)
        onProjectUpdated()
      } else {
        await handleUniversalDocumentUpload(e)
      }
    } catch (err) {
      console.error('Kat planı yüklenemedi:', err)
    } finally {
      e.target.value = ''
    }
  }

  // Manual Kroki Reconfiguration handler (Floor count, units per floor, block count, room type)
  const handleManualReconfigure = (updates: {
    maxFloors?: 1 | 2 | 3
    unitsPerFloor?: number
    blockCount?: 1 | 2
    defaultRoomType?: RoomType | 'MIXED'
  }) => {
    const nextMaxFloors = updates.maxFloors ?? configuredMaxFloors
    const nextUnitsPerFloor = updates.unitsPerFloor ?? currentUnitsPerFloor
    const nextBlockCount = updates.blockCount ?? currentBlockCount
    const nextRoomType = updates.defaultRoomType ?? currentRoomTypeSetting

    projectStore.reconfigureProjectKroki(project.id, {
      maxFloors: nextMaxFloors,
      unitsPerFloor: nextUnitsPerFloor,
      blockCount: nextBlockCount,
      defaultRoomType: nextRoomType,
      layoutTemplate,
    })

    if (selectedFloor >= nextMaxFloors) {
      setSelectedFloor(Math.max(0, nextMaxFloors - 1))
    }
    onProjectUpdated()
  }

  const handleRemovePlan = (targetKey: string) => {
    projectStore.updateFloorPlan(project.id, targetKey, null)
    onProjectUpdated()
  }

  const handleResetFloorBoxes = () => {
    const bounds = {
      minX: 3.2,
      maxX: 96.8,
      minY: 5.5,
      maxY: 93.5,
    }
    const placed: UnitPlanBox[] = floorAreas.map((a) => a.box)
    floorUnits.forEach((u, idx) => {
      const defBox = getDefaultUnitPlanBox(idx, floorUnits.length, layoutTemplate, u.sizePreset)
      const safeBox = findNonOverlappingBox(defBox, placed, bounds, 1.0)
      placed.push(safeBox)
      projectStore.updateUnitPlanBox(project.id, u.id, safeBox)
    })
    onProjectUpdated()
  }

  // Clamp and snap any unit/area box to standardized ruler scale steps (cetvel ölçeği)
  // + magnetic sibling & pairwise center alignment (two-item centering), or 100% Free Mode when Ctrl / Free Mode is active
  const clampBoxAvoidingFacades = (
    rawBox: UnitPlanBox,
    mode: 'move' | 'resize',
    activeTargetId?: string,
    useRulerSnap = false,
    allowGridRelocate = false,
    freeMode = false
  ): UnitPlanBox => {
    const minX = 1.0
    const maxX = 99.0
    const minY = 1.0
    const maxY = 99.0

    let { x, y, w, h } = rawBox

    const activeAreaObj = floorAreas.find((a) => a.id === activeTargetId)
    const isBlockTarget = activeAreaObj?.kind === 'block'
    const isEntranceTarget = activeAreaObj?.kind === 'entrance'

    // In Free Mode (Ctrl held or Free Mode toggled on), bypass all magnet snapping and obstacle cushions
    if (freeMode) {
      if (mode === 'resize') {
        const minW = isEntranceTarget ? 3.0 : isBlockTarget ? 10.0 : 4.0
        const minH = isEntranceTarget ? 3.0 : isBlockTarget ? 10.0 : 4.5
        w = Math.max(minW, Math.min(maxX - x, w))
        h = Math.max(minH, Math.min(maxY - y, h))
      } else {
        w = Math.min(w, maxX - minX)
        h = Math.min(h, maxY - minY)
        x = Math.max(minX, Math.min(maxX - w, x))
        y = Math.max(minY, Math.min(maxY - h, y))
      }
      return {
        x: Number(x.toFixed(1)),
        y: Number(y.toFixed(1)),
        w: Number(w.toFixed(1)),
        h: Number(h.toFixed(1)),
      }
    }

    // Collect all other boxes on this floor + current saved box of the active target
    const siblingBoxes: UnitPlanBox[] = []
    const blockBoxes: UnitPlanBox[] = []
    let prevValidBox: UnitPlanBox | undefined
    floorUnits.forEach((u, idx) => {
      const b =
        u.planBox || getDefaultUnitPlanBox(idx, floorUnits.length, layoutTemplate, u.sizePreset)
      if (u.id === activeTargetId) {
        prevValidBox = b
        return
      }
      if (!isBlockTarget && !isEntranceTarget) {
        siblingBoxes.push(b)
      }
    })
    floorAreas.forEach((a) => {
      if (a.id === activeTargetId) {
        prevValidBox = a.box
        return
      }
      if (a.kind === 'block') {
        blockBoxes.push(a.box)
        return
      }
      if (!isBlockTarget && !isEntranceTarget) {
        siblingBoxes.push(a.box)
      }
    })

    const allObstacles: UnitPlanBox[] = isBlockTarget || isEntranceTarget ? [] : [...siblingBoxes]
    const MIN_GAP = 0.2

    // Upgraded Magnet System: Single-item alignment + Pairwise Centering (centering an item under/above/between 2 items)
    if (useRulerSnap) {
      const MAGNET_THRESH = 1.05 // Crisp magnet threshold that never yanks across distant edges

      if (mode === 'move') {
        let snappedX = Number(x.toFixed(1))
        let snappedY = Number(y.toFixed(1))
        let bestXDist = MAGNET_THRESH
        let bestYDist = MAGNET_THRESH

        const xCandidates: { val: number; weight: number }[] = [
          { val: 50 - w / 2, weight: 0.9 }, // Canvas horizontal center
        ]
        const yCandidates: { val: number; weight: number }[] = [
          { val: 50 - h / 2, weight: 0.9 }, // Canvas vertical center
        ]

        // Enclosing block centers
        blockBoxes.forEach((bb) => {
          xCandidates.push({ val: bb.x + (bb.w - w) / 2, weight: 0.9 })
          yCandidates.push({ val: bb.y + (bb.h - h) / 2, weight: 0.9 })
        })

        // 1. Pairwise Centering Candidates (Two elements: center under/above two side-by-side items, or beside two stacked items)
        for (let i = 0; i < siblingBoxes.length; i++) {
          for (let j = i + 1; j < siblingBoxes.length; j++) {
            const sb1 = siblingBoxes[i]
            const sb2 = siblingBoxes[j]

            // Horizontal pair centers (e.g. centering 1 item under or above 2 items)
            const pairLeft = Math.min(sb1.x, sb2.x)
            const pairRight = Math.max(sb1.x + sb1.w, sb2.x + sb2.w)
            const pairSpanCenterX = (pairLeft + pairRight) / 2
            const pairMidCenterX = ((sb1.x + sb1.w / 2) + (sb2.x + sb2.w / 2)) / 2

            // Slight priority boost (weight 0.82) so centering under 2 items wins over a nearby single edge
            xCandidates.push({ val: pairSpanCenterX - w / 2, weight: 0.82 })
            xCandidates.push({ val: pairMidCenterX - w / 2, weight: 0.82 })

            // Inner gap center between sb1 and sb2
            const innerLeft = Math.min(sb1.x + sb1.w, sb2.x + sb2.w)
            const innerRight = Math.max(sb1.x, sb2.x)
            if (innerRight >= innerLeft - 0.5) {
              const gapCenterX = (innerLeft + innerRight) / 2
              xCandidates.push({ val: gapCenterX - w / 2, weight: 0.82 })
            }

            // Vertical pair centers (e.g. centering 1 item beside 2 vertically stacked items)
            const pairTop = Math.min(sb1.y, sb2.y)
            const pairBottom = Math.max(sb1.y + sb1.h, sb2.y + sb2.h)
            const pairSpanCenterY = (pairTop + pairBottom) / 2
            const pairMidCenterY = ((sb1.y + sb1.h / 2) + (sb2.y + sb2.h / 2)) / 2

            yCandidates.push({ val: pairSpanCenterY - h / 2, weight: 0.82 })
            yCandidates.push({ val: pairMidCenterY - h / 2, weight: 0.82 })

            const innerTop = Math.min(sb1.y + sb1.h, sb2.y + sb2.h)
            const innerBottom = Math.max(sb1.y, sb2.y)
            if (innerBottom >= innerTop - 0.5) {
              const gapCenterY = (innerTop + innerBottom) / 2
              yCandidates.push({ val: gapCenterY - h / 2, weight: 0.82 })
            }
          }
        }

        // 2. Single Sibling Alignment Candidates
        siblingBoxes.forEach((sb) => {
          const verticallyOverlaps = y < sb.y + sb.h + 1.0 && y + h > sb.y - 1.0
          const horizontallyOverlaps = x < sb.x + sb.w + 1.0 && x + w > sb.x - 1.0

          // X alignments: Left edge, Right edge, Center
          xCandidates.push(
            { val: sb.x, weight: 1.0 },
            { val: sb.x + sb.w - w, weight: 1.0 },
            { val: sb.x + (sb.w - w) / 2, weight: 0.92 }
          )
          // Only snap to side-by-side gap when actually on the same horizontal row
          if (verticallyOverlaps) {
            xCandidates.push(
              { val: sb.x + sb.w + 0.5, weight: 1.0 },
              { val: sb.x - w - 0.5, weight: 1.0 }
            )
          }

          // Y alignments: Top edge, Bottom edge, Center
          yCandidates.push(
            { val: sb.y, weight: 1.0 },
            { val: sb.y + sb.h - h, weight: 1.0 },
            { val: sb.y + (sb.h - h) / 2, weight: 0.92 }
          )
          // Only snap to top/bottom stack gap when actually in the same vertical column
          if (horizontallyOverlaps) {
            yCandidates.push(
              { val: sb.y + sb.h + 0.5, weight: 1.0 },
              { val: sb.y - h - 0.5, weight: 1.0 }
            )
          }
        })

        xCandidates.forEach((cand) => {
          const rawDist = Math.abs(x - cand.val)
          const weightedDist = rawDist * cand.weight
          if (rawDist < MAGNET_THRESH && weightedDist < bestXDist) {
            bestXDist = weightedDist
            snappedX = cand.val
          }
        })

        yCandidates.forEach((cand) => {
          const rawDist = Math.abs(y - cand.val)
          const weightedDist = rawDist * cand.weight
          if (rawDist < MAGNET_THRESH && weightedDist < bestYDist) {
            bestYDist = weightedDist
            snappedY = cand.val
          }
        })

        x = snappedX
        y = snappedY
      } else {
        const MAGNET_RESIZE_THRESH = 1.1
        let snappedW = Number(w.toFixed(1))
        let snappedH = Number(h.toFixed(1))
        let bestWDist = MAGNET_RESIZE_THRESH
        let bestHDist = MAGNET_RESIZE_THRESH

        siblingBoxes.forEach((sb) => {
          const wCandidates = [sb.w, sb.x + sb.w - x, sb.x - x - 0.5]
          wCandidates.forEach((cand) => {
            const d = Math.abs(w - cand)
            if (cand >= 4.5 && d < bestWDist) {
              bestWDist = d
              snappedW = cand
            }
          })

          const hCandidates = [sb.h, sb.y + sb.h - y, sb.y - y - 0.5]
          hCandidates.forEach((cand) => {
            const d = Math.abs(h - cand)
            if (cand >= 5.5 && d < bestHDist) {
              bestHDist = d
              snappedH = cand
            }
          })
        })

        w = snappedW
        h = snappedH
      }
    }

    if (mode === 'resize') {
      const minW = isEntranceTarget ? 3.5 : isBlockTarget ? 12.0 : 4.5
      const minH = isEntranceTarget ? 3.5 : isBlockTarget ? 12.0 : 5.5
      w = Math.max(minW, Math.min(maxX - x, w))
      h = Math.max(minH, Math.min(maxY - y, h))

      // Prevent resizing onto any sibling unit or custom area
      allObstacles.forEach((obs) => {
        if (!boxesOverlap({ x, y, w, h }, obs, MIN_GAP)) return
        const maxAllowedW = obs.x - x - 0.3
        const maxAllowedH = obs.y - y - 0.3
        if (obs.x >= x + 3 && maxAllowedW >= minW && (obs.y < y + 3 || maxAllowedW / w >= maxAllowedH / h)) {
          w = Math.min(w, maxAllowedW)
        } else if (obs.y >= y + 3 && maxAllowedH >= minH) {
          h = Math.min(h, maxAllowedH)
        } else if (prevValidBox) {
          w = prevValidBox.w
          h = prevValidBox.h
        }
      })
    } else {
      w = Math.min(w, maxX - minX)
      h = Math.min(h, maxY - minY)
      x = Math.max(minX, Math.min(maxX - w, x))
      y = Math.max(minY, Math.min(maxY - h, y))

      const isFreePosition = (cx: number, cy: number, cw = w, ch = h): boolean => {
        if (cx < minX - 0.1 || cx + cw > maxX + 0.1 || cy < minY - 0.1 || cy + ch > maxY + 0.1) {
          return false
        }
        const testBox: UnitPlanBox = { x: cx, y: cy, w: cw, h: ch }
        return !allObstacles.some((obs) => boxesOverlap(testBox, obs, MIN_GAP))
      }

      if (!isFreePosition(x, y)) {
        // Generate candidate slide positions flush against colliding obstacles or along single axes
        const candidates: { nx: number; ny: number; dist: number }[] = []

        if (prevValidBox) {
          // Try sliding horizontally only or vertically only
          if (isFreePosition(x, prevValidBox.y)) {
            candidates.push({
              nx: x,
              ny: prevValidBox.y,
              dist: Math.hypot(x - rawBox.x, prevValidBox.y - rawBox.y),
            })
          }
          if (isFreePosition(prevValidBox.x, y)) {
            candidates.push({
              nx: prevValidBox.x,
              ny: y,
              dist: Math.hypot(prevValidBox.x - rawBox.x, y - rawBox.y),
            })
          }
        }

        allObstacles.forEach((obs) => {
          if (!boxesOverlap({ x, y, w, h }, obs, MIN_GAP)) return
          const flushPositions = [
            { nx: obs.x - w - 0.3, ny: y },
            { nx: obs.x + obs.w + 0.3, ny: y },
            { nx: x, ny: obs.y - h - 0.3 },
            { nx: x, ny: obs.y + obs.h + 0.3 },
          ]
          flushPositions.forEach((fp) => {
            const clampedNx = Math.max(minX, Math.min(maxX - w, fp.nx))
            const clampedNy = Math.max(minY, Math.min(maxY - h, fp.ny))
            if (isFreePosition(clampedNx, clampedNy)) {
              candidates.push({
                nx: clampedNx,
                ny: clampedNy,
                dist: Math.hypot(clampedNx - x, clampedNy - y),
              })
            }
          })
        })

        if (candidates.length > 0) {
          candidates.sort((a, b) => a.dist - b.dist)
          x = candidates[0].nx
          y = candidates[0].ny
        } else if (allowGridRelocate || !prevValidBox) {
          const relocated = findNonOverlappingBox(
            { x, y, w, h },
            allObstacles,
            { minX, maxX, minY, maxY },
            0.3
          )
          x = relocated.x
          y = relocated.y
          w = relocated.w
          h = relocated.h
        } else {
          // Refuse to cross on top of an occupied box during live drag
          x = prevValidBox.x
          y = prevValidBox.y
        }
      }
    }

    return {
      x: Number(x.toFixed(1)),
      y: Number(y.toFixed(1)),
      w: Number(w.toFixed(1)),
      h: Number(h.toFixed(1)),
    }
  }

  // Compute true visual pixel dimensions for 1:1 (DAİRE 13 kare boyutu), 16:9, 9:16 presets based on canvas aspect ratio
  const getVisualPresetDimensions = (preset: UnitSizePreset): { w: number; h: number } => {
    const rect = canvasRef.current?.getBoundingClientRect()
    const canvasAspect =
      rect && rect.height > 0 ? Math.max(1.1, Math.min(2.2, rect.width / rect.height)) : 1.45

    if (preset === '1x1' || preset === 'square') {
      // Görseldeki DAİRE 13 kare boyutu
      const w = 9.2
      const h = Number(Math.max(12.5, Math.min(15.0, w * canvasAspect)).toFixed(1))
      return { w, h }
    }
    if (preset === '9x16' || preset === 'narrow-v') {
      const w = 6.8
      const h = Number(((w * 16) / 9 * canvasAspect).toFixed(1))
      return { w, h }
    }
    // '16x9' (or legacy horizontal)
    const w = 16.0
    const h = Number(((w * 9) / 16 * canvasAspect).toFixed(1))
    return { w, h }
  }

  // Apply one of the 3 Size Presets (1:1, 16:9, 9:16) to a Unit
  const handleApplyUnitSizePreset = (unit: FlatUnit, preset: UnitSizePreset, idxOnFloor: number) => {
    const currentBox =
      unit.planBox || getDefaultUnitPlanBox(idxOnFloor, floorUnits.length, layoutTemplate, unit.sizePreset)
    const dims = getVisualPresetDimensions(preset)
    const nextBox = clampBoxAvoidingFacades(
      {
        x: currentBox.x,
        y: currentBox.y,
        w: dims.w,
        h: dims.h,
      },
      'move',
      unit.id,
      true,
      true
    )
    projectStore.updateUnitPlanBox(project.id, unit.id, nextBox, preset)
    assignUnitToContainingBlockIfAny(unit.id, nextBox)
    onProjectUpdated()
  }

  // Apply one of the 3 Size Presets (1:1, 16:9, 9:16) to a Custom Area
  const handleApplyAreaSizePreset = (area: KrokiAreaItem, preset: UnitSizePreset) => {
    const dims = getVisualPresetDimensions(preset)
    const nextBox = clampBoxAvoidingFacades(
      {
        x: area.box.x,
        y: area.box.y,
        w: dims.w,
        h: dims.h,
      },
      'move',
      area.id,
      true,
      true
    )
    if (area.kind === 'block') {
      const children = captureBlockChildren(area.id, area.box)
      projectStore.updateCustomArea(project.id, area.id, { box: nextBox })
      applyBlockTransformToChildren(area.label, nextBox, children)
    } else {
      projectStore.updateCustomArea(project.id, area.id, { box: nextBox })
    }
    onProjectUpdated()
  }

  // Add Unit handler
  const handleCreateManualUnit = (e: React.FormEvent) => {
    e.preventDefault()

    // Mevcut dairelerin konumlarını sabitle ki yeni daire eklendiğinde kaymasınlar
    floorUnits.forEach((u, idx) => {
      if (!u.planBox) {
        const b = getDefaultUnitPlanBox(idx, floorUnits.length, layoutTemplate, u.sizePreset)
        projectStore.updateUnitPlanBox(project.id, u.id, b, u.sizePreset)
      }
    })

    const targetBlock =
      newUnitDraft.block.trim() || (selectedBlock !== 'ALL' ? selectedBlock : 'A Blok')
    const targetEntrance = newUnitDraft.entrance.trim() || 'A Giriş'
    const dims = UNIT_SIZE_PRESETS[newUnitDraft.sizePreset]
    const safeBox = clampBoxAvoidingFacades(
      {
        x: 10.0,
        y: 46.0,
        w: dims.w,
        h: dims.h,
      },
      'move',
      undefined,
      true,
      true
    )

    const res = projectStore.addUnitToFloor(project.id, selectedFloor, {
      unitNumber: newUnitDraft.unitNumber.trim() || `DAİRE ${floorUnits.length + 1}`,
      block: targetBlock,
      roomType: newUnitDraft.roomType,
      sizePreset: newUnitDraft.sizePreset,
      planBox: safeBox,
      price: Number(newUnitDraft.price) || 5500000,
      status: newUnitDraft.status,
      statusLabel: newUnitDraft.statusLabel,
    })
    if (res.success && res.unit) {
      if (targetEntrance) {
        projectStore.updateUnitDetails(project.id, res.unit.id, { entrance: targetEntrance })
      }
      if (selectedBlock !== 'ALL' && selectedBlock !== targetBlock) {
        setSelectedBlock('ALL')
      }
      setActiveUnitId(res.unit.id)
      setShowAddUnitForm(false)
      setNewUnitDraft((prev) => ({ ...prev, unitNumber: '' }))
      onProjectUpdated()
    }
  }

  // Add Custom Area handler
  const handleCreateManualArea = (e: React.FormEvent) => {
    e.preventDefault()
    const dims =
      newAreaDraft.kind === 'entrance'
        ? { w: 9.0, h: 6.5 }
        : UNIT_SIZE_PRESETS[newAreaDraft.sizePreset]
    const safeBox = clampBoxAvoidingFacades(
      {
        x: 38,
        y: 46,
        w: dims.w,
        h: dims.h,
      },
      'move',
      undefined,
      true,
      true
    )
    const res = projectStore.addCustomArea(project.id, {
      label: newAreaDraft.label.trim() || 'HAVUZ',
      kind: newAreaDraft.kind,
      direction: newAreaDraft.kind === 'entrance' ? newAreaDraft.direction : undefined,
      floor: newAreaDraft.allFloors ? 'ALL' : selectedFloor,
      box: safeBox,
    })
    if (res.success && res.area) {
      setActiveAreaId(res.area.id)
      setShowAddAreaForm(false)
      onProjectUpdated()
    }
  }

  // Add Block Container ("+ Blok" — daireleri içine alan blok çerçevesi ve isteğe bağlı düşey/yatay giriş)
  const handleCreateManualBlock = (e: React.FormEvent) => {
    e.preventDefault()
    const blockLabel = newBlockDraft.label.trim() || 'A Blok'
    const existingBlocksCount = (project.customAreas || []).filter((a) => a.kind === 'block').length
    const defaultBlockBox: UnitPlanBox =
      existingBlocksCount === 0
        ? { x: 6.5, y: 7.5, w: 86.0, h: 76.0 }
        : { x: 8.0, y: 42.0, w: 42.0, h: 44.0 }

    const res = projectStore.addCustomArea(project.id, {
      label: blockLabel,
      kind: 'block',
      floor: newBlockDraft.allFloors ? 'ALL' : selectedFloor,
      box: defaultBlockBox,
    })

    if (newBlockDraft.includeEntrance && newBlockDraft.entranceLabel.trim()) {
      const isVert = newBlockDraft.entranceVertical
      projectStore.addCustomArea(project.id, {
        label: newBlockDraft.entranceLabel.trim(),
        kind: 'entrance',
        textOrientation: isVert ? 'vertical' : 'horizontal',
        direction: isVert ? 'right' : 'up',
        floor: newBlockDraft.allFloors ? 'ALL' : selectedFloor,
        box: isVert
          ? {
              x: Number(Math.max(3.5, defaultBlockBox.x - 1.5).toFixed(1)),
              y: Number((defaultBlockBox.y + defaultBlockBox.h * 0.32).toFixed(1)),
              w: 5.2,
              h: 17.0,
            }
          : {
              x: Number((defaultBlockBox.x + defaultBlockBox.w * 0.42).toFixed(1)),
              y: Number(Math.min(86.0, defaultBlockBox.y + defaultBlockBox.h - 3.5).toFixed(1)),
              w: 10.0,
              h: 6.5,
            },
      })
    }

    if (res.success && res.area) {
      setActiveAreaId(res.area.id)
      setShowAddBlockForm(false)
      onProjectUpdated()
    }
  }

  // Add Movable Entrance ("+ Giriş" — düşey veya yatay yazı destekli, taşınabilir giriş alanı)
  const handleCreateManualEntrance = (e: React.FormEvent) => {
    e.preventDefault()
    const isVert = newEntranceDraft.textOrientation === 'vertical'
    const res = projectStore.addCustomArea(project.id, {
      label: newEntranceDraft.label.trim() || 'A Giriş',
      kind: 'entrance',
      textOrientation: newEntranceDraft.textOrientation,
      direction: newEntranceDraft.direction,
      floor: newEntranceDraft.allFloors ? 'ALL' : selectedFloor,
      box: isVert
        ? { x: 6.5, y: 34.0, w: 5.2, h: 17.5 }
        : { x: 45.0, y: 36.5, w: 9.5, h: 6.5 },
    })
    if (res.success && res.area) {
      setActiveAreaId(res.area.id)
      setShowAddEntranceForm(false)
      onProjectUpdated()
    }
  }

  // Add Custom Facade handler
  const handleCreateManualFacade = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFacadeDraft.label.trim()) return
    const next: KrokiFacadeItem[] = [
      ...customFacades,
      {
        id: `fac-${Date.now()}`,
        label: newFacadeDraft.label.trim(),
        edge: newFacadeDraft.edge,
      },
    ]
    projectStore.updateCustomFacades(project.id, next)
    setNewFacadeDraft({ label: '', edge: newFacadeDraft.edge })
    onProjectUpdated()
  }

  const handleDeleteFacade = (facadeId: string) => {
    const next = customFacades.filter((f) => f.id !== facadeId)
    projectStore.updateCustomFacades(project.id, next)
    onProjectUpdated()
  }

  const handleSaveFacadeEdit = (facadeId: string) => {
    if (!editingFacadeText.trim()) {
      setEditingFacadeId(null)
      return
    }
    const next = customFacades.map((f) =>
      f.id === facadeId ? { ...f, label: editingFacadeText.trim() } : f
    )
    projectStore.updateCustomFacades(project.id, next)
    setEditingFacadeId(null)
    onProjectUpdated()
  }

  // Change an existing facade's predefined compass position (Kuzey, Güney, Batı, Doğu, KB, KD, GB, GD)
  const handleChangeFacadeEdge = (facadeId: string, newEdge: FacadeEdge) => {
    const next = customFacades.map((f) => (f.id === facadeId ? { ...f, edge: newEdge } : f))
    projectStore.updateCustomFacades(project.id, next)
    onProjectUpdated()
  }

  // Quick toggle for standard 8 cardinal & intercardinal directions
  const handleQuickToggleCompassFacade = (edge: FacadeEdge) => {
    const cfg = FACADE_EDGE_CONFIG[edge]
    const existing = customFacades.find(
      (f) => f.edge === edge && f.label.toLowerCase() === cfg.compassName.toLowerCase()
    )
    const next = existing
      ? customFacades.filter((f) => f.id !== existing.id)
      : [
          ...customFacades,
          {
            id: `fac-${edge}-${Date.now()}`,
            label: cfg.compassName,
            edge,
          },
        ]
    projectStore.updateCustomFacades(project.id, next)
    onProjectUpdated()
  }

  // Toggle / Add / Remove facade direction on a unit
  const handleToggleUnitFacadeTag = (tag: string, targetUnitOverride?: FlatUnit) => {
    const target = targetUnitOverride || activeUnit
    if (!target) return
    const currentParts = (target.facade || '')
      .split(/[,•/|-]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    const exists = currentParts.some((p) => p.toLowerCase() === tag.toLowerCase())
    const nextParts = exists
      ? currentParts.filter((p) => p.toLowerCase() !== tag.toLowerCase())
      : [...currentParts, tag]
    projectStore.updateUnitDetails(project.id, target.id, {
      facade: nextParts.join(' • '),
    })
    onProjectUpdated()
  }

  // Pointer / Touch move & up for moving and Apple-widget-style resizing
  useEffect(() => {
    if (!interactionState || !isLayoutEditMode) return

    const updateSnapGuidesForBox = (box: UnitPlanBox, excludeId: string, isFree: boolean) => {
      if (isFree) {
        setSnapGuides({ xLines: [], yLines: [] })
        return
      }
      const xSet = new Set<number>()
      const ySet = new Set<number>()
      const siblings: UnitPlanBox[] = []

      floorUnits.forEach((u, idx) => {
        if (u.id === excludeId) return
        siblings.push(
          u.planBox || getDefaultUnitPlanBox(idx, floorUnits.length, layoutTemplate, u.sizePreset)
        )
      })
      floorAreas.forEach((a) => {
        if (a.id === excludeId) return
        if (a.kind === 'block') return
        siblings.push(a.box)
      })

      const myCenterX = box.x + box.w / 2
      const myCenterY = box.y + box.h / 2
      const myXEdges = [box.x, box.x + box.w, myCenterX]
      const myYEdges = [box.y, box.y + box.h, myCenterY]

      if (Math.abs(myCenterX - 50) <= 0.25) xSet.add(50)
      if (Math.abs(myCenterY - 50) <= 0.25) ySet.add(50)

      // Single sibling guide lines
      siblings.forEach((sb) => {
        const sbXEdges = [sb.x, sb.x + sb.w, sb.x + sb.w / 2]
        const sbYEdges = [sb.y, sb.y + sb.h, sb.y + sb.h / 2]

        myXEdges.forEach((mx) => {
          sbXEdges.forEach((sx) => {
            if (Math.abs(mx - sx) <= 0.25) {
              xSet.add(Number(sx.toFixed(1)))
            }
          })
        })

        myYEdges.forEach((my) => {
          sbYEdges.forEach((sy) => {
            if (Math.abs(my - sy) <= 0.25) {
              ySet.add(Number(sy.toFixed(1)))
            }
          })
        })
      })

      // Pairwise center guide lines (shows center line when centered under/above/between two items)
      for (let i = 0; i < siblings.length; i++) {
        for (let j = i + 1; j < siblings.length; j++) {
          const sb1 = siblings[i]
          const sb2 = siblings[j]

          const pairSpanCenterX = (Math.min(sb1.x, sb2.x) + Math.max(sb1.x + sb1.w, sb2.x + sb2.w)) / 2
          const pairMidCenterX = ((sb1.x + sb1.w / 2) + (sb2.x + sb2.w / 2)) / 2
          if (Math.abs(myCenterX - pairSpanCenterX) <= 0.25) {
            xSet.add(Number(pairSpanCenterX.toFixed(1)))
          } else if (Math.abs(myCenterX - pairMidCenterX) <= 0.25) {
            xSet.add(Number(pairMidCenterX.toFixed(1)))
          }

          const pairSpanCenterY = (Math.min(sb1.y, sb2.y) + Math.max(sb1.y + sb1.h, sb2.y + sb2.h)) / 2
          const pairMidCenterY = ((sb1.y + sb1.h / 2) + (sb2.y + sb2.h / 2)) / 2
          if (Math.abs(myCenterY - pairSpanCenterY) <= 0.25) {
            ySet.add(Number(pairSpanCenterY.toFixed(1)))
          } else if (Math.abs(myCenterY - pairMidCenterY) <= 0.25) {
            ySet.add(Number(pairMidCenterY.toFixed(1)))
          }
        }
      }

      setSnapGuides({
        xLines: Array.from(xSet),
        yLines: Array.from(ySet),
      })
    }

    const handleMove = (clientX: number, clientY: number, ctrlHeld = false) => {
      if (!canvasRef.current) return
      const rect = canvasRef.current.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return

      const isFree = Boolean(ctrlHeld || isFreeMoveMode || isCtrlPressed)
      const dxPct = ((clientX - interactionState.startX) / rect.width) * 100
      const dyPct = ((clientY - interactionState.startY) / rect.height) * 100
      const init = interactionState.initialBox

      if (interactionState.mode === 'move') {
        const nextBox = clampBoxAvoidingFacades(
          {
            ...init,
            x: init.x + dxPct,
            y: init.y + dyPct,
          },
          'move',
          interactionState.targetId,
          !isFree,
          false,
          isFree
        )

        updateSnapGuidesForBox(nextBox, interactionState.targetId, isFree)

        if (interactionState.targetType === 'unit') {
          projectStore.updateUnitPlanBox(project.id, interactionState.targetId, nextBox)
          assignUnitToContainingBlockIfAny(interactionState.targetId, nextBox)
        } else {
          projectStore.updateCustomArea(project.id, interactionState.targetId, { box: nextBox })
          if (interactionState.blockChildren && interactionState.blockChildren.length > 0) {
            const targetBlk = floorAreas.find((a) => a.id === interactionState.targetId)
            applyBlockTransformToChildren(
              targetBlk?.label || 'A Blok',
              nextBox,
              interactionState.blockChildren
            )
          }
        }
        onProjectUpdated()
      } else {
        // Apple Widget Bottom-Right Corner Resize
        const nextBox = clampBoxAvoidingFacades(
          {
            ...init,
            w: init.w + dxPct,
            h: init.h + dyPct,
          },
          'resize',
          interactionState.targetId,
          !isFree,
          false,
          isFree
        )

        updateSnapGuidesForBox(nextBox, interactionState.targetId, isFree)

        if (interactionState.targetType === 'unit') {
          const detectedPreset = inferSizePresetFromBox(nextBox)
          projectStore.updateUnitPlanBox(
            project.id,
            interactionState.targetId,
            nextBox,
            detectedPreset
          )
          assignUnitToContainingBlockIfAny(interactionState.targetId, nextBox)
        } else {
          projectStore.updateCustomArea(project.id, interactionState.targetId, { box: nextBox })
          if (interactionState.blockChildren && interactionState.blockChildren.length > 0) {
            const targetBlk = floorAreas.find((a) => a.id === interactionState.targetId)
            applyBlockTransformToChildren(
              targetBlk?.label || 'A Blok',
              nextBox,
              interactionState.blockChildren
            )
          }
        }
        onProjectUpdated()
      }
    }

    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY, e.ctrlKey || e.metaKey)
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY)
      }
    }
    const onEnd = () => {
      setInteractionState(null)
      setSnapGuides({ xLines: [], yLines: [] })
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onEnd)
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onEnd)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onEnd)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onEnd)
    }
  }, [interactionState, project.id, project.paymentBanner, customFacades, isLayoutEditMode, isFreeMoveMode, isCtrlPressed, onProjectUpdated])

  // Render Apple iOS/macOS Widget-style curved bottom-right corner handle
  // Card has rounded-[18px] and border-2 (inner corner radius = 16px, center at 16px from bottom-right).
  // Placing a 16x16 SVG at bottom-0 right-0 puts the card's corner curvature center at (0, 0) in SVG space,
  // so an arc centered at (0, 0) with radius 13.2 is 100% concentric with the apartment card's corner radius.
  const renderAppleCornerResizeHandle = (
    targetType: 'unit' | 'area',
    targetId: string,
    currentBox: UnitPlanBox
  ) =>
    !isLayoutEditMode ? null : (
    <div
      onMouseDown={(e) => {
        if (e.button !== 0) return
        e.stopPropagation()
        if (targetType === 'unit') setActiveUnitId(targetId)
        else setActiveAreaId(targetId)
        const targetAreaObj =
          targetType === 'area' ? floorAreas.find((a) => a.id === targetId) : undefined
        const blockChildren =
          targetAreaObj && targetAreaObj.kind === 'block'
            ? captureBlockChildren(targetAreaObj.id, currentBox)
            : undefined
        setInteractionState({
          targetType,
          targetId,
          mode: 'resize',
          startX: e.clientX,
          startY: e.clientY,
          initialBox: currentBox,
          blockChildren,
        })
      }}
      onTouchStart={(e) => {
        e.stopPropagation()
        if (e.touches.length === 0) return
        if (targetType === 'unit') setActiveUnitId(targetId)
        else setActiveAreaId(targetId)
        const targetAreaObj =
          targetType === 'area' ? floorAreas.find((a) => a.id === targetId) : undefined
        const blockChildren =
          targetAreaObj && targetAreaObj.kind === 'block'
            ? captureBlockChildren(targetAreaObj.id, currentBox)
            : undefined
        setInteractionState({
          targetType,
          targetId,
          mode: 'resize',
          startX: e.touches[0].clientX,
          startY: e.touches[0].clientY,
          initialBox: currentBox,
          blockChildren,
        })
      }}
      className="absolute bottom-0 right-0 w-6 h-6 rounded-br-[16px] flex items-end justify-end cursor-nwse-resize z-30 group/handle select-none touch-none"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        className="text-[#5c6ac4] opacity-85 group-hover/handle:opacity-100 transition-opacity pointer-events-none"
      >
        <path
          d="M 2.6 12.9 A 13.2 13.2 0 0 0 12.9 2.6"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )

  return (
    <div className="space-y-2 pb-2.5">
      {/* ÜST ARAÇ ÇUBUĞU: Blok/Giriş Seçimi + Mimari Şablon + Belge Yükle + Düzenle Modu */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Sol: Giriş/Blok Sekmeleri + Mimari Dizilim Şablonları */}
        <div className="flex flex-wrap items-center gap-2">
          {blocks.length > 1 && (
            <div className="inline-flex items-center gap-1 bg-[#282522] p-1 rounded-full border border-[#4a443f]">
              <button
                type="button"
                onClick={() => setSelectedBlock('ALL')}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                  selectedBlock === 'ALL'
                    ? 'bg-[#b99881] text-white'
                    : 'text-[#a69f99] hover:text-white'
                }`}
              >
                Tüm Plan
              </button>
              {blocks.map((b) => {
                const isActive = b === selectedBlock
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setSelectedBlock(b)}
                    className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#b99881] text-white'
                        : 'text-[#a69f99] hover:text-white'
                    }`}
                  >
                    {b}
                  </button>
                )
              })}
            </div>
          )}

          {/* Tepebakış Görünüm Etiketi */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="px-3.5 py-1.5 rounded-full text-[11px] font-semibold bg-[#b99881] text-white">
              Tepebakış
            </span>
          </div>
        </div>

        {/* Sağ: Plan Yükle + Sıfırla (önce) + Düzenlemeyi Bitir (en sağda) */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputUniversalRef}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,image/*"
            className="hidden"
            onChange={handleUniversalDocumentUpload}
          />
          <input
            ref={fileInputFloorRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUploadFloorSpecific}
          />

          {isLayoutEditMode && (
            <>
              <button
                type="button"
                onClick={() => fileInputUniversalRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#b99881] text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
                title="Plan Yükle"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>
                  {isParsingDoc ? 'Plan Okunuyor...' : 'Plan Yükle'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => fileInputFloorRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#34302d] hover:bg-[#3d3733] text-xs font-medium text-[#f3efe9] transition-colors cursor-pointer"
                title="İsteğe bağlı özel kat planı görsel altlığı yükle"
              >
                <Upload className="w-3.5 h-3.5 text-[#b99881]" />
                <span>{specificFloorPlan ? 'Kat Altlığını Değiştir' : 'Kat Altlığı Yükle'}</span>
              </button>

              {activeFloorPlanUrl && (
                <button
                  type="button"
                  onClick={() => handleRemovePlan(specificFloorPlan ? floorKey : 'DEFAULT')}
                  className="p-2 rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
                  title="Yüklü Kat Planı Görselini Kaldır"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Sıfırla butonu Düzenlemeyi Bitir'den önce çıkar */}
              <button
                type="button"
                onClick={handleResetFloorBoxes}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#34302d] text-[11px] font-medium text-[#a69f99] hover:text-white cursor-pointer"
                title="Bu kattaki daire konumlarını varsayılan şablona sıfırla"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Sıfırla</span>
              </button>

              {/* SERBEST MOD (FREE MODE / CTRL) BUTONU */}
              <button
                type="button"
                onClick={() => setIsFreeMoveMode(!isFreeMoveMode)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  isFreeMoveMode || isCtrlPressed
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-[#34302d] text-[#a69f99] hover:text-white border border-[#4a443f]'
                }`}
                title="Ctrl tuşuna basılı tutarak veya bu butonla mıknatısı kapatıp Serbest Taşıma (Free Mod) açabilirsiniz"
              >
                <span>{isFreeMoveMode || isCtrlPressed ? 'Serbest Mod (Free): Açık' : 'Mıknatıs Aktif (Ctrl: Free Mod)'}</span>
              </button>
            </>
          )}

          {/* DÜZENLE / DÜZENLEMEYİ BİTİR Butonu (En Sağda - Ctrl ile basıldığında doğrudan Free Mod ile açılır) */}
          <button
            type="button"
            onClick={(e) => {
              const nextMode = !isLayoutEditMode
              setIsLayoutEditMode(nextMode)
              if (nextMode && (e.ctrlKey || e.metaKey || isCtrlPressed)) {
                setIsFreeMoveMode(true)
              } else if (!nextMode) {
                setIsFreeMoveMode(false)
                setInteractionState(null)
                setActiveAreaId(null)
              }
              closeAllEditForms()
              setUnitContextMenu(null)
              setAreaContextMenu(null)
            }}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              isLayoutEditMode
                ? 'bg-[#b99881] text-white shadow-sm'
                : 'bg-[#34302d] text-[#f3efe9] hover:text-white'
            }`}
            title="Kat planı yerleşimini düzenle (Ctrl'ye basarak tıklarsanız doğrudan Free Mod açılır)"
          >
            {isLayoutEditMode ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Düzenlemeyi Bitir</span>
              </>
            ) : (
              <>
                <Edit2 className="w-3.5 h-3.5 text-[#b99881]" />
                <span>Düzenle</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ÜST DÜZENLEME MENÜSÜ: Dış katman korunur, iç buton katmanları kaldırıldı */}
      <AnimatePresence>
        {isLayoutEditMode && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="space-y-2"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex flex-wrap items-center gap-1 px-2.5 py-1 rounded-full bg-[#282522] border border-[#4a443f]">
                <button
                  type="button"
                  onClick={() => {
                    const next = !showAddUnitForm
                    closeAllEditForms()
                    setShowAddUnitForm(next)
                  }}
                  className={`no-layer-btn inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer bg-transparent border-none shadow-none ${
                    showAddUnitForm
                      ? 'text-[#d6beae]'
                      : 'text-[#f3efe9] hover:text-white'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5 text-[#b99881]" />
                  <span>Daire</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const next = !showAddAreaForm
                    closeAllEditForms()
                    setShowAddAreaForm(next)
                  }}
                  className={`no-layer-btn inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer bg-transparent border-none shadow-none ${
                    showAddAreaForm
                      ? 'text-[#d6beae]'
                      : 'text-[#f3efe9] hover:text-white'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5 text-[#b99881]" />
                  <span>Alan</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const next = !showAddFacadeForm
                    closeAllEditForms()
                    setShowAddFacadeForm(next)
                  }}
                  className={`no-layer-btn inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer bg-transparent border-none shadow-none ${
                    showAddFacadeForm
                      ? 'text-[#d6beae]'
                      : 'text-[#f3efe9] hover:text-white'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5 text-[#b99881]" />
                  <span>Cephe</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const next = !showAddBlockForm
                    closeAllEditForms()
                    setShowAddBlockForm(next)
                  }}
                  className={`no-layer-btn inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer bg-transparent border-none shadow-none ${
                    showAddBlockForm
                      ? 'text-[#d6beae]'
                      : 'text-[#f3efe9] hover:text-white'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5 text-[#b99881]" />
                  <span>Blok</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const next = !showAddEntranceForm
                    closeAllEditForms()
                    setShowAddEntranceForm(next)
                  }}
                  className={`no-layer-btn inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer bg-transparent border-none shadow-none ${
                    showAddEntranceForm
                      ? 'text-[#d6beae]'
                      : 'text-[#f3efe9] hover:text-white'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5 text-[#b99881]" />
                  <span>Giriş</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const next = !showAddFooterInfoForm
                    closeAllEditForms()
                    setShowAddFooterInfoForm(next)
                  }}
                  className={`no-layer-btn inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer bg-transparent border-none shadow-none ${
                    showAddFooterInfoForm
                      ? 'text-[#d6beae]'
                      : 'text-[#f3efe9] hover:text-white'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5 text-[#b99881]" />
                  <span>Alt Bilgi</span>
                </button>
              </div>

              {/* KAT İÇİN HAZIR DAİRE SAYISI SEÇENEKLERİ: 4, 5, 6, 8, 12 */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#282522] border border-[#4a443f]">
                <span className="text-[11px] font-semibold text-[#a69f99] mr-0.5">
                  Kat Hazır Daire:
                </span>
                {([4, 5, 6, 8, 12] as const).map((presetCnt) => {
                  const isCurrentCount = floorUnits.length === presetCnt
                  return (
                    <button
                      key={presetCnt}
                      type="button"
                      onClick={() => {
                        projectStore.applyFloorReadyUnits(
                          project.id,
                          selectedFloor,
                          presetCnt,
                          selectedBlock !== 'ALL' ? selectedBlock : 'A Blok'
                        )
                        onProjectUpdated()
                      }}
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                        isCurrentCount
                          ? 'bg-[#b99881] text-white shadow-2xs'
                          : 'bg-[#34302d] text-[#f3efe9] hover:bg-[#b99881]/25 hover:text-white'
                      }`}
                      title={`Bu kat için ${presetCnt} hazır daire oluştur`}
                    >
                      {presetCnt}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* + DAİRE FORMU */}
            {showAddUnitForm && (
              <form
                onSubmit={handleCreateManualUnit}
                className="p-3 rounded-2xl bg-[#34302d] grid grid-cols-2 sm:grid-cols-7 gap-2.5 items-end"
              >
                <div>
                  <label className="block text-[10.5px] font-semibold text-[#a69f99] mb-1">
                    Daire Adı / No
                  </label>
                  <input
                    type="text"
                    placeholder={`DAİRE ${floorUnits.length + 1}`}
                    value={newUnitDraft.unitNumber}
                    onChange={(e) =>
                      setNewUnitDraft({ ...newUnitDraft, unitNumber: e.target.value })
                    }
                    className="w-full px-3 py-1.5 rounded-full bg-[#282522] border border-[#4a443f] text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10.5px] font-semibold text-[#a69f99] mb-1">
                    Blok
                  </label>
                  <input
                    type="text"
                    placeholder="Örn: A Blok, B Blok"
                    value={newUnitDraft.block}
                    onChange={(e) => setNewUnitDraft({ ...newUnitDraft, block: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-full bg-[#282522] border border-[#4a443f] text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10.5px] font-semibold text-[#a69f99] mb-1">
                    Giriş
                  </label>
                  <input
                    type="text"
                    placeholder="Örn: A Giriş, B Giriş"
                    value={newUnitDraft.entrance}
                    onChange={(e) => setNewUnitDraft({ ...newUnitDraft, entrance: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-full bg-[#282522] border border-[#4a443f] text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10.5px] font-semibold text-[#a69f99] mb-1">
                    Oda Tipi
                  </label>
                  <select
                    value={newUnitDraft.roomType}
                    onChange={(e) =>
                      setNewUnitDraft({ ...newUnitDraft, roomType: e.target.value as RoomType })
                    }
                    className="w-full px-3 py-1.5 rounded-full bg-[#282522] border border-[#4a443f] text-xs text-white focus:outline-none cursor-pointer"
                  >
                    <option value="1+1">1+1</option>
                    <option value="2+1">2+1</option>
                    <option value="3+1">3+1</option>
                    <option value="4+1">4+1</option>
                    <option value="Villa">Villa</option>
                    <option value="Ticari">Ticari / Dükkan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10.5px] font-semibold text-[#a69f99] mb-1">
                    Plan Ölçeği
                  </label>
                  <select
                    value={newUnitDraft.sizePreset}
                    onChange={(e) =>
                      setNewUnitDraft({
                        ...newUnitDraft,
                        sizePreset: e.target.value as UnitSizePreset,
                      })
                    }
                    className="w-full px-3 py-1.5 rounded-full bg-[#282522] border border-[#4a443f] text-xs text-white focus:outline-none cursor-pointer"
                  >
                    {SELECTABLE_SIZE_PRESETS.map((k) => (
                      <option key={k} value={k}>
                        {UNIT_SIZE_PRESETS[k].label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10.5px] font-semibold text-[#a69f99] mb-1">
                    Durum / Etiket
                  </label>
                  <select
                    value={newUnitDraft.statusLabel}
                    onChange={(e) => {
                      const lbl = e.target.value
                      const st: FlatStatus =
                        lbl === 'SATILDI' || lbl === 'KAPALI'
                          ? 'SATILDI'
                          : lbl === 'Kapora Alındı' || lbl === 'Peşinat Alındı' || lbl === 'Rezerve'
                          ? 'REZERVE'
                          : 'SATISTA'
                      setNewUnitDraft({ ...newUnitDraft, status: st, statusLabel: lbl })
                    }}
                    className="w-full px-3 py-1.5 rounded-full bg-[#282522] border border-[#4a443f] text-xs text-white focus:outline-none cursor-pointer"
                  >
                    <option value="Satışta">Satışta (Hafif Şeffaf Yeşil)</option>
                    <option value="Kapora Alındı">Kapora / Peşinat (Navy Lacivert)</option>
                    <option value="Rezerve">Rezerve (Navy Lacivert)</option>
                    <option value="SATILDI">SATILDI (Kırmızı)</option>
                    <option value="KAPALI">KAPALI (Kırmızı)</option>
                  </select>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="submit"
                    className="flex-1 py-1.5 px-3 rounded-full bg-[#b99881] text-white text-xs font-semibold cursor-pointer"
                  >
                    Ekle
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddUnitForm(false)}
                    className="p-1.5 rounded-full bg-[#282522] text-[#a69f99] hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            )}

            {/* + ALAN FORMU (Havuz, Bahçe, Otopark, Koridor vb.) */}
            {showAddAreaForm && (
              <form
                onSubmit={handleCreateManualArea}
                className="p-3 rounded-2xl bg-[#34302d] grid grid-cols-2 sm:grid-cols-6 gap-2.5 items-end"
              >
                <div>
                  <label className="block text-[10.5px] font-semibold text-[#a69f99] mb-1">
                    Alan Türü
                  </label>
                  <select
                    value={newAreaDraft.kind}
                    onChange={(e) => {
                      const k = e.target.value as KrokiAreaKind
                      const defaultLbl =
                        k === 'pool'
                          ? 'HAVUZ'
                          : k === 'garden'
                          ? 'BAHÇE & PEYZAJ'
                          : k === 'parking'
                          ? 'OTOPARK'
                          : k === 'corridor'
                          ? 'MERDİVEN & HOL'
                          : 'SOSYAL ALAN'
                      setNewAreaDraft({ ...newAreaDraft, kind: k, label: defaultLbl })
                    }}
                    className="w-full px-3 py-1.5 rounded-full bg-[#282522] border border-[#4a443f] text-xs text-white focus:outline-none cursor-pointer"
                  >
                    <option value="pool">Havuz Alanı</option>
                    <option value="garden">Bahçe / Peyzaj</option>
                    <option value="parking">Otopark</option>
                    <option value="corridor">Merdiven / Koridor</option>
                    <option value="custom">Özel Alan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10.5px] font-semibold text-[#a69f99] mb-1">
                    Alan Başlığı
                  </label>
                  <input
                    type="text"
                    value={newAreaDraft.label}
                    onChange={(e) => setNewAreaDraft({ ...newAreaDraft, label: e.target.value })}
                    placeholder="Örn: HAVUZ, BAHÇE"
                    className="w-full px-3 py-1.5 rounded-full bg-[#282522] border border-[#4a443f] text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10.5px] font-semibold text-[#a69f99] mb-1">
                    Plan Ölçeği
                  </label>
                  <select
                    value={newAreaDraft.sizePreset}
                    onChange={(e) =>
                      setNewAreaDraft({
                        ...newAreaDraft,
                        sizePreset: e.target.value as UnitSizePreset,
                      })
                    }
                    className="w-full px-3 py-1.5 rounded-full bg-[#282522] border border-[#4a443f] text-xs text-white focus:outline-none cursor-pointer"
                  >
                    {SELECTABLE_SIZE_PRESETS.map((k) => (
                      <option key={k} value={k}>
                        {UNIT_SIZE_PRESETS[k].label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2 flex items-center gap-2 pt-3">
                  <label className="inline-flex items-center gap-1.5 text-xs text-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newAreaDraft.allFloors}
                      onChange={(e) =>
                        setNewAreaDraft({ ...newAreaDraft, allFloors: e.target.checked })
                      }
                      className="rounded"
                    />
                    <span>Tüm katlarda ortak göster</span>
                  </label>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="submit"
                    className="flex-1 py-1.5 px-3 rounded-full bg-[#b99881] text-white text-xs font-semibold cursor-pointer"
                  >
                    Ekle
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddAreaForm(false)}
                    className="p-1.5 rounded-full bg-[#282522] text-[#a69f99] hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            )}

            {/* + BLOK FORMU (Daireleri içine alan blok konteyneri + isteğe bağlı düşey/yatay giriş yazısı) */}
            {showAddBlockForm && (
              <form
                onSubmit={handleCreateManualBlock}
                className="p-3 rounded-2xl bg-[#34302d] grid grid-cols-2 sm:grid-cols-6 gap-2.5 items-end"
              >
                <div>
                  <label className="block text-[10.5px] font-semibold text-[#a69f99] mb-1">
                    Blok Adı
                  </label>
                  <input
                    type="text"
                    value={newBlockDraft.label}
                    onChange={(e) => setNewBlockDraft({ ...newBlockDraft, label: e.target.value })}
                    placeholder="Örn: A Blok, B Blok"
                    className="w-full px-3 py-1.5 rounded-full bg-[#282522] border border-[#4a443f] text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10.5px] font-semibold text-[#a69f99] mb-1">
                    Giriş Yazısı (İsteğe Bağlı)
                  </label>
                  <input
                    type="text"
                    value={newBlockDraft.entranceLabel}
                    onChange={(e) =>
                      setNewBlockDraft({
                        ...newBlockDraft,
                        entranceLabel: e.target.value,
                        includeEntrance: Boolean(e.target.value.trim()),
                      })
                    }
                    placeholder="Örn: A Giriş, B Giriş"
                    className="w-full px-3 py-1.5 rounded-full bg-[#282522] border border-[#4a443f] text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10.5px] font-semibold text-[#a69f99] mb-1">
                    Giriş Yazı Yönü
                  </label>
                  <select
                    value={newBlockDraft.entranceVertical ? 'vertical' : 'horizontal'}
                    onChange={(e) =>
                      setNewBlockDraft({
                        ...newBlockDraft,
                        entranceVertical: e.target.value === 'vertical',
                      })
                    }
                    className="w-full px-3 py-1.5 rounded-full bg-[#282522] border border-[#4a443f] text-xs text-white focus:outline-none cursor-pointer"
                  >
                    <option value="vertical">Düşey Yazı (Dikey)</option>
                    <option value="horizontal">Yatay Yazı</option>
                  </select>
                </div>
                <div className="col-span-2 flex items-center gap-3 pt-3">
                  <label className="inline-flex items-center gap-1.5 text-xs text-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newBlockDraft.allFloors}
                      onChange={(e) =>
                        setNewBlockDraft({ ...newBlockDraft, allFloors: e.target.checked })
                      }
                      className="rounded"
                    />
                    <span>Tüm katlarda ortak göster</span>
                  </label>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="submit"
                    className="flex-1 py-1.5 px-3 rounded-full bg-[#b99881] text-white text-xs font-semibold cursor-pointer"
                  >
                    Ekle
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddBlockForm(false)}
                    className="p-1.5 rounded-full bg-[#282522] text-[#a69f99] hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            )}

            {/* + GİRİŞ FORMU (Düşey yazı veya yatay yazı seçenekli, taşınabilir giriş alanı) */}
            {showAddEntranceForm && (
              <form
                onSubmit={handleCreateManualEntrance}
                className="p-3 rounded-2xl bg-[#34302d] grid grid-cols-2 sm:grid-cols-6 gap-2.5 items-end"
              >
                <div>
                  <label className="block text-[10.5px] font-semibold text-[#a69f99] mb-1">
                    Giriş Yazısı
                  </label>
                  <input
                    type="text"
                    value={newEntranceDraft.label}
                    onChange={(e) =>
                      setNewEntranceDraft({ ...newEntranceDraft, label: e.target.value })
                    }
                    placeholder="Örn: A Giriş, B Giriş"
                    className="w-full px-3 py-1.5 rounded-full bg-[#282522] border border-[#4a443f] text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10.5px] font-semibold text-[#a69f99] mb-1">
                    Yazı Yönü
                  </label>
                  <select
                    value={newEntranceDraft.textOrientation}
                    onChange={(e) =>
                      setNewEntranceDraft({
                        ...newEntranceDraft,
                        textOrientation: e.target.value as 'horizontal' | 'vertical',
                      })
                    }
                    className="w-full px-3 py-1.5 rounded-full bg-[#282522] border border-[#4a443f] text-xs text-white focus:outline-none cursor-pointer"
                  >
                    <option value="vertical">Düşey Yazı (Dikey)</option>
                    <option value="horizontal">Yatay Yazı</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10.5px] font-semibold text-[#a69f99] mb-1">
                    Ok Yönü
                  </label>
                  <select
                    value={newEntranceDraft.direction}
                    onChange={(e) =>
                      setNewEntranceDraft({
                        ...newEntranceDraft,
                        direction: e.target.value as 'up' | 'down' | 'left' | 'right',
                      })
                    }
                    className="w-full px-3 py-1.5 rounded-full bg-[#282522] border border-[#4a443f] text-xs text-white focus:outline-none cursor-pointer"
                  >
                    <option value="up">Yukarı Ok (↑)</option>
                    <option value="right">Sağa Ok (→)</option>
                    <option value="down">Aşağı Ok (↓)</option>
                    <option value="left">Sola Ok (←)</option>
                  </select>
                </div>
                <div className="col-span-2 flex items-center gap-2 pt-3">
                  <label className="inline-flex items-center gap-1.5 text-xs text-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newEntranceDraft.allFloors}
                      onChange={(e) =>
                        setNewEntranceDraft({ ...newEntranceDraft, allFloors: e.target.checked })
                      }
                      className="rounded"
                    />
                    <span>Tüm katlarda ortak göster</span>
                  </label>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="submit"
                    className="flex-1 py-1.5 px-3 rounded-full bg-[#b99881] text-white text-xs font-semibold cursor-pointer"
                  >
                    Ekle
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddEntranceForm(false)}
                    className="p-1.5 rounded-full bg-[#282522] text-[#a69f99] hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            )}

            {/* + CEPHE EKLE / ÇIKAR / DÜZENLE FORMU (8 Sabit Ana ve Ara Yön Konumu) */}
            {showAddFacadeForm && (
              <div className="p-3 rounded-2xl bg-[#34302d] space-y-3">
                {/* Hızlı 8 Yön ve Ara Yön Seçici (Kuzey, Güney, Batı, Doğu ve Köşe Ara Yönler) */}
                <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-[#4a443f]/50">
                  <span className="text-[10.5px] font-semibold text-[#a69f99] mr-1">
                    Sabit Yön & Ara Yönler:
                  </span>
                  {ALL_FACADE_EDGES.map((edgeKey) => {
                    const cfg = FACADE_EDGE_CONFIG[edgeKey]
                    const isActive = customFacades.some(
                      (f) =>
                        f.edge === edgeKey &&
                        f.label.toLowerCase() === cfg.compassName.toLowerCase()
                    )
                    return (
                      <button
                        key={edgeKey}
                        type="button"
                        onClick={() => handleQuickToggleCompassFacade(edgeKey)}
                        className={`px-2.5 py-1 rounded-full text-[10.5px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                          isActive
                            ? 'bg-[#b99881] text-white shadow-2xs'
                            : 'bg-[#282522] text-[#a69f99] hover:text-white border border-[#4a443f]'
                        }`}
                        title={`${cfg.fullOptionLabel} yönünü aç/kapat`}
                      >
                        <span>{cfg.arrow}</span>
                        <span>{cfg.compassName}</span>
                      </button>
                    )
                  })}
                </div>

                <form
                  onSubmit={handleCreateManualFacade}
                  className="flex flex-wrap items-end gap-2.5"
                >
                  <div className="flex-1 min-w-[180px]">
                    <label className="block text-[10.5px] font-semibold text-[#a69f99] mb-1">
                      Özel Cephe Adı Ekle
                    </label>
                    <input
                      type="text"
                      value={newFacadeDraft.label}
                      onChange={(e) =>
                        setNewFacadeDraft({ ...newFacadeDraft, label: e.target.value })
                      }
                      placeholder="Örn: Deniz Cephesi, Havuz Cephesi, Cadde, Peyzaj..."
                      className="w-full px-3 py-1.5 rounded-full bg-[#282522] border border-[#4a443f] text-xs text-white focus:outline-none"
                    />
                  </div>
                  <div className="w-56">
                    <label className="block text-[10.5px] font-semibold text-[#a69f99] mb-1">
                      Sabit Kroki Konumu (Yön / Köşe)
                    </label>
                    <select
                      value={newFacadeDraft.edge}
                      onChange={(e) =>
                        setNewFacadeDraft({
                          ...newFacadeDraft,
                          edge: e.target.value as FacadeEdge,
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-full bg-[#282522] border border-[#4a443f] text-xs text-white focus:outline-none cursor-pointer"
                    >
                      {ALL_FACADE_EDGES.map((edgeKey) => (
                        <option key={edgeKey} value={edgeKey}>
                          {FACADE_EDGE_CONFIG[edgeKey].fullOptionLabel}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="py-1.5 px-4 rounded-full bg-[#b99881] text-white text-xs font-semibold cursor-pointer"
                  >
                    + Cephe Ekle
                  </button>
                </form>

                {/* Mevcut Cepheler Listesi (Adını Düzenle, Konumunu Değiştir veya Çıkar) */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10.5px] font-semibold text-[#a69f99] mr-1">
                    Aktif Cepheler & Konumları:
                  </span>
                  {customFacades.map((fac) => (
                    <div
                      key={fac.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#282522] border border-[#4a443f] text-xs text-white"
                    >
                      {editingFacadeId === fac.id ? (
                        <input
                          type="text"
                          value={editingFacadeText}
                          onChange={(e) => setEditingFacadeText(e.target.value)}
                          onBlur={() => handleSaveFacadeEdit(fac.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveFacadeEdit(fac.id)
                          }}
                          autoFocus
                          className="w-24 bg-transparent text-xs text-white focus:outline-none border-b border-[#b99881]"
                        />
                      ) : (
                        <span
                          onClick={() => {
                            setEditingFacadeId(fac.id)
                            setEditingFacadeText(fac.label)
                          }}
                          className="cursor-pointer hover:underline font-semibold"
                          title="Cephe adını düzenlemek için tıklayın"
                        >
                          {fac.label}
                        </span>
                      )}

                      {/* Sabit Konum Değiştirici (8 Yön & Köşe) */}
                      <select
                        value={fac.edge}
                        onChange={(e) =>
                          handleChangeFacadeEdge(fac.id, e.target.value as FacadeEdge)
                        }
                        className="bg-[#34302d] text-[#d6beae] text-[10px] font-medium px-2 py-0.5 rounded-full border border-[#4a443f] focus:outline-none cursor-pointer"
                        title="Bu cephenin sabit yön/köşe konumunu değiştir"
                      >
                        {ALL_FACADE_EDGES.map((edgeKey) => (
                          <option key={edgeKey} value={edgeKey}>
                            {FACADE_EDGE_CONFIG[edgeKey].arrow}{' '}
                            {FACADE_EDGE_CONFIG[edgeKey].shortPos}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => handleDeleteFacade(fac.id)}
                        className="text-rose-400 hover:text-rose-600 cursor-pointer ml-0.5"
                        title="Bu cepheyi çıkar"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* + ALT BİLGİ EKLE / DÜZENLE FORMU (Peşinat, vade, ödeme planı, kampanya notu vb.) */}
            {showAddFooterInfoForm && (
              <form
                onSubmit={handleSaveFooterInfo}
                className="p-3 rounded-2xl bg-[#34302d] flex flex-wrap items-end gap-2.5"
              >
                <div className="flex-1 min-w-[240px]">
                  <label className="block text-[10.5px] font-semibold text-[#a69f99] mb-1">
                    Alt Bilgi Metni (Peşinat, Vade, Ödeme Planı vb.)
                  </label>
                  <input
                    type="text"
                    value={footerInfoDraft}
                    onChange={(e) => setFooterInfoDraft(e.target.value)}
                    placeholder="Örn: 1.500.000₺ Peşinat / 36 Ay Vade, %25 Peşinat Kampanyası..."
                    className="w-full px-3.5 py-1.5 rounded-full bg-[#282522] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="submit"
                    className="py-1.5 px-4 rounded-full bg-[#b99881] text-white text-xs font-semibold cursor-pointer"
                  >
                    Alt Bilgiyi Kaydet
                  </button>
                  {project.footerInfo && (
                    <button
                      type="button"
                      onClick={handleRemoveFooterInfo}
                      className="py-1.5 px-3 rounded-full bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 text-xs font-semibold cursor-pointer"
                    >
                      Kaldır
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowAddFooterInfoForm(false)}
                    className="p-1.5 rounded-full bg-[#282522] text-[#a69f99] hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* OTOMATİK OKUNAN BELGE BİLDİRİMİ */}
      {docFeedback && (
        <div className="px-4 py-2 rounded-full bg-[#282522] border border-[#4a443f] flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-4 h-4 text-[#b99881] shrink-0" />
            <span className="truncate font-medium">
              {project.sourceDocumentName ? `[${project.sourceDocumentName}] ` : ''}
              {docFeedback}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setDocFeedback(null)}
            className="text-[11px] text-[#8c857f] hover:text-white px-2.5 py-0.5 rounded-full cursor-pointer shrink-0"
          >
            Gizle
          </button>
        </div>
      )}

      {/* ANA ETKİLEŞİMLİ ALAN: Sol Kat Görünümü + Orta Geniş Kroki Planı + Sağ Bilgi Kutucuğu (Dock çizgisine temas etmemesi için birkaç px yukarı çekildi) */}
      <div className="grid grid-cols-1 lg:grid-cols-[205px_minmax(0,1fr)_252px] xl:grid-cols-[215px_minmax(0,1fr)_264px] gap-3.5 items-stretch min-h-[635px] xl:min-h-[650px]">
        {/* SOL SÜTUN: KAT PLANI (Katlar + Blok Seçimi + Giriş Seçimi) */}
        <div className="p-3.5 rounded-[24px] bg-[#282522] border border-[#4a443f] flex flex-col justify-start space-y-3.5 min-h-[635px] xl:min-h-[650px] h-full">
          {/* 1. KATLAR: Yukarıdan aşağıya İkinci Kat -> Birinci Kat -> Zemin Kat (en altta), alt açıklamalar kaldırıldı */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#b99881]" />
                <span>Kat Planı</span>
              </span>
              <span className="text-[10px] font-mono text-[#8c857f]">
                {configuredMaxFloors} Kat
              </span>
            </div>

            <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible py-0.5">
              {[...floors].reverse().map((fl) => {
                const isSelected = fl === selectedFloor
                const unitsOnFl = blockUnits.filter(
                  (u) => Math.max(0, Math.min(2, u.floor)) === fl
                )
                const availCount = unitsOnFl.filter((u) => u.status === 'SATISTA').length
                const resCount = unitsOnFl.filter((u) => u.status === 'REZERVE').length
                const soldCount = unitsOnFl.filter((u) => u.status === 'SATILDI').length
                const labelInfo = FLOOR_LABELS[fl] || {
                  short: `${fl}. Kat`,
                  full: `${fl}. Kat`,
                  sub: '',
                }

                return (
                  <button
                    key={fl}
                    type="button"
                    onClick={() => setSelectedFloor(fl)}
                    className={`w-full min-w-[130px] lg:min-w-0 px-3.5 py-2.5 rounded-full text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-[#b99881] text-white shadow-sm'
                        : 'bg-[#34302d] text-[#f3efe9] hover:opacity-95'
                    }`}
                  >
                    <span className="text-xs font-bold truncate">{labelInfo.short}</span>

                    <div className="flex items-center gap-1.5 text-[10px] shrink-0">
                      {availCount > 0 && (
                        <span
                          className={`inline-flex items-center gap-0.5 font-bold ${
                            isSelected ? 'text-white' : 'text-emerald-500'
                          }`}
                          title={`Satışta: ${availCount}`}
                        >
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          {availCount}
                        </span>
                      )}
                      {resCount > 0 && (
                        <span
                          className={`inline-flex items-center gap-0.5 font-bold ${
                            isSelected ? 'text-white' : 'text-blue-800'
                          }`}
                          title={`Kapora / Peşinat: ${resCount}`}
                        >
                          <span className="w-2 h-2 rounded-full bg-[#1e3a8a]" />
                          {resCount}
                        </span>
                      )}
                      {soldCount > 0 && (
                        <span
                          className={`inline-flex items-center gap-0.5 font-bold ${
                            isSelected ? 'text-white' : 'text-red-600'
                          }`}
                          title={`Satıldı / Kapalı: ${soldCount}`}
                        >
                          <span className="w-2 h-2 rounded-full bg-red-600" />
                          {soldCount}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 2. BLOK SEÇİMİ: Seçilen blok için proje alanında genişletilmiş ayrı görünüm açar */}
          <div className="space-y-2 pt-2 border-t border-[#4a443f]/40">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#b99881]" />
                <span>Blok</span>
              </span>
              {selectedBlock !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setSelectedBlock('ALL')}
                  className="text-[10px] font-semibold text-[#b99881] hover:underline cursor-pointer"
                >
                  Tüm Plan
                </button>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedBlock('ALL')}
                className={`w-full px-3.5 py-2 rounded-full text-xs font-semibold text-left transition-all cursor-pointer flex items-center justify-between ${
                  selectedBlock === 'ALL'
                    ? 'bg-[#b99881] text-white shadow-sm'
                    : 'bg-[#34302d] text-[#f3efe9] hover:text-white'
                }`}
              >
                <span>Tüm Site Planı</span>
                <span className="text-[10px] opacity-80 font-mono">{units.length} Daire</span>
              </button>

              {blocks.map((blk) => {
                const isBlkSelected = selectedBlock === blk
                const blkUnitCount = units.filter((u) => {
                  const { blockName } = resolveUnitBlockAndEntrance(u)
                  return (
                    blockName.toLocaleLowerCase('tr-TR') === blk.toLocaleLowerCase('tr-TR') ||
                    (u.block || '').toLocaleLowerCase('tr-TR') === blk.toLocaleLowerCase('tr-TR')
                  )
                }).length

                return (
                  <button
                    key={blk}
                    type="button"
                    onClick={() => setSelectedBlock(isBlkSelected ? 'ALL' : blk)}
                    className={`w-full px-3.5 py-2 rounded-full text-xs font-semibold text-left transition-all cursor-pointer flex items-center justify-between ${
                      isBlkSelected
                        ? 'bg-[#b99881] text-white shadow-sm'
                        : 'bg-[#34302d] text-[#f3efe9] hover:text-white'
                    }`}
                  >
                    <span className="truncate">{blk}</span>
                    <span className="text-[10px] opacity-80 font-mono shrink-0">
                      {blkUnitCount} Daire
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 3. GİRİŞ SEÇİMİ: Tıklandığında o giriş plan üzerinde yanıp sönme efektiyle vurgulanır */}
          <div className="space-y-2 pt-2 border-t border-[#4a443f]/40">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <DoorOpen className="w-3.5 h-3.5 text-[#b99881]" />
                <span>Giriş</span>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {selectableEntrances.map((ent) => {
                const isBlinking =
                  highlightedEntrance !== null &&
                  (highlightedEntrance.areaId === ent.areaId ||
                    highlightedEntrance.label.toLocaleLowerCase('tr-TR') ===
                      ent.label.toLocaleLowerCase('tr-TR'))
                return (
                  <button
                    key={ent.label}
                    type="button"
                    onClick={() => handleSelectEntranceFromSidebar(ent.label, ent.areaId)}
                    className={`px-3 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer truncate text-center ${
                      isBlinking
                        ? 'bg-[#1e6091] text-white ring-2 ring-amber-400 animate-pulse shadow-md'
                        : 'bg-[#34302d] text-[#f3efe9] hover:bg-[#b99881] hover:text-white'
                    }`}
                    title={`${ent.label} konumunu planda yanıp sönerek vurgula`}
                  >
                    {ent.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* ORTA SÜTUN: ETKİLEŞİMLİ MİMARİ KAT KROKİSİ (Dış çizgi katmanı ve başlık kaldırıldı, direkt karta genişletildi) */}
        <div className="rounded-[24px] bg-[#282522] border border-[#4a443f] flex flex-col justify-between min-h-[635px] xl:min-h-[650px] h-full overflow-hidden">
          {/* Yüklenen Kat Planı Görseli Varsa Opaklık Ayarı */}
          {activeFloorPlanUrl && (
            <div className="flex items-center justify-between gap-3 px-4 py-1.5 m-2 rounded-full bg-[#34302d] text-xs">
              <div className="flex items-center gap-2">
                <Eye className="w-3.5 h-3.5 text-[#b99881]" />
                <span className="text-[11px] font-medium">Kat Görsel Altlığı Aktif</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#8c857f]">Belirginlik: %{planOpacity}</span>
                <input
                  type="range"
                  min={20}
                  max={100}
                  value={planOpacity}
                  onChange={(e) => setPlanOpacity(Number(e.target.value))}
                  className="w-24 cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* MİMARİ KAT KROKİSİ KANVASI */}
          <div className="relative flex-1 flex flex-col">
            <div
              ref={canvasRef}
              onMouseDown={(e) => {
                // Boş kanvas alanına tıklandığında seçili daireyi temizle -> Sağ menüde Proje Bilgileri açılır
                if (e.target === e.currentTarget) {
                  setActiveUnitId(null)
                  setActiveAreaId(null)
                }
              }}
              className="interactive-plan-canvas relative w-full min-h-[635px] xl:min-h-[650px] h-full flex-1 rounded-[24px] overflow-hidden select-none z-10"
            >
                {/* SEÇİLEN BLOK İÇİN GENİŞLETİLMİŞ AYRI GÖRÜNÜM ÇERÇEVESİ */}
                {selectedBlock !== 'ALL' && (
                  <div className="absolute inset-x-6 inset-y-8 rounded-[22px] border-2 border-dashed border-[#292d2b]/35 bg-[#292d2b]/[0.03] pointer-events-none z-[4] flex flex-col justify-between p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-3 py-1 rounded-full bg-[#282522] text-white text-[11px] font-bold uppercase tracking-wider shadow-xs">
                        {selectedBlock} — Genişletilmiş Blok Görünümü ({FLOOR_LABELS[selectedFloor]?.short})
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedBlock('ALL')}
                        className="pointer-events-auto px-3 py-1 rounded-full bg-[#b99881] text-white text-[11px] font-semibold shadow-xs hover:opacity-95 cursor-pointer"
                      >
                        Tüm Site Planına Dön
                      </button>
                    </div>
                  </div>
                )}

                {/* ÜST VE SOL MİMARİ CETVEL / ÖLÇEK İŞARETLERİ (Her %10'luk dilimde standart cetvel kılavuzu) */}
                <div className="absolute top-0 inset-x-0 h-3 pointer-events-none select-none z-15 flex items-start">
                  {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((mark) => (
                    <div
                      key={`ruler-x-${mark}`}
                      style={{ left: `${mark}%` }}
                      className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
                    >
                      <div className="w-px h-1.5 bg-[#b99881]/45" />
                      {(isLayoutEditMode || interactionState !== null) && (
                        <span className="text-[7.5px] font-mono text-[#b99881]/65 leading-none mt-0.5">
                          {mark}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="absolute left-0 inset-y-0 w-3 pointer-events-none select-none z-15 flex flex-col">
                  {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((mark) => (
                    <div
                      key={`ruler-y-${mark}`}
                      style={{ top: `${mark}%` }}
                      className="absolute left-0 -translate-y-1/2 flex items-center"
                    >
                      <div className="h-px w-1.5 bg-[#b99881]/45" />
                      {(isLayoutEditMode || interactionState !== null) && (
                        <span className="text-[7.5px] font-mono text-[#b99881]/65 leading-none ml-0.5">
                          {mark}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* MIKNATIS HİZALAMA KILAVUZ ÇİZGİLERİ (Sürükleme ve boyutlandırma sırasında eşit hizaları gösterir) */}
                {interactionState && (
                  <div className="absolute inset-0 pointer-events-none select-none z-35">
                    {snapGuides.xLines.map((xPos) => (
                      <div
                        key={`snap-x-${xPos}`}
                        style={{ left: `${xPos}%` }}
                        className="absolute inset-y-2 w-0 border-l border-dashed border-[#d6beae]/85 shadow-[0_0_6px_rgba(214,190,174,0.65)]"
                      />
                    ))}
                    {snapGuides.yLines.map((yPos) => (
                      <div
                        key={`snap-y-${yPos}`}
                        style={{ top: `${yPos}%` }}
                        className="absolute inset-x-2 h-0 border-t border-dashed border-[#d6beae]/85 shadow-[0_0_6px_rgba(214,190,174,0.65)]"
                      />
                    ))}
                  </div>
                )}

                {/* Yüklü Kat Planı Görseli (Yalnızca kullanıcı doğrudan görsel altlık yüklediyse) */}
                {activeFloorPlanUrl && (
                  <img
                    src={activeFloorPlanUrl}
                    alt={`${project.name} ${FLOOR_LABELS[selectedFloor]?.short}`}
                    style={{ opacity: planOpacity / 100 }}
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none p-2"
                  />
                )}

                {/* DİNAMİK VE DÜZENLENEBİLİR CEPHE ETİKETLERİ (Kaldırılan cephelerin arkasından öneri çıkmaz) */}
                {ALL_FACADE_EDGES.map((edge) => {
                  const edgeFacades = customFacades.filter((f) => f.edge === edge)
                  if (edgeFacades.length === 0) return null

                  const cfg = FACADE_EDGE_CONFIG[edge]
                  const hasBanner = false

                  const edgeStyle: React.CSSProperties =
                    edge === 'top'
                      ? {
                          top: '8px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                        }
                      : edge === 'bottom'
                      ? {
                          top: hasBanner ? 'calc(100% - 34px)' : 'calc(100% - 8px)',
                          left: '50%',
                          transform: 'translate(-50%, -100%)',
                        }
                      : edge === 'left'
                      ? {
                          top: '50%',
                          left: '16px',
                          transform: 'translate(-50%, -50%) rotate(-90deg)',
                          transformOrigin: 'center center',
                        }
                      : edge === 'right'
                      ? {
                          top: '50%',
                          left: 'calc(100% - 16px)',
                          transform: 'translate(-50%, -50%) rotate(90deg)',
                          transformOrigin: 'center center',
                        }
                      : edge === 'top-left'
                      ? {
                          top: '40px',
                          left: '40px',
                          transform: 'translate(-50%, -50%) rotate(-45deg)',
                          transformOrigin: 'center center',
                        }
                      : edge === 'top-right'
                      ? {
                          top: '40px',
                          left: 'calc(100% - 40px)',
                          transform: 'translate(-50%, -50%) rotate(45deg)',
                          transformOrigin: 'center center',
                        }
                      : edge === 'bottom-left'
                      ? {
                          top: hasBanner ? 'calc(100% - 66px)' : 'calc(100% - 40px)',
                          left: '40px',
                          transform: 'translate(-50%, -50%) rotate(45deg)',
                          transformOrigin: 'center center',
                        }
                      : {
                          top: hasBanner ? 'calc(100% - 66px)' : 'calc(100% - 40px)',
                          left: 'calc(100% - 40px)',
                          transform: 'translate(-50%, -50%) rotate(-45deg)',
                          transformOrigin: 'center center',
                        }

                  const badgeArrow =
                    edge === 'bottom' || edge === 'bottom-left' || edge === 'bottom-right'
                      ? '▼'
                      : '▲'

                  return (
                    <div
                      key={edge}
                      data-facade-badge="true"
                      style={edgeStyle}
                      className="absolute flex items-center gap-1 z-20 pointer-events-auto select-none whitespace-nowrap"
                    >
                      {edgeFacades.map((fac) => (
                        <div
                          key={fac.id}
                          className="px-2.5 py-0.5 rounded-full bg-white/95 shadow-xs text-[9.5px] font-mono font-bold uppercase tracking-wider text-[#292d2b] flex items-center gap-1 border border-black/15 whitespace-nowrap"
                        >
                          {editingFacadeId === fac.id ? (
                            <input
                              type="text"
                              value={editingFacadeText}
                              onChange={(e) => setEditingFacadeText(e.target.value)}
                              onBlur={() => handleSaveFacadeEdit(fac.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveFacadeEdit(fac.id)
                              }}
                              autoFocus
                              className="w-20 bg-transparent text-[9.5px] font-mono font-bold text-[#292d2b] focus:outline-none border-b border-[#5c6ac4]"
                            />
                          ) : (
                            <span
                              onClick={() => {
                                if (isLayoutEditMode) {
                                  setEditingFacadeId(fac.id)
                                  setEditingFacadeText(fac.label)
                                }
                              }}
                              className={isLayoutEditMode ? 'cursor-pointer hover:underline' : ''}
                              title={
                                isLayoutEditMode
                                  ? 'Cephe adını düzenlemek için tıklayın'
                                  : `${cfg.shortPos}: ${fac.label}`
                              }
                            >
                              {badgeArrow} {fac.label}
                            </span>
                          )}

                          {isLayoutEditMode && (
                            <button
                              type="button"
                              onClick={() => handleDeleteFacade(fac.id)}
                              className="text-rose-500 hover:text-rose-700 cursor-pointer ml-0.5"
                              title="Cepheyi kaldır"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                })}

              {/* ÖZEL MİMARİ ALANLAR: BLOK ÇERÇEVESİ, ÇİZGİSEL GİRİŞ (ÇİZGİ + HAFİF AYRIK GİRİŞ YAZISI), HAVUZ, BAHÇE VB. */}
              {floorAreas.map((area) => {
                const isPool = area.kind === 'pool'
                const isEntrance = area.kind === 'entrance'
                const isBlockArea = area.kind === 'block'
                const isGarden = area.kind === 'garden'
                const isSelectedArea = activeAreaId === area.id
                const isInteractingArea =
                  interactionState?.targetType === 'area' && interactionState.targetId === area.id
                const isVerticalEntrance =
                  isEntrance &&
                  (area.textOrientation === 'vertical' || area.box.h > area.box.w * 1.35)

                const isHighlightedEntrance =
                  isEntrance &&
                  highlightedEntrance !== null &&
                  (highlightedEntrance.areaId === area.id ||
                    highlightedEntrance.label.toLocaleLowerCase('tr-TR') ===
                      area.label.trim().toLocaleLowerCase('tr-TR'))

                // Alanın proje alanının sol yarısında mı sağ yarısında mı olduğu (dikey yazının içe bakması için)
                const areaCenterX = area.box.x + area.box.w / 2
                const isAreaOnLeftHalf = areaCenterX < 50
                // Sol yarıdaysa yazının altı sağa (proje içine) bakar: vertical-rl + rotate-180
                // Sağ yarıdaysa yazının altı sola (proje içine) bakar: vertical-rl
                const inwardVerticalTextClass = isAreaOnLeftHalf
                  ? '[writing-mode:vertical-rl] rotate-180'
                  : '[writing-mode:vertical-rl]'

                const areaStyleClasses = isBlockArea
                  ? 'bg-[#292d2b]/[0.035] border-2 border-dashed border-[#292d2b]/45 text-[#292d2b]'
                  : isPool
                  ? 'bg-sky-500/25 border-2 border-sky-500/80 text-sky-950'
                  : isEntrance
                  ? `bg-transparent text-[#282522] ${
                      isSelectedArea || isLayoutEditMode
                        ? 'border border-dashed border-[#282522]/35'
                        : 'border border-transparent'
                    }`
                  : isGarden
                  ? 'bg-emerald-500/20 border-2 border-emerald-600/60 text-emerald-950'
                  : 'bg-white/75 border-2 border-black/25 text-[#292d2b]'

                // Areas are movable and editable ONLY when isLayoutEditMode is true
                const canDragThisArea = isLayoutEditMode
                const isVeryNarrowArea = !isBlockArea && area.box.w <= 7.8 && area.box.h > area.box.w * 1.3
                const isVerticalTextArea =
                  area.textOrientation === 'vertical' ||
                  isVeryNarrowArea ||
                  (isEntrance && area.box.h > area.box.w * 1.35)

                const openAreaContextMenu = (e: React.MouseEvent) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (!isLayoutEditMode) return
                  setInteractionState(null)
                  setUnitContextMenu(null)
                  setActiveUnitId(null)
                  setActiveAreaId(area.id)
                  setAreaLabelEditDraft(area.label)
                  setAreaContextMenu({
                    areaId: area.id,
                    x: e.clientX,
                    y: e.clientY,
                  })
                }

                return (
                  <motion.div
                    key={
                      isHighlightedEntrance
                        ? `${area.id}-blink-${highlightedEntrance.tick}`
                        : area.id
                    }
                    animate={
                      isHighlightedEntrance
                        ? {
                            scale: [1, 1.18, 0.96, 1.18, 0.96, 1.15, 1],
                            opacity: [1, 0.35, 1, 0.35, 1, 0.4, 1],
                          }
                        : { scale: 1, opacity: 1 }
                    }
                    transition={
                      isHighlightedEntrance
                        ? { duration: 2.6, ease: 'easeInOut' }
                        : { duration: 0.15 }
                    }
                    style={{
                      left: `${area.box.x}%`,
                      top: `${area.box.y}%`,
                      width: `${area.box.w}%`,
                      height: `${area.box.h}%`,
                      ...(isPool
                        ? {
                            backgroundImage:
                              'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.45) 0%, transparent 45%), radial-gradient(circle at 75% 65%, rgba(255,255,255,0.35) 0%, transparent 40%), linear-gradient(135deg, rgba(14, 165, 233, 0.38) 0%, rgba(2, 132, 199, 0.55) 100%)',
                          }
                        : {}),
                    }}
                    onMouseDown={(e) => {
                      if (e.button !== 0) return
                      if (!isLayoutEditMode) return
                      setActiveAreaId(area.id)
                      e.stopPropagation()
                      const blockChildren = isBlockArea
                        ? captureBlockChildren(area.id, area.box)
                        : undefined
                      setInteractionState({
                        targetType: 'area',
                        targetId: area.id,
                        mode: 'move',
                        startX: e.clientX,
                        startY: e.clientY,
                        initialBox: area.box,
                        blockChildren,
                      })
                    }}
                    onContextMenu={openAreaContextMenu}
                    className={`absolute ${isEntrance ? 'rounded-lg' : 'rounded-[18px]'} flex ${
                      isBlockArea
                        ? 'items-start justify-start p-2.5'
                        : isEntrance
                        ? 'items-center justify-center p-1'
                        : 'flex-col items-center justify-center p-1.5'
                    } overflow-visible transition-[box-shadow] ${areaStyleClasses} ${
                      isHighlightedEntrance
                        ? 'ring-4 ring-amber-400 bg-amber-300/20 shadow-[0_0_24px_rgba(251,191,36,0.9)] z-35'
                        : isSelectedArea
                        ? 'ring-2 ring-[#5c6ac4] z-25'
                        : isEntrance
                        ? 'z-25'
                        : isBlockArea
                        ? 'z-[5]'
                        : 'z-10'
                    } ${
                      isBlockArea && !isLayoutEditMode && !isSelectedArea
                        ? 'pointer-events-none'
                        : canDragThisArea
                        ? 'cursor-move pointer-events-auto'
                        : 'cursor-pointer pointer-events-auto'
                    }`}
                  >
                    {/* Aktif Taşıma/Boyutlandırma Cetvel Ölçüsü Rozeti */}
                    {isInteractingArea && (
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-[#282522] text-[#f3efe9] border border-[#b99881] text-[9px] font-mono font-bold whitespace-nowrap shadow-md z-40 pointer-events-none">
                        {isFreeMoveMode || isCtrlPressed ? 'Free Mod' : 'Mıknatıs'}: X:{area.box.x.toFixed(1)} Y:{area.box.y.toFixed(1)} • {Math.round(area.box.w)}×{Math.round(area.box.h)}
                      </div>
                    )}

                    {/* Düzenle Modunda Giriş Düşey/Yatay Yazı Çevirme + Sil Butonları */}
                    {isLayoutEditMode && (
                      <div className="absolute -top-2.5 -right-2.5 flex items-center gap-1 z-30">
                        {isEntrance && (
                          <button
                            type="button"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation()
                              const nextOrient = isVerticalEntrance ? 'horizontal' : 'vertical'
                              const swappedBox: UnitPlanBox = {
                                x: area.box.x,
                                y: area.box.y,
                                w: Number(Math.max(4.5, Math.min(30, area.box.h * 0.65)).toFixed(1)),
                                h: Number(Math.max(5.5, Math.min(35, area.box.w * 1.55)).toFixed(1)),
                              }
                              projectStore.updateCustomArea(project.id, area.id, {
                                textOrientation: nextOrient,
                                box: swappedBox,
                              })
                              onProjectUpdated()
                            }}
                            className="px-1.5 h-5 rounded-full bg-[#282522] text-[#d6beae] hover:text-white border border-[#b99881] text-[8.5px] font-bold flex items-center justify-center shadow-sm cursor-pointer"
                            title="Giriş yazısını Düşey / Yatay çevir"
                          >
                            {isVerticalEntrance ? 'Yatay' : 'Düşey'}
                          </button>
                        )}
                        <button
                          type="button"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteAreaQuick(area.id)
                          }}
                          className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-sm hover:bg-rose-500 cursor-pointer"
                          title="Bu alanı kaldır"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {isBlockArea && (
                      <div
                        onMouseDown={(e) => {
                          if (e.button !== 0 || !isLayoutEditMode) return
                          setActiveAreaId(area.id)
                        }}
                        onContextMenu={openAreaContextMenu}
                        className={`px-2.5 py-0.5 rounded-full bg-[#282522] text-white text-[10px] font-bold uppercase tracking-wider shadow-xs select-none ${
                          isLayoutEditMode ? 'pointer-events-auto cursor-move' : 'pointer-events-none'
                        }`}
                        title={isLayoutEditMode ? 'Blok ayarları için sağ tıklayın' : undefined}
                      >
                        {area.label}
                      </div>
                    )}

                    {isPool && (
                      <div className="flex flex-col items-center justify-center text-center select-none pointer-events-none">
                        <Waves className="w-6 h-6 text-sky-800 mb-1 opacity-85" />
                        <span
                          className={`text-sm sm:text-base font-extrabold tracking-widest uppercase text-sky-950 drop-shadow-2xs ${
                            isVerticalTextArea ? `${inwardVerticalTextClass} py-1` : ''
                          }`}
                        >
                          {area.label}
                        </span>
                      </div>
                    )}

                    {/* ÇİZGİSEL GİRİŞ GÖRÜNÜMÜ: Üstte/Yanda mimari çizgi, altında/yanında hafif ayrık GİRİŞ yazısı */}
                    {isEntrance && (
                      <div
                        className={`w-full h-full flex ${
                          isVerticalEntrance
                            ? isAreaOnLeftHalf
                              ? 'flex-row items-center justify-center gap-1.5'
                              : 'flex-row-reverse items-center justify-center gap-1.5'
                            : 'flex-col items-center justify-center gap-1.5'
                        } select-none pointer-events-none`}
                      >
                        {/* Mimari Giriş Çizgisi */}
                        <div
                          className={
                            isVerticalEntrance
                              ? 'w-[3px] h-full min-h-[22px] rounded-full bg-[#282522] shadow-2xs shrink-0'
                              : 'h-[3px] w-full min-w-[28px] rounded-full bg-[#282522] shadow-2xs shrink-0'
                          }
                        />
                        {/* Çizginin altında / yanında hafif ayrık GİRİŞ yazısı */}
                        <span
                          style={{ fontFamily: "'Karla', sans-serif" }}
                          className={`text-[10px] sm:text-[11px] font-extrabold tracking-[0.16em] uppercase text-[#282522] leading-none whitespace-nowrap ${
                            isVerticalEntrance ? `${inwardVerticalTextClass} py-0.5` : ''
                          }`}
                        >
                          {area.label || 'GİRİŞ'}
                        </span>
                      </div>
                    )}

                    {!isPool && !isEntrance && !isBlockArea && (
                      <span
                        className={`text-xs font-bold uppercase tracking-wider text-center select-none pointer-events-none ${
                          isVerticalTextArea ? `${inwardVerticalTextClass} py-1` : ''
                        }`}
                      >
                        {area.label}
                      </span>
                    )}

                    {/* Apple Widget Sağ Alt Kıvrımlı Boyutlandırma Kulpu (Yalnızca Düzenleme Modunda) */}
                    {isLayoutEditMode &&
                      renderAppleCornerResizeHandle('area', area.id, area.box)}
                  </motion.div>
                )
              })}

              {/* KATTAKİ DAİRELERİN KROKİ KUTULARI */}
              <AnimatePresence mode="popLayout">
                {floorUnits.map((unit, idx) => {
                  const box =
                    unit.planBox ||
                    getDefaultUnitPlanBox(idx, floorUnits.length, layoutTemplate, unit.sizePreset)
                  const isSelected = activeUnit?.id === unit.id
                  const isInteractingUnit =
                    interactionState?.targetType === 'unit' && interactionState.targetId === unit.id
                  const isDepositOrReserved =
                    unit.status === 'REZERVE' ||
                    Boolean(unit.reservation?.depositAmount) ||
                    /kapora|peşinat|pesinat|rezerve|opsiyon/i.test(unit.statusLabel || '')
                  const isAvailable = unit.status === 'SATISTA' && !isDepositOrReserved
                  const isReserved = isDepositOrReserved
                  const isKapali = unit.statusLabel === 'KAPALI'

                  // Boyuta duyarlı adaptif görünüm ve çok dar elementlerde içe bakan dikey yazı
                  const isUltraShort = box.h <= 9.5
                  const isShortBox = !isUltraShort && box.h <= 14.5
                  const isVeryNarrowUnit =
                    !isUltraShort &&
                    (box.w <= 7.8 || (box.w <= 9.0 && box.h >= box.w * 1.65))
                  const isNarrowVertical = !isUltraShort && !isVeryNarrowUnit && box.w <= 13.5

                  // Çok dar elementlerde yazılar yan döner: sol yarıdaysa altı sağa (içe), sağ yarıdaysa altı sola (içe) bakar
                  const unitCenterX = box.x + box.w / 2
                  const isUnitOnLeftHalf = unitCenterX < 50
                  const unitInwardVerticalClass = isUnitOnLeftHalf
                    ? '[writing-mode:vertical-rl] rotate-180'
                    : '[writing-mode:vertical-rl]'

                  const statusColorClasses = isAvailable
                    ? 'unit-box-available'
                    : isReserved
                    ? 'unit-box-deposit'
                    : 'unit-box-sold'

                  const badgeClasses = isAvailable
                    ? 'unit-badge-available'
                    : isReserved
                    ? 'unit-badge-deposit'
                    : 'unit-badge-sold'

                  const unitTitlePillClasses = isAvailable ? 'unit-pill-dark' : 'unit-pill-light'

                  const displayStatusText = isAvailable
                    ? 'Satışta'
                    : isReserved
                    ? unit.statusLabel && !/^satışta$/i.test(unit.statusLabel)
                      ? unit.statusLabel
                      : unit.reservation?.depositAmount
                      ? 'Kapora Alındı'
                      : 'Kapora / Rezerve'
                    : isKapali
                    ? 'KAPALI'
                    : unit.statusLabel || 'SATILDI'

                  const boxShadowStyle = isSelected
                    ? '0 4px 0 0 rgba(41, 45, 43, 0.24), 0 10px 18px -4px rgba(41, 45, 43, 0.18)'
                    : '0 2px 0 0 rgba(41, 45, 43, 0.10), 0 4px 10px -4px rgba(41, 45, 43, 0.08)'

                  return (
                    <motion.div
                      key={unit.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      style={{
                        left: `${box.x}%`,
                        top: `${box.y}%`,
                        width: `${box.w}%`,
                        height: `${box.h}%`,
                        boxShadow: boxShadowStyle,
                        backgroundColor: isAvailable
                          ? 'rgba(16, 185, 129, 0.22)'
                          : isReserved
                          ? 'rgba(23, 37, 84, 0.92)'
                          : 'rgba(220, 38, 38, 0.88)',
                        borderColor: isAvailable
                          ? 'rgba(5, 150, 105, 0.85)'
                          : isReserved
                          ? '#1e40af'
                          : '#b91c1c',
                      }}
                      onMouseDown={(e) => {
                        setActiveUnitId(unit.id)
                        setActiveAreaId(null)
                        if (e.button !== 0) return
                        if (isLayoutEditMode) {
                          e.stopPropagation()
                          setInteractionState({
                            targetType: 'unit',
                            targetId: unit.id,
                            mode: 'move',
                            startX: e.clientX,
                            startY: e.clientY,
                            initialBox: box,
                          })
                        }
                      }}
                      onClick={() => {
                        setActiveUnitId(unit.id)
                        setActiveAreaId(null)
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setInteractionState(null)
                        setAreaContextMenu(null)
                        setActiveUnitId(unit.id)
                        setActiveAreaId(null)
                        setUnitContextMenu({
                          unitId: unit.id,
                          x: e.clientX,
                          y: e.clientY,
                        })
                      }}
                      className={`absolute ${
                        isUltraShort ? 'rounded-[10px]' : isShortBox ? 'rounded-[13px]' : 'rounded-[16px]'
                      } border-2 transition-colors backdrop-blur-[2px] overflow-hidden ${statusColorClasses} ${
                        isSelected ? 'ring-2 ring-[#5c6ac4] z-20' : 'z-10'
                      } ${isLayoutEditMode ? 'cursor-move' : 'cursor-pointer'} ${
                        isUltraShort
                          ? 'px-1.5 py-0.5'
                          : isVeryNarrowUnit
                          ? 'p-1'
                          : isShortBox || isNarrowVertical
                          ? 'p-1.5'
                          : 'p-2.5'
                      } flex flex-col justify-between`}
                    >
                      {/* Aktif Taşıma/Boyutlandırma Cetvel Ölçüsü Rozeti */}
                      {isInteractingUnit && (
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-[#282522] text-[#f3efe9] border border-[#b99881] text-[9px] font-mono font-bold whitespace-nowrap shadow-md z-40 pointer-events-none">
                          {isFreeMoveMode || isCtrlPressed ? 'Free Mod' : 'Mıknatıs'}: X:{box.x.toFixed(1)} Y:{box.y.toFixed(1)} • {Math.round(box.w)}×{Math.round(box.h)}
                        </div>
                      )}

                      {/* Düzenle Modunda Daire Sil Butonu */}
                      {isLayoutEditMode && (
                        <button
                          type="button"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (
                              window.confirm(
                                `${unit.unitNumber} dairesini bu kattan kaldırmak istiyor musunuz?`
                              )
                            ) {
                              projectStore.deleteUnit(project.id, unit.id)
                              onProjectUpdated()
                            }
                          }}
                          className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-sm hover:bg-rose-500 cursor-pointer z-30"
                          title="Daireyi kaldır"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      )}

                      {isUltraShort ? (
                        /* ÇOK DAR YÜKSEKLİK (Örn: 12 daire dikey dizildiğinde tek satırda Daire Adı, Durum ve Fiyat) */
                        <div className="flex-1 flex items-center justify-between gap-1 min-w-0 overflow-hidden">
                          <span
                            style={{ fontFamily: "'Karla', sans-serif" }}
                            className="unit-inline-title text-[10px] font-extrabold truncate leading-none"
                          >
                            {unit.unitNumber}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <span
                              className={`px-1.5 py-0.2 rounded-full text-[7.5px] font-bold uppercase leading-tight ${badgeClasses}`}
                            >
                              {displayStatusText}
                            </span>
                            {unit.price > 0 && (
                              <span
                                style={{ fontFamily: "'Karla', sans-serif" }}
                                className="unit-pill-light text-[9px] font-bold px-1.5 py-0.2 rounded-full leading-tight"
                              >
                                {formatCurrency(unit.price)}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : isVeryNarrowUnit ? (
                        /* ÇOK DAR DÜŞEY ELEMENT: Yazılar yan döner ve proje alanının merkezine (içe) doğru bakar */
                        <div className="flex-1 flex items-center justify-center overflow-hidden py-0.5">
                          <div
                            className={`${unitInwardVerticalClass} flex items-center justify-between gap-1.5 w-full h-full text-center whitespace-nowrap`}
                          >
                            <span
                              style={{ fontFamily: "'Karla', sans-serif" }}
                              className={`px-1 py-1.5 rounded-full ${unitTitlePillClasses} text-[9.5px] font-bold tracking-tight leading-none`}
                            >
                              {unit.unitNumber}
                            </span>
                            <span
                              className={`px-1 py-1 rounded-full text-[7.5px] font-bold uppercase tracking-wide leading-none ${badgeClasses}`}
                            >
                              {displayStatusText}
                            </span>
                            {unit.price > 0 && (
                              <span
                                style={{ fontFamily: "'Karla', sans-serif" }}
                                className="unit-pill-light text-[8.5px] font-bold px-1 py-1 rounded-full leading-none"
                              >
                                {formatCurrency(unit.price)}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : isNarrowVertical ? (
                        /* DÜŞEY (9:16) KUTU GÖRÜNÜMÜ: Sadece Daire Adı (Karla), Satışta ibaresi ve Fiyatı */
                        <div className="flex-1 flex flex-col items-center justify-between text-center gap-0.5 py-0.5 min-h-0 overflow-hidden">
                          <span
                            style={{ fontFamily: "'Karla', sans-serif" }}
                            className={`px-1.5 py-0.5 rounded-full ${unitTitlePillClasses} text-[10px] font-bold tracking-tight truncate max-w-full leading-tight`}
                          >
                            {unit.unitNumber}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wide truncate max-w-full leading-tight ${badgeClasses}`}
                          >
                            {displayStatusText}
                          </span>
                          {unit.price > 0 && (
                            <span
                              style={{ fontFamily: "'Karla', sans-serif" }}
                              className="unit-pill-light text-[9px] font-bold px-1.5 py-0.5 rounded-full truncate max-w-full leading-tight"
                            >
                              {formatCurrency(unit.price)}
                            </span>
                          )}
                        </div>
                      ) : (
                        /* STANDART (1:1 veya 16:9) GÖRÜNÜM: Sadece Daire Adı (Karla), Satışta ibaresi ve Fiyatı */
                        <div className="flex-1 flex flex-col justify-between min-h-0 overflow-hidden">
                          <div className="flex items-center justify-between gap-1 min-w-0">
                            <span
                              style={{ fontFamily: "'Karla', sans-serif" }}
                              className={`px-2 py-0.5 rounded-full ${unitTitlePillClasses} ${
                                isShortBox ? 'text-[10px]' : 'text-xs'
                              } font-bold tracking-tight truncate shadow-2xs leading-tight`}
                            >
                              {unit.unitNumber}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full ${
                                isShortBox ? 'text-[8px]' : 'text-[9.5px]'
                              } font-bold uppercase tracking-wider shrink-0 shadow-2xs leading-tight ${badgeClasses}`}
                            >
                              {displayStatusText}
                            </span>
                          </div>

                          <div className="flex items-center justify-end pt-0.5 min-w-0 mt-auto">
                            {unit.price > 0 && (
                              <span
                                style={{ fontFamily: "'Karla', sans-serif" }}
                                className={`unit-pill-light ${
                                  isShortBox ? 'text-[9.5px] px-1.5 py-0.2' : 'text-[11px] px-2.5 py-0.5'
                                } font-bold rounded-full shadow-2xs truncate max-w-full leading-tight`}
                              >
                                {formatCurrency(unit.price)}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Apple Widget Sağ Alt Kıvrımlı Boyutlandırma Kulpu (Yalnızca Düzenleme Modunda) */}
                      {isLayoutEditMode &&
                        renderAppleCornerResizeHandle('unit', unit.id, box)}
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          </div>

          {/* İsteğe Bağlı Alt Bilgi Alanı (Kullanıcı 'Alt Bilgi Ekle' ile peşinat/vade vb. girdiğinde görünür) */}
          {project.footerInfo && (
            <div className="m-2 px-4 py-2 rounded-full bg-[#34302d] border border-[#4a443f] flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 min-w-0 mx-auto">
                <TurkishLira className="w-3.5 h-3.5 text-[#b99881] shrink-0" />
                <span className="font-bold text-white tracking-wide truncate">
                  {project.footerInfo}
                </span>
              </div>
              {isLayoutEditMode && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddFooterInfoForm(true)
                      setShowAddUnitForm(false)
                      setShowAddAreaForm(false)
                      setShowAddFacadeForm(false)
                    }}
                    className="text-[11px] font-semibold text-[#b99881] hover:underline cursor-pointer"
                  >
                    Düzenle
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveFooterInfo}
                    className="text-rose-400 hover:text-rose-500 cursor-pointer p-0.5"
                    title="Alt bilgiyi kaldır"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* DAİRE SAĞ TIK DÜZENLEME MENÜSÜ (Plan Ölçeği + Yön Ayarları + Hızlı İşlemler) */}
        {typeof document !== 'undefined' &&
          createPortal(
            <AnimatePresence>
              {unitContextMenu && (() => {
                const ctxUnitIdx = floorUnits.findIndex((u) => u.id === unitContextMenu.unitId)
                const ctxUnit = floorUnits[ctxUnitIdx]
                if (!ctxUnit) return null

                const menuWidth = 248
                const menuEstimatedHeight = isLayoutEditMode ? 475 : 120
                const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1440
                const viewportH = typeof window !== 'undefined' ? window.innerHeight : 900
                const safeBottomLimit = viewportH - 84 // Alt dock çubuğuna çarpmaması için güvenli sınır

                const posX =
                  unitContextMenu.x + menuWidth > viewportW - 12
                    ? Math.max(12, unitContextMenu.x - menuWidth)
                    : Math.max(12, unitContextMenu.x)

                const posY =
                  unitContextMenu.y + menuEstimatedHeight > safeBottomLimit
                    ? Math.max(12, Math.min(unitContextMenu.y - menuEstimatedHeight, safeBottomLimit - menuEstimatedHeight))
                    : Math.max(12, unitContextMenu.y)

                return (
                  <motion.div
                    ref={unitContextMenuRef}
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                      top: posY,
                      left: posX,
                    }}
                    className="fixed z-[9999] w-[248px] max-h-[82vh] overflow-y-auto rounded-2xl bg-[#282522]/98 backdrop-blur-xl border border-[#4a443f] p-1.5 shadow-2xl select-none"
                  >
                    <div className="px-2.5 py-1 text-[10px] font-bold text-[#8c857f] uppercase tracking-wider border-b border-[#4a443f]/60 mb-1 flex items-center justify-between">
                      <span className="text-white truncate">{ctxUnit.unitNumber}</span>
                      <span className="text-[9px] text-[#b99881] shrink-0">
                        {ctxUnit.roomType} • {ctxUnit.block || 'Plan'}
                      </span>
                    </div>

                    {isLayoutEditMode && (
                      <>
                        {/* 1. İlk Haline Getir */}
                        <button
                          type="button"
                          onClick={() => handleResetUnitToInitial(ctxUnit.id)}
                          className="w-full flex items-center gap-2 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#f3efe9] hover:bg-[#b99881]/25 hover:text-white transition-colors cursor-pointer text-left"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-[#b99881] shrink-0" />
                          <span>İlk Haline Getir</span>
                        </button>

                        {/* 2. Yatay / Dikey Çevir (90°) */}
                        <button
                          type="button"
                          onClick={() => handleRotateUnitBox(ctxUnit.id)}
                          className="w-full flex items-center gap-2 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#f3efe9] hover:bg-[#b99881]/25 hover:text-white transition-colors cursor-pointer text-left"
                        >
                          <Compass className="w-3.5 h-3.5 text-[#b99881] shrink-0" />
                          <span>Yatay / Dikey Çevir</span>
                        </button>

                        {/* 3. Diğer Katlara da Uygula */}
                        {floors.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleSyncUnitBoxToOtherFloors(ctxUnit.id)}
                            className="w-full flex items-center gap-2 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#f3efe9] hover:bg-[#b99881]/25 hover:text-white transition-colors cursor-pointer text-left"
                          >
                            <Layers className="w-3.5 h-3.5 text-[#b99881] shrink-0" />
                            <span>Konumu Diğer Katlara Uygula</span>
                          </button>
                        )}

                        {/* 4. Daire Bilgilerini & Fiyatı Düzenle */}
                        <button
                          type="button"
                          onClick={() => {
                            setUnitContextMenu(null)
                            onEditUnit(ctxUnit)
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#f3efe9] hover:bg-[#b99881]/25 hover:text-white transition-colors cursor-pointer text-left"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-[#b99881] shrink-0" />
                          <span>Daire Bilgilerini Düzenle</span>
                        </button>

                        {canEditPrice && (
                          <button
                            type="button"
                            onClick={() => {
                              setUnitContextMenu(null)
                              onEditPrice(ctxUnit)
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#f3efe9] hover:bg-[#b99881]/25 hover:text-white transition-colors cursor-pointer text-left"
                          >
                            <TurkishLira className="w-3.5 h-3.5 text-[#b99881] shrink-0" />
                            <span>Fiyatı Güncelle</span>
                          </button>
                        )}

                        {/* 5. Daireyi Çoğalt */}
                        <button
                          type="button"
                          onClick={() => handleDuplicateUnit(ctxUnit.id)}
                          className="w-full flex items-center gap-2 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#f3efe9] hover:bg-[#b99881]/25 hover:text-white transition-colors cursor-pointer text-left"
                        >
                          <Copy className="w-3.5 h-3.5 text-[#b99881] shrink-0" />
                          <span>Daireyi Çoğalt</span>
                        </button>

                        <div className="my-1 border-t border-[#4a443f]/50" />

                        {/* 6. Plan Ölçeği Seçimi (Sağ Tık Menüsünde: 1:1, 16:9, 9:16) */}
                        <div className="px-2.5 py-0.5 text-[9px] font-semibold text-[#8c857f] uppercase">
                          Plan Ölçeği
                        </div>
                        <div className="grid grid-cols-3 gap-1 px-1.5 py-0.5">
                          {SELECTABLE_SIZE_PRESETS.map((presetKey) => {
                            const info = UNIT_SIZE_PRESETS[presetKey]
                            const normalizedActivePreset =
                              ctxUnit.sizePreset === 'square' || ctxUnit.sizePreset === '1x1'
                                ? '1x1'
                                : ctxUnit.sizePreset === 'narrow-v' || ctxUnit.sizePreset === '9x16'
                                ? '9x16'
                                : ctxUnit.sizePreset
                                ? '16x9'
                                : inferSizePresetFromBox(
                                    ctxUnit.planBox || { x: 0, y: 0, w: 21, h: 15 }
                                  )
                            const isActive = normalizedActivePreset === presetKey
                            return (
                              <button
                                key={presetKey}
                                type="button"
                                onClick={() => {
                                  handleApplyUnitSizePreset(ctxUnit, presetKey, Math.max(0, ctxUnitIdx))
                                  setUnitContextMenu(null)
                                }}
                                className={`py-1 px-2 rounded-md text-[10px] font-bold transition-all cursor-pointer text-center ${
                                  isActive
                                    ? 'bg-[#b99881] text-white'
                                    : 'bg-[#34302d] text-[#a69f99] hover:text-white'
                                }`}
                              >
                                {info.shortLabel}
                              </button>
                            )
                          })}
                        </div>

                        <div className="my-1 border-t border-[#4a443f]/50" />

                        {/* 7. Yön / Cephe Ayarları (Sağ Tık Menüsünde) */}
                        <div className="px-2.5 py-0.5 flex items-center justify-between text-[9px] font-semibold text-[#8c857f] uppercase">
                          <span>Yön / Cephe Ayarları</span>
                          <span className="text-[#b99881] normal-case truncate max-w-[110px]">
                            {ctxUnit.facade || 'Seçilmedi'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 px-1.5 py-0.5">
                          {[
                            'Kuzey',
                            'Güney',
                            'Doğu',
                            'Batı',
                            'Kuzeybatı',
                            'Kuzeydoğu',
                            'Güneybatı',
                            'Güneydoğu',
                            'Havuz Cephe',
                            'Deniz Cephe',
                            'Yol Cephe',
                          ].map((dir) => {
                            const currentParts = (ctxUnit.facade || '')
                              .split(/[,•/|-]+/)
                              .map((s) => s.trim().toLowerCase())
                              .filter(Boolean)
                            const hasTag = currentParts.includes(dir.toLowerCase())
                            return (
                              <button
                                key={dir}
                                type="button"
                                onClick={() => handleToggleUnitFacadeTag(dir, ctxUnit)}
                                className={`px-1.5 py-0.5 rounded-md text-[9px] font-semibold transition-all cursor-pointer ${
                                  hasTag
                                    ? 'bg-[#b99881] text-white'
                                    : 'bg-[#34302d] text-[#a69f99] hover:text-white'
                                }`}
                              >
                                {hasTag ? `✓ ${dir}` : `+ ${dir}`}
                              </button>
                            )
                          })}
                        </div>
                        <div className="flex items-center gap-1 px-1.5 pt-0.5 pb-1">
                          <input
                            type="text"
                            value={customUnitFacadeInput}
                            onChange={(e) => setCustomUnitFacadeInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && customUnitFacadeInput.trim()) {
                                e.preventDefault()
                                handleToggleUnitFacadeTag(customUnitFacadeInput.trim(), ctxUnit)
                                setCustomUnitFacadeInput('')
                              }
                            }}
                            placeholder="Özel yön/cephe..."
                            className="flex-1 px-2 py-0.5 rounded-md bg-[#34302d] text-[9.5px] text-white focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (customUnitFacadeInput.trim()) {
                                handleToggleUnitFacadeTag(customUnitFacadeInput.trim(), ctxUnit)
                                setCustomUnitFacadeInput('')
                              }
                            }}
                            className="px-2 py-0.5 rounded-md bg-[#34302d] hover:bg-[#b99881] hover:text-white text-[9.5px] font-semibold cursor-pointer"
                          >
                            Ekle
                          </button>
                        </div>

                        <div className="my-1 border-t border-[#4a443f]/50" />
                      </>
                    )}

                    {/* 8. Satış Durumu Hızlı Seçenekleri (Her zaman kullanılabilir) */}
                    <div className="px-2.5 py-0.5 text-[9px] font-semibold text-[#8c857f] uppercase">
                      Satış Durumu
                    </div>
                    <div className="grid grid-cols-2 gap-1 px-1.5 py-0.5">
                      <button
                        type="button"
                        onClick={() => handleQuickSetStatus(ctxUnit.id, 'SATISTA', 'Satışta')}
                        className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold text-emerald-500 hover:bg-emerald-500/15 cursor-pointer text-left"
                      >
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        <span>Satışta</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickSetStatus(ctxUnit.id, 'REZERVE', 'Kapora Alındı')}
                        className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold text-blue-700 hover:bg-blue-900/15 cursor-pointer text-left"
                      >
                        <span className="w-2 h-2 rounded-full bg-[#1e3a8a] shrink-0" />
                        <span>Kapora / Peşinat</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickSetStatus(ctxUnit.id, 'SATILDI', 'SATILDI')}
                        className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold text-red-600 hover:bg-red-500/15 cursor-pointer text-left"
                      >
                        <span className="w-2 h-2 rounded-full bg-red-600 shrink-0" />
                        <span>Satıldı</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickSetStatus(ctxUnit.id, 'SATILDI', 'KAPALI')}
                        className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold text-red-700 hover:bg-red-500/15 cursor-pointer text-left"
                      >
                        <span className="w-2 h-2 rounded-full bg-red-800 shrink-0" />
                        <span>Kapalı</span>
                      </button>
                    </div>

                    {isLayoutEditMode && (
                      <>
                        <div className="my-1 border-t border-[#4a443f]/50" />

                        {/* 9. Daireyi Kaldır */}
                        <button
                          type="button"
                          onClick={() => handleDeleteUnitQuick(ctxUnit.id)}
                          className="w-full flex items-center gap-2 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-rose-400 hover:bg-rose-500/20 hover:text-rose-200 transition-colors cursor-pointer text-left"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span>Daireyi Kaldır</span>
                        </button>
                      </>
                    )}
                  </motion.div>
                )
              })()}

              {/* HAVUZ VE DİĞER DAİRE DIŞI ALANLARIN SAĞ TIK BAĞLAM MENÜSÜ */}
              {areaContextMenu && (() => {
                const ctxArea = floorAreas.find((a) => a.id === areaContextMenu.areaId)
                if (!ctxArea) return null

                const areaKindLabelMap: Record<KrokiAreaKind, string> = {
                  pool: 'Havuz Alanı',
                  garden: 'Bahçe / Peyzaj',
                  parking: 'Otopark',
                  corridor: 'Merdiven / Hol',
                  entrance: 'Giriş Alanı',
                  block: 'Blok Çerçevesi',
                  custom: 'Özel / Sosyal Alan',
                }

                const isVertArea =
                  ctxArea.textOrientation === 'vertical' ||
                  (ctxArea.kind === 'entrance' && ctxArea.box.h > ctxArea.box.w * 1.35)
                const activePreset = inferSizePresetFromBox(ctxArea.box)

                const menuWidth = 252
                const menuEstimatedHeight = 465
                const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1440
                const viewportH = typeof window !== 'undefined' ? window.innerHeight : 900
                const safeBottomLimit = viewportH - 84

                const posX =
                  areaContextMenu.x + menuWidth > viewportW - 12
                    ? Math.max(12, areaContextMenu.x - menuWidth)
                    : Math.max(12, areaContextMenu.x)

                const posY =
                  areaContextMenu.y + menuEstimatedHeight > safeBottomLimit
                    ? Math.max(
                        12,
                        Math.min(
                          areaContextMenu.y - menuEstimatedHeight,
                          safeBottomLimit - menuEstimatedHeight
                        )
                      )
                    : Math.max(12, areaContextMenu.y)

                return (
                  <motion.div
                    ref={areaContextMenuRef}
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                      top: posY,
                      left: posX,
                    }}
                    className="fixed z-[9999] w-[252px] max-h-[82vh] overflow-y-auto rounded-2xl bg-[#282522]/98 backdrop-blur-xl border border-[#4a443f] p-1.5 shadow-2xl select-none"
                  >
                    {/* Başlık */}
                    <div className="px-2.5 py-1 text-[10px] font-bold text-[#8c857f] uppercase tracking-wider border-b border-[#4a443f]/60 mb-1 flex items-center justify-between gap-2">
                      <span className="text-white truncate">{ctxArea.label}</span>
                      <span className="text-[9px] text-[#b99881] shrink-0">
                        {areaKindLabelMap[ctxArea.kind] || 'Alan'}
                      </span>
                    </div>

                    {/* 1. Alan Adı / Başlığı Düzenleme */}
                    <div className="px-1.5 py-1">
                      <div className="text-[9px] font-semibold text-[#8c857f] uppercase px-1 mb-1">
                        Alan Başlığı / Yazısı
                      </div>
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={areaLabelEditDraft}
                          onChange={(e) => setAreaLabelEditDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleSaveAreaLabelFromContext(ctxArea.id)
                            }
                          }}
                          placeholder="Alan adı..."
                          className="flex-1 px-2 py-1 rounded-md bg-[#34302d] border border-[#4a443f] text-[10.5px] text-white focus:outline-none focus:border-[#b99881]"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveAreaLabelFromContext(ctxArea.id)}
                          className="px-2 py-1 rounded-md bg-[#b99881] text-white text-[10px] font-semibold cursor-pointer shrink-0"
                        >
                          Kaydet
                        </button>
                      </div>
                    </div>

                    <div className="my-1 border-t border-[#4a443f]/50" />

                    {/* 2. İlk Haline Getir */}
                    <button
                      type="button"
                      onClick={() => handleResetAreaToInitial(ctxArea.id)}
                      className="w-full flex items-center gap-2 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#f3efe9] hover:bg-[#b99881]/25 hover:text-white transition-colors cursor-pointer text-left"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-[#b99881] shrink-0" />
                      <span>İlk Haline Getir</span>
                    </button>

                    {/* 3. Yatay / Dikey Çevir (90°) */}
                    <button
                      type="button"
                      onClick={() => handleRotateAreaBox(ctxArea.id)}
                      className="w-full flex items-center gap-2 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#f3efe9] hover:bg-[#b99881]/25 hover:text-white transition-colors cursor-pointer text-left"
                    >
                      <Compass className="w-3.5 h-3.5 text-[#b99881] shrink-0" />
                      <span>Yatay / Dikey Çevir</span>
                    </button>

                    {/* 4. Alanı Çoğalt */}
                    <button
                      type="button"
                      onClick={() => handleDuplicateArea(ctxArea.id)}
                      className="w-full flex items-center gap-2 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#f3efe9] hover:bg-[#b99881]/25 hover:text-white transition-colors cursor-pointer text-left"
                    >
                      <Copy className="w-3.5 h-3.5 text-[#b99881] shrink-0" />
                      <span>Alanı Çoğalt</span>
                    </button>

                    {/* 5. Yazı Yönü (Yatay / Düşey) */}
                    {ctxArea.kind !== 'block' && (
                      <>
                        <div className="my-1 border-t border-[#4a443f]/50" />
                        <div className="px-2.5 py-0.5 text-[9px] font-semibold text-[#8c857f] uppercase">
                          Yazı Yönü
                        </div>
                        <div className="grid grid-cols-2 gap-1 px-1.5 py-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              projectStore.updateCustomArea(project.id, ctxArea.id, {
                                textOrientation: 'horizontal',
                              })
                              onProjectUpdated()
                            }}
                            className={`py-0.5 px-2 rounded-md text-[9.5px] font-semibold transition-all cursor-pointer text-center ${
                              !isVertArea
                                ? 'bg-[#b99881] text-white'
                                : 'bg-[#34302d] text-[#a69f99] hover:text-white'
                            }`}
                          >
                            Yatay Yazı
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              projectStore.updateCustomArea(project.id, ctxArea.id, {
                                textOrientation: 'vertical',
                              })
                              onProjectUpdated()
                            }}
                            className={`py-0.5 px-2 rounded-md text-[9.5px] font-semibold transition-all cursor-pointer text-center ${
                              isVertArea
                                ? 'bg-[#b99881] text-white'
                                : 'bg-[#34302d] text-[#a69f99] hover:text-white'
                            }`}
                          >
                            Düşey Yazı
                          </button>
                        </div>
                      </>
                    )}

                    {/* 6. Giriş Ok Yönü (Eğer Alan Türü Giriş İse) */}
                    {ctxArea.kind === 'entrance' && (
                      <>
                        <div className="px-2.5 py-0.5 text-[9px] font-semibold text-[#8c857f] uppercase mt-0.5">
                          Giriş Ok Yönü
                        </div>
                        <div className="grid grid-cols-4 gap-1 px-1.5 py-0.5">
                          {(
                            [
                              { dir: 'up', lbl: '↑ Yukarı' },
                              { dir: 'right', lbl: '→ Sağa' },
                              { dir: 'down', lbl: '↓ Aşağı' },
                              { dir: 'left', lbl: '← Sola' },
                            ] as const
                          ).map((item) => (
                            <button
                              key={item.dir}
                              type="button"
                              onClick={() => {
                                projectStore.updateCustomArea(project.id, ctxArea.id, {
                                  direction: item.dir,
                                })
                                onProjectUpdated()
                              }}
                              className={`py-0.5 px-1 rounded-md text-[9px] font-semibold transition-all cursor-pointer text-center ${
                                (ctxArea.direction || 'up') === item.dir
                                  ? 'bg-[#b99881] text-white'
                                  : 'bg-[#34302d] text-[#a69f99] hover:text-white'
                              }`}
                            >
                              {item.lbl}
                            </button>
                          ))}
                        </div>
                      </>
                    )}

                    <div className="my-1 border-t border-[#4a443f]/50" />

                    {/* 7. Plan Ölçeği (1:1, 16:9, 9:16) */}
                    <div className="px-2.5 py-0.5 text-[9px] font-semibold text-[#8c857f] uppercase">
                      Plan Ölçeği
                    </div>
                    <div className="grid grid-cols-3 gap-1 px-1.5 py-0.5">
                      {SELECTABLE_SIZE_PRESETS.map((presetKey) => {
                        const info = UNIT_SIZE_PRESETS[presetKey]
                        const isActive = activePreset === presetKey
                        return (
                          <button
                            key={presetKey}
                            type="button"
                            onClick={() => {
                              handleApplyAreaSizePreset(ctxArea, presetKey)
                              setAreaContextMenu(null)
                            }}
                            className={`py-1 px-2 rounded-md text-[10px] font-bold transition-all cursor-pointer text-center ${
                              isActive
                                ? 'bg-[#b99881] text-white'
                                : 'bg-[#34302d] text-[#a69f99] hover:text-white'
                            }`}
                          >
                            {info.shortLabel}
                          </button>
                        )
                      })}
                    </div>

                    <div className="my-1 border-t border-[#4a443f]/50" />

                    {/* 8. Alan Türü Değiştir */}
                    <div className="px-2.5 py-0.5 text-[9px] font-semibold text-[#8c857f] uppercase">
                      Alan Türü
                    </div>
                    <div className="grid grid-cols-2 gap-1 px-1.5 py-0.5">
                      {(
                        [
                          { kind: 'pool', label: 'Havuz' },
                          { kind: 'garden', label: 'Bahçe / Peyzaj' },
                          { kind: 'parking', label: 'Otopark' },
                          { kind: 'corridor', label: 'Merdiven / Hol' },
                          { kind: 'entrance', label: 'Giriş' },
                          { kind: 'block', label: 'Blok' },
                          { kind: 'custom', label: 'Özel Alan' },
                        ] as { kind: KrokiAreaKind; label: string }[]
                      ).map((opt) => (
                        <button
                          key={opt.kind}
                          type="button"
                          onClick={() => {
                            projectStore.updateCustomArea(project.id, ctxArea.id, {
                              kind: opt.kind,
                            })
                            onProjectUpdated()
                          }}
                          className={`py-0.5 px-2 rounded-md text-[9.5px] font-semibold transition-all cursor-pointer truncate text-left ${
                            ctxArea.kind === opt.kind
                              ? 'bg-[#b99881] text-white'
                              : 'bg-[#34302d] text-[#a69f99] hover:text-white'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    <div className="my-1 border-t border-[#4a443f]/50" />

                    {/* 9. Kat Görünürlüğü (Tüm Katlar / Sadece Bu Kat) */}
                    <div className="px-2.5 py-0.5 text-[9px] font-semibold text-[#8c857f] uppercase">
                      Kat Görünürlüğü
                    </div>
                    <div className="grid grid-cols-2 gap-1 px-1.5 py-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          projectStore.updateCustomArea(project.id, ctxArea.id, {
                            floor: 'ALL',
                          })
                          onProjectUpdated()
                        }}
                        className={`py-0.5 px-2 rounded-md text-[9.5px] font-semibold transition-all cursor-pointer truncate text-center ${
                          ctxArea.floor === undefined || ctxArea.floor === 'ALL'
                            ? 'bg-[#b99881] text-white'
                            : 'bg-[#34302d] text-[#a69f99] hover:text-white'
                        }`}
                      >
                        Tüm Katlarda
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          projectStore.updateCustomArea(project.id, ctxArea.id, {
                            floor: selectedFloor,
                          })
                          onProjectUpdated()
                        }}
                        className={`py-0.5 px-2 rounded-md text-[9.5px] font-semibold transition-all cursor-pointer truncate text-center ${
                          ctxArea.floor === selectedFloor
                            ? 'bg-[#b99881] text-white'
                            : 'bg-[#34302d] text-[#a69f99] hover:text-white'
                        }`}
                      >
                        Sadece {FLOOR_LABELS[selectedFloor]?.short}
                      </button>
                    </div>

                    <div className="my-1 border-t border-[#4a443f]/50" />

                    {/* 10. Alanı / Bloğu Kaldır */}
                    {ctxArea.kind === 'block' ? (
                      <div className="space-y-1">
                        <div className="px-2.5 py-0.5 text-[9px] font-semibold text-rose-400/90 uppercase">
                          Bloğu Sil Seçenekleri
                        </div>
                        <button
                          type="button"
                          onClick={() => handleExecuteBlockDeletion(ctxArea.id, 'only-block')}
                          className="w-full flex items-center gap-2 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-amber-300 hover:bg-amber-500/20 hover:text-amber-100 transition-colors cursor-pointer text-left"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>Yalnızca Bloğu Sil</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const children = captureBlockChildren(ctxArea.id, ctxArea.box)
                            const uIds = children.filter((c) => c.kind === 'unit').map((c) => c.id)
                            const aIds = children.filter((c) => c.kind === 'area').map((c) => c.id)
                            handleExecuteBlockDeletion(ctxArea.id, 'with-elements', uIds, aIds)
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-rose-400 hover:bg-rose-500/20 hover:text-rose-200 transition-colors cursor-pointer text-left"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span>Elementlerle Birlikte Sil</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleDeleteAreaQuick(ctxArea.id)}
                        className="w-full flex items-center gap-2 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-rose-400 hover:bg-rose-500/20 hover:text-rose-200 transition-colors cursor-pointer text-left"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span>Alanı Kaldır</span>
                      </button>
                    )}
                  </motion.div>
                )
              })()}

              {/* BLOK SİLME SEÇENEKLERİ DİYALOĞU ("Yalnızca Bloğu Sil" / "Elementlerle Birlikte Sil") */}
              {blockDeleteModal && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
                  onClick={() => setBlockDeleteModal(null)}
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 6 }}
                    transition={{ duration: 0.14 }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-sm rounded-3xl bg-[#282522] border border-[#4a443f] p-5 shadow-2xl space-y-4"
                  >
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Trash2 className="w-4 h-4 text-rose-400" />
                        <span>{blockDeleteModal.blockLabel} Silinsin mi?</span>
                      </h4>
                      <p className="text-xs text-[#a69f99] leading-relaxed">
                        Bu bloğun içinde{' '}
                        <span className="text-white font-semibold">
                          {blockDeleteModal.childUnitIds.length} daire
                        </span>
                        {blockDeleteModal.childAreaIds.length > 0 && (
                          <>
                            {' '}ve{' '}
                            <span className="text-white font-semibold">
                              {blockDeleteModal.childAreaIds.length} alan
                            </span>
                          </>
                        )}{' '}
                        bulunuyor. Nasıl silmek istersiniz?
                      </p>
                    </div>

                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleExecuteBlockDeletion(blockDeleteModal.blockId, 'only-block')
                        }
                        className="w-full px-4 py-2.5 rounded-full bg-[#34302d] hover:bg-[#b99881] text-xs font-semibold text-white transition-colors cursor-pointer text-center"
                      >
                        Yalnızca Bloğu Sil
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleExecuteBlockDeletion(
                            blockDeleteModal.blockId,
                            'with-elements',
                            blockDeleteModal.childUnitIds,
                            blockDeleteModal.childAreaIds
                          )
                        }
                        className="w-full px-4 py-2.5 rounded-full bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white transition-colors cursor-pointer text-center"
                      >
                        Elementlerle Birlikte Sil
                      </button>
                      <button
                        type="button"
                        onClick={() => setBlockDeleteModal(null)}
                        className="w-full px-4 py-1.5 rounded-full text-xs font-medium text-[#a69f99] hover:text-white transition-colors cursor-pointer text-center"
                      >
                        Vazgeç
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>,
            document.body
          )}

        {/* SAĞ SÜTUN: HİÇBİR DAİRE SEÇİLMEDİĞİNDE PROJE BİLGİSİ, DAİREYE TIKLANDIĞINDA DAİRE BİLGİSİ */}
        <div className="p-3.5 rounded-[24px] bg-[#282522] border border-[#4a443f] flex flex-col justify-between min-h-[635px] xl:min-h-[650px] h-full">
          {activeUnit ? (
            (() => {
              const { blockName: unitBlockName, entranceName: unitEntranceName } =
                resolveUnitBlockAndEntrance(activeUnit)
              return (
                <>
                  <div className="space-y-3.5">
                    {/* Üst Başlık */}
                    <div className="space-y-2 pb-2.5 border-b border-[#4a443f]/50">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-base font-bold text-white leading-tight">
                          {activeUnit.unitNumber}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              activeUnit.status === 'SATISTA'
                                ? 'unit-badge-available'
                                : activeUnit.status === 'REZERVE'
                                ? 'unit-badge-deposit'
                                : 'unit-badge-sold'
                            }`}
                          >
                            {activeUnit.status === 'SATISTA'
                              ? 'Satışta'
                              : activeUnit.status === 'REZERVE'
                              ? activeUnit.statusLabel && !/^satışta$/i.test(activeUnit.statusLabel)
                                ? activeUnit.statusLabel
                                : 'Kapora / Rezerve'
                              : activeUnit.statusLabel || 'SATILDI'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setActiveUnitId(null)}
                            className="w-6 h-6 rounded-full bg-[#34302d] hover:bg-[#b99881] text-[#a69f99] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                            title="Proje Bilgilerine Dön"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#34302d] font-semibold text-[#f3efe9]">
                          {unitBlockName} • {unitEntranceName}
                        </span>
                        <span className="text-[11px] text-[#a69f99]">
                          {activeUnit.roomType}
                        </span>
                      </div>
                    </div>

                    {/* Daire Bilgileri: Katı, Bloğu, Girişi, Oda Tipi, Net ve Brüt Alanı, Liste Fiyatı */}
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-center py-1 border-b border-[#4a443f]/30">
                        <span className="text-[#a69f99]">Bulunduğu Kat</span>
                        <span className="font-semibold text-white text-right">
                          {FLOOR_LABELS[Math.max(0, Math.min(2, activeUnit.floor))]?.short}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-[#4a443f]/30">
                        <span className="text-[#a69f99]">Blok</span>
                        <span className="font-semibold text-white text-right">
                          {unitBlockName}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-[#4a443f]/30">
                        <span className="text-[#a69f99]">Giriş</span>
                        <span className="font-semibold text-white text-right">
                          {unitEntranceName}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-[#4a443f]/30">
                        <span className="text-[#a69f99]">Oda Tipi</span>
                        <span className="font-semibold text-white">{activeUnit.roomType}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-[#4a443f]/30">
                        <span className="text-[#a69f99]">Net / Brüt Alan</span>
                        <span className="font-semibold text-white">
                          {activeUnit.netSqm} m² Net / {activeUnit.grossSqm} m² Brüt
                        </span>
                      </div>
                      {activeUnit.facade && (
                        <div className="flex justify-between items-center gap-2 py-1 border-b border-[#4a443f]/30">
                          <span className="text-[#a69f99] shrink-0">Cephe</span>
                          <span className="font-semibold text-white text-right truncate">
                            {activeUnit.facade}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between items-center py-1 border-b border-[#4a443f]/30">
                        <span className="text-[#a69f99]">Liste Fiyatı</span>
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-bold font-mono text-white">
                            {activeUnit.price > 0
                              ? formatCurrency(activeUnit.price)
                              : 'Belirlenmedi'}
                          </span>
                          {isLayoutEditMode && canEditPrice && activeUnit.status === 'SATISTA' && (
                            <button
                              type="button"
                              onClick={() => onEditPrice(activeUnit)}
                              className="p-1 rounded-full bg-[#34302d] hover:bg-[#b99881] transition-colors cursor-pointer"
                              title="Fiyatı Güncelle"
                            >
                              <TurkishLira className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Kapora / Peşinat / Rezervasyon Bilgisi Varsa */}
                    {activeUnit.status === 'REZERVE' && activeUnit.reservation && (
                      <div className="p-2.5 rounded-2xl unit-card-deposit space-y-1 text-xs">
                        <div className="font-semibold flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5" />
                          <span>{activeUnit.reservation.customerName}</span>
                        </div>
                        {activeUnit.reservation.depositAmount ? (
                          <div className="text-[11px] font-mono font-bold">
                            Kapora / Peşinat: {formatCurrency(activeUnit.reservation.depositAmount)}
                          </div>
                        ) : null}
                        <div className="text-[10px] opacity-85 flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          <span>
                            Bitiş:{' '}
                            {new Date(activeUnit.reservation.expiresAt).toLocaleDateString('tr-TR')}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Satış Bilgisi Varsa */}
                    {activeUnit.status === 'SATILDI' && activeUnit.sale && (
                      <div className="p-2.5 rounded-2xl bg-rose-500/10 space-y-1 text-xs">
                        <div className="font-semibold text-rose-400 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Alıcı: {activeUnit.sale.customerName}</span>
                        </div>
                        <div className="text-[10px] text-[#8c857f]">
                          Satış: {formatCurrency(activeUnit.sale.salePrice)}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Alt Aksiyon Butonları: Daireyi Düzenle (Tek Satır Sığdırılmış) + Geçmiş (Sadece İkon) */}
                  <div className="space-y-2 pt-3 mt-auto border-t border-[#4a443f]/40">
                    {activeUnit.status === 'SATISTA' && (
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => onReserveUnit(activeUnit)}
                          className="py-2 px-2.5 rounded-full unit-badge-deposit text-xs font-semibold cursor-pointer transition-colors hover:opacity-95"
                        >
                          Kapora / Rezerve
                        </button>
                        <button
                          type="button"
                          onClick={() => onSellUnit(activeUnit)}
                          className="py-2 px-2.5 rounded-full bg-[#b99881] text-white text-xs font-semibold cursor-pointer transition-colors"
                        >
                          Satış Yap
                        </button>
                      </div>
                    )}

                    {activeUnit.status === 'REZERVE' && (
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => onSellUnit(activeUnit)}
                          className="py-2 px-2.5 rounded-full bg-[#b99881] text-white text-xs font-semibold cursor-pointer transition-colors"
                        >
                          Satışa Çevir
                        </button>
                        <button
                          type="button"
                          onClick={() => onCancelReserve(activeUnit)}
                          className="py-2 px-2.5 rounded-full bg-rose-500/15 hover:bg-rose-500/25 text-xs font-semibold cursor-pointer transition-colors"
                        >
                          İptal Et
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5">
                      {isLayoutEditMode && (
                        <button
                          type="button"
                          onClick={() => onEditUnit(activeUnit)}
                          className="flex-1 py-2 px-3 rounded-full bg-[#34302d] hover:bg-[#3d3733] text-xs font-semibold whitespace-nowrap flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-[#b99881] shrink-0" />
                          <span>Daireyi Düzenle</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onOpenHistory(activeUnit)}
                        className={`${isLayoutEditMode ? 'w-9 h-9 shrink-0' : 'w-full py-2 px-3 gap-1.5 text-xs font-semibold'} rounded-full bg-[#34302d] hover:bg-[#3d3733] flex items-center justify-center cursor-pointer transition-colors`}
                        title="Durum Değişiklik Geçmişi"
                      >
                        <History className="w-4 h-4 text-[#b99881]" />
                        {!isLayoutEditMode && <span>Durum Geçmişi</span>}
                      </button>
                    </div>
                  </div>
                </>
              )
            })()
          ) : (
            /* HİÇBİR DAİRE/ALANA TIKLANMADIĞINDA PROJE BİLGİSİ GÖRÜNÜMÜ */
            (() => {
              const pricedUnits = units.filter((u) => u.price > 0)
              const minPrice =
                pricedUnits.length > 0
                  ? Math.min(...pricedUnits.map((u) => u.price))
                  : project.startingPrice || 0
              const maxPrice =
                pricedUnits.length > 0
                  ? Math.max(...pricedUnits.map((u) => u.price))
                  : project.startingPrice || 0

              const grossList = units.map((u) => u.grossSqm).filter((v) => v > 0)
              const netList = units.map((u) => u.netSqm).filter((v) => v > 0)
              const minGross = grossList.length > 0 ? Math.min(...grossList) : 0
              const maxGross = grossList.length > 0 ? Math.max(...grossList) : 0
              const minNet = netList.length > 0 ? Math.min(...netList) : 0
              const maxNet = netList.length > 0 ? Math.max(...netList) : 0

              const availTotal = units.filter((u) => u.status === 'SATISTA').length
              const reservedTotal = units.filter((u) => u.status === 'REZERVE').length
              const soldTotal = units.filter((u) => u.status === 'SATILDI').length
              const distinctRoomTypes = Array.from(new Set(units.map((u) => u.roomType))).join(', ')
              const locationDisplay =
                [project.district, project.city].filter(Boolean).join(' / ') ||
                project.location ||
                'Belirtilmedi'

              return (
                <div className="flex flex-col justify-between h-full space-y-4">
                  <div className="space-y-3.5">
                    {/* Proje Başlığı ve Durumu */}
                    <div className="space-y-1.5 pb-2.5 border-b border-[#4a443f]/50">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#b99881]">
                            Proje Bilgileri • {project.code}
                          </span>
                          <h5 className="text-base font-bold text-white leading-tight mt-0.5">
                            {project.name}
                          </h5>
                        </div>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                            project.status === 'SATISTA'
                              ? 'bg-emerald-600 !text-white'
                              : project.status === 'YAKINDA'
                              ? 'bg-amber-500 !text-white'
                              : 'bg-[#34302d] text-white'
                          }`}
                        >
                          {project.status === 'SATISTA'
                            ? 'Satışta'
                            : project.status === 'YAKINDA'
                            ? 'Yakında'
                            : 'Tamamlandı'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-[#d6beae]">
                        <MapPin className="w-3.5 h-3.5 text-[#b99881] shrink-0" />
                        <span className="truncate">{locationDisplay}</span>
                      </div>
                    </div>

                    {/* Proje Teknik ve Ticari Özeti */}
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-center gap-2 py-1 border-b border-[#4a443f]/30">
                        <span className="text-[#a69f99] shrink-0">Konum</span>
                        <span className="font-semibold text-white text-right truncate">
                          {locationDisplay}
                        </span>
                      </div>

                      {project.mevki && (
                        <div className="flex justify-between items-center gap-2 py-1 border-b border-[#4a443f]/30">
                          <span className="text-[#a69f99] shrink-0">Mevki</span>
                          <span className="font-semibold text-white text-right truncate">
                            {project.mevki}
                          </span>
                        </div>
                      )}

                      {project.parcelInfo && (
                        <div className="flex justify-between items-center gap-2 py-1 border-b border-[#4a443f]/30">
                          <span className="text-[#a69f99] shrink-0">Ada / Parsel</span>
                          <span className="font-semibold text-white text-right truncate">
                            {project.parcelInfo}
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between items-center py-1 border-b border-[#4a443f]/30">
                        <span className="text-[#a69f99]">Min. Daire Fiyatı</span>
                        <span className="font-bold font-mono text-emerald-400">
                          {minPrice > 0 ? formatCurrency(minPrice) : 'Belirlenmedi'}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-1 border-b border-[#4a443f]/30">
                        <span className="text-[#a69f99]">Maks. Daire Fiyatı</span>
                        <span className="font-bold font-mono text-white">
                          {maxPrice > 0 ? formatCurrency(maxPrice) : 'Belirlenmedi'}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-1 border-b border-[#4a443f]/30">
                        <span className="text-[#a69f99]">Minimum m²</span>
                        <span className="font-semibold text-white">
                          {minNet > 0 ? `${minNet} m² Net (${minGross} m² Brüt)` : '-'}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-1 border-b border-[#4a443f]/30">
                        <span className="text-[#a69f99]">Maksimum m²</span>
                        <span className="font-semibold text-white">
                          {maxNet > 0 ? `${maxNet} m² Net (${maxGross} m² Brüt)` : '-'}
                        </span>
                      </div>

                      <div className="flex justify-between items-center gap-2 py-1 border-b border-[#4a443f]/30">
                        <span className="text-[#a69f99] shrink-0">Oda Tipleri</span>
                        <span className="font-semibold text-white text-right truncate">
                          {distinctRoomTypes || project.type || 'Karma'}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-1 border-b border-[#4a443f]/30">
                        <span className="text-[#a69f99]">Blok & Kat Yapısı</span>
                        <span className="font-semibold text-white">
                          {blocks.length} Blok • {configuredMaxFloors} Kat
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-1 border-b border-[#4a443f]/30">
                        <span className="text-[#a69f99]">Teslim Tarihi</span>
                        <span className="font-semibold text-white flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-[#b99881]" />
                          {project.deliveryDate || 'Belirtilmedi'}
                        </span>
                      </div>
                    </div>

                    {/* Bağımsız Bölüm Durum Özeti */}
                    <div className="grid grid-cols-3 gap-1.5 pt-1">
                      <div className="p-2 rounded-2xl unit-card-available text-center">
                        <div className="text-[10px] font-semibold text-emerald-800">Satışta</div>
                        <div className="text-sm font-bold text-emerald-700 font-mono">
                          {availTotal}
                        </div>
                      </div>
                      <div className="p-2 rounded-2xl unit-card-deposit text-center">
                        <div className="text-[10px] font-semibold">Kapora</div>
                        <div className="text-sm font-bold font-mono">
                          {reservedTotal}
                        </div>
                      </div>
                      <div className="p-2 rounded-2xl unit-card-sold text-center">
                        <div className="text-[10px] font-semibold">Satılan</div>
                        <div className="text-sm font-bold font-mono">
                          {soldTotal}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-[#4a443f]/40 text-[11px] text-[#a69f99] text-center">
                    Daire detaylarını görüntülemek için kroki üzerinden bir daireye tıklayın.
                  </div>
                </div>
              )
            })()
          )}
        </div>
      </div>
    </div>
  )
}
