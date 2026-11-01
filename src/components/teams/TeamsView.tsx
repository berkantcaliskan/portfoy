import React, { useState, useEffect } from 'react'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  MapPin,
  Clock,
  Car,
  Key,
  Briefcase,
  Calendar,
  Plus,
  Check,
  X,
  CheckCircle2,
  XCircle,
  Search,
  Edit3,
  Trash2,
  RotateCcw,
  ArrowUpRight,
  Building2,
  ShieldCheck,
  History,
  UserCheck,
  Navigation,
} from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlassButton } from '@/components/ui/GlassButton'
import { GlassBadge } from '@/components/ui/GlassBadge'
import { GlassModal } from '@/components/ui/GlassModal'
import {
  AppUser,
  Department,
  generateInitialPassword,
  generateUsername,
  userStore,
} from '@/services/userStore'
import { CANONICAL_DEPARTMENTS } from '@/types/department'
import {
  teamOperationsStore,
  PRESENCE_STATUS_OPTIONS,
  PresenceStatusType,
  getPresenceMeta,
  UserPresenceRecord,
  SharedAssetItem,
  SharedAssetCategory,
  AssetHistoryLog,
  LeaveRequestItem,
  LeaveType,
} from '@/services/teamOperationsStore'

interface TeamsViewProps {
  currentUser: AppUser | null
  onOpenProfile?: () => void
}

const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  SAATLIK_CIKIS: 'Saatlik Çıkış / Dış Görev',
  YILLIK_IZIN: 'Yıllık İzin',
  MAZERET_IZNI: 'Mazeret İzni',
  RAPOR: 'Sağlık Raporu',
}

const ASSET_CATEGORY_LABELS: Record<SharedAssetCategory, string> = {
  ARAC: 'Şirket Aracı & Anahtarı',
  PORTFOY_ANAHTARI: 'Portföy / Daire Anahtarı',
  EKIPMAN: 'Ofis & Saha Ekipmanı',
}

export const TeamsView: React.FC<TeamsViewProps> = ({ currentUser, onOpenProfile }) => {
  const [users, setUsers] = useState<AppUser[]>(() => userStore.getAllUsers())
  const [presenceMap, setPresenceMap] = useState<Record<string, UserPresenceRecord>>(() =>
    teamOperationsStore.getAllPresenceMap()
  )
  const [assets, setAssets] = useState<SharedAssetItem[]>(() => teamOperationsStore.getAssets())
  const [assetLogs, setAssetLogs] = useState<AssetHistoryLog[]>(() =>
    teamOperationsStore.getAssetLogs()
  )
  const [leaves, setLeaves] = useState<LeaveRequestItem[]>(() => teamOperationsStore.getLeaves())

  // Active sub-tab: 'presence' | 'assets' | 'leaves'
  const [activeSubTab, setActiveSubTab] = useState<'presence' | 'assets' | 'leaves'>('presence')

  // Filters for Presence Board
  const [deptFilter, setDeptFilter] = useState<string>('ALL')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  // Filters for Assets
  const [assetCategoryFilter, setAssetCategoryFilter] = useState<string>('ALL')

  // Modal: Edit Status for a User (Self or Manager editing team member)
  const [editingUser, setEditingUser] = useState<AppUser | null>(null)
  const [editStatus, setEditStatus] = useState<PresenceStatusType>('OFISTE')
  const [editLocationNote, setEditLocationNote] = useState('')
  const [editReturnTime, setEditReturnTime] = useState('')

  // Modal: Add New Shared Asset (Car / Portfolio Key / Equipment)
  const [isAddAssetOpen, setIsAddAssetOpen] = useState(false)
  const [newAssetName, setNewAssetName] = useState('')
  const [newAssetCode, setNewAssetCode] = useState('')
  const [newAssetCategory, setNewAssetCategory] = useState<SharedAssetCategory>('ARAC')
  const [newAssetNotes, setNewAssetNotes] = useState('')

  // Modal: Checkout Asset (Take Car Key / Portfolio Key)
  const [checkoutTargetAsset, setCheckoutTargetAsset] = useState<SharedAssetItem | null>(null)
  const [checkoutDestination, setCheckoutDestination] = useState('')
  const [checkoutReturnTime, setCheckoutReturnTime] = useState('')
  const [checkoutAutoStatus, setCheckoutAutoStatus] = useState<PresenceStatusType>('GOSTERIMDE')
  const [checkoutUpdateMyStatus, setCheckoutUpdateMyStatus] = useState(true)

  // Modal: Add New Leave / Hourly Exit Request
  const [isAddLeaveOpen, setIsAddLeaveOpen] = useState(false)
  const [leaveType, setLeaveType] = useState<LeaveType>('SAATLIK_CIKIS')
  const [leaveStartDate, setLeaveStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [leaveEndDate, setLeaveEndDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [leaveStartTime, setLeaveStartTime] = useState('')
  const [leaveEndTime, setLeaveEndTime] = useState('')
  const [leaveReason, setLeaveReason] = useState('')

  // Modal: Add Team Member (Ekip Üyesi Ekle)
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false)
  const [newMemberFullName, setNewMemberFullName] = useState('')
  const [newMemberDepartment, setNewMemberDepartment] = useState<Department>('Satış')
  const [createdMemberBanner, setCreatedMemberBanner] = useState<{
    fullName: string
    username: string
    password: string
    department: Department
  } | null>(null)

  useEffect(() => {
    const unsubUsers = userStore.subscribe(() => {
      setUsers(userStore.getAllUsers())
    })
    const unsubOps = teamOperationsStore.subscribe(() => {
      setPresenceMap(teamOperationsStore.getAllPresenceMap())
      setAssets(teamOperationsStore.getAssets())
      setAssetLogs(teamOperationsStore.getAssetLogs())
      setLeaves(teamOperationsStore.getLeaves())
    })
    const handleSearchSelect = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.payload?.subTab) {
        setActiveSubTab(detail.payload.subTab)
      }
    }
    window.addEventListener('demirturk:search-select', handleSearchSelect)
    return () => {
      unsubUsers()
      unsubOps()
      window.removeEventListener('demirturk:search-select', handleSearchSelect)
    }
  }, [])

  const isManagerOrAdmin = Boolean(
    currentUser?.role === 'ADMIN' ||
      currentUser?.isManager ||
      currentUser?.department === 'Yönetim' ||
      currentUser?.permissions?.canManageTeam
  )

  const allowedDepartmentsForUser: Department[] =
    currentUser?.role === 'ADMIN'
      ? CANONICAL_DEPARTMENTS
      : Array.isArray(currentUser?.departments) && currentUser.departments.length > 0
      ? currentUser.departments
      : [currentUser?.department || 'Satış']

  const canSeeMultipleDepartments =
    currentUser?.role === 'ADMIN' || allowedDepartmentsForUser.length > 1

  const myPresence = currentUser
    ? presenceMap[currentUser.id] || teamOperationsStore.getUserPresence(currentUser.id)
    : null
  const myMeta = getPresenceMeta(myPresence?.status)

  // Only include users on the live presence board that belong to departments the current user is allowed to see
  const trackedUsers = users.filter((u) => {
    if (u.id === 'usr-berkant' && !presenceMap[u.id]) return false
    if (!canSeeMultipleDepartments && u.department !== (currentUser?.department || 'Satış')) {
      return false
    }
    return true
  })

  // Summary KPIs
  const totalInOffice = trackedUsers.filter((u) => {
    const st = (presenceMap[u.id]?.status || 'OFISTE') as PresenceStatusType
    return st === 'OFISTE' || st === 'TOPLANTIDA'
  }).length

  const totalInField = trackedUsers.filter((u) => {
    const st = (presenceMap[u.id]?.status || 'OFISTE') as PresenceStatusType
    return st === 'GOSTERIMDE' || st === 'TAPUDA' || st === 'SANTIYEDE'
  }).length

  const activeAssetsCount = assets.filter((a) => Boolean(a.holderUserId)).length
  const pendingLeavesCount = leaves.filter((l) => l.status === 'BEKLEMEDE').length

  // Filtered Users for Presence Board
  const filteredUsers = trackedUsers.filter((u) => {
    const rec = presenceMap[u.id] || { status: 'OFISTE', locationNote: '', returnTime: '' }
    if (deptFilter !== 'ALL' && u.department !== deptFilter) return false
    if (statusFilter !== 'ALL' && rec.status !== statusFilter) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchName = u.fullName.toLowerCase().includes(q)
      const matchDept = u.department.toLowerCase().includes(q)
      const matchNote = (rec.locationNote || '').toLowerCase().includes(q)
      if (!matchName && !matchDept && !matchNote) return false
    }
    return true
  })

  // Filtered Assets
  const filteredAssets = assets.filter((a) => {
    if (assetCategoryFilter !== 'ALL' && a.category !== assetCategoryFilter) return false
    return true
  })

  const handleOpenEditUserStatus = (targetUser: AppUser) => {
    const rec = teamOperationsStore.getUserPresence(targetUser.id)
    setEditingUser(targetUser)
    setEditStatus(rec.status)
    setEditLocationNote(rec.locationNote || '')
    setEditReturnTime(rec.returnTime || '')
  }

  const handleSaveUserStatus = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return
    teamOperationsStore.updateUserPresence(editingUser.id, {
      status: editStatus,
      locationNote: editStatus === 'OFISTE' ? '' : editLocationNote,
      returnTime: editStatus === 'OFISTE' ? '' : editReturnTime,
      updatedBy: currentUser?.id || editingUser.id,
    })
    setEditingUser(null)
  }

  const handleCreateAsset = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAssetName.trim() || !newAssetCode.trim()) return
    teamOperationsStore.addAsset({
      name: newAssetName,
      codeOrPlate: newAssetCode,
      category: newAssetCategory,
      notes: newAssetNotes,
    })
    setNewAssetName('')
    setNewAssetCode('')
    setNewAssetNotes('')
    setIsAddAssetOpen(false)
  }

  const handleConfirmCheckoutAsset = (e: React.FormEvent) => {
    e.preventDefault()
    if (!checkoutTargetAsset || !currentUser) return
    teamOperationsStore.checkoutAsset(checkoutTargetAsset.id, currentUser, {
      destinationNote: checkoutDestination,
      expectedReturnTime: checkoutReturnTime,
      autoUpdatePresenceStatus: checkoutUpdateMyStatus ? checkoutAutoStatus : undefined,
    })
    setCheckoutTargetAsset(null)
    setCheckoutDestination('')
    setCheckoutReturnTime('')
  }

  const handleCreateLeave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser || !leaveReason.trim()) return
    teamOperationsStore.addLeaveRequest({
      user: currentUser,
      leaveType,
      startDate: leaveStartDate,
      endDate: leaveType === 'SAATLIK_CIKIS' ? leaveStartDate : leaveEndDate,
      startTime: leaveType === 'SAATLIK_CIKIS' ? leaveStartTime : undefined,
      endTime: leaveType === 'SAATLIK_CIKIS' ? leaveEndTime : undefined,
      reason: leaveReason,
    })
    setLeaveReason('')
    setLeaveStartTime('')
    setLeaveEndTime('')
    setIsAddLeaveOpen(false)
  }

  const formatTimeShort = (iso?: string | null) => {
    if (!iso) return ''
    try {
      const d = new Date(iso)
      return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header & My Quick Status Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-[#b99881]" />
            <h2 className="text-2xl font-bold text-white tracking-wide">
              Ekipler & Ofis Operasyonu
            </h2>
          </div>
          <p className="text-xs text-[#a69f99] mt-1">
            Canlı ekip konumu ("Kim Nerede?"), şirket aracı & portföy anahtarı zimmetleri ve izin/saatlik çıkış yönetimi.
          </p>
        </div>

        {/* Active User Quick Status Banner */}
        {currentUser && (
          <div className="flex flex-wrap items-center gap-2.5 bg-[#282522]/90 border border-[#4a443f] rounded-full py-2 px-4">
            <div className="flex items-center gap-2 mr-1">
              <span className={`w-2.5 h-2.5 rounded-full ${myMeta.dotClass}`} />
              <div className="text-xs">
                <span className="text-[#a69f99] mr-1.5">Durumum:</span>
                <span className={`font-bold ${myMeta.colorClass}`}>{myMeta.label}</span>
                {myPresence?.locationNote && (
                  <span className="text-[#c4bcb5] ml-1.5">• {myPresence.locationNote}</span>
                )}
                {myPresence?.returnTime && (
                  <span className="text-[#a69f99] ml-1.5">(Dönüş: {myPresence.returnTime})</span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (onOpenProfile) {
                  onOpenProfile()
                } else {
                  handleOpenEditUserStatus(currentUser)
                }
              }}
              className="px-3.5 py-1.5 rounded-full bg-[#b99881] text-xs font-semibold text-white transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Durumumu Değiştir</span>
            </button>
          </div>
        )}
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <GlassCard className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-[#a69f99] block">Ofiste</span>
            <span className="text-2xl font-bold text-emerald-400 mt-1 block">
              {totalInOffice} <span className="text-xs font-normal text-[#8c857f]">/ {trackedUsers.length} Kişi</span>
            </span>
          </div>
          <UserCheck className="w-5 h-5 text-emerald-400 shrink-0" />
        </GlassCard>

        <GlassCard className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-[#a69f99] block">Dışarıda</span>
            <span className="text-2xl font-bold text-[#dfb76c] mt-1 block">
              {totalInField} <span className="text-xs font-normal text-[#8c857f]">Kişi</span>
            </span>
          </div>
          <Navigation className="w-5 h-5 text-[#dfb76c] shrink-0" />
        </GlassCard>

        <GlassCard className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-[#a69f99] block">Zimmette</span>
            <span className="text-2xl font-bold text-sky-400 mt-1 block">
              {activeAssetsCount} <span className="text-xs font-normal text-[#8c857f]">/ {assets.length} Kayıt</span>
            </span>
          </div>
          <Car className="w-5 h-5 text-sky-400 shrink-0" />
        </GlassCard>

        <GlassCard className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-[#a69f99] block">Bekleyen İzin</span>
            <span className="text-2xl font-bold text-rose-400 mt-1 block">
              {pendingLeavesCount} <span className="text-xs font-normal text-[#8c857f]">Talep</span>
            </span>
          </div>
          <Calendar className="w-5 h-5 text-rose-400 shrink-0" />
        </GlassCard>
      </div>

      {/* Sub-Navigation Tabs + Context Action Button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('presence')}
            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'presence'
                ? 'bg-[#b99881] text-[#1c1a18] shadow-md'
                : 'bg-[#282522] text-[#c4bcb5] hover:text-white border border-[#4a443f]/60'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Kim Nerede? ({trackedUsers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('assets')}
            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'assets'
                ? 'bg-[#b99881] text-[#1c1a18] shadow-md'
                : 'bg-[#282522] text-[#c4bcb5] hover:text-white border border-[#4a443f]/60'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>Araç & Anahtar Zimmeti ({assets.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('leaves')}
            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'leaves'
                ? 'bg-[#b99881] text-[#1c1a18] shadow-md'
                : 'bg-[#282522] text-[#c4bcb5] hover:text-white border border-[#4a443f]/60'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>İzin & Saatlik Çıkış ({leaves.length})</span>
            {pendingLeavesCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-rose-500 text-white">
                {pendingLeavesCount}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {isManagerOrAdmin && (
            <GlassButton
              variant="gold"
              size="sm"
              icon={<Plus className="w-4 h-4" />}
              className="rounded-full"
              onClick={() => setIsAddMemberOpen(true)}
            >
              Ekip Üyesi Ekle
            </GlassButton>
          )}
          {activeSubTab === 'assets' && (
            <GlassButton
              variant="gold"
              size="sm"
              icon={<Plus className="w-4 h-4" />}
              className="rounded-full"
              onClick={() => setIsAddAssetOpen(true)}
            >
              Yeni Araç / Anahtar Tanımla
            </GlassButton>
          )}
          {activeSubTab === 'leaves' && (
            <GlassButton
              variant="gold"
              size="sm"
              icon={<Plus className="w-4 h-4" />}
              className="rounded-full"
              onClick={() => setIsAddLeaveOpen(true)}
            >
              İzin / Saatlik Çıkış Talebi
            </GlassButton>
          )}
        </div>
      </div>

      {/* Yeni Oluşturulan Ekip Üyesi Bilgilendirme Kartı */}
      {createdMemberBanner && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5 text-xs">
            <div className="font-bold text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {createdMemberBanner.fullName} ({createdMemberBanner.department}) başarıyla eklendi!
              </span>
            </div>
            <div className="text-[#f3efe9] mt-1">
              Kullanıcı Adı:{' '}
              <span className="font-mono font-bold text-white">{createdMemberBanner.username}</span> • 6 Haneli Şifre:{' '}
              <span className="font-mono font-bold text-amber-300 tracking-wider">
                {createdMemberBanner.password}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCreatedMemberBanner(null)}
            className="text-[#a69f99] hover:text-white cursor-pointer p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 1: CANLI "KİM NEREDE?" PANOSU                                  */}
      {/* =================================================================== */}
      {activeSubTab === 'presence' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                  statusFilter === 'ALL'
                    ? 'bg-[#b99881]/25 text-[#dfb76c] border border-[#b99881]/50'
                    : 'bg-[#282522] text-[#a69f99] hover:text-white border border-[#4a443f]/50'
                }`}
              >
                Tümü ({trackedUsers.length})
              </button>
              {PRESENCE_STATUS_OPTIONS.map((opt) => {
                const count = trackedUsers.filter(
                  (u) => (presenceMap[u.id]?.status || 'OFISTE') === opt.id
                ).length
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setStatusFilter(opt.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                      statusFilter === opt.id
                        ? `${opt.bgClass} ${opt.borderClass} ${opt.colorClass} border`
                        : 'bg-[#282522] text-[#a69f99] hover:text-white border border-[#4a443f]/50'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${opt.dotClass}`} />
                    <span>{opt.shortLabel}</span>
                    <span className="text-[10px] opacity-75">({count})</span>
                  </button>
                )
              })}
            </div>

            <div className="flex items-center gap-2">
              {canSeeMultipleDepartments && (
                <CustomSelect
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="bg-[#282522] border border-[#4a443f] rounded-full px-3.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#b99881]"
                >
                  <option value="ALL">Tüm Departmanlar</option>
                  {allowedDepartmentsForUser.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </CustomSelect>
              )}

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#8c857f] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Kişi veya konum ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-[#282522] border border-[#4a443f] focus:border-[#b99881] rounded-full pl-8 pr-3.5 py-1.5 text-xs text-white placeholder-[#8c857f] focus:outline-none w-44 sm:w-56"
                />
              </div>
            </div>
          </div>

          {/* Team Cards Grid */}
          {filteredUsers.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center justify-center">
              <Users className="w-10 h-10 text-[#8c857f] mx-auto mb-3 opacity-40" />
              <h4 className="text-sm font-semibold text-white">Kayıtlı ekip üyesi bulunamadı</h4>
              <p className="text-xs text-[#8c857f] mt-1 max-w-sm mx-auto">
                Henüz canlı durum kaydı veya seçili filtreye uygun ekip üyesi bulunmuyor.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredUsers.map((member) => {
                const rec = presenceMap[member.id] || {
                  userId: member.id,
                  status: 'OFISTE' as PresenceStatusType,
                  locationNote: '',
                  returnTime: '',
                  updatedAt: member.createdAt,
                  updatedBy: member.id,
                }
                const meta = getPresenceMeta(rec.status)
                const userAssets = assets.filter((a) => a.holderUserId === member.id)
                const canEditThisUser =
                  currentUser?.id === member.id || isManagerOrAdmin

                return (
                  <GlassCard
                    key={member.id}
                    className="team-user-card p-5 flex flex-col justify-between gap-4 transition-all"
                  >
                    <div className="space-y-3.5">
                      {/* Top Row: User Info + Status Pill */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative shrink-0">
                            <div className="w-12 h-12 rounded-full bg-[#24211f] border border-[#4a443f]/40 flex items-center justify-center text-sm font-bold text-[#b99881] overflow-hidden">
                              {member.avatarUrl ? (
                                <img
                                  src={member.avatarUrl}
                                  alt={member.fullName}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                member.fullName.slice(0, 2).toUpperCase()
                              )}
                            </div>
                            <span
                              className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-[#2b2724] ${meta.dotClass}`}
                            />
                          </div>

                          <div className="min-w-0">
                            <h4 className="text-sm font-bold text-white truncate">
                              {member.fullName}
                            </h4>
                            <p className="text-xs text-[#a69f99] truncate">
                              {member.department} • @{member.username}
                            </p>
                          </div>
                        </div>

                        <div
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold shrink-0 ${meta.bgClass} ${meta.borderClass} ${meta.colorClass}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClass}`} />
                          <span>{meta.shortLabel}</span>
                        </div>
                      </div>

                      {/* Location Note & Return Time (Katmansız) */}
                      {(rec.locationNote || rec.returnTime) ? (
                        <div className="space-y-1 text-xs pt-1">
                          {rec.locationNote && (
                            <div className="flex items-start gap-2 text-[#f3efe9]">
                              <MapPin className="w-3.5 h-3.5 text-[#b99881] shrink-0 mt-0.5" />
                              <span className="font-medium">{rec.locationNote}</span>
                            </div>
                          )}
                          {rec.returnTime && (
                            <div className="flex items-center gap-2 text-[#d6beae]">
                              <Clock className="w-3.5 h-3.5 text-[#dfb76c] shrink-0" />
                              <span>Tahmini Dönüş: <strong>{rec.returnTime}</strong></span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-[#8c857f] flex items-center gap-2 pt-1">
                          <MapPin className="w-3.5 h-3.5 text-[#8c857f] shrink-0" />
                          <span>{meta.description}</span>
                        </div>
                      )}

                      {/* Held Vehicles / Keys on this user */}
                      {userAssets.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#8c857f] block">
                            Üzerindeki Araç & Anahtarlar
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {userAssets.map((ua) => (
                              <span
                                key={ua.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#34302d] text-xs text-[#f3efe9]"
                              >
                                {ua.category === 'ARAC' ? (
                                  <Car className="w-3.5 h-3.5 text-[#dfb76c]" />
                                ) : (
                                  <Key className="w-3.5 h-3.5 text-[#dfb76c]" />
                                )}
                                <span className="font-semibold">{ua.name}</span>
                                <span className="text-[10px] text-[#d6beae]">({ua.codeOrPlate})</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Footer: Updated Time + Quick Update Button */}
                    <div className="pt-1 flex items-center justify-between text-[11px] text-[#8c857f]">
                      <span>
                        Son güncelleme: {formatTimeShort(rec.updatedAt) || 'Bugün'}
                      </span>
                      {canEditThisUser && (
                        <button
                          type="button"
                          onClick={() => handleOpenEditUserStatus(member)}
                          className="px-3 py-1 rounded-full bg-[#34302d] text-xs font-semibold text-[#b99881] hover:text-[#dfb76c] transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Durumu Güncelle</span>
                        </button>
                      )}
                    </div>
                  </GlassCard>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: ARAÇ ANAHTARI, PORTFÖY ANAHTARI & EKİPMAN ZİMMETİ           */}
      {/* =================================================================== */}
      {activeSubTab === 'assets' && (
        <div className="space-y-6">
          {/* Category Filter */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: 'ALL', label: `Tümü (${assets.length})` },
                {
                  id: 'ARAC',
                  label: `Şirket Araçları (${assets.filter((a) => a.category === 'ARAC').length})`,
                },
                {
                  id: 'PORTFOY_ANAHTARI',
                  label: `Portföy & Daire Anahtarları (${
                    assets.filter((a) => a.category === 'PORTFOY_ANAHTARI').length
                  })`,
                },
                {
                  id: 'EKIPMAN',
                  label: `Ofis Ekipmanları (${
                    assets.filter((a) => a.category === 'EKIPMAN').length
                  })`,
                },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setAssetCategoryFilter(cat.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                    assetCategoryFilter === cat.id
                      ? 'bg-[#b99881] text-white'
                      : 'bg-[#34302d] text-[#a69f99] hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {filteredAssets.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center justify-center space-y-3">
              <Key className="w-10 h-10 mx-auto text-[#8c857f] opacity-40" />
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-white">
                  Henüz tanımlanmış araç veya anahtar yok
                </h4>
                <p className="text-xs text-[#8c857f] max-w-md mx-auto">
                  Şirket araçlarını (plaka/anahtar), satılık/kiralık portföy veya örnek daire anahtarlarını ve ortak ekipmanları tanımlayarak kimin aldığını anlık takip edebilirsiniz.
                </p>
              </div>
              <div className="pt-1">
                <GlassButton
                  variant="gold"
                  size="sm"
                  icon={<Plus className="w-4 h-4" />}
                  className="rounded-full"
                  onClick={() => setIsAddAssetOpen(true)}
                >
                  İlk Araç veya Anahtarı Ekle
                </GlassButton>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredAssets.map((asset) => {
                const isTaken = Boolean(asset.holderUserId)
                const isHeldByMe = currentUser && asset.holderUserId === currentUser.id

                return (
                  <GlassCard
                    key={asset.id}
                    className="p-5 flex flex-col justify-between gap-4 hover:border-[#b99881]/35 transition-all"
                  >
                    <div className="space-y-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {asset.category === 'ARAC' ? (
                            <Car className="w-5 h-5 text-[#b99881] shrink-0" />
                          ) : (
                            <Key className="w-5 h-5 text-[#b99881] shrink-0" />
                          )}
                          <div className="min-w-0">
                            <h4 className="text-sm font-bold text-white truncate">
                              {asset.name}
                            </h4>
                            <p className="text-xs text-[#d6beae] font-mono">
                              {asset.codeOrPlate} • {ASSET_CATEGORY_LABELS[asset.category]}
                            </p>
                          </div>
                        </div>

                        <GlassBadge variant={isTaken ? 'warning' : 'success'}>
                          {isTaken ? 'Kullanımda' : 'Ofiste Müsait'}
                        </GlassBadge>
                      </div>

                      {isTaken ? (
                        <div className="space-y-1.5 text-xs pt-1">
                          <div className="flex items-center justify-between text-[#f3efe9]">
                            <span className="text-[#a69f99]">Teslim Alan:</span>
                            <span className="font-bold text-[#dfb76c]">{asset.holderUserName}</span>
                          </div>
                          {asset.destinationNote && (
                            <div className="flex items-center justify-between text-[#f3efe9]">
                              <span className="text-[#a69f99]">Gidilen Yer / Görev:</span>
                              <span className="font-medium truncate max-w-[180px]">
                                {asset.destinationNote}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center justify-between text-[#d6beae]">
                            <span className="text-[#a69f99]">Alış / Tahmini Dönüş:</span>
                            <span>
                              {formatTimeShort(asset.takenAt)}
                              {asset.expectedReturnTime ? ` → ${asset.expectedReturnTime}` : ''}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-[#a69f99] pt-1">
                          {asset.notes
                            ? asset.notes
                            : 'Anahtar şu an ofiste / anahtar dolabında teslim alınmaya hazır.'}
                        </div>
                      )}
                    </div>

                    <div className="pt-1 flex items-center justify-between gap-2">
                      {!isTaken ? (
                        <GlassButton
                          variant="gold"
                          size="sm"
                          icon={<Key className="w-3.5 h-3.5" />}
                          className="rounded-full flex-1"
                          onClick={() => {
                            setCheckoutTargetAsset(asset)
                            setCheckoutDestination('')
                            setCheckoutReturnTime('')
                            setCheckoutAutoStatus(
                              asset.category === 'ARAC' ? 'GOSTERIMDE' : 'GOSTERIMDE'
                            )
                            setCheckoutUpdateMyStatus(true)
                          }}
                        >
                          Anahtarı / Aracı Teslim Al
                        </GlassButton>
                      ) : (
                        <GlassButton
                          variant={isHeldByMe ? 'gold' : 'outline'}
                          size="sm"
                          icon={<RotateCcw className="w-3.5 h-3.5" />}
                          className="rounded-full flex-1"
                          onClick={() => teamOperationsStore.returnAsset(asset.id, currentUser)}
                        >
                          Ofise Teslim Et (Bırak)
                        </GlassButton>
                      )}

                      {isManagerOrAdmin && (
                        <button
                          type="button"
                          onClick={() => teamOperationsStore.deleteAsset(asset.id)}
                          className="p-2 rounded-full text-[#8c857f] hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Kaydı Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </GlassCard>
                )
              })}
            </div>
          )}

          {/* Asset History Logs */}
          {assetLogs.length > 0 && (
            <GlassCard className="p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <History className="w-4 h-4 text-[#b99881]" />
                <span>Son Anahtar & Araç Hareket Kayıtları</span>
              </div>
              <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                {assetLogs.slice(0, 20).map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-[#24211f]/80 border border-[#4a443f]/50 flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                          log.action === 'TESLIM_ALINDI'
                            ? 'bg-amber-500/15 text-[#dfb76c] border border-amber-500/30'
                            : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {log.action === 'TESLIM_ALINDI' ? 'TESLİM ALINDI' : 'OFİSE BIRAKILDI'}
                      </span>
                      <span className="font-bold text-white">{log.assetName}</span>
                      <span className="text-[#a69f99] font-mono">({log.assetCode})</span>
                    </div>
                    <div className="flex items-center gap-3 text-[#d6beae]">
                      <span>{log.userName}</span>
                      {log.destinationNote && (
                        <span className="text-[#a69f99]">• {log.destinationNote}</span>
                      )}
                      <span className="text-[#8c857f] font-mono">
                        {new Date(log.timestamp).toLocaleString('tr-TR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: İZİN & SAATLİK ÇIKIŞ SİSTEMİ                                 */}
      {/* =================================================================== */}
      {activeSubTab === 'leaves' && (
        <div className="space-y-4">
          {leaves.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center justify-center space-y-3">
              <Calendar className="w-10 h-10 text-[#8c857f] mx-auto opacity-40" />
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-white">
                  Henüz izin veya saatlik çıkış talebi bulunmuyor
                </h4>
                <p className="text-xs text-[#8c857f] max-w-md mx-auto">
                  Yıllık izin, mazeret izni, sağlık raporu veya gün içi saatlik dışarı çıkış taleplerini buradan oluşturabilir ve onay durumunu takip edebilirsiniz.
                </p>
              </div>
              <div className="pt-1">
                <GlassButton
                  variant="gold"
                  size="sm"
                  icon={<Plus className="w-4 h-4" />}
                  className="rounded-full"
                  onClick={() => setIsAddLeaveOpen(true)}
                >
                  Yeni İzin / Çıkış Talebi Oluştur
                </GlassButton>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {leaves.map((lv) => {
                const isPending = lv.status === 'BEKLEMEDE'
                const canDelete = currentUser?.id === lv.userId || isManagerOrAdmin

                return (
                  <GlassCard
                    key={lv.id}
                    className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-white">{lv.userName}</span>
                        <span className="text-xs text-[#a69f99]">• {lv.userDepartment}</span>
                        <GlassBadge
                          variant={
                            lv.status === 'ONAYLANDI'
                              ? 'success'
                              : lv.status === 'REDDEDILDI'
                              ? 'danger'
                              : 'warning'
                          }
                        >
                          {lv.status === 'ONAYLANDI'
                            ? 'Onaylandı'
                            : lv.status === 'REDDEDILDI'
                            ? 'Reddedildi'
                            : 'Onay Bekliyor'}
                        </GlassBadge>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#b99881]/15 text-[#dfb76c] border border-[#b99881]/30">
                          {LEAVE_TYPE_LABELS[lv.leaveType]}
                        </span>
                      </div>

                      <p className="text-xs text-[#f3efe9]">{lv.reason}</p>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-[#a69f99]">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-[#b99881]" />
                          {lv.startDate}
                          {lv.endDate && lv.endDate !== lv.startDate ? ` → ${lv.endDate}` : ''}
                        </span>
                        {(lv.startTime || lv.endTime) && (
                          <span className="flex items-center gap-1 text-[#dfb76c]">
                            <Clock className="w-3.5 h-3.5" />
                            Saat: {lv.startTime || '--:--'} - {lv.endTime || '--:--'}
                          </span>
                        )}
                        {lv.reviewedBy && (
                          <span className="text-[#8c857f]">
                            • Karar veren: {lv.reviewedBy}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isPending && isManagerOrAdmin && currentUser && (
                        <>
                          <GlassButton
                            variant="gold"
                            size="sm"
                            icon={<Check className="w-3.5 h-3.5" />}
                            className="rounded-full"
                            onClick={() =>
                              teamOperationsStore.decideLeaveRequest(
                                lv.id,
                                'ONAYLANDI',
                                currentUser
                              )
                            }
                          >
                            Onayla
                          </GlassButton>
                          <GlassButton
                            variant="danger"
                            size="sm"
                            icon={<X className="w-3.5 h-3.5" />}
                            className="rounded-full"
                            onClick={() =>
                              teamOperationsStore.decideLeaveRequest(
                                lv.id,
                                'REDDEDILDI',
                                currentUser
                              )
                            }
                          >
                            Reddet
                          </GlassButton>
                        </>
                      )}

                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => teamOperationsStore.deleteLeaveRequest(lv.id)}
                          className="p-2 rounded-xl text-[#8c857f] hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Talebi Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </GlassCard>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 1: KİŞİ DURUMU GÜNCELLEME                                     */}
      {/* =================================================================== */}
      <GlassModal
        isOpen={Boolean(editingUser)}
        onClose={() => setEditingUser(null)}
        title={
          editingUser
            ? `${editingUser.fullName} — Canlı Durum Güncelle`
            : 'Canlı Durum Güncelle'
        }
      >
        <form onSubmit={handleSaveUserStatus} className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PRESENCE_STATUS_OPTIONS.map((opt) => {
              const selected = editStatus === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setEditStatus(opt.id)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer text-left ${
                    selected
                      ? `${opt.bgClass} ${opt.borderClass} ${opt.colorClass}`
                      : 'bg-[#1c1a18] border-[#4a443f]/60 text-[#c4bcb5] hover:text-white'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${opt.dotClass}`} />
                  <span className="truncate">{opt.shortLabel}</span>
                </button>
              )
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-8">
              <label className="text-xs font-semibold text-[#d6beae] block mb-1.5">
                Konum / Görev Detayı (Opsiyonel)
              </label>
              <input
                type="text"
                placeholder="Örn: Vadi Konakları gösterimi, Kadıköy Tapu..."
                value={editLocationNote}
                onChange={(e) => setEditLocationNote(e.target.value)}
                className="w-full bg-[#1c1a18] border border-[#4a443f] focus:border-[#b99881] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#8c857f] focus:outline-none"
              />
            </div>

            <div className="sm:col-span-4">
              <label className="text-xs font-semibold text-[#d6beae] block mb-1.5">
                Tahmini Dönüş Saati
              </label>
              <input
                type="time"
                value={editReturnTime}
                onChange={(e) => setEditReturnTime(e.target.value)}
                className="w-full bg-[#1c1a18] border border-[#4a443f] focus:border-[#b99881] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <GlassButton
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setEditingUser(null)}
            >
              İptal
            </GlassButton>
            <GlassButton variant="gold" size="sm" type="submit">
              Durumu Kaydet
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      {/* =================================================================== */}
      {/* MODAL 2: YENİ ARAÇ / PORTFÖY ANAHTARI / EKİPMAN TANIMLA             */}
      {/* =================================================================== */}
      <GlassModal
        isOpen={isAddAssetOpen}
        onClose={() => setIsAddAssetOpen(false)}
        title="Yeni Araç, Portföy Anahtarı veya Ekipman Tanımla"
      >
        <form onSubmit={handleCreateAsset} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[#d6beae] block mb-1.5">
              Kategori *
            </label>
            <CustomSelect
              value={newAssetCategory}
              onChange={(e) => setNewAssetCategory(e.target.value as SharedAssetCategory)}
              className="w-full bg-[#1c1a18] border border-[#4a443f] focus:border-[#b99881] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
            >
              <option value="ARAC">🚗 Şirket Aracı & Anahtarı</option>
              <option value="PORTFOY_ANAHTARI">🔑 Portföy / Numune Daire Anahtarı</option>
              <option value="EKIPMAN">🧰 Ortak Ofis / Saha Ekipmanı (POS, Lazer Metre vb.)</option>
            </CustomSelect>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-7">
              <label className="text-xs font-semibold text-[#d6beae] block mb-1.5">
                Araç / Anahtar / Ekipman Adı *
              </label>
              <input
                type="text"
                required
                placeholder="Örn: Beyaz Megane Şirket Aracı / Vadi B-14 Anahtarı"
                value={newAssetName}
                onChange={(e) => setNewAssetName(e.target.value)}
                className="w-full bg-[#1c1a18] border border-[#4a443f] focus:border-[#b99881] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#8c857f] focus:outline-none"
              />
            </div>

            <div className="sm:col-span-5">
              <label className="text-xs font-semibold text-[#d6beae] block mb-1.5">
                Plaka / Anahtar Kodu *
              </label>
              <input
                type="text"
                required
                placeholder="Örn: 34 DMR 01 veya Dolap #4"
                value={newAssetCode}
                onChange={(e) => setNewAssetCode(e.target.value)}
                className="w-full bg-[#1c1a18] border border-[#4a443f] focus:border-[#b99881] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#8c857f] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#d6beae] block mb-1.5">
              Açıklama / Bulunduğu Yer Notu (Opsiyonel)
            </label>
            <input
              type="text"
              placeholder="Örn: Danışma anahtar dolabı 2. sıra"
              value={newAssetNotes}
              onChange={(e) => setNewAssetNotes(e.target.value)}
              className="w-full bg-[#1c1a18] border border-[#4a443f] focus:border-[#b99881] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#8c857f] focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <GlassButton
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setIsAddAssetOpen(false)}
            >
              İptal
            </GlassButton>
            <GlassButton variant="gold" size="sm" type="submit">
              Kaydet
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      {/* =================================================================== */}
      {/* MODAL 3: ARAÇ / ANAHTAR TESLİM AL (ZİMMETLE)                        */}
      {/* =================================================================== */}
      <GlassModal
        isOpen={Boolean(checkoutTargetAsset)}
        onClose={() => setCheckoutTargetAsset(null)}
        title={
          checkoutTargetAsset
            ? `${checkoutTargetAsset.name} (${checkoutTargetAsset.codeOrPlate}) — Teslim Al`
            : 'Teslim Al'
        }
      >
        <form onSubmit={handleConfirmCheckoutAsset} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-8">
              <label className="text-xs font-semibold text-[#d6beae] block mb-1.5">
                Nereye Gidiliyor / Kullanım Amacı
              </label>
              <input
                type="text"
                placeholder="Örn: Müşteri gösterimi, Tapu dairesi, Şantiye..."
                value={checkoutDestination}
                onChange={(e) => setCheckoutDestination(e.target.value)}
                className="w-full bg-[#1c1a18] border border-[#4a443f] focus:border-[#b99881] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#8c857f] focus:outline-none"
              />
            </div>

            <div className="sm:col-span-4">
              <label className="text-xs font-semibold text-[#d6beae] block mb-1.5">
                Tahmini Dönüş Saati
              </label>
              <input
                type="time"
                value={checkoutReturnTime}
                onChange={(e) => setCheckoutReturnTime(e.target.value)}
                className="w-full bg-[#1c1a18] border border-[#4a443f] focus:border-[#b99881] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
              />
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#24211f] border border-[#4a443f]/70 space-y-2.5">
            <label className="flex items-center gap-2 text-xs font-semibold text-white cursor-pointer">
              <input
                type="checkbox"
                checked={checkoutUpdateMyStatus}
                onChange={(e) => setCheckoutUpdateMyStatus(e.target.checked)}
                className="rounded accent-[#b99881]"
              />
              <span>Aynı zamanda "Kim Nerede?" durumumu da otomatik güncelle</span>
            </label>

            {checkoutUpdateMyStatus && (
              <div className="grid grid-cols-3 gap-2 pt-1">
                {(['GOSTERIMDE', 'TAPUDA', 'SANTIYEDE'] as PresenceStatusType[]).map((st) => {
                  const m = getPresenceMeta(st)
                  const active = checkoutAutoStatus === st
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setCheckoutAutoStatus(st)}
                      className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                        active
                          ? `${m.bgClass} ${m.borderClass} ${m.colorClass}`
                          : 'bg-[#1c1a18] border-[#4a443f]/60 text-[#a69f99]'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${m.dotClass}`} />
                      <span className="truncate">{m.shortLabel}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <GlassButton
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setCheckoutTargetAsset(null)}
            >
              İptal
            </GlassButton>
            <GlassButton variant="gold" size="sm" type="submit">
              Üzerime Al
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      {/* =================================================================== */}
      {/* MODAL 4: YENİ İZİN / SAATLİK ÇIKIŞ TALEBİ                           */}
      {/* =================================================================== */}
      <GlassModal
        isOpen={isAddLeaveOpen}
        onClose={() => setIsAddLeaveOpen(false)}
        title="İzin veya Saatlik Çıkış Talebi Oluştur"
      >
        <form onSubmit={handleCreateLeave} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[#d6beae] block mb-1.5">
              İzin / Çıkış Türü *
            </label>
            <CustomSelect
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value as LeaveType)}
              className="w-full bg-[#1c1a18] border border-[#4a443f] focus:border-[#b99881] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
            >
              <option value="SAATLIK_CIKIS">Saatlik Çıkış / Gün İçi İzin</option>
              <option value="YILLIK_IZIN">Yıllık İzin</option>
              <option value="MAZERET_IZNI">Mazeret İzni</option>
              <option value="RAPOR">Sağlık Raporu</option>
            </CustomSelect>
          </div>

          {leaveType === 'SAATLIK_CIKIS' ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-[#d6beae] block mb-1.5">
                  Tarih *
                </label>
                <input
                  type="date"
                  required
                  value={leaveStartDate}
                  onChange={(e) => setLeaveStartDate(e.target.value)}
                  className="w-full bg-[#1c1a18] border border-[#4a443f] focus:border-[#b99881] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#d6beae] block mb-1.5">
                  Çıkış Saati *
                </label>
                <input
                  type="time"
                  required
                  value={leaveStartTime}
                  onChange={(e) => setLeaveStartTime(e.target.value)}
                  className="w-full bg-[#1c1a18] border border-[#4a443f] focus:border-[#b99881] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#d6beae] block mb-1.5">
                  Dönüş Saati *
                </label>
                <input
                  type="time"
                  required
                  value={leaveEndTime}
                  onChange={(e) => setLeaveEndTime(e.target.value)}
                  className="w-full bg-[#1c1a18] border border-[#4a443f] focus:border-[#b99881] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[#d6beae] block mb-1.5">
                  Başlangıç Tarihi *
                </label>
                <input
                  type="date"
                  required
                  value={leaveStartDate}
                  onChange={(e) => setLeaveStartDate(e.target.value)}
                  className="w-full bg-[#1c1a18] border border-[#4a443f] focus:border-[#b99881] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#d6beae] block mb-1.5">
                  Bitiş Tarihi *
                </label>
                <input
                  type="date"
                  required
                  value={leaveEndDate}
                  onChange={(e) => setLeaveEndDate(e.target.value)}
                  className="w-full bg-[#1c1a18] border border-[#4a443f] focus:border-[#b99881] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-[#d6beae] block mb-1.5">
              Açıklama / Mazeret Notu *
            </label>
            <input
              type="text"
              required
              placeholder="Örn: Banka işlemi için 2 saatlik çıkış / Yıllık izin talebi..."
              value={leaveReason}
              onChange={(e) => setLeaveReason(e.target.value)}
              className="w-full bg-[#1c1a18] border border-[#4a443f] focus:border-[#b99881] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#8c857f] focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <GlassButton
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setIsAddLeaveOpen(false)}
            >
              İptal
            </GlassButton>
            <GlassButton variant="gold" size="sm" type="submit">
              Talebi Gönder
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      {/* =================================================================== */}
      {/* MODAL 5: EKİP ÜYESİ EKLE (Ad Soyad + Departman + Otomatik 6 Haneli Şifre) */}
      {/* =================================================================== */}
      <GlassModal
        isOpen={isAddMemberOpen}
        onClose={() => setIsAddMemberOpen(false)}
        title="Ekip Üyesi Ekle"
        maxWidth="md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!newMemberFullName.trim()) return
            const initialPassword = generateInitialPassword()
            const res = userStore.addMember({
              fullName: newMemberFullName.trim(),
              department: newMemberDepartment,
              departments: [newMemberDepartment],
              role: newMemberDepartment === 'Yönetim' ? 'MANAGER' : 'REPRESENTATIVE',
              scope: 'DEPARTMENT',
              initialPassword,
            })
            teamOperationsStore.updateUserPresence(res.user.id, {
              status: 'OFISTE',
              locationNote: '',
              returnTime: '',
              updatedBy: currentUser?.id || res.user.id,
            })
            setCreatedMemberBanner({
              fullName: res.user.fullName,
              username: res.user.username,
              password: res.generatedPassword,
              department: res.user.department,
            })
            setNewMemberFullName('')
            setIsAddMemberOpen(false)
          }}
          className="space-y-4"
        >
          <div>
            <label className="text-xs font-semibold text-[#d6beae] block mb-1.5">
              Adı Soyadı *
            </label>
            <input
              type="text"
              required
              placeholder="Örn: Ayşe Demir"
              value={newMemberFullName}
              onChange={(e) => setNewMemberFullName(e.target.value)}
              className="w-full bg-[#1c1a18] border border-[#4a443f] focus:border-[#b99881] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#8c857f] focus:outline-none"
            />
            {newMemberFullName.trim() && (
              <span className="text-[11px] text-[#b99881] mt-1.5 block font-mono">
                Kullanıcı Adı: @{generateUsername(newMemberFullName, users)}
              </span>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-[#d6beae] block mb-1.5">
              Departman *
            </label>
            <CustomSelect
              value={newMemberDepartment}
              onChange={(e) => setNewMemberDepartment(e.target.value as Department)}
              className="w-full bg-[#1c1a18] border border-[#4a443f] focus:border-[#b99881] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none cursor-pointer"
            >
              {CANONICAL_DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </CustomSelect>
          </div>

          <p className="text-[11px] text-[#8c857f]">
            Otomatik olarak 6 haneli yalnızca sayıdan oluşan şifre tanımlanır. Kullanıcı adı ilk başta yalnızca ad olarak verilir; kullanıcı dilerse sonradan Ayarlar menüsünden değiştirebilir.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <GlassButton
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setIsAddMemberOpen(false)}
            >
              Vazgeç
            </GlassButton>
            <GlassButton variant="gold" size="sm" type="submit">
              Ekip Üyesi Ekle
            </GlassButton>
          </div>
        </form>
      </GlassModal>
    </div>
  )
}
