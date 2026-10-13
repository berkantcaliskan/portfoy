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
  ArrowLeft,
  ChevronRight,
  Compass,
  Settings,
  RotateCcw,
  Trash2,
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
} from '@/services/projectStore'
import { userStore, AppUser } from '@/services/userStore'
import { permissionService } from '@/services/permissionService'

interface ProjectsViewProps {
  onNavigateToPortfolio: () => void
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({ onNavigateToPortfolio }) => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(userStore.getCurrentUser())
  const [projects, setProjects] = useState<SharedProject[]>(projectStore.getAll())
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '')
  const [selectedCity, setSelectedCity] = useState<string>('ALL')
  const [viewMode, setViewMode] = useState<'grid' | 'detail'>('grid')

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
  const [editUnitForm, setEditUnitForm] = useState({
    price: 0,
    facade: '',
    description: '',
    roomType: '2+1' as RoomType,
    block: 'A Blok',
    floor: 1,
    grossSqm: 100,
    netSqm: 80,
  })

  // Form states
  const [customerName, setCustomerName] = useState('')
  const [reserveDays, setReserveDays] = useState(5)
  const [depositAmount, setDepositAmount] = useState(100000)
  const [reserveNote, setReserveNote] = useState('')
  const [salePrice, setSalePrice] = useState(0)
  const [paymentPlan, setPaymentPlan] = useState('%50 Peşin + 24 Ay Taksit')
  const [editPrice, setEditPrice] = useState(0)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  // New project form
  const [newProject, setNewProject] = useState({
    name: '',
    city: 'İstanbul',
    district: '',
    mevki: '',
    type: 'Konut & Rezidans',
    totalUnits: 24,
    deliveryDate: 'Aralık 2027',
    description: '',
  })

  // Project Settings state
  const [isProjectSettingsOpen, setIsProjectSettingsOpen] = useState(false)
  const [projectSettingsForm, setProjectSettingsForm] = useState({
    name: '',
    city: 'İstanbul',
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

    const expiresAt = new Date(Date.now() + 86400000 * reserveDays).toISOString()
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
    setEditUnitForm({
      price: unit.price || 0,
      facade: unit.facade || '',
      description: unit.description || '',
      roomType: unit.roomType || '2+1',
      block: unit.block || 'A Blok',
      floor: unit.floor || 1,
      grossSqm: unit.grossSqm || 100,
      netSqm: unit.netSqm || 80,
    })
    setActionError(null)
    setIsEditUnitModalOpen(true)
  }

  const handleExecuteSaveUnit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUnit || !currentProject) return

    const res = projectStore.updateUnitDetails(
      currentProject.id,
      editingUnit.id,
      {
        price: Number(editUnitForm.price) || 0,
        facade: editUnitForm.facade.trim(),
        description: editUnitForm.description.trim(),
        roomType: editUnitForm.roomType,
        block: editUnitForm.block.trim(),
        floor: Number(editUnitForm.floor) || 1,
        grossSqm: Number(editUnitForm.grossSqm) || 0,
        netSqm: Number(editUnitForm.netSqm) || 0,
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

    const created = projectStore.addProject({
      name: newProject.name.trim(),
      code: `PRJ-${Math.floor(100 + Math.random() * 900)}`,
      location: fullLocation || newProject.city,
      city: newProject.city,
      district: newProject.district.trim(),
      mevki: newProject.mevki.trim(),
      type: newProject.type,
      totalUnits: Number(newProject.totalUnits) || 24,
      deliveryDate: newProject.deliveryDate,
      startingPrice: 0,
      imageUrl: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
      status: 'SATISTA',
      description: newProject.description.trim(),
    })

    setSelectedProjectId(created.id)
    setViewMode('detail')
    setIsAddProjectOpen(false)
    setActionSuccess(`"${newProject.name.trim()}" projesi başarıyla eklendi.`)
    setTimeout(() => setActionSuccess(null), 3000)
    setNewProject({
      name: '',
      city: 'İstanbul',
      district: '',
      mevki: '',
      type: 'Konut & Rezidans',
      totalUnits: 24,
      deliveryDate: 'Aralık 2027',
      description: '',
    })
  }

  const handleOpenProjectSettings = () => {
    if (!currentProject) return
    setProjectSettingsForm({
      name: currentProject.name || '',
      city: currentProject.city || 'İstanbul',
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
    <div className="space-y-6">
      {/* Title Header (Katmansız, Çizgisiz, İkonlu) */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-[#b99881]" />
            <h2 className="text-2xl font-bold text-white tracking-wide">
              Projeler
            </h2>
          </div>
          <p className="text-xs text-[#a69f99] mt-1">
            Tüm departmanlar için ortak tekil proje envanteri ve çakışma korumalı daire durum matrisi.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {(currentUser?.role === 'ADMIN' || currentUser?.isManager) && (
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
                <div className="text-xs text-emerald-400">Satılan Daireler</div>
                <div className="text-2xl font-bold text-emerald-400 mt-1">{totalSold}</div>
                <div className="text-[11px] text-[#8c857f] mt-1">%{overallRate} Satış Oranı</div>
              </GlassCard>

              <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
                <div className="text-xs text-amber-400">Rezerve Daireler</div>
                <div className="text-2xl font-bold text-amber-400 mt-1">{totalReserved}</div>
                <div className="text-[11px] text-[#8c857f] mt-1">Opsiyonlu bağımsız bölüm</div>
              </GlassCard>

              <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
                <div className="text-xs text-[#38bdf8]">Satışta Olanlar</div>
                <div className="text-2xl font-bold text-white mt-1">{totalUnits - totalSold - totalReserved}</div>
                <div className="text-[11px] text-[#8c857f] mt-1">Hemen rezerve edilebilir</div>
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
              <div className="p-16 text-center rounded-[24px] bg-[#282522] border border-[#4a443f]">
                <Building2 className="w-12 h-12 text-[#8c857f] mx-auto mb-3 opacity-40" />
                <h3 className="text-base font-bold text-white">Kayıtlı Proje Bulunmuyor</h3>
                <p className="text-xs text-[#a69f99] mt-1.5 max-w-md mx-auto">
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
                        <p className="text-xs text-[#c4bcb5] line-clamp-2 mb-4 bg-[#1e1b19]/60 p-3 rounded-[14px] border border-[#3d3733]/60 italic">
                          "{p.description}"
                        </p>
                      )}
                    </div>

                    {/* Alt Kısım: İlerleme Çubuğu & Daireleri İncele */}
                    <div className="pt-4 border-t border-[#4a443f]/60 space-y-3">
                      <div>
                        <div className="flex justify-between items-center text-[11px] mb-1.5">
                          <span className="text-[#8c857f]">Envanter Durumu</span>
                          <span className="font-semibold text-white">{total} Bağımsız Bölüm</span>
                        </div>
                        {/* Çok Katmanlı İlerleme Çubuğu */}
                        <div className="h-2 w-full bg-[#1e1b19] rounded-full overflow-hidden flex">
                          <div
                            style={{ width: `${soldPct}%` }}
                            className="bg-emerald-500 h-full transition-all"
                            title={`Satılan: ${sold}`}
                          />
                          <div
                            style={{ width: `${resPct}%` }}
                            className="bg-amber-500 h-full transition-all"
                            title={`Rezerve: ${reserved}`}
                          />
                          <div
                            style={{ width: `${availPct}%` }}
                            className="bg-[#b99881] h-full transition-all"
                            title={`Satışta: ${available}`}
                          />
                        </div>

                        {/* Mikro Durumlar */}
                        <div className="flex items-center justify-between text-[11px] text-[#8c857f] mt-2">
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span>Satıldı: <strong className="text-emerald-400">{sold}</strong></span>
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                            <span>Rezerve: <strong className="text-amber-400">{reserved}</strong></span>
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-[#b99881]" />
                            <span>Satışta: <strong className="text-white">{available}</strong></span>
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
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-6"
          >
            {/* Geri Dönüş ve Başlık Çubuğu */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold text-[#c4bcb5] hover:text-white bg-[#282522] hover:bg-[#34302d] border border-[#4a443f] hover:border-[#b99881] transition-all cursor-pointer shadow-sm"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-[#b99881]" />
                <span>Tüm Projeler Listesine Dön</span>
              </button>

              <div className="text-xs text-[#8c857f]">
                Görüntülenen Proje: <strong className="text-white ml-1 font-semibold">{currentProject?.name}</strong>
              </div>
            </div>

            {/* Proje Seçimi Sekmeleri (Altındaki çizgi kaldırıldı) */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {projects.map((p) => {
                const isSelected = p.id === selectedProjectId
                const soldCount = p.units?.filter((u) => u.status === 'SATILDI').length || 0
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProjectId(p.id)}
                    className={`px-4 py-2 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
                      isSelected
                        ? 'bg-[#b99881] text-[#282522] font-bold shadow-md'
                        : 'bg-[#282522] text-[#a69f99] hover:text-white border border-[#4a443f]'
                    }`}
                  >
                    <span>{p.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-[#282522]/20 text-[#282522]' : 'bg-[#34302d] text-[#8c857f]'}`}>
                      {soldCount}/{p.units?.length || 0}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Seçili Proje Detay & Daire Matrisi */}
            {currentProject && (
              <div className="space-y-4">
                {/* Bilgi Kısmı (Kutucuk olmadan, doğrudan zemin üzerinde) */}
                <div className="flex flex-wrap items-center justify-between gap-4 py-2 px-1">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>{currentProject.name}</span>
                      <span className="text-xs font-normal text-[#8c857f]">({currentProject.code})</span>
                    </h3>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-[#a69f99] mt-1">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-[#b99881]" />
                        {currentProject.district ? `${currentProject.district}, ${currentProject.city}` : currentProject.location}
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
                    {currentProject.description && (
                      <p className="text-xs text-[#c4bcb5] mt-1.5 line-clamp-2">
                        {currentProject.description}
                      </p>
                    )}
                  </div>

                  {/* Sağ Taraf: Durum Renk Lejantı ve Proje Ayarları */}
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/20 border border-emerald-500" />
                        <span className="text-[#a69f99]">Satışta</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500/20 border border-amber-500" />
                        <span className="text-[#a69f99]">Rezerve (Opsiyonlu)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500/20 border border-rose-500" />
                        <span className="text-[#a69f99]">Satıldı</span>
                      </div>
                    </div>

                    {(currentUser?.role === 'ADMIN' || currentUser?.isManager) && (
                      <button
                        type="button"
                        onClick={handleOpenProjectSettings}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold text-[#c4bcb5] hover:text-white bg-[#282522] hover:bg-[#34302d] border border-[#4a443f] hover:border-[#b99881] transition-all cursor-pointer shadow-sm ml-1"
                        title="Proje Bilgileri ve Yönetim Ayarları"
                      >
                        <Settings className="w-3.5 h-3.5 text-[#b99881]" />
                        <span>Proje Ayarları</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Daireler Grid Matrisi */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {currentUnits.map((unit) => {
                    const isAvailable = unit.status === 'SATISTA'
                    const isReserved = unit.status === 'REZERVE'
                    const isSold = unit.status === 'SATILDI'

                    return (
                      <div
                        key={unit.id}
                        className={`p-4 rounded-[20px] border transition-all duration-200 ${
                          isAvailable
                            ? 'bg-[#282522] border-[#4a443f] hover:border-[#b99881]'
                            : isReserved
                            ? 'bg-amber-500/5 border-amber-500/30'
                            : 'bg-[#24211f] border-rose-500/20 opacity-80'
                        }`}
                      >
                        {/* Üst Kısım: Daire No, Kat, Durum Rozeti ve Düzenle Butonu */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-white">{unit.unitNumber}</span>
                            <span className="text-[10px] text-[#8c857f] px-1.5 py-0.5 rounded bg-[#34302d]">
                              {unit.block || 'A Blok'} • {unit.floor}. Kat
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <GlassBadge
                              size="sm"
                              variant={isAvailable ? 'primary' : isReserved ? 'warning' : 'danger'}
                            >
                              {isAvailable ? 'Satışta' : isReserved ? 'Rezerve' : 'Satıldı'}
                            </GlassBadge>
                            <button
                              type="button"
                              onClick={() => handleOpenEditUnit(unit)}
                              className="p-1 rounded-[8px] bg-[#34302d] hover:bg-[#b99881] text-[#a69f99] hover:text-[#282522] border border-[#4a443f] hover:border-[#b99881] transition-all cursor-pointer"
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
                                  className="text-[#b99881] hover:text-white p-0.5 cursor-pointer"
                                  title="Fiyatı Belirle / Düzenle"
                                >
                                  <TurkishLira className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>

                          {unit.description && (
                            <p className="mt-1.5 text-[11px] text-[#c4bcb5] bg-[#1e1b19]/70 px-2.5 py-1.5 rounded-[10px] border border-[#3d3733]/60 italic line-clamp-2">
                              "{unit.description}"
                            </p>
                          )}

                          {/* Rezervasyon Ayrıntısı (Varsa) */}
                          {isReserved && unit.reservation && (
                            <div className="mt-2 pt-2 border-t border-amber-500/20 text-[11px] text-amber-300/90 space-y-0.5">
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
                            <div className="mt-2 pt-2 border-t border-rose-500/20 text-[11px] text-rose-300/90 space-y-0.5">
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
                        <div className="flex items-center gap-1.5 pt-2 border-t border-[#4a443f]/50">
                          {isAvailable && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenReserve(unit)}
                                className="flex-1 py-1.5 px-2 text-xs font-semibold rounded-[10px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition-colors cursor-pointer"
                              >
                                Rezerve Et
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenSell(unit)}
                                className="flex-1 py-1.5 px-2 text-xs font-semibold rounded-[10px] bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition-colors cursor-pointer"
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
                                className="flex-1 py-1.5 px-2 text-xs font-semibold rounded-[10px] bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition-colors cursor-pointer"
                              >
                                Satışa Çevir
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCancelReserve(unit)}
                                className="py-1.5 px-2 text-xs font-medium rounded-[10px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors cursor-pointer"
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
                              className="flex-1 py-1.5 px-2 text-xs font-semibold rounded-[10px] bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                              title="Satışı Geri Al veya Daireyi Düzenle"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Satışı Düzenle</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenHistory(unit)}
                            className="p-1.5 text-xs rounded-[10px] bg-[#34302d] hover:bg-[#3d3733] text-[#a69f99] hover:text-white border border-[#4a443f] transition-colors cursor-pointer"
                            title="Durum Değişiklik Geçmişi (Audit Log)"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
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
              Tip: {selectedUnit?.roomType} • {selectedUnit?.grossSqm} m² • {selectedUnit?.floor}. Kat
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
                onChange={(e) => setDepositAmount(Number(e.target.value))}
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
                onChange={(e) => setSalePrice(Number(e.target.value))}
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
              onChange={(e) => setEditPrice(Number(e.target.value))}
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
                <option value="İstanbul">İstanbul</option>
                <option value="Sakarya">Sakarya</option>
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
                Toplam Ünite Sayısı
              </label>
              <input
                type="number"
                min="1"
                max="120"
                value={newProject.totalUnits}
                onChange={(e) => setNewProject({ ...newProject, totalUnits: Math.max(1, Number(e.target.value)) })}
                className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881] transition-colors"
              />
            </div>
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

          <div className="grid grid-cols-2 gap-3">
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
              <input
                type="number"
                value={editUnitForm.floor}
                onChange={(e) => setEditUnitForm({ ...editUnitForm, floor: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
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
                onChange={(e) => setEditUnitForm({ ...editUnitForm, grossSqm: Number(e.target.value) })}
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
                onChange={(e) => setEditUnitForm({ ...editUnitForm, netSqm: Number(e.target.value) })}
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
                onChange={(e) => setEditUnitForm({ ...editUnitForm, price: Number(e.target.value) })}
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
                <option value="İstanbul">İstanbul</option>
                <option value="Sakarya">Sakarya</option>
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
                onChange={(e) => setProjectSettingsForm({ ...projectSettingsForm, startingPrice: Number(e.target.value) })}
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
