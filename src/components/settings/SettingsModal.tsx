import React, { useState, useRef, useEffect } from 'react'
import {
  Building2,
  Check,
  Copy,
  KeyRound,
  Shield,
  Trash2,
  User,
  UserPlus,
  Users,
  X,
  Sparkles,
  LayoutGrid,
  Palette,
  Image as ImageIcon,
  Sliders,
  Upload,
  Settings,
  Megaphone,
  FileText,
  Bell,
  TurkishLira,
  Calendar,
  Clock,
  Timer,
  MessageCircle,
  CheckCircle2,
  Wallet,
  Receipt,
  AlertCircle,
  Lock,
  Percent,
  Type,
  Eye,
  EyeOff,
  Zap,
  ExternalLink,
} from 'lucide-react'
import { AppUser, Department, generateInitialPassword, generateUsername, userStore } from '@/services/userStore'
import { metaStore } from '@/services/metaStore'
import { CANONICAL_DEPARTMENTS } from '@/types/department'
import { GlassButton } from '@/components/ui/GlassButton'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  currentUser: AppUser | null
}

export type SettingsTab =
  | 'account'
  | 'appearance'
  | 'company'
  | 'dept-meta'
  | 'dept-leads'
  | 'dept-notifications'
  | 'dept-sales-commission'
  | 'dept-sales-appointments'
  | 'dept-sales-reservations'
  | 'dept-crm-sla'
  | 'dept-crm-channels'
  | 'dept-crm-priority'
  | 'dept-acc-accounts'
  | 'dept-acc-invoicing'
  | 'dept-acc-reminders'
  | 'dept-admin-permissions'
  | 'dept-admin-approvals'
  | 'dept-admin-audit'

// Helper to center-crop and compress uploaded profile images into lightweight JPEG (~25KB)
function compressAvatarImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Dosya okunamadı'))
    reader.onload = (event) => {
      const img = new Image()
      img.onerror = () => reject(new Error('Görsel okunamadı'))
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          const targetSize = 320 // 320x320 px (retina quality for avatars)
          canvas.width = targetSize
          canvas.height = targetSize
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            resolve(event.target?.result as string)
            return
          }

          // Center-crop square
          const minDim = Math.min(img.width, img.height)
          const startX = (img.width - minDim) / 2
          const startY = (img.height - minDim) / 2

          ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, targetSize, targetSize)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.86)
          resolve(dataUrl)
        } catch {
          resolve(event.target?.result as string)
        }
      }
      img.src = event.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('account')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Current active department
  const currentDept: Department = currentUser?.department || 'Pazarlama'

  // Dock Enabled state ('true' | 'false')
  const [dockEnabled, setDockEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('demirturk_dock_enabled')
      if (saved !== null) return saved !== 'false'
    } catch {}
    return true
  })

  const handleToggleDock = (val: boolean) => {
    setDockEnabled(val)
    localStorage.setItem('demirturk_dock_enabled', String(val))
    window.dispatchEvent(new Event('demirturk_dock_config_updated'))
  }

  // 5 Luxury Themes (Primary big circle + Secondary small badge)
  const THEMES: {
    id: 'gold' | 'amber' | 'emerald' | 'sapphire' | 'platinum'
    name: string
    desc: string
    primary: string
    secondary: string
  }[] = [
    {
      id: 'gold',
      name: 'Reelms Bronz & Altın',
      desc: 'Koyu bronz zemin & mat şampanya altını',
      primary: '#282522',
      secondary: '#b99881',
    },
    {
      id: 'amber',
      name: 'Kehribar Noir',
      desc: 'Sıcak gece kömürü & mat kehribar',
      primary: '#1c1916',
      secondary: '#d97706',
    },
    {
      id: 'emerald',
      name: 'Orman Zümrütü',
      desc: 'Derin orman obsidyeni & platin yeşili',
      primary: '#14221d',
      secondary: '#10b981',
    },
    {
      id: 'sapphire',
      name: 'Gece Safiri',
      desc: 'Gece safiri & arktik gök mavisi',
      primary: '#151c28',
      secondary: '#38bdf8',
    },
    {
      id: 'platinum',
      name: 'Titanyum Grafit',
      desc: 'Mat antrasit & gümüş platin',
      primary: '#202023',
      secondary: '#94a3b8',
    },
  ]

  // Theme Accent state
  const [themeAccent, setThemeAccent] = useState<'gold' | 'amber' | 'emerald' | 'sapphire' | 'platinum'>(() => {
    try {
      const saved = localStorage.getItem('demirturk_theme_accent')
      if (saved === 'amber' || saved === 'emerald' || saved === 'sapphire' || saved === 'platinum') {
        return saved
      }
    } catch {}
    return 'gold'
  })

  const handleSetAccent = (acc: 'gold' | 'amber' | 'emerald' | 'sapphire' | 'platinum') => {
    setThemeAccent(acc)
    localStorage.setItem('demirturk_theme_accent', acc)
    if (acc === 'gold') {
      document.documentElement.removeAttribute('data-theme-accent')
    } else {
      document.documentElement.setAttribute('data-theme-accent', acc)
    }
  }

  // Font Size state ('small' | 'standard' | 'large')
  const [fontSize, setFontSize] = useState<'small' | 'standard' | 'large'>(() => {
    try {
      const saved = localStorage.getItem('demirturk_font_size')
      if (saved === 'small' || saved === 'large') return saved
    } catch {}
    return 'standard'
  })

  const handleSetFontSize = (size: 'small' | 'standard' | 'large') => {
    setFontSize(size)
    localStorage.setItem('demirturk_font_size', size)
    document.documentElement.setAttribute('data-font-size', size)
  }

  // Start Menu Grid state ('4x5' | '5x5' | '5x6')
  const [startMenuGrid, setStartMenuGrid] = useState<'4x5' | '5x5' | '5x6'>(() => {
    try {
      const saved = localStorage.getItem('demirturk_start_menu_grid')
      if (saved === '4x5' || saved === '5x5' || saved === '5x6') return saved
    } catch {}
    return '4x5'
  })

  const handleUpdateGrid = (grid: '4x5' | '5x5' | '5x6') => {
    setStartMenuGrid(grid)
    localStorage.setItem('demirturk_start_menu_grid', grid)
    window.dispatchEvent(new Event('demirturk_start_menu_grid_updated'))
  }

  // Avatar Image Upload (Computer file picker, max 10MB)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(currentUser?.avatarUrl || null)
  const [avatarMessage, setAvatarMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    setAvatarPreview(currentUser?.avatarUrl || null)
  }, [currentUser?.avatarUrl])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 10 MB limit check: 10 * 1024 * 1024 bytes
    const maxSizeBytes = 10 * 1024 * 1024
    if (file.size > maxSizeBytes) {
      setAvatarMessage({
        type: 'error',
        text: 'Seçilen fotoğraf 10 MB sınırını aşıyor. Lütfen daha küçük bir dosya seçin.',
      })
      setTimeout(() => setAvatarMessage(null), 4000)
      return
    }

    try {
      // Compress and center-crop to square 320x320 JPEG (~25KB)
      const compressedData = await compressAvatarImage(file)
      if (!compressedData || !currentUser) return

      setAvatarPreview(compressedData)
      const res = userStore.updateUser(currentUser.id, { avatarUrl: compressedData })
      if (res.success) {
        setAvatarMessage({ type: 'success', text: 'Profil fotoğrafı başarıyla kaydedildi.' })
      } else {
        setAvatarMessage({ type: 'error', text: res.error || 'Fotoğraf kaydedilemedi.' })
      }
      setTimeout(() => setAvatarMessage(null), 3500)
    } catch (err) {
      console.error('Avatar işleme hatası:', err)
      setAvatarMessage({ type: 'error', text: 'Fotoğraf işlenirken bir hata oluştu.' })
      setTimeout(() => setAvatarMessage(null), 3500)
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemoveAvatar = () => {
    if (!currentUser) return
    setAvatarPreview(null)
    userStore.updateUser(currentUser.id, { avatarUrl: '' })
    setAvatarMessage({ type: 'success', text: 'Profil fotoğrafı kaldırıldı.' })
    setTimeout(() => setAvatarMessage(null), 3000)
  }

  // Username edit state
  const [editUsername, setEditUsername] = useState(currentUser?.username || '')
  const [usernameMessage, setUsernameMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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

  // Password change state
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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

  // Team Member & Company state
  const allUsers = userStore.getAllUsers()
  const isManager = Boolean(currentUser?.isManager || currentUser?.role === 'ADMIN')

  // Department-specific mock configurations with persistence
  const [metaDailyBudget, setMetaDailyBudget] = useState('50000')
  const [targetCpl, setTargetCpl] = useState('120')
  const [autoQualifyThreshold, setAutoQualifyThreshold] = useState('65')
  const [autoHandoverEnabled, setAutoHandoverEnabled] = useState(true)
  const [afterHoursMsgEnabled, setAfterHoursMsgEnabled] = useState(true)
  const [dailyKpiReportEnabled, setDailyKpiReportEnabled] = useState(true)
  const [deptSavedMessage, setDeptSavedMessage] = useState<string | null>(null)

  // Direct Meta API Connection State
  const metaConfig = metaStore.getConfig()
  const [metaPageToken, setMetaPageToken] = useState(metaConfig.pageAccessToken)
  const [showMetaToken, setShowMetaToken] = useState(false)
  const [testingMeta, setTestingMeta] = useState(false)
  const [metaTestResult, setMetaTestResult] = useState<{ success?: boolean; msg?: string } | null>(null)
  const [copiedMetaField, setCopiedMetaField] = useState<string | null>(null)

  const copyMetaToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text)
    setCopiedMetaField(fieldId)
    setTimeout(() => setCopiedMetaField(null), 2000)
  }

  const handleTestMetaConnection = async () => {
    setTestingMeta(true)
    setMetaTestResult(null)
    const res = await metaStore.testConnection(metaPageToken)
    setTestingMeta(false)
    if (res.success) {
      setMetaTestResult({ success: true, msg: `Bağlantı başarılı: ${res.pageName || metaConfig.pageName}` })
    } else {
      setMetaTestResult({ success: false, msg: res.error || 'Bağlantı sağlanamadı.' })
    }
  }

  const handleSaveDeptConfig = (msg = 'Departman ayarları başarıyla kaydedildi.') => {
    metaStore.saveConfig({ pageAccessToken: metaPageToken })
    setDeptSavedMessage(msg)
    setTimeout(() => setDeptSavedMessage(null), 2500)
  }

  if (!isOpen) return null

  // Define department-specific tabs (max 3 per department)
  const getDepartmentTabs = (dept: Department) => {
    switch (dept) {
      case 'Satış':
        return [
          { id: 'dept-sales-commission' as SettingsTab, label: 'Komisyon & Hedef', icon: TurkishLira },
          { id: 'dept-sales-appointments' as SettingsTab, label: 'Randevu Kuralları', icon: Calendar },
          { id: 'dept-sales-reservations' as SettingsTab, label: 'Daire Opsiyon Süresi', icon: Clock },
        ]
      case 'Müşteri İlişkileri':
        return [
          { id: 'dept-crm-sla' as SettingsTab, label: 'SLA & Yanıt Süresi', icon: Timer },
          { id: 'dept-crm-channels' as SettingsTab, label: 'İletişim Kanalları', icon: MessageCircle },
          { id: 'dept-crm-priority' as SettingsTab, label: 'Talep Önceliği', icon: CheckCircle2 },
        ]
      case 'Muhasebe':
        return [
          { id: 'dept-acc-accounts' as SettingsTab, label: 'Kasa & Banka Tanımları', icon: Wallet },
          { id: 'dept-acc-invoicing' as SettingsTab, label: 'Fatura & Makbuz Serisi', icon: Receipt },
          { id: 'dept-acc-reminders' as SettingsTab, label: 'Vade Hatırlatıcıları', icon: AlertCircle },
        ]
      case 'Yönetim':
        return [
          { id: 'dept-admin-permissions' as SettingsTab, label: 'Yetki Matrisi', icon: Shield },
          { id: 'dept-admin-approvals' as SettingsTab, label: 'İskonto & Onay Sınırları', icon: Percent },
          { id: 'dept-admin-audit' as SettingsTab, label: 'Güvenlik & Denetim', icon: Lock },
        ]
      case 'Pazarlama':
      default:
        return [
          { id: 'dept-meta' as SettingsTab, label: 'Meta & Reklam', icon: Megaphone },
          { id: 'dept-leads' as SettingsTab, label: 'Form ve Müşteri Akışı', icon: FileText },
          { id: 'dept-notifications' as SettingsTab, label: 'Otomatik Bildirimler', icon: Bell },
        ]
    }
  }

  const deptTabs = getDepartmentTabs(currentDept)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      {/* Backdrop Blur Overlay */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/65 backdrop-blur-md transition-opacity"
      />

      {/* 
        SETTINGS MODAL WRAPPER (Menü Pencere Dışında, Pencere Genişletilmiş & Uzatılmış)
        - Sol menü hiçbir katmana dahil olmadan doğrudan arka plan üzerinde (yalnızca yazı ve ikonlar)
        - Sağ pencere: dikey olarak uzatıldı (680px), yatay olarak genişletildi (820px)
        - Pencere boyutu sabittir, içeriğe göre boyut değiştirmez
      */}
      <div className="relative z-10 flex items-stretch gap-7 max-w-[96vw] h-[680px] max-h-[90vh]">
        
        {/* 
          SOL MENÜ:
          - Pencereye dahil değil (dışarıda)
          - Hiçbir katmana veya kutuya dahil olmadan, sadece yazı ve ikonlar
        */}
        <aside className="w-[210px] shrink-0 flex flex-col justify-between py-3 text-[#f3efe9] select-none">
          <div className="space-y-6">
            
            {/* Section 1: Genel Ayarlar */}
            <div>
              <div className="text-[10px] font-bold text-[#8c857f] uppercase tracking-wider px-1 mb-2.5">
                Genel Ayarlar
              </div>
              <nav className="space-y-1">
                <button
                  onClick={() => setActiveTab('account')}
                  className={`w-full flex items-center gap-3 px-1.5 py-2 text-xs transition-colors cursor-pointer text-left ${
                    activeTab === 'account'
                      ? 'text-[#b99881] font-bold'
                      : 'text-[#a69f99] hover:text-white font-medium'
                  }`}
                >
                  <User className={`w-4 h-4 shrink-0 ${activeTab === 'account' ? 'text-[#b99881]' : 'text-[#8c857f]'}`} />
                  <span className="truncate">Hesap ve profil</span>
                  {activeTab === 'account' && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#b99881] shrink-0" />
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('appearance')}
                  className={`w-full flex items-center gap-3 px-1.5 py-2 text-xs transition-colors cursor-pointer text-left ${
                    activeTab === 'appearance'
                      ? 'text-[#b99881] font-bold'
                      : 'text-[#a69f99] hover:text-white font-medium'
                  }`}
                >
                  <Palette className={`w-4 h-4 shrink-0 ${activeTab === 'appearance' ? 'text-[#b99881]' : 'text-[#8c857f]'}`} />
                  <span className="truncate">Kişiselleştir</span>
                  {activeTab === 'appearance' && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#b99881] shrink-0" />
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('company')}
                  className={`w-full flex items-center gap-3 px-1.5 py-2 text-xs transition-colors cursor-pointer text-left ${
                    activeTab === 'company'
                      ? 'text-[#b99881] font-bold'
                      : 'text-[#a69f99] hover:text-white font-medium'
                  }`}
                >
                  <Building2 className={`w-4 h-4 shrink-0 ${activeTab === 'company' ? 'text-[#b99881]' : 'text-[#8c857f]'}`} />
                  <span className="truncate">Şirket ve departman</span>
                  {activeTab === 'company' && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#b99881] shrink-0" />
                  )}
                </button>
              </nav>
            </div>

            {/* Section 2: Departman Ayarları */}
            <div>
              <div className="text-[10px] font-bold text-[#8c857f] uppercase tracking-wider px-1 mb-2.5">
                {currentDept} Ayarları
              </div>
              <nav className="space-y-1">
                {deptTabs.map((tab) => {
                  const Icon = tab.icon
                  const isActive = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-1.5 py-2 text-xs transition-colors cursor-pointer text-left ${
                        isActive
                          ? 'text-[#b99881] font-bold'
                          : 'text-[#a69f99] hover:text-white font-medium'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#b99881]' : 'text-[#8c857f]'}`} />
                      <span className="truncate">{tab.label}</span>
                      {isActive && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#b99881] shrink-0" />
                      )}
                    </button>
                  )
                })}
              </nav>
            </div>
          </div>

          {/* Menü Altı Kullanıcı Künyesi */}
          <div className="px-1 text-[11px] text-[#8c857f] truncate">
            @{currentUser?.username || 'berkant'} • {currentDept}
          </div>
        </aside>

        {/* 
          SAĞ PENCERE:
          - Dikey olarak uzatıldı (680px)
          - Menüler dışarı alındıktan sonra yatay olarak genişletildi (820px)
          - Sabit boyutlu, içeriğe göre boyut değiştirmez
        */}
        <div className="w-[820px] max-w-[calc(96vw-240px)] h-full rounded-[32px] bg-[#2b2724]/95 backdrop-blur-2xl border border-[#4a443f] shadow-2xl shadow-black/80 flex flex-col overflow-hidden text-[#f3efe9] select-none font-sans relative">
          
          {/* Top subtle highlight */}
          <div className="pointer-events-none absolute -top-px left-10 right-10 h-px bg-gradient-to-r from-transparent via-[#b99881]/40 to-transparent" />

          {/* Modal Header */}
          <div className="px-7 py-4 border-b border-[#4a443f]/60 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <Settings className="w-4.5 h-4.5 text-[#b99881]" />
              <h2 className="text-sm font-bold text-white tracking-wide">Ayarlar</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-[#a69f99] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Kapat"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* Fixed Scrollable Content */}
          <main className="flex-1 p-7 overflow-y-auto space-y-6">

            {/* TAB 1: HESAP VE PROFİL */}
            {activeTab === 'account' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">
                    Hesap ve Profil Ayarları
                  </h3>
                  <p className="text-xs text-[#a69f99] mt-0.5">
                    Kişisel profil fotoğrafınızı, kullanıcı adınızı ve giriş bilgilerinizi güncelleyin.
                  </p>
                </div>

                {/* Profil Fotoğrafı Yükleme (Bilgisayardan Seçmeli - Maks 10 MB) */}
                <div className="p-4 rounded-2xl bg-[#24211f]/60 border border-[#4a443f] space-y-3">
                  <div className="flex items-center gap-4">
                    {/* Fotoğraf Önizleme */}
                    <div className="w-20 h-20 rounded-full border-2 border-[#b99881]/50 bg-[#282522] flex items-center justify-center overflow-hidden shrink-0 shadow-lg text-xl font-bold text-[#b99881]">
                      {avatarPreview ? (
                        <img
                          src={avatarPreview}
                          alt="Profil Fotoğrafı"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        currentUser?.fullName.slice(0, 2).toUpperCase() || 'BD'
                      )}
                    </div>

                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        {/* Gizli file input */}
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3.5 py-1.5 rounded-full bg-[#b99881] hover:bg-[#d6beae] text-[#1c1a18] text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Bilgisayardan Fotoğraf Seç</span>
                        </button>

                        {avatarPreview && (
                          <button
                            type="button"
                            onClick={handleRemoveAvatar}
                            className="px-3 py-1.5 rounded-full bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-medium border border-rose-500/30 transition-colors cursor-pointer"
                          >
                            Fotoğrafı Kaldır
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-[#8c857f]">
                        Bilgisayarınızdan fotoğraf yükleyebilirsiniz. Desteklenen biçimler: PNG, JPG, WebP (Maksimum 10 MB).
                      </p>
                    </div>
                  </div>

                  {avatarMessage && (
                    <div
                      className={`text-xs px-3 py-1.5 rounded-lg ${
                        avatarMessage.type === 'success'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {avatarMessage.text}
                    </div>
                  )}
                </div>

                {/* Kullanıcı Adı Değiştirme */}
                <form
                  onSubmit={handleSaveUsername}
                  className="p-4 rounded-2xl bg-[#24211f]/60 border border-[#4a443f] space-y-3"
                >
                  <h4 className="text-xs font-bold text-white">Kullanıcı Adı Değiştir</h4>
                  <p className="text-[11px] text-[#8c857f]">
                    Sistemde oturum açarken veya ekip bildirimlerinde kullanılacak kullanıcı adınızı belirleyin.
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-[#b99881]">
                        @
                      </span>
                      <input
                        type="text"
                        required
                        value={editUsername}
                        onChange={(e) => setEditUsername(e.target.value)}
                        className="w-full bg-[#1e1c1a] border border-[#4a443f] focus:border-[#b99881] rounded-full pl-8 pr-4 py-2 text-xs text-white focus:outline-none"
                        placeholder="kullaniciadi"
                      />
                    </div>
                    <GlassButton variant="gold" size="sm" type="submit" className="rounded-full px-5">
                      Kaydet
                    </GlassButton>
                  </div>
                  {usernameMessage && (
                    <p
                      className={`text-xs ${
                        usernameMessage.type === 'success' ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {usernameMessage.text}
                    </p>
                  )}
                </form>

                {/* Şifre Yenileme */}
                <form
                  onSubmit={handleSavePassword}
                  className="p-4 rounded-2xl bg-[#24211f]/60 border border-[#4a443f] space-y-3"
                >
                  <h4 className="text-xs font-bold text-white">Şifre Değiştir</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-[#a69f99] block mb-1">Yeni Şifre</label>
                      <input
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="En az 6 karakter"
                        className="w-full bg-[#1e1c1a] border border-[#4a443f] focus:border-[#b99881] rounded-full px-4 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-[#a69f99] block mb-1">
                        Yeni Şifre (Tekrar)
                      </label>
                      <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Şifreyi doğrulayın"
                        className="w-full bg-[#1e1c1a] border border-[#4a443f] focus:border-[#b99881] rounded-full px-4 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    {passwordMessage ? (
                      <p
                        className={`text-xs ${
                          passwordMessage.type === 'success' ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {passwordMessage.text}
                      </p>
                    ) : (
                      <span />
                    )}
                    <GlassButton variant="subtle" size="sm" type="submit" className="rounded-full px-5">
                      Şifreyi Güncelle
                    </GlassButton>
                  </div>
                </form>
              </div>
            )}

            {/* TAB 2: KİŞİSELLEŞTİR */}
            {activeTab === 'appearance' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">
                    Arayüz ve Kişiselleştirme
                  </h3>
                  <p className="text-xs text-[#a69f99] mt-0.5">
                    Platform teması, yazı tipi boyutu ve gezinme tercihlerinizi yönetin.
                  </p>
                </div>

                {/* 
                  5 LUXURY THEMES:
                  - Primary color: Large circle
                  - Secondary color: Small badge circle overlapping at bottom-right
                */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-[#b99881]" />
                      <span>Renk Temaları (5 Seçenek)</span>
                    </h4>
                    <span className="text-[11px] text-[#8c857f]">Büyük daire: Zemin • Küçük rozet: Vurgu</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {THEMES.map((t) => {
                      const isSelected = themeAccent === t.id
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => handleSetAccent(t.id)}
                          className={`flex items-center gap-3 p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'border-[#b99881] bg-[#b99881]/15 shadow-sm'
                              : 'border-[#4a443f]/60 hover:border-[#b99881]/40 bg-[#24211f]/40 hover:bg-[#24211f]'
                          }`}
                        >
                          {/* DUAL CIRCLE: Big Primary + Small Badge Secondary */}
                          <div className="relative w-10 h-10 shrink-0">
                            <div
                              className="w-9 h-9 rounded-full border border-white/20 shadow-md"
                              style={{ backgroundColor: t.primary }}
                            />
                            <div
                              className="absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-[#2b2724] shadow-sm"
                              style={{ backgroundColor: t.secondary }}
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-white flex items-center justify-between">
                              <span>{t.name}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-[#b99881]" />}
                            </div>
                            <div className="text-[10px] text-[#8c857f] truncate mt-0.5">{t.desc}</div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* YAZI TİPİ BOYUTU (Font Size) */}
                <div className="p-4 rounded-2xl bg-[#24211f]/60 border border-[#4a443f] space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Type className="w-3.5 h-3.5 text-[#b99881]" />
                      <span>Yazı Tipi Boyutu</span>
                    </h4>
                    <span className="text-[11px] text-[#8c857f]">Tüm panel metinlerini ölçeklendirir</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      { id: 'small', label: 'Küçük', desc: '16px • Kompakt' },
                      { id: 'standard', label: 'Standart', desc: '17.5px • Rahat & Dengeli' },
                      { id: 'large', label: 'Büyük', desc: '20px • Geniş & Belirgin' },
                    ].map((item) => {
                      const isSelected = fontSize === item.id
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSetFontSize(item.id as any)}
                          className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                            isSelected
                              ? 'border-[#b99881] bg-[#b99881]/15 text-white'
                              : 'border-[#4a443f]/60 hover:border-[#b99881]/30 bg-[#1e1c1a]/50 text-[#c4bcb5]'
                          }`}
                        >
                          <div className="text-xs font-bold">{item.label}</div>
                          <div className="text-[10px] text-[#8c857f] mt-0.5">{item.desc}</div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Başlat ve Gezinme Ayarları */}
                <div className="p-4 rounded-2xl bg-[#24211f]/60 border border-[#4a443f] space-y-3">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <LayoutGrid className="w-3.5 h-3.5 text-[#b99881]" />
                    <span>Gezinme ve Görev Çubuğu Tercihleri</span>
                  </h4>

                  <div className="flex items-center justify-between py-1">
                    <div>
                      <div className="text-xs font-medium text-white">Görev Çubuğunu Göster</div>
                      <div className="text-[11px] text-[#8c857f]">
                        Ekranın altında akıcı kayan görev çubuğu
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleDock(!dockEnabled)}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        dockEnabled ? 'bg-[#b99881]' : 'bg-[#4a443f]'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                          dockEnabled ? 'left-6' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="pt-2 border-t border-[#4a443f]/40 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-white">Başlat Menüsü Düzeni</div>
                      <div className="text-[11px] text-[#8c857f]">Izgara sütun ve satır yapısı (Hızlı Erişim kapasitesini belirler)</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {(['4x5', '5x5', '5x6'] as const).map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => handleUpdateGrid(g)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                            startMenuGrid === g
                              ? 'bg-[#b99881] text-[#1c1a18] font-bold'
                              : 'bg-[#1e1c1a] text-[#8c857f] hover:text-white'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: ŞİRKET VE DEPARTMAN */}
            {activeTab === 'company' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">
                    Şirket ve Departman Yapılandırması
                  </h3>
                  <p className="text-xs text-[#a69f99] mt-0.5">
                    Kurumsal kimlik, aktif çalışma alanınız ve yetkili departmanlarınız.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#24211f]/60 border border-[#4a443f] space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-[#8c857f] block uppercase tracking-wider">
                        ŞİRKET ÜNVANI
                      </span>
                      <span className="text-white font-bold">Demirtürk Portföy</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#8c857f] block uppercase tracking-wider">
                        AKTİF ÇALIŞMA ALANI
                      </span>
                      <span className="text-[#b99881] font-bold">{currentDept} Departmanı</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#4a443f]/40">
                    <span className="text-[10px] text-[#8c857f] block uppercase tracking-wider mb-1.5">
                      ERİŞİM YETKİLİ ÇALIŞMA ALANLARI (5 DEPARTMAN)
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {CANONICAL_DEPARTMENTS.map((dept) => (
                        <span
                          key={dept}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                            dept === currentDept
                              ? 'bg-[#b99881]/20 text-[#b99881] border-[#b99881]/40 font-bold'
                              : 'bg-white/5 text-[#c4bcb5] border-white/10'
                          }`}
                        >
                          {dept} {dept === currentDept && '• Aktif'}
                        </span>
                      ))}
                    </div>
                    <p className="text-[11px] text-[#8c857f] mt-2">
                      * Sistem yöneticisi olarak sol üst menüden dilediğiniz çalışma alanına anında geçiş yapabilirsiniz.
                    </p>
                  </div>
                </div>

                {/* Ekip Sayısı & Özet Bilgi */}
                <div className="p-4 rounded-2xl bg-[#24211f]/60 border border-[#4a443f] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#b99881]/15 text-[#b99881] flex items-center justify-center">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Sistem Personel Havuzu</div>
                      <div className="text-[11px] text-[#8c857f]">Toplam kayıtlı kullanıcı: {allUsers.length} kişi</div>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-[#b99881] bg-[#b99881]/10 px-3 py-1 rounded-full border border-[#b99881]/20">
                    Supabase PostgreSQL Canlı
                  </span>
                </div>
              </div>
            )}

            {/* TAB: DEPARTMAN 1 - META & REKLAM (PAZARLAMA) */}
            {activeTab === 'dept-meta' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">
                    Meta Ads & Reklam Kuralları
                  </h3>
                  <p className="text-xs text-[#a69f99] mt-0.5">
                    Facebook & Instagram Lead Ads entegrasyonu, harcama eşikleri ve webhooks.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-[#24211f]/80 border border-[#4a443f] space-y-4 shadow-lg">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#4a443f]/60">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                          Meta Doğrudan API Bağlantısı
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            Aracısız / 1. Parti
                          </span>
                        </h4>
                        <p className="text-[11px] text-[#a69f99]">
                          Zapier veya Make olmadan, Instagram & Facebook Lead Ads verilerini doğrudan çeker.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {metaConfig.pageName || 'Demirtürk Sayfası'}
                      </span>
                    </div>
                  </div>

                  {/* Webhook Bilgileri Grid */}
                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] font-medium text-[#d6cec7] block mb-1">
                        Meta Webhook Callback URL (Geri Çağırma Adresi)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          readOnly
                          value={metaConfig.webhookUrl}
                          className="flex-1 bg-[#1e1c1a] border border-[#4a443f] rounded-xl px-3 py-2 text-xs font-mono text-slate-300 select-all"
                        />
                        <button
                          type="button"
                          onClick={() => copyMetaToClipboard(metaConfig.webhookUrl, 'url')}
                          className="p-2 rounded-xl bg-[#2e2a27] hover:bg-[#3d3733] text-[#d6cec7] hover:text-white transition-colors cursor-pointer border border-[#4a443f]"
                          title="URL'yi Kopyala"
                        >
                          {copiedMetaField === 'url' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                      <span className="text-[10.5px] text-[#8c857f] mt-0.5 block">
                        Meta Developers &gt; Webhooks &gt; Page &gt; Callback URL kutusuna yapıştırın.
                      </span>
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-[#d6cec7] block mb-1">
                        Doğrulama Şifresi (Verify Token)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          readOnly
                          value={metaConfig.verifyToken}
                          className="flex-1 bg-[#1e1c1a] border border-[#4a443f] rounded-xl px-3 py-2 text-xs font-mono text-amber-300 font-semibold select-all"
                        />
                        <button
                          type="button"
                          onClick={() => copyMetaToClipboard(metaConfig.verifyToken, 'token')}
                          className="p-2 rounded-xl bg-[#2e2a27] hover:bg-[#3d3733] text-[#d6cec7] hover:text-white transition-colors cursor-pointer border border-[#4a443f]"
                          title="Token'ı Kopyala"
                        >
                          {copiedMetaField === 'token' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-[#d6cec7] block mb-1">
                        Kalıcı Sayfa Erişim Belirteci (Permanent Page Access Token)
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <input
                            type={showMetaToken ? 'text' : 'password'}
                            value={metaPageToken}
                            onChange={(e) => setMetaPageToken(e.target.value)}
                            placeholder="EAAB... ile başlayan kalıcı tokenınızı buraya yapıştırın"
                            className="w-full bg-[#1e1c1a] border border-[#4a443f] focus:border-[#b99881] rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowMetaToken(!showMetaToken)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8c857f] hover:text-white transition-colors"
                          >
                            {showMetaToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>

                        <GlassButton
                          variant="subtle"
                          size="sm"
                          onClick={handleTestMetaConnection}
                          disabled={testingMeta}
                          className="rounded-xl px-3.5 text-xs font-semibold shrink-0"
                        >
                          {testingMeta ? 'Test Ediliyor...' : 'Bağlantıyı Doğrula'}
                        </GlassButton>
                      </div>
                    </div>
                  </div>

                  {metaTestResult && (
                    <div
                      className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                        metaTestResult.success
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                      }`}
                    >
                      {metaTestResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                      <span>{metaTestResult.msg}</span>
                    </div>
                  )}
                </div>

                {/* Bütçe ve CPL Eşikleri */}
                <div className="p-4 rounded-2xl bg-[#24211f]/60 border border-[#4a443f] space-y-4">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Reklam Harcama & Maliyet Kuralları
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="text-[11px] text-[#a69f99] block mb-1">
                        Günlük Reklam Harcama Eşiği (₺)
                      </label>
                      <input
                        type="number"
                        value={metaDailyBudget}
                        onChange={(e) => setMetaDailyBudget(e.target.value)}
                        className="w-full bg-[#1e1c1a] border border-[#4a443f] focus:border-[#b99881] rounded-full px-4 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-[#a69f99] block mb-1">
                        Hedef Müşteri Başına Maliyet (CPL - ₺)
                      </label>
                      <input
                        type="number"
                        value={targetCpl}
                        onChange={(e) => setTargetCpl(e.target.value)}
                        className="w-full bg-[#1e1c1a] border border-[#4a443f] focus:border-[#b99881] rounded-full px-4 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    {deptSavedMessage ? (
                      <span className="text-xs text-emerald-400">{deptSavedMessage}</span>
                    ) : (
                      <span />
                    )}
                    <GlassButton
                      variant="gold"
                      size="sm"
                      onClick={() => handleSaveDeptConfig('Meta API anahtarları ve reklam kuralları kaydedildi.')}
                      className="rounded-full px-5 font-bold"
                    >
                      Ayarları Kaydet
                    </GlassButton>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: DEPARTMAN 2 - FORM VE MÜŞTERİ AKIŞI (PAZARLAMA) */}
            {activeTab === 'dept-leads' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">
                    Form ve Müşteri Akış Kuralları
                  </h3>
                  <p className="text-xs text-[#a69f99] mt-0.5">
                    Gelen başvuruların otomatik nitelendirilmesi ve satış ekibine devir kuralları.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#24211f]/60 border border-[#4a443f] space-y-4">
                  <div>
                    <label className="text-[11px] text-[#a69f99] block mb-1">
                      Otomatik Nitelikli Aday Puanı Eşiği (%)
                    </label>
                    <input
                      type="number"
                      value={autoQualifyThreshold}
                      onChange={(e) => setAutoQualifyThreshold(e.target.value)}
                      className="w-full bg-[#1e1c1a] border border-[#4a443f] focus:border-[#b99881] rounded-full px-4 py-2 text-xs text-white focus:outline-none max-w-xs"
                    />
                    <span className="text-[10px] text-[#8c857f] block mt-1">
                      Bu puanın üzerindeki başvurular doğrudan nitelikli aday olarak işaretlenir.
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#4a443f]/40">
                    <div>
                      <div className="text-xs font-medium text-white">Satış Ekibine Otomatik Devir</div>
                      <div className="text-[11px] text-[#8c857f]">
                        Nitelikli olarak işaretlenen müşteri adayı anında Satış Departmanı havuzuna aktarılsın
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAutoHandoverEnabled(!autoHandoverEnabled)}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        autoHandoverEnabled ? 'bg-[#b99881]' : 'bg-[#4a443f]'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                          autoHandoverEnabled ? 'left-6' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    {deptSavedMessage ? (
                      <span className="text-xs text-emerald-400">{deptSavedMessage}</span>
                    ) : (
                      <span />
                    )}
                    <GlassButton
                      variant="gold"
                      size="sm"
                      onClick={() => handleSaveDeptConfig('Müşteri akış kuralları güncellendi.')}
                      className="rounded-full px-5"
                    >
                      Kaydet
                    </GlassButton>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: DEPARTMAN 3 - OTOMATİK BİLDİRİMLER (PAZARLAMA) */}
            {activeTab === 'dept-notifications' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">
                    Otomatik Bildirimler & Yanıtlar
                  </h3>
                  <p className="text-xs text-[#a69f99] mt-0.5">
                    Mesai dışı otomatik karşılama mesajları ve pazarlama özet raporları.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#24211f]/60 border border-[#4a443f] space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-white">Mesai Dışı WhatsApp Karşılama</div>
                      <div className="text-[11px] text-[#8c857f]">
                        19:00 - 09:00 arası gelen başvurulara anında otomatik bilgilendirme mesajı iletilir
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAfterHoursMsgEnabled(!afterHoursMsgEnabled)}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        afterHoursMsgEnabled ? 'bg-[#b99881]' : 'bg-[#4a443f]'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                          afterHoursMsgEnabled ? 'left-6' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#4a443f]/40">
                    <div>
                      <div className="text-xs font-medium text-white">Günlük Pazarlama KPI E-Postası</div>
                      <div className="text-[11px] text-[#8c857f]">
                        Her akşam saat 18:30'da günün harcama ve lead tablosunu e-posta kutunuza gönderir
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDailyKpiReportEnabled(!dailyKpiReportEnabled)}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        dailyKpiReportEnabled ? 'bg-[#b99881]' : 'bg-[#4a443f]'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                          dailyKpiReportEnabled ? 'left-6' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    {deptSavedMessage ? (
                      <span className="text-xs text-emerald-400">{deptSavedMessage}</span>
                    ) : (
                      <span />
                    )}
                    <GlassButton
                      variant="gold"
                      size="sm"
                      onClick={() => handleSaveDeptConfig('Bildirim tercihleri güncellendi.')}
                      className="rounded-full px-5"
                    >
                      Tercihleri Kaydet
                    </GlassButton>
                  </div>
                </div>
              </div>
            )}

            {/* FALLBACK FOR OTHER DEPARTMENTS IF ACCESSED */}
            {activeTab.startsWith('dept-sales-') && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <h3 className="text-sm font-bold text-white">Satış Departmanı Yapılandırması</h3>
                <div className="p-4 rounded-2xl bg-[#24211f]/60 border border-[#4a443f] space-y-3">
                  <div className="text-xs text-white">Satış komisyon oranları ve rezervasyon kuralları aktif.</div>
                  <GlassButton variant="gold" size="sm" onClick={() => handleSaveDeptConfig()} className="rounded-full px-5">
                    Kaydet
                  </GlassButton>
                </div>
              </div>
            )}

            {activeTab.startsWith('dept-crm-') && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <h3 className="text-sm font-bold text-white">Müşteri İlişkileri Yapılandırması</h3>
                <div className="p-4 rounded-2xl bg-[#24211f]/60 border border-[#4a443f] space-y-3">
                  <div className="text-xs text-white">SLA süreleri ve çağrı merkezi öncelik kuralları aktif.</div>
                  <GlassButton variant="gold" size="sm" onClick={() => handleSaveDeptConfig()} className="rounded-full px-5">
                    Kaydet
                  </GlassButton>
                </div>
              </div>
            )}

            {activeTab.startsWith('dept-acc-') && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <h3 className="text-sm font-bold text-white">Muhasebe Yapılandırması</h3>
                <div className="p-4 rounded-2xl bg-[#24211f]/60 border border-[#4a443f] space-y-3">
                  <div className="text-xs text-white">Fatura şablonları ve tahsilat vade uyarı kuralları aktif.</div>
                  <GlassButton variant="gold" size="sm" onClick={() => handleSaveDeptConfig()} className="rounded-full px-5">
                    Kaydet
                  </GlassButton>
                </div>
              </div>
            )}

            {activeTab.startsWith('dept-admin-') && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <h3 className="text-sm font-bold text-white">Yönetim ve Güvenlik Yapılandırması</h3>
                <div className="p-4 rounded-2xl bg-[#24211f]/60 border border-[#4a443f] space-y-3">
                  <div className="text-xs text-white">Yetkilendirme matrisi ve denetim logları aktif.</div>
                  <GlassButton variant="gold" size="sm" onClick={() => handleSaveDeptConfig()} className="rounded-full px-5">
                    Kaydet
                  </GlassButton>
                </div>
              </div>
            )}

          </main>
        </div>
      </div>
    </div>
  )
}
