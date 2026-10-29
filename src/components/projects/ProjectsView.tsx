import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2,
  Home,
  MapPin,
  Calendar,
  Layers,
  TrendingUp,
  Plus,
  Filter,
  ShieldAlert,
  Clock,
  User,
  History,
  CheckCircle2,
  AlertTriangle,
  X,
  TurkishLira,
  Lock,
  Edit2,
  ChevronLeft,
  ChevronRight,
  Compass,
  Settings,
  RotateCcw,
  Trash2,
  FileSpreadsheet,
  Sparkles,
  List,
  LayoutGrid,
} from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlassButton } from '@/components/ui/GlassButton'
import { GlassBadge } from '@/components/ui/GlassBadge'
import { GlassModal } from '@/components/ui/GlassModal'
import { formatCurrency } from '@/utils/formatters'
import {
  projectStore,
  SharedProject,
  FlatUnit,
  FlatStatus,
  RoomType,
  BlueprintLayoutTemplate,
} from '@/services/projectStore'
import { userStore, AppUser } from '@/services/userStore'
import { permissionService } from '@/services/permissionService'
import { ProjectFloorPlanView, FLOOR_LABELS } from './ProjectFloorPlanView'
import { parseProjectDocumentFile, ParsedUnitDraft } from '@/utils/projectDocumentParser'

interface ProjectsViewProps {
  onNavigateToPortfolio: () => void
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({ onNavigateToPortfolio }) => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(userStore.getCurrentUser())
  const [projects, setProjects] = useState<SharedProject[]>(projectStore.getAll())
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '')
  const [selectedCity, setSelectedCity] = useState<string>('ALL')
  const [viewMode, setViewMode] = useState<'grid' | 'detail'>('grid')
  const [detailDisplayMode, setDetailDisplayMode] = useState<'blueprint' | 'cards'>('blueprint')
  const [listSubViewMode, setListSubViewMode] = useState<'list' | 'card'>('list')
  const [activeListUnitId, setActiveListUnitId] = useState<string | null>(null)

  // Modals
  const [isAddProjectOpen, setIsAddProjectOpen] = useState(false)
  const [selectedUnit, setSelectedUnit] = useState<FlatUnit | null>(null)
  const [isReserveModalOpen, setIsReserveModalOpen] = useState(false)
  const [isSellModalOpen, setIsSellModalOpen] = useState(false)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false)

  // Edit Unit Modal State
  const [isEditUnitModalOpen, setIsEditUnitModalOpen] = useState(false)
  const [editingUnit, setEditingUnit] = useState<FlatUnit | null>(null)
  const [editUnitForm, setEditUnitForm] = useState<{
    price: number | string
    facade: string
    description: string
    roomType: RoomType
    block: string
    floor: number | string
    grossSqm: number | string
    netSqm: number | string
    statusLabel: string
  }>({
    price: 0,
    facade: '',
    description: '',
    roomType: '2+1' as RoomType,
    block: 'A Blok',
    floor: 1,
    grossSqm: 100,
    netSqm: 80,
    statusLabel: 'Satışta',
  })

  // Form states
  const [customerName, setCustomerName] = useState('')
  const [reserveDays, setReserveDays] = useState<number | string>(5)
  const [depositAmount, setDepositAmount] = useState<number | string>(100000)
  const [reserveNote, setReserveNote] = useState('')
  const [salePrice, setSalePrice] = useState<number | string>(0)
  const [paymentPlan, setPaymentPlan] = useState('%50 Peşin + 24 Ay Taksit')
  const [editPrice, setEditPrice] = useState<number | string>(0)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  // New project form (with automatic & manual kroki settings, max 3 floors)
  const [isParsingNewProjectDoc, setIsParsingNewProjectDoc] = useState(false)
  const [newProject, setNewProject] = useState<{
    name: string
    city: string
    district: string
    mevki: string
    type: string
    totalUnits: number | string
    deliveryDate: string
    description: string
    layoutTemplate: BlueprintLayoutTemplate
    blueprintUrl: string
    maxFloors: 1 | 2 | 3
    unitsPerFloor: number
    blockCount: 1 | 2
    defaultRoomType: RoomType | 'MIXED'
    sourceDocumentName: string
    sourceDocumentSummary: string
    parsedUnits: ParsedUnitDraft[]
    customAreas?: any[]
    customFacades?: any[]
    paymentBanner?: string
    parcelInfo?: string
  }>({
    name: '',
    city: 'Sakarya',
    district: '',
    mevki: '',
    type: 'Konut & Rezidans',
    totalUnits: 12,
    deliveryDate: 'Aralık 2027',
    description: '',
    layoutTemplate: 'quad' as BlueprintLayoutTemplate,
    blueprintUrl: '',
    maxFloors: 3,
    unitsPerFloor: 4,
    blockCount: 1,
    defaultRoomType: 'MIXED',
    sourceDocumentName: '',
    sourceDocumentSummary: '',
    parsedUnits: [],
    customAreas: undefined,
    customFacades: undefined,
    paymentBanner: undefined,
    parcelInfo: undefined,
  })

  // Project Settings state
  const [isProjectSettingsOpen, setIsProjectSettingsOpen] = useState(false)
  const [projectSettingsForm, setProjectSettingsForm] = useState<{
    name: string
    city: string
    district: string
    mevki: string
    type: string
    deliveryDate: string
    status: 'SATISTA' | 'YAKINDA' | 'TAMAMLANDI'
    startingPrice: number | string
    description: string
    imageUrl: string
  }>({
    name: '',
    city: 'Sakarya',
    district: '',
    mevki: '',
    type: 'Konut & Rezidans',
    deliveryDate: '',
    status: 'SATISTA' as 'SATISTA' | 'YAKINDA' | 'TAMAMLANDI',
    startingPrice: 0,
    description: '',
    imageUrl: '',
  })

  useEffect(() => {
    const unsubProject = projectStore.subscribe(() => {
      const updated = projectStore.getAll()
      setProjects(updated)
      if (!selectedProjectId && updated.length > 0) {
        setSelectedProjectId(updated[0].id)
      }
    })
    const unsubUser = userStore.subscribe(() => {
      setCurrentUser(userStore.getCurrentUser())
    })
    return () => {
      unsubProject()
      unsubUser()
    }
  }, [selectedProjectId])

  const currentProject = projects.find((p) => p.id === selectedProjectId) || projects[0]
  const currentUnits = currentProject?.units || []

  // Stats
  const totalUnits = projects.reduce((acc, p) => acc + (p.units?.length || 0), 0)
  const totalSold = projects.reduce(
    (acc, p) => acc + (p.units?.filter((u) => u.status === 'SATILDI').length || 0),
    0
  )
  const totalReserved = projects.reduce(
    (acc, p) => acc + (p.units?.filter((u) => u.status === 'REZERVE').length || 0),
    0
  )
  const overallRate = totalUnits > 0 ? Math.round((totalSold / totalUnits) * 100) : 0

  const handleOpenReserve = (unit: FlatUnit) => {
    setSelectedUnit(unit)
    setCustomerName('')
    setReserveDays(5)
    setDepositAmount(150000)
    setReserveNote('')
    setActionError(null)
    setIsReserveModalOpen(true)
  }

  const handleExecuteReserve = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUnit || !currentProject || !currentUser) return
    if (!customerName.trim()) {
      setActionError('Lütfen müşteri adını girin.')
      return
    }

    const expiresAt = new Date(Date.now() + 86400000 * (Number(reserveDays) || 5)).toISOString()
    const res = projectStore.reserveUnit(currentProject.id, selectedUnit.id, currentUser, {
      customerName: customerName.trim(),
      expiresAt,
      depositAmount: Number(depositAmount) || undefined,
      note: reserveNote.trim(),
    })

    if (!res.success) {
      setActionError(res.error || 'Rezervasyon işlemi gerçekleştirilemedi.')
      return
    }

    setIsReserveModalOpen(false)
    setActionSuccess(`${selectedUnit.unitNumber} nolu daire başarıyla rezerve edildi.`)
    setTimeout(() => setActionSuccess(null), 4000)
  }

  const handleCancelReserve = (unit: FlatUnit) => {
    if (!currentProject || !currentUser) return
    if (!window.confirm(`${unit.unitNumber} dairesinin rezervasyonunu iptal etmek istediğinize emin misiniz?`)) return

    const res = projectStore.cancelReservation(currentProject.id, unit.id, currentUser, 'Danışman tarafından iptal edildi.')
    if (!res.success) {
      alert(res.error)
      return
    }
    setActionSuccess(`${unit.unitNumber} rezervasyonu iptal edildi ve daire yeniden satışa açıldı.`)
    setTimeout(() => setActionSuccess(null), 4000)
  }

  const handleOpenSell = (unit: FlatUnit) => {
    setSelectedUnit(unit)
    setCustomerName(unit.reservation?.customerName || '')
    setSalePrice(unit.price)
    setPaymentPlan('%50 Peşin + 24 Ay Taksit')
    setActionError(null)
    setIsSellModalOpen(true)
  }

  const handleExecuteSell = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUnit || !currentProject || !currentUser) return
    if (!customerName.trim()) {
      setActionError('Müşteri adı zorunludur.')
      return
    }

    const res = projectStore.sellUnit(currentProject.id, selectedUnit.id, currentUser, {
      customerName: customerName.trim(),
      salePrice: Number(salePrice) || selectedUnit.price,
      paymentPlan,
    })

    if (!res.success) {
      setActionError(res.error || 'Satış işlemi gerçekleştirilemedi.')
      return
    }

    setIsSellModalOpen(false)
    setActionSuccess(`${selectedUnit.unitNumber} dairesinin satışı tamamlandı. Muhasebe tahsilat kaydı oluşturuldu.`)
    setTimeout(() => setActionSuccess(null), 4000)
  }

  const handleOpenPrice = (unit: FlatUnit) => {
    setSelectedUnit(unit)
    setEditPrice(unit.price)
    setActionError(null)
    setIsPriceModalOpen(true)
  }

  const handleExecutePrice = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUnit || !currentProject || !currentUser) return

    const res = projectStore.updateUnitPrice(currentProject.id, selectedUnit.id, currentUser, Number(editPrice))
    if (!res.success) {
      setActionError(res.error || 'Fiyat güncellenemedi.')
      return
    }

    setIsPriceModalOpen(false)
    setActionSuccess(`${selectedUnit.unitNumber} daire fiyatı güncellendi.`)
    setTimeout(() => setActionSuccess(null), 3000)
  }

  const handleOpenHistory = (unit: FlatUnit) => {
    setSelectedUnit(unit)
    setIsHistoryModalOpen(true)
  }

  const handleOpenEditUnit = (unit: FlatUnit) => {
    setSelectedUnit(unit)
    setEditingUnit(unit)
    const initialStatusLabel =
      unit.status === 'SATISTA'
        ? 'Satışta'
        : unit.status === 'REZERVE'
        ? unit.statusLabel === 'Rezerve'
          ? 'Rezerve'
          : 'Kapora Alındı'
        : unit.statusLabel === 'KAPALI'
        ? 'KAPALI'
        : 'SATILDI'
    setEditUnitForm({
      price: unit.price || 0,
      facade: unit.facade || '',
      description: unit.description || '',
      roomType: unit.roomType || '2+1',
      block: unit.block || 'A Blok',
      floor: Math.max(0, Math.min(2, unit.floor ?? 0)),
      grossSqm: unit.grossSqm || 100,
      netSqm: unit.netSqm || 80,
      statusLabel: initialStatusLabel,
    })
    setActionError(null)
    setIsEditUnitModalOpen(true)
  }

  const handleExecuteSaveUnit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUnit || !currentProject) return

    const parsedFloor = Math.max(0, Math.min(2, Number(editUnitForm.floor) || 0))
    const nextStatus =
      editUnitForm.statusLabel === 'SATILDI' || editUnitForm.statusLabel === 'KAPALI'
        ? 'SATILDI'
        : editUnitForm.statusLabel === 'Kapora Alındı' || editUnitForm.statusLabel === 'Rezerve'
        ? 'REZERVE'
        : 'SATISTA'
    const res = projectStore.updateUnitDetails(
      currentProject.id,
      editingUnit.id,
      {
        price: Number(editUnitForm.price) || 0,
        facade: editUnitForm.facade.trim(),
        description: editUnitForm.description.trim(),
        roomType: editUnitForm.roomType,
        block: editUnitForm.block.trim(),
        floor: parsedFloor,
        grossSqm: Number(editUnitForm.grossSqm) || 0,
        netSqm: Number(editUnitForm.netSqm) || 0,
        status: nextStatus,
        statusLabel: editUnitForm.statusLabel,
      },
      currentUser
    )

    if (!res.success) {
      setActionError(res.error || 'Daire bilgileri güncellenemedi.')
      return
    }

    setProjects(projectStore.getAll())
    setIsEditUnitModalOpen(false)
    setActionSuccess(`${editingUnit.unitNumber} nolu daire bilgileri güncellendi.`)
    setTimeout(() => setActionSuccess(null), 3500)
  }

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProject.name.trim()) return

    const fullLocation = [
      newProject.district.trim(),
      newProject.city.trim(),
      newProject.mevki.trim() ? `(${newProject.mevki.trim()})` : '',
    ]
      .filter(Boolean)
      .join(' ')

    const computedTotalUnits =
      newProject.parsedUnits.length > 0
        ? newProject.parsedUnits.length
        : newProject.maxFloors * newProject.unitsPerFloor * newProject.blockCount

    const created = projectStore.addProject({
      name: newProject.name.trim(),
      code: `PRJ-${Math.floor(100 + Math.random() * 900)}`,
      location: fullLocation || newProject.city,
      city: newProject.city,
      district: newProject.district.trim(),
      mevki: newProject.mevki.trim(),
      type: newProject.type,
      totalUnits: computedTotalUnits,
      deliveryDate: newProject.deliveryDate,
      startingPrice: 0,
      imageUrl: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
      blueprintUrl: newProject.blueprintUrl || undefined,
      floorPlans: newProject.blueprintUrl ? { DEFAULT: newProject.blueprintUrl } : {},
      layoutTemplate: newProject.layoutTemplate || 'quad',
      maxFloors: newProject.maxFloors,
      unitsPerFloor: newProject.unitsPerFloor,
      blockCount: newProject.blockCount,
      defaultRoomType: newProject.defaultRoomType,
      sourceDocumentName: newProject.sourceDocumentName || undefined,
      sourceDocumentSummary: newProject.sourceDocumentSummary || undefined,
      customAreas: newProject.customAreas,
      customFacades: newProject.customFacades,
      paymentBanner: newProject.paymentBanner,
      parcelInfo: newProject.parcelInfo,
      parsedUnits: newProject.parsedUnits.length > 0 ? newProject.parsedUnits : undefined,
      status: 'SATISTA',
      description: newProject.description.trim(),
    })

    setSelectedProjectId(created.id)
    setViewMode('detail')
    setDetailDisplayMode('blueprint')
    setIsAddProjectOpen(false)
    setActionSuccess(`"${newProject.name.trim()}" projesi ve 3D etkileşimli kat krokisi oluşturuldu.`)
    setTimeout(() => setActionSuccess(null), 3000)
    setNewProject({
      name: '',
      city: 'Sakarya',
      district: '',
      mevki: '',
      type: 'Konut & Rezidans',
      totalUnits: 12,
      deliveryDate: 'Aralık 2027',
      description: '',
      layoutTemplate: 'quad',
      blueprintUrl: '',
      maxFloors: 3,
      unitsPerFloor: 4,
      blockCount: 1,
      defaultRoomType: 'MIXED',
      sourceDocumentName: '',
      sourceDocumentSummary: '',
      parsedUnits: [],
      customAreas: undefined,
      customFacades: undefined,
      paymentBanner: undefined,
      parcelInfo: undefined,
    })
  }

  const handleOpenProjectSettings = () => {
    if (!currentProject) return
    setProjectSettingsForm({
      name: currentProject.name || '',
      city: currentProject.city || 'Sakarya',
      district: currentProject.district || '',
      mevki: currentProject.mevki || '',
      type: currentProject.type || 'Konut & Rezidans',
      deliveryDate: currentProject.deliveryDate || '',
      status: currentProject.status || 'SATISTA',
      startingPrice: currentProject.startingPrice || 0,
      description: currentProject.description || '',
      imageUrl: currentProject.imageUrl || '',
    })
    setActionError(null)
    setIsProjectSettingsOpen(true)
  }

  const handleSaveProjectSettings = (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentProject) return
    if (!projectSettingsForm.name.trim()) {
      setActionError('Lütfen proje adını girin.')
      return
    }

    const fullLocation = [
      projectSettingsForm.district.trim(),
      projectSettingsForm.city.trim(),
      projectSettingsForm.mevki.trim() ? `(${projectSettingsForm.mevki.trim()})` : '',
    ]
      .filter(Boolean)
      .join(' ')

    const res = projectStore.updateProject(currentProject.id, {
      name: projectSettingsForm.name.trim(),
      city: projectSettingsForm.city,
      district: projectSettingsForm.district.trim(),
      mevki: projectSettingsForm.mevki.trim(),
      location: fullLocation || projectSettingsForm.city,
      type: projectSettingsForm.type,
      deliveryDate: projectSettingsForm.deliveryDate.trim(),
      status: projectSettingsForm.status,
      startingPrice: Number(projectSettingsForm.startingPrice) || 0,
      description: projectSettingsForm.description.trim(),
      imageUrl: projectSettingsForm.imageUrl.trim() || currentProject.imageUrl,
    })

    if (!res.success) {
      setActionError(res.error || 'Proje ayarları kaydedilemedi.')
      return
    }

    setProjects(projectStore.getAll())
    setIsProjectSettingsOpen(false)
    setActionSuccess(`"${projectSettingsForm.name.trim()}" projesinin ayarları kaydedildi.`)
    setTimeout(() => setActionSuccess(null), 3500)
  }

  const handleDeleteProject = () => {
    if (!currentProject) return
    const confirmed = window.confirm(
      `"${currentProject.name}" projesini ve kayıtlı ${currentProject.units?.length || 0} adet bağımsız bölümünü kalıcı olarak silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz!`
    )
    if (!confirmed) return

    const deletedName = currentProject.name
    const res = projectStore.deleteProject(currentProject.id)
    if (!res.success) {
      setActionError(res.error || 'Proje silinemedi.')
      return
    }

    const remaining = projectStore.getAll()
    setProjects(remaining)
    setIsProjectSettingsOpen(false)
    setViewMode('grid')
    if (remaining.length > 0) {
      setSelectedProjectId(remaining[0].id)
    } else {
      setSelectedProjectId('')
    }
    setActionSuccess(`"${deletedName}" projesi sistemden başarıyla silindi.`)
    setTimeout(() => setActionSuccess(null), 3500)
  }

  const handleExecuteCancelSale = () => {
    if (!editingUnit || !currentProject || !currentUser) return
    const confirmed = window.confirm(
      `${editingUnit.unitNumber} nolu dairenin satış kaydını iptal edip durumu 'Satışta' olarak güncellemek istediğinize emin misiniz?`
    )
    if (!confirmed) return

    const res = projectStore.cancelSale(currentProject.id, editingUnit.id, currentUser)
    if (!res.success) {
      setActionError(res.error || 'Satış işlemi geri alınamadı.')
      return
    }

    setProjects(projectStore.getAll())
    setIsEditUnitModalOpen(false)
    setActionSuccess(`${editingUnit.unitNumber} nolu dairenin satışı geri alındı ve durumu 'Satışta' yapıldı.`)
    setTimeout(() => setActionSuccess(null), 3500)
  }

  const canEditPrice = permissionService.canEditProjectPrice(currentUser)

  return (
    <div className="space-y-2 pb-1">
      {/* Title Header (Katmansız, Çizgisiz, İkonlu) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {viewMode === 'detail' && currentProject ? (
            <div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className="p-1 -ml-1 rounded-full text-[#b99881] hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-center"
                  title="Tüm Projelere Dön"
                >
                  <ChevronLeft className="w-6 h-6" strokeWidth={2.4} />
                </button>
                <h2 className="text-2xl font-bold text-white tracking-wide">
                  {currentProject.name}
                </h2>
                <span className="text-xs font-normal text-[#8c857f]">
                  ({currentProject.code})
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 text-xs text-[#a69f99] mt-0.5 pl-7">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#b99881]" />
                  {currentProject.district
                    ? `${currentProject.district}, ${currentProject.city}`
                    : currentProject.location}
                  {currentProject.mevki ? ` • ${currentProject.mevki}` : ''}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-[#b99881]" />
                  {currentProject.type}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[#b99881]" />
                  {currentProject.deliveryDate}
                </span>
                {currentProject.startingPrice && currentProject.startingPrice > 0 ? (
                  <>
                    <span>•</span>
                    <span>Başlangıç: {formatCurrency(currentProject.startingPrice)}</span>
                  </>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <Building2 className="w-5 h-5 text-[#b99881]" />
              <h2 className="text-2xl font-bold text-white tracking-wide">
                Projeler
              </h2>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {viewMode === 'detail' && currentProject && (
            <>
              <button
                type="button"
                onClick={() => setDetailDisplayMode('blueprint')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  detailDisplayMode === 'blueprint'
                    ? 'bg-[#b99881] text-white'
                    : 'bg-[#34302d] text-[#a69f99] hover:text-white'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Etkileşimli Kat Planı (Kroki)</span>
              </button>
              <button
                type="button"
                onClick={() => setDetailDisplayMode('cards')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  detailDisplayMode === 'cards'
                    ? 'bg-[#b99881] text-white'
                    : 'bg-[#34302d] text-[#a69f99] hover:text-white'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Liste</span>
              </button>

              {(currentUser?.role === 'ADMIN' || currentUser?.isManager) && (
                <button
                  type="button"
                  onClick={handleOpenProjectSettings}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold text-[#c4bcb5] hover:text-white bg-[#34302d] hover:bg-[#3d3733] transition-all cursor-pointer"
                  title="Proje Bilgileri ve Yönetim Ayarları"
                >
                  <Settings className="w-3.5 h-3.5 text-[#b99881]" />
                  <span>Proje Ayarları</span>
                </button>
              )}
            </>
          )}

          {viewMode === 'grid' && (currentUser?.role === 'ADMIN' || currentUser?.isManager) && (
            <GlassButton
              variant="gold"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setIsAddProjectOpen(true)}
              className="rounded-full px-4 text-xs font-semibold"
            >
              Yeni Proje Ekle
            </GlassButton>
          )}
        </div>
      </div>

      {/* Action Notification Alert */}
      {actionSuccess && (
        <div className="p-3 rounded-[16px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center justify-between animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-400 hover:text-white cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <AnimatePresence mode="wait">
        {viewMode === 'grid' ? (
          <motion.div
            key="grid-view"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-6"
          >
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
                <div className="text-xs text-[#a69f99]">Toplam Ünite</div>
                <div className="text-2xl font-bold text-white mt-1">{totalUnits}</div>
                <div className="text-[11px] text-[#8c857f] mt-1">{projects.length} Proje Envanteri</div>
              </GlassCard>

              <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
                <div className="text-xs text-[#38bdf8]">Satışta Olanlar</div>
                <div className="text-2xl font-bold text-white mt-1">{totalUnits - totalSold - totalReserved}</div>
                <div className="text-[11px] text-[#8c857f] mt-1">Hemen rezerve edilebilir</div>
              </GlassCard>

              <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
                <div className="text-xs text-emerald-400">Satılan Daireler</div>
                <div className="text-2xl font-bold text-emerald-400 mt-1">{totalSold}</div>
                <div className="text-[11px] text-[#8c857f] mt-1">%{overallRate} Satış Oranı</div>
              </GlassCard>

              <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
                <div className="text-xs text-amber-400">Rezerve Daireler</div>
                <div className="text-2xl font-bold text-amber-400 mt-1">{totalReserved}</div>
                <div className="text-[11px] text-[#8c857f] mt-1">Opsiyonlu bağımsız bölüm</div>
              </GlassCard>
            </div>

            {/* Projeler Grid Başlığı */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <h3 className="text-base font-bold text-white tracking-wide">
                  Aktif Projeler ({projects.length})
                </h3>
                <p className="text-xs text-[#a69f99] mt-0.5">
                  Daire envanterini, kat planlarını ve satış durumunu görüntülemek için projeye tıklayın.
                </p>
              </div>
            </div>

            {/* Büyük Proje Kartları */}
            {projects.length === 0 ? (
              <div className="py-20 text-center flex flex-col items-center justify-center">
                <Building2 className="w-10 h-10 text-[#8c857f] mx-auto mb-3 opacity-40" />
                <h3 className="text-sm font-semibold text-white">Kayıtlı proje bulunmuyor</h3>
                <p className="text-xs text-[#8c857f] mt-1.5 max-w-md mx-auto">
                  Sistemde henüz aktif bir proje ve daire portföyü tanımlanmamış. "Yeni Proje Ekle" butonu ile ilk projenizi ve bağımsız bölüm envanterinizi oluşturabilirsiniz.
                </p>
                <div className="mt-5">
                  <GlassButton
                    variant="gold"
                    size="sm"
                    icon={<Plus className="w-4 h-4" />}
                    onClick={() => setIsAddProjectOpen(true)}
                    className="rounded-full px-5 py-2 text-xs font-semibold"
                  >
                    İlk Projeyi Ekle
                  </GlassButton>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map((p) => {
                const units = p.units || []
                const total = units.length
                const sold = units.filter((u) => u.status === 'SATILDI').length
                const reserved = units.filter((u) => u.status === 'REZERVE').length
                const available = total - sold - reserved
                const soldPct = total > 0 ? (sold / total) * 100 : 0
                const resPct = total > 0 ? (reserved / total) * 100 : 0
                const availPct = total > 0 ? (available / total) * 100 : 0
                const isResidential = Boolean(
                  p.type &&
                    (p.type.toLowerCase().includes('konut') ||
                      p.type.toLowerCase().includes('rezidans') ||
                      p.type.toLowerCase().includes('residence'))
                )

                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      setSelectedProjectId(p.id)
                      setViewMode('detail')
                    }}
                    className="group relative rounded-[24px] bg-[#282522] border border-[#4a443f] hover:border-[#b99881] transition-all duration-300 p-6 flex flex-col justify-between cursor-pointer hover:shadow-2xl hover:shadow-black/50 hover:-translate-y-0.5"
                  >
                    <div>
                      {/* Top Row: İsim, Kod ve Durum */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            {isResidential && (
                              <Home className="w-4 h-4 text-[#b99881] shrink-0" />
                            )}
                            <h3 className="text-lg font-bold text-white group-hover:text-[#b99881] transition-colors leading-tight">
                              {p.name}
                            </h3>
                          </div>
                          <div className="text-xs text-[#8c857f] mt-0.5 font-mono">
                            {p.code}
                          </div>
                        </div>
                        <GlassBadge
                          size="sm"
                          variant={p.status === 'SATISTA' ? 'primary' : 'warning'}
                        >
                          {p.status === 'SATISTA' ? 'Satışta' : p.status}
                        </GlassBadge>
                      </div>

                      {/* Lokasyon & Meta */}
                      <div className="space-y-1.5 text-xs text-[#a69f99] mb-4">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#b99881] shrink-0" />
                          <span className="text-[#c4bcb5]">
                            {p.district ? `${p.district}, ${p.city}` : p.location}
                            {p.mevki ? ` • ${p.mevki}` : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-[#b99881] shrink-0" />
                          <span>{p.type}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-[#b99881] shrink-0" />
                          <span>Teslim: {p.deliveryDate}</span>
                        </div>
                      </div>

                      {/* Proje Açıklaması */}
                      {p.description && (
                        <p className="text-xs text-[#c4bcb5] line-clamp-2 mb-4 italic">
                          "{p.description}"
                        </p>
                      )}
                    </div>

                    {/* Alt Kısım: İlerleme Çubuğu & Daireleri İncele */}
                    <div className="pt-2 space-y-3">
                      <div>
                        <div className="flex justify-between items-center text-[11px] mb-1.5">
                          <span className="text-[#8c857f]">Envanter Durumu</span>
                          <span className="font-semibold text-white">{total} Bağımsız Bölüm</span>
                        </div>
                        {/* Çok Katmanlı İlerleme Çubuğu */}
                        <div className="h-2 w-full bg-[#1e1b19] rounded-full overflow-hidden flex">
                          <div
                            style={{ width: `${availPct}%` }}
                            className="bg-emerald-500 h-full transition-all"
                            title={`Satışta: ${available}`}
                          />
                          <div
                            style={{ width: `${resPct}%` }}
                            className="bg-[#1e3a8a] h-full transition-all"
                            title={`Kapora / Rezerve: ${reserved}`}
                          />
                          <div
                            style={{ width: `${soldPct}%` }}
                            className="bg-red-600 h-full transition-all"
                            title={`Satılan: ${sold}`}
                          />
                        </div>

                        {/* Mikro Durumlar */}
                        <div className="flex items-center justify-between text-[11px] text-[#8c857f] mt-2">
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span>Satışta: <strong className="text-emerald-500">{available}</strong></span>
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-[#1e3a8a]" />
                            <span>Kapora: <strong className="text-blue-700">{reserved}</strong></span>
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-red-600" />
                            <span>Satıldı: <strong className="text-red-600">{sold}</strong></span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs text-[#b99881] group-hover:underline font-semibold flex items-center gap-1">
                          Daireleri İncele
                          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                        </span>
                        <span className="text-[11px] text-[#8c857f]">
                          %{soldPct > 0 ? Math.round(soldPct) : 0} Satış
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="detail-view"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-3"
          >
            {/* Seçili Proje Detay & Daire Matrisi */}
            {currentProject && (
              <div className="space-y-3">
                {detailDisplayMode === 'blueprint' ? (
                  <ProjectFloorPlanView
                    project={currentProject}
                    canEditPrice={canEditPrice}
                    isManagerOrAdmin={Boolean(currentUser?.role === 'ADMIN' || currentUser?.isManager)}
                    onReserveUnit={handleOpenReserve}
                    onSellUnit={handleOpenSell}
                    onCancelReserve={handleCancelReserve}
                    onEditPrice={handleOpenPrice}
                    onEditUnit={handleOpenEditUnit}
                    onOpenHistory={handleOpenHistory}
                    onProjectUpdated={() => setProjects(projectStore.getAll())}
                  />
                ) : (
                <div className="space-y-3">
                  {/* Sağ kenarda sekmelerin hemen altında Liste ve Kart görünüm seçenekleri */}
                  <div className="flex items-center justify-end">
                    <div className="inline-flex items-center gap-1 p-1 rounded-full bg-[#282522] border border-[#4a443f]">
                      <button
                        type="button"
                        onClick={() => setListSubViewMode('list')}
                        className={`no-layer-btn inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer bg-transparent border-none shadow-none ${
                          listSubViewMode === 'list'
                            ? 'text-[#d6beae]'
                            : 'text-[#a69f99] hover:text-white'
                        }`}
                      >
                        <List className="w-3.5 h-3.5 text-[#b99881]" />
                        <span>Liste</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setListSubViewMode('card')}
                        className={`no-layer-btn inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer bg-transparent border-none shadow-none ${
                          listSubViewMode === 'card'
                            ? 'text-[#d6beae]'
                            : 'text-[#a69f99] hover:text-white'
                        }`}
                      >
                        <LayoutGrid className="w-3.5 h-3.5 text-[#b99881]" />
                        <span>Kart</span>
                      </button>
                    </div>
                  </div>

                  {listSubViewMode === 'list' ? (
                    /* LİSTE GÖRÜNÜMÜ: Solda daireler listeli, sağda bilgiler katmansız şekilde */
                    (() => {
                      const activeListUnit =
                        currentUnits.find((u) => u.id === activeListUnitId) || null

                      return (
                        <div className="grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)] xl:grid-cols-[420px_minmax(0,1fr)] gap-6 items-start">
                          {/* SOL: Daireler Listesi */}
                          <div className="rounded-[22px] bg-[#282522] border border-[#4a443f] p-2.5 max-h-[640px] overflow-y-auto space-y-1.5">
                            {currentUnits.map((unit) => {
                              const isSelected = activeListUnit?.id === unit.id
                              const isReserved =
                                unit.status === 'REZERVE' ||
                                Boolean(unit.reservation?.depositAmount) ||
                                /kapora|peşinat|pesinat|rezerve|opsiyon/i.test(unit.statusLabel || '')
                              const isAvailable = unit.status === 'SATISTA' && !isReserved
                              const floorText =
                                FLOOR_LABELS[Math.max(0, Math.min(2, unit.floor))]?.short ||
                                `${unit.floor}. Kat`

                              const rowStatusClass = isAvailable
                                ? 'unit-card-available'
                                : isReserved
                                ? 'unit-card-deposit'
                                : 'unit-card-sold'

                              return (
                                <button
                                  key={unit.id}
                                  type="button"
                                  onClick={() => setActiveListUnitId(unit.id)}
                                  className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl text-left transition-all cursor-pointer ${rowStatusClass} ${
                                    isSelected ? 'ring-2 ring-[#5c6ac4] shadow-md' : ''
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold truncate">
                                        {unit.unitNumber}
                                      </span>
                                      <span className="unit-pill-light text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                        {unit.roomType}
                                      </span>
                                    </div>
                                    <div className="text-[11px] mt-0.5 truncate opacity-90">
                                      {unit.block || 'A Blok'} • {floorText} • {unit.grossSqm} m²
                                    </div>
                                  </div>

                                  <div className="flex flex-col items-end gap-1 shrink-0">
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold uppercase tracking-wider ${
                                        isAvailable
                                          ? 'unit-badge-available'
                                          : isReserved
                                          ? 'unit-badge-deposit'
                                          : 'unit-badge-sold'
                                      }`}
                                    >
                                      {isAvailable
                                        ? 'Satışta'
                                        : isReserved
                                        ? unit.statusLabel && !/^satışta$/i.test(unit.statusLabel)
                                          ? unit.statusLabel
                                          : 'Kapora / Rezerve'
                                        : unit.statusLabel || 'Satıldı'}
                                    </span>
                                    <span className="unit-pill-light px-2 py-0.5 rounded-full text-xs font-bold font-mono">
                                      {unit.price > 0 ? formatCurrency(unit.price) : 'Belirlenmedi'}
                                    </span>
                                  </div>
                                </button>
                              )
                            })}
                          </div>

                          {/* SAĞ: Seçili Daire Bilgileri (Katmansız) */}
                          <div className="min-h-[420px] flex flex-col justify-center px-2 py-1">
                            {activeListUnit ? (
                              (() => {
                                const isAvailable = activeListUnit.status === 'SATISTA'
                                const isReserved = activeListUnit.status === 'REZERVE'
                                const isSold = activeListUnit.status === 'SATILDI'
                                const floorLabel =
                                  FLOOR_LABELS[Math.max(0, Math.min(2, activeListUnit.floor))]
                                    ?.short || `${activeListUnit.floor}. Kat`

                                return (
                                  <div className="space-y-5 max-w-2xl">
                                    {/* Başlık */}
                                    <div className="flex items-start justify-between gap-4 pb-3 border-b border-[#4a443f]/50">
                                      <div>
                                        <div className="flex items-center gap-2.5">
                                          <h3 className="text-xl font-bold text-white">
                                            {activeListUnit.unitNumber}
                                          </h3>
                                          <GlassBadge
                                            size="sm"
                                            variant={
                                              isAvailable
                                                ? 'primary'
                                                : isReserved
                                                ? 'warning'
                                                : 'danger'
                                            }
                                          >
                                            {isAvailable
                                              ? 'Satışta'
                                              : isReserved
                                              ? 'Rezerve'
                                              : activeListUnit.statusLabel || 'Satıldı'}
                                          </GlassBadge>
                                        </div>
                                        <p className="text-xs text-[#a69f99] mt-1">
                                          {currentProject.name} • {activeListUnit.block || 'A Blok'}{' '}
                                          {activeListUnit.entrance
                                            ? `• ${activeListUnit.entrance}`
                                            : ''}{' '}
                                          • {floorLabel}
                                        </p>
                                      </div>

                                      <div className="text-right">
                                        <div className="text-[11px] text-[#a69f99]">
                                          Liste Fiyatı
                                        </div>
                                        <div className="flex items-center justify-end gap-1.5 mt-0.5">
                                          <span className="text-lg font-bold font-mono text-white">
                                            {activeListUnit.price > 0
                                              ? formatCurrency(activeListUnit.price)
                                              : 'Belirlenmedi'}
                                          </span>
                                          {canEditPrice && isAvailable && (
                                            <button
                                              type="button"
                                              onClick={() => handleOpenPrice(activeListUnit)}
                                              className="text-[#b99881] hover:text-white p-1 rounded-full cursor-pointer"
                                              title="Fiyatı Güncelle"
                                            >
                                              <TurkishLira className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Katmansız Satır Bilgileri */}
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-6 text-xs">
                                      <div>
                                        <div className="text-[#8c857f] mb-0.5">Bulunduğu Kat</div>
                                        <div className="font-semibold text-white">{floorLabel}</div>
                                      </div>
                                      <div>
                                        <div className="text-[#8c857f] mb-0.5">Blok</div>
                                        <div className="font-semibold text-white">
                                          {activeListUnit.block || 'A Blok'}
                                        </div>
                                      </div>
                                      <div>
                                        <div className="text-[#8c857f] mb-0.5">Giriş</div>
                                        <div className="font-semibold text-white">
                                          {activeListUnit.entrance || 'A Giriş'}
                                        </div>
                                      </div>
                                      <div>
                                        <div className="text-[#8c857f] mb-0.5">Oda Tipi</div>
                                        <div className="font-semibold text-white">
                                          {activeListUnit.roomType}
                                        </div>
                                      </div>
                                      <div>
                                        <div className="text-[#8c857f] mb-0.5">Brüt / Net Alan</div>
                                        <div className="font-semibold text-white">
                                          {activeListUnit.grossSqm} m² Brüt / {activeListUnit.netSqm}{' '}
                                          m² Net
                                        </div>
                                      </div>
                                      <div>
                                        <div className="text-[#8c857f] mb-0.5">Cephe</div>
                                        <div className="font-semibold text-white">
                                          {activeListUnit.facade || 'Belirtilmedi'}
                                        </div>
                                      </div>
                                    </div>

                                    {activeListUnit.description && (
                                      <div className="text-xs text-[#c4bcb5] pt-2 border-t border-[#4a443f]/30">
                                        {activeListUnit.description}
                                      </div>
                                    )}

                                    {isReserved && activeListUnit.reservation && (
                                      <div className="pt-2 border-t border-[#4a443f]/30 text-xs space-y-1 text-amber-300">
                                        <div className="font-semibold flex items-center gap-1.5">
                                          <User className="w-3.5 h-3.5" />
                                          <span>
                                            Rezerve Müşteri: {activeListUnit.reservation.customerName}
                                          </span>
                                        </div>
                                        <div className="text-[#a69f99]">
                                          Vade:{' '}
                                          {new Date(
                                            activeListUnit.reservation.expiresAt
                                          ).toLocaleDateString('tr-TR')}{' '}
                                          • Danışman: {activeListUnit.reservation.reservedByUserName}
                                        </div>
                                      </div>
                                    )}

                                    {isSold && activeListUnit.sale && (
                                      <div className="pt-2 border-t border-[#4a443f]/30 text-xs space-y-1 text-rose-300">
                                        <div className="font-semibold flex items-center gap-1.5">
                                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                          <span>Alıcı: {activeListUnit.sale.customerName}</span>
                                        </div>
                                        <div className="text-[#a69f99]">
                                          Sözleşme: {activeListUnit.sale.contractNo} • Satış:{' '}
                                          {formatCurrency(activeListUnit.sale.salePrice)}
                                        </div>
                                      </div>
                                    )}

                                    {/* Eylem Butonları */}
                                    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#4a443f]/40">
                                      {isAvailable && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => handleOpenReserve(activeListUnit)}
                                            className="py-2 px-4 text-xs font-semibold rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 transition-colors cursor-pointer"
                                          >
                                            Rezerve Et
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleOpenSell(activeListUnit)}
                                            className="py-2 px-4 text-xs font-semibold rounded-full bg-[#b99881] text-white transition-colors cursor-pointer"
                                          >
                                            Satış Yap
                                          </button>
                                        </>
                                      )}

                                      {isReserved && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => handleOpenSell(activeListUnit)}
                                            className="py-2 px-4 text-xs font-semibold rounded-full bg-[#b99881] text-white transition-colors cursor-pointer"
                                          >
                                            Satışa Çevir
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleCancelReserve(activeListUnit)}
                                            className="py-2 px-4 text-xs font-medium rounded-full bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 transition-colors cursor-pointer"
                                          >
                                            Rezervasyonu İptal Et
                                          </button>
                                        </>
                                      )}

                                      <button
                                        type="button"
                                        onClick={() => handleOpenEditUnit(activeListUnit)}
                                        className="py-2 px-4 text-xs font-semibold rounded-full bg-[#34302d] hover:bg-[#3d3733] text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                                      >
                                        <Edit2 className="w-3.5 h-3.5 text-[#b99881]" />
                                        <span>Daireyi Düzenle</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleOpenHistory(activeListUnit)}
                                        className="p-2 rounded-full bg-[#34302d] hover:bg-[#3d3733] text-[#a69f99] hover:text-white transition-colors cursor-pointer"
                                        title="Durum Değişiklik Geçmişi"
                                      >
                                        <History className="w-4 h-4 text-[#b99881]" />
                                      </button>
                                    </div>
                                  </div>
                                )
                              })()
                            ) : (
                              <div className="flex flex-col items-center justify-center text-center py-16 text-[#8c857f]">
                                <Home className="w-8 h-8 text-[#b99881]/50 mb-2" />
                                <p className="text-sm font-medium text-[#a69f99]">
                                  Görüntülemek için bir daire seçin
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })()
                  ) : (
                    /* KART GÖRÜNÜMÜ: Daireler Grid Matrisi */
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {currentUnits.map((unit) => {
                        const isReserved =
                          unit.status === 'REZERVE' ||
                          Boolean(unit.reservation?.depositAmount) ||
                          /kapora|peşinat|pesinat|rezerve|opsiyon/i.test(unit.statusLabel || '')
                        const isAvailable = unit.status === 'SATISTA' && !isReserved
                        const isSold = !isAvailable && !isReserved

                        return (
                          <div
                            key={unit.id}
                            className={`p-4 rounded-[22px] border transition-all duration-200 ${
                              isAvailable
                                ? 'unit-card-available'
                                : isReserved
                                ? 'unit-card-deposit'
                                : 'unit-card-sold'
                            }`}
                          >
                            {/* Üst Kısım: Daire No, Kat, Durum Rozeti ve Düzenle Butonu */}
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-bold">{unit.unitNumber}</span>
                                <span className="unit-pill-light text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                  {unit.block || 'A Blok'} • {FLOOR_LABELS[Math.max(0, Math.min(2, unit.floor))]?.short || `${unit.floor}. Kat`}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                    isAvailable
                                      ? 'unit-badge-available'
                                      : isReserved
                                      ? 'unit-badge-deposit'
                                      : 'unit-badge-sold'
                                  }`}
                                >
                                  {isAvailable
                                    ? 'Satışta'
                                    : isReserved
                                    ? unit.statusLabel && !/^satışta$/i.test(unit.statusLabel)
                                      ? unit.statusLabel
                                      : 'Kapora / Rezerve'
                                    : unit.statusLabel || 'Satıldı'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditUnit(unit)}
                                  className="p-1.5 rounded-full bg-[#34302d] hover:bg-[#b99881] text-[#a69f99] hover:text-[#282522] transition-all cursor-pointer"
                                  title="Daire Bilgilerini Düzenle (Fiyat, Cephe, Açıklama vb.)"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="space-y-1 text-xs text-[#a69f99] my-3">
                              <div className="flex justify-between">
                                <span>Tip / m²:</span>
                                <span className="text-white font-medium">
                                  {unit.roomType} ({unit.grossSqm} m²{unit.netSqm ? ` / ${unit.netSqm} m² net` : ''})
                                </span>
                              </div>

                              {unit.facade && (
                                <div className="flex justify-between items-center text-xs">
                                  <span>Cephe:</span>
                                  <span className="text-[#f3efe9] font-medium">{unit.facade}</span>
                                </div>
                              )}

                              <div className="flex justify-between items-center">
                                <span>Liste Fiyatı:</span>
                                <div className="flex items-center gap-1">
                                  <span className={`font-bold ${unit.price > 0 ? 'text-white text-sm' : 'text-[#8c857f] text-xs'}`}>
                                    {unit.price > 0 ? formatCurrency(unit.price) : 'Belirlenmedi'}
                                  </span>
                                  {canEditPrice && isAvailable && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenPrice(unit)}
                                      className="text-[#b99881] hover:text-white p-1 rounded-full cursor-pointer"
                                      title="Fiyatı Belirle / Düzenle"
                                    >
                                      <TurkishLira className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {unit.description && (
                                <p className="mt-1.5 text-[11px] text-[#c4bcb5] italic line-clamp-2">
                                  "{unit.description}"
                                </p>
                              )}

                              {/* Rezervasyon Ayrıntısı (Varsa) */}
                              {isReserved && unit.reservation && (
                                <div className="mt-2 pt-1 text-[11px] text-amber-300/90 space-y-0.5">
                                  <div className="flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    <span>{unit.reservation.customerName}</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-[10px] text-amber-400/70">
                                    <Clock className="w-3 h-3" />
                                    <span>Vade: {new Date(unit.reservation.expiresAt).toLocaleDateString('tr-TR')}</span>
                                  </div>
                                  <div className="text-[10px] text-[#8c857f]">
                                    Danışman: {unit.reservation.reservedByUserName}
                                  </div>
                                </div>
                              )}

                              {/* Satış Ayrıntısı (Varsa) */}
                              {isSold && unit.sale && (
                                <div className="mt-2 pt-1 text-[11px] text-rose-300/90 space-y-0.5">
                                  <div className="flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                    <span>Müşteri: {unit.sale.customerName}</span>
                                  </div>
                                  <div className="text-[10px] text-[#8c857f]">
                                    Sözleşme: {unit.sale.contractNo}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Eylemler */}
                            <div className="flex items-center gap-1.5 pt-2">
                              {isAvailable && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenReserve(unit)}
                                    className="flex-1 py-1.5 px-3 text-xs font-semibold rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 transition-colors cursor-pointer"
                                  >
                                    Rezerve Et
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenSell(unit)}
                                    className="flex-1 py-1.5 px-3 text-xs font-semibold rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 transition-colors cursor-pointer"
                                  >
                                    Satış Yap
                                  </button>
                                </>
                              )}

                              {isReserved && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenSell(unit)}
                                    className="flex-1 py-1.5 px-3 text-xs font-semibold rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 transition-colors cursor-pointer"
                                  >
                                    Satışa Çevir
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleCancelReserve(unit)}
                                    className="py-1.5 px-3 text-xs font-medium rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
                                    title="Rezervasyonu İptal Et"
                                  >
                                    İptal
                                  </button>
                                </>
                              )}

                              {isSold && (currentUser?.role === 'ADMIN' || currentUser?.isManager) && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditUnit(unit)}
                                  className="flex-1 py-1.5 px-3 text-xs font-semibold rounded-full bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                                  title="Satışı Geri Al veya Daireyi Düzenle"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Satışı Düzenle</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleOpenHistory(unit)}
                                className="p-2 text-xs rounded-full bg-[#34302d] hover:bg-[#3d3733] text-[#a69f99] hover:text-white transition-colors cursor-pointer"
                                title="Durum Değişiklik Geçmişi (Audit Log)"
                              >
                                <History className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* REZERVE ET MODAL */}
      <GlassModal
        isOpen={isReserveModalOpen}
        onClose={() => setIsReserveModalOpen(false)}
        title={`Daire Rezervasyonu - ${selectedUnit?.unitNumber}`}
      >
        <form onSubmit={handleExecuteReserve} className="space-y-4">
          <div className="p-3 rounded-[14px] bg-[#34302d] border border-[#4a443f] text-xs text-[#a69f99]">
            <div className="flex justify-between text-white font-semibold">
              <span>{currentProject?.name}</span>
              <span>{formatCurrency(selectedUnit?.price || 0)}</span>
            </div>
            <div className="mt-1">
              Tip: {selectedUnit?.roomType} • {selectedUnit?.grossSqm} m² • {FLOOR_LABELS[Math.max(0, Math.min(2, selectedUnit?.floor ?? 0))]?.short || 'Zemin Kat'}
            </div>
          </div>

          {actionError && (
            <div className="p-3 rounded-[12px] bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
              Müşteri Adı Soyadı *
            </label>
            <input
              type="text"
              required
              placeholder="Örn: Ahmet Ulucak"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white placeholder-[#8c857f] focus:outline-none focus:border-[#b99881]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Opsiyon Süresi (Gün)
              </label>
              <select
                value={reserveDays}
                onChange={(e) => setReserveDays(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              >
                <option value={3}>3 Gün</option>
                <option value={5}>5 Gün (Standart)</option>
                <option value={7}>7 Gün</option>
                <option value={10}>10 Gün (Yönetici Onaylı)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Alınan Kapora (TL)
              </label>
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
              Rezervasyon Notu
            </label>
            <textarea
              rows={2}
              placeholder="Ödeme şartları, özel talepler vb."
              value={reserveNote}
              onChange={(e) => setReserveNote(e.target.value)}
              className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white placeholder-[#8c857f] focus:outline-none focus:border-[#b99881]"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsReserveModalOpen(false)}
              className="px-4 py-2 rounded-full text-xs text-[#a69f99] hover:text-white cursor-pointer"
            >
              Vazgeç
            </button>
            <GlassButton type="submit" variant="gold" size="sm" className="rounded-full px-5 font-bold">
              Rezervasyonu Onayla
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      {/* SATIŞ YAP MODAL */}
      <GlassModal
        isOpen={isSellModalOpen}
        onClose={() => setIsSellModalOpen(false)}
        title={`Satış Sözleşmesi Tamamlama - ${selectedUnit?.unitNumber}`}
      >
        <form onSubmit={handleExecuteSell} className="space-y-4">
          <div className="p-3 rounded-[14px] bg-[#34302d] border border-[#4a443f] text-xs text-[#a69f99]">
            <div className="flex justify-between text-white font-semibold">
              <span>{currentProject?.name} ({selectedUnit?.unitNumber})</span>
              <span>Liste: {formatCurrency(selectedUnit?.price || 0)}</span>
            </div>
          </div>

          {actionError && (
            <div className="p-3 rounded-[12px] bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
              Alıcı Müşteri Adı Soyadı *
            </label>
            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Sözleşme Satış Fiyatı (TL) *
              </label>
              <input
                type="number"
                required
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Ödeme Planı
              </label>
              <input
                type="text"
                value={paymentPlan}
                onChange={(e) => setPaymentPlan(e.target.value)}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>
          </div>

          <div className="p-3 rounded-[12px] bg-[#b99881]/10 border border-[#b99881]/20 text-[11px] text-[#d6beae]">
            ℹ️ Satış tamamlandığında bu daire kalıcı olarak 'SATILDI' işaretlenir ve Muhasebe modülüne otomatik tahsilat takibi iletilir.
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsSellModalOpen(false)}
              className="px-4 py-2 rounded-full text-xs text-[#a69f99] hover:text-white cursor-pointer"
            >
              Vazgeç
            </button>
            <GlassButton type="submit" variant="gold" size="sm" className="rounded-full px-5 font-bold">
              Satışı Onayla
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      {/* DURUM GEÇMİŞİ (AUDIT LOG) MODALI */}
      <GlassModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title={`Durum Değişiklik Geçmişi - ${selectedUnit?.unitNumber}`}
      >
        <div className="space-y-3">
          <div className="text-xs text-[#8c857f] pb-2 border-b border-[#4a443f]">
            Bu daire üzerinde yapılan tüm rezervasyon, satış ve fiyat değişikliklerinin denetim günlüğü:
          </div>

          {selectedUnit?.history && selectedUnit.history.length > 0 ? (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {selectedUnit.history.map((log) => (
                <div key={log.id} className="p-3 rounded-[14px] bg-[#34302d] border border-[#4a443f] space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">{log.reason}</span>
                    <span className="text-[10px] text-[#8c857f]">{new Date(log.changedAt).toLocaleString('tr-TR')}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[#a69f99]">
                    <span>İşlemi Yapan: {log.changedByUserName}</span>
                    <span className="font-medium text-[#b99881]">{log.fromStatus} ➔ {log.toStatus}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-xs text-[#8c857f]">
              Henüz geçmiş işlem kaydı bulunmuyor.
            </div>
          )}
        </div>
      </GlassModal>

      {/* FİYAT GÜNCELLEME MODALI */}
      <GlassModal
        isOpen={isPriceModalOpen}
        onClose={() => setIsPriceModalOpen(false)}
        title={`Daire Fiyat Güncelleme - ${selectedUnit?.unitNumber}`}
      >
        <form onSubmit={handleExecutePrice} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
              Yeni Liste Fiyatı (TL) *
            </label>
            <input
              type="number"
              required
              value={editPrice}
              onChange={(e) => setEditPrice(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsPriceModalOpen(false)}
              className="px-4 py-2 rounded-full text-xs text-[#a69f99] hover:text-white cursor-pointer"
            >
              Vazgeç
            </button>
            <GlassButton type="submit" variant="gold" size="sm" className="rounded-full px-5 font-bold">
              Fiyatı Kaydet
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      {/* YENİ PROJE EKLE MODALI */}
      <GlassModal
        isOpen={isAddProjectOpen}
        onClose={() => setIsAddProjectOpen(false)}
        title="Yeni Gayrimenkul Projesi Ekle"
      >
        <form onSubmit={handleCreateProject} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
              Proje Adı *
            </label>
            <input
              type="text"
              required
              placeholder="Örn: Demirtürk Sahil Konakları"
              value={newProject.name}
              onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
              className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                İlçe *
              </label>
              <input
                type="text"
                required
                placeholder="Örn: Karasu, Bodrum, Kadıköy"
                value={newProject.district}
                onChange={(e) => setNewProject({ ...newProject, district: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881] transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Şehir *
              </label>
              <select
                value={newProject.city}
                onChange={(e) => setNewProject({ ...newProject, city: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881] transition-colors cursor-pointer"
              >
                <option value="Sakarya">Sakarya</option>
                <option value="İstanbul">İstanbul</option>
                <option value="İzmir">İzmir</option>
                <option value="Antalya">Antalya</option>
                <option value="Muğla">Muğla</option>
                <option value="Aydın">Aydın</option>
                <option value="Bursa">Bursa</option>
                <option value="Ankara">Ankara</option>
                <option value="Yalova">Yalova</option>
                <option value="Kocaeli">Kocaeli</option>
                <option value="Balıkesir">Balıkesir</option>
                <option value="Çanakkale">Çanakkale</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
              Mevki *
            </label>
            <input
              type="text"
              required
              placeholder="Örn: Sahil Bandı, Marina Yanı, Yalıboyu, Merkez"
              value={newProject.mevki}
              onChange={(e) => setNewProject({ ...newProject, mevki: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881] transition-colors"
            />
            <p className="text-[11px] text-[#8c857f] mt-1">
              Projenin bulunduğu sahil şeridi, cadde veya yerel mevki adı
            </p>
          </div>

          {/* EVRENSEL BELGE OKUYUCU: Word, PDF, PPTX, Excel, Görsel Yükle -> Otomatik Kroki Ayarla */}
          <div className="p-3.5 rounded-[18px] bg-[#24211f] border border-[#4a443f] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-bold text-[#f3efe9] flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-[#b99881]" />
                <span>Plan Yükle</span>
              </label>
              {isParsingNewProjectDoc && (
                <span className="text-[11px] font-semibold text-[#b99881]">Okunuyor...</span>
              )}
            </div>

            <input
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                setIsParsingNewProjectDoc(true)
                try {
                  const parsed = await parseProjectDocumentFile(file)
                  setNewProject((prev) => ({
                    ...prev,
                    name: prev.name.trim() ? prev.name : parsed.detectedProjectName || prev.name,
                    mevki: prev.mevki.trim() ? prev.mevki : parsed.parcelInfo || prev.mevki,
                    deliveryDate: parsed.detectedDeliveryDate || prev.deliveryDate,
                    maxFloors: parsed.floorCount,
                    unitsPerFloor: parsed.unitsPerFloor,
                    blockCount: parsed.blockCount,
                    defaultRoomType: parsed.defaultRoomType,
                    layoutTemplate: parsed.layoutTemplate,
                    totalUnits: parsed.totalUnits,
                    blueprintUrl: parsed.clearBlueprint ? '' : parsed.extractedBlueprintDataUrl || prev.blueprintUrl,
                    sourceDocumentName: parsed.fileName,
                    sourceDocumentSummary: parsed.summary,
                    parsedUnits: parsed.parsedUnits,
                    customAreas: parsed.customAreas,
                    customFacades: parsed.customFacades,
                    paymentBanner: parsed.paymentBanner,
                    parcelInfo: parsed.parcelInfo,
                  }))
                } catch (err) {
                  console.error('Proje belgesi okunamadı:', err)
                } finally {
                  setIsParsingNewProjectDoc(false)
                }
              }}
              className="w-full px-3 py-2 rounded-[14px] bg-[#1e1c1a] border border-[#4a443f] text-xs text-white file:mr-3 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-[#b99881] file:text-white cursor-pointer"
            />

            {newProject.sourceDocumentSummary && (
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-[11px] font-medium flex items-start gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#b99881] shrink-0 mt-0.5" />
                <span>{newProject.sourceDocumentSummary}</span>
              </div>
            )}
          </div>

          {/* OTOMATİK & MANUEL KROKİ AYARLARI: Kat Sayısı (Maks 3: Zemin, 1. Kat, 2. Kat), Kat Başına Daire, Blok, Oda Tipi */}
          <div className="p-3.5 rounded-[18px] bg-[#24211f] border border-[#4a443f] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">
                3D Kroki Kat & Daire Ayarları (Otomatik / Manuel)
              </span>
              <span className="text-[11px] font-mono font-bold text-[#b99881]">
                Toplam:{' '}
                {newProject.parsedUnits.length > 0
                  ? newProject.parsedUnits.length
                  : newProject.maxFloors * newProject.unitsPerFloor * newProject.blockCount}{' '}
                Ünite
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Kat Sayısı (Maks 3: Zemin, Birinci, İkinci) */}
              <div>
                <label className="block text-[11px] font-semibold text-[#f3efe9] mb-1">
                  Kat Sayısı
                </label>
                <select
                  value={newProject.maxFloors}
                  onChange={(e) => {
                    const mf = Number(e.target.value) as 1 | 2 | 3
                    setNewProject({
                      ...newProject,
                      maxFloors: mf,
                      parsedUnits: [],
                      totalUnits: mf * newProject.unitsPerFloor * newProject.blockCount,
                    })
                  }}
                  className="w-full px-3 py-2 rounded-[14px] bg-[#1e1c1a] border border-[#4a443f] text-xs text-white focus:outline-none cursor-pointer"
                >
                  <option value={1}>1 Kat (Sadece Zemin Kat)</option>
                  <option value={2}>2 Kat (Zemin + 1. Kat)</option>
                  <option value={3}>3 Kat (Zemin + 1. Kat + 2. Kat)</option>
                </select>
              </div>

              {/* Kat Başına Hazır Daire Sayısı (4, 5, 6, 12 — manuel de eklenebilir) */}
              <div>
                <label className="block text-[11px] font-semibold text-[#f3efe9] mb-1">
                  Kat Başına Hazır Daire Sayısı
                </label>
                <select
                  value={newProject.unitsPerFloor}
                  onChange={(e) => {
                    const upf = Number(e.target.value)
                    setNewProject({
                      ...newProject,
                      unitsPerFloor: upf,
                      parsedUnits: [],
                      totalUnits: newProject.maxFloors * upf * newProject.blockCount,
                    })
                  }}
                  className="w-full px-3 py-2 rounded-[14px] bg-[#1e1c1a] border border-[#4a443f] text-xs text-white focus:outline-none cursor-pointer"
                >
                  <option value={4}>4 Daire</option>
                  <option value={5}>5 Daire</option>
                  <option value={6}>6 Daire</option>
                  <option value={8}>8 Daire</option>
                  <option value={12}>12 Daire</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {/* Blok Sayısı */}
              <div>
                <label className="block text-[11px] font-semibold text-[#f3efe9] mb-1">
                  Blok Sayısı
                </label>
                <select
                  value={newProject.blockCount}
                  onChange={(e) => {
                    const bc = Number(e.target.value) as 1 | 2
                    setNewProject({
                      ...newProject,
                      blockCount: bc,
                      parsedUnits: [],
                      totalUnits: newProject.maxFloors * newProject.unitsPerFloor * bc,
                    })
                  }}
                  className="w-full px-3 py-2 rounded-[14px] bg-[#1e1c1a] border border-[#4a443f] text-xs text-white focus:outline-none cursor-pointer"
                >
                  <option value={1}>Tek Blok (A)</option>
                  <option value={2}>2 Blok (A & B)</option>
                </select>
              </div>

              {/* Ağırlıklı Oda Tipi */}
              <div>
                <label className="block text-[11px] font-semibold text-[#f3efe9] mb-1">
                  Oda Tipi
                </label>
                <select
                  value={newProject.defaultRoomType}
                  onChange={(e) =>
                    setNewProject({
                      ...newProject,
                      defaultRoomType: e.target.value as RoomType | 'MIXED',
                    })
                  }
                  className="w-full px-3 py-2 rounded-[14px] bg-[#1e1c1a] border border-[#4a443f] text-xs text-white focus:outline-none cursor-pointer"
                >
                  <option value="MIXED">Karma (1+1 / 2+1 / 3+1)</option>
                  <option value="1+1">1+1 Daireler</option>
                  <option value="2+1">2+1 Daireler</option>
                  <option value="3+1">3+1 Daireler</option>
                  <option value="4+1">4+1 Daireler</option>
                  <option value="Villa">Müstakil Villa</option>
                </select>
              </div>

              {/* Mimari Kat Planı Görünümü */}
              <div>
                <label className="block text-[11px] font-semibold text-[#f3efe9] mb-1">
                  Kroki Görünümü
                </label>
                <div className="w-full px-3 py-2 rounded-[14px] bg-[#1e1c1a] border border-[#4a443f] text-xs font-semibold text-[#b99881]">
                  Tepebakış
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Tip *
              </label>
              <select
                value={newProject.type}
                onChange={(e) => setNewProject({ ...newProject, type: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881] transition-colors cursor-pointer"
              >
                <option value="Konut & Rezidans">Konut & Rezidans</option>
                <option value="Müstakil Villa / Malikane">Müstakil Villa / Malikane</option>
                <option value="Karma Yaşam (Konut + Ticari)">Karma Yaşam (Konut + Ticari)</option>
                <option value="Yazlık & Sayfiye Evleri">Yazlık & Sayfiye Evleri</option>
                <option value="Ticari & Ofis Alanı">Ticari & Ofis Alanı</option>
                <option value="Arsa & Parsel Projesi">Arsa & Parsel Projesi</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Tahmini Teslim / Durum
              </label>
              <select
                value={newProject.deliveryDate}
                onChange={(e) => setNewProject({ ...newProject, deliveryDate: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881] transition-colors cursor-pointer"
              >
                <option value="Hemen Teslim (Hazır)">Hemen Teslim (Hazır)</option>
                <option value="2026 Sonu">2026 Sonu</option>
                <option value="Haziran 2027">Haziran 2027</option>
                <option value="Aralık 2027">Aralık 2027</option>
                <option value="2028">2028</option>
                <option value="Proje Aşamasında (Yakında)">Proje Aşamasında (Yakında)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
              Proje Açıklaması & Not (Opsiyonel)
            </label>
            <textarea
              rows={2}
              placeholder="Örn: Denize sıfır, tapusu hazır, banka kredisine uygun, geniş sosyal tesisli proje..."
              value={newProject.description}
              onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
              className="w-full px-3.5 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881] transition-colors resize-none"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddProjectOpen(false)}
              className="px-4 py-2 rounded-full text-xs text-[#a69f99] hover:text-white cursor-pointer"
            >
              Vazgeç
            </button>
            <GlassButton type="submit" variant="gold" size="sm" className="rounded-full px-5 font-bold">
              Projeyi Oluştur
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      {/* DAİRE BİLGİLERİNİ DÜZENLE MODAL */}
      <GlassModal
        isOpen={isEditUnitModalOpen}
        onClose={() => setIsEditUnitModalOpen(false)}
        title={`Daire Bilgilerini Düzenle - ${editingUnit?.unitNumber}`}
        maxWidth="md"
      >
        <form onSubmit={handleExecuteSaveUnit} className="space-y-4">
          <div className="p-3 rounded-[14px] bg-[#34302d] border border-[#4a443f] text-xs text-[#a69f99] flex justify-between items-center">
            <div>
              <span className="font-semibold text-white">{currentProject?.name}</span>
              <span className="ml-2 text-[#8c857f]">({currentProject?.code})</span>
            </div>
            <GlassBadge
              size="sm"
              variant={
                editingUnit?.status === 'SATISTA'
                  ? 'primary'
                  : editingUnit?.status === 'REZERVE'
                  ? 'warning'
                  : 'danger'
              }
            >
              {editingUnit?.status === 'SATISTA' ? 'Satışta' : editingUnit?.status === 'REZERVE' ? 'Rezerve' : 'Satıldı'}
            </GlassBadge>
          </div>

          {actionError && (
            <div className="p-3 rounded-[12px] bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          {/* Satışı Geri Al Alanı */}
          {editingUnit?.status === 'SATILDI' && (
            <div className="p-4 rounded-[16px] bg-rose-500/10 border border-rose-500/30 flex items-center justify-between gap-3 animate-in fade-in duration-200">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4 shrink-0" />
                  <span>Bu Daire Satıldı Olarak Kayıtlı</span>
                </div>
                <div className="text-[11px] text-[#c4bcb5]">
                  Alıcı: <strong className="text-white">{editingUnit.sale?.customerName || 'Müşteri'}</strong>
                  {editingUnit.sale?.salePrice ? ` • Tutar: ${formatCurrency(editingUnit.sale.salePrice)}` : ''}
                </div>
                <div className="text-[10px] text-[#8c857f]">
                  Satış kaydını iptal edip daireyi tekrar 'Satışta' durumuna getirebilirsiniz.
                </div>
              </div>

              <button
                type="button"
                onClick={handleExecuteCancelSale}
                className="px-4 py-2 rounded-full text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-colors shadow-md flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Satışı Geri Al</span>
              </button>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Daire No
              </label>
              <input
                type="text"
                disabled
                value={editingUnit?.unitNumber || ''}
                className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#1e1b19] border border-[#3d3733] text-xs text-[#8c857f] cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Satış Durumu
              </label>
              <select
                value={editUnitForm.statusLabel}
                onChange={(e) => setEditUnitForm({ ...editUnitForm, statusLabel: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881] cursor-pointer"
              >
                <option value="Satışta">Satışta (Şeffaf Yeşil)</option>
                <option value="Kapora Alındı">Kapora / Peşinat (Navy Lacivert)</option>
                <option value="Rezerve">Rezerve (Navy Lacivert)</option>
                <option value="SATILDI">Satıldı (Kırmızı)</option>
                <option value="KAPALI">Kapalı (Kırmızı)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Oda Tipi *
              </label>
              <select
                value={editUnitForm.roomType}
                onChange={(e) => setEditUnitForm({ ...editUnitForm, roomType: e.target.value as RoomType })}
                className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881] cursor-pointer"
              >
                <option value="1+1">1+1</option>
                <option value="2+1">2+1</option>
                <option value="3+1">3+1</option>
                <option value="4+1">4+1</option>
                <option value="Villa">Villa</option>
                <option value="Penthouse">Penthouse</option>
                <option value="Ticari">Ticari</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Blok
              </label>
              <input
                type="text"
                value={editUnitForm.block}
                onChange={(e) => setEditUnitForm({ ...editUnitForm, block: e.target.value })}
                placeholder="Örn: A Blok"
                className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Bulunduğu Kat
              </label>
              <select
                value={Number(editUnitForm.floor) || 0}
                onChange={(e) =>
                  setEditUnitForm({
                    ...editUnitForm,
                    floor: Number(e.target.value),
                  })
                }
                className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881] cursor-pointer"
              >
                <option value={0}>{FLOOR_LABELS[0].full}</option>
                <option value={1}>{FLOOR_LABELS[1].full}</option>
                <option value={2}>{FLOOR_LABELS[2].full}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Brüt Alan (m²)
              </label>
              <input
                type="number"
                value={editUnitForm.grossSqm}
                onChange={(e) =>
                  setEditUnitForm({
                    ...editUnitForm,
                    grossSqm: e.target.value === '' ? '' : Number(e.target.value),
                  })
                }
                className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Net Alan (m²)
              </label>
              <input
                type="number"
                value={editUnitForm.netSqm}
                onChange={(e) =>
                  setEditUnitForm({
                    ...editUnitForm,
                    netSqm: e.target.value === '' ? '' : Number(e.target.value),
                  })
                }
                className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Cephe Bilgisi
              </label>
              <input
                type="text"
                value={editUnitForm.facade}
                onChange={(e) => setEditUnitForm({ ...editUnitForm, facade: e.target.value })}
                placeholder="Örn: Güney-Batı, Deniz Cephe, Peyzaj"
                className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Satış Liste Fiyatı (TL)
              </label>
              <input
                type="number"
                value={editUnitForm.price}
                onChange={(e) =>
                  setEditUnitForm({
                    ...editUnitForm,
                    price: e.target.value === '' ? '' : Number(e.target.value),
                  })
                }
                placeholder="0 ise Belirlenmedi görünür"
                className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
              Daire Açıklaması & Özel Notlar
            </label>
            <textarea
              rows={3}
              value={editUnitForm.description}
              onChange={(e) => setEditUnitForm({ ...editUnitForm, description: e.target.value })}
              placeholder="Örn: Geniş balkonlu, ebeveyn banyolu, güney cephe, deniz manzarası..."
              className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881] resize-none"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditUnitModalOpen(false)}
              className="px-4 py-2 rounded-full text-xs text-[#a69f99] hover:text-white cursor-pointer"
            >
              Vazgeç
            </button>
            <GlassButton type="submit" variant="gold" size="sm" className="rounded-full px-5 font-bold">
              Bilgileri Kaydet
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      {/* PROJE AYARLARI MODALI */}
      <GlassModal
        isOpen={isProjectSettingsOpen}
        onClose={() => setIsProjectSettingsOpen(false)}
        title={`Proje Ayarları - ${currentProject?.name}`}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveProjectSettings} className="space-y-4">
          <div className="p-3.5 rounded-[14px] bg-[#34302d] border border-[#4a443f] text-xs text-[#a69f99] flex justify-between items-center">
            <div>
              <span className="font-semibold text-white">{currentProject?.name}</span>
              <span className="ml-2 font-mono text-[#8c857f]">({currentProject?.code})</span>
            </div>
            <GlassBadge
              size="sm"
              variant={currentProject?.status === 'SATISTA' ? 'primary' : 'warning'}
            >
              {currentProject?.status === 'SATISTA' ? 'Satışta' : currentProject?.status}
            </GlassBadge>
          </div>

          {actionError && (
            <div className="p-3 rounded-[12px] bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
              Proje Adı *
            </label>
            <input
              type="text"
              required
              value={projectSettingsForm.name}
              onChange={(e) => setProjectSettingsForm({ ...projectSettingsForm, name: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                İlçe *
              </label>
              <input
                type="text"
                required
                value={projectSettingsForm.district}
                onChange={(e) => setProjectSettingsForm({ ...projectSettingsForm, district: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Şehir *
              </label>
              <select
                value={projectSettingsForm.city}
                onChange={(e) => setProjectSettingsForm({ ...projectSettingsForm, city: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881] cursor-pointer"
              >
                <option value="Sakarya">Sakarya</option>
                <option value="İstanbul">İstanbul</option>
                <option value="İzmir">İzmir</option>
                <option value="Antalya">Antalya</option>
                <option value="Muğla">Muğla</option>
                <option value="Aydın">Aydın</option>
                <option value="Bursa">Bursa</option>
                <option value="Ankara">Ankara</option>
                <option value="Yalova">Yalova</option>
                <option value="Kocaeli">Kocaeli</option>
                <option value="Balıkesir">Balıkesir</option>
                <option value="Çanakkale">Çanakkale</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Mevki / Konum Detayı
              </label>
              <input
                type="text"
                value={projectSettingsForm.mevki}
                onChange={(e) => setProjectSettingsForm({ ...projectSettingsForm, mevki: e.target.value })}
                placeholder="Örn: Sahil Bandı, Marina Yanı"
                className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Proje Tipi *
              </label>
              <select
                value={projectSettingsForm.type}
                onChange={(e) => setProjectSettingsForm({ ...projectSettingsForm, type: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881] cursor-pointer"
              >
                <option value="Konut & Rezidans">Konut & Rezidans</option>
                <option value="Müstakil Villa / Malikane">Müstakil Villa / Malikane</option>
                <option value="Karma Yaşam (Konut + Ticari)">Karma Yaşam (Konut + Ticari)</option>
                <option value="Yazlık & Sayfiye Evleri">Yazlık & Sayfiye Evleri</option>
                <option value="Ticari & Ofis Alanı">Ticari & Ofis Alanı</option>
                <option value="Arsa & Parsel Projesi">Arsa & Parsel Projesi</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Teslim Tarihi
              </label>
              <input
                type="text"
                value={projectSettingsForm.deliveryDate}
                onChange={(e) => setProjectSettingsForm({ ...projectSettingsForm, deliveryDate: e.target.value })}
                placeholder="Örn: Aralık 2027, Hemen Teslim"
                className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Satış Durumu
              </label>
              <select
                value={projectSettingsForm.status}
                onChange={(e) => setProjectSettingsForm({ ...projectSettingsForm, status: e.target.value as any })}
                className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881] cursor-pointer"
              >
                <option value="SATISTA">Satışta</option>
                <option value="YAKINDA">Yakında</option>
                <option value="TAMAMLANDI">Tamamlandı</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Başlangıç Liste Fiyatı (TL)
              </label>
              <input
                type="number"
                value={projectSettingsForm.startingPrice}
                onChange={(e) =>
                  setProjectSettingsForm({
                    ...projectSettingsForm,
                    startingPrice: e.target.value === '' ? '' : Number(e.target.value),
                  })
                }
                className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Görsel URL
              </label>
              <input
                type="text"
                value={projectSettingsForm.imageUrl}
                onChange={(e) => setProjectSettingsForm({ ...projectSettingsForm, imageUrl: e.target.value })}
                placeholder="https://..."
                className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
              Proje Açıklaması
            </label>
            <textarea
              rows={3}
              value={projectSettingsForm.description}
              onChange={(e) => setProjectSettingsForm({ ...projectSettingsForm, description: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881] resize-none"
            />
          </div>

          {/* TEHLİKELİ BÖLGE (PROJEYİ SİL) */}
          <div className="p-4 rounded-[16px] bg-rose-500/10 border border-rose-500/30 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                <Trash2 className="w-4 h-4" />
                <span>Projeyi Sil</span>
              </div>
              <p className="text-[11px] text-[#a69f99] mt-0.5">
                Bu projeyi ve kayıtlı {currentProject?.units?.length || 0} adet bağımsız bölümünü kalıcı olarak siler.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDeleteProject}
              className="px-4 py-2 rounded-full text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-colors shadow-md flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Projeyi Sil</span>
            </button>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsProjectSettingsOpen(false)}
              className="px-4 py-2 rounded-full text-xs text-[#a69f99] hover:text-white cursor-pointer"
            >
              Vazgeç
            </button>
            <GlassButton type="submit" variant="gold" size="sm" className="rounded-full px-5 font-bold">
              Ayarları Kaydet
            </GlassButton>
          </div>
        </form>
      </GlassModal>
    </div>
  )
}
