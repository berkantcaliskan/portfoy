import React, { useState, useEffect } from 'react'
import {
  Building2,
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
  DollarSign,
  Lock,
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

  // Modals
  const [isAddProjectOpen, setIsAddProjectOpen] = useState(false)
  const [selectedUnit, setSelectedUnit] = useState<FlatUnit | null>(null)
  const [isReserveModalOpen, setIsReserveModalOpen] = useState(false)
  const [isSellModalOpen, setIsSellModalOpen] = useState(false)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false)

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
    code: '',
    location: '',
    city: 'İstanbul',
    type: 'Konut & Rezidans',
    startingPrice: 3500000,
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

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProject.name.trim()) return

    projectStore.addProject({
      name: newProject.name.trim(),
      code: newProject.code.trim() || `PRJ-${Math.floor(100 + Math.random() * 900)}`,
      location: newProject.location.trim() || 'İstanbul',
      city: newProject.city,
      type: newProject.type,
      totalUnits: 24,
      deliveryDate: 'Aralık 2027',
      startingPrice: Number(newProject.startingPrice) || 3500000,
      imageUrl: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
      status: 'SATISTA',
    })

    setIsAddProjectOpen(false)
    setNewProject({ name: '', code: '', location: '', city: 'İstanbul', type: 'Konut & Rezidans', startingPrice: 3500000 })
  }

  const canEditPrice = permissionService.canEditProjectPrice(currentUser)

  return (
    <div className="space-y-6">
      {/* Title Header (Katmansız, Çizgisiz, İkonlu) */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-[#b99881]" />
            <h2 className="text-xl font-bold tracking-tight text-white">
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

      {/* Proje Seçimi Sekmeleri */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-[#4a443f]">
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
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-[20px] bg-[#282522] border border-[#4a443f]">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>{currentProject.name}</span>
                <span className="text-xs font-normal text-[#8c857f]">({currentProject.code})</span>
              </h3>
              <div className="flex items-center gap-3 text-xs text-[#a69f99] mt-1">
                <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-[#b99881]" /> {currentProject.location}</span>
                <span>•</span>
                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-[#b99881]" /> {currentProject.deliveryDate}</span>
                <span>•</span>
                <span>Başlangıç: {formatCurrency(currentProject.startingPrice)}</span>
              </div>
            </div>

            {/* Durum Renk Lejantı */}
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500" />
                <span className="text-[#a69f99]">Satışta</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500" />
                <span className="text-[#a69f99]">Rezerve (Opsiyonlu)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-500/20 border border-rose-500" />
                <span className="text-[#a69f99]">Satıldı</span>
              </div>
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
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-white">{unit.unitNumber}</span>
                      <span className="text-[10px] text-[#8c857f] px-1.5 py-0.5 rounded bg-[#34302d]">
                        {unit.block || 'A Blok'} • {unit.floor}. Kat
                      </span>
                    </div>
                    <GlassBadge
                      size="sm"
                      variant={isAvailable ? 'primary' : isReserved ? 'warning' : 'danger'}
                    >
                      {isAvailable ? 'Satışta' : isReserved ? 'Rezerve' : 'Satıldı'}
                    </GlassBadge>
                  </div>

                  <div className="space-y-1 text-xs text-[#a69f99] my-3">
                    <div className="flex justify-between">
                      <span>Tip / m²:</span>
                      <span className="text-white font-medium">{unit.roomType} ({unit.grossSqm} m²)</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Liste Fiyatı:</span>
                      <div className="flex items-center gap-1">
                        <span className="text-white font-bold text-sm">{formatCurrency(unit.price)}</span>
                        {canEditPrice && isAvailable && (
                          <button
                            onClick={() => handleOpenPrice(unit)}
                            className="text-[#b99881] hover:text-white p-0.5 cursor-pointer"
                            title="Fiyatı Düzenle"
                          >
                            <DollarSign className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

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
                          onClick={() => handleOpenReserve(unit)}
                          className="flex-1 py-1.5 px-2 text-xs font-semibold rounded-[10px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition-colors cursor-pointer"
                        >
                          Rezerve Et
                        </button>
                        <button
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
                          onClick={() => handleOpenSell(unit)}
                          className="flex-1 py-1.5 px-2 text-xs font-semibold rounded-[10px] bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition-colors cursor-pointer"
                        >
                          Satışa Çevir
                        </button>
                        <button
                          onClick={() => handleCancelReserve(unit)}
                          className="py-1.5 px-2 text-xs font-medium rounded-[10px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors cursor-pointer"
                          title="Rezervasyonu İptal Et"
                        >
                          İptal
                        </button>
                      </>
                    )}

                    <button
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
                Şehir
              </label>
              <select
                value={newProject.city}
                onChange={(e) => setNewProject({ ...newProject, city: e.target.value })}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              >
                <option value="İstanbul">İstanbul</option>
                <option value="İzmir">İzmir</option>
                <option value="Antalya">Antalya</option>
                <option value="Muğla">Muğla</option>
                <option value="Ankara">Ankara</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Konum / İlçe
              </label>
              <input
                type="text"
                placeholder="Örn: Bodrum, Muğla"
                value={newProject.location}
                onChange={(e) => setNewProject({ ...newProject, location: e.target.value })}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Tip
              </label>
              <input
                type="text"
                value={newProject.type}
                onChange={(e) => setNewProject({ ...newProject, type: e.target.value })}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Başlangıç Fiyatı (TL)
              </label>
              <input
                type="number"
                value={newProject.startingPrice}
                onChange={(e) => setNewProject({ ...newProject, startingPrice: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>
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
    </div>
  )
}
