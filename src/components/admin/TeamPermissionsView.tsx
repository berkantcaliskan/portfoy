import React, { useState, useEffect } from 'react'
import {
  Users,
  Shield,
  Plus,
  KeyRound,
  Trash2,
  Edit2,
  Check,
  X,
  Layers,
  CheckCircle2,
  Lock,
} from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlassButton } from '@/components/ui/GlassButton'
import { GlassBadge } from '@/components/ui/GlassBadge'
import { GlassModal } from '@/components/ui/GlassModal'
import {
  userStore,
  AppUser,
  Department,
  UserRole,
  AccessScope,
  UserPermissions,
  generateInitialPassword,
  generateUsername,
} from '@/services/userStore'
import { CANONICAL_DEPARTMENTS } from '@/types/department'

export const TeamPermissionsView: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(userStore.getCurrentUser())
  const [users, setUsers] = useState<AppUser[]>(userStore.getAllUsers())
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [selectedUserToEdit, setSelectedUserToEdit] = useState<AppUser | null>(null)
  const [createdInfo, setCreatedInfo] = useState<{ username: string; pass: string } | null>(null)

  // Add Form
  const [fullName, setFullName] = useState('')
  const [department, setDepartment] = useState<Department>('Satış')
  const [selectedDepts, setSelectedDepts] = useState<Department[]>(['Satış'])
  const [role, setRole] = useState<UserRole>('REPRESENTATIVE')
  const [scope, setScope] = useState<AccessScope>('ASSIGNED_ONLY')
  const [email, setEmail] = useState('')
  const [permissions, setPermissions] = useState<UserPermissions>({
    canEditProjectPrice: false,
    canChangeFlatStatus: true,
    canApproveDiscounts: false,
    canRefundDeposit: false,
    canManageTeam: false,
    canReshareFiles: true,
  })

  useEffect(() => {
    const unsub = userStore.subscribe(() => {
      setUsers(userStore.getAllUsers())
      setCurrentUser(userStore.getCurrentUser())
    })
    return () => unsub()
  }, [])

  const handleDeptCheckbox = (dept: Department) => {
    if (selectedDepts.includes(dept)) {
      if (selectedDepts.length > 1) {
        setSelectedDepts(selectedDepts.filter((d) => d !== dept))
      }
    } else {
      setSelectedDepts([...selectedDepts, dept])
    }
  }

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) return

    const initialPassword = generateInitialPassword()
    const res = userStore.addMember({
      fullName: fullName.trim(),
      department,
      departments: [department],
      role: department === 'Yönetim' ? 'MANAGER' : 'REPRESENTATIVE',
      scope: 'DEPARTMENT',
      initialPassword,
    })

    setCreatedInfo({ username: res.user.username, pass: res.generatedPassword })
    setIsAddModalOpen(false)
    setFullName('')
    setEmail('')
  }

  const handleOpenEdit = (user: AppUser) => {
    setSelectedUserToEdit(user)
    setDepartment(user.department)
    setSelectedDepts(user.departments || [user.department])
    setRole(user.role)
    setScope(user.scope)
    setPermissions(user.permissions || {})
  }

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUserToEdit) return

    userStore.updateUser(selectedUserToEdit.id, {
      department,
      departments: selectedDepts,
      role,
      scope,
      permissions,
    })

    setSelectedUserToEdit(null)
  }

  const handleDelete = (userId: string) => {
    if (!window.confirm('Bu kullanıcıyı sistemden silmek istediğinize emin misiniz?')) return
    const res = userStore.deleteUser(userId)
    if (!res.success) {
      alert(res.error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-[#b99881]" />
            <h2 className="text-2xl font-bold text-white tracking-wide">
              Ekip ve Yetkiler
            </h2>
          </div>
          <p className="text-xs text-[#a69f99] mt-1">
            5 kurumsal departman, çoklu çalışma alanı atamaları, veri görme derinliği (scope) ve operasyonel yetkiler.
          </p>
        </div>

        <GlassButton
          variant="gold"
          size="sm"
          icon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => {
            setSelectedDepts(['Satış'])
            setDepartment('Satış')
            setIsAddModalOpen(true)
          }}
          className="rounded-full px-4 text-xs font-semibold"
        >
          Ekip Üyesi Ekle
        </GlassButton>
      </div>

      {/* Created Member Alert */}
      {createdInfo && (
        <div className="p-4 rounded-[16px] bg-emerald-500/10 border border-emerald-500/30 text-xs text-[#f3efe9] flex items-center justify-between">
          <div>
            <div className="font-bold text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Ekip üyesi başarıyla oluşturuldu!
            </div>
            <div className="text-[11px] text-[#a69f99] mt-1">
              Kullanıcı Adı: <span className="text-white font-mono font-bold">{createdInfo.username}</span> • 6 Haneli Şifre: <span className="text-amber-300 font-mono font-bold tracking-wider">{createdInfo.pass}</span>
            </div>
          </div>
          <button
            onClick={() => setCreatedInfo(null)}
            className="text-[#a69f99] hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Kullanıcılar Listesi */}
      <GlassCard className="p-5 bg-[#282522] border-[#4a443f]">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-[#4a443f] text-[#8c857f] text-[11px]">
                <th className="py-2.5 px-3">Ad Soyad & Kullanıcı Adı</th>
                <th className="py-2.5 px-3">Aktif Çalışma Alanı</th>
                <th className="py-2.5 px-3">Yetkili Departmanlar</th>
                <th className="py-2.5 px-3">Rol</th>
                <th className="py-2.5 px-3">Kayıt Görme (Scope)</th>
                <th className="py-2.5 px-3">Özel Yetkiler</th>
                <th className="py-2.5 px-3 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#4a443f]/60 text-[#f3efe9]">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-[#34302d] transition-colors">
                  <td className="py-3 px-3">
                    <div className="font-bold text-white">{user.fullName}</div>
                    <div className="text-[10px] text-[#8c857f]">
                      @{user.username} • Şifre: <span className="font-mono text-[#d6beae] font-semibold">{user.password}</span>
                    </div>
                  </td>

                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded-full bg-[#34302d] text-[#b99881] border border-[#4a443f] text-[11px]">
                      {user.department}
                    </span>
                  </td>

                  <td className="py-3 px-3">
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {user.departments?.map((d) => (
                        <span key={d} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-[#a69f99]">
                          {d}
                        </span>
                      ))}
                    </div>
                  </td>

                  <td className="py-3 px-3">
                    <GlassBadge size="sm" variant={user.role === 'ADMIN' ? 'gold' : user.role === 'MANAGER' ? 'primary' : 'default'}>
                      {user.role}
                    </GlassBadge>
                  </td>

                  <td className="py-3 px-3">
                    <span className="text-[11px] font-mono text-[#d6beae]">
                      {user.scope === 'ALL' ? 'Tümü (ALL)' : user.scope === 'DEPARTMENT' ? 'Departman' : 'Yalnızca Kendine'}
                    </span>
                  </td>

                  <td className="py-3 px-3">
                    <div className="flex flex-wrap gap-1 text-[10px] text-[#8c857f]">
                      {user.permissions?.canEditProjectPrice && <span className="text-emerald-400">Fiyat</span>}
                      {user.permissions?.canChangeFlatStatus && <span className="text-sky-400">Daire Durumu</span>}
                      {user.permissions?.canApproveDiscounts && <span className="text-amber-400">İskonto</span>}
                      {user.permissions?.canRefundDeposit && <span className="text-rose-400">Kapora İade</span>}
                    </div>
                  </td>

                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(user)}
                        className="p-1.5 rounded-[8px] bg-[#34302d] hover:bg-[#3d3733] text-[#d6beae] border border-[#4a443f] cursor-pointer"
                        title="Yetkileri Düzenle"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {user.id !== currentUser?.id && (
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="p-1.5 rounded-[8px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 cursor-pointer"
                          title="Üyeyi Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* EKİP ÜYESİ EKLE MODALI */}
      <GlassModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Ekip Üyesi Ekle"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
              Adı Soyadı *
            </label>
            <input
              type="text"
              required
              placeholder="Örn: Ayşe Demir"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
            />
            {fullName.trim() && (
              <span className="text-[11px] text-[#b99881] mt-1.5 block font-mono">
                Kullanıcı Adı: @{generateUsername(fullName, users)}
              </span>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
              Departman *
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value as Department)}
              className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881] cursor-pointer"
            >
              {CANONICAL_DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <p className="text-[11px] text-[#8c857f]">
            Otomatik olarak 6 haneli yalnızca sayıdan oluşan şifre tanımlanır. Kullanıcı adı ilk başta yalnızca ad olarak verilir; kullanıcı dilerse sonradan değiştirebilir.
          </p>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 rounded-full text-xs text-[#a69f99] hover:text-white cursor-pointer"
            >
              Vazgeç
            </button>
            <GlassButton type="submit" variant="gold" size="sm" className="rounded-full px-5 font-bold">
              Ekip Üyesi Ekle
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      {/* YETKİ DÜZENLE MODALI */}
      <GlassModal
        isOpen={selectedUserToEdit !== null}
        onClose={() => setSelectedUserToEdit(null)}
        title={`Yetkileri Düzenle - ${selectedUserToEdit?.fullName}`}
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Varsayılan Alan
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value as Department)}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              >
                {CANONICAL_DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Rol
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              >
                <option value="REPRESENTATIVE">Temsilci / Danışman</option>
                <option value="SPECIALIST">Uzman</option>
                <option value="MANAGER">Yönetici</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Kayıt Görme (Scope)
              </label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as AccessScope)}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              >
                <option value="ASSIGNED_ONLY">Yalnızca Kendine Atanan</option>
                <option value="DEPARTMENT">Kendi Departmanı</option>
                <option value="ALL">Tüm Kayıtlar</option>
              </select>
            </div>
          </div>

          <div className="p-3 rounded-[14px] bg-[#24211f] border border-[#4a443f] space-y-2">
            <div className="text-[11px] font-semibold text-[#b99881]">
              Yetkili Departmanlar:
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CANONICAL_DEPARTMENTS.map((d) => (
                <label key={d} className="flex items-center gap-2 text-xs text-[#f3efe9] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedDepts.includes(d)}
                    onChange={() => handleDeptCheckbox(d)}
                    className="rounded border-[#4a443f] text-[#b99881] focus:ring-0"
                  />
                  <span>{d}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setSelectedUserToEdit(null)}
              className="px-4 py-2 rounded-full text-xs text-[#a69f99] hover:text-white cursor-pointer"
            >
              Vazgeç
            </button>
            <GlassButton type="submit" variant="gold" size="sm" className="rounded-full px-5 font-bold">
              Değişiklikleri Kaydet
            </GlassButton>
          </div>
        </form>
      </GlassModal>
    </div>
  )
}
