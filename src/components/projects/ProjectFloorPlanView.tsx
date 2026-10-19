import React, { useState, useRef, useEffect, useMemo } from 'react'
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

  const cols = totalOnFloor <= 2 ? Math.max(1, totalOnFloor) : totalOnFloor <= 4 ? 2 : 3
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

  // Distinct blocks / entrances
  const blocks = useMemo(() => {
    const set = new Set<string>()
    units.forEach((u) => set.add(u.block || 'A Blok'))
    return Array.from(set)
  }, [units])

  // Default to 'ALL' (Tüm Plan) so multi-entrance site plans (like Almina 2 A Giriş + B Giriş) show together on the floor canvas
  const [selectedBlock, setSelectedBlock] = useState<string>('ALL')

  useEffect(() => {
    if (selectedBlock !== 'ALL' && !blocks.includes(selectedBlock)) {
      setSelectedBlock('ALL')
    }
  }, [blocks, selectedBlock])

  // Units filtered by block (or all units if 'ALL')
  const blockUnits = useMemo(
    () =>
      selectedBlock === 'ALL'
        ? units
        : units.filter((u) => (u.block || 'A Blok') === selectedBlock),
    [units, selectedBlock]
  )

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

  // Units on active floor
  const floorUnits = useMemo(
    () =>
      blockUnits.filter((u) => Math.max(0, Math.min(2, u.floor)) === selectedFloor),
    [blockUnits, selectedFloor]
  )

  // Selected unit for right-side inspector panel
  const [activeUnitId, setActiveUnitId] = useState<string | null>(floorUnits[0]?.id || null)
  // Selected custom area in edit mode
  const [activeAreaId, setActiveAreaId] = useState<string | null>(null)

  useEffect(() => {
    if (!floorUnits.some((u) => u.id === activeUnitId)) {
      setActiveUnitId(floorUnits[0]?.id || null)
    }
  }, [floorUnits, activeUnitId])

  const activeUnit = useMemo(
    () => floorUnits.find((u) => u.id === activeUnitId) || floorUnits[0] || null,
    [floorUnits, activeUnitId]
  )

  // Architectural Layout Template
  const layoutTemplate: BlueprintLayoutTemplate = project.layoutTemplate || 'quad'

  // Floor Plan Image key: specific floor key or fallback to DEFAULT project blueprint
  const floorKey = `${selectedBlock}::${selectedFloor}`
  const specificFloorPlan = project.floorPlans?.[floorKey]
  const defaultFloorPlan = project.floorPlans?.['DEFAULT'] || project.blueprintUrl
  const activeFloorPlanUrl = specificFloorPlan || defaultFloorPlan || null

  // Custom Areas (HAVUZ, A Giriş, B Giriş, Otopark, Bahçe vb.) visible on this floor
  const floorAreas = useMemo(() => {
    const allAreas = project.customAreas || []
    return allAreas.filter(
      (a) => a.floor === undefined || a.floor === 'ALL' || a.floor === selectedFloor
    )
  }, [project.customAreas, selectedFloor])

  // Auto-resolve any overlapping boxes or bogus floor-title badges on the active floor
  useEffect(() => {
    let mutated = false
    const allAreas = project.customAreas || []

    // 1. Remove bogus floor-title custom areas (e.g. "ZEMİN KAT")
    allAreas.forEach((a) => {
      if (/^(zemin\s*kat|giriş\s*kat|1\s*\.\s*kat|birinci\s*kat|2\s*\.\s*kat|ikinci\s*kat)$/i.test(a.label.trim())) {
        projectStore.deleteCustomArea(project.id, a.id)
        mutated = true
      }
    })

    // 2. Check if any boxes on the current floor overlap or exceed the facade safe zone
    const bounds = {
      minX: 8.5,
      maxX: 90.5,
      minY: 9.5,
      maxY: project.paymentBanner ? 81.5 : 88.5,
    }
    const validFloorAreas = (project.customAreas || []).filter(
      (a) =>
        !/^(zemin\s*kat|giriş\s*kat|1\s*\.\s*kat|birinci\s*kat|2\s*\.\s*kat|ikinci\s*kat)$/i.test(a.label.trim()) &&
        (a.floor === undefined || a.floor === 'ALL' || a.floor === selectedFloor)
    )
    const unitBoxes = floorUnits.map(
      (u, idx) => u.planBox || getDefaultUnitPlanBox(idx, floorUnits.length, layoutTemplate, u.sizePreset)
    )
    const combinedBoxes = [...validFloorAreas.map((a) => a.box), ...unitBoxes]

    let hasCollision = false
    for (let i = 0; i < combinedBoxes.length; i++) {
      const b1 = combinedBoxes[i]
      if (
        b1.x < bounds.minX - 0.5 ||
        b1.x + b1.w > bounds.maxX + 0.5 ||
        b1.y < bounds.minY - 0.5 ||
        b1.y + b1.h > bounds.maxY + 0.5
      ) {
        hasCollision = true
        break
      }
      for (let j = i + 1; j < combinedBoxes.length; j++) {
        if (boxesOverlap(b1, combinedBoxes[j], 0.4)) {
          hasCollision = true
          break
        }
      }
      if (hasCollision) break
    }

    if (hasCollision) {
      const isAlminaStyle =
        Boolean(project.parcelInfo?.includes('996')) ||
        Boolean(project.paymentBanner?.includes('1.500.000')) ||
        validFloorAreas.some((a) => a.kind === 'pool')

      const placed: UnitPlanBox[] = []
      validFloorAreas.forEach((a) => {
        let nextAreaBox = a.box
        if (isAlminaStyle) {
          if (a.kind === 'pool') nextAreaBox = { x: 38.0, y: 45.5, w: 29.0, h: 34.0 }
          else if (a.kind === 'entrance' && /b\s*giriş/i.test(a.label))
            nextAreaBox = { x: 24.5, y: 36.5, w: 9.0, h: 6.5 }
          else if (a.kind === 'entrance' && /a\s*giriş/i.test(a.label))
            nextAreaBox = { x: 59.0, y: 36.5, w: 9.5, h: 6.5 }
        }
        const safeAreaBox = findNonOverlappingBox(nextAreaBox, placed, bounds, 0.8)
        placed.push(safeAreaBox)
        if (
          safeAreaBox.x !== a.box.x ||
          safeAreaBox.y !== a.box.y ||
          safeAreaBox.w !== a.box.w ||
          safeAreaBox.h !== a.box.h
        ) {
          projectStore.updateCustomArea(project.id, a.id, { box: safeAreaBox })
          mutated = true
        }
      })

      const topAlmina: UnitPlanBox[] = [
        { x: 9.0, y: 10.0, w: 19.0, h: 25.0 },
        { x: 29.5, y: 10.0, w: 19.0, h: 25.0 },
        { x: 50.0, y: 10.0, w: 19.0, h: 25.0 },
        { x: 70.5, y: 10.0, w: 19.5, h: 25.0 },
      ]
      const rightAlmina: UnitPlanBox[] = [
        { x: 70.5, y: 37.0, w: 9.2, h: 43.0 },
        { x: 80.8, y: 37.0, w: 9.2, h: 43.0 },
      ]

      floorUnits.forEach((u, idx) => {
        let desired: UnitPlanBox
        let preset = u.sizePreset
        if (isAlminaStyle && floorUnits.length >= 6) {
          if (idx < 4) {
            desired = { ...topAlmina[idx] }
            preset = 'wide-rect'
          } else if (idx < 6) {
            desired = { ...rightAlmina[idx - 4] }
            preset = 'narrow-v'
          } else {
            desired = { x: 10.0, y: 46.0, w: 24.0, h: 33.0 }
          }
        } else {
          desired =
            u.planBox || getDefaultUnitPlanBox(idx, floorUnits.length, layoutTemplate, u.sizePreset)
        }
        const safeUnitBox = findNonOverlappingBox(desired, placed, bounds, 1.0)
        placed.push(safeUnitBox)
        if (
          !u.planBox ||
          safeUnitBox.x !== u.planBox.x ||
          safeUnitBox.y !== u.planBox.y ||
          safeUnitBox.w !== u.planBox.w ||
          safeUnitBox.h !== u.planBox.h
        ) {
          projectStore.updateUnitPlanBox(project.id, u.id, safeUnitBox, preset)
          mutated = true
        }
      })
    }

    if (mutated) {
      onProjectUpdated()
    }
  }, [project.id, selectedFloor, floorUnits.length, floorAreas.length])

  // Custom Facades (Kuzey, Güney, Doğu, Batı, Deniz Cephesi vb.)
  const customFacades: KrokiFacadeItem[] = useMemo(() => {
    const raw =
      project.customFacades && project.customFacades.length > 0
        ? project.customFacades
        : DEFAULT_KROKI_FACADES
    // Deduplicate so each edge only holds its intended unique facades and never overlaps
    const seen = new Set<string>()
    return raw.filter((f) => {
      const key = `${f.edge}-${f.label.trim().toLowerCase()}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
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
  const [planOpacity, setPlanOpacity] = useState<number>(85)
  const canvasRef = useRef<HTMLDivElement>(null)
  const fileInputUniversalRef = useRef<HTMLInputElement>(null)
  const fileInputFloorRef = useRef<HTMLInputElement>(null)

  // Modals / Popovers for "+ Daire Ekle", "+ Alan Ekle", "+ Cephe Ekle"
  const [showAddUnitForm, setShowAddUnitForm] = useState(false)
  const [newUnitDraft, setNewUnitDraft] = useState<{
    unitNumber: string
    block: string
    roomType: RoomType
    sizePreset: UnitSizePreset
    price: number
    status: FlatStatus
    statusLabel: string
  }>({
    unitNumber: '',
    block: blocks[0] || 'A Giriş',
    roomType: '2+1',
    sizePreset: 'wide-rect',
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
    sizePreset: 'wide-rect',
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

  // Unified Drag & Apple-Widget Corner Resize State for both Units and Areas
  const [interactionState, setInteractionState] = useState<{
    targetType: 'unit' | 'area'
    targetId: string
    mode: 'move' | 'resize'
    startX: number
    startY: number
    initialBox: UnitPlanBox
  } | null>(null)

  // Daire Sağ Tık Bağlam Menüsü State'i
  const [unitContextMenu, setUnitContextMenu] = useState<{
    unitId: string
    x: number
    y: number
  } | null>(null)
  const unitContextMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        unitContextMenuRef.current &&
        !unitContextMenuRef.current.contains(e.target as Node)
      ) {
        setUnitContextMenu(null)
      }
    }
    if (unitContextMenu) {
      window.addEventListener('mousedown', handleOutsideClick)
      window.addEventListener('scroll', () => setUnitContextMenu(null), true)
    }
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [unitContextMenu])

  // Daireyi ilk default haline / konumuna getir
  const handleResetUnitToInitial = (targetUnitId: string) => {
    const uIdx = floorUnits.findIndex((u) => u.id === targetUnitId)
    const targetUnit = floorUnits[uIdx]
    if (!targetUnit) return
    const initialBox = getDefaultUnitPlanBox(
      Math.max(0, uIdx),
      floorUnits.length,
      layoutTemplate,
      targetUnit.sizePreset
    )
    projectStore.updateUnitPlanBox(project.id, targetUnitId, initialBox, targetUnit.sizePreset)
    setUnitContextMenu(null)
    onProjectUpdated()
  }

  // Daire durumunu bağlam menüsünden hızlı güncelle
  const handleQuickSetStatus = (targetUnitId: string, status: FlatStatus) => {
    const statusLabel =
      status === 'SATISTA' ? 'Satışta' : status === 'REZERVE' ? 'Rezerve' : 'Satıldı'
    projectStore.updateUnitDetails(project.id, targetUnitId, { status, statusLabel })
    setUnitContextMenu(null)
    onProjectUpdated()
  }

  // Daireyi kopyala / çoğalt
  const handleDuplicateUnit = (targetUnitId: string) => {
    const targetUnit = floorUnits.find((u) => u.id === targetUnitId)
    if (!targetUnit) return
    const res = projectStore.addUnitToFloor(project.id, selectedFloor, {
      unitNumber: `${targetUnit.unitNumber} (Kopya)`,
      block: targetUnit.block,
      roomType: targetUnit.roomType,
      sizePreset: targetUnit.sizePreset || 'wide-rect',
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
      minX: 9.0,
      maxX: 90.0,
      minY: 10.0,
      maxY: project.paymentBanner ? 80.5 : 88.0,
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
  // + magnetic sibling alignment, while NEVER overlapping sibling boxes or perimeter/corner facade badges
  const clampBoxAvoidingFacades = (
    rawBox: UnitPlanBox,
    mode: 'move' | 'resize',
    activeTargetId?: string,
    useRulerSnap = false,
    allowGridRelocate = false
  ): UnitPlanBox => {
    const hasTop =
      isLayoutEditMode ||
      customFacades.some((f) => f.edge === 'top' || f.edge === 'top-left' || f.edge === 'top-right')
    const hasBottom =
      isLayoutEditMode ||
      customFacades.some(
        (f) => f.edge === 'bottom' || f.edge === 'bottom-left' || f.edge === 'bottom-right'
      )
    const hasLeft =
      isLayoutEditMode ||
      customFacades.some((f) => f.edge === 'left' || f.edge === 'top-left' || f.edge === 'bottom-left')
    const hasRight =
      isLayoutEditMode ||
      customFacades.some(
        (f) => f.edge === 'right' || f.edge === 'top-right' || f.edge === 'bottom-right'
      )

    const minX = hasLeft ? 8.5 : 2.0
    const maxX = hasRight ? 91.0 : 98.0
    const minY = hasTop ? 9.5 : 2.0
    const maxY = hasBottom
      ? project.paymentBanner
        ? 81.5
        : 89.5
      : project.paymentBanner
      ? 90.5
      : 98.0

    let { x, y, w, h } = rawBox

    // Collect all other boxes on this floor + current saved box of the active target
    const siblingBoxes: UnitPlanBox[] = []
    let prevValidBox: UnitPlanBox | undefined
    floorUnits.forEach((u, idx) => {
      const b =
        u.planBox || getDefaultUnitPlanBox(idx, floorUnits.length, layoutTemplate, u.sizePreset)
      if (u.id === activeTargetId) {
        prevValidBox = b
        return
      }
      siblingBoxes.push(b)
    })
    floorAreas.forEach((a) => {
      if (a.id === activeTargetId) {
        prevValidBox = a.box
        return
      }
      siblingBoxes.push(a.box)
    })

    // Also collect rendered DOM facade badge bounding boxes as obstacles
    const facadeObstacles: UnitPlanBox[] = []
    if (canvasRef.current) {
      const canvasRect = canvasRef.current.getBoundingClientRect()
      if (canvasRect.width > 0 && canvasRect.height > 0) {
        const badgeEls = canvasRef.current.querySelectorAll('[data-facade-badge="true"]')
        badgeEls.forEach((el) => {
          const r = el.getBoundingClientRect()
          if (r.width <= 0 || r.height <= 0) return
          const fx = ((r.left - canvasRect.left) / canvasRect.width) * 100
          const fy = ((r.top - canvasRect.top) / canvasRect.height) * 100
          const fw = (r.width / canvasRect.width) * 100
          const fh = (r.height / canvasRect.height) * 100
          facadeObstacles.push({ x: fx, y: fy, w: fw, h: fh })
        })
      }
    }

    const allObstacles: UnitPlanBox[] = [...siblingBoxes, ...facadeObstacles]
    const MIN_GAP = 0.8

    // Standardized Cetvel / Ölçek Snapping (Hafif Mıknatıs Etkisi - Yan Yana ve Üst Üste Eşit Hizada Oturma)
    if (useRulerSnap) {
      const RULER_STEP = 1.0
      const MAGNET_THRESH = 2.8 // Mıknatıs çekim eşiği (yan yana ve üst üste eşit hizalarda tam oturma)

      if (mode === 'move') {
        let snappedX = Math.round(x / 2.0) * 2.0
        let snappedY = Math.round(y / 2.0) * 2.0
        let bestXDist = MAGNET_THRESH
        let bestYDist = MAGNET_THRESH

        siblingBoxes.forEach((sb) => {
          // X Ekseninde Mıknatıs: Üst üste eşit hizalar veya yan yana bitişik eşit boşluklar
          const xCandidates = [
            sb.x,                    // Sol kenar birebir hizada (üst üste eşit hiza)
            sb.x + sb.w - w,         // Sağ kenar birebir hizada (üst üste eşit hiza)
            sb.x + (sb.w - w) / 2,   // Tam dikey merkez hizada
            sb.x + sb.w + 1.2,       // Sağ yanına bitişik standart eşit boşluk (yan yana)
            sb.x - w - 1.2,          // Sol yanına bitişik standart eşit boşluk (yan yana)
            sb.x + sb.w + 2.0,       // Sağ yanına 2% boşluk
            sb.x - w - 2.0,          // Sol yanına 2% boşluk
          ]
          xCandidates.forEach((cand) => {
            const d = Math.abs(x - cand)
            if (d < bestXDist) {
              bestXDist = d
              snappedX = cand
            }
          })

          // Y Ekseninde Mıknatıs: Yan yana eşit hizalar veya üst üste bitişik eşit boşluklar
          const yCandidates = [
            sb.y,                    // Üst kenar birebir hizada (yan yana eşit hiza)
            sb.y + sb.h - h,         // Alt kenar birebir hizada (yan yana eşit hiza)
            sb.y + (sb.h - h) / 2,   // Tam yatay merkez hizada
            sb.y + sb.h + 1.5,       // Altına bitişik standart eşit boşluk (üst üste)
            sb.y - h - 1.5,          // Üstüne bitişik standart eşit boşluk (üst üste)
            sb.y + sb.h + 2.5,       // Altına 2.5% boşluk
            sb.y - h - 2.5,          // Üstüne 2.5% boşluk
          ]
          yCandidates.forEach((cand) => {
            const d = Math.abs(y - cand)
            if (d < bestYDist) {
              bestYDist = d
              snappedY = cand
            }
          })
        })

        x = snappedX
        y = snappedY
      } else {
        let snappedW = Math.round(w / RULER_STEP) * RULER_STEP
        let snappedH = Math.round(h / RULER_STEP) * RULER_STEP
        let bestWDist = MAGNET_THRESH
        let bestHDist = MAGNET_THRESH

        siblingBoxes.forEach((sb) => {
          const wCandidates = [sb.w, sb.x + sb.w - x, sb.x - x - 1.0]
          wCandidates.forEach((cand) => {
            const d = Math.abs(w - cand)
            if (cand >= 6 && d < bestWDist) {
              bestWDist = d
              snappedW = cand
            }
          })

          const hCandidates = [sb.h, sb.y + sb.h - y, sb.y - y - 1.0]
          hCandidates.forEach((cand) => {
            const d = Math.abs(h - cand)
            if (cand >= 8 && d < bestHDist) {
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
      w = Math.max(6, Math.min(maxX - x, w))
      h = Math.max(8, Math.min(maxY - y, h))

      // Prevent resizing onto any sibling unit, custom area, or facade badge
      allObstacles.forEach((obs) => {
        if (!boxesOverlap({ x, y, w, h }, obs, MIN_GAP)) return
        const maxAllowedW = obs.x - x - 1.0
        const maxAllowedH = obs.y - y - 1.0
        if (obs.x >= x + 4 && maxAllowedW >= 6 && (obs.y < y + 4 || maxAllowedW / w >= maxAllowedH / h)) {
          w = Math.min(w, maxAllowedW)
        } else if (obs.y >= y + 4 && maxAllowedH >= 8) {
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
            { nx: obs.x - w - 1.0, ny: y },
            { nx: obs.x + obs.w + 1.0, ny: y },
            { nx: x, ny: obs.y - h - 1.0 },
            { nx: x, ny: obs.y + obs.h + 1.0 },
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
            1.0
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

  // Apply one of the 5 Size Presets to a Unit
  const handleApplyUnitSizePreset = (unit: FlatUnit, preset: UnitSizePreset, idxOnFloor: number) => {
    const currentBox =
      unit.planBox || getDefaultUnitPlanBox(idxOnFloor, floorUnits.length, layoutTemplate, unit.sizePreset)
    const dims = UNIT_SIZE_PRESETS[preset]
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
    onProjectUpdated()
  }

  // Apply one of the 5 Size Presets to a Custom Area
  const handleApplyAreaSizePreset = (area: KrokiAreaItem, preset: UnitSizePreset) => {
    const dims = UNIT_SIZE_PRESETS[preset]
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
    projectStore.updateCustomArea(project.id, area.id, { box: nextBox })
    onProjectUpdated()
  }

  // Add Unit handler
  const handleCreateManualUnit = (e: React.FormEvent) => {
    e.preventDefault()
    const res = projectStore.addUnitToFloor(project.id, selectedFloor, {
      unitNumber: newUnitDraft.unitNumber.trim() || `DAİRE ${floorUnits.length + 1}`,
      block: newUnitDraft.block.trim() || 'A Giriş',
      roomType: newUnitDraft.roomType,
      sizePreset: newUnitDraft.sizePreset,
      price: Number(newUnitDraft.price) || 5500000,
      status: newUnitDraft.status,
      statusLabel: newUnitDraft.statusLabel,
    })
    if (res.success && res.unit) {
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

  // Toggle / Add / Remove facade direction on the active unit
  const handleToggleUnitFacadeTag = (tag: string) => {
    if (!activeUnit) return
    const currentParts = (activeUnit.facade || '')
      .split(/[,•/|-]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    const exists = currentParts.some((p) => p.toLowerCase() === tag.toLowerCase())
    const nextParts = exists
      ? currentParts.filter((p) => p.toLowerCase() !== tag.toLowerCase())
      : [...currentParts, tag]
    projectStore.updateUnitDetails(project.id, activeUnit.id, {
      facade: nextParts.join(' • '),
    })
    onProjectUpdated()
  }

  // Pointer / Touch move & up for moving and Apple-widget-style resizing
  useEffect(() => {
    if (!interactionState) return

    const handleMove = (clientX: number, clientY: number) => {
      if (!canvasRef.current) return
      const rect = canvasRef.current.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return

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
          true
        )

        if (interactionState.targetType === 'unit') {
          projectStore.updateUnitPlanBox(project.id, interactionState.targetId, nextBox)
        } else {
          projectStore.updateCustomArea(project.id, interactionState.targetId, { box: nextBox })
        }
        onProjectUpdated()
      } else {
        // Apple Widget Bottom-Right Corner Resize (snapped to ruler scale & prevented from crossing facades)
        const nextBox = clampBoxAvoidingFacades(
          {
            ...init,
            w: init.w + dxPct,
            h: init.h + dyPct,
          },
          'resize',
          interactionState.targetId,
          true
        )

        if (interactionState.targetType === 'unit') {
          const detectedPreset = inferSizePresetFromBox(nextBox)
          projectStore.updateUnitPlanBox(
            project.id,
            interactionState.targetId,
            nextBox,
            detectedPreset
          )
        } else {
          projectStore.updateCustomArea(project.id, interactionState.targetId, { box: nextBox })
        }
        onProjectUpdated()
      }
    }

    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY)
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY)
      }
    }
    const onEnd = () => setInteractionState(null)

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
  }, [interactionState, project.id, project.paymentBanner, customFacades, isLayoutEditMode, onProjectUpdated])

  // Render Apple iOS/macOS Widget-style curved bottom-right corner handle
  const renderAppleCornerResizeHandle = (
    targetType: 'unit' | 'area',
    targetId: string,
    currentBox: UnitPlanBox
  ) => (
    <div
      onMouseDown={(e) => {
        e.stopPropagation()
        if (targetType === 'unit') setActiveUnitId(targetId)
        else setActiveAreaId(targetId)
        setInteractionState({
          targetType,
          targetId,
          mode: 'resize',
          startX: e.clientX,
          startY: e.clientY,
          initialBox: currentBox,
        })
      }}
      onTouchStart={(e) => {
        e.stopPropagation()
        if (e.touches.length === 0) return
        if (targetType === 'unit') setActiveUnitId(targetId)
        else setActiveAreaId(targetId)
        setInteractionState({
          targetType,
          targetId,
          mode: 'resize',
          startX: e.touches[0].clientX,
          startY: e.touches[0].clientY,
          initialBox: currentBox,
        })
      }}
      title="Mimari boyutu değiştirmek için sağ alt kıvrımdan tutup çekin"
      className="absolute bottom-0 right-0 w-7 h-7 rounded-br-[20px] flex items-end justify-end p-0.5 cursor-nwse-resize z-30 group/handle select-none touch-none"
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        className="text-[#5c6ac4] group-hover/handle:scale-110 transition-transform drop-shadow-sm"
      >
        {/* Daire kutusunun rounded-[20px] radius'una eşdeğer eşmerkezli kıvrım */}
        <path
          d="M 4 21 A 17 17 0 0 0 21 4"
          stroke="currentColor"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        <path
          d="M 9 21 A 12 12 0 0 0 21 9"
          stroke="white"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )

  return (
    <div className="space-y-3.5">
      {/* ÜST ARAÇ ÇUBUĞU: Blok/Giriş Seçimi + Mimari Şablon + Belge Yükle + Düzenle Modu */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
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

        {/* Sağ: Word / PDF / PPTX / Excel Yükle + Düzenle Butonu */}
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

          <button
            type="button"
            onClick={() => fileInputUniversalRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#b99881] text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
            title="Planı Yükle"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>
              {isParsingDoc ? 'Plan Okunuyor...' : 'Planı Yükle'}
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

          {/* Sürükle yerine DÜZENLE Butonu */}
          <button
            type="button"
            onClick={() => {
              setIsLayoutEditMode(!isLayoutEditMode)
              setShowAddUnitForm(false)
              setShowAddAreaForm(false)
              setShowAddFacadeForm(false)
            }}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              isLayoutEditMode
                ? 'bg-[#b99881] text-white shadow-sm'
                : 'bg-[#34302d] text-[#f3efe9] hover:text-white'
            }`}
            title="Daire ekle, alan ekle (Havuz, Giriş vb.), cepheleri düzenle ve sağ alt kıvrımdan boyutlandır"
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

          {isLayoutEditMode && (
            <button
              type="button"
              onClick={handleResetFloorBoxes}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#34302d] text-[11px] font-medium text-[#a69f99] hover:text-white cursor-pointer"
              title="Bu kattaki daire konumlarını varsayılan şablona sıfırla"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Sıfırla</span>
            </button>
          )}
        </div>
      </div>

      {/* MANUEL DÜZENLEME ARAÇ ÇUBUĞU: Daire Ekle + Alan Ekle + Cephe Ekle + Boyut Şablonları */}
      <AnimatePresence>
        {isLayoutEditMode && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="p-3 rounded-[22px] bg-[#282522] border border-[#4a443f] space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddUnitForm(!showAddUnitForm)
                    setShowAddAreaForm(false)
                    setShowAddFacadeForm(false)
                  }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    showAddUnitForm
                      ? 'bg-[#b99881] text-white'
                      : 'bg-[#34302d] text-white hover:opacity-90'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5 text-[#b99881]" />
                  <span>Daire Ekle</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowAddAreaForm(!showAddAreaForm)
                    setShowAddUnitForm(false)
                    setShowAddFacadeForm(false)
                  }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    showAddAreaForm
                      ? 'bg-[#b99881] text-white'
                      : 'bg-[#34302d] text-white hover:opacity-90'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5 text-[#b99881]" />
                  <span>Alan Ekle (Havuz, Giriş, Bahçe vb.)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowAddFacadeForm(!showAddFacadeForm)
                    setShowAddUnitForm(false)
                    setShowAddAreaForm(false)
                  }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    showAddFacadeForm
                      ? 'bg-[#b99881] text-white'
                      : 'bg-[#34302d] text-white hover:opacity-90'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5 text-[#b99881]" />
                  <span>Cephe Ekle / Düzenle</span>
                </button>
              </div>

              {/* Seçili Kutunun Hızlı Boyut Şablonları */}
              {activeUnit && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-[#a69f99] flex items-center gap-1 mr-1">
                    <Maximize2 className="w-3 h-3 text-[#b99881]" />
                    <span>{activeUnit.unitNumber} Boyutu:</span>
                  </span>
                  {(Object.keys(UNIT_SIZE_PRESETS) as UnitSizePreset[]).map((presetKey) => {
                    const presetInfo = UNIT_SIZE_PRESETS[presetKey]
                    const isCurrent = (activeUnit.sizePreset || 'wide-rect') === presetKey
                    const unitIdx = floorUnits.findIndex((u) => u.id === activeUnit.id)
                    return (
                      <button
                        key={presetKey}
                        type="button"
                        onClick={() =>
                          handleApplyUnitSizePreset(activeUnit, presetKey, Math.max(0, unitIdx))
                        }
                        className={`px-2.5 py-1 rounded-full text-[10.5px] font-semibold transition-all cursor-pointer ${
                          isCurrent
                            ? 'bg-[#b99881] text-white'
                            : 'bg-[#34302d] text-[#a69f99] hover:text-white'
                        }`}
                        title={presetInfo.label}
                      >
                        {presetInfo.shortLabel}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* + DAİRE EKLE FORMU */}
            {showAddUnitForm && (
              <form
                onSubmit={handleCreateManualUnit}
                className="p-3 rounded-2xl bg-[#34302d] grid grid-cols-2 sm:grid-cols-6 gap-2.5 items-end"
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
                    Giriş / Blok
                  </label>
                  <input
                    type="text"
                    placeholder="Örn: A Giriş, B Giriş"
                    value={newUnitDraft.block}
                    onChange={(e) => setNewUnitDraft({ ...newUnitDraft, block: e.target.value })}
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
                    Mimari Boyut
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
                    {(Object.keys(UNIT_SIZE_PRESETS) as UnitSizePreset[]).map((k) => (
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
                          : lbl === 'Rezerve'
                          ? 'REZERVE'
                          : 'SATISTA'
                      setNewUnitDraft({ ...newUnitDraft, status: st, statusLabel: lbl })
                    }}
                    className="w-full px-3 py-1.5 rounded-full bg-[#282522] border border-[#4a443f] text-xs text-white focus:outline-none cursor-pointer"
                  >
                    <option value="Satışta">Satışta (Açık)</option>
                    <option value="SATILDI">SATILDI (Kırmızı)</option>
                    <option value="KAPALI">KAPALI (Kırmızı)</option>
                    <option value="Rezerve">Rezerve (Sarı)</option>
                  </select>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="submit"
                    className="flex-1 py-1.5 px-3 rounded-full bg-[#b99881] text-white text-xs font-semibold cursor-pointer"
                  >
                    Kata Ekle
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

            {/* + ALAN EKLE FORMU (Havuz, A/B Giriş, Otopark, Bahçe vb.) */}
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
                          : k === 'entrance'
                          ? 'A Giriş'
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
                    <option value="entrance">Giriş Oku (A/B Giriş)</option>
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
                    placeholder="Örn: HAVUZ, B Giriş"
                    className="w-full px-3 py-1.5 rounded-full bg-[#282522] border border-[#4a443f] text-xs text-white focus:outline-none"
                  />
                </div>
                {newAreaDraft.kind === 'entrance' ? (
                  <div>
                    <label className="block text-[10.5px] font-semibold text-[#a69f99] mb-1">
                      Ok Yönü
                    </label>
                    <select
                      value={newAreaDraft.direction}
                      onChange={(e) =>
                        setNewAreaDraft({
                          ...newAreaDraft,
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
                ) : (
                  <div>
                    <label className="block text-[10.5px] font-semibold text-[#a69f99] mb-1">
                      Boyut Şablonu
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
                      {(Object.keys(UNIT_SIZE_PRESETS) as UnitSizePreset[]).map((k) => (
                        <option key={k} value={k}>
                          {UNIT_SIZE_PRESETS[k].label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
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
                    Alanı Ekle
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

      {/* ANA ETKİLEŞİMLİ ALAN: Sol Kat Görünümü + Orta Geniş Kroki Planı + Sağ Daraltılmış ve Uzatılmış Daire Bilgi Kutucuğu */}
      <div className="grid grid-cols-1 lg:grid-cols-[205px_minmax(0,1fr)_248px] xl:grid-cols-[215px_minmax(0,1fr)_258px] gap-4 items-stretch">
        {/* SOL SÜTUN: KAT PLANI */}
        <div className="p-3.5 rounded-[24px] bg-[#282522] border border-[#4a443f] flex flex-col justify-between space-y-3.5">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#b99881]" />
                <span>Kat Planı</span>
              </span>
              <span className="text-[10px] font-mono text-[#8c857f]">
                {configuredMaxFloors} Kat
              </span>
            </div>

            {/* Yukarıdan aşağıya: İkinci Kat -> Birinci Kat -> Zemin Kat */}
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
                    className={`w-full min-w-[140px] lg:min-w-0 px-3.5 py-2.5 rounded-full text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-[#b99881] text-white shadow-sm'
                        : 'bg-[#34302d] text-[#f3efe9] hover:opacity-95'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">{labelInfo.short}</div>
                      <div className="text-[9.5px] opacity-80 truncate">{labelInfo.sub}</div>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] shrink-0">
                      {availCount > 0 && (
                        <span
                          className={`inline-flex items-center gap-0.5 font-bold ${
                            isSelected ? 'text-white' : 'text-emerald-600'
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
                            isSelected ? 'text-white' : 'text-amber-600'
                          }`}
                          title={`Rezerve: ${resCount}`}
                        >
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          {resCount}
                        </span>
                      )}
                      {soldCount > 0 && (
                        <span
                          className={`inline-flex items-center gap-0.5 font-bold ${
                            isSelected ? 'text-white' : 'text-rose-600'
                          }`}
                          title={`Satıldı / Kapalı: ${soldCount}`}
                        >
                          <span className="w-2 h-2 rounded-full bg-rose-500" />
                          {soldCount}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Kattaki Daire Sayısı */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between px-1 text-[10.5px]">
                <span className="font-semibold text-white">Kattaki Daire</span>
                <span className="font-mono font-bold text-[#b99881]">
                  {floorUnits.length} Daire
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {[2, 3, 4, 6].map((cnt) => {
                  const active = floorUnits.length === cnt
                  return (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => handleManualReconfigure({ unitsPerFloor: cnt })}
                      className={`py-1.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                        active
                          ? 'bg-[#b99881] text-white'
                          : 'bg-[#34302d] text-[#a69f99] hover:text-white'
                      }`}
                    >
                      {cnt}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Blok Yapısı */}
            <div className="space-y-1.5">
              <div className="px-1 text-[10.5px] font-semibold text-white">Blok / Giriş Yapısı</div>
              <div className="grid grid-cols-2 gap-1">
                {[
                  { val: 1 as const, label: 'Tek Blok' },
                  { val: 2 as const, label: 'A - B Giriş' },
                ].map((bOpt) => {
                  const active = currentBlockCount === bOpt.val
                  return (
                    <button
                      key={bOpt.val}
                      type="button"
                      onClick={() => handleManualReconfigure({ blockCount: bOpt.val })}
                      className={`py-1.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                        active
                          ? 'bg-[#b99881] text-white'
                          : 'bg-[#34302d] text-[#a69f99] hover:text-white'
                      }`}
                    >
                      {bOpt.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Sol Alt Hızlı Ekleme Kısayolu */}
          <div className="pt-2 border-t border-[#4a443f]/40 space-y-1.5">
            <button
              type="button"
              onClick={() => {
                setIsLayoutEditMode(true)
                setShowAddUnitForm(true)
                setShowAddAreaForm(false)
              }}
              className="w-full py-1.5 px-3 rounded-full bg-[#34302d] hover:bg-[#b99881] hover:text-white text-[11px] font-semibold text-[#f3efe9] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Daire Ekle</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsLayoutEditMode(true)
                setShowAddAreaForm(true)
                setShowAddUnitForm(false)
              }}
              className="w-full py-1.5 px-3 rounded-full bg-[#34302d] hover:bg-[#b99881] hover:text-white text-[11px] font-semibold text-[#f3efe9] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Waves className="w-3.5 h-3.5" />
              <span>Alan Ekle (Havuz/Giriş)</span>
            </button>
          </div>
        </div>

        {/* ORTA SÜTUN: ETKİLEŞİMLİ MİMARİ KAT KROKİSİ */}
        <div className="p-4 rounded-[24px] bg-[#282522] border border-[#4a443f] flex flex-col justify-between space-y-3">
          {/* Kroki Üst Başlık ve Durum Lejantı */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
            <div>
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-[#b99881]" />
                <h4 className="text-sm font-bold text-white">
                  {project.name} —{' '}
                  {selectedBlock === 'ALL' ? 'Tüm Site Planı' : selectedBlock} •{' '}
                  {FLOOR_LABELS[selectedFloor]?.full}
                </h4>
                {project.parcelInfo && (
                  <span className="text-[11px] font-medium text-[#8c857f] hidden xl:inline">
                    ({project.parcelInfo})
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#a69f99] mt-0.5">
                {isLayoutEditMode
                  ? 'Düzenleme modu aktif: Kutuları sürükleyebilir, sağ alt kıvrımdan çekerek boyutlandırabilir veya yeni daire/alan/cephe ekleyebilirsiniz.'
                  : 'Kroki üzerindeki daireye tıklayarak detaylarını inceleyebilir; sağ alt kıvrımından boyutunu ayarlayabilirsiniz.'}
              </p>
            </div>

            {/* Satış Durumu Renk Lejantı */}
            <div className="flex items-center gap-3 text-[11px] font-medium bg-[#34302d] px-3.5 py-1.5 rounded-full">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Satışta</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>Rezerve</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span>Satıldı / Kapalı</span>
              </span>
            </div>
          </div>

          {/* Yüklenen Kat Planı Görseli Varsa Opaklık Ayarı */}
          {activeFloorPlanUrl && (
            <div className="flex items-center justify-between gap-3 px-4 py-1.5 rounded-full bg-[#34302d] text-xs">
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
            {/* Dış Kontur Çizgisi: İnce hareket eden vurgu ve koyu renk çizgi (Apple Dock Stili) */}
            <div className="relative p-[1.5px] rounded-[25.5px] overflow-hidden flex-1 flex flex-col">
              {/* Hareket Eden İnce Çizgi Animasyonu (Accent & Koyu Renk Işık Dalgası) */}
              <div
                className="absolute -inset-[150%] pointer-events-none animate-spin"
                style={{
                  animationDuration: '10s',
                  animationTimingFunction: 'linear',
                  background:
                    'conic-gradient(from 0deg, transparent 0%, transparent 68%, #1c1a18 78%, var(--accent-color, #b99881) 86%, #d6beae 90%, var(--accent-color, #b99881) 94%, #1c1a18 97%, transparent 100%)',
                }}
              />
              {/* Statik İnce Koyu Kenarlık Tabanı */}
              <div className="absolute inset-0 rounded-[25.5px] border border-[#4a443f]/60 pointer-events-none z-10" />

              <div
                ref={canvasRef}
                className="relative w-full min-h-[450px] xl:min-h-[470px] flex-1 rounded-[24px] bg-[#34302d] overflow-hidden select-none z-10"
                style={{
                  boxShadow:
                    '0 8px 0 0 rgba(41, 45, 43, 0.12), 0 14px 28px -8px rgba(41, 45, 43, 0.14)',
                  backgroundImage:
                    'radial-gradient(rgba(185, 152, 129, 0.22) 1px, transparent 1px), linear-gradient(to right, rgba(185, 152, 129, 0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(185, 152, 129, 0.08) 1px, transparent 1px)',
                  backgroundSize: '2% 2%, 10% 10%, 10% 10%',
                }}
              >
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

                {/* Yüklü Kat Planı Görseli (Yalnızca kullanıcı doğrudan görsel altlık yüklediyse) */}
                {activeFloorPlanUrl && (
                  <img
                    src={activeFloorPlanUrl}
                    alt={`${project.name} ${FLOOR_LABELS[selectedFloor]?.short}`}
                    style={{ opacity: planOpacity / 100 }}
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none p-2"
                  />
                )}

                {/* DİNAMİK VE DÜZENLENEBİLİR 8 SABİT YÖN & ARA YÖN CEPHE ETİKETLERİ
                    (Kuzey ve Güney: Yatay, Batı ve Doğu: Düşey/Yan, Ara Yönler: Çapraz) */}
                {ALL_FACADE_EDGES.map((edge) => {
                  const edgeFacades = customFacades.filter((f) => f.edge === edge)
                  if (edgeFacades.length === 0 && !isLayoutEditMode) return null

                  const cfg = FACADE_EDGE_CONFIG[edge]
                  const bottomOffset = project.paymentBanner ? 'bottom-8.5' : 'bottom-2'

                  const posClass =
                    edge === 'top'
                      ? 'top-2 left-1/2 -translate-x-1/2 flex-row'
                      : edge === 'bottom'
                      ? `${bottomOffset} left-1/2 -translate-x-1/2 flex-row`
                      : edge === 'left'
                      ? 'left-1 top-1/2 -translate-y-1/2 -rotate-90 origin-center select-none'
                      : edge === 'right'
                      ? 'right-1 top-1/2 -translate-y-1/2 rotate-90 origin-center select-none'
                      : edge === 'top-left'
                      ? 'top-2.5 left-2.5 -rotate-45 origin-center select-none'
                      : edge === 'top-right'
                      ? 'top-2.5 right-2.5 rotate-45 origin-center select-none'
                      : edge === 'bottom-left'
                      ? `${bottomOffset} left-2.5 rotate-45 origin-center select-none`
                      : `${bottomOffset} right-2.5 -rotate-45 origin-center select-none`

                  return (
                    <div
                      key={edge}
                    data-facade-badge="true"
                    className={`absolute ${posClass} flex items-center gap-1 z-25 pointer-events-auto`}
                  >
                    {edgeFacades.map((fac) => (
                      <div
                        key={fac.id}
                        className="px-2.5 py-0.5 rounded-full bg-white/95 shadow-xs text-[9.5px] font-mono font-bold uppercase tracking-wider text-[#292d2b] flex items-center gap-1 border border-black/15"
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
                            {cfg.arrow} {fac.label}
                          </span>
                        )}

                        {isLayoutEditMode && (
                          <>
                            <select
                              value={fac.edge}
                              onChange={(e) =>
                                handleChangeFacadeEdge(fac.id, e.target.value as FacadeEdge)
                              }
                              onClick={(e) => e.stopPropagation()}
                              className="bg-[#282522] text-white text-[9px] font-sans font-semibold px-1.5 py-0.2 rounded-full cursor-pointer focus:outline-none"
                              title="Bu cephenin yön/köşe konumunu değiştir"
                            >
                              {ALL_FACADE_EDGES.map((edgeKey) => (
                                <option key={edgeKey} value={edgeKey}>
                                  {FACADE_EDGE_CONFIG[edgeKey].arrow}{' '}
                                  {FACADE_EDGE_CONFIG[edgeKey].compassName}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => handleDeleteFacade(fac.id)}
                              className="text-rose-500 hover:text-rose-700 cursor-pointer"
                              title="Cepheyi kaldır"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </>
                        )}
                      </div>
                    ))}

                    {isLayoutEditMode && edgeFacades.length === 0 && (
                      <button
                        type="button"
                        onClick={() => handleQuickToggleCompassFacade(edge)}
                        className="px-2 py-0.5 rounded-full bg-[#282522]/85 hover:bg-[#b99881] text-[#d6beae] hover:text-white border border-[#4a443f] text-[9px] font-bold shadow-xs transition-colors cursor-pointer"
                        title={`${cfg.fullOptionLabel} cephesini ekle`}
                      >
                        + {cfg.arrow} {cfg.compassName}
                      </button>
                    )}
                  </div>
                )
              })}

              {/* Alt Ödeme Planı / Peşinat Banner'ı (Varsa, örn: 1.500.000₺ Peşinat / 36 Ay Vade) */}
              {project.paymentBanner && (
                <div className="absolute bottom-0 inset-x-0 h-7 bg-rose-600 text-white flex items-center justify-center text-xs font-bold tracking-wide shadow-inner z-10 px-4">
                  <span>{project.paymentBanner}</span>
                </div>
              )}

              {/* ÖZEL MİMARİ ALANLAR: HAVUZ, A GİRİŞ, B GİRİŞ, BAHÇE, OTOPARK VB. */}
              {floorAreas.map((area) => {
                const isPool = area.kind === 'pool'
                const isEntrance = area.kind === 'entrance'
                const isGarden = area.kind === 'garden'
                const isSelectedArea = activeAreaId === area.id
                const isInteractingArea =
                  interactionState?.targetType === 'area' && interactionState.targetId === area.id

                const areaStyleClasses = isPool
                  ? 'bg-sky-500/25 border-sky-500/80 text-sky-950'
                  : isEntrance
                  ? 'bg-[#1e6091] border-[#15466b] !text-white shadow-md'
                  : isGarden
                  ? 'bg-emerald-500/20 border-emerald-600/60 text-emerald-950'
                  : 'bg-white/75 border-black/25 text-[#292d2b]'

                return (
                  <div
                    key={area.id}
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
                      setActiveAreaId(area.id)
                      if (isLayoutEditMode) {
                        e.stopPropagation()
                        setInteractionState({
                          targetType: 'area',
                          targetId: area.id,
                          mode: 'move',
                          startX: e.clientX,
                          startY: e.clientY,
                          initialBox: area.box,
                        })
                      }
                    }}
                    className={`absolute rounded-[18px] border-2 flex flex-col items-center justify-center p-2 transition-[box-shadow] ${areaStyleClasses} ${
                      isSelectedArea && isLayoutEditMode ? 'ring-2 ring-[#5c6ac4] z-25' : isEntrance ? 'z-25' : 'z-10'
                    } ${isLayoutEditMode ? 'cursor-move' : ' pointer-events-auto'}`}
                  >
                    {/* Aktif Taşıma/Boyutlandırma Cetvel Ölçüsü Rozeti */}
                    {isInteractingArea && (
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-[#282522] text-[#f3efe9] border border-[#b99881] text-[9px] font-mono font-bold whitespace-nowrap shadow-md z-40 pointer-events-none">
                        X:{Math.round(area.box.x)} Y:{Math.round(area.box.y)} • {Math.round(area.box.w)}×{Math.round(area.box.h)}
                      </div>
                    )}

                    {/* Sil Butonu (Düzenle modunda) */}
                    {isLayoutEditMode && (
                      <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation()
                          projectStore.deleteCustomArea(project.id, area.id)
                          onProjectUpdated()
                        }}
                        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-sm hover:bg-rose-500 cursor-pointer z-30"
                        title="Bu alanı kaldır"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}

                    {isPool && (
                      <div className="flex flex-col items-center justify-center text-center select-none pointer-events-none">
                        <Waves className="w-6 h-6 text-sky-800 mb-1 opacity-85" />
                        <span className="text-sm sm:text-base font-extrabold tracking-widest uppercase text-sky-950 drop-shadow-2xs">
                          {area.label}
                        </span>
                      </div>
                    )}

                    {isEntrance && (
                      <div className="flex items-center justify-center gap-1 text-center select-none pointer-events-none font-bold text-[11px] sm:text-xs !text-white">
                        {area.direction === 'up' && <ArrowUp className="w-4 h-4 shrink-0" />}
                        {area.direction === 'down' && <ArrowDown className="w-4 h-4 shrink-0" />}
                        {area.direction === 'left' && <ArrowLeft className="w-4 h-4 shrink-0" />}
                        {area.direction === 'right' && <ArrowRight className="w-4 h-4 shrink-0" />}
                        <span className="leading-tight">{area.label}</span>
                      </div>
                    )}

                    {!isPool && !isEntrance && (
                      <span className="text-xs font-bold uppercase tracking-wider text-center select-none pointer-events-none">
                        {area.label}
                      </span>
                    )}

                    {/* Apple Widget Sağ Alt Kıvrımlı Boyutlandırma Kulpu */}
                    {isLayoutEditMode &&
                      renderAppleCornerResizeHandle('area', area.id, area.box)}
                  </div>
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
                  const isAvailable = unit.status === 'SATISTA'
                  const isReserved = unit.status === 'REZERVE'
                  const isKapali = unit.statusLabel === 'KAPALI'

                  // Compact / Vertical layout detection (e.g. Dar Düşey w <= 15% or Dar Yatay h <= 17%)
                  const isNarrowVertical = box.w <= 15.5
                  const isNarrowHorizontal = box.h <= 17.5
                  const isLargeBox = box.w >= 28 && box.h >= 28

                  const statusColorClasses = isAvailable
                    ? 'bg-emerald-500/16 hover:bg-emerald-500/24 border-emerald-600/80 text-emerald-950'
                    : isReserved
                    ? 'bg-amber-500/18 hover:bg-amber-500/26 border-amber-500/85 text-amber-950'
                    : 'bg-rose-500/20 hover:bg-rose-500/28 border-rose-600/80 text-rose-950'

                  const badgeClasses = isAvailable
                    ? 'bg-emerald-600 !text-white'
                    : isReserved
                    ? 'bg-amber-500 !text-white'
                    : 'bg-rose-600 !text-white'

                  const displayStatusText = isAvailable
                    ? 'Satışta'
                    : isReserved
                    ? 'Rezerve'
                    : isKapali
                    ? 'KAPALI'
                    : unit.statusLabel || 'SATILDI'

                  const boxShadowStyle = isSelected
                    ? '0 5px 0 0 rgba(41, 45, 43, 0.20), 0 12px 22px -4px rgba(41, 45, 43, 0.18)'
                    : '0 4px 0 0 rgba(41, 45, 43, 0.10), 0 6px 12px -4px rgba(41, 45, 43, 0.08)'

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
                      }}
                      onMouseDown={(e) => {
                        setActiveUnitId(unit.id)
                        setActiveAreaId(null)
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
                        if (isLayoutEditMode) {
                          e.preventDefault()
                          e.stopPropagation()
                          setActiveUnitId(unit.id)
                          setActiveAreaId(null)
                          setUnitContextMenu({
                            unitId: unit.id,
                            x: e.clientX,
                            y: e.clientY,
                          })
                        }
                      }}
                      className={`absolute rounded-[20px] border-2 transition-colors backdrop-blur-[2px] ${statusColorClasses} ${
                        isSelected ? 'ring-3 ring-[#5c6ac4] z-20' : 'z-10'
                      } ${isLayoutEditMode ? 'cursor-move' : 'cursor-pointer'} ${
                        isNarrowVertical || isNarrowHorizontal ? 'p-2' : 'p-3'
                      } flex flex-col justify-between`}
                    >
                      {/* Aktif Taşıma/Boyutlandırma Cetvel Ölçüsü Rozeti */}
                      {isInteractingUnit && (
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-[#282522] text-[#f3efe9] border border-[#b99881] text-[9px] font-mono font-bold whitespace-nowrap shadow-md z-40 pointer-events-none">
                          Cetvel: X:{Math.round(box.x)} Y:{Math.round(box.y)} • {Math.round(box.w)}×{Math.round(box.h)}
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
                                `${unit.unitNumber} kutusunu bu kattan kaldırmak istiyor musunuz?`
                              )
                            ) {
                              projectStore.deleteUnit(project.id, unit.id)
                              onProjectUpdated()
                            }
                          }}
                          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-sm hover:bg-rose-500 cursor-pointer z-30"
                          title="Daireyi kaldır"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}

                      {isNarrowVertical ? (
                        /* DAR DÜŞEY DİKDÖRTGEN GÖRÜNÜMÜ (Örn: Almina 2 Sağ Kanattaki Dikey Daire 3 ve Daire 2) */
                        <div className="flex-1 flex flex-col items-center justify-center text-center gap-1.5 py-1">
                          {unit.block && (
                            <span className="text-[9px] font-bold uppercase tracking-wider opacity-75 px-1.5 py-0.5 rounded-full bg-white/60">
                              {unit.block}
                            </span>
                          )}
                          <div className="px-2 py-0.5 rounded-full bg-[#282522] text-white font-mono text-[11px] font-bold shadow-2xs">
                            {unit.unitNumber}
                          </div>
                          <div className="text-xs font-extrabold">{unit.roomType}</div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold uppercase tracking-wider shadow-2xs ${badgeClasses}`}
                          >
                            {displayStatusText}
                          </span>
                          {isAvailable && unit.price > 0 && (
                            <div className="text-[10px] font-bold font-mono bg-white/85 px-1.5 py-0.5 rounded-full shadow-2xs mt-0.5">
                              {formatCurrency(unit.price)}
                            </div>
                          )}
                        </div>
                      ) : isNarrowHorizontal ? (
                        /* DAR YATAY DİKDÖRTGEN GÖRÜNÜMÜ */
                        <div className="flex-1 flex items-center justify-between gap-1.5 px-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="px-2 py-0.5 rounded-full bg-[#282522] text-white font-mono text-[11px] font-bold shrink-0">
                              {unit.unitNumber}
                            </span>
                            <span className="text-xs font-bold truncate">{unit.roomType}</span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold uppercase shrink-0 ${badgeClasses}`}
                          >
                            {displayStatusText}
                          </span>
                        </div>
                      ) : (
                        /* GENİŞ YATAY / KARE / GENİŞ UZUN DİKDÖRTGEN GÖRÜNÜMÜ */
                        <>
                          <div>
                            <div className="flex items-start justify-between gap-1.5">
                              <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                <span className="px-2.5 py-0.5 rounded-full bg-[#282522] text-white font-mono text-xs font-bold shrink-0 shadow-xs">
                                  {unit.unitNumber}
                                </span>
                                <span className="text-xs font-extrabold">{unit.roomType}</span>
                                {unit.block && (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/65">
                                    {unit.block}
                                  </span>
                                )}
                              </div>

                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 shadow-xs ${badgeClasses}`}
                              >
                                {displayStatusText}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[11px] font-semibold mt-1.5 opacity-85">
                              <span>
                                {unit.grossSqm} m² / {unit.netSqm} m²
                              </span>
                              {unit.facade && (
                                <span className="truncate ml-1 text-[10px] opacity-85">
                                  {unit.facade}
                                </span>
                              )}
                            </div>

                            {/* Yalnızca Geniş Uzun Dikdörtgen şablonunda iç oda dağılımını göster */}
                            {isLargeBox && (
                              <div className="grid grid-cols-3 gap-1 mt-2 pt-1.5 text-[9px] font-mono select-none pointer-events-none">
                                <div className="px-2 py-1 rounded-lg bg-white/70 flex justify-between">
                                  <span className="font-bold">SALON</span>
                                  <span>{Math.round(unit.netSqm * 0.36)}m²</span>
                                </div>
                                <div className="px-2 py-1 rounded-lg bg-white/70 flex justify-between">
                                  <span className="font-bold">MUTFAK</span>
                                  <span>{Math.round(unit.netSqm * 0.18)}m²</span>
                                </div>
                                <div className="px-2 py-1 rounded-lg bg-white/70 flex justify-between">
                                  <span className="font-bold">ODALAR</span>
                                  <span>{Math.round(unit.netSqm * 0.36)}m²</span>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="pt-1 flex items-center justify-between gap-1.5 mt-auto">
                            <div className="min-w-0 text-[10.5px] font-semibold truncate">
                              {isReserved && unit.reservation ? (
                                <span>Opsiyon: {unit.reservation.customerName}</span>
                              ) : unit.status === 'SATILDI' ? (
                                <span>
                                  {unit.sale?.customerName
                                    ? `Alıcı: ${unit.sale.customerName}`
                                    : displayStatusText}
                                </span>
                              ) : (
                                <span className="opacity-80">Satışta</span>
                              )}
                            </div>

                            <div className="text-xs font-bold font-mono shrink-0 bg-white/85 px-2.5 py-0.5 rounded-full shadow-2xs">
                              {unit.price > 0 ? formatCurrency(unit.price) : 'Fiyat Sorunuz'}
                            </div>
                          </div>
                        </>
                      )}

                      {/* Apple Widget Sağ Alt Kıvrımlı Boyutlandırma Kulpu (Her zaman sağ altta tutulup çekilebilir!) */}
                      {(isLayoutEditMode || isSelected) &&
                        renderAppleCornerResizeHandle('unit', unit.id, box)}
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

        {/* DÜZENLEME AÇIKKEN DAİRE SAĞ TIK BAĞLAM MENÜSÜ */}
        <AnimatePresence>
          {unitContextMenu && (
            <motion.div
              ref={unitContextMenuRef}
              initial={{ opacity: 0, scale: 0.94, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: -4 }}
              transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
              style={{
                top: Math.min(
                  unitContextMenu.y,
                  typeof window !== 'undefined' ? window.innerHeight - 300 : unitContextMenu.y
                ),
                left: Math.min(
                  unitContextMenu.x,
                  typeof window !== 'undefined' ? window.innerWidth - 220 : unitContextMenu.x
                ),
              }}
              className="fixed z-[100] min-w-[210px] rounded-2xl bg-[#282522]/95 backdrop-blur-xl border border-[#4a443f] p-1.5 shadow-2xl select-none"
            >
              <div className="px-3 py-1.5 text-[10px] font-bold text-[#8c857f] uppercase tracking-wider border-b border-[#4a443f]/60 mb-1 flex items-center justify-between">
                <span>
                  {floorUnits.find((u) => u.id === unitContextMenu.unitId)?.unitNumber ||
                    'Daire İşlemleri'}
                </span>
                <span className="text-[9px] text-[#b99881]">Düzenleme</span>
              </div>

              {/* 1. İlk Haline Getir */}
              <button
                type="button"
                onClick={() => handleResetUnitToInitial(unitContextMenu.unitId)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#f3efe9] hover:bg-[#b99881]/25 hover:text-white transition-colors cursor-pointer text-left"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#b99881] shrink-0" />
                <span>İlk Haline Getir</span>
              </button>

              {/* 2. Daireyi Çoğalt */}
              <button
                type="button"
                onClick={() => handleDuplicateUnit(unitContextMenu.unitId)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#f3efe9] hover:bg-[#b99881]/25 hover:text-white transition-colors cursor-pointer text-left"
              >
                <Copy className="w-3.5 h-3.5 text-[#b99881] shrink-0" />
                <span>Daireyi Çoğalt</span>
              </button>

              <div className="my-1 border-t border-[#4a443f]/50" />

              {/* 3. Durum Değiştir Hızlı Seçenekleri */}
              <div className="px-3 py-1 text-[9.5px] font-semibold text-[#8c857f] uppercase">
                Satış Durumu
              </div>
              <button
                type="button"
                onClick={() => handleQuickSetStatus(unitContextMenu.unitId, 'SATISTA')}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-400 hover:bg-emerald-500/15 cursor-pointer text-left"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Satışta Yap</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickSetStatus(unitContextMenu.unitId, 'REZERVE')}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-400 hover:bg-amber-500/15 cursor-pointer text-left"
              >
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Rezerve Yap</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickSetStatus(unitContextMenu.unitId, 'SATILDI')}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-400 hover:bg-rose-500/15 cursor-pointer text-left"
              >
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>Satıldı Yap</span>
              </button>

              <div className="my-1 border-t border-[#4a443f]/50" />

              {/* 4. Daireyi Kaldır */}
              <button
                type="button"
                onClick={() => handleDeleteUnitQuick(unitContextMenu.unitId)}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/20 hover:text-rose-200 transition-colors cursor-pointer text-left"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>Daireyi Kaldır</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* SAĞ SÜTUN: DARALTILMIŞ VE DİKEY UZATILMIŞ DAİRE BİLGİ KUTUCUĞU */}
        <div className="p-3.5 rounded-[24px] bg-[#282522] border border-[#4a443f] flex flex-col justify-between min-h-[465px] xl:min-h-[485px] h-full">
          {activeUnit ? (
            <>
              <div className="space-y-3">
                {/* Üst Başlık */}
                <div className="space-y-1.5 pb-2 border-b border-[#4a443f]/50">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-base font-bold text-white leading-tight">
                      {activeUnit.unitNumber}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                        activeUnit.status === 'SATISTA'
                          ? 'bg-emerald-600 !text-white'
                          : activeUnit.status === 'REZERVE'
                          ? 'bg-amber-500 !text-white'
                          : 'bg-rose-600 !text-white'
                      }`}
                    >
                      {activeUnit.status === 'SATISTA'
                        ? 'Satışta'
                        : activeUnit.status === 'REZERVE'
                        ? 'Rezerve'
                        : activeUnit.statusLabel || 'SATILDI'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#34302d] font-semibold text-[#f3efe9]">
                      {activeUnit.block || 'A Blok'} •{' '}
                      {FLOOR_LABELS[Math.max(0, Math.min(2, activeUnit.floor))]?.short}
                    </span>
                    <span className="text-[11px] text-[#a69f99]">
                      {activeUnit.roomType} Krokisi
                    </span>
                  </div>
                </div>

                {/* Teknik ve Ticari Özellikler (Dikey Uzatılmış Düzen) */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-center py-0.5 border-b border-[#4a443f]/30">
                    <span className="text-[#a69f99]">Bulunduğu Kat</span>
                    <span className="font-semibold text-white text-right">
                      {FLOOR_LABELS[Math.max(0, Math.min(2, activeUnit.floor))]?.short}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-0.5 border-b border-[#4a443f]/30">
                    <span className="text-[#a69f99]">Giriş / Blok</span>
                    <span className="font-semibold text-white">
                      {activeUnit.block || 'A Blok'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-0.5 border-b border-[#4a443f]/30">
                    <span className="text-[#a69f99]">Oda Tipi</span>
                    <span className="font-semibold text-white">{activeUnit.roomType}</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5 border-b border-[#4a443f]/30">
                    <span className="text-[#a69f99]">Brüt / Net Alan</span>
                    <span className="font-semibold text-white">
                      {activeUnit.grossSqm} m² / {activeUnit.netSqm} m²
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-0.5 border-b border-[#4a443f]/30">
                    <span className="text-[#a69f99]">Liste Fiyatı</span>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-bold font-mono text-white">
                        {activeUnit.price > 0
                          ? formatCurrency(activeUnit.price)
                          : 'Belirlenmedi'}
                      </span>
                      {canEditPrice && activeUnit.status === 'SATISTA' && (
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

                {/* Daire Mimari Boyut Seçici (5 Mimari Boyut Şablonu) */}
                <div className="space-y-1 pt-0.5">
                  <div className="flex items-center justify-between text-[10.5px]">
                    <span className="font-semibold text-white">Mimari Boyut</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {(Object.keys(UNIT_SIZE_PRESETS) as UnitSizePreset[]).map((presetKey) => {
                      const info = UNIT_SIZE_PRESETS[presetKey]
                      const isActive = (activeUnit.sizePreset || 'wide-rect') === presetKey
                      const uIdx = floorUnits.findIndex((u) => u.id === activeUnit.id)
                      return (
                        <button
                          key={presetKey}
                          type="button"
                          onClick={() =>
                            handleApplyUnitSizePreset(activeUnit, presetKey, Math.max(0, uIdx))
                          }
                          className={`py-0.5 px-2 rounded-full text-[10px] font-semibold transition-all cursor-pointer truncate ${
                            isActive
                              ? 'bg-[#b99881] text-white'
                              : 'bg-[#34302d] text-[#a69f99] hover:text-white'
                          }`}
                          title={info.label}
                        >
                          {info.shortLabel}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Daire Cephe Yönü Düzenleme (Cephe Ekle / Çıkar) */}
                <div className="space-y-1 pt-0.5">
                  <div className="flex items-center justify-between text-[10.5px]">
                    <span className="font-semibold text-white">Cephe Yönü</span>
                    <span className="text-[9.5px] text-[#b99881] truncate max-w-[125px]">
                      {activeUnit.facade || 'Seçilmedi'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
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
                      const currentParts = (activeUnit.facade || '')
                        .split(/[,•/|-]+/)
                        .map((s) => s.trim().toLowerCase())
                        .filter(Boolean)
                      const hasTag = currentParts.includes(dir.toLowerCase())
                      return (
                        <button
                          key={dir}
                          type="button"
                          onClick={() => handleToggleUnitFacadeTag(dir)}
                          className={`px-1.5 py-0.5 rounded-full text-[9.5px] font-semibold transition-all cursor-pointer ${
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
                  <div className="flex items-center gap-1 pt-0.5">
                    <input
                      type="text"
                      value={customUnitFacadeInput}
                      onChange={(e) => setCustomUnitFacadeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && customUnitFacadeInput.trim()) {
                          e.preventDefault()
                          handleToggleUnitFacadeTag(customUnitFacadeInput.trim())
                          setCustomUnitFacadeInput('')
                        }
                      }}
                      placeholder="Özel cephe ekle..."
                      className="flex-1 px-2.5 py-0.5 rounded-full bg-[#34302d] text-[10px] text-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (customUnitFacadeInput.trim()) {
                          handleToggleUnitFacadeTag(customUnitFacadeInput.trim())
                          setCustomUnitFacadeInput('')
                        }
                      }}
                      className="px-2 py-0.5 rounded-full bg-[#34302d] hover:bg-[#b99881] hover:text-white text-[10px] font-semibold cursor-pointer"
                    >
                      Ekle
                    </button>
                  </div>
                </div>

                {/* Rezervasyon Bilgisi Varsa */}
                {activeUnit.status === 'REZERVE' && activeUnit.reservation && (
                  <div className="p-2 rounded-2xl bg-amber-500/10 space-y-0.5 text-xs">
                    <div className="font-semibold text-amber-700 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" />
                      <span>{activeUnit.reservation.customerName}</span>
                    </div>
                    <div className="text-[10px] text-[#a69f99] flex items-center gap-1.5">
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
                  <div className="p-2 rounded-2xl bg-rose-500/10 space-y-0.5 text-xs">
                    <div className="font-semibold text-rose-700 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Alıcı: {activeUnit.sale.customerName}</span>
                    </div>
                    <div className="text-[10px] text-[#8c857f]">
                      Satış: {formatCurrency(activeUnit.sale.salePrice)}
                    </div>
                  </div>
                )}
              </div>

              {/* Alt Aksiyon Butonları */}
              <div className="space-y-1.5 pt-2.5 mt-auto border-t border-[#4a443f]/40">
                {activeUnit.status === 'SATISTA' && (
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => onReserveUnit(activeUnit)}
                      className="py-1.5 px-2.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Rezerve Et
                    </button>
                    <button
                      type="button"
                      onClick={() => onSellUnit(activeUnit)}
                      className="py-1.5 px-2.5 rounded-full bg-[#b99881] text-white text-xs font-semibold cursor-pointer transition-colors"
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
                      className="py-1.5 px-2.5 rounded-full bg-[#b99881] text-white text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Satışa Çevir
                    </button>
                    <button
                      type="button"
                      onClick={() => onCancelReserve(activeUnit)}
                      className="py-1.5 px-2.5 rounded-full bg-rose-500/15 hover:bg-rose-500/25 text-xs font-semibold cursor-pointer transition-colors"
                    >
                      İptal Et
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onEditUnit(activeUnit)}
                    className="flex-1 py-1.5 px-2.5 rounded-full bg-[#34302d] hover:bg-[#3d3733] text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-[#b99881]" />
                    <span>Daireyi Düzenle</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenHistory(activeUnit)}
                    className="py-1.5 px-3 rounded-full bg-[#34302d] hover:bg-[#3d3733] text-xs font-medium flex items-center justify-center gap-1 cursor-pointer transition-colors"
                    title="Durum Değişiklik Geçmişi"
                  >
                    <History className="w-3.5 h-3.5 text-[#b99881]" />
                    <span>Geçmiş</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-xs text-[#8c857f] my-auto">
              Bu katta görüntülenecek daire bulunamadı.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
