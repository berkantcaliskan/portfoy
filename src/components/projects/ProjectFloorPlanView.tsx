import React, { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Layers,
  Upload,
  Compass,
  Move,
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
  Sliders,
  Box,
  Eye,
} from 'lucide-react'
import {
  SharedProject,
  FlatUnit,
  BlueprintLayoutTemplate,
  UnitPlanBox,
  RoomType,
  projectStore,
} from '@/services/projectStore'
import { formatCurrency } from '@/utils/formatters'
import {
  parseProjectDocumentFile,
  compressImageToDataUrl,
} from '@/utils/projectDocumentParser'

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

// Compute default percentage coordinates for units on a floor based on the project's template
function getDefaultUnitPlanBox(
  indexOnFloor: number,
  totalOnFloor: number,
  template: BlueprintLayoutTemplate
): UnitPlanBox {
  if (template === 'quad' && totalOnFloor <= 4) {
    const quadPositions: UnitPlanBox[] = [
      { x: 4, y: 5, w: 41, h: 41 },
      { x: 55, y: 5, w: 41, h: 41 },
      { x: 4, y: 54, w: 41, h: 41 },
      { x: 55, y: 54, w: 41, h: 41 },
    ]
    return quadPositions[indexOnFloor % 4]
  }

  if (template === 'corridor') {
    const topCount = Math.ceil(totalOnFloor / 2)
    const isTop = indexOnFloor < topCount
    const colIndex = isTop ? indexOnFloor : indexOnFloor - topCount
    const colsInRow = isTop ? topCount : Math.max(1, totalOnFloor - topCount)
    const gap = 3
    const w = Math.floor((92 - (colsInRow - 1) * gap) / colsInRow)
    const x = 4 + colIndex * (w + gap)
    const y = isTop ? 5 : 56
    return { x, y, w, h: 39 }
  }

  if (template === 'wing') {
    const positions: UnitPlanBox[] = [
      { x: 4, y: 5, w: 43, h: 41 },
      { x: 53, y: 5, w: 43, h: 41 },
      { x: 4, y: 53, w: 29, h: 42 },
      { x: 36, y: 53, w: 28, h: 42 },
      { x: 67, y: 53, w: 29, h: 42 },
    ]
    if (indexOnFloor < positions.length) return positions[indexOnFloor]
  }

  // Default grid/parcel calculation
  const cols = totalOnFloor <= 2 ? Math.max(1, totalOnFloor) : totalOnFloor <= 4 ? 2 : 3
  const rows = Math.ceil(totalOnFloor / cols)
  const col = indexOnFloor % cols
  const row = Math.floor(indexOnFloor / cols)
  const w = Math.floor((90 - (cols - 1) * 4) / cols)
  const h = Math.floor((88 - (rows - 1) * 5) / rows)
  return {
    x: 5 + col * (w + 4),
    y: 6 + row * (h + 5),
    w,
    h,
  }
}

export const ProjectFloorPlanView: React.FC<ProjectFloorPlanViewProps> = ({
  project,
  canEditPrice,
  isManagerOrAdmin,
  onReserveUnit,
  onSellUnit,
  onCancelReserve,
  onEditPrice,
  onEditUnit,
  onOpenHistory,
  onProjectUpdated,
}) => {
  const units = project.units || []

  // Distinct blocks
  const blocks = useMemo(() => {
    const set = new Set<string>()
    units.forEach((u) => set.add(u.block || 'A Blok'))
    return Array.from(set)
  }, [units])

  const [selectedBlock, setSelectedBlock] = useState<string>(blocks[0] || 'A Blok')

  useEffect(() => {
    if (!blocks.includes(selectedBlock) && blocks.length > 0) {
      setSelectedBlock(blocks[0])
    }
  }, [blocks, selectedBlock])

  // Units in active block
  const blockUnits = useMemo(
    () => units.filter((u) => (u.block || 'A Blok') === selectedBlock),
    [units, selectedBlock]
  )

  // Strictly max 3 floors: 0 (Zemin), 1 (Birinci Kat), 2 (İkinci Kat)
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

  // Units on active floor (clamped to 0..2)
  const floorUnits = useMemo(
    () =>
      blockUnits
        .filter((u) => Math.max(0, Math.min(2, u.floor)) === selectedFloor)
        .sort((a, b) => a.unitNumber.localeCompare(b.unitNumber, 'tr', { numeric: true })),
    [blockUnits, selectedFloor]
  )

  // Selected unit for inspector panel
  const [activeUnitId, setActiveUnitId] = useState<string | null>(floorUnits[0]?.id || null)

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

  // Light 3D Mode & Manual Kroki Settings State
  const [is3DEnabled, setIs3DEnabled] = useState<boolean>(true)
  const [tiltAngle, setTiltAngle] = useState<number>(14)
  const [showManualSettings, setShowManualSettings] = useState<boolean>(true)
  const [isParsingDoc, setIsParsingDoc] = useState<boolean>(false)
  const [docFeedback, setDocFeedback] = useState<string | null>(
    project.sourceDocumentSummary || null
  )

  // Manual Config states synced with project
  const currentUnitsPerFloor = useMemo(() => {
    if (project.unitsPerFloor) return project.unitsPerFloor
    return Math.max(1, Math.min(8, floorUnits.length || 4))
  }, [project.unitsPerFloor, floorUnits.length])

  const currentBlockCount: 1 | 2 = blocks.length >= 2 ? 2 : 1
  const currentRoomTypeSetting: RoomType | 'MIXED' = project.defaultRoomType || 'MIXED'

  // Interactive Layout Editing Mode (drag/reposition units on plan)
  const [isLayoutEditMode, setIsLayoutEditMode] = useState(false)
  const [planOpacity, setPlanOpacity] = useState<number>(85)
  const canvasRef = useRef<HTMLDivElement>(null)
  const fileInputUniversalRef = useRef<HTMLInputElement>(null)
  const fileInputFloorRef = useRef<HTMLInputElement>(null)

  // Dragging state for custom kroki positioning
  const [draggingUnitId, setDraggingUnitId] = useState<string | null>(null)
  const dragStartRef = useRef<{
    mouseX: number
    mouseY: number
    box: UnitPlanBox
  } | null>(null)

  const handleSelectTemplate = (tpl: BlueprintLayoutTemplate) => {
    projectStore.updateProject(project.id, { layoutTemplate: tpl })
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
        sourceDocumentName: parsed.fileName,
        sourceDocumentSummary: parsed.summary,
        parsedUnits: parsed.parsedUnits.length > 0 ? parsed.parsedUnits : undefined,
      })
      setDocFeedback(parsed.summary)
      setSelectedFloor(0)
      onProjectUpdated()
    } catch (err) {
      console.error('Belge analiz hatası:', err)
      setDocFeedback('Belge okunurken bir sorun oluştu, varsayılan 3 katlı kroki korundu.')
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

  // Manual Kroki Reconfiguration handler (Floor count max 3, units per floor, block count, room type)
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
    floorUnits.forEach((u) => {
      projectStore.updateUnitPlanBox(project.id, u.id, undefined)
    })
    onProjectUpdated()
  }

  // Pointer move / up for dragging unit boxes in Layout Edit Mode
  useEffect(() => {
    if (!draggingUnitId) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current || !dragStartRef.current) return
      const rect = canvasRef.current.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return

      const dxPct = ((e.clientX - dragStartRef.current.mouseX) / rect.width) * 100
      const dyPct = ((e.clientY - dragStartRef.current.mouseY) / rect.height) * 100

      const nextX = Math.max(
        1,
        Math.min(99 - dragStartRef.current.box.w, Math.round(dragStartRef.current.box.x + dxPct))
      )
      const nextY = Math.max(
        1,
        Math.min(99 - dragStartRef.current.box.h, Math.round(dragStartRef.current.box.y + dyPct))
      )

      projectStore.updateUnitPlanBox(project.id, draggingUnitId, {
        ...dragStartRef.current.box,
        x: nextX,
        y: nextY,
      })
      onProjectUpdated()
    }

    const handleMouseUp = () => {
      setDraggingUnitId(null)
      dragStartRef.current = null
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [draggingUnitId, project.id, onProjectUpdated])

  // Render clean, easy-to-read 3D internal architectural room blocks inside each unit
  const renderInternalBlueprintRooms = (unit: FlatUnit) => {
    const rt = unit.roomType
    return (
      <div className="grid grid-cols-12 gap-1.5 mt-2 pt-2 text-[9.5px] font-mono select-none pointer-events-none">
        <div className="col-span-6 px-2 py-1 rounded-xl bg-white/75 shadow-xs flex items-center justify-between">
          <span className="font-bold tracking-tight">SALON</span>
          <span className="text-[8.5px] opacity-75">{Math.round(unit.netSqm * 0.36)}m²</span>
        </div>
        <div className="col-span-6 px-2 py-1 rounded-xl bg-white/75 shadow-xs flex items-center justify-between">
          <span className="font-bold tracking-tight">MUTFAK</span>
          <span className="text-[8.5px] opacity-75">{Math.round(unit.netSqm * 0.16)}m²</span>
        </div>
        <div className="col-span-5 px-2 py-1 rounded-xl bg-white/75 shadow-xs flex items-center justify-between">
          <span className="font-bold tracking-tight">EBEVEYN</span>
          <span className="text-[8.5px] opacity-75">{Math.round(unit.netSqm * 0.22)}m²</span>
        </div>
        {rt !== '1+1' && (
          <div className="col-span-4 px-2 py-1 rounded-xl bg-white/75 shadow-xs flex items-center justify-between">
            <span className="font-bold tracking-tight">
              {rt === '2+1' ? 'ODA 1' : rt === '3+1' ? '2 ODA' : '3+ ODA'}
            </span>
            <span className="text-[8.5px] opacity-75">{Math.round(unit.netSqm * 0.16)}m²</span>
          </div>
        )}
        <div
          className={`${
            rt === '1+1' ? 'col-span-7' : 'col-span-3'
          } px-2 py-1 rounded-xl bg-white/60 border border-dashed border-current/30 flex items-center justify-between`}
        >
          <span className="font-bold tracking-tight">TERAS</span>
          <span className="text-[8.5px] opacity-75">{Math.max(4, Math.round(unit.netSqm * 0.1))}m²</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ÜST ARAÇ ÇUBUĞU: Akıllı Belge Okuyucu (Word, PDF, PPTX, Excel, Görsel) & Hızlı Kroki Ayarları */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Sol: Blok Sekmeleri + Mimari Dizilim Şablonları */}
        <div className="flex flex-wrap items-center gap-2">
          {blocks.length > 1 && (
            <div className="inline-flex items-center gap-1.5">
              {blocks.map((b) => {
                const isActive = b === selectedBlock
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setSelectedBlock(b)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#b99881] text-white'
                        : 'bg-[#34302d] text-[#a69f99] hover:text-white'
                    }`}
                  >
                    {b}
                  </button>
                )
              })}
            </div>
          )}

          {/* Projenin Mimari Kroki Şablonu */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-[#8c857f] hidden sm:inline mr-1">
              Dizilim:
            </span>
            {[
              { id: 'quad' as BlueprintLayoutTemplate, label: 'Çekirdek (4 Aks)' },
              { id: 'corridor' as BlueprintLayoutTemplate, label: 'Koridor Tipi' },
              { id: 'wing' as BlueprintLayoutTemplate, label: 'Panoramik Kanat' },
              { id: 'villa' as BlueprintLayoutTemplate, label: 'Parsel / Villa' },
            ].map((tpl) => {
              const active = layoutTemplate === tpl.id
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => handleSelectTemplate(tpl.id)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                    active
                      ? 'bg-[#b99881] text-white font-semibold'
                      : 'bg-[#34302d] text-[#a69f99] hover:text-white'
                  }`}
                >
                  {tpl.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Sağ: Word / PDF / PPTX / Excel / Görsel Yükle + 3D Toggle + Ayarlar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Gizli Evrensel Belge Inputu (Word, PDF, PPTX, Excel, CSV, Görsel) */}
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
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,image/*"
            className="hidden"
            onChange={handleUploadFloorSpecific}
          />

          <button
            type="button"
            onClick={() => fileInputUniversalRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#b99881] text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
            title="Word (.docx), PDF (.pdf), PowerPoint (.pptx), Excel (.xlsx) veya Görsel yükleyerek krokiyi otomatik oluştur"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>
              {isParsingDoc
                ? 'Dosya Okunuyor...'
                : 'Belge / Plan Yükle (Word, PDF, PPTX, Excel)'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => fileInputFloorRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#34302d] hover:bg-[#3d3733] text-xs font-medium text-[#f3efe9] transition-colors cursor-pointer"
            title={`${FLOOR_LABELS[selectedFloor]?.short || 'Kat'} için özel kat planı görseli yükle`}
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

          {/* Hafif 3D Görünüm Anahtarı */}
          <button
            type="button"
            onClick={() => setIs3DEnabled(!is3DEnabled)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              is3DEnabled
                ? 'bg-[#b99881] text-white'
                : 'bg-[#34302d] text-[#a69f99] hover:text-white'
            }`}
            title="Hafif 3D Mimari Perspektif Etkisini Aç / Kapat"
          >
            <Box className="w-3.5 h-3.5" />
            <span>{is3DEnabled ? '3D Kroki Aktif' : '2D Görünüm'}</span>
          </button>

          {/* Otomatik & Manuel Kroki Ayarları Paneli Aç/Kapa */}
          <button
            type="button"
            onClick={() => setShowManualSettings(!showManualSettings)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
              showManualSettings
                ? 'bg-[#b99881] text-white font-semibold'
                : 'bg-[#34302d] text-[#a69f99] hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Kroki Ayarları</span>
          </button>

          {isManagerOrAdmin && (
            <button
              type="button"
              onClick={() => setIsLayoutEditMode(!isLayoutEditMode)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                isLayoutEditMode
                  ? 'bg-[#b99881] text-white'
                  : 'bg-[#34302d] text-[#d6beae] hover:text-white'
              }`}
              title="Dairelerin kroki üzerindeki konumlarını sürükleyerek özelleştir"
            >
              {isLayoutEditMode ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Konumu Kaydet</span>
                </>
              ) : (
                <>
                  <Move className="w-3.5 h-3.5 text-[#b99881]" />
                  <span>Sürükle</span>
                </>
              )}
            </button>
          )}

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

      {/* OTOMATİK OKUNAN BELGE BİLDİRİMİ */}
      {docFeedback && (
        <div className="px-4 py-2.5 rounded-full bg-[#282522] border border-[#4a443f] flex items-center justify-between gap-3 text-xs">
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

      {/* OTOMATİK & MANUEL KROKİ AYARLARI ÇUBUĞU (Kat Sayısı Maks 3: Zemin, Birinci, İkinci + Kat Başına Daire + Oda Tipi + 3D Açı) */}
      {showManualSettings && (
        <div className="p-4 rounded-[24px] bg-[#282522] border border-[#4a443f] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-center">
          {/* 1. Kat Sayısı (Maks 3: Zemin, 1. Kat, 2. Kat) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-white">Kat Sayısı (Maks 3)</span>
              <span className="text-[#8c857f]">Otomatik / Manuel</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { val: 1 as const, label: '1 Kat', sub: 'Zemin' },
                { val: 2 as const, label: '2 Kat', sub: 'Z + 1.Kat' },
                { val: 3 as const, label: '3 Kat', sub: 'Z + 1 + 2' },
              ].map((opt) => {
                const active = configuredMaxFloors === opt.val
                return (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => handleManualReconfigure({ maxFloors: opt.val })}
                    className={`py-1.5 px-2 rounded-full text-center transition-all cursor-pointer ${
                      active
                        ? 'bg-[#b99881] text-white font-bold shadow-xs'
                        : 'bg-[#34302d] text-[#a69f99] hover:text-white'
                    }`}
                  >
                    <div className="text-[11px] leading-tight">{opt.label}</div>
                    <div className="text-[9px] opacity-80 leading-tight">{opt.sub}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 2. Kat Başına Daire Sayısı */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-white">Kattaki Daire Sayısı</span>
              <span className="font-mono text-xs font-bold text-[#b99881]">
                {currentUnitsPerFloor} Daire/Kat
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {[2, 3, 4, 6].map((cnt) => {
                const active = currentUnitsPerFloor === cnt
                return (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => handleManualReconfigure({ unitsPerFloor: cnt })}
                    className={`flex-1 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
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

          {/* 3. Blok Sayısı */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-white">Blok Yapısı</span>
              <span className="text-[#8c857f]">{units.length} Toplam Ünite</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { val: 1 as const, label: 'Tek Blok (A)' },
                { val: 2 as const, label: '2 Blok (A - B)' },
              ].map((bOpt) => {
                const active = currentBlockCount === bOpt.val
                return (
                  <button
                    key={bOpt.val}
                    type="button"
                    onClick={() => handleManualReconfigure({ blockCount: bOpt.val })}
                    className={`py-1.5 px-2.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
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

          {/* 4. Varsayılan Oda Tipi */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-white">Oda Tipi Dağılımı</span>
              <span className="text-[#8c857f]">Otomatik / Manuel</span>
            </div>
            <div className="flex items-center gap-1 overflow-x-auto">
              {[
                { id: 'MIXED' as const, label: 'Karma' },
                { id: '1+1' as RoomType, label: '1+1' },
                { id: '2+1' as RoomType, label: '2+1' },
                { id: '3+1' as RoomType, label: '3+1' },
                { id: 'Villa' as RoomType, label: 'Villa' },
              ].map((rm) => {
                const active = currentRoomTypeSetting === rm.id
                return (
                  <button
                    key={rm.id}
                    type="button"
                    onClick={() => handleManualReconfigure({ defaultRoomType: rm.id })}
                    className={`px-2.5 py-1.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer shrink-0 ${
                      active
                        ? 'bg-[#b99881] text-white'
                        : 'bg-[#34302d] text-[#a69f99] hover:text-white'
                    }`}
                  >
                    {rm.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 5. Hafif 3D Perspektif Derinliği */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-white">3D Perspektif Eğimi</span>
              <span className="font-mono text-[#b99881] font-bold">
                {is3DEnabled ? `${tiltAngle}°` : 'Kapalı'}
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#34302d]">
              <input
                type="range"
                min={0}
                max={24}
                value={is3DEnabled ? tiltAngle : 0}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  if (v === 0) {
                    setIs3DEnabled(false)
                  } else {
                    setIs3DEnabled(true)
                    setTiltAngle(v)
                  }
                }}
                className="w-full cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* ANA ETKİLEŞİMLİ ALAN: Sol 3-Katlı 3D Katman Seçici + Orta Hafif 3D Kroki + Sağ Seçili Daire Denetçisi */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* SOL SÜTUN (2 Kolon): MAKS 3 KATLI 3D KATMAN SEÇİCİ (İkinci Kat, Birinci Kat, Zemin Kat) */}
        <div className="lg:col-span-2 p-3.5 rounded-[24px] bg-[#282522] border border-[#4a443f] space-y-3">
          <div className="flex items-center justify-between px-1.5">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#b99881]" />
              <span>Kat Plakaları</span>
            </span>
            <span className="text-[10px] font-mono text-[#8c857f]">Maks {configuredMaxFloors} Kat</span>
          </div>

          {/* Yukarıdan aşağıya: 2. Kat -> 1. Kat -> Zemin Kat (İzometrik 3D Katman Görünümlü Pill Seçici) */}
          <div className="flex lg:flex-col gap-2.5 overflow-x-auto lg:overflow-x-visible py-1">
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
                  style={{
                    transform: isSelected
                      ? 'translateY(-2px) scale(1.02)'
                      : 'translateY(0px) scale(1)',
                    boxShadow: isSelected
                      ? '0 8px 18px -4px rgba(41, 45, 43, 0.22), 0 4px 0 0 rgba(41, 45, 43, 0.18)'
                      : '0 3px 0 0 rgba(41, 45, 43, 0.10)',
                  }}
                  className={`w-full min-w-[140px] lg:min-w-0 px-3.5 py-2.5 rounded-full text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'bg-[#b99881] text-white'
                      : 'bg-[#34302d] text-[#f3efe9] hover:opacity-95'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">{labelInfo.short}</div>
                    <div className="text-[9.5px] opacity-80 truncate">{labelInfo.sub}</div>
                  </div>

                  {/* Kat Üzerindeki Dairelerin Satış Durumu Renk Noktaları */}
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
                        title={`Satıldı: ${soldCount}`}
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

          {/* 3D Katman Özeti */}
          <div className="pt-1 px-1.5 text-[10.5px] text-[#8c857f] space-y-1">
            <div className="flex justify-between">
              <span>Aktif Kat:</span>
              <strong className="text-white">{FLOOR_LABELS[selectedFloor]?.short}</strong>
            </div>
            <div className="flex justify-between">
              <span>Bu Kattaki Ünite:</span>
              <strong className="text-white">{floorUnits.length} Bağımsız Bölüm</strong>
            </div>
          </div>
        </div>

        {/* ORTA SÜTUN (7 Kolon): HAFİF 3D ETKİLİ ETKİLEŞİMLİ MİMARİ KAT KROKİSİ */}
        <div className="lg:col-span-7 p-4 rounded-[24px] bg-[#282522] border border-[#4a443f] space-y-3">
          {/* Kroki Üst Başlık ve Durum Lejantı */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
            <div>
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-[#b99881]" />
                <h4 className="text-sm font-bold text-white">
                  {project.name} — {selectedBlock} • {FLOOR_LABELS[selectedFloor]?.full}
                </h4>
              </div>
              <p className="text-[11px] text-[#a69f99] mt-0.5">
                {isLayoutEditMode
                  ? 'Sürükleme modu aktif: Daireleri kat plakası üzerinde istediğiniz konuma taşıyabilirsiniz.'
                  : 'Hafif 3D kat plakası üzerindeki daireye tıklayarak detaylarını inceleyebilir, rezerve veya satış yapabilirsiniz.'}
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
                <span>Satıldı</span>
              </span>
            </div>
          </div>

          {/* Yüklenen Kat Planı Görseli Varsa Opaklık Ayarı */}
          {activeFloorPlanUrl && (
            <div className="flex items-center justify-between gap-3 px-4 py-1.5 rounded-full bg-[#34302d] text-xs">
              <div className="flex items-center gap-2">
                <Eye className="w-3.5 h-3.5 text-[#b99881]" />
                <span className="text-[11px] font-medium">
                  {specificFloorPlan
                    ? `${FLOOR_LABELS[selectedFloor]?.short} Özel Plan Altlığı Aktif`
                    : 'Belgeden Aktarılan Mimari Plan Altlığı Aktif'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#8c857f]">Altlık Belirginliği: %{planOpacity}</span>
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

          {/* HAFİF 3D MİMARİ KAT PLAKASI SAHNESİ (Light 3D Isometric / Perspective Stage) */}
          <div
            className="relative py-3 px-1 sm:px-3"
            style={{
              perspective: is3DEnabled ? '1350px' : 'none',
            }}
          >
            {/* Alt Katların Hafif 3D Gölge Katmanları (3D Maket Plaka Hissi) */}
            {is3DEnabled && selectedFloor > 0 && (
              <div
                className="pointer-events-none absolute inset-x-5 bottom-0 h-[92%] rounded-[24px] border border-black/15 bg-black/5 transition-all duration-300"
                style={{
                  transform: `rotateX(${tiltAngle}deg) rotateZ(-1.2deg) translateY(16px) translateZ(-28px) scale(0.97)`,
                }}
              />
            )}
            {is3DEnabled && selectedFloor > 1 && (
              <div
                className="pointer-events-none absolute inset-x-8 bottom-0 h-[90%] rounded-[24px] border border-black/10 bg-black/[0.03] transition-all duration-300"
                style={{
                  transform: `rotateX(${tiltAngle}deg) rotateZ(-1.2deg) translateY(30px) translateZ(-54px) scale(0.94)`,
                }}
              />
            )}

            {/* ANA 3D KAT PLAKASI (Architectural Blueprint Slab) */}
            <div
              ref={canvasRef}
              className="relative w-full min-h-[520px] rounded-[24px] bg-[#34302d] border-2 border-[#4a443f] overflow-hidden select-none transition-transform duration-300"
              style={{
                transform: is3DEnabled
                  ? `rotateX(${tiltAngle}deg) rotateZ(-1.2deg)`
                  : 'none',
                transformStyle: 'preserve-3d',
                boxShadow: is3DEnabled
                  ? '0 18px 0 -2px rgba(41, 45, 43, 0.16), 0 28px 44px -10px rgba(41, 45, 43, 0.24)'
                  : '0 4px 16px -4px rgba(41, 45, 43, 0.08)',
                backgroundImage:
                  'radial-gradient(rgba(92, 106, 196, 0.18) 1px, transparent 1px), linear-gradient(to right, rgba(92, 106, 196, 0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(92, 106, 196, 0.06) 1px, transparent 1px)',
                backgroundSize: '20px 20px, 60px 60px, 60px 60px',
              }}
            >
              {/* Yüklü Kat Planı Görseli (Varsa arka planda ölçekli gösterilir) */}
              {activeFloorPlanUrl && (
                <img
                  src={activeFloorPlanUrl}
                  alt={`${project.name} ${FLOOR_LABELS[selectedFloor]?.short}`}
                  style={{ opacity: planOpacity / 100 }}
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none p-2"
                />
              )}

              {/* Pusula / Cephe Yön Etiketleri */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-white/90 shadow-xs text-[9.5px] font-mono font-bold uppercase tracking-widest text-[#292d2b] pointer-events-none z-10">
                ▲ Kuzey / Arka Cephe
              </div>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-white/90 shadow-xs text-[9.5px] font-mono font-bold uppercase tracking-widest text-[#292d2b] pointer-events-none z-10">
                ▼ Güney / Ön Cephe ({FLOOR_LABELS[selectedFloor]?.short})
              </div>

              {/* Mimari Şablon Merkez Koridor / Asansör Çekirdeği */}
              {!activeFloorPlanUrl && layoutTemplate === 'quad' && (
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[9%] h-[80%] rounded-2xl border border-dashed border-black/20 bg-white/60 flex flex-col items-center justify-center gap-2 pointer-events-none shadow-inner">
                  <div className="text-[9px] font-mono font-bold uppercase tracking-widest text-[#292d2b]/60 rotate-180 [writing-mode:vertical-rl]">
                    MERDİVEN & ASANSÖR HOLÜ
                  </div>
                </div>
              )}

              {!activeFloorPlanUrl && layoutTemplate === 'corridor' && (
                <div className="absolute left-[4%] right-[4%] top-1/2 -translate-y-1/2 h-[9%] rounded-2xl border border-dashed border-black/20 bg-white/60 flex items-center justify-center pointer-events-none shadow-inner">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#292d2b]/60">
                    ANA KAT KORİDORU • ASANSÖR & MERDİVEN HOLÜ
                  </span>
                </div>
              )}

              {/* KATTAKİ DAİRELERİN HAFİF 3D KROKİ KUTULARI */}
              <AnimatePresence mode="popLayout">
                {floorUnits.map((unit, idx) => {
                  const box =
                    unit.planBox || getDefaultUnitPlanBox(idx, floorUnits.length, layoutTemplate)
                  const isSelected = activeUnit?.id === unit.id
                  const isAvailable = unit.status === 'SATISTA'
                  const isReserved = unit.status === 'REZERVE'

                  // Satış durumuna göre temiz, ferah 3D katman renkleri
                  const statusColorClasses = isAvailable
                    ? 'bg-emerald-500/16 hover:bg-emerald-500/24 border-emerald-600/75 text-emerald-950'
                    : isReserved
                    ? 'bg-amber-500/18 hover:bg-amber-500/26 border-amber-500/80 text-amber-950'
                    : 'bg-rose-500/16 hover:bg-rose-500/24 border-rose-500/75 text-rose-950'

                  const badgeClasses = isAvailable
                    ? 'bg-emerald-600 !text-white'
                    : isReserved
                    ? 'bg-amber-500 !text-white'
                    : 'bg-rose-600 !text-white'

                  // 3D Extruded room block shadow
                  const box3DShadow = isSelected
                    ? '0 10px 0 0 rgba(41, 45, 43, 0.22), 0 20px 32px -6px rgba(41, 45, 43, 0.28)'
                    : '0 6px 0 0 rgba(41, 45, 43, 0.14), 0 10px 18px -4px rgba(41, 45, 43, 0.14)'

                  return (
                    <motion.div
                      key={unit.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{
                        opacity: 1,
                        scale: isSelected ? 1.02 : 1,
                        y: isSelected ? -5 : 0,
                      }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      whileHover={{ y: -4, scale: 1.015 }}
                      transition={{ duration: 0.2 }}
                      style={{
                        left: `${box.x}%`,
                        top: `${box.y}%`,
                        width: `${box.w}%`,
                        height: `${box.h}%`,
                        boxShadow: is3DEnabled ? box3DShadow : undefined,
                      }}
                      onMouseDown={(e) => {
                        setActiveUnitId(unit.id)
                        if (isLayoutEditMode) {
                          e.stopPropagation()
                          setDraggingUnitId(unit.id)
                          dragStartRef.current = {
                            mouseX: e.clientX,
                            mouseY: e.clientY,
                            box,
                          }
                        }
                      }}
                      onClick={() => setActiveUnitId(unit.id)}
                      className={`absolute rounded-[20px] border-2 p-3 flex flex-col justify-between transition-colors backdrop-blur-[2px] ${statusColorClasses} ${
                        isSelected ? 'ring-3 ring-[#5c6ac4] z-20' : 'z-10'
                      } ${isLayoutEditMode ? 'cursor-move' : 'cursor-pointer'}`}
                    >
                      {/* Üst Satır: Daire No, Oda Tipi ve Satış Durumu Renk Rozeti */}
                      <div>
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="px-2.5 py-0.5 rounded-full bg-[#282522] text-white font-mono text-xs font-bold shrink-0 shadow-xs">
                              {unit.unitNumber}
                            </span>
                            <span className="text-xs font-bold truncate">{unit.roomType}</span>
                          </div>

                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 shadow-xs ${badgeClasses}`}
                          >
                            {isAvailable ? 'Satışta' : isReserved ? 'Rezerve' : 'Satıldı'}
                          </span>
                        </div>

                        {/* Metrekare ve Cephe Bilgisi */}
                        <div className="flex items-center justify-between text-[11px] font-semibold mt-1 opacity-90">
                          <span>
                            {unit.grossSqm} m² brüt / {unit.netSqm} m² net
                          </span>
                          {unit.facade && (
                            <span className="truncate ml-1 opacity-85">{unit.facade}</span>
                          )}
                        </div>

                        {/* Hafif 3D Oda Bölmeleri (Salon, Mutfak, Ebeveyn, Teras) */}
                        {box.h >= 34 && renderInternalBlueprintRooms(unit)}
                      </div>

                      {/* Alt Satır: Fiyat ve Müşteri / Rezervasyon Durumu */}
                      <div className="pt-1 flex items-center justify-between gap-2 mt-1">
                        <div className="min-w-0">
                          {isReserved && unit.reservation ? (
                            <div className="text-[10.5px] font-bold truncate">
                              Opsiyon: {unit.reservation.customerName}
                            </div>
                          ) : unit.status === 'SATILDI' && unit.sale ? (
                            <div className="text-[10.5px] font-bold truncate">
                              Alıcı: {unit.sale.customerName}
                            </div>
                          ) : (
                            <div className="text-[10.5px] font-medium opacity-80 truncate">
                              {FLOOR_LABELS[selectedFloor]?.short} • Satışa Uygun
                            </div>
                          )}
                        </div>

                        <div className="text-xs font-bold font-mono shrink-0 bg-white/80 px-2.5 py-0.5 rounded-full shadow-2xs">
                          {unit.price > 0 ? formatCurrency(unit.price) : 'Fiyat Sorunuz'}
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* SAĞ SÜTUN (3 Kolon): SEÇİLİ DAİRE DENETÇİSİ VE HIZLI İŞLEM PANELİ */}
        <div className="lg:col-span-3 p-5 rounded-[24px] bg-[#282522] border border-[#4a443f] space-y-4 sticky top-4">
          {activeUnit ? (
            <>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-white">{activeUnit.unitNumber}</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#34302d] font-semibold">
                      {activeUnit.block || 'A Blok'} •{' '}
                      {FLOOR_LABELS[Math.max(0, Math.min(2, activeUnit.floor))]?.short}
                    </span>
                  </div>
                  <div className="text-xs text-[#a69f99] mt-1">
                    {activeUnit.roomType} Bağımsız Bölüm Krokisi
                  </div>
                </div>

                <span
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
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
                    : 'Satıldı'}
                </span>
              </div>

              {/* Teknik ve Ticari Özellikler */}
              <div className="space-y-2.5 text-xs pt-1">
                <div className="flex justify-between items-center">
                  <span className="text-[#a69f99]">Bulunduğu Kat</span>
                  <span className="font-semibold text-white">
                    {FLOOR_LABELS[Math.max(0, Math.min(2, activeUnit.floor))]?.full}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#a69f99]">Oda Tipi</span>
                  <span className="font-semibold text-white">{activeUnit.roomType}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#a69f99]">Brüt / Net Alan</span>
                  <span className="font-semibold text-white">
                    {activeUnit.grossSqm} m² / {activeUnit.netSqm} m²
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#a69f99]">Cephe Yönü</span>
                  <span className="font-semibold text-white">
                    {activeUnit.facade || 'Güney - Ön Cephe'}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-[#a69f99]">Liste Fiyatı</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold font-mono text-white">
                      {activeUnit.price > 0 ? formatCurrency(activeUnit.price) : 'Belirlenmedi'}
                    </span>
                    {canEditPrice && activeUnit.status === 'SATISTA' && (
                      <button
                        type="button"
                        onClick={() => onEditPrice(activeUnit)}
                        className="p-1.5 rounded-full bg-[#34302d] hover:bg-[#b99881] transition-colors cursor-pointer"
                        title="Fiyatı Güncelle"
                      >
                        <TurkishLira className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Rezervasyon Bilgisi Varsa */}
              {activeUnit.status === 'REZERVE' && activeUnit.reservation && (
                <div className="p-3 rounded-2xl bg-amber-500/10 space-y-1 text-xs">
                  <div className="font-semibold text-amber-700 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    <span>{activeUnit.reservation.customerName}</span>
                  </div>
                  <div className="text-[11px] text-[#a69f99] flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    <span>
                      Opsiyon Bitiş:{' '}
                      {new Date(activeUnit.reservation.expiresAt).toLocaleDateString('tr-TR')}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#8c857f]">
                    Danışman: {activeUnit.reservation.reservedByUserName}
                  </div>
                </div>
              )}

              {/* Satış Bilgisi Varsa */}
              {activeUnit.status === 'SATILDI' && activeUnit.sale && (
                <div className="p-3 rounded-2xl bg-rose-500/10 space-y-1 text-xs">
                  <div className="font-semibold text-rose-700 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Alıcı: {activeUnit.sale.customerName}</span>
                  </div>
                  <div className="text-[11px] text-[#a69f99]">
                    Sözleşme No: {activeUnit.sale.contractNo}
                  </div>
                  <div className="text-[11px] text-[#8c857f]">
                    Satış Fiyatı: {formatCurrency(activeUnit.sale.salePrice)}
                  </div>
                </div>
              )}

              {/* Hızlı Aksiyon Butonları (Pill Shape) */}
              <div className="space-y-2 pt-2">
                {activeUnit.status === 'SATISTA' && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onReserveUnit(activeUnit)}
                      className="py-2 px-3 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Rezerve Et
                    </button>
                    <button
                      type="button"
                      onClick={() => onSellUnit(activeUnit)}
                      className="py-2 px-3 rounded-full bg-[#b99881] text-white text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Satış Yap
                    </button>
                  </div>
                )}

                {activeUnit.status === 'REZERVE' && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onSellUnit(activeUnit)}
                      className="py-2 px-3 rounded-full bg-[#b99881] text-white text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Satışa Çevir
                    </button>
                    <button
                      type="button"
                      onClick={() => onCancelReserve(activeUnit)}
                      className="py-2 px-3 rounded-full bg-rose-500/15 hover:bg-rose-500/25 text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Opsiyonu İptal Et
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onEditUnit(activeUnit)}
                    className="flex-1 py-2 px-3 rounded-full bg-[#34302d] hover:bg-[#3d3733] text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-[#b99881]" />
                    <span>Daireyi Düzenle</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenHistory(activeUnit)}
                    className="py-2 px-3.5 rounded-full bg-[#34302d] hover:bg-[#3d3733] text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    title="Durum Değişiklik Geçmişi"
                  >
                    <History className="w-3.5 h-3.5 text-[#b99881]" />
                    <span>Geçmiş</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-xs text-[#8c857f]">
              Bu katta görüntülenecek daire bulunamadı.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
