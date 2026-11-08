import { MetaBackendPanel } from '@/components/meta/MetaBackendPanel'
import React, { useState, useRef, useEffect } from 'react'
import { CustomSelect } from '@/components/ui/CustomSelect'
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
import {
  AMBIENT_SCENE_OPTIONS,
  AmbientSceneId,
  getSavedAmbientScene,
  setSavedAmbientScene,
} from '@/components/common/AmbientSceneOverlay'

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
  { id: 'indigo', name: 'İndigo', color: '#5c6ac4', hover: '#4c59b0' },
  { id: 'sage', name: 'Pastel yeşil', color: '#657a72', hover: '#556860' },
  { id: 'beige', name: 'Kum beji', color: '#b99881', hover: '#a6856e' },
  { id: 'burgundy', name: 'Burgonya', color: '#8b3a4a', hover: '#752e3c' },
  { id: 'pastel-sky', name: 'Buz mavisi', color: '#6b9ac4', hover: '#5987b0' },
  { id: 'lavender', name: 'Lavanta', color: '#9381ff', hover: '#7f6ce6' },
  { id: 'pastel-mint', name: 'Su yeşili', color: '#68a691', hover: '#56927e' },
  { id: 'pastel-purple', name: 'Leylak', color: '#8b6bb1', hover: '#78599d' },
  { id: 'pastel-rose', name: 'Gül kurusu', color: '#c97a8b', hover: '#b56677' },
  { id: 'pastel-yellow', name: 'Kehribar', color: '#d4a359', hover: '#bf8f47' },
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

  // Theme Accent state ('gold' = Gün ışığı, 'night' = Gece ışığı)
  const [themeAccent, setThemeAccent] = useState<'gold' | 'night'>(() => {
    try {
      const saved = localStorage.getItem('demirturk_theme_accent')
      if (saved === 'night' || saved === 'amber' || saved === 'emerald' || saved === 'sapphire' || saved === 'platinum') {
        return 'night'
      }
    } catch {}
    return 'gold'
  })

  const THEMES: {
    id: 'gold' | 'night'
    name: string
    primary: string
    secondary: string
  }[] = [
    {
      id: 'gold',
      name: 'Gün ışığı',
      primary: '#f5f5f2',
      secondary: themeAccent === 'gold' ? activeAccentObj.color : '#5c6ac4',
    },
    {
      id: 'night',
      name: 'Gece ışığı',
      primary: '#231f1d',
      secondary: themeAccent === 'night' ? activeAccentObj.color : '#657a72',
    },
  ]

  const handleSetAccent = (acc: 'gold' | 'night') => {
    setThemeAccent(acc)
    localStorage.setItem('demirturk_theme_accent', acc)
    const defaultAccentForTheme = acc === 'night' ? 'sage' : 'indigo'
    setAccentColorId(defaultAccentForTheme)
    localStorage.setItem('demirturk_accent_color', defaultAccentForTheme)
    if (acc === 'gold') {
      document.documentElement.removeAttribute('data-theme-accent')
    } else {
      document.documentElement.setAttribute('data-theme-accent', 'night')
    }
    applyAccentColorChoice(defaultAccentForTheme)
  }

  // Font Size state ('small' | 'standard' | 'large')
  const [ambientScene, setAmbientScene] = useState<AmbientSceneId>(() => getSavedAmbientScene())

  const handleSelectAmbientScene = (sceneId: AmbientSceneId) => {
    setAmbientScene(sceneId)
    setSavedAmbientScene(sceneId)
  }

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
      const res = await userStore.updateUser(currentUser.id, { avatarUrl: compressedData })
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

  const handleRemoveAvatar = async () => {
    if (!currentUser) return
    setAvatarPreview(null)
    const result = await userStore.updateUser(currentUser.id, { avatarUrl: '' })
    if (!result.success) { setAvatarMessage({ type: 'error', text: result.error || 'Profil kaydedilemedi.' }); return }
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

  const handleAddTeamMember = async (e: React.FormEvent) => {

    try {    e.preventDefault()

    if (!newMemberFullName.trim()) return
    const initialPassword = generateInitialPassword()
    const res = await userStore.addMember({
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
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Personel hesabı oluşturulamadı.')
    }
  }

  // Department-specific mock configurations with persistence
  const [metaDailyBudget, setMetaDailyBudget] = useState('50000')
  const [targetCpl, setTargetCpl] = useState('120')
  const [autoQualifyThreshold, setAutoQualifyThreshold] = useState('65')
  const [autoHandoverEnabled, setAutoHandoverEnabled] = useState(false)
  const [afterHoursMsgEnabled, setAfterHoursMsgEnabled] = useState(true)
  const [dailyKpiReportEnabled, setDailyKpiReportEnabled] = useState(true)
  const [deptSavedMessage, setDeptSavedMessage] = useState<string | null>(null)

  const [deptSettings, setDeptSettings] = useState(() => {
    const defaults = {
      // Müşteri İlişkileri - 1. SLA & Yanıt Süresi
      crmFirstResponseMins: '15',
      crmFollowupCallbackMins: '60',
      crmOverdueEscalationHours: '4',
      crmWorkingHoursStart: '09:00',
      crmWorkingHoursEnd: '19:00',
      crmSlaAlertEnabled: true,
      crmAutoReassignOnBreach: false,

      // Müşteri İlişkileri - 2. İletişim Kanalları
      crmWhatsappLine: '+90 532 000 00 00',
      crmWhatsappGreeting: 'Merhaba, Demirtürk Holding Müşteri İlişkileri ekibinden ulaşıyorum. Talebinizle ilgili size nasıl yardımcı olabilirim?',
      crmSwitchboardPrefix: '0850',
      crmRequireCallNote: true,
      crmWebFormRoundRobin: true,
      crmAutoOpenWhatsappWeb: true,

      // Müşteri İlişkileri - 3. Talep Önceliği
      crmWebRequestDefaultPriority: 'Yüksek',
      crmManualRequestDefaultPriority: 'Normal',
      crmVipBudgetThreshold: '5000000',
      crmPinUrgentToTop: true,
      crmRequireNoteOnSalesHandover: true,
      crmCallbackPriorityBoost: true,

      // Satış Departmanı
      salesCommissionRate: '1.5',
      salesMonthlyTargetAmount: '15000000',
      salesBonusAcceleratorEnabled: true,
      salesDefaultSlotMins: '45',
      salesBufferBetweenApptsMins: '15',
      salesSendSmsBeforeAppt: true,
      salesOptionHoldHours: '72',
      salesMaxOptionsPerRep: '3',
      salesAutoReleaseExpiredOption: true,

      // Muhasebe Departmanı
      accDefaultBankName: 'Ziraat Bankası - Kurumsal Ticari Hesap',
      accDefaultIban: 'TR00 0001 0000 0000 0000 0000 01',
      accDefaultCurrency: 'TRY',
      accInvoicePrefix: 'DMT2026',
      accReceiptPrefix: 'MKB-2026',
      accDefaultVatRate: '20',
      accAutoArchivePdf: true,
      accReminderDaysBefore: '3',
      accOverdueWarningDays: '7',
      accSendOverdueWhatsapp: true,

      // Yönetim & Güvenlik
      adminRepMaxDiscountPct: '3',
      adminManagerMaxDiscountPct: '8',
      adminRequireBoardApprovalAbovePct: '10',
      adminSessionTimeoutMins: '120',
      adminAuditRetentionDays: '365',
      adminLogExportAlerts: true,
    }
    try {
      const raw = localStorage.getItem('demirturk_dept_settings_v1')
      if (raw) {
        return { ...defaults, ...(JSON.parse(raw) as Partial<typeof defaults>) }
      }
    } catch {}
    return defaults
  })

  const updateDeptSetting = <K extends keyof typeof deptSettings>(key: K, value: (typeof deptSettings)[K]) => {
    setDeptSettings((prev: typeof deptSettings) => {
      const next = { ...prev, [key]: value }
      try {
        localStorage.setItem('demirturk_dept_settings_v1', JSON.stringify(next))
      } catch {}
      return next
    })
  }

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
    try {
      localStorage.setItem('demirturk_dept_settings_v1', JSON.stringify(deptSettings))
    } catch {}
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

                {/* TEMA SEÇİCİ: Gün ışığı & Gece ışığı */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-[#b99881]" />
                      <span>Tema</span>
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {THEMES.map((t) => {
                      const isSelected = themeAccent === t.id
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => handleSetAccent(t.id)}
                          className={`tab-pill-btn flex items-center gap-3 p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'is-active-tab-pill'
                              : 'border-[#4a443f] bg-[#24211f]/40 hover:bg-[#24211f]'
                          }`}
                        >
                          {/* DUAL CIRCLE: Big Primary + Small Badge Secondary */}
                          <div className="relative w-9 h-9 shrink-0">
                            <div
                              className="w-8 h-8 rounded-full border border-white/20"
                              style={{ backgroundColor: t.primary }}
                            />
                            <div
                              className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-[#2b2724]"
                              style={{ backgroundColor: t.secondary }}
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-white flex items-center justify-between">
                              <span>{t.name}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-[#b99881]" />}
                            </div>
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
                      Seçili: <strong className="text-white">{activeAccentObj.name}</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {ACCENT_COLOR_OPTIONS.map((opt) => {
                      const isSelected = accentColorId === opt.id
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleSelectAccentColor(opt.id)}
                          className={`tab-pill-btn flex items-center gap-2.5 px-3 py-2.5 rounded-full border text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'is-active-tab-pill'
                              : 'border-[#4a443f] bg-[#1e1c1a]/50'
                          }`}
                          title={opt.name}
                        >
                          <span
                            className="w-4 h-4 rounded-full shrink-0 border border-black/15 flex items-center justify-center"
                            style={{ backgroundColor: opt.color }}
                          >
                            {isSelected && (
                              <span className="w-1.5 h-1.5 rounded-full bg-white" />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-bold text-white truncate">
                              {opt.name}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* HAREKETLİ TEMA ANİMASYONLARI SEÇİCİ */}
                <div className="p-4 rounded-2xl bg-[#24211f]/60 border border-[#4a443f] space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-[#b99881]" />
                      <span>Tema Animasyonları</span>
                    </h4>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {AMBIENT_SCENE_OPTIONS.map((sc) => {
                      const isSelected = ambientScene === sc.id
                      return (
                        <button
                          key={sc.id}
                          type="button"
                          onClick={() => handleSelectAmbientScene(sc.id)}
                          className={`tab-pill-btn flex items-center justify-between gap-2 px-3 py-2.5 rounded-full border text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'is-active-tab-pill'
                              : 'border-[#4a443f] bg-[#1e1c1a]/50'
                          }`}
                        >
                          <span className="text-[11px] font-bold text-white truncate">
                            {sc.name}
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-[#b99881] shrink-0" />}
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
                          className={`tab-pill-btn p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                            isSelected
                              ? 'is-active-tab-pill text-white'
                              : 'border-[#4a443f] bg-[#1e1c1a]/50 text-[#c4bcb5]'
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
                          Güçlü geçici parola otomatik oluşturulur
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
                          <CustomSelect
                            value={newMemberDepartment}
                            onChange={(e) => setNewMemberDepartment(e.target.value as Department)}
                            className="w-full bg-[#1e1c1a] border border-[#4a443f] focus:border-[#b99881] rounded-full px-3.5 py-2 text-xs text-white focus:outline-none cursor-pointer"
                          >
                            {CANONICAL_DEPARTMENTS.map((dept) => (
                              <option key={dept} value={dept}>
                                {dept}
                              </option>
                            ))}
                          </CustomSelect>
                        </div>

                        <div className="sm:col-span-2 sm:pt-[21px]">
                          <GlassButton
                            type="submit"
                            variant="gold"
                            size="sm"
                            className="w-full rounded-full py-2 justify-center font-bold"
                            disabled={userStore.isStaffCreationBusy()}
                          >
                            {userStore.isStaffCreationBusy() ? 'Oluşturuluyor…' : 'Ekle'}
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
                              • Geçici parola:{' '}
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
                                onClick={async () => {
                                  if (window.confirm(`${u.fullName} adlı kullanıcıyı silmek istediğinize emin misiniz?`)) {
                                    const result = await userStore.deleteUser(u.id)
                                    if (!result.success) window.alert(result.error)
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
            {activeTab === 'dept-meta' && <MetaBackendPanel />}

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
                      <div className="text-xs font-medium text-white">Manuel Satışa İletim Kuralı (Zorunlu)</div>
                      <div className="text-[11px] text-[#8c857f]">
                        Müşteri İlişkileri, Pazarlama veya Yönetim manuel olarak "Satışa İlet" demeden hiçbir veri (Potansiyel müşteri, Web sitesi, Google, Meta vb.) Satış departmanına devredilemez
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                      Manuel Onay Aktif
                    </span>
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

            {/* MÜŞTERİ İLİŞKİLERİ: 1. SLA & YANIT SÜRESİ */}
            {activeTab === 'dept-crm-sla' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">
                    SLA & Yanıt Süresi Kuralları
                  </h3>
                  <p className="text-xs text-[#a69f99] mt-0.5">
                    Yeni düşen müşteri adaylarına ilk dönüş hedef süreleri, tekrar arama hatırlatıcıları ve çalışma saatleri.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#24211f]/60 border border-[#4a443f] space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] text-[#a69f99] block mb-1">
                        İlk Yanıt Hedef Süresi (Dakika)
                      </label>
                      <input
                        type="number"
                        value={deptSettings.crmFirstResponseMins}
                        onChange={(e) => updateDeptSetting('crmFirstResponseMins', e.target.value)}
                        className="w-full bg-[#1e1c1a] border border-[#4a443f] focus:border-[#b99881] rounded-full px-4 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-[#a69f99] block mb-1">
                        Tekrar Arama Hatırlatıcısı (Dakika)
                      </label>
                      <input
                        type="number"
                        value={deptSettings.crmFollowupCallbackMins}
                        onChange={(e) => updateDeptSetting('crmFollowupCallbackMins', e.target.value)}
                        className="w-full bg-[#1e1c1a] border border-[#4a443f] focus:border-[#b99881] rounded-full px-4 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-[#a69f99] block mb-1">
                        Gecikme Eskalasyon Eşiği (Saat)
                      </label>
                      <input
                        type="number"
                        value={deptSettings.crmOverdueEscalationHours}
                        onChange={(e) => updateDeptSetting('crmOverdueEscalationHours', e.target.value)}
                        className="w-full bg-[#1e1c1a] border border-[#4a443f] focus:border-[#b99881] rounded-full px-4 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#4a443f]/40">
                    <div>
                      <label className="text-[11px] text-[#a69f99] block mb-1">
                        Mesai Başlangıç Saati
                      </label>
                      <input
                        type="time"
                        value={deptSettings.crmWorkingHoursStart}
                        onChange={(e) => updateDeptSetting('crmWorkingHoursStart', e.target.value)}
                        className="w-full bg-[#1e1c1a] border border-[#4a443f] focus:border-[#b99881] rounded-full px-4 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-[#a69f99] block mb-1">
                        Mesai Bitiş Saati
                      </label>
                      <input
                        type="time"
                        value={deptSettings.crmWorkingHoursEnd}
                        onChange={(e) => updateDeptSetting('crmWorkingHoursEnd', e.target.value)}
                        className="w-full bg-[#1e1c1a] border border-[#4a443f] focus:border-[#b99881] rounded-full px-4 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#4a443f]/40">
                    <div>
                      <div className="text-xs font-medium text-white">SLA Aşımında Bildirim Gönder</div>
                      <div className="text-[11px] text-[#8c857f]">
                        Hedef yanıt süresi aşılan müşteri kayıtları için anlık uyarı gösterilir
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateDeptSetting('crmSlaAlertEnabled', !deptSettings.crmSlaAlertEnabled)}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        deptSettings.crmSlaAlertEnabled ? 'bg-[#b99881]' : 'bg-[#4a443f]'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                          deptSettings.crmSlaAlertEnabled ? 'left-6' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#4a443f]/40">
                    <div>
                      <div className="text-xs font-medium text-white">Geciken Adayı Boştaki Temsilciye Devret</div>
                      <div className="text-[11px] text-[#8c857f]">
                        Eskalasyon süresini aşan ve aranmayan kayıtları aktif temsilciye otomatik aktarır
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateDeptSetting('crmAutoReassignOnBreach', !deptSettings.crmAutoReassignOnBreach)}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        deptSettings.crmAutoReassignOnBreach ? 'bg-[#b99881]' : 'bg-[#4a443f]'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                          deptSettings.crmAutoReassignOnBreach ? 'left-6' : 'left-1'
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
                      onClick={() => handleSaveDeptConfig('SLA ve yanıt süresi kuralları kaydedildi.')}
                      className="rounded-full px-5"
                    >
                      Kaydet
                    </GlassButton>
                  </div>
                </div>
              </div>
            )}

            {/* MÜŞTERİ İLİŞKİLERİ: 2. İLETİŞİM KANALLARI */}
            {activeTab === 'dept-crm-channels' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">
                    İletişim Kanalları & Santral Ayarları
                  </h3>
                  <p className="text-xs text-[#a69f99] mt-0.5">
                    WhatsApp kurumsal hattı, hazır mesaj şablonu, santral arama öneki ve web form dağıtım tercihleri.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#24211f]/60 border border-[#4a443f] space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-[#a69f99] block mb-1">
                        Kurumsal WhatsApp Hattı
                      </label>
                      <input
                        type="text"
                        value={deptSettings.crmWhatsappLine}
                        onChange={(e) => updateDeptSetting('crmWhatsappLine', e.target.value)}
                        placeholder="+90 532 000 00 00"
                        className="w-full bg-[#1e1c1a] border border-[#4a443f] focus:border-[#b99881] rounded-full px-4 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-[#a69f99] block mb-1">
                        Santral / Softphone Çıkış Kodu
                      </label>
                      <input
                        type="text"
                        value={deptSettings.crmSwitchboardPrefix}
                        onChange={(e) => updateDeptSetting('crmSwitchboardPrefix', e.target.value)}
                        placeholder="0850"
                        className="w-full bg-[#1e1c1a] border border-[#4a443f] focus:border-[#b99881] rounded-full px-4 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-[#a69f99] block mb-1">
                      Varsayılan WhatsApp İlk Temas Mesaj Şablonu
                    </label>
                    <textarea
                      rows={3}
                      value={deptSettings.crmWhatsappGreeting}
                      onChange={(e) => updateDeptSetting('crmWhatsappGreeting', e.target.value)}
                      className="w-full bg-[#1e1c1a] border border-[#4a443f] focus:border-[#b99881] rounded-2xl px-4 py-2.5 text-xs text-white focus:outline-none resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#4a443f]/40">
                    <div>
                      <div className="text-xs font-medium text-white">Görüşme Sonrası Çağrı Notu Zorunluluğu</div>
                      <div className="text-[11px] text-[#8c857f]">
                        Müşteri durumu güncellenirken kısa görüşme özeti girilmesini zorunlu tutar
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateDeptSetting('crmRequireCallNote', !deptSettings.crmRequireCallNote)}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        deptSettings.crmRequireCallNote ? 'bg-[#b99881]' : 'bg-[#4a443f]'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                          deptSettings.crmRequireCallNote ? 'left-6' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#4a443f]/40">
                    <div>
                      <div className="text-xs font-medium text-white">Web Sitesi Başvurularında Sıralı Dağıtım (Round-Robin)</div>
                      <div className="text-[11px] text-[#8c857f]">
                        İnternet sitesinden gelen başvuruları temsilciler arasında eşit sırayla atar
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateDeptSetting('crmWebFormRoundRobin', !deptSettings.crmWebFormRoundRobin)}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        deptSettings.crmWebFormRoundRobin ? 'bg-[#b99881]' : 'bg-[#4a443f]'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                          deptSettings.crmWebFormRoundRobin ? 'left-6' : 'left-1'
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
                      onClick={() => handleSaveDeptConfig('İletişim kanalı ayarları kaydedildi.')}
                      className="rounded-full px-5"
                    >
                      Kaydet
                    </GlassButton>
                  </div>
                </div>
              </div>
            )}

            {/* MÜŞTERİ İLİŞKİLERİ: 3. TALEP ÖNCELİĞİ */}
            {activeTab === 'dept-crm-priority' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">
                    Talep Önceliği & Sıralama Kuralları
                  </h3>
                  <p className="text-xs text-[#a69f99] mt-0.5">
                    İnternet sitesi başvuruları ve manuel girilen müşteri istekleri için varsayılan öncelik seviyeleri ve devir kuralları.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#24211f]/60 border border-[#4a443f] space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] text-[#a69f99] block mb-1">
                        Web Sitesi Başvurusu Önceliği
                      </label>
                      <CustomSelect
                        value={deptSettings.crmWebRequestDefaultPriority}
                        onChange={(e) => updateDeptSetting('crmWebRequestDefaultPriority', e.target.value)}
                        className="w-full bg-[#1e1c1a] border border-[#4a443f] focus:border-[#b99881] rounded-full px-4 py-2 text-xs text-white focus:outline-none"
                      >
                        <option value="Acil">Acil</option>
                        <option value="Yüksek">Yüksek</option>
                        <option value="Normal">Normal</option>
                      </CustomSelect>
                    </div>
                    <div>
                      <label className="text-[11px] text-[#a69f99] block mb-1">
                        Manuel Müşteri İsteği Önceliği
                      </label>
                      <CustomSelect
                        value={deptSettings.crmManualRequestDefaultPriority}
                        onChange={(e) => updateDeptSetting('crmManualRequestDefaultPriority', e.target.value)}
                        className="w-full bg-[#1e1c1a] border border-[#4a443f] focus:border-[#b99881] rounded-full px-4 py-2 text-xs text-white focus:outline-none"
                      >
                        <option value="Acil">Acil</option>
                        <option value="Yüksek">Yüksek</option>
                        <option value="Normal">Normal</option>
                      </CustomSelect>
                    </div>
                    <div>
                      <label className="text-[11px] text-[#a69f99] block mb-1">
                        VIP Yatırımcı Bütçe Eşiği (₺)
                      </label>
                      <input
                        type="number"
                        value={deptSettings.crmVipBudgetThreshold}
                        onChange={(e) => updateDeptSetting('crmVipBudgetThreshold', e.target.value)}
                        className="w-full bg-[#1e1c1a] border border-[#4a443f] focus:border-[#b99881] rounded-full px-4 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#4a443f]/40">
                    <div>
                      <div className="text-xs font-medium text-white">Acil ve VIP Talepleri Listenin En Üstüne Sabitle</div>
                      <div className="text-[11px] text-[#8c857f]">
                        Talepler ve Müşteriler sayfasında yüksek öncelikli kayıtları her zaman üst sırada gösterir
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateDeptSetting('crmPinUrgentToTop', !deptSettings.crmPinUrgentToTop)}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        deptSettings.crmPinUrgentToTop ? 'bg-[#b99881]' : 'bg-[#4a443f]'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                          deptSettings.crmPinUrgentToTop ? 'left-6' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#4a443f]/40">
                    <div>
                      <div className="text-xs font-medium text-white">Satış Ekibine Devirde Müşteri Beklenti Notu Zorunluluğu</div>
                      <div className="text-[11px] text-[#8c857f]">
                        Nitelikli adayı satış temsilcisine aktarırken daire tipi ve bütçe notu girilmesini şart koşar
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateDeptSetting('crmRequireNoteOnSalesHandover', !deptSettings.crmRequireNoteOnSalesHandover)}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        deptSettings.crmRequireNoteOnSalesHandover ? 'bg-[#b99881]' : 'bg-[#4a443f]'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                          deptSettings.crmRequireNoteOnSalesHandover ? 'left-6' : 'left-1'
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
                      onClick={() => handleSaveDeptConfig('Talep önceliği kuralları kaydedildi.')}
                      className="rounded-full px-5"
                    >
                      Kaydet
                    </GlassButton>
                  </div>
                </div>
              </div>
            )}

            {/* SATIŞ: 1. KOMİSYON & HEDEF */}
            {activeTab === 'dept-sales-commission' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">
                    Komisyon Oranları & Aylık Satış Hedefi
                  </h3>
                  <p className="text-xs text-[#a69f99] mt-0.5">
                    Satış temsilcilerinin prim hesaplama yüzdeleri ve aylık ciro hedefleri.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#24211f]/60 border border-[#4a443f] space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-[#a69f99] block mb-1">
                        Varsayılan Satış Komisyon Oranı (%)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={deptSettings.salesCommissionRate}
                        onChange={(e) => updateDeptSetting('salesCommissionRate', e.target.value)}
                        className="w-full bg-[#1e1c1a] border border-[#4a443f] focus:border-[#b99881] rounded-full px-4 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-[#a69f99] block mb-1">
                        Temsilci Aylık Hedef Ciro (₺)
                      </label>
                      <input
                        type="number"
                        value={deptSettings.salesMonthlyTargetAmount}
                        onChange={(e) => updateDeptSetting('salesMonthlyTargetAmount', e.target.value)}
                        className="w-full bg-[#1e1c1a] border border-[#4a443f] focus:border-[#b99881] rounded-full px-4 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#4a443f]/40">
                    <div>
                      <div className="text-xs font-medium text-white">Hedef Üstü Kademeli Prim Çarpanı</div>
                      <div className="text-[11px] text-[#8c857f]">
                        Aylık hedefini %100 aşan temsilcilerin sonraki satışlarında ek prim çarpanı uygular
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateDeptSetting('salesBonusAcceleratorEnabled', !deptSettings.salesBonusAcceleratorEnabled)}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        deptSettings.salesBonusAcceleratorEnabled ? 'bg-[#b99881]' : 'bg-[#4a443f]'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                          deptSettings.salesBonusAcceleratorEnabled ? 'left-6' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    {deptSavedMessage ? <span className="text-xs text-emerald-400">{deptSavedMessage}</span> : <span />}
                    <GlassButton
                      variant="gold"
                      size="sm"
                      onClick={() => handleSaveDeptConfig('Satış komisyon ve hedef ayarları kaydedildi.')}
                      className="rounded-full px-5"
                    >
                      Kaydet
                    </GlassButton>
                  </div>
                </div>
              </div>
            )}

            {/* SATIŞ: 2. RANDEVU KURALLARI */}
            {activeTab === 'dept-sales-appointments' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">
                    Satış Ofisi Randevu Kuralları
                  </h3>
                  <p className="text-xs text-[#a69f99] mt-0.5">
                    Numune daire gösterimi ve satış görüşmesi süreleri ile otomatik müşteri hatırlatmaları.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#24211f]/60 border border-[#4a443f] space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-[#a69f99] block mb-1">
                        Varsayılan Görüşme Süresi (Dakika)
                      </label>
                      <input
                        type="number"
                        value={deptSettings.salesDefaultSlotMins}
                        onChange={(e) => updateDeptSetting('salesDefaultSlotMins', e.target.value)}
                        className="w-full bg-[#1e1c1a] border border-[#4a443f] focus:border-[#b99881] rounded-full px-4 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-[#a69f99] block mb-1">
                        Randevular Arası Hazırlık Süresi (Dakika)
                      </label>
                      <input
                        type="number"
                        value={deptSettings.salesBufferBetweenApptsMins}
                        onChange={(e) => updateDeptSetting('salesBufferBetweenApptsMins', e.target.value)}
                        className="w-full bg-[#1e1c1a] border border-[#4a443f] focus:border-[#b99881] rounded-full px-4 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#4a443f]/40">
                    <div>
                      <div className="text-xs font-medium text-white">Randevu Öncesi Konum ve Hatırlatma Mesajı</div>
                      <div className="text-[11px] text-[#8c857f]">
                        Görüşmeden 2 saat önce müşteriye satış ofisi konumu ve hatırlatma bildirimi gönderir
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateDeptSetting('salesSendSmsBeforeAppt', !deptSettings.salesSendSmsBeforeAppt)}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        deptSettings.salesSendSmsBeforeAppt ? 'bg-[#b99881]' : 'bg-[#4a443f]'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                          deptSettings.salesSendSmsBeforeAppt ? 'left-6' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    {deptSavedMessage ? <span className="text-xs text-emerald-400">{deptSavedMessage}</span> : <span />}
                    <GlassButton
                      variant="gold"
                      size="sm"
                      onClick={() => handleSaveDeptConfig('Randevu kuralları kaydedildi.')}
                      className="rounded-full px-5"
                    >
                      Kaydet
                    </GlassButton>
                  </div>
                </div>
              </div>
            )}

            {/* SATIŞ: 3. DAİRE OPSİYON SÜRESİ */}
            {activeTab === 'dept-sales-reservations' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">
                    Daire Opsiyon & Rezervasyon Kuralları
                  </h3>
                  <p className="text-xs text-[#a69f99] mt-0.5">
                    Kapora öncesi geçici opsiyon blokaj süreleri ve temsilci başına maksimum opsiyon limitleri.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#24211f]/60 border border-[#4a443f] space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-[#a69f99] block mb-1">
                        Varsayılan Opsiyon Tutma Süresi (Saat)
                      </label>
                      <input
                        type="number"
                        value={deptSettings.salesOptionHoldHours}
                        onChange={(e) => updateDeptSetting('salesOptionHoldHours', e.target.value)}
                        className="w-full bg-[#1e1c1a] border border-[#4a443f] focus:border-[#b99881] rounded-full px-4 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-[#a69f99] block mb-1">
                        Temsilci Başına Maksimum Eşzamanlı Opsiyon
                      </label>
                      <input
                        type="number"
                        value={deptSettings.salesMaxOptionsPerRep}
                        onChange={(e) => updateDeptSetting('salesMaxOptionsPerRep', e.target.value)}
                        className="w-full bg-[#1e1c1a] border border-[#4a443f] focus:border-[#b99881] rounded-full px-4 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#4a443f]/40">
                    <div>
                      <div className="text-xs font-medium text-white">Süresi Dolan Opsiyonu Otomatik Satışa Aç</div>
                      <div className="text-[11px] text-[#8c857f]">
                        Belirtilen saat içinde kapora girişi yapılmayan dairelerin blokajını otomatik kaldırır
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateDeptSetting('salesAutoReleaseExpiredOption', !deptSettings.salesAutoReleaseExpiredOption)}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        deptSettings.salesAutoReleaseExpiredOption ? 'bg-[#b99881]' : 'bg-[#4a443f]'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                          deptSettings.salesAutoReleaseExpiredOption ? 'left-6' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    {deptSavedMessage ? <span className="text-xs text-emerald-400">{deptSavedMessage}</span> : <span />}
                    <GlassButton
                      variant="gold"
                      size="sm"
                      onClick={() => handleSaveDeptConfig('Daire opsiyon kuralları kaydedildi.')}
                      className="rounded-full px-5"
                    >
                      Kaydet
                    </GlassButton>
                  </div>
                </div>
              </div>
            )}

            {/* MUHASEBE: 1. KASA & BANKA TANIMLARI */}
            {activeTab === 'dept-acc-accounts' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">
                    Kasa & Banka Hesap Tanımları
                  </h3>
                  <p className="text-xs text-[#a69f99] mt-0.5">
                    Tahsilat makbuzlarında ve sözleşmelerde yer alacak varsayılan kurumsal banka ve para birimi bilgileri.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#24211f]/60 border border-[#4a443f] space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-[#a69f99] block mb-1">
                        Varsayılan Banka & Şube Adı
                      </label>
                      <input
                        type="text"
                        value={deptSettings.accDefaultBankName}
                        onChange={(e) => updateDeptSetting('accDefaultBankName', e.target.value)}
                        className="w-full bg-[#1e1c1a] border border-[#4a443f] focus:border-[#b99881] rounded-full px-4 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-[#a69f99] block mb-1">
                        Varsayılan Para Birimi
                      </label>
                      <CustomSelect
                        value={deptSettings.accDefaultCurrency}
                        onChange={(e) => updateDeptSetting('accDefaultCurrency', e.target.value)}
                        className="w-full bg-[#1e1c1a] border border-[#4a443f] focus:border-[#b99881] rounded-full px-4 py-2 text-xs text-white focus:outline-none"
                      >
                        <option value="TRY">Türk Lirası (₺ - TRY)</option>
                        <option value="USD">ABD Doları ($ - USD)</option>
                        <option value="EUR">Euro (€ - EUR)</option>
                      </CustomSelect>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-[#a69f99] block mb-1">
                      Kurumsal Tahsilat IBAN Numarası
                    </label>
                    <input
                      type="text"
                      value={deptSettings.accDefaultIban}
                      onChange={(e) => updateDeptSetting('accDefaultIban', e.target.value)}
                      className="w-full bg-[#1e1c1a] border border-[#4a443f] focus:border-[#b99881] rounded-full px-4 py-2 text-xs text-white font-mono focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    {deptSavedMessage ? <span className="text-xs text-emerald-400">{deptSavedMessage}</span> : <span />}
                    <GlassButton
                      variant="gold"
                      size="sm"
                      onClick={() => handleSaveDeptConfig('Kasa ve banka tanımları kaydedildi.')}
                      className="rounded-full px-5"
                    >
                      Kaydet
                    </GlassButton>
                  </div>
                </div>
              </div>
            )}

            {/* MUHASEBE: 2. FATURA & MAKBUZ SERİSİ */}
            {activeTab === 'dept-acc-invoicing' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">
                    Fatura & Tahsilat Makbuzu Serisi
                  </h3>
                  <p className="text-xs text-[#a69f99] mt-0.5">
                    Resmi e-Arşiv / e-Fatura seri önekleri, KDV oranı ve otomatik belge arşivleme kuralları.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#24211f]/60 border border-[#4a443f] space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] text-[#a69f99] block mb-1">
                        e-Fatura Seri Öneki
                      </label>
                      <input
                        type="text"
                        value={deptSettings.accInvoicePrefix}
                        onChange={(e) => updateDeptSetting('accInvoicePrefix', e.target.value)}
                        className="w-full bg-[#1e1c1a] border border-[#4a443f] focus:border-[#b99881] rounded-full px-4 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-[#a69f99] block mb-1">
                        Tahsilat Makbuzu Öneki
                      </label>
                      <input
                        type="text"
                        value={deptSettings.accReceiptPrefix}
                        onChange={(e) => updateDeptSetting('accReceiptPrefix', e.target.value)}
                        className="w-full bg-[#1e1c1a] border border-[#4a443f] focus:border-[#b99881] rounded-full px-4 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-[#a69f99] block mb-1">
                        Varsayılan KDV Oranı (%)
                      </label>
                      <input
                        type="number"
                        value={deptSettings.accDefaultVatRate}
                        onChange={(e) => updateDeptSetting('accDefaultVatRate', e.target.value)}
                        className="w-full bg-[#1e1c1a] border border-[#4a443f] focus:border-[#b99881] rounded-full px-4 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#4a443f]/40">
                    <div>
                      <div className="text-xs font-medium text-white">Kesilen Makbuzları Paylaşılanlar'a Otomatik Arşivle</div>
                      <div className="text-[11px] text-[#8c857f]">
                        Oluşturulan PDF tahsilat makbuzlarının bir kopyasını müşteri dosyasına kaydeder
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateDeptSetting('accAutoArchivePdf', !deptSettings.accAutoArchivePdf)}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        deptSettings.accAutoArchivePdf ? 'bg-[#b99881]' : 'bg-[#4a443f]'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                          deptSettings.accAutoArchivePdf ? 'left-6' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    {deptSavedMessage ? <span className="text-xs text-emerald-400">{deptSavedMessage}</span> : <span />}
                    <GlassButton
                      variant="gold"
                      size="sm"
                      onClick={() => handleSaveDeptConfig('Fatura ve makbuz serisi ayarları kaydedildi.')}
                      className="rounded-full px-5"
                    >
                      Kaydet
                    </GlassButton>
                  </div>
                </div>
              </div>
            )}

            {/* MUHASEBE: 3. VADE HATIRLATICILARI */}
            {activeTab === 'dept-acc-reminders' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">
                    Senet & Taksit Vade Hatırlatıcıları
                  </h3>
                  <p className="text-xs text-[#a69f99] mt-0.5">
                    Yaklaşan ve geciken taksit ödemeleri için otomatik bildirim zamanlamaları.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#24211f]/60 border border-[#4a443f] space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-[#a69f99] block mb-1">
                        Vade Öncesi Hatırlatma (Gün)
                      </label>
                      <input
                        type="number"
                        value={deptSettings.accReminderDaysBefore}
                        onChange={(e) => updateDeptSetting('accReminderDaysBefore', e.target.value)}
                        className="w-full bg-[#1e1c1a] border border-[#4a443f] focus:border-[#b99881] rounded-full px-4 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-[#a69f99] block mb-1">
                        Gecikmiş Tahsilat Eskalasyon Süresi (Gün)
                      </label>
                      <input
                        type="number"
                        value={deptSettings.accOverdueWarningDays}
                        onChange={(e) => updateDeptSetting('accOverdueWarningDays', e.target.value)}
                        className="w-full bg-[#1e1c1a] border border-[#4a443f] focus:border-[#b99881] rounded-full px-4 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#4a443f]/40">
                    <div>
                      <div className="text-xs font-medium text-white">Vadesi Yaklaşan Ödemelerde WhatsApp Hatırlatma</div>
                      <div className="text-[11px] text-[#8c857f]">
                        Vade tarihine belirtilen gün kala müşteriye ödeme planı hatırlatması hazırlar
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateDeptSetting('accSendOverdueWhatsapp', !deptSettings.accSendOverdueWhatsapp)}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        deptSettings.accSendOverdueWhatsapp ? 'bg-[#b99881]' : 'bg-[#4a443f]'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                          deptSettings.accSendOverdueWhatsapp ? 'left-6' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    {deptSavedMessage ? <span className="text-xs text-emerald-400">{deptSavedMessage}</span> : <span />}
                    <GlassButton
                      variant="gold"
                      size="sm"
                      onClick={() => handleSaveDeptConfig('Vade hatırlatıcı kuralları kaydedildi.')}
                      className="rounded-full px-5"
                    >
                      Kaydet
                    </GlassButton>
                  </div>
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
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const count = trashStore.restoreAll()
                          setTrashItems(trashStore.getAll())
                          if (count > 0) {
                            setTrashNotice(`${count} öge ilgili sayfalarına başarıyla geri yüklendi.`)
                            setTimeout(() => setTrashNotice(null), 3000)
                          }
                        }}
                        className="px-3.5 py-1.5 rounded-full bg-[#b99881] hover:bg-[#a6856e] text-white text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Tümünü Geri Yükle</span>
                      </button>
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
                    </div>
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

            {activeTab === 'dept-admin-approvals' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">
                    İskonto & Yönetici Onay Sınırları
                  </h3>
                  <p className="text-xs text-[#a69f99] mt-0.5">
                    Satış temsilcisi, departman müdürü ve yönetim kurulu onayına tabi maksimum iskonto oranları.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#24211f]/60 border border-[#4a443f] space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] text-[#a69f99] block mb-1">
                        Temsilci İskonto Yetkisi (%)
                      </label>
                      <input
                        type="number"
                        value={deptSettings.adminRepMaxDiscountPct}
                        onChange={(e) => updateDeptSetting('adminRepMaxDiscountPct', e.target.value)}
                        className="w-full bg-[#1e1c1a] border border-[#4a443f] focus:border-[#b99881] rounded-full px-4 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-[#a69f99] block mb-1">
                        Departman Müdürü Yetkisi (%)
                      </label>
                      <input
                        type="number"
                        value={deptSettings.adminManagerMaxDiscountPct}
                        onChange={(e) => updateDeptSetting('adminManagerMaxDiscountPct', e.target.value)}
                        className="w-full bg-[#1e1c1a] border border-[#4a443f] focus:border-[#b99881] rounded-full px-4 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-[#a69f99] block mb-1">
                        Yönetim Kurulu Onay Eşiği (%)
                      </label>
                      <input
                        type="number"
                        value={deptSettings.adminRequireBoardApprovalAbovePct}
                        onChange={(e) => updateDeptSetting('adminRequireBoardApprovalAbovePct', e.target.value)}
                        className="w-full bg-[#1e1c1a] border border-[#4a443f] focus:border-[#b99881] rounded-full px-4 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    {deptSavedMessage ? <span className="text-xs text-emerald-400">{deptSavedMessage}</span> : <span />}
                    <GlassButton
                      variant="gold"
                      size="sm"
                      onClick={() => handleSaveDeptConfig('İskonto ve onay sınırları kaydedildi.')}
                      className="rounded-full px-5"
                    >
                      Kaydet
                    </GlassButton>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'dept-admin-audit' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">
                    Güvenlik & Denetim Kayıtları
                  </h3>
                  <p className="text-xs text-[#a69f99] mt-0.5">
                    Oturum zaman aşımı süresi, işlem kütüğü saklama periyodu ve dışa aktarım güvenlik bildirimleri.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#24211f]/60 border border-[#4a443f] space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-[#a69f99] block mb-1">
                        Otomatik Oturum Zaman Aşımı (Dakika)
                      </label>
                      <input
                        type="number"
                        value={deptSettings.adminSessionTimeoutMins}
                        onChange={(e) => updateDeptSetting('adminSessionTimeoutMins', e.target.value)}
                        className="w-full bg-[#1e1c1a] border border-[#4a443f] focus:border-[#b99881] rounded-full px-4 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-[#a69f99] block mb-1">
                        Denetim Logu Saklama Süresi (Gün)
                      </label>
                      <input
                        type="number"
                        value={deptSettings.adminAuditRetentionDays}
                        onChange={(e) => updateDeptSetting('adminAuditRetentionDays', e.target.value)}
                        className="w-full bg-[#1e1c1a] border border-[#4a443f] focus:border-[#b99881] rounded-full px-4 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#4a443f]/40">
                    <div>
                      <div className="text-xs font-medium text-white">Toplu Veri Dışa Aktarımında Yönetici Bildirimi</div>
                      <div className="text-[11px] text-[#8c857f]">
                        Müşteri veya muhasebe listeleri dışa aktarıldığında güvenlik kaydı oluşturur
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateDeptSetting('adminLogExportAlerts', !deptSettings.adminLogExportAlerts)}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        deptSettings.adminLogExportAlerts ? 'bg-[#b99881]' : 'bg-[#4a443f]'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                          deptSettings.adminLogExportAlerts ? 'left-6' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    {deptSavedMessage ? <span className="text-xs text-emerald-400">{deptSavedMessage}</span> : <span />}
                    <GlassButton
                      variant="gold"
                      size="sm"
                      onClick={() => handleSaveDeptConfig('Güvenlik ve denetim ayarları kaydedildi.')}
                      className="rounded-full px-5"
                    >
                      Kaydet
                    </GlassButton>
                  </div>
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
