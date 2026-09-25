import React, { useState } from 'react'
import {
  Building2,
  Check,
  Copy,
  KeyRound,
  Plus,
  Shield,
  Trash2,
  User,
  UserPlus,
  Users,
  X,
  Sparkles,
  LayoutGrid,
  Edit2,
  Layers,
  Palette,
  Image as ImageIcon,
  Sliders,
} from 'lucide-react'
import { AppUser, Department, generateInitialPassword, generateUsername, userStore } from '@/services/userStore'
import { CANONICAL_DEPARTMENTS } from '@/types/department'
import { GlassModal } from '@/components/ui/GlassModal'
import { GlassButton } from '@/components/ui/GlassButton'
import { GlassBadge } from '@/components/ui/GlassBadge'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  currentUser: AppUser | null
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'team' | 'company' | 'appearance'>('profile')

  // Dock Enabled state ('true' | 'false')
  const [dockEnabled, setDockEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('demirturk_dock_enabled')
      if (saved !== null) return saved !== 'false'
    } catch {
      // ignore
    }
    return true
  })

  const handleToggleDock = (val: boolean) => {
    setDockEnabled(val)
    localStorage.setItem('demirturk_dock_enabled', String(val))
    window.dispatchEvent(new Event('demirturk_dock_config_updated'))
  }

  // Theme Accent state ('gold' | 'amber' | 'platinum' | 'sapphire')
  const [themeAccent, setThemeAccent] = useState<'gold' | 'amber' | 'platinum' | 'sapphire'>(() => {
    try {
      const saved = localStorage.getItem('demirturk_theme_accent')
      if (saved === 'amber' || saved === 'platinum' || saved === 'sapphire') return saved
    } catch {
      // ignore
    }
    return 'gold'
  })

  const handleSetAccent = (acc: 'gold' | 'amber' | 'platinum' | 'sapphire') => {
    setThemeAccent(acc)
    localStorage.setItem('demirturk_theme_accent', acc)
    if (acc === 'gold') {
      document.documentElement.removeAttribute('data-theme-accent')
    } else {
      document.documentElement.setAttribute('data-theme-accent', acc)
    }
  }

  // Theme Contrast state ('standard' | 'deep')
  const [themeContrast, setThemeContrast] = useState<'standard' | 'deep'>(() => {
    try {
      const saved = localStorage.getItem('demirturk_theme_contrast')
      if (saved === 'deep') return 'deep'
    } catch {
      // ignore
    }
    return 'standard'
  })

  const handleSetContrast = (contrast: 'standard' | 'deep') => {
    setThemeContrast(contrast)
    localStorage.setItem('demirturk_theme_contrast', contrast)
    if (contrast === 'deep') {
      document.documentElement.setAttribute('data-theme-contrast', 'deep')
    } else {
      document.documentElement.removeAttribute('data-theme-contrast')
    }
  }

  // Start Menu Grid state ('4x5' | '5x5' | '5x6')
  const [startMenuGrid, setStartMenuGrid] = useState<'4x5' | '5x5' | '5x6'>(() => {
    try {
      const saved = localStorage.getItem('demirturk_start_menu_grid')
      if (saved === '4x5' || saved === '5x5' || saved === '5x6') return saved
    } catch {
      // ignore
    }
    return '4x5'
  })

  const handleUpdateGrid = (grid: '4x5' | '5x5' | '5x6') => {
    setStartMenuGrid(grid)
    localStorage.setItem('demirturk_start_menu_grid', grid)
    window.dispatchEvent(new Event('demirturk_start_menu_grid_updated'))
  }

  // Avatar URL edit state
  const [editAvatarUrl, setEditAvatarUrl] = useState(currentUser?.avatarUrl || '')
  const [avatarMessage, setAvatarMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSaveAvatar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser) return
    const res = userStore.updateUser(currentUser.id, { avatarUrl: editAvatarUrl.trim() })
    if (res.success) {
      setAvatarMessage({ type: 'success', text: 'Profil fotoğrafı başarıyla güncellendi.' })
      setTimeout(() => setAvatarMessage(null), 3000)
    } else {
      setAvatarMessage({ type: 'error', text: res.error || 'Hata oluştu.' })
    }
  }

  // Username edit state
  const [editUsername, setEditUsername] = useState(currentUser?.username || '')
  const [usernameMessage, setUsernameMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Password change state
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // New team member creation state
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false)
  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberDept, setNewMemberDept] = useState<Department>('Satış')
  const [newMemberDepts, setNewMemberDepts] = useState<Department[]>(['Satış'])
  const [newMemberEmail, setNewMemberEmail] = useState('')
  const [generatedPassword, setGeneratedPassword] = useState(generateInitialPassword())
  const [createdMemberInfo, setCreatedMemberInfo] = useState<{ username: string; pass: string } | null>(null)
  const [copied, setCopied] = useState(false)

  // Edit existing team member state
  const [editingUser, setEditingUser] = useState<AppUser | null>(null)
  const [editFullName, setEditFullName] = useState('')
  const [editDepartment, setEditDepartment] = useState<Department>('Satış')
  const [editDepartments, setEditDepartments] = useState<Department[]>(['Satış'])
  const [editIsManager, setEditIsManager] = useState(false)
  const [editPassword, setEditPassword] = useState('')
  const [userEditSuccess, setUserEditSuccess] = useState<string | null>(null)

  const allUsers = userStore.getAllUsers()
  const isManager = Boolean(currentUser?.isManager || currentUser?.role === 'ADMIN')

  // Dynamic preview of username for new member
  const previewUsername = newMemberName ? generateUsername(newMemberName, allUsers) : ''

  const handleSaveUsername = (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser) return
    const res = userStore.updateUsername(currentUser.id, editUsername)
    if (res.success) {
      setUsernameMessage({ type: 'success', text: 'Kullanıcı adı başarıyla güncellendi.' })
      setTimeout(() => setUsernameMessage(null), 3000)
    } else {
      setUsernameMessage({ type: 'error', text: res.error || 'Hata oluştu.' })
    }
  }

  const handleSavePassword = (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser) return
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Şifreler birbiriyle eşleşmiyor.' })
      return
    }
    const res = userStore.changePassword(currentUser.id, newPassword)
    if (res.success) {
      setPasswordMessage({ type: 'success', text: 'Şifreniz başarıyla değiştirildi.' })
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordMessage(null), 3000)
    } else {
      setPasswordMessage({ type: 'error', text: res.error || 'Hata oluştu.' })
    }
  }

  const handleCreateMember = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMemberName.trim()) return

    const depts = Array.from(new Set([newMemberDept, ...newMemberDepts]))

    const res = userStore.addMember({
      fullName: newMemberName.trim(),
      department: newMemberDept,
      departments: depts,
      email: newMemberEmail.trim(),
      initialPassword: generatedPassword,
    })

    setCreatedMemberInfo({
      username: res.user.username,
      pass: res.generatedPassword,
    })

    setNewMemberName('')
    setNewMemberEmail('')
    setNewMemberDepts(['Satış'])
    setGeneratedPassword(generateInitialPassword())
  }

  const handleOpenEditUser = (user: AppUser) => {
    setEditingUser(user)
    setEditFullName(user.fullName)
    setEditDepartment(user.department)
    setEditDepartments(user.departments && user.departments.length > 0 ? user.departments : [user.department])
    setEditIsManager(Boolean(user.isManager || user.role === 'ADMIN' || user.role === 'MANAGER'))
    setEditPassword('')
    setUserEditSuccess(null)
  }

  const handleSaveUserEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return

    const depts = Array.from(new Set([editDepartment, ...editDepartments]))

    const updates: Partial<AppUser> = {
      fullName: editFullName.trim(),
      department: editDepartment,
      departments: depts,
      isManager: editIsManager,
      role: editIsManager ? (editingUser.role === 'ADMIN' ? 'ADMIN' : 'MANAGER') : 'REPRESENTATIVE',
    }

    if (editPassword.trim().length >= 6) {
      updates.password = editPassword.trim()
      updates.mustChangePassword = false
    }

    const res = userStore.updateUser(editingUser.id, updates)
    if (res.success) {
      setUserEditSuccess(`${editFullName} bilgileri başarıyla güncellendi.`)
      setTimeout(() => {
        setUserEditSuccess(null)
        setEditingUser(null)
      }, 1000)
    }
  }

  const handleCopyCredentials = () => {
    if (!createdMemberInfo) return
    const text = `Demirtürk Portföy Giriş Bilgileri:\nKullanıcı Adı: ${createdMemberInfo.username}\nİlk Giriş Şifresi: ${createdMemberInfo.pass}\nGiriş Adresi: http://localhost:9001`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <GlassModal
      isOpen={isOpen}
      onClose={onClose}
      title="Sistem ve Hesap Ayarları"
      maxWidth="lg"
    >
      <div className="space-y-6">
        {/* Navigation Tabs (Pill Shaped) */}
        <div className="flex items-center gap-2 pb-3 border-b border-[#4a443f]">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-[#423c38] text-white border border-[#b99881]/40 shadow-sm'
                : 'text-[#a69f99] hover:text-white'
            }`}
          >
            Profil & Kullanıcı Adı
          </button>

          {isManager && (
            <button
              onClick={() => setActiveTab('team')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'team'
                  ? 'bg-[#423c38] text-white border border-[#b99881]/40 shadow-sm'
                  : 'text-[#a69f99] hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Ekip ve Üye Yönetimi</span>
              <span className="px-1.5 py-0.2 rounded-full bg-[#b99881]/20 text-[#b99881] text-[10px]">
                {allUsers.length}
              </span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('company')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'company'
                ? 'bg-[#423c38] text-white border border-[#b99881]/40 shadow-sm'
                : 'text-[#a69f99] hover:text-white'
            }`}
          >
            Şirket Bilgileri
          </button>

          <button
            onClick={() => setActiveTab('appearance')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'appearance'
                ? 'bg-[#423c38] text-white border border-[#b99881]/40 shadow-sm'
                : 'text-[#a69f99] hover:text-white'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Kişiselleştir: Başlat & Tema</span>
          </button>
        </div>

        {/* Tab 1: Profil & Kullanıcı Adı */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            {/* User Overview Card */}
            <div className="p-5 rounded-[24px] bg-[#282522] border border-[#4a443f] flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-full bg-[#34302d] border border-[#b99881]/40 flex items-center justify-center text-lg font-bold text-[#b99881] overflow-hidden shrink-0">
                  {currentUser?.avatarUrl ? (
                    <img src={currentUser.avatarUrl} alt={currentUser.fullName} className="w-full h-full object-cover" />
                  ) : (
                    currentUser?.fullName.slice(0, 2).toUpperCase() || 'DP'
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    {currentUser?.fullName || 'Aktif Kullanıcı'}
                  </h4>
                  <p className="text-xs text-[#a69f99] mt-0.5">
                    @{currentUser?.username} • {currentUser?.department || 'Genel'} Departmanı
                  </p>
                </div>
              </div>

              <span className="px-3 py-1 rounded-full bg-[#b99881]/15 text-[#b99881] border border-[#b99881]/30 text-xs font-bold">
                {currentUser?.isManager ? 'Yönetici' : 'Çalışan'}
              </span>
            </div>

            {/* Profil Fotoğrafı (Avatar URL) Formu */}
            <form onSubmit={handleSaveAvatar} className="space-y-3 p-5 rounded-[24px] bg-[#282522]/60 border border-[#4a443f]">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-[#b99881]" />
                    Profil Fotoğrafı
                  </h5>
                  <p className="text-[11px] text-[#8c857f] mt-0.5">
                    Üst gezinti çubuğundaki yuvarlak profil simgeniz için fotoğraf URL'si belirleyin. Boşsa zarif altın monogram gösterilir.
                  </p>
                </div>

                <div className="w-[38px] h-[38px] rounded-full bg-[#24211f] border border-[#b99881]/50 flex items-center justify-center overflow-hidden shrink-0 shadow-md">
                  {editAvatarUrl ? (
                    <img src={editAvatarUrl} alt="Önizleme" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                  ) : (
                    <span className="text-xs font-bold text-[#b99881] font-sans">
                      {currentUser?.fullName.slice(0, 2).toUpperCase() || 'DP'}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <div className="relative flex-1">
                  <input
                    type="url"
                    value={editAvatarUrl}
                    onChange={(e) => setEditAvatarUrl(e.target.value)}
                    className="w-full bg-[#24211f] border border-[#4a443f] focus:border-[#b99881] rounded-full px-4 py-2 text-xs text-white focus:outline-none placeholder-[#8c857f]"
                    placeholder="https://.../profil-fotografi.jpg"
                  />
                </div>
                {editAvatarUrl && (
                  <GlassButton
                    variant="subtle"
                    size="sm"
                    type="button"
                    onClick={() => {
                      setEditAvatarUrl('')
                      if (currentUser) userStore.updateUser(currentUser.id, { avatarUrl: '' })
                    }}
                    className="rounded-full px-3 text-[11px]"
                  >
                    Kaldır
                  </GlassButton>
                )}
                <GlassButton variant="gold" size="sm" type="submit" className="rounded-full px-5">
                  Kaydet
                </GlassButton>
              </div>

              {avatarMessage && (
                <p className={`text-xs ${avatarMessage.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {avatarMessage.text}
                </p>
              )}
            </form>

            {/* Username Update Form */}
            <form onSubmit={handleSaveUsername} className="space-y-3 p-5 rounded-[24px] bg-[#282522]/60 border border-[#4a443f]">
              <h5 className="text-xs font-bold text-white">Kullanıcı Adı Değiştir</h5>
              <p className="text-[11px] text-[#8c857f]">
                Sistem tarafından otomatik üretilen kullanıcı adınızı buradan dilediğiniz gibi güncelleyebilirsiniz.
              </p>

              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-mono text-[#b99881]">
                    @
                  </span>
                  <input
                    type="text"
                    required
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="w-full bg-[#24211f] border border-[#4a443f] focus:border-[#b99881] rounded-full pl-8 pr-4 py-2 text-xs text-white focus:outline-none"
                    placeholder="kullaniciadi"
                  />
                </div>
                <GlassButton variant="gold" size="sm" type="submit" className="rounded-full px-5">
                  Kaydet
                </GlassButton>
              </div>

              {usernameMessage && (
                <p className={`text-xs ${usernameMessage.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {usernameMessage.text}
                </p>
              )}
            </form>

            {/* Password Change Form */}
            <form onSubmit={handleSavePassword} className="space-y-3 p-5 rounded-[24px] bg-[#282522]/60 border border-[#4a443f]">
              <h5 className="text-xs font-bold text-white">Şifre Yenileme</h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-[#a69f99] block mb-1">Yeni Şifre</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="En az 6 karakter"
                    className="w-full bg-[#24211f] border border-[#4a443f] focus:border-[#b99881] rounded-full px-4 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#a69f99] block mb-1">Yeni Şifre (Tekrar)</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Şifreyi onaylayın"
                    className="w-full bg-[#24211f] border border-[#4a443f] focus:border-[#b99881] rounded-full px-4 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                {passwordMessage ? (
                  <p className={`text-xs ${passwordMessage.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {passwordMessage.text}
                  </p>
                ) : <span />}
                <GlassButton variant="subtle" size="sm" type="submit" className="rounded-full px-5">
                  Şifreyi Güncelle
                </GlassButton>
              </div>
            </form>
          </div>
        )}

        {/* Tab 2: Ekip ve Üye Yönetimi (Yönetici) */}
        {activeTab === 'team' && isManager && (
          <div className="space-y-6">
            {/* Header & Add Member Button */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white">Şirket Çalışanları</h4>
                <p className="text-xs text-[#a69f99] mt-0.5">
                  Ekibinize yeni üyeler ekleyin, otomatik kullanıcı adı ve ilk şifre oluşturun.
                </p>
              </div>

              <GlassButton
                variant="gold"
                size="sm"
                icon={<UserPlus className="w-3.5 h-3.5" />}
                onClick={() => {
                  setIsAddMemberOpen(!isAddMemberOpen)
                  setCreatedMemberInfo(null)
                }}
                className="rounded-full px-4"
              >
                Yeni Üye Ekle
              </GlassButton>
            </div>

            {/* Created Member Success Alert Card */}
            {createdMemberInfo && (
              <div className="p-4 rounded-[22px] bg-emerald-500/10 border border-emerald-500/30 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400">
                    Üye Başarıyla Eklendi! Giriş Bilgileri:
                  </span>
                  <button
                    onClick={handleCopyCredentials}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 text-xs text-emerald-300 transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Kopyalandı' : 'Bilgileri Kopyala'}</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs bg-black/30 p-3 rounded-[16px] font-mono">
                  <div>
                    <span className="text-[#8c857f] block text-[10px]">KULLANICI ADI</span>
                    <span className="text-white font-bold">@{createdMemberInfo.username}</span>
                  </div>
                  <div>
                    <span className="text-[#8c857f] block text-[10px]">İLK GİRİŞ ŞİFRESİ (8 HANE)</span>
                    <span className="text-emerald-400 font-bold">{createdMemberInfo.pass}</span>
                  </div>
                </div>
                <p className="text-[11px] text-[#a69f99]">
                  * Kullanıcı bu bilgilerle ilk kez giriş yaptığında şifresini değiştirmesi istenecektir.
                </p>
              </div>
            )}

            {/* Add Member Form (Collapsible) */}
            {isAddMemberOpen && (
              <form onSubmit={handleCreateMember} className="p-5 rounded-[26px] bg-[#282522] border border-[#b99881]/30 space-y-4 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-[#b99881]" />
                    Yeni Çalışan Tanımlama
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddMemberOpen(false)}
                    className="text-[#a69f99] hover:text-white p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-[#f3efe9] block mb-1">
                      Ad Soyad *
                    </label>
                    <input
                      type="text"
                      required
                      value={newMemberName}
                      onChange={(e) => setNewMemberName(e.target.value)}
                      placeholder="Örn: Berkant Çalışkan"
                      className="w-full bg-[#24211f] border border-[#4a443f] focus:border-[#b99881] rounded-full px-4 py-2 text-xs text-white focus:outline-none"
                    />
                    {previewUsername && (
                      <span className="text-[10px] text-[#b99881] mt-1 block">
                        Otomatik Kullanıcı Adı: @{previewUsername}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[#f3efe9] block mb-1">
                      Ana Departman *
                    </label>
                    <select
                      value={newMemberDept}
                      onChange={(e) => {
                        const dept = e.target.value as Department
                        setNewMemberDept(dept)
                        if (!newMemberDepts.includes(dept)) {
                          setNewMemberDepts((prev) => [...prev, dept])
                        }
                      }}
                      className="w-full bg-[#24211f] border border-[#4a443f] focus:border-[#b99881] rounded-full px-4 py-2 text-xs text-white focus:outline-none cursor-pointer"
                    >
                      <option value="Satış">Satış</option>
                      <option value="Pazarlama">Pazarlama</option>
                      <option value="Müşteri İlişkileri">Müşteri İlişkileri</option>
                      <option value="Muhasebe">Muhasebe</option>
                      <option value="Yönetim">Yönetim</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[#f3efe9] block mb-1">
                      E-posta (İsteğe Bağlı)
                    </label>
                    <input
                      type="email"
                      value={newMemberEmail}
                      onChange={(e) => setNewMemberEmail(e.target.value)}
                      placeholder="calisan@demirturk.com"
                      className="w-full bg-[#24211f] border border-[#4a443f] focus:border-[#b99881] rounded-full px-4 py-2 text-xs text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[#f3efe9] block mb-1">
                      İlk Şifre (Otomatik 8 Karakter)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={generatedPassword}
                        onChange={(e) => setGeneratedPassword(e.target.value)}
                        className="w-full bg-[#24211f] border border-[#4a443f] font-mono text-emerald-400 font-bold rounded-full px-4 py-2 text-xs focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setGeneratedPassword(generateInitialPassword())}
                        className="px-3 py-2 rounded-full bg-white/5 hover:bg-white/10 text-[10px] text-[#d6beae] border border-white/5 shrink-0"
                      >
                        Yenile
                      </button>
                    </div>
                  </div>

                  <div className="sm:col-span-2 pt-2 border-t border-[#4a443f]/50">
                    <label className="text-[11px] font-semibold text-[#f3efe9] block mb-1">
                      Erişebileceği Departmanlar (Çoklu Çalışma Alanı Yetkisi) *
                    </label>
                    <p className="text-[10px] text-[#8c857f] mb-2">
                      Kullanıcının üst bardaki çalışma alanı menüsünden geçiş yapabileceği departmanları seçin.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {CANONICAL_DEPARTMENTS.map((dept) => {
                        const isPrimary = dept === newMemberDept
                        const isChecked = isPrimary || newMemberDepts.includes(dept)
                        return (
                          <label
                            key={dept}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border cursor-pointer select-none transition-all ${
                              isChecked
                                ? 'bg-[#b99881]/20 border-[#b99881] text-[#f3efe9]'
                                : 'bg-[#24211f] border-[#4a443f] text-[#8c857f] hover:text-[#f3efe9]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={isPrimary}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewMemberDepts((prev) => [...prev, dept])
                                } else {
                                  setNewMemberDepts((prev) => prev.filter((d) => d !== dept))
                                }
                              }}
                              className="rounded border-[#4a443f] text-[#b99881] focus:ring-0 focus:ring-offset-0 bg-[#1c1a18]"
                            />
                            <span className="font-medium">{dept}</span>
                            {isPrimary && (
                              <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-[#b99881] text-[#1c1a18] font-bold">
                                Varsayılan
                              </span>
                            )}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <GlassButton
                    variant="subtle"
                    size="sm"
                    type="button"
                    onClick={() => setIsAddMemberOpen(false)}
                    className="rounded-full"
                  >
                    İptal
                  </GlassButton>
                  <GlassButton variant="gold" size="sm" type="submit" className="rounded-full px-5">
                    Hesabı Oluştur
                  </GlassButton>
                </div>
              </form>
            )}

            {/* Team Members List Table */}
            <div className="rounded-[24px] bg-[#282522]/70 border border-[#4a443f] overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[640px]">
                <thead className="bg-white/[0.02] border-b border-[#4a443f] text-[#a69f99] font-semibold">
                  <tr>
                    <th className="py-3 px-4">Çalışan</th>
                    <th className="py-3 px-4">Kullanıcı Adı</th>
                    <th className="py-3 px-4">Ana Departman</th>
                    <th className="py-3 px-4">Yetkili Departmanlar</th>
                    <th className="py-3 px-4">Rol</th>
                    <th className="py-3 px-4">Durum</th>
                    <th className="py-3 px-4 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#4a443f]/60">
                  {allUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 font-bold text-white whitespace-nowrap">
                        {u.fullName}
                        {u.id === currentUser?.id && (
                          <span className="ml-1.5 text-[10px] text-[#b99881]">(Siz)</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[#b99881]">
                        @{u.username}
                      </td>
                      <td className="py-3 px-4 text-[#f3efe9] font-medium whitespace-nowrap">
                        {u.department}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 max-w-[220px]">
                          {(u.departments && u.departments.length > 0 ? u.departments : [u.department]).map((d) => (
                            <span
                              key={d}
                              className={`text-[9px] px-2 py-0.5 rounded-full border ${
                                d === u.department
                                  ? 'bg-[#b99881]/20 border-[#b99881]/50 text-[#f3efe9]'
                                  : 'bg-white/5 border-white/10 text-[#a69f99]'
                              }`}
                            >
                              {d}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${u.isManager ? 'bg-[#b99881]/20 text-[#b99881]' : 'bg-white/5 text-[#a69f99]'}`}>
                          {u.isManager ? 'Yönetici' : 'Çalışan'}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {u.mustChangePassword ? (
                          <span className="text-[10px] text-amber-400">Şifre Bekliyor</span>
                        ) : (
                          <span className="text-[10px] text-emerald-400">Aktif</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenEditUser(u)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 hover:bg-[#b99881]/20 text-[#d6beae] hover:text-white border border-white/10 hover:border-[#b99881]/50 transition-all text-xs cursor-pointer"
                          title="Departman ve Yetkileri Düzenle"
                        >
                          <Edit2 className="w-3 h-3 text-[#b99881]" />
                          <span>Düzenle</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Edit User Modal */}
            {editingUser && (
              <GlassModal
                isOpen={Boolean(editingUser)}
                onClose={() => setEditingUser(null)}
                title={`Kullanıcı Düzenleme • ${editingUser.fullName}`}
              >
                <form onSubmit={handleSaveUserEdit} className="space-y-4">
                  {userEditSuccess && (
                    <div className="p-3 rounded-[12px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium text-center">
                      {userEditSuccess}
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-semibold text-[#f3efe9] block mb-1">
                      Ad Soyad *
                    </label>
                    <input
                      type="text"
                      required
                      value={editFullName}
                      onChange={(e) => setEditFullName(e.target.value)}
                      className="w-full bg-[#24211f] border border-[#4a443f] focus:border-[#b99881] rounded-full px-4 py-2 text-xs text-white focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-[#f3efe9] block mb-1">
                        Ana Departman (Varsayılan) *
                      </label>
                      <select
                        value={editDepartment}
                        onChange={(e) => {
                          const dept = e.target.value as Department
                          setEditDepartment(dept)
                          if (!editDepartments.includes(dept)) {
                            setEditDepartments((prev) => [...prev, dept])
                          }
                        }}
                        className="w-full bg-[#24211f] border border-[#4a443f] focus:border-[#b99881] rounded-full px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
                      >
                        {CANONICAL_DEPARTMENTS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-[#f3efe9] block mb-1">
                        Yetki Rolü
                      </label>
                      <select
                        value={editIsManager ? 'MANAGER' : 'REPRESENTATIVE'}
                        onChange={(e) => setEditIsManager(e.target.value === 'MANAGER')}
                        className="w-full bg-[#24211f] border border-[#4a443f] focus:border-[#b99881] rounded-full px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
                      >
                        <option value="REPRESENTATIVE">Çalışan / Temsilci</option>
                        <option value="MANAGER">Yönetici / Departman Lideri</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-[#f3efe9] block mb-1">
                      Erişebileceği Departmanlar (Çoklu Çalışma Alanı Yetkisi) *
                    </label>
                    <p className="text-[10px] text-[#8c857f] mb-2">
                      Kullanıcının üst bardaki çalışma alanı menüsünden geçiş yapabileceği departmanları belirleyin.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {CANONICAL_DEPARTMENTS.map((dept) => {
                        const isPrimary = dept === editDepartment
                        const isChecked = isPrimary || editDepartments.includes(dept)
                        return (
                          <label
                            key={dept}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border cursor-pointer select-none transition-all ${
                              isChecked
                                ? 'bg-[#b99881]/20 border-[#b99881] text-[#f3efe9]'
                                : 'bg-[#24211f] border-[#4a443f] text-[#8c857f] hover:text-[#f3efe9]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={isPrimary}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setEditDepartments((prev) => [...prev, dept])
                                } else {
                                  setEditDepartments((prev) => prev.filter((d) => d !== dept))
                                }
                              }}
                              className="rounded border-[#4a443f] text-[#b99881] focus:ring-0 focus:ring-offset-0 bg-[#1c1a18]"
                            />
                            <span className="font-medium">{dept}</span>
                            {isPrimary && (
                              <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-[#b99881] text-[#1c1a18] font-bold">
                                Varsayılan
                              </span>
                            )}
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-[#f3efe9] block mb-1">
                      Yeni Şifre Belirle (İsteğe Bağlı)
                    </label>
                    <input
                      type="text"
                      placeholder="Şifreyi değiştirmek istemiyorsanız boş bırakın"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      className="w-full bg-[#24211f] border border-[#4a443f] focus:border-[#b99881] rounded-full px-4 py-2 text-xs text-white focus:outline-none placeholder-[#8c857f]"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#4a443f]">
                    <GlassButton
                      variant="subtle"
                      size="sm"
                      type="button"
                      onClick={() => setEditingUser(null)}
                      className="rounded-full"
                    >
                      İptal
                    </GlassButton>
                    <GlassButton variant="gold" size="sm" type="submit" className="rounded-full px-5">
                      Değişiklikleri Kaydet
                    </GlassButton>
                  </div>
                </form>
              </GlassModal>
            )}
          </div>
        )}

        {/* Tab 3: Şirket Bilgileri */}
        {activeTab === 'company' && (
          <div className="space-y-4 p-5 rounded-[24px] bg-[#282522]/60 border border-[#4a443f]">
            <div>
              <h4 className="text-sm font-bold text-white">Şirket & Sistem</h4>
              <p className="text-xs text-[#a69f99] mt-0.5">
                Demirtürk Portföy Kurumsal Arayüz ve Veri Yönetimi
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs pt-2">
              <div className="p-3 rounded-[18px] bg-[#24211f] border border-[#4a443f]">
                <span className="text-[#8c857f] block text-[10px]">ŞİRKET ADI</span>
                <span className="font-bold text-white">{currentUser?.companyName || 'Demirtürk Portföy'}</span>
              </div>
              <div className="p-3 rounded-[18px] bg-[#24211f] border border-[#4a443f]">
                <span className="text-[#8c857f] block text-[10px]">ÇALIŞMA ALANI</span>
                <span className="font-bold text-white">Portföy, Gayrimenkul & CRM</span>
              </div>
            </div>

            <div className="pt-4 border-t border-[#4a443f] flex items-center justify-between">
              <span className="text-xs text-[#8c857f]">v2.4 • Modüler Glassmorphism</span>
              <GlassButton
                variant="danger"
                size="sm"
                onClick={() => {
                  userStore.logout()
                  window.location.reload()
                }}
                className="rounded-full px-4 text-xs"
              >
                Oturumu Kapat
              </GlassButton>
            </div>
          </div>
        )}

        {/* Tab 4: Kişiselleştir: Başlat Menüsü & Tema */}
        {activeTab === 'appearance' && (
          <div className="space-y-6">
            {/* Alt Dock Çubuğu Açık / Kapalı Toggle */}
            <div className="p-5 rounded-[24px] bg-[#282522] border border-[#4a443f] flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#b99881]" />
                  <h4 className="text-sm font-bold text-white">Alt Dock Çubuğu</h4>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    dockEnabled
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-bold'
                      : 'bg-white/5 text-[#8c857f] border-white/10'
                  }`}>
                    {dockEnabled ? 'Açık (Varsayılan)' : 'Kapalı'}
                  </span>
                </div>
                <p className="text-xs text-[#a69f99] leading-relaxed">
                  Alt dock çubuğu ekranın altında sabitlenir ve Başlat menüsünü içerir. Kapatıldığında üst gezinti çubuğuna 9 noktalı Uygulama Menüsü eklenir ve Ayarlar oradan erişilebilir.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleToggleDock(!dockEnabled)}
                className={`relative inline-flex h-6 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  dockEnabled ? 'bg-[#b99881]' : 'bg-[#4a443f]'
                }`}
                title={dockEnabled ? 'Dock Çubuğunu Kapat' : 'Dock Çubuğunu Aç'}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    dockEnabled ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Başlat Menüsü Araç Grid Boyutu */}
            <div className="p-5 rounded-[24px] bg-[#282522] border border-[#4a443f] space-y-2">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-[#b99881]" />
                Başlat Menüsü Araç Grid Boyutu
              </h4>
              <p className="text-xs text-[#a69f99]">
                Alt dock'taki başlat butonuna tıklandığında açılan araç menüsünün satır ve sütun sayısını kişiselleştirin.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  id: '4x5' as const,
                  title: '4x5 Grid (Varsayılan)',
                  desc: 'Yanlamasına 4 sütun, uzunlamasına 5 satır. 20 temel araç.',
                  cols: '4 Sütun x 5 Satır',
                  badge: 'Standart',
                },
                {
                  id: '5x5' as const,
                  title: '5x5 Grid',
                  desc: 'Yanlamasına 5 sütun, uzunlamasına 5 satır. 25 tam kapasite araç.',
                  cols: '5 Sütun x 5 Satır',
                  badge: 'Geniş',
                },
                {
                  id: '5x6' as const,
                  title: '5x6 Grid',
                  desc: 'Yanlamasına 5 sütun, uzunlamasına 6 satır. Maksimum araç alanı.',
                  cols: '5 Sütun x 6 Satır',
                  badge: 'Maksimum',
                },
              ].map((opt) => {
                const isSelected = startMenuGrid === opt.id
                return (
                  <div
                    key={opt.id}
                    onClick={() => handleUpdateGrid(opt.id)}
                    className={`p-5 rounded-[24px] border transition-all cursor-pointer space-y-3 ${
                      isSelected
                        ? 'bg-[#34302d] border-[#b99881] shadow-lg ring-1 ring-[#b99881]/50'
                        : 'bg-[#282522] border-[#4a443f] hover:border-[#b99881]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{opt.title}</span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                          isSelected
                            ? 'bg-[#b99881] text-[#1c1a18] border-[#b99881] font-bold'
                            : 'bg-white/5 text-[#8c857f] border-white/10'
                        }`}
                      >
                        {opt.badge}
                      </span>
                    </div>

                    <p className="text-[11px] text-[#a69f99] leading-relaxed">{opt.desc}</p>

                    <div className="pt-2 border-t border-[#4a443f]/60 flex items-center justify-between text-[11px]">
                      <span className="text-[#b99881] font-mono font-semibold">{opt.cols}</span>
                      {isSelected ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Seçili
                        </span>
                      ) : (
                        <span className="text-[#8c857f] hover:text-white">Seç</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Tema & Vurgu Rengi Ayarları */}
            <div className="p-5 rounded-[24px] bg-[#282522] border border-[#4a443f] space-y-4">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Palette className="w-4 h-4 text-[#b99881]" />
                  Kurumsal Vurgu Rengi (Accent Palette)
                </h4>
                <p className="text-xs text-[#a69f99] mt-0.5">
                  Platformdaki butonlar, göstergeler ve nefes alan dock çizgisi için renk temasını seçin.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { id: 'gold' as const, name: 'Demirtürk Altın', color: '#b99881', desc: 'Varsayılan mimari altın' },
                  { id: 'amber' as const, name: 'Kehribar', color: '#d97706', desc: 'Sıcak lüks kehribar' },
                  { id: 'platinum' as const, name: 'Platin Gri', color: '#94a3b8', desc: 'Modern minimalist ton' },
                  { id: 'sapphire' as const, name: 'Safir Gece', color: '#38bdf8', desc: 'Teknolojik serin mavi' },
                ].map((acc) => {
                  const isSelected = themeAccent === acc.id
                  return (
                    <div
                      key={acc.id}
                      onClick={() => handleSetAccent(acc.id)}
                      className={`p-3 rounded-[18px] border transition-all cursor-pointer space-y-2 ${
                        isSelected
                          ? 'bg-[#34302d] border-[#b99881] ring-1 ring-[#b99881]/50 shadow-md'
                          : 'bg-[#24211f] border-[#4a443f] hover:border-[#b99881]/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="w-5 h-5 rounded-full border border-white/20 shadow-xs" style={{ backgroundColor: acc.color }} />
                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block">{acc.name}</span>
                        <span className="text-[10px] text-[#8c857f] block truncate">{acc.desc}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Arka Plan Kontrast Modu */}
            <div className="p-5 rounded-[24px] bg-[#282522] border border-[#4a443f] space-y-4">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#b99881]" />
                  Arka Plan & Kontrast Modu
                </h4>
                <p className="text-xs text-[#a69f99] mt-0.5">
                  Ekran parlaklığı ve derinlik seviyesini çalışma ortamınıza göre ayarlayın.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'standard' as const, name: 'Doğal Deri & Sıcak Antrasit', hex: '#34302d', desc: 'Varsayılan kurumsal sıcak ton' },
                  { id: 'deep' as const, name: 'Derin Kömür / Obsidyen', hex: '#181615', desc: 'Yüksek kontrast gece çalışma modu' },
                ].map((c) => {
                  const isSelected = themeContrast === c.id
                  return (
                    <div
                      key={c.id}
                      onClick={() => handleSetContrast(c.id)}
                      className={`p-3.5 rounded-[20px] border transition-all cursor-pointer space-y-2 ${
                        isSelected
                          ? 'bg-[#34302d] border-[#b99881] ring-1 ring-[#b99881]/50 shadow-md'
                          : 'bg-[#24211f] border-[#4a443f] hover:border-[#b99881]/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-md border border-white/20" style={{ backgroundColor: c.hex }} />
                          <span className="text-xs font-bold text-white">{c.name}</span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      </div>
                      <p className="text-[11px] text-[#8c857f]">{c.desc}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </GlassModal>
  )
}
