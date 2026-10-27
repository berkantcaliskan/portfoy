import React, { useState, useEffect } from 'react'
import {
  Shield,
  Users,
  Check,
  Lock,
  DownloadCloud,
  UserPlus,
  Trash2,
  RefreshCw,
  Megaphone,
  Building2,
  TurkishLira,
  Percent,
  Wallet,
  Share2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import {
  userStore,
  AppUser,
  Department,
  UserRole,
  AccessScope,
  UserPermissions,
} from '@/services/userStore'
import { CANONICAL_DEPARTMENTS } from '@/types/department'
import { permissionService } from '@/services/permissionService'

interface PermissionItemDef {
  key: keyof UserPermissions
  title: string
  desc: string
  category: 'Pazarlama & Veri' | 'Müşteri & CRM' | 'Satış & Muhasebe' | 'Yönetim & Ortak'
  icon: React.ElementType
  lockedForCallCenter?: boolean
}

const PERMISSION_ITEMS: PermissionItemDef[] = [
  {
    key: 'canPullLeads',
    title: 'Verileri Al (Meta & Bulut Veri Çekme)',
    desc: 'Müşteri İlişkileri kullanamaz. Yalnızca Yönetim ve yetki verilen Pazarlama çalışanları görebilir.',
    category: 'Pazarlama & Veri',
    icon: DownloadCloud,
    lockedForCallCenter: true,
  },
  {
    key: 'canManageMetaConfig',
    title: 'Meta API & Reklam Ayarlarını Yönetme',
    desc: 'Meta Pixel/Dataset, CAPI erişim kodları ve reklam bütçe kurallarını düzenleyebilir.',
    category: 'Pazarlama & Veri',
    icon: Megaphone,
  },
  {
    key: 'canAddCustomer',
    title: 'Yeni Müşteri Ekleme',
    desc: 'CRM havuzuna manuel yeni müşteri kaydı açabilir.',
    category: 'Müşteri & CRM',
    icon: UserPlus,
  },
  {
    key: 'canChangeStage',
    title: 'Bilgi & Meta Aşaması Güncelleme',
    desc: 'Müşterinin Call Center Bilgi durumunu ve Meta dönüşüm aşamasını değiştirebilir.',
    category: 'Müşteri & CRM',
    icon: RefreshCw,
  },
  {
    key: 'canAssignConsultant',
    title: 'Danışman Atama, Eşit Dağıtım & Satışa Devir',
    desc: 'Müşteriyi danışmana atayabilir, çağrı merkezi eşit dağıtımı yapabilir ve satışa devredebilir.',
    category: 'Müşteri & CRM',
    icon: Users,
  },
  {
    key: 'canDeleteCustomer',
    title: 'Müşteri Kaydı Silme',
    desc: 'Müşteri kartını kalıcı olarak sistemden silebilir.',
    category: 'Müşteri & CRM',
    icon: Trash2,
  },
  {
    key: 'canChangeFlatStatus',
    title: 'Daire Durumu (Satıldı / Opsiyon) Değiştirme',
    desc: 'Projelerdeki dairelerin opsiyon, rezerve ve satış durumlarını güncelleyebilir.',
    category: 'Satış & Muhasebe',
    icon: Building2,
  },
  {
    key: 'canEditProjectPrice',
    title: 'Proje & Daire Fiyatlarını Düzenleme',
    desc: 'Proje liste fiyatlarını ve daire bedellerini değiştirebilir.',
    category: 'Satış & Muhasebe',
    icon: TurkishLira,
  },
  {
    key: 'canApproveDiscounts',
    title: 'İskonto & Özel Fiyat Onaylama',
    desc: 'Satış temsilcilerinin talep ettiği özel indirimleri onaylayabilir.',
    category: 'Satış & Muhasebe',
    icon: Percent,
  },
  {
    key: 'canRefundDeposit',
    title: 'Kapora İadesi & Tahsilat İşlemleri',
    desc: 'Muhasebe tahsilat kaydı ve kapora iade işlemlerini yürütebilir.',
    category: 'Satış & Muhasebe',
    icon: Wallet,
  },
  {
    key: 'canReshareFiles',
    title: 'Dosya Yükleme & Paylaşma',
    desc: 'Paylaşılanlar alanında dosya yükleyebilir ve diğer departmanlara iletebilir.',
    category: 'Yönetim & Ortak',
    icon: Share2,
  },
  {
    key: 'canManageTeam',
    title: 'Yetkili (Çalışan & Yetki Yönetimi)',
    desc: 'Ayarlar > Yetkiler bölümüne erişebilir ve çalışanların yetkilerini düzenleyebilir.',
    category: 'Yönetim & Ortak',
    icon: Shield,
  },
]

export const PermissionsMatrixPanel: React.FC = () => {
  const [users, setUsers] = useState<AppUser[]>(() => userStore.getAllUsers())
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => userStore.getCurrentUser())
  const [deptFilter, setDeptFilter] = useState<string>('ALL')
  const [selectedUserId, setSelectedUserId] = useState<string>(() => {
    const all = userStore.getAllUsers()
    const nonAdmin = all.find((u) => u.role !== 'ADMIN')
    return (nonAdmin || all[0])?.id || ''
  })
  const [savedToast, setSavedToast] = useState<string | null>(null)

  useEffect(() => {
    const unsub = userStore.subscribe(() => {
      setUsers(userStore.getAllUsers())
      setCurrentUser(userStore.getCurrentUser())
    })
    return unsub
  }, [])

  const canManage = permissionService.canManagePermissions(currentUser)

  const filteredUsers = users.filter((u) => {
    if (deptFilter === 'ALL') return true
    return u.department === deptFilter || u.departments?.includes(deptFilter as Department)
  })

  const selectedUser =
    users.find((u) => u.id === selectedUserId) || filteredUsers[0] || users[0] || null

  const showSavedFeedback = (msg: string) => {
    setSavedToast(msg)
    setTimeout(() => setSavedToast(null), 2200)
  }

  const handleTogglePermission = (key: keyof UserPermissions) => {
    if (!selectedUser || !canManage) return

    const isPureCallCenter =
      selectedUser.department === 'Müşteri İlişkileri' &&
      !selectedUser.departments?.includes('Pazarlama') &&
      !selectedUser.departments?.includes('Yönetim') &&
      selectedUser.role !== 'ADMIN'

    if (key === 'canPullLeads' && isPureCallCenter) {
      return
    }

    const currentVal = Boolean(selectedUser.permissions?.[key])
    const nextVal = !currentVal

    const updatedPermissions: UserPermissions = {
      ...selectedUser.permissions,
      [key]: nextVal,
    }

    userStore.updateUser(selectedUser.id, {
      permissions: updatedPermissions,
      ...(key === 'canManageTeam' ? { isManager: nextVal || selectedUser.role === 'ADMIN' } : {}),
    })
    showSavedFeedback(`${selectedUser.fullName} yetkisi güncellendi`)
  }

  const handleUpdateUserMeta = (updates: Partial<AppUser>) => {
    if (!selectedUser || !canManage) return

    const nextDept = updates.department || selectedUser.department
    const nextDepts = updates.departments || selectedUser.departments || [nextDept]
    const nextPerms = { ...selectedUser.permissions, ...(updates.permissions || {}) }

    if (
      nextDept === 'Müşteri İlişkileri' &&
      !nextDepts.includes('Pazarlama') &&
      !nextDepts.includes('Yönetim') &&
      (updates.role || selectedUser.role) !== 'ADMIN'
    ) {
      nextPerms.canPullLeads = false
    }

    userStore.updateUser(selectedUser.id, {
      ...updates,
      permissions: nextPerms,
    })
    showSavedFeedback(`${selectedUser.fullName} profili güncellendi`)
  }

  const handleToggleDepartmentAccess = (dept: Department) => {
    if (!selectedUser || !canManage) return
    const currentDepts = selectedUser.departments || [selectedUser.department]
    let nextDepts: Department[]
    if (currentDepts.includes(dept)) {
      if (currentDepts.length <= 1) return
      nextDepts = currentDepts.filter((d) => d !== dept)
    } else {
      nextDepts = [...currentDepts, dept]
    }
    const nextPrimary = nextDepts.includes(selectedUser.department)
      ? selectedUser.department
      : nextDepts[0]
    handleUpdateUserMeta({ department: nextPrimary, departments: nextDepts })
  }

  if (!canManage) {
    return (
      <div className="p-6 rounded-2xl bg-[#24211f]/60 border border-[#4a443f] text-center space-y-2">
        <Lock className="w-6 h-6 text-[#b99881] mx-auto" />
        <div className="text-xs font-bold text-white">Yetki Yönetimi Kısıtlı</div>
        <p className="text-[11px] text-[#a69f99]">
          Bu bölümü yalnızca Yönetim departmanı ve yetkilendirilmiş yöneticiler düzenleyebilir.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#b99881]" />
            <span>Departman ve Çalışan Yetkileri</span>
          </h3>
          <p className="text-xs text-[#a69f99] mt-0.5">
            Hangi departmandaki çalışanın hangi işlemleri yapabileceğini ve neleri görebileceğini belirleyin.
          </p>
        </div>

        {savedToast && (
          <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{savedToast}</span>
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setDeptFilter('ALL')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
            deptFilter === 'ALL'
              ? 'bg-[#b99881] text-white'
              : 'bg-[#24211f] text-[#a69f99] hover:text-white border border-[#4a443f]'
          }`}
        >
          Tümü ({users.length})
        </button>
        {CANONICAL_DEPARTMENTS.map((dept) => {
          const count = users.filter(
            (u) => u.department === dept || u.departments?.includes(dept)
          ).length
          return (
            <button
              key={dept}
              type="button"
              onClick={() => setDeptFilter(dept)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                deptFilter === dept
                  ? 'bg-[#b99881] text-white'
                  : 'bg-[#24211f] text-[#a69f99] hover:text-white border border-[#4a443f]'
              }`}
            >
              {dept} ({count})
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {filteredUsers.map((u) => {
          const isSelected = selectedUser?.id === u.id
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => setSelectedUserId(u.id)}
              className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                isSelected
                  ? 'border-[#b99881] bg-[#b99881]/15 shadow-sm'
                  : 'border-[#4a443f]/60 bg-[#24211f]/50 hover:border-[#b99881]/40'
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-[#b99881]/25 border border-[#b99881]/40 flex items-center justify-center text-xs font-bold text-white shrink-0">
                {u.fullName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-white truncate flex items-center gap-1">
                  <span className="truncate">{u.fullName}</span>
                  {(u.role === 'ADMIN' || u.isManager) && (
                    <span title="Yetkili / Yönetici">
                      <Shield className="w-3 h-3 text-[#b99881] shrink-0" />
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-[#8c857f] truncate">
                  {u.department} • @{u.username}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {selectedUser && (
        <div className="p-4 rounded-2xl bg-[#24211f]/70 border border-[#4a443f] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#4a443f]/60">
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>{selectedUser.fullName}</span>
                <span className="text-[11px] font-mono text-[#b99881]">@{selectedUser.username}</span>
                {selectedUser.role === 'ADMIN' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    Tam Yetkili (Admin)
                  </span>
                )}
              </div>
              <div className="text-[11px] text-[#8c857f] mt-0.5">
                Ana Departman: <strong className="text-[#d6beae]">{selectedUser.department}</strong>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedUser.department}
                onChange={(e) =>
                  handleUpdateUserMeta({ department: e.target.value as Department })
                }
                className="px-3 py-1.5 rounded-full bg-[#1e1c1a] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881] cursor-pointer"
                title="Ana Departman"
              >
                {CANONICAL_DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <select
                value={selectedUser.scope}
                onChange={(e) =>
                  handleUpdateUserMeta({ scope: e.target.value as AccessScope })
                }
                className="px-3 py-1.5 rounded-full bg-[#1e1c1a] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881] cursor-pointer"
                title="Müşteri Kayıtlarını Görme Kapsamı"
              >
                <option value="ASSIGNED_ONLY">Sadece Kendine Atananları Görsün</option>
                <option value="DEPARTMENT">Departmanındaki Kayıtları Görsün</option>
                <option value="ALL">Tüm Şirket Kayıtlarını Görsün</option>
              </select>

              <select
                value={selectedUser.role}
                onChange={(e) => {
                  const newRole = e.target.value as UserRole
                  handleUpdateUserMeta({
                    role: newRole,
                    isManager: newRole === 'ADMIN' || newRole === 'MANAGER',
                  })
                }}
                className="px-3 py-1.5 rounded-full bg-[#1e1c1a] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881] cursor-pointer"
                title="Kullanıcı Rolü"
              >
                <option value="REPRESENTATIVE">Çalışan / Danışman</option>
                <option value="SPECIALIST">Uzman</option>
                <option value="MANAGER">Departman Yetkilisi</option>
                <option value="ADMIN">Yönetim (Admin)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="text-[11px] font-bold text-[#d6beae]">
              Erişebileceği Çalışma Alanları (Departmanlar)
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CANONICAL_DEPARTMENTS.map((dept) => {
                const hasDept =
                  selectedUser.role === 'ADMIN' ||
                  selectedUser.department === dept ||
                  Boolean(selectedUser.departments?.includes(dept))
                return (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => handleToggleDepartmentAccess(dept)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer flex items-center gap-1.5 ${
                      hasDept
                        ? 'bg-[#b99881]/20 text-white border-[#b99881]'
                        : 'bg-[#1e1c1a] text-[#8c857f] border-[#4a443f] hover:text-white'
                    }`}
                  >
                    {hasDept && <Check className="w-3 h-3 text-[#b99881]" />}
                    <span>{dept}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {PERMISSION_ITEMS.map((item) => {
              const Icon = item.icon
              const isPureCallCenter =
                selectedUser.department === 'Müşteri İlişkileri' &&
                !selectedUser.departments?.includes('Pazarlama') &&
                !selectedUser.departments?.includes('Yönetim') &&
                selectedUser.role !== 'ADMIN'

              const isLocked = Boolean(item.lockedForCallCenter && isPureCallCenter)
              const isEnabled = isLocked
                ? false
                : selectedUser.role === 'ADMIN'
                ? true
                : Boolean(selectedUser.permissions?.[item.key])

              return (
                <div
                  key={item.key}
                  onClick={() => !isLocked && handleTogglePermission(item.key)}
                  className={`p-3 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                    isLocked
                      ? 'bg-[#1e1c1a]/40 border-[#4a443f]/40 opacity-60 cursor-not-allowed'
                      : isEnabled
                      ? 'bg-[#b99881]/10 border-[#b99881]/50 cursor-pointer'
                      : 'bg-[#1e1c1a]/70 border-[#4a443f]/70 hover:border-[#b99881]/40 cursor-pointer'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        isEnabled
                          ? 'bg-[#b99881]/25 text-[#b99881]'
                          : 'bg-white/5 text-[#8c857f]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white leading-snug flex items-center gap-1.5">
                        <span>{item.title}</span>
                        {isLocked && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30 font-semibold">
                            Müşteri İlişkilerinde Kapalı
                          </span>
                        )}
                      </div>
                      <p className="text-[10.5px] text-[#8c857f] leading-relaxed mt-0.5">
                        {item.desc}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isLocked}
                    className={`w-10 h-5 rounded-full transition-colors relative shrink-0 mt-1 ${
                      isEnabled ? 'bg-[#b99881]' : 'bg-[#4a443f]'
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full bg-white transition-transform absolute top-[3px] ${
                        isEnabled ? 'left-[22px]' : 'left-[3px]'
                      }`}
                    />
                  </button>
                </div>
              )
            })}
          </div>

          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center gap-2 text-[11px] text-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Bilgi:</strong> Müşteri İlişkileri departmanı çalışanları veri çekme (Verileri Al) işlemini yapamaz. Pazarlama departmanında ise yalnızca yukarıdan <strong>"Verileri Al"</strong> yetkisi açılan çalışanlar veri çekebilir.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
