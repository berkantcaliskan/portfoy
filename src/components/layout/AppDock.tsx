import React, { useState, useEffect, useRef } from 'react'
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
  DollarSign,
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
} from 'lucide-react'
import { NavTab } from './Navbar'
import { BookLogo } from '@/components/common/BookLogo'
import { AppUser } from '@/services/userStore'
import { ToolType } from '@/components/tools/QuickToolsModal'

export interface DockItemConfig {
  id: string
  label: string
  iconType?: 'portfolio' | 'contacts' | 'crm' | 'shared' | 'projects' | 'calc' | 'notepad' | 'new-lead' | 'custom'
  tab?: NavTab
  toolId?: ToolType
  isAction?: boolean
  isMail?: boolean
}

const DEFAULT_DOCK_ITEMS: DockItemConfig[] = [
  { id: 'dock-portfolio', label: 'Müşteri Portföyü', iconType: 'portfolio', tab: 'portfolio' },
  { id: 'dock-contacts', label: 'Kişiler', iconType: 'contacts', tab: 'contacts' },
  { id: 'dock-crm', label: 'Satış', iconType: 'crm', tab: 'crm' },
  { id: 'dock-shared', label: 'Paylaşılanlar', iconType: 'shared', tab: 'shared' },
  { id: 'dock-projects', label: 'Projeler', iconType: 'projects', tab: 'projects' },
  { id: 'dock-notepad', label: 'Not Defteri', iconType: 'notepad', toolId: 'notepad', isAction: true },
  { id: 'dock-calc', label: 'Hesap Makinesi', iconType: 'calc', toolId: 'calculator', isAction: true },
  { id: 'dock-new-lead', label: 'Yeni Veri', iconType: 'new-lead', isAction: true },
]

const STORAGE_KEY_DOCK_ORDER = 'demirturk_dock_order_v1'
const STORAGE_KEY_START_GRID = 'demirturk_start_menu_grid'
const STORAGE_KEY_DOCK_ENABLED = 'demirturk_dock_enabled'

export interface StartMenuItem {
  id: string
  name: string
  icon: React.ComponentType<{ className?: string }>
  type: 'page' | 'tool' | 'action'
  tab?: NavTab
  toolId?: ToolType
  isMail?: boolean
}

const START_MENU_ITEMS: StartMenuItem[] = [
  { id: 'mail', name: 'E-Posta', icon: Mail, type: 'action', isMail: true },
  { id: 'contacts', name: 'Kişiler', icon: UserCheck, type: 'page', tab: 'contacts' },
  { id: 'payments', name: 'Ödemeler', icon: Wallet, type: 'tool', toolId: 'payments' },
  { id: 'notepad', name: 'Not Defteri', icon: FileText, type: 'tool', toolId: 'notepad' },
  { id: 'calculator', name: 'Hesap Makinesi', icon: Calculator, type: 'tool', toolId: 'calculator' },
  { id: 'commission', name: 'Satış Primi', icon: DollarSign, type: 'tool', toolId: 'commission' },
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
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch {
      // ignore
    }
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

  const hideTimerRef = useRef<number | null>(null)
  const startMenuRef = useRef<HTMLDivElement>(null)
  const dockRef = useRef<HTMLDivElement>(null)

  const isSalesOrManager =
    currentUser?.department === 'Satış' ||
    currentUser?.department === 'Yönetim' ||
    currentUser?.isManager ||
    !currentUser

  // Filter items if not sales or manager
  const visibleItems = dockItems.filter((item) => {
    if (item.tab === 'crm' && !isSalesOrManager) return false
    return true
  })

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
    if (!isStartMenuOpen) {
      resetHideTimer()
    }
  }

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

  // Ögenin Dock'ta (hızlı erişimde) sabitli olup olmadığını kontrol eder
  const isItemPinned = (item: StartMenuItem): boolean => {
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

  // Hızlı erişime sabitle / Hızlı erişimden kaldır
  const handleTogglePin = (item: StartMenuItem) => {
    const pinned = isItemPinned(item)
    let newItems: DockItemConfig[]

    if (pinned) {
      if (item.isMail || item.id === 'mail') {
        newItems = dockItems.filter((d) => d.id !== 'dock-mail' && !d.isMail)
      } else if (item.type === 'page') {
        newItems = dockItems.filter((d) => d.tab !== item.tab)
      } else {
        newItems = dockItems.filter(
          (d) =>
            d.toolId !== item.toolId &&
            !(item.toolId === 'calculator' && (d.id === 'dock-calc' || d.toolId === 'calculator')) &&
            !(item.toolId === 'notepad' && (d.id === 'dock-notepad' || d.toolId === 'notepad'))
        )
      }
      showToast(`"${item.name}" hızlı erişimden kaldırıldı.`)
    } else {
      const newItem: DockItemConfig =
        item.isMail || item.id === 'mail'
          ? {
              id: 'dock-mail',
              label: 'E-Posta',
              iconType: 'custom',
              isAction: true,
              isMail: true,
            }
          : item.type === 'page'
          ? {
              id: `dock-${item.tab || 'item'}`,
              label: item.name,
              iconType: (item.tab || 'contacts') as any,
              tab: item.tab,
            }
          : {
              id: `dock-tool-${item.toolId}`,
              label: item.name,
              toolId: item.toolId,
              isAction: true,
            }
      newItems = [...dockItems, newItem]
      showToast(`"${item.name}" hızlı erişime sabitlendi.`)
    }

    setDockItems(newItems)
    localStorage.setItem(STORAGE_KEY_DOCK_ORDER, JSON.stringify(newItems))
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
        return <Plus className="w-4 h-4" />
      default:
        return <Sparkles className="w-4 h-4" />
    }
  }

  const handleItemClick = (item: DockItemConfig) => {
    if (item.isMail || item.id === 'dock-mail') {
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
        title="Dock Menüsünü Göster"
      >
        <div className="h-1.5 w-36 sm:w-52 rounded-full dock-breathing-line group-hover:h-2 group-hover:w-60 transition-all duration-300 shadow-lg" />
      </div>

      {/* 
        2. ASILI DOCK KONTEYNERI (FLOATING DOCK)
        2 sn inaktif kalındığında yumuşakça aşağı kayarak kendini saklar
      */}
      <div
        ref={dockRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`fixed bottom-3.5 left-1/2 -translate-x-1/2 z-40 transition-all duration-300 ease-out transform ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'
        }`}
      >
        {/* 
          BAŞLAT MENÜSÜ POPOVER (DOCK'UN TAM ÜSTÜNE DOĞRU AÇILIR)
          Sabit sol logo butonuna tıklandığında dock'un üzerinden yukarı doğru açılır
        */}
        {isStartMenuOpen && (
          <div
            ref={startMenuRef}
            className={`absolute bottom-full mb-3.5 left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 w-[calc(100vw-32px)] ${
              startMenuGrid === '4x5' ? 'sm:w-[380px]' : 'sm:w-[460px]'
            } rounded-[32px] bg-[#282522]/95 border border-[#4a443f] shadow-2xl p-4 sm:p-5 backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-3 duration-200 space-y-3.5 z-50`}
          >
            {/* Header / User Info & Grid Selector */}
            <div className="flex items-center justify-between pb-3 border-b border-[#4a443f] gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-full bg-[#34302d] border border-[#b99881]/40 flex items-center justify-center text-sm font-bold text-[#b99881] shrink-0">
                  {currentUser?.fullName ? currentUser.fullName[0] : 'P'}
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
              BAŞLAT MENÜSÜ ÖGELERİ (E-POSTA, KİŞİLER & HIZLI ARAÇLAR)
              - E-Posta, Kişiler sayfası ve 25 hızlı araç
              - Sağ tık: Bağlam menüsü (Hızlı erişime sabitle / kaldır)
              - Doğrudan üstte ikon, altta araç adı
              - 4x5, 5x5 veya 5x6 düzeninde
            */}
            <div
              className={`grid ${
                startMenuGrid === '4x5' ? 'grid-cols-4' : 'grid-cols-5'
              } gap-y-3.5 gap-x-1 py-1.5 max-h-[380px] overflow-y-auto pr-0.5`}
            >
              {START_MENU_ITEMS.map((item) => {
                const Icon = item.icon
                const pinned = isItemPinned(item)

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setIsStartMenuOpen(false)
                      if (item.isMail || item.id === 'mail') {
                        onOpenMail?.()
                      } else if (item.type === 'page' && item.tab) {
                        onTabChange(item.tab)
                      } else if (item.toolId) {
                        onOpenTool(item.toolId)
                      }
                    }}
                    onContextMenu={(e) => handleContextMenu(e, item)}
                    className="group relative flex flex-col items-center justify-center p-1.5 rounded-2xl hover:bg-white/5 transition-all cursor-pointer text-center"
                    title={`${item.name}\n(Sağ tık: Bağlam Menüsü)`}
                  >
                    {/* Sabitli İkon Rozeti */}
                    {pinned && (
                      <span
                        className="absolute top-1 right-2 text-[#b99881]"
                        title="Hızlı erişimde sabitli"
                      >
                        <Pin className="w-2.5 h-2.5 fill-[#b99881]" />
                      </span>
                    )}

                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-[#b99881] group-hover:text-[#d6beae] group-hover:scale-110 transition-transform">
                      <Icon className="w-5.5 h-5.5" />
                    </div>
                    <span className="text-xs font-semibold text-[#c4bcb5] group-hover:text-white line-clamp-2 mt-1 leading-tight text-center max-w-[78px]">
                      {item.name}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Footer Bar */}
            <div className="pt-2 border-t border-[#4a443f] flex items-center justify-between text-sm">
              <button
                onClick={() => {
                  setIsStartMenuOpen(false)
                  onOpenProfile()
                }}
                className="text-[#b99881] hover:text-[#d6beae] transition-colors cursor-pointer flex items-center gap-1.5 font-medium"
              >
                <span>Profil & Danışman Hesabı</span>
              </button>
              <span className="text-xs text-[#8c857f] font-mono">
                {START_MENU_ITEMS.length} Öge ({startMenuGrid})
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 p-2 rounded-full bg-[#282522]/90 border border-[#4a443f] backdrop-blur-xl shadow-2xl relative">
          
          {/* 
            EN SOLDA HER ZAMAN SABİT BAŞLAT BUTONU (YUVARLAK İÇİNDE UYGULAMA LOGOSU)
            Yer değiştirilemez, sabit kalır; tıklandığında Başlat Menüsü açılır.
          */}
          <div className="relative group">
            <button
              type="button"
              onClick={() => {
                setIsStartMenuOpen(!isStartMenuOpen)
                setIsVisible(true)
              }}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer border ${
                isStartMenuOpen
                  ? 'bg-[#b99881] text-[#1c1a18] border-[#b99881] shadow-lg scale-105'
                  : 'bg-[#34302d] hover:bg-[#3d3733] border-[#b99881]/50 text-[#b99881] hover:scale-105'
              }`}
              title="Başlat Menüsü & Uygulama Merkezi"
            >
              <BookLogo className="w-5 h-5 transition-transform group-hover:scale-110" />
            </button>
            <span className="absolute -top-9 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#1c1a18]/95 text-xs font-semibold text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-[#4a443f] shadow-lg">
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
                  onContextMenu={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const matched = START_MENU_ITEMS.find(
                      (s) =>
                        (item.tab && s.tab === item.tab) ||
                        (item.toolId && s.toolId === item.toolId) ||
                        (item.id === 'dock-calc' && s.toolId === 'calculator') ||
                        (item.id === 'dock-notepad' && s.toolId === 'notepad')
                    )
                    if (matched) {
                      handleContextMenu(e, matched)
                    }
                  }}
                  className="relative group cursor-grab active:cursor-grabbing"
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
                  <span className="absolute -top-9 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#1c1a18]/95 text-xs font-semibold text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-[#4a443f] shadow-lg">
                    {item.label}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Dikey Ayrım Çizgisi */}
          <div className="w-[1px] h-6 bg-[#4a443f] mx-0.5" />

          {/* Ayarlar Butonu (Dock Açıkken Dock'ta Yer Alır) */}
          <div className="relative group">
            <button
              type="button"
              onClick={onOpenSettings}
              className="w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer border bg-[#34302d] text-[#a69f99] border-[#4a443f] hover:border-[#b99881]/60 hover:text-white hover:bg-[#3d3733] hover:scale-105"
              title="Ayarlar"
            >
              <Settings className="w-4.5 h-4.5" />
            </button>
            <span className="absolute -top-9 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#1c1a18]/95 text-xs font-semibold text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-[#4a443f] shadow-lg">
              Ayarlar
            </span>
          </div>
        </div>
      </div>

      {/* 
        SAĞ TIK BAĞLAM MENÜSÜ (CONTEXT MENU)
        Başlat menüsündeki veya Dock üzerindeki ögelere sağ tıklandığında açılır
      */}
      {contextMenu && (
        <div
          style={{
            top: `${contextMenu.y}px`,
            left: `${contextMenu.x}px`,
          }}
          className="fixed z-[9999] min-w-[220px] rounded-2xl bg-[#282522]/95 border border-[#b99881]/40 shadow-2xl backdrop-blur-2xl p-2 animate-in fade-in zoom-in-95 duration-150 select-none text-left"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 px-3 py-2 border-b border-[#4a443f]/70 mb-1">
            <div className="w-7 h-7 rounded-full bg-[#34302d] border border-[#b99881]/30 flex items-center justify-center text-[#b99881] shrink-0">
              <contextMenu.item.icon className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-sm font-bold text-white block truncate">
                {contextMenu.item.name}
              </span>
              <span className="text-xs text-[#8c857f] block">
                {contextMenu.item.type === 'page' ? 'Sayfa' : 'Hızlı Araç'}
              </span>
            </div>
          </div>

          {/* Context Action: Hızlı erişime sabitle / Hızlı erişimden kaldır */}
          <button
            type="button"
            onClick={() => handleTogglePin(contextMenu.item)}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm text-[#d6beae] hover:text-white hover:bg-[#b99881]/20 transition-colors cursor-pointer font-medium"
          >
            {isItemPinned(contextMenu.item) ? (
              <>
                <PinOff className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Hızlı erişimden kaldır</span>
              </>
            ) : (
              <>
                <Pin className="w-4 h-4 text-[#b99881] shrink-0" />
                <span>Hızlı erişime sabitle</span>
              </>
            )}
          </button>
        </div>
      )}

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
