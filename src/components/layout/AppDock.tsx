import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  Building2,
  Cloud,
  Trophy,
  Calculator,
  Plus,
  Compass,
  Settings,
  Folder,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Sparkles,
  BookOpen,
  UserCheck,
  FileText,
  TurkishLira,
  TrendingUp,
  PieChart,
  MessageCircle,
  Layers,
  ArrowRightLeft,
  Scale,
  Percent,
  CreditCard,
  MapPin,
  Building,
  FileCheck,
  Target,
  Bell,
  QrCode,
  BarChart3,
  Calendar,
  ShieldCheck,
  Receipt,
  Home,
  Sun,
  Timer,
  Pin,
  PinOff,
  Wallet,
  Mail,
  UserPlus,
} from 'lucide-react'
import { NavTab } from './Navbar'
import { BookLogo } from '@/components/common/BookLogo'
import { AppUser } from '@/services/userStore'
import { ToolType } from '@/components/tools/QuickToolsModal'

export interface DockItemConfig {
  id: string
  label: string
  iconType?: 'portfolio' | 'contacts' | 'crm' | 'shared' | 'projects' | 'calc' | 'notepad' | 'new-lead' | 'custom' | 'settings'
  tab?: NavTab
  toolId?: ToolType
  isAction?: boolean
  isMail?: boolean
  isSettings?: boolean
}

const DEFAULT_DOCK_ITEMS: DockItemConfig[] = [
  { id: 'dock-notepad', label: 'Not Defteri', iconType: 'notepad', toolId: 'notepad', isAction: true },
  { id: 'dock-calc', label: 'Hesap Makinesi', iconType: 'calc', toolId: 'calculator', isAction: true },
  { id: 'dock-tool-payments', label: 'Ödemeler', iconType: 'custom', toolId: 'payments', isAction: true },
]

const STORAGE_KEY_DOCK_ORDER = 'demirturk_dock_order_v1'
const STORAGE_KEY_START_GRID = 'demirturk_start_menu_grid'
const STORAGE_KEY_DOCK_ENABLED = 'demirturk_dock_enabled'
const STORAGE_KEY_QUICK_ACCESS = 'demirturk_start_quick_access_v2'

const DEFAULT_QUICK_ACCESS_IDS = ['contacts', 'payments', 'notepad', 'calculator', 'commission']

export interface StartMenuItem {
  id: string
  name: string
  icon: React.ComponentType<{ className?: string }>
  type: 'page' | 'tool' | 'action'
  tab?: NavTab
  toolId?: ToolType
  isMail?: boolean
  isSettings?: boolean
}

export const SETTINGS_MENU_ITEM: StartMenuItem = {
  id: 'settings',
  name: 'Ayarlar',
  icon: Settings,
  type: 'action',
  isSettings: true,
}

const START_MENU_ITEMS: StartMenuItem[] = [
  { id: 'contacts', name: 'Kişiler', icon: UserCheck, type: 'page', tab: 'contacts' },
  { id: 'payments', name: 'Ödemeler', icon: Wallet, type: 'tool', toolId: 'payments' },
  { id: 'notepad', name: 'Not Defteri', icon: FileText, type: 'tool', toolId: 'notepad' },
  { id: 'calculator', name: 'Hesap Makinesi', icon: Calculator, type: 'tool', toolId: 'calculator' },
  { id: 'commission', name: 'Satış Primi', icon: TurkishLira, type: 'tool', toolId: 'commission' },
  { id: 'currency', name: 'Döviz & Kur', icon: ArrowRightLeft, type: 'tool', toolId: 'currency' },
  { id: 'mortgage', name: 'Konut Kredisi', icon: TrendingUp, type: 'tool', toolId: 'mortgage' },
  { id: 'deedFee', name: 'Tapu Harcı', icon: PieChart, type: 'tool', toolId: 'deedFee' },
  { id: 'whatsapp', name: 'WhatsApp', icon: MessageCircle, type: 'tool', toolId: 'whatsapp' },
  { id: 'sqmPrice', name: 'm² Birim Fiyat', icon: Layers, type: 'tool', toolId: 'sqmPrice' },
  { id: 'roi', name: 'Kira Amortisman', icon: Scale, type: 'tool', toolId: 'roi' },
  { id: 'bargain', name: 'Pazarlık Marjı', icon: Percent, type: 'tool', toolId: 'bargain' },
  { id: 'downpayment', name: 'Peşinat Planı', icon: CreditCard, type: 'tool', toolId: 'downpayment' },
  { id: 'parsel', name: 'TKGM Parsel', icon: MapPin, type: 'tool', toolId: 'parsel' },
  { id: 'compass', name: 'Güneş & Cephe', icon: Compass, type: 'tool', toolId: 'compass' },
  { id: 'valuation', name: 'Ekspertiz', icon: Building, type: 'tool', toolId: 'valuation' },
  { id: 'contracts', name: 'Sözleşmeler', icon: FileCheck, type: 'tool', toolId: 'contracts' },
  { id: 'target', name: 'Satış Hedefi', icon: Target, type: 'tool', toolId: 'target' },
  { id: 'reminders', name: 'Hatırlatıcı', icon: Bell, type: 'tool', toolId: 'reminders' },
  { id: 'qr', name: 'Kartvizit QR', icon: QrCode, type: 'tool', toolId: 'qr' },
  { id: 'market', name: 'Piyasa Endeks', icon: BarChart3, type: 'tool', toolId: 'market' },
  { id: 'calendar', name: 'Randevular', icon: Calendar, type: 'tool', toolId: 'calendar' },
  { id: 'dask', name: 'DASK Sigorta', icon: ShieldCheck, type: 'tool', toolId: 'dask' },
  { id: 'taxincome', name: 'Kira Vergisi', icon: Receipt, type: 'tool', toolId: 'taxincome' },
  { id: 'aidat', name: 'Aidat Dağıtıcı', icon: Home, type: 'tool', toolId: 'aidat' },
  { id: 'weather', name: 'Saha Durumu', icon: Sun, type: 'tool', toolId: 'weather' },
  { id: 'timer', name: 'Kronometre', icon: Timer, type: 'tool', toolId: 'timer' },
]

const ALL_DOCK_TOOLS = START_MENU_ITEMS.filter((i) => i.type === 'tool').map((i) => ({
  id: i.toolId as ToolType,
  name: i.name,
  icon: i.icon,
}))

interface AppDockProps {
  activeTab: NavTab
  onTabChange: (tab: NavTab) => void
  onOpenTool: (tool: ToolType) => void
  onOpenAddLead: () => void
  onOpenSettings: () => void
  onOpenProfile: () => void
  onOpenMail?: () => void
  currentUser?: AppUser | null
}

export const AppDock: React.FC<AppDockProps> = ({
  activeTab,
  onTabChange,
  onOpenTool,
  onOpenAddLead,
  onOpenSettings,
  onOpenProfile,
  onOpenMail,
  currentUser,
}) => {
  const [isVisible, setIsVisible] = useState(true)
  const [isStartMenuOpen, setIsStartMenuOpen] = useState(false)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [hoveredTooltipId, setHoveredTooltipId] = useState<string | null>(null)

  // Dock Enabled state
  const [dockEnabled, setDockEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DOCK_ENABLED)
      if (saved !== null) return saved !== 'false'
    } catch {}
    return true
  })

  useEffect(() => {
    const handleConfigSync = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_DOCK_ENABLED)
        if (saved !== null) setDockEnabled(saved !== 'false')
      } catch {}
    }
    window.addEventListener('demirturk_dock_config_updated', handleConfigSync)
    return () => window.removeEventListener('demirturk_dock_config_updated', handleConfigSync)
  }, [])
  const [dockItems, setDockItems] = useState<DockItemConfig[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DOCK_ORDER)
      if (saved) {
        const parsed = JSON.parse(saved) as DockItemConfig[]
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Sayfalar ve mesaj/posta dock'ta yer almaz; yalnızca navbar'ın ikonlar kısmında olacak
          const sanitized = parsed.filter(
            (d) =>
              !d.tab &&
              d.id !== 'dock-portfolio' &&
              d.id !== 'dock-crm' &&
              d.id !== 'dock-shared' &&
              d.id !== 'dock-projects' &&
              d.id !== 'dock-contacts' &&
              d.id !== 'dock-mail' &&
              !d.isMail &&
              d.id !== 'dock-messages' &&
              d.id !== 'dock-new-lead' &&
              d.iconType !== 'new-lead'
          )
          if (sanitized.length > 0) {
            localStorage.setItem(STORAGE_KEY_DOCK_ORDER, JSON.stringify(sanitized))
            return sanitized
          }
        }
      }
    } catch {
      // ignore
    }
    localStorage.setItem(STORAGE_KEY_DOCK_ORDER, JSON.stringify(DEFAULT_DOCK_ITEMS))
    return DEFAULT_DOCK_ITEMS
  })

  // Start Menu Grid Layout ('4x5' | '5x5' | '5x6')
  const [startMenuGrid, setStartMenuGrid] = useState<'4x5' | '5x5' | '5x6'>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_START_GRID)
      if (saved === '4x5' || saved === '5x5' || saved === '5x6') return saved
    } catch {
      // ignore
    }
    return '4x5'
  })

  const handleSetGrid = (grid: '4x5' | '5x5' | '5x6') => {
    setStartMenuGrid(grid)
    localStorage.setItem(STORAGE_KEY_START_GRID, grid)
    window.dispatchEvent(new Event('demirturk_start_menu_grid_updated'))
  }

  useEffect(() => {
    const handleSync = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_START_GRID)
        if (saved === '4x5' || saved === '5x5' || saved === '5x6') {
          setStartMenuGrid(saved)
        }
      } catch {
        // ignore
      }
    }
    window.addEventListener('demirturk_start_menu_grid_updated', handleSync)
    return () => window.removeEventListener('demirturk_start_menu_grid_updated', handleSync)
  }, [])

  // Hızlı Erişim Durumu (Başlat menüsünün üstündeki sabit sıra)
  const [quickAccessIds, setQuickAccessIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_QUICK_ACCESS)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          const sanitized = parsed.filter((id) => id !== 'mail' && id !== 'messages')
          if (sanitized.length > 0) return sanitized
        }
      }
    } catch {}
    return DEFAULT_QUICK_ACCESS_IDS
  })

  // Hızlı Erişim üst sınır sayısı: Izgara 4x5 ise ilk 4, 5x5 veya 5x6 ise ilk 5
  const maxQuickCount = startMenuGrid === '4x5' ? 4 : 5
  const activeQuickAccessIds = quickAccessIds.slice(0, maxQuickCount)

  const activeQuickAccessItems: StartMenuItem[] = activeQuickAccessIds
    .map((id) => START_MENU_ITEMS.find((s) => s.id === id) || (id === 'settings' ? SETTINGS_MENU_ITEM : null))
    .filter(Boolean) as StartMenuItem[]

  const remainingItems = START_MENU_ITEMS.filter((item) => !activeQuickAccessIds.includes(item.id))

  const hideTimerRef = useRef<number | null>(null)
  const startMenuRef = useRef<HTMLDivElement>(null)
  const dockRef = useRef<HTMLDivElement>(null)

  const isSalesOrManager =
    currentUser?.department === 'Satış' ||
    currentUser?.department === 'Yönetim' ||
    currentUser?.isManager ||
    !currentUser

  // Sayfalar dock'ta yer almaz; yalnızca araçlar ve eylemler
  const visibleItems = dockItems.filter(
    (item) => !item.tab && item.id !== 'dock-new-lead' && item.id !== 'dock-messages' && item.id !== 'dock-mail'
  )

  // Sığmayan kelimeleri satır bazında '...' (ellipsis) ile kesen yardımcı fonksiyon
  const renderMenuItemLabel = (name: string) => {
    const words = name.trim().split(/\s+/)
    if (words.length <= 1) {
      return <span className="block w-full truncate">{name}</span>
    }
    const line1 = words.slice(0, -1).join(' ')
    const line2 = words[words.length - 1]
    return (
      <>
        <span className="block w-full truncate">{line1}</span>
        <span className="block w-full truncate">{line2}</span>
      </>
    )
  }

  // Timer reset helper
  const resetHideTimer = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
    }
    setIsVisible(true)
    hideTimerRef.current = window.setTimeout(() => {
      // Don't hide if start menu is open or mouse is currently over the dock
      if (!isStartMenuOpen) {
        setIsVisible(false)
      }
    }, 2000) // 2 seconds auto-hide
  }

  // Handle mouse enter / leave on dock container
  const handleMouseEnter = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
    }
    setIsVisible(true)
  }

  const handleMouseLeave = () => {
    setHoveredTooltipId(null)
    if (!isStartMenuOpen) {
      resetHideTimer()
    }
  }

  // Başlat menüsü veya herhangi bir uygulama açıldığında tooltip'i derhal sıfırla
  useEffect(() => {
    if (isStartMenuOpen) {
      setHoveredTooltipId(null)
    }
  }, [isStartMenuOpen])

  // Global mouse movement near bottom to reveal dock
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // If mouse within 60px of the bottom edge, reveal dock
      if (window.innerHeight - e.clientY <= 60) {
        setIsVisible(true)
        resetHideTimer()
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [isStartMenuOpen])

  // Initial timer on mount
  useEffect(() => {
    resetHideTimer()
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [])

  // Close start menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        startMenuRef.current &&
        !startMenuRef.current.contains(e.target as Node) &&
        dockRef.current &&
        !dockRef.current.contains(e.target as Node)
      ) {
        setIsStartMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Drag & Drop Reordering
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id)
    e.dataTransfer.setData('text/plain', id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!draggedId || draggedId === targetId) return

    const newItems = [...dockItems]
    const fromIndex = newItems.findIndex((item) => item.id === draggedId)
    const toIndex = newItems.findIndex((item) => item.id === targetId)

    if (fromIndex !== -1 && toIndex !== -1) {
      const [moved] = newItems.splice(fromIndex, 1)
      newItems.splice(toIndex, 0, moved)
      setDockItems(newItems)
      localStorage.setItem(STORAGE_KEY_DOCK_ORDER, JSON.stringify(newItems))
    }
    setDraggedId(null)
  }

  // Sağ tık bağlam menüsü (Context menu) durumu
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    item: StartMenuItem
  } | null>(null)

  // Hızlı bildirim (Toast)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const toastTimeoutRef = useRef<number | null>(null)

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    setToastMessage(msg)
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage(null)
    }, 2200)
  }

  // 1. GÖREV ÇUBUĞU (DOCK) YÖNETİMİ
  // Ögenin Görev Çubuğunda (Dock) olup olmadığını kontrol eder
  const isItemOnTaskbar = (item: StartMenuItem): boolean => {
    if (item.id === 'settings' || item.isSettings) {
      return dockItems.some((d) => d.id === 'dock-settings' || d.isSettings)
    }
    if (item.isMail || item.id === 'mail') {
      return dockItems.some((d) => d.id === 'dock-mail' || d.isMail)
    }
    if (item.type === 'page') {
      return dockItems.some((d) => d.tab === item.tab)
    }
    return dockItems.some(
      (d) =>
        d.toolId === item.toolId ||
        (item.toolId === 'calculator' && (d.id === 'dock-calc' || d.toolId === 'calculator')) ||
        (item.toolId === 'notepad' && (d.id === 'dock-notepad' || d.toolId === 'notepad'))
    )
  }

  // Görev çubuğuna ekle / Görev çubuğundan kaldır
  const handleToggleTaskbar = (item: StartMenuItem) => {
    if (item.type === 'page' || item.isMail || item.id === 'mail') {
      showToast('Bu öge görev çubuğuna eklenemez.')
      setContextMenu(null)
      return
    }

    const onTaskbar = isItemOnTaskbar(item)
    let newItems: DockItemConfig[]

    if (onTaskbar) {
      if (item.id === 'settings' || item.isSettings) {
        newItems = dockItems.filter((d) => d.id !== 'dock-settings' && !d.isSettings)
      } else if (item.isMail || item.id === 'mail') {
        newItems = dockItems.filter((d) => d.id !== 'dock-mail' && !d.isMail)
      } else {
        newItems = dockItems.filter(
          (d) =>
            d.toolId !== item.toolId &&
            !(item.toolId === 'calculator' && (d.id === 'dock-calc' || d.toolId === 'calculator')) &&
            !(item.toolId === 'notepad' && (d.id === 'dock-notepad' || d.toolId === 'notepad'))
        )
      }
      showToast(`"${item.name}" görev çubuğundan kaldırıldı.`)
    } else {
      const newItem: DockItemConfig =
        item.id === 'settings' || item.isSettings
          ? {
              id: 'dock-settings',
              label: 'Ayarlar',
              iconType: 'settings',
              isAction: true,
              isSettings: true,
            }
          : item.isMail || item.id === 'mail'
          ? {
              id: 'dock-mail',
              label: 'E-Posta',
              iconType: 'custom',
              isAction: true,
              isMail: true,
            }
          : {
              id: `dock-tool-${item.toolId}`,
              label: item.name,
              toolId: item.toolId,
              isAction: true,
            }
      newItems = [...dockItems, newItem]
      showToast(`"${item.name}" görev çubuğuna sabitlendi.`)
    }

    setDockItems(newItems)
    try {
      localStorage.setItem(STORAGE_KEY_DOCK_ORDER, JSON.stringify(newItems))
    } catch {}
    setContextMenu(null)
  }

  // 2. HIZLI ERİŞİM (BAŞLAT ÜST SIRASI) YÖNETİMİ
  // Ögenin Başlat menüsündeki Hızlı Erişimde (sabit sırada) olup olmadığını kontrol eder
  const isItemInQuickAccess = (item: StartMenuItem): boolean => {
    return activeQuickAccessIds.includes(item.id)
  }

  // Hızlı erişime ekle / Hızlı erişimden kaldır
  const handleToggleQuickAccess = (item: StartMenuItem) => {
    const inQuick = activeQuickAccessIds.includes(item.id)
    let newIds: string[]

    if (inQuick) {
      newIds = quickAccessIds.filter((id) => id !== item.id)
      showToast(`"${item.name}" hızlı erişimden kaldırıldı.`)
    } else {
      // Başa ekle, böylece en son eklenen sabit sıranın başına gelir
      const filtered = quickAccessIds.filter((id) => id !== item.id)
      newIds = [item.id, ...filtered]
      showToast(`"${item.name}" hızlı erişime sabitlendi.`)
    }

    setQuickAccessIds(newIds)
    try {
      localStorage.setItem(STORAGE_KEY_QUICK_ACCESS, JSON.stringify(newIds))
    } catch {}
    setContextMenu(null)
  }

  // Sağ tık bağlam menüsü tetikleyici
  const handleContextMenu = (e: React.MouseEvent, item: StartMenuItem) => {
    e.preventDefault()
    e.stopPropagation()

    const menuWidth = 210
    const menuHeight = 110
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 12)
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 12)

    setContextMenu({
      x,
      y,
      item,
    })
  }

  // Bağlam menüsünü dış tıklama / escape / kaydırma durumunda kapat
  useEffect(() => {
    const handleDismiss = () => setContextMenu(null)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null)
    }
    window.addEventListener('click', handleDismiss)
    window.addEventListener('contextmenu', handleDismiss)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('scroll', handleDismiss, true)
    return () => {
      window.removeEventListener('click', handleDismiss)
      window.removeEventListener('contextmenu', handleDismiss)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', handleDismiss, true)
    }
  }, [])

  const getDockIcon = (item: DockItemConfig) => {
    if (item.isSettings || item.id === 'dock-settings' || item.iconType === 'settings') {
      return <Settings className="w-4 h-4" />
    }
    if (item.isMail || item.id === 'dock-mail') {
      return <Mail className="w-4 h-4" />
    }
    if (item.toolId) {
      const match = START_MENU_ITEMS.find((s) => s.toolId === item.toolId)
      if (match) {
        const IconComp = match.icon
        return <IconComp className="w-4 h-4" />
      }
    }
    switch (item.iconType) {
      case 'portfolio':
        return <Users className="w-4 h-4" />
      case 'contacts':
        return <UserCheck className="w-4 h-4" />
      case 'crm':
        return <Trophy className="w-4 h-4" />
      case 'shared':
        return <Cloud className="w-4 h-4" />
      case 'projects':
        return <Building2 className="w-4 h-4" />
      case 'notepad':
        return <FileText className="w-4 h-4" />
      case 'calc':
        return <Calculator className="w-4 h-4" />
      case 'new-lead':
        return <UserPlus className="w-4 h-4" />
      default:
        return <Sparkles className="w-4 h-4" />
    }
  }

  const handleItemClick = (item: DockItemConfig) => {
    setHoveredTooltipId(null)
    setIsStartMenuOpen(false)
    if (typeof document !== 'undefined' && document.activeElement) {
      (document.activeElement as HTMLElement).blur()
    }
    if (item.isSettings || item.id === 'dock-settings') {
      onOpenSettings()
    } else if (item.isMail || item.id === 'dock-mail') {
      onOpenMail?.()
    } else if (item.tab) {
      onTabChange(item.tab)
    } else if (item.toolId) {
      onOpenTool(item.toolId)
    } else if (item.id === 'dock-calc') {
      onOpenTool('calculator')
    } else if (item.id === 'dock-notepad') {
      onOpenTool('notepad')
    } else if (item.id === 'dock-new-lead') {
      onOpenAddLead()
    }
  }

  if (!dockEnabled) {
    return null
  }

  return (
    <>
      {/* 
        1. GİZLİ DURUM GÖSTERGESİ (BREATHING ACCENT LINE)
        Dock saklıyken ekranın en altında mevcut pastel tonlarda renk değiştiren hafif kalın çizgi 
      */}
      <div
        onClick={() => {
          setIsVisible(true)
          resetHideTimer()
        }}
        onMouseEnter={() => {
          setIsVisible(true)
          resetHideTimer()
        }}
        className={`fixed bottom-1.5 left-1/2 -translate-x-1/2 z-40 transition-all duration-300 cursor-pointer group py-2 px-6 ${
          isVisible ? 'opacity-0 pointer-events-none translate-y-4' : 'opacity-100 translate-y-0'
        }`}
        title="Görev Çubuğunu Göster"
      >
        <div className="h-1.5 w-36 sm:w-52 rounded-full dock-breathing-line group-hover:h-2 group-hover:w-60 transition-all duration-300 shadow-lg" />
      </div>

      {/* 
        BAŞLAT AÇILDIĞINDA SOL BAR HARİÇ ARKA PLAN BLUR KATMANI
      */}
      <AnimatePresence>
        {isStartMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsStartMenuOpen(false)}
            className="fixed top-0 right-0 bottom-0 left-0 md:left-[216px] z-[45] bg-black/15 backdrop-blur-md"
          />
        )}
      </AnimatePresence>

      {/* 
        2. ASILI DOCK KONTEYNERI (FLOATING DOCK)
        2 sn inaktif kalındığında yumuşakça aşağı kayarak kendini saklar
      */}
      <div
        ref={dockRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`fixed bottom-3.5 left-1/2 -translate-x-1/2 ${
          isStartMenuOpen ? 'z-50' : 'z-40'
        } transition-all duration-300 ease-out transform ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'
        }`}
      >
        {/* 
          BAŞLAT MENÜSÜ POPOVER (DOCK'UN TAM ÜSTÜNE DOĞRU AÇILIR)
          Sabit sol logo butonuna tıklandığında dock'un üzerinden yukarı doğru açılır
        */}
        <AnimatePresence>
          {isStartMenuOpen && (
            <motion.div
              ref={startMenuRef}
              initial={{ opacity: 0, y: 36, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 22, scale: 0.97 }}
              transition={{
                duration: 0.28,
                ease: [0.16, 1, 0.3, 1],
              }}
              className={`dropdown-panel absolute bottom-full mb-3.5 left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 w-[calc(100vw-32px)] ${
                startMenuGrid === '4x5' ? 'sm:w-[380px]' : 'sm:w-[460px]'
              } rounded-[32px] p-4 sm:p-5 backdrop-blur-2xl space-y-3.5 z-50`}
            >
            {/* Header / User Info & Grid Selector */}
            <div className="flex items-center justify-between pb-1 gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-full bg-[#34302d] border border-[#b99881]/40 flex items-center justify-center text-sm font-bold text-[#b99881] shrink-0 overflow-hidden shadow-sm">
                  {currentUser?.avatarUrl ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.fullName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    currentUser?.fullName ? currentUser.fullName[0] : 'P'
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-white truncate">
                    {currentUser?.fullName || 'Demirtürk Portföy'}
                  </h4>
                  <p className="text-xs text-[#8c857f] truncate">
                    {currentUser ? `@${currentUser.username} • ${currentUser.department}` : 'Misafir'}
                  </p>
                </div>
              </div>

              {/* User Actions & Shortcuts */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsStartMenuOpen(false)
                    onOpenProfile()
                  }}
                  className="px-3 py-1 rounded-full bg-[#1c1a18] border border-[#4a443f]/70 text-xs text-[#d6beae] hover:text-white transition-all cursor-pointer"
                  title="Kullanıcı Profili"
                >
                  Profil
                </button>
              </div>
            </div>

            {/* 
              1. HIZLI ERİŞİM (BAŞLAT MENÜSÜNDE ÜSTTE SABİT, KAYMAYAN İLK 4 VEYA 5 UYGULAMA)
            */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-bold text-[#dfb76c] uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-[#dfb76c]" />
                  <span>Hızlı Erişim</span>
                </span>
                <span className="text-[10px] text-[#8c857f] font-medium">
                  Sabit Sıra ({activeQuickAccessItems.length}/{maxQuickCount})
                </span>
              </div>

              <div
                className={`grid ${
                  startMenuGrid === '4x5' ? 'grid-cols-4' : 'grid-cols-5'
                } gap-1 p-1 rounded-2xl bg-[#24211f]/70 border border-[#b99881]/25`}
              >
                {activeQuickAccessItems.map((item) => {
                  const Icon = item.icon
                  const onTaskbar = isItemOnTaskbar(item)

                  return (
                    <button
                      key={`quick-${item.id}`}
                      onClick={() => {
                        setIsStartMenuOpen(false)
                        setHoveredTooltipId(null)
                        if (typeof document !== 'undefined' && document.activeElement) {
                          (document.activeElement as HTMLElement).blur()
                        }
                        if (item.isMail || item.id === 'mail') {
                          onOpenMail?.()
                        } else if (item.type === 'page' && item.tab) {
                          onTabChange(item.tab)
                        } else if (item.toolId) {
                          onOpenTool(item.toolId)
                        }
                      }}
                      onContextMenu={(e) => handleContextMenu(e, item)}
                      title={item.name}
                      className="group relative w-full min-w-0 overflow-hidden flex flex-col items-center justify-start px-1 py-1.5 rounded-xl hover:bg-white/5 transition-all cursor-pointer text-center min-h-[72px]"
                    >
                      {/* Görev Çubuğunda Sabitli İkon Rozeti */}
                      {onTaskbar && (
                        <span
                          className="absolute top-1 right-2 text-[#b99881]"
                          title="Görev çubuğunda sabitli"
                        >
                          <Pin className="w-2.5 h-2.5 fill-[#b99881]" />
                        </span>
                      )}

                      {/* Sabit İkon Alanı: Asla yukarı kaymaz, satırdaki tüm ikonlar tam hizada */}
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-[#dfb76c] group-hover:text-[#f3efe9] group-hover:scale-110 transition-transform bg-[#34302d]/90 border border-[#dfb76c]/30 shrink-0">
                        <Icon className="w-5 h-5" />
                      </div>

                      {/* İsim Alanı: Sığmayan kelimeler '...' ile devam eder */}
                      <div className="w-full min-w-0 overflow-hidden min-h-[26px] flex flex-col items-center justify-start mt-1 text-xs font-semibold text-[#f3efe9] group-hover:text-[#dfb76c] leading-tight text-center">
                        {renderMenuItemLabel(item.name)}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 
              2. DİĞER UYGULAMALAR & ARAÇLAR (KAYDIRILABİLİR IZGARA)
            */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-1 pt-0.5">
                <span className="text-[10px] font-bold text-[#8c857f] uppercase tracking-wider">
                  Tüm Uygulamalar & Araçlar
                </span>
              </div>

              <div
                className={`grid ${
                  startMenuGrid === '4x5' ? 'grid-cols-4' : 'grid-cols-5'
                } gap-y-3 gap-x-1 py-1.5 max-h-[250px] overflow-y-auto pr-0.5`}
              >
                {remainingItems.map((item) => {
                  const Icon = item.icon
                  const onTaskbar = isItemOnTaskbar(item)

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setIsStartMenuOpen(false)
                        setHoveredTooltipId(null)
                        if (typeof document !== 'undefined' && document.activeElement) {
                          (document.activeElement as HTMLElement).blur()
                        }
                        if (item.isMail || item.id === 'mail') {
                          onOpenMail?.()
                        } else if (item.type === 'page' && item.tab) {
                          onTabChange(item.tab)
                        } else if (item.toolId) {
                          onOpenTool(item.toolId)
                        }
                      }}
                      onContextMenu={(e) => handleContextMenu(e, item)}
                      title={item.name}
                      className="group relative w-full min-w-0 overflow-hidden flex flex-col items-center justify-start px-1 py-1.5 rounded-2xl hover:bg-white/5 transition-all cursor-pointer text-center min-h-[76px]"
                    >
                      {/* Görev Çubuğunda Sabitli İkon Rozeti */}
                      {onTaskbar && (
                        <span
                          className="absolute top-1 right-2 text-[#b99881]"
                          title="Görev çubuğunda sabitli"
                        >
                          <Pin className="w-2.5 h-2.5 fill-[#b99881]" />
                        </span>
                      )}

                      {/* Sabit İkon Alanı: Asla yukarı kaymaz */}
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-[#b99881] group-hover:text-[#d6beae] group-hover:scale-110 transition-transform shrink-0">
                        <Icon className="w-5.5 h-5.5" />
                      </div>

                      {/* İsim Alanı: Sığmayan kelimeler '...' ile devam eder */}
                      <div className="w-full min-w-0 overflow-hidden min-h-[28px] flex flex-col items-center justify-start mt-1 text-xs font-semibold text-[#c4bcb5] group-hover:text-white leading-tight text-center">
                        {renderMenuItemLabel(item.name)}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Footer Bar */}
            <div className="pt-1 flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => {
                  setIsStartMenuOpen(false)
                  onOpenProfile()
                }}
                className="text-[#b99881] hover:text-[#d6beae] transition-colors cursor-pointer flex items-center gap-1.5 font-medium px-2 py-1 rounded-xl hover:bg-white/5"
              >
                <span>Profil & Danışman Hesabı</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsStartMenuOpen(false)
                  setHoveredTooltipId(null)
                  if (typeof document !== 'undefined' && document.activeElement) {
                    (document.activeElement as HTMLElement).blur()
                  }
                  onOpenSettings()
                }}
                onContextMenu={(e) => handleContextMenu(e, SETTINGS_MENU_ITEM)}
                className="group relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[#b99881] hover:text-[#d6beae] hover:bg-[#b99881]/15 transition-all cursor-pointer font-medium text-xs sm:text-sm border border-transparent hover:border-[#b99881]/30"
              >
                <Settings className="w-4 h-4 group-hover:rotate-45 transition-transform duration-300" />
                <span>Ayarlar</span>
                {isItemOnTaskbar(SETTINGS_MENU_ITEM) && (
                  <span className="text-[#b99881]" title="Görev çubuğunda sabitli">
                    <Pin className="w-3 h-3 fill-[#b99881]" />
                  </span>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

        <div className="flex items-center gap-2 p-2 rounded-full bg-[#413f3d]/90 border border-[#b99881]/25 backdrop-blur-xl shadow-2xl relative">
          
          {/* 
            EN SOLDA HER ZAMAN SABİT BAŞLAT BUTONU (YUVARLAK İÇİNDE UYGULAMA LOGOSU)
            Yer değiştirilemez, sabit kalır; tıklandığında Başlat Menüsü açılır.
          */}
          <div
            className="relative"
            onMouseEnter={() => {
              if (!isStartMenuOpen) {
                setHoveredTooltipId('start')
              }
            }}
            onMouseLeave={() => {
              setHoveredTooltipId(null)
            }}
          >
            <button
              type="button"
              onClick={() => {
                setHoveredTooltipId(null)
                if (typeof document !== 'undefined' && document.activeElement) {
                  (document.activeElement as HTMLElement).blur()
                }
                setIsStartMenuOpen((prev) => !prev)
                setIsVisible(true)
              }}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer border ${
                isStartMenuOpen
                  ? 'bg-[#b99881] text-[#1c1a18] border-[#b99881] shadow-lg scale-105'
                  : 'bg-[#34302d] hover:bg-[#3d3733] border-[#b99881]/50 text-[#b99881] hover:scale-105'
              }`}
            >
              <BookLogo className="w-5 h-5 transition-transform hover:scale-110" />
            </button>
            <span
              className={`absolute -top-9 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#1c1a18]/95 text-xs font-semibold text-white whitespace-nowrap pointer-events-none border border-[#4a443f] shadow-lg transition-all duration-100 ${
                !isStartMenuOpen && hoveredTooltipId === 'start'
                  ? 'opacity-100 scale-100'
                  : 'opacity-0 scale-95 pointer-events-none'
              }`}
            >
              Başlat
            </span>
          </div>

          {/* Dikey Ayrım Çizgisi */}
          <div className="w-[1px] h-6 bg-[#4a443f] mx-0.5" />

          {/* 
            SÜRÜKLENEBİLİR VE YER DEĞİŞTİREBİLİR DOCK BUTONLARI
            Tüm butonlar yuvarlak içinde, hover efektli ve sürüklenebilir
          */}
          <div className="flex items-center gap-2">
            {visibleItems.map((item) => {
              const isActive = item.tab && activeTab === item.tab
              const isAction = item.isAction

              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, item.id)}
                  onMouseEnter={() => {
                    if (!isStartMenuOpen) {
                      setHoveredTooltipId(item.id)
                    }
                  }}
                  onMouseLeave={() => {
                    setHoveredTooltipId(null)
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setHoveredTooltipId(null)
                    if (item.isSettings || item.id === 'dock-settings') {
                      handleContextMenu(e, SETTINGS_MENU_ITEM)
                      return
                    }
                    const matched = START_MENU_ITEMS.find(
                      (s) =>
                        (item.tab && s.tab === item.tab) ||
                        (item.toolId && s.toolId === item.toolId) ||
                        (item.id === 'dock-calc' && s.toolId === 'calculator') ||
                        (item.id === 'dock-notepad' && s.toolId === 'notepad') ||
                        (item.isMail && s.id === 'mail')
                    )
                    if (matched) {
                      handleContextMenu(e, matched)
                    }
                  }}
                  className="relative cursor-grab active:cursor-grabbing"
                >
                  <button
                    type="button"
                    onClick={() => handleItemClick(item)}
                    className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer border relative ${
                      isActive
                        ? 'bg-[#423c38] text-white border-[#b99881] ring-2 ring-[#b99881]/40 shadow-md scale-105'
                        : isAction
                        ? 'bg-[#34302d] text-[#d6beae] border-[#4a443f] hover:border-[#b99881] hover:text-white hover:bg-[#3d3733] hover:scale-105'
                        : 'bg-[#34302d] text-[#a69f99] border-[#4a443f] hover:border-[#b99881]/60 hover:text-white hover:bg-[#3d3733] hover:scale-105'
                    }`}
                  >
                    {getDockIcon(item)}
                    {/* Küçük aktif gösterge noktası */}
                    {isActive && (
                      <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-[#b99881]" />
                    )}
                  </button>

                  {/* Tooltip */}
                  <span
                    className={`absolute -top-9 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#1c1a18]/95 text-xs font-semibold text-white whitespace-nowrap pointer-events-none border border-[#4a443f] shadow-lg transition-all duration-100 ${
                      !isStartMenuOpen && hoveredTooltipId === item.id
                        ? 'opacity-100 scale-100'
                        : 'opacity-0 scale-95 pointer-events-none'
                    }`}
                  >
                    {item.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* 
        SAĞ TIK BAĞLAM MENÜSÜ (CONTEXT MENU)
        Başlat menüsündeki veya Dock üzerindeki ögelere sağ tıklandığında açılır
      */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{
              opacity: 0,
              scale: 0.95,
              y: contextMenu.y > (typeof window !== 'undefined' ? window.innerHeight / 2 : 400) ? 14 : -14,
            }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{
              opacity: 0,
              scale: 0.95,
              y: contextMenu.y > (typeof window !== 'undefined' ? window.innerHeight / 2 : 400) ? 8 : -8,
            }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            style={{
              top: `${contextMenu.y}px`,
              left: `${contextMenu.x}px`,
            }}
            className="fixed z-[9999] min-w-[210px] rounded-[22px] bg-[#24211f]/95 backdrop-blur-2xl p-3 select-none text-left border border-[#4a443f] shadow-2xl shadow-black/80 space-y-1"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: Katmansız, kutusuz, sadece ikon ve başlık */}
            <div className="flex items-center gap-2.5 px-2 py-1 mb-1">
              <contextMenu.item.icon className="w-4 h-4 text-[#b99881] shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold text-white block truncate">
                  {contextMenu.item.name}
                </span>
                <span className="text-[10px] text-[#8c857f] block">
                  {contextMenu.item.id === 'settings'
                    ? 'Sistem Ayarları'
                    : contextMenu.item.type === 'page'
                    ? 'Sayfa'
                    : 'Hızlı Araç'}
                </span>
              </div>
            </div>

            {/* Context Action 1: Hızlı Erişime Sabitle / Kaldır (Katmansız) */}
            <button
              type="button"
              onClick={() => handleToggleQuickAccess(contextMenu.item)}
              className="w-full flex items-center gap-2.5 px-2 py-1.5 text-xs text-[#d6beae] hover:text-white transition-colors cursor-pointer font-medium text-left bg-transparent border-none outline-none group"
            >
              {isItemInQuickAccess(contextMenu.item) ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-rose-400 shrink-0 group-hover:scale-110 transition-transform" />
                  <span className="group-hover:text-white">Hızlı erişimden kaldır</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-[#dfb76c] shrink-0 group-hover:scale-110 transition-transform" />
                  <span className="group-hover:text-white">Hızlı erişime sabitle</span>
                </>
              )}
            </button>

            {/* Context Action 2: Görev Çubuğuna Sabitle / Kaldır (Yalnızca Araçlar ve Eylemler için, Sayfalar ve E-Posta Dock'ta yer almaz) */}
            {contextMenu.item.type !== 'page' && !contextMenu.item.isMail && contextMenu.item.id !== 'mail' && (
              <button
                type="button"
                onClick={() => handleToggleTaskbar(contextMenu.item)}
                className="w-full flex items-center gap-2.5 px-2 py-1.5 text-xs text-[#d6beae] hover:text-white transition-colors cursor-pointer font-medium text-left bg-transparent border-none outline-none group"
              >
                {isItemOnTaskbar(contextMenu.item) ? (
                  <>
                    <PinOff className="w-3.5 h-3.5 text-rose-400 shrink-0 group-hover:scale-110 transition-transform" />
                    <span className="group-hover:text-white">Görev çubuğundan kaldır</span>
                  </>
                ) : (
                  <>
                    <Pin className="w-3.5 h-3.5 text-[#b99881] shrink-0 group-hover:scale-110 transition-transform" />
                    <span className="group-hover:text-white">Görev çubuğuna sabitle</span>
                  </>
                )}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hızlı Bildirim (Toast) */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[10000] px-4 py-2 rounded-full bg-[#1c1a18]/95 border border-[#b99881]/50 text-xs font-semibold text-[#f3efe9] shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200 flex items-center gap-2 pointer-events-none">
          <Sparkles className="w-3.5 h-3.5 text-[#b99881]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </>
  )
}
