import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
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
  RotateCcw,
} from 'lucide-react'
import { AppUser, Department, generateInitialPassword, generateUsername, userStore } from '@/services/userStore'
import { metaStore } from '@/services/metaStore'
import { trashStore, TrashItem } from '@/services/trashStore'
import { CANONICAL_DEPARTMENTS } from '@/types/department'
import { GlassButton } from '@/components/ui/GlassButton'
import { PermissionsMatrixPanel } from './PermissionsMatrixPanel'
import { permissionService } from '@/services/permissionService'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  currentUser: AppUser | null
}

export type SettingsTab =
  | 'account'
  | 'appearance'
  | 'company'
  | 'permissions'
  | 'trash'
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

export interface AccentColorOption {
  id: string
  name: string
  color: string
  hover: string
  badge?: string
}

export const ACCENT_COLOR_OPTIONS: AccentColorOption[] = [
  { id: 'indigo', name: 'İndigo', color: '#5c6ac4', hover: '#4c59b0', badge: 'Varsayılan' },
  { id: 'beige', name: 'Bej', color: '#b99881', hover: '#a6856e' },
  { id: 'sage', name: 'Vurgu Yeşili', color: '#657a72', hover: '#556860' },
  { id: 'burgundy', name: 'Burgonya', color: '#8b3a4a', hover: '#752e3c' },
  { id: 'pastel-yellow', name: 'Pastel Sarı', color: '#d4a359', hover: '#bf8f47' },
  { id: 'pastel-purple', name: 'Pastel Mor', color: '#8b6bb1', hover: '#78599d' },
  { id: 'lavender', name: 'Lavanta', color: '#9381ff', hover: '#7f6ce6' },
  { id: 'pastel-rose', name: 'Pastel Gül', color: '#c97a8b', hover: '#b56677' },
  { id: 'pastel-sky', name: 'Pastel Mavi', color: '#6b9ac4', hover: '#5987b0' },
  { id: 'pastel-mint', name: 'Pastel Mint', color: '#68a691', hover: '#56927e' },
]

export function applyAccentColorChoice(accentId: string) {
  if (typeof document === 'undefined') return
  const found = ACCENT_COLOR_OPTIONS.find((item) => item.id === accentId) || ACCENT_COLOR_OPTIONS[0]
  document.documentElement.style.setProperty('--accent-color', found.color)
  document.documentElement.style.setProperty('--accent-light', found.color)
  document.documentElement.style.setProperty('--accent-hover', found.hover)
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

  // Custom Accent Color state ('indigo' default)
  const [accentColorId, setAccentColorId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('demirturk_accent_color')
      if (saved && ACCENT_COLOR_OPTIONS.some((o) => o.id === saved)) {
        return saved
      }
    } catch {}
    return 'indigo'
  })

  const activeAccentObj = ACCENT_COLOR_OPTIONS.find((o) => o.id === accentColorId) || ACCENT_COLOR_OPTIONS[0]

  const handleSelectAccentColor = (id: string) => {
    setAccentColorId(id)
    localStorage.setItem('demirturk_accent_color', id)
    applyAccentColorChoice(id)
  }

  // 6 Luxury Themes (Primary big circle + Secondary small badge)
  const THEMES: {
    id: 'gold' | 'light' | 'amber' | 'emerald' | 'sapphire' | 'platinum'
    name: string
    desc: string
    primary: string
    secondary: string
  }[] = [
    {
      id: 'gold',
      name: 'Reelms Ana Tema (Varsayılan)',
      desc: `Kırık beyaz (#f5f5f2), kart (#ffffff), nav (#e3e5e1) & vurgu (${activeAccentObj.name})`,
      primary: '#F4F0E7',
      secondary: activeAccentObj.color,
    },
    {
      id: 'light',
      name: 'Reelms Açık Ton',
      desc: `Kırık beyaz (#f5f5f2), kart (#ffffff), ikincil (#ebece9) & vurgu (${activeAccentObj.name})`,
      primary: '#ffffff',
      secondary: activeAccentObj.color,
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
  const [themeAccent, setThemeAccent] = useState<'gold' | 'light' | 'amber' | 'emerald' | 'sapphire' | 'platinum'>(() => {
    try {
      const saved = localStorage.getItem('demirturk_theme_accent')
      if (saved === 'light' || saved === 'amber' || saved === 'emerald' || saved === 'sapphire' || saved === 'platinum') {
        return saved
      }
    } catch {}
    return 'gold'
  })

  const handleSetAccent = (acc: 'gold' | 'light' | 'amber' | 'emerald' | 'sapphire' | 'platinum') => {
    setThemeAccent(acc)
    localStorage.setItem('demirturk_theme_accent', acc)
    if (acc === 'gold') {
      document.documentElement.removeAttribute('data-theme-accent')
      applyAccentColorChoice(accentColorId)
    } else if (acc === 'light') {
      document.documentElement.setAttribute('data-theme-accent', acc)
      applyAccentColorChoice(accentColorId)
    } else {
      document.documentElement.setAttribute('data-theme-accent', acc)
      document.documentElement.style.removeProperty('--accent-color')
      document.documentElement.style.removeProperty('--accent-light')
      document.documentElement.style.removeProperty('--accent-hover')
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
  const [allUsers, setAllUsers] = useState<AppUser[]>(() => userStore.getAllUsers())
  const isManager = Boolean(currentUser?.isManager || currentUser?.role === 'ADMIN' || currentUser?.permissions?.canManageTeam)
  const [newMemberFullName, setNewMemberFullName] = useState('')
  const [newMemberDepartment, setNewMemberDepartment] = useState<Department>('Satış')
  const [createdMemberInfo, setCreatedMemberInfo] = useState<{
    fullName: string
    username: string
    password: string
    department: Department
  } | null>(null)
  const [copiedMemberPass, setCopiedMemberPass] = useState(false)

  useEffect(() => {
    const unsub = userStore.subscribe(() => {
      setAllUsers(userStore.getAllUsers())
    })
    return unsub
  }, [])

  const previewMemberUsername = newMemberFullName.trim()
    ? generateUsername(newMemberFullName, allUsers)
    : ''

  const handleAddTeamMember = (e: React.FormEvent) => {
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
    setCreatedMemberInfo({
      fullName: res.user.fullName,
      username: res.user.username,
      password: res.generatedPassword,
      department: res.user.department,
    })
    setNewMemberFullName('')
  }

  // Department-specific mock configurations with persistence
  const [metaDailyBudget, setMetaDailyBudget] = useState('50000')
  const [targetCpl, setTargetCpl] = useState('120')
  const [autoQualifyThreshold, setAutoQualifyThreshold] = useState('65')
  const [autoHandoverEnabled, setAutoHandoverEnabled] = useState(true)
  const [afterHoursMsgEnabled, setAfterHoursMsgEnabled] = useState(true)
  const [dailyKpiReportEnabled, setDailyKpiReportEnabled] = useState(true)
  const [deptSavedMessage, setDeptSavedMessage] = useState<string | null>(null)

  // Direct Meta API & Conversions API (CAPI) Connection State
  const metaConfig = metaStore.getConfig()
  const [metaPageToken, setMetaPageToken] = useState(metaConfig.pageAccessToken)
  const [showMetaToken, setShowMetaToken] = useState(false)
  const [testingMeta, setTestingMeta] = useState(false)
  const [metaTestResult, setMetaTestResult] = useState<{ success?: boolean; msg?: string } | null>(null)
  const [copiedMetaField, setCopiedMetaField] = useState<string | null>(null)

  // Meta CAPI (CRM Conversion Leads) State
  const [metaDatasetId, setMetaDatasetId] = useState(metaConfig.datasetId || '')
  const [metaCapiToken, setMetaCapiToken] = useState(metaConfig.capiAccessToken || '')
  const [metaTestEventCode, setMetaTestEventCode] = useState(metaConfig.testEventCode || '')
  const [metaAutoSyncStages, setMetaAutoSyncStages] = useState(metaConfig.autoSyncStages ?? true)
  const [showCapiToken, setShowCapiToken] = useState(false)
  const [testingCapi, setTestingCapi] = useState(false)
  const [capiTestResult, setCapiTestResult] = useState<{ success: boolean; msg: string } | null>(null)
  const [capiLogs, setCapiLogs] = useState(() => metaStore.getCapiLogs())
  const [trashItems, setTrashItems] = useState<TrashItem[]>(() => trashStore.getAll())
  const [trashDeptFilter, setTrashDeptFilter] = useState<string>('ALL')
  const [trashNotice, setTrashNotice] = useState<string | null>(null)

  useEffect(() => {
    const unsub = metaStore.subscribe(() => {
      setCapiLogs(metaStore.getCapiLogs())
    })
    const unsubTrash = trashStore.subscribe(() => {
      setTrashItems(trashStore.getAll())
    })
    return () => {
      unsub()
      unsubTrash()
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      setTrashItems(trashStore.getAll())
    }
  }, [isOpen, activeTab])

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

  const handleTestCapiConnection = async () => {
    setTestingCapi(true)
    setCapiTestResult(null)
    const res = await metaStore.sendTestCapiEvent({
      datasetId: metaDatasetId,
      capiAccessToken: metaCapiToken || metaPageToken,
      testEventCode: metaTestEventCode,
    })
    setTestingCapi(false)
    setCapiTestResult({ success: res.success, msg: res.message })
    setCapiLogs(metaStore.getCapiLogs())
  }

  const handleSaveDeptConfig = (msg = 'Departman ayarları başarıyla kaydedildi.') => {
    metaStore.saveConfig({
      pageAccessToken: metaPageToken,
      datasetId: metaDatasetId.trim(),
      capiAccessToken: metaCapiToken.trim(),
      testEventCode: metaTestEventCode.trim(),
      autoSyncStages: metaAutoSyncStages,
    })
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
          { id: 'dept-meta' as SettingsTab, label: 'Meta & Dönüşümler API', icon: Megaphone },
          { id: 'dept-admin-permissions' as SettingsTab, label: 'Yetki Matrisi', icon: Shield },
          { id: 'dept-admin-approvals' as SettingsTab, label: 'İskonto & Onay Sınırları', icon: Percent },
          { id: 'dept-admin-audit' as SettingsTab, label: 'Güvenlik & Denetim', icon: Lock },
        ]
      case 'Kreatif':
        return [
          { id: 'dept-notifications' as SettingsTab, label: 'Özel Gün & Revize Bildirimleri', icon: Bell },
          { id: 'dept-leads' as SettingsTab, label: 'Kreatif Onay & Brief Akışı', icon: FileText },
        ]
      case 'Pazarlama':
      default:
        return [
          { id: 'dept-meta' as SettingsTab, label: 'Meta & Dönüşümler API', icon: Megaphone },
          { id: 'dept-leads' as SettingsTab, label: 'Form ve Müşteri Akışı', icon: FileText },
          { id: 'dept-notifications' as SettingsTab, label: 'Otomatik Bildirimler', icon: Bell },
        ]
    }
  }

  const deptTabs = getDepartmentTabs(currentDept)

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      {/* Backdrop Blur Overlay */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/65 backdrop-blur-md transition-opacity"
      />

      {/* SETTINGS MODAL WRAPPER */}
      <div className="relative z-10 flex items-stretch gap-5 max-w-[96vw] h-[680px] max-h-[90vh]">
        {/* SOL MENÜ (Katmansız, doğrudan liste) */}
        <aside className="modal-layerless-aside w-[226px] shrink-0 flex flex-col justify-between py-3 text-[#f5f5f2] select-none">
          <div className="flex-1 overflow-y-auto pr-3.5 space-y-6">
            
            {/* Section 1: Genel Ayarlar */}
            <div>
              <div className="modal-aside-heading text-[10px] font-bold uppercase tracking-wider px-3 mb-2">
                Genel Ayarlar
              </div>
              <nav className="space-y-1">
                <button
                  onClick={() => setActiveTab('account')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-full text-xs transition-colors cursor-pointer text-left ${
                    activeTab === 'account'
                      ? 'bg-[#b99881] text-white font-bold is-active-aside-btn'
                      : 'hover:bg-white/12 font-medium'
                  }`}
                >
                  <User className="w-4 h-4 shrink-0" />
                  <span className="truncate">Hesap ve profil</span>
                </button>

                <button
                  onClick={() => setActiveTab('appearance')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-full text-xs transition-colors cursor-pointer text-left ${
                    activeTab === 'appearance'
                      ? 'bg-[#b99881] text-white font-bold is-active-aside-btn'
                      : 'hover:bg-white/12 font-medium'
                  }`}
                >
                  <Palette className="w-4 h-4 shrink-0" />
                  <span className="truncate">Kişiselleştir</span>
                </button>

                <button
                  onClick={() => setActiveTab('company')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-full text-xs transition-colors cursor-pointer text-left ${
                    activeTab === 'company'
                      ? 'bg-[#b99881] text-white font-bold is-active-aside-btn'
                      : 'hover:bg-white/12 font-medium'
                  }`}
                >
                  <Building2 className="w-4 h-4 shrink-0" />
                  <span className="truncate">Şirket ve departman</span>
                </button>

                {permissionService.canManagePermissions(currentUser) && (
                  <button
                    onClick={() => setActiveTab('permissions')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-full text-xs transition-colors cursor-pointer text-left ${
                      activeTab === 'permissions'
                        ? 'bg-[#b99881] text-white font-bold is-active-aside-btn'
                        : 'hover:bg-white/12 font-medium'
                    }`}
                  >
                    <Shield className="w-4 h-4 shrink-0" />
                    <span className="truncate">Yetkiler</span>
                  </button>
                )}

                <button
                  onClick={() => setActiveTab('trash')}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-full text-xs transition-colors cursor-pointer text-left ${
                    activeTab === 'trash'
                      ? 'bg-[#b99881] text-white font-bold is-active-aside-btn'
                      : 'hover:bg-white/12 font-medium'
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <Trash2 className="w-4 h-4 shrink-0" />
                    <span className="truncate">Çöp Kutusu</span>
                  </span>
                  {trashItems.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-white/15">
                      {trashItems.length}
                    </span>
                  )}
                </button>
              </nav>
            </div>

            {/* Section 2: Departman Ayarları */}
            <div>
              <div className="modal-aside-heading text-[10px] font-bold uppercase tracking-wider px-3 mb-2">
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
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-full text-xs transition-colors cursor-pointer text-left ${
                        isActive
                          ? 'bg-[#b99881] text-white font-bold is-active-aside-btn'
                          : 'hover:bg-white/12 font-medium'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{tab.label}</span>
                    </button>
                  )
                })}
              </nav>
            </div>
          </div>

          {/* Menü Altı Kullanıcı Künyesi */}
          <div className="modal-aside-heading px-3 pt-2 text-[11px] truncate">
            @{currentUser?.username || 'berkant'} • {currentDept}
          </div>
        </aside>

        {/* SAĞ PENCERE */}
        <div className="glass-modal w-[820px] max-w-[calc(96vw-242px)] h-full rounded-[32px] bg-[#282522] border border-[#4a443f] shadow-2xl flex flex-col overflow-hidden text-[#f3efe9] select-none font-sans relative">
          {/* Modal Header */}
          <div className="px-7 pt-5 pb-2 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <Settings className="w-4.5 h-4.5 text-[#b99881]" />
              <h2 className="text-sm font-bold text-white tracking-wide">Ayarlar</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-[#a69f99] hover:text-white hover:bg-black/5 transition-colors cursor-pointer"
              title="Kapat"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* Fixed Scrollable Content */}
          <div className="flex-1 p-7 pt-4 overflow-y-auto space-y-6">

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
                      <span>Renk Temaları (6 Seçenek)</span>
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

                {/* VURGU RENGİ (ACCENT COLOR) SEÇİCİ */}
                <div className="p-4 rounded-2xl bg-[#24211f]/60 border border-[#4a443f] space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#b99881]" />
                      <span>Vurgu Rengi</span>
                    </h4>
                    <span className="text-[11px] text-[#8c857f]">
                      Seçili: <strong className="text-white">{activeAccentObj.name}</strong> ({activeAccentObj.color})
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {ACCENT_COLOR_OPTIONS.map((opt, idx) => {
                      const isSelected = accentColorId === opt.id
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleSelectAccentColor(opt.id)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-full border text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'border-[#b99881] bg-[#b99881]/15 shadow-sm'
                              : 'border-[#4a443f]/60 hover:border-[#b99881]/40 bg-[#1e1c1a]/50'
                          }`}
                          title={`${idx + 1}. ${opt.name} (${opt.color})`}
                        >
                          <span
                            className="w-4 h-4 rounded-full shrink-0 border border-black/15 shadow-sm flex items-center justify-center"
                            style={{ backgroundColor: opt.color }}
                          >
                            {isSelected && (
                              <span className="w-1.5 h-1.5 rounded-full bg-white shadow-sm" />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-bold text-white truncate">
                              {opt.name}
                            </div>
                            <div className="text-[9px] text-[#8c857f] truncate font-mono">
                              {opt.badge ? opt.badge : opt.color}
                            </div>
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
                    Kurumsal kimlik, departmanınız ve şirket çalışanları yönetimi.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#24211f]/60 border border-[#4a443f] space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-[#8c857f] block uppercase tracking-wider">
                        ŞİRKET ÜNVANI
                      </span>
                      <span className="text-white font-bold">
                        {currentUser?.companyName || 'Demirtürk Portföy'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#8c857f] block uppercase tracking-wider">
                        AKTİF ÇALIŞMA ALANI
                      </span>
                      <span className="text-[#b99881] font-bold">{currentDept} Departmanı</span>
                    </div>
                  </div>

                  {(() => {
                    const userAllowedDepts: Department[] =
                      currentUser?.role === 'ADMIN'
                        ? CANONICAL_DEPARTMENTS
                        : Array.isArray(currentUser?.departments) && currentUser.departments.length > 0
                        ? currentUser.departments
                        : [currentDept]
                    return (
                      <div className="pt-2 border-t border-[#4a443f]/40">
                        <span className="text-[10px] text-[#8c857f] block uppercase tracking-wider mb-1.5">
                          YETKİLİ ÇALIŞMA ALANI ({userAllowedDepts.length} DEPARTMAN)
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {userAllowedDepts.map((dept) => (
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
                      </div>
                    )
                  })()}
                </div>

                {/* YÖNETİCİ İSE: EKİP ÜYESİ EKLE & ÇALIŞAN LİSTESİ */}
                {isManager && (
                  <>
                    <form
                      onSubmit={handleAddTeamMember}
                      className="p-4 rounded-2xl bg-[#24211f]/60 border border-[#4a443f] space-y-3.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <UserPlus className="w-4 h-4 text-[#b99881]" />
                          <h4 className="text-xs font-bold text-white">Ekip Üyesi Ekle</h4>
                        </div>
                        <span className="text-[11px] text-[#8c857f]">
                          Otomatik 6 haneli sayısal şifre verilir
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                        <div className="sm:col-span-6">
                          <label className="text-[11px] text-[#a69f99] block mb-1">
                            Adı Soyadı *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Örn: Ayşe Demir"
                            value={newMemberFullName}
                            onChange={(e) => setNewMemberFullName(e.target.value)}
                            className="w-full bg-[#1e1c1a] border border-[#4a443f] focus:border-[#b99881] rounded-full px-4 py-2 text-xs text-white focus:outline-none"
                          />
                          {previewMemberUsername && (
                            <span className="text-[10.5px] text-[#b99881] mt-1 block font-mono pl-2">
                              Kullanıcı adı: @{previewMemberUsername}
                            </span>
                          )}
                        </div>

                        <div className="sm:col-span-4">
                          <label className="text-[11px] text-[#a69f99] block mb-1">
                            Departman *
                          </label>
                          <select
                            value={newMemberDepartment}
                            onChange={(e) => setNewMemberDepartment(e.target.value as Department)}
                            className="w-full bg-[#1e1c1a] border border-[#4a443f] focus:border-[#b99881] rounded-full px-3.5 py-2 text-xs text-white focus:outline-none cursor-pointer"
                          >
                            {CANONICAL_DEPARTMENTS.map((dept) => (
                              <option key={dept} value={dept}>
                                {dept}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="sm:col-span-2 sm:pt-[21px]">
                          <GlassButton
                            type="submit"
                            variant="gold"
                            size="sm"
                            className="w-full rounded-full py-2 justify-center font-bold"
                          >
                            Ekle
                          </GlassButton>
                        </div>
                      </div>

                      {createdMemberInfo && (
                        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{createdMemberInfo.fullName} ({createdMemberInfo.department}) eklendi</span>
                            </div>
                            <div className="text-xs text-[#f3efe9]">
                              Kullanıcı Adı:{' '}
                              <span className="font-mono font-bold text-white">
                                {createdMemberInfo.username}
                              </span>{' '}
                              • 6 Haneli Şifre:{' '}
                              <span className="font-mono font-bold text-amber-300 tracking-wider">
                                {createdMemberInfo.password}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(
                                  `Kullanıcı Adı: ${createdMemberInfo.username}\nŞifre: ${createdMemberInfo.password}`
                                )
                                setCopiedMemberPass(true)
                                setTimeout(() => setCopiedMemberPass(false), 2000)
                              }}
                              className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-[11px] font-semibold text-white flex items-center gap-1 cursor-pointer"
                            >
                              {copiedMemberPass ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span>Kopyalandı</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Kopyala</span>
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setCreatedMemberInfo(null)}
                              className="p-1 text-[#a69f99] hover:text-white cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </form>

                    {/* Kayıtlı Şirket Çalışanları Listesi */}
                    <div className="p-4 rounded-2xl bg-[#24211f]/60 border border-[#4a443f] space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-[#b99881]" />
                          <span>Şirket Çalışanları ({allUsers.length})</span>
                        </h4>
                      </div>

                      <div className="divide-y divide-[#4a443f]/40 max-h-[210px] overflow-y-auto pr-1">
                        {allUsers.map((u) => (
                          <div
                            key={u.id}
                            className="py-2.5 flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="min-w-0">
                              <div className="font-bold text-white truncate">
                                {u.fullName}{' '}
                                <span className="font-mono font-normal text-[#b99881]">
                                  @{u.username}
                                </span>
                              </div>
                              <div className="text-[11px] text-[#8c857f]">
                                {u.department} • Şifre:{' '}
                                <span className="font-mono text-[#d6beae] font-semibold">
                                  {u.password}
                                </span>
                              </div>
                            </div>

                            {u.id !== currentUser?.id && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm(`${u.fullName} adlı kullanıcıyı silmek istediğinize emin misiniz?`)) {
                                    userStore.deleteUser(u.id)
                                  }
                                }}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 cursor-pointer shrink-0"
                                title="Kullanıcıyı Sil"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
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

                {/* META DÖNÜŞÜMLER API'Sİ (CAPI - CRM CONVERSION LEADS) */}
                <div className="p-5 rounded-2xl bg-[#24211f]/80 border border-[#4a443f] space-y-4 shadow-lg">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#4a443f]/60">
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <span>Meta Dönüşümler API'si (CAPI - CRM Geri Bildirimi)</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-teal-500/15 text-teal-300 border border-teal-500/30">
                          Olumlu / Olumsuz Nitelik Aktarımı
                        </span>
                      </h4>
                      <p className="text-[11px] text-[#a69f99] mt-0.5">
                        Potansiyel müşterinin Olumlu (QualifiedLead), Randevu (Schedule), Satış (Purchase) veya Olumsuz (DisqualifiedLead) durumunu SHA-256 şifreli olarak Meta'ya geri bildirir.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-medium text-[#d6cec7] block mb-1">
                        Meta Veri Seti / Pixel Kimliği (Dataset ID) *
                      </label>
                      <input
                        type="text"
                        value={metaDatasetId}
                        onChange={(e) => setMetaDatasetId(e.target.value)}
                        placeholder="Örn: 123456789012345"
                        className="w-full bg-[#1e1c1a] border border-[#4a443f] focus:border-[#b99881] rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none"
                      />
                      <span className="text-[10px] text-[#8c857f] mt-0.5 block">
                        Meta Olay Yöneticisi &gt; Veri Kaynakları &gt; Ayarlar altındaki 15-16 haneli Veri Seti Kimliği
                      </span>
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-[#d6cec7] block mb-1">
                        Test Olay Kodu (İsteğe Bağlı - Test Events)
                      </label>
                      <input
                        type="text"
                        value={metaTestEventCode}
                        onChange={(e) => setMetaTestEventCode(e.target.value)}
                        placeholder="Örn: TEST48291 (Canlıda boş bırakın)"
                        className="w-full bg-[#1e1c1a] border border-[#4a443f] focus:border-[#b99881] rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none"
                      />
                      <span className="text-[10px] text-[#8c857f] mt-0.5 block">
                        Olayları Test Et sekmesinde anlık görmek için girin; canlıya geçince silin.
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-[#d6cec7] block mb-1">
                      Dönüşümler API Erişim Anahtarı (CAPI Access Token) *
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showCapiToken ? 'text' : 'password'}
                          value={metaCapiToken}
                          onChange={(e) => setMetaCapiToken(e.target.value)}
                          placeholder="EAA... (Boş bırakılırsa yukarıdaki Sayfa Erişim Anahtarı kullanılır)"
                          className="w-full bg-[#1e1c1a] border border-[#4a443f] focus:border-[#b99881] rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCapiToken(!showCapiToken)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8c857f] hover:text-white transition-colors"
                        >
                          {showCapiToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      <GlassButton
                        variant="subtle"
                        size="sm"
                        onClick={handleTestCapiConnection}
                        disabled={testingCapi}
                        className="rounded-xl px-3.5 text-xs font-semibold shrink-0"
                      >
                        {testingCapi ? 'Gönderiliyor...' : 'Test Sinyali Gönder'}
                      </GlassButton>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#4a443f]/50">
                    <div>
                      <div className="text-xs font-medium text-white">
                        Aşama Değiştiğinde Otomatik Meta Sinyali Gönder
                      </div>
                      <div className="text-[11px] text-[#8c857f]">
                        Müşteri Nitelikli, Randevu, Satış veya Pasif/Olumsuz yapıldığında anında Meta'ya bildirilir
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMetaAutoSyncStages(!metaAutoSyncStages)}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        metaAutoSyncStages ? 'bg-[#b99881]' : 'bg-[#4a443f]'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                          metaAutoSyncStages ? 'left-6' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>

                  {capiTestResult && (
                    <div
                      className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                        capiTestResult.success
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                      }`}
                    >
                      {capiTestResult.success ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 shrink-0" />
                      )}
                      <span>{capiTestResult.msg}</span>
                    </div>
                  )}

                  {/* Son Gönderilen CAPI Sinyalleri Özeti */}
                  {capiLogs.length > 0 && (
                    <div className="pt-2 border-t border-[#4a443f]/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-[#d6cec7] uppercase tracking-wider">
                          Son Gönderilen Meta CAPI Sinyalleri ({capiLogs.length})
                        </span>
                        {capiLogs.some((l) => l.status === 'QUEUED') && (
                          <button
                            type="button"
                            onClick={() => metaStore.flushQueuedCapiEvents()}
                            className="text-[10.5px] font-bold text-[#b99881] hover:underline cursor-pointer"
                          >
                            Kuyruktakileri Şimdi Gönder
                          </button>
                        )}
                      </div>
                      <div className="max-h-[140px] overflow-y-auto space-y-1.5 pr-1">
                        {capiLogs.slice(0, 8).map((log) => (
                          <div
                            key={log.id}
                            className="px-3 py-1.5 rounded-xl bg-[#1e1c1a] border border-[#4a443f]/70 flex items-center justify-between gap-2 text-[11px]"
                          >
                            <div className="truncate">
                              <span className="font-bold text-white">{log.leadName}</span>
                              <span className="text-[#8c857f] mx-1.5">•</span>
                              <span className="text-[#d6beae] font-semibold">{log.signalLabel}</span>
                              <span className="text-[#8c857f] font-mono ml-1.5">({log.eventName})</span>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                log.status === 'SENT'
                                  ? 'bg-emerald-500/15 text-emerald-400'
                                  : log.status === 'QUEUED'
                                  ? 'bg-amber-500/15 text-amber-300'
                                  : 'bg-rose-500/15 text-rose-400'
                              }`}
                            >
                              {log.status === 'SENT' ? 'İletildi' : log.status === 'QUEUED' ? 'Kuyrukta' : 'Hata'}
                            </span>
                          </div>
                        ))}
                      </div>
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

            {(activeTab === 'permissions' || activeTab === 'dept-admin-permissions') && (
              <div className="animate-in fade-in duration-200">
                <PermissionsMatrixPanel />
              </div>
            )}

            {activeTab === 'trash' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                      <Trash2 className="w-4 h-4 text-[#b99881]" />
                      <span>Çöp Kutusu (30 Günlük Saklama Alanı)</span>
                    </h3>
                    <p className="text-xs text-[#a69f99] mt-0.5">
                      Her departmanın ve her sayfanın silinen ögeleri 30 gün boyunca burada saklanır; dilediğiniz zaman geri yükleyebilirsiniz.
                    </p>
                  </div>

                  {trashItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        trashStore.emptyTrash()
                        setTrashItems([])
                        setTrashNotice('Çöp kutusu tamamen boşaltıldı.')
                        setTimeout(() => setTrashNotice(null), 2500)
                      }}
                      className="px-3.5 py-1.5 rounded-full bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Çöp Kutusunu Boşalt</span>
                    </button>
                  )}
                </div>

                {trashNotice && (
                  <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>{trashNotice}</span>
                  </div>
                )}

                {/* Departman Filtre Sekmeleri */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { id: 'ALL', label: `Tümü (${trashItems.length})` },
                    { id: 'Pazarlama', label: 'Pazarlama' },
                    { id: 'Satış', label: 'Satış' },
                    { id: 'Müşteri İlişkileri', label: 'Müşteri İlişkileri' },
                    { id: 'Kreatif', label: 'Kreatif' },
                    { id: 'Muhasebe', label: 'Muhasebe' },
                    { id: 'Yönetim', label: 'Yönetim' },
                    { id: 'Ortak', label: 'Paylaşılanlar / Ortak' },
                  ].map((tab) => {
                    const isSelected = trashDeptFilter === tab.id
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setTrashDeptFilter(tab.id)}
                        className={`tab-pill-btn px-3 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                          isSelected ? 'is-active-tab-pill' : ''
                        }`}
                      >
                        {tab.label}
                      </button>
                    )
                  })}
                </div>

                {/* Silinen Ögeler Listesi */}
                {(() => {
                  const filteredTrash = trashItems.filter((item) => {
                    if (trashDeptFilter === 'ALL') return true
                    return item.department.toLowerCase().includes(trashDeptFilter.toLowerCase())
                  })

                  if (filteredTrash.length === 0) {
                    return (
                      <div className="p-10 rounded-2xl bg-[#24211f]/60 border border-[#4a443f] text-center space-y-2">
                        <Trash2 className="w-8 h-8 text-[#8c857f] mx-auto opacity-45" />
                        <div className="text-xs font-bold text-white">Çöp kutusunda silinen öge bulunmuyor</div>
                        <p className="text-[11px] text-[#a69f99]">
                          Müşteriler, Talepler, Randevular, Kreatif, Paylaşılanlar ve diğer tüm sayfalardan silinen kayıtlar 30 gün boyunca burada listelenir.
                        </p>
                      </div>
                    )
                  }

                  return (
                    <div className="space-y-2.5">
                      {filteredTrash.map((item) => {
                        const daysLeft = trashStore.getDaysRemaining(item)
                        const deletedDateStr = new Date(item.deletedAt).toLocaleString('tr-TR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                        return (
                          <div
                            key={item.trashId}
                            className="p-3.5 rounded-2xl bg-[#24211f]/70 border border-[#4a443f] flex flex-wrap items-center justify-between gap-3"
                          >
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#34302d] text-[#d6beae]">
                                  {item.department} • {item.pageName}
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-400">
                                  {daysLeft} gün kaldı
                                </span>
                                <span className="text-[10px] text-[#8c857f]">
                                  Silinme: {deletedDateStr}
                                </span>
                              </div>
                              <div className="text-xs font-bold text-white truncate">
                                {item.title}
                              </div>
                              {item.subtitle && (
                                <div className="text-[11px] text-[#a69f99] truncate">
                                  {item.subtitle}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  const ok = trashStore.restoreItem(item.trashId)
                                  setTrashItems(trashStore.getAll())
                                  if (ok) {
                                    setTrashNotice(`"${item.title}" başarıyla ${item.pageName} sayfasına geri yüklendi.`)
                                    setTimeout(() => setTrashNotice(null), 3000)
                                  }
                                }}
                                className="px-3 py-1.5 rounded-full bg-[#b99881] hover:bg-[#a6856e] text-white text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Geri Yükle</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  trashStore.deletePermanently(item.trashId)
                                  setTrashItems(trashStore.getAll())
                                }}
                                className="px-3 py-1.5 rounded-full bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
                                title="Kalıcı Olarak Sil"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Kalıcı Sil</span>
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
            )}

            {activeTab.startsWith('dept-admin-') && activeTab !== 'dept-admin-permissions' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <h3 className="text-sm font-bold text-white">Yönetim ve Güvenlik Yapılandırması</h3>
                <div className="p-4 rounded-2xl bg-[#24211f]/60 border border-[#4a443f] space-y-3">
                  <div className="text-xs text-white">İskonto sınırları ve denetim logları aktif.</div>
                  <GlassButton variant="gold" size="sm" onClick={() => handleSaveDeptConfig()} className="rounded-full px-5">
                    Kaydet
                  </GlassButton>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
