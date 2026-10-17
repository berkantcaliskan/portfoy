import React, { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  User,
  X,
  Clock,
  Settings,
  MessageSquare,
  ChevronDown,
  Layers,
  Check,
  Mail,
  MoreHorizontal,
  Bell,
  LayoutDashboard,
  Users,
  Megaphone,
  BarChart3,
  PieChart,
  Cloud,
  Building2,
  TrendingUp,
  Calendar,
  CalendarCheck,
  Inbox,
  Award,
  Wallet,
  ArrowUpRight,
  ShieldCheck,
  FileText,
  CheckSquare,
  BookUser,
  UserCheck,
  LogOut,
} from 'lucide-react'
import { AppUser, userStore } from '@/services/userStore'
import {
  Department,
  CANONICAL_DEPARTMENTS,
  DEPARTMENT_MENU_CONFIG,
  NavPageId,
  getPrimaryPageForDepartment,
} from '@/types/department'
import { BookLogo, BrandLogoLockup } from '@/components/common/BookLogo'
import { ToolType } from '@/components/tools/QuickToolsModal'
import { WindowControls } from '@/components/common/WindowControls'
import { MessagingPanel, IosChatBubbleIcon } from '@/components/chat/MessagingPanel'
import { messageStore } from '@/services/messageStore'
import { notificationStore, AppNotification } from '@/services/notificationStore'
import { NotificationsPopover } from './NotificationsPopover'
import {
  teamOperationsStore,
  getPresenceMeta,
  PRESENCE_STATUS_OPTIONS,
  PresenceStatusType,
} from '@/services/teamOperationsStore'

export type NavTab = NavPageId

export function getNavPageIcon(id: NavPageId): React.ComponentType<{ className?: string; strokeWidth?: number }> {
  switch (id) {
    case 'dashboard':
      return LayoutDashboard
    case 'portfolio':
    case 'customers':
      return Users
    case 'teams':
      return UserCheck
    case 'marketing-campaigns':
      return Megaphone
    case 'marketing-reports':
    case 'executive-reports':
      return BarChart3
    case 'financial-reports':
      return PieChart
    case 'shared':
      return Cloud
    case 'projects':
      return Building2
    case 'crm':
      return TrendingUp
    case 'appointments':
      return Calendar
    case 'followups-appointments':
      return CalendarCheck
    case 'requests':
      return Inbox
    case 'sales-performance':
      return Award
    case 'collections':
      return Wallet
    case 'payments':
      return ArrowUpRight
    case 'team-permissions':
      return ShieldCheck
    case 'approvals':
      return CheckSquare
    case 'contacts':
      return BookUser
    default:
      return LayoutDashboard
  }
}

interface NavbarProps {
  activeTab: NavTab
  onTabChange: (tab: NavTab) => void
  onOpenProfile: () => void
  onOpenSettings: () => void
  onOpenMail?: () => void
  onOpenTool?: (tool: ToolType) => void
  unreadMailCount?: number
  onSearchChange?: (val: string) => void
  searchQuery?: string
  currentUser?: AppUser | null
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  onOpenProfile,
  onOpenSettings,
  onOpenMail,
  onOpenTool,
  unreadMailCount = 0,
  onSearchChange,
  searchQuery = '',
  currentUser,
}) => {
  const [isSearchOpen, setIsSearchOpen] = useState(Boolean(searchQuery))
  const [isMessagesOpen, setIsMessagesOpen] = useState(messageStore.isPanelOpen())
  const [messagingMode, setMessagingMode] = useState(messageStore.getDisplayMode())
  const [messagingSidebarWidth, setMessagingSidebarWidth] = useState(messageStore.getSidebarWidth())
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false)
  const [isAppMenuOpen, setIsAppMenuOpen] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)

  useEffect(() => {
    const unsub = messageStore.subscribe(() => {
      setIsMessagesOpen(messageStore.isPanelOpen())
      setMessagingMode(messageStore.getDisplayMode())
      setMessagingSidebarWidth(messageStore.getSidebarWidth())
    })
    return unsub
  }, [])

  // Dock Enabled state (determines whether 9-dot app menu appears in navbar)
  const [dockEnabled, setDockEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('demirturk_dock_enabled')
      if (saved !== null) return saved !== 'false'
    } catch {}
    return true
  })

  useEffect(() => {
    const handleConfigSync = () => {
      try {
        const saved = localStorage.getItem('demirturk_dock_enabled')
        if (saved !== null) setDockEnabled(saved !== 'false')
      } catch {}
    }
    window.addEventListener('demirturk_dock_config_updated', handleConfigSync)
    return () => window.removeEventListener('demirturk_dock_config_updated', handleConfigSync)
  }, [])

  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)
  const notificationsRef = useRef<HTMLDivElement>(null)
  const workspaceRef = useRef<HTMLDivElement>(null)
  const appMenuRef = useRef<HTMLDivElement>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)

  // Notifications State & Subscriptions
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [totalUnreadNotifications, setTotalUnreadNotifications] = useState<number>(
    () => notificationStore.getTotalUnreadCount()
  )
  const [, setNotifTick] = useState(0)

  // Canlı Bildirim Önizlemesi -> 4.5 sn durur -> Bildirim ikonuna kayarak uçar
  const notifPreviewRef = useRef<HTMLDivElement>(null)
  const previewHoldTimerRef = useRef<number | null>(null)
  const previewFlyTimerRef = useRef<number | null>(null)
  const [previewNotif, setPreviewNotif] = useState<AppNotification | null>(null)
  const [previewPhase, setPreviewPhase] = useState<'visible' | 'flying'>('visible')
  const [flyOffset, setFlyOffset] = useState<{ x: number; y: number }>({ x: 320, y: 0 })
  const [isBellPulsing, setIsBellPulsing] = useState(false)

  const triggerFlyToBell = () => {
    if (previewHoldTimerRef.current) {
      window.clearTimeout(previewHoldTimerRef.current)
      previewHoldTimerRef.current = null
    }
    if (notifPreviewRef.current && notificationsRef.current) {
      const fromRect = notifPreviewRef.current.getBoundingClientRect()
      const toRect = notificationsRef.current.getBoundingClientRect()
      const dx = toRect.left + toRect.width / 2 - (fromRect.left + fromRect.width / 2)
      const dy = toRect.top + toRect.height / 2 - (fromRect.top + fromRect.height / 2)
      setFlyOffset({ x: dx, y: dy })
    }
    setPreviewPhase('flying')
    if (previewFlyTimerRef.current) {
      window.clearTimeout(previewFlyTimerRef.current)
    }
    previewFlyTimerRef.current = window.setTimeout(() => {
      setPreviewNotif(null)
      setPreviewPhase('visible')
      setIsBellPulsing(true)
      window.setTimeout(() => setIsBellPulsing(false), 650)
    }, 460)
  }

  const showNotificationPreview = (notif: AppNotification) => {
    if (previewHoldTimerRef.current) window.clearTimeout(previewHoldTimerRef.current)
    if (previewFlyTimerRef.current) window.clearTimeout(previewFlyTimerRef.current)
    setPreviewPhase('visible')
    setPreviewNotif(notif)

    previewHoldTimerRef.current = window.setTimeout(() => {
      triggerFlyToBell()
    }, 4500)
  }

  useEffect(() => {
    const unsub = notificationStore.subscribe(() => {
      setTotalUnreadNotifications(notificationStore.getTotalUnreadCount())
      setNotifTick((t) => t + 1)
    })
    const unsubIncoming = notificationStore.subscribeIncoming((incoming) => {
      showNotificationPreview(incoming)
    })
    const unsubOps = teamOperationsStore.subscribe(() => {
      setNotifTick((t) => t + 1)
    })

    // İlk açılışta okunmamış bildirim varsa veya sistem aktif bildirimini göstermek için
    const initTimer = window.setTimeout(() => {
      try {
        if (!sessionStorage.getItem('demirturk_initial_notif_preview_v1')) {
          sessionStorage.setItem('demirturk_initial_notif_preview_v1', '1')
          const unreadList = notificationStore.getAllNotifications().filter((n) => !n.isRead)
          if (unreadList.length > 0) {
            showNotificationPreview(unreadList[0])
          } else {
            notificationStore.pushNotification({
              id: 'notif-sys-welcome',
              type: 'SYSTEM',
              title: 'Bildirim Merkezi Aktif',
              subtitle: 'Yeni müşteri, talep ve dosya bildirimleri burada görünür.',
              targetTab: 'requests',
            })
          }
        }
      } catch {}
    }, 700)

    return () => {
      unsub()
      unsubIncoming()
      unsubOps()
      window.clearTimeout(initTimer)
      if (previewHoldTimerRef.current) window.clearTimeout(previewHoldTimerRef.current)
      if (previewFlyTimerRef.current) window.clearTimeout(previewFlyTimerRef.current)
    }
  }, [])

  const myPresence = currentUser ? teamOperationsStore.getUserPresence(currentUser.id) : null
  const myPresenceMeta = getPresenceMeta(myPresence?.status)

  // Current active department workspace
  const activeDept: Department = currentUser?.department || 'Pazarlama'

  // Yöneticiler / Yönetim Ekibi kontrolü (Departman seçimi yalnızca yöneticiler için geçerlidir)
  const isManagement = currentUser?.role === 'ADMIN'

  // Available departments user can switch between (yalnızca yöneticiler departmanlar arası geçiş yapabilir)
  const authorizedDepts: Department[] = isManagement
    ? CANONICAL_DEPARTMENTS
    : [activeDept]

  // Exact 6 pages for this active department
  const navItems = DEPARTMENT_MENU_CONFIG[activeDept] || DEPARTMENT_MENU_CONFIG['Pazarlama']

  const [isOverflowMenuOpen, setIsOverflowMenuOpen] = useState(false)
  const overflowMenuRef = useRef<HTMLDivElement>(null)
  const navContainerRef = useRef<HTMLDivElement>(null)
  const measureContainerRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState<number>(() => navItems.length)

  // Close popups when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        if (!searchQuery) {
          setIsSearchOpen(false)
        }
      }
      if (
        messagesRef.current &&
        !messagesRef.current.contains(event.target as Node)
      ) {
        if (messageStore.getDisplayMode() === 'popup') {
          messageStore.setPanelOpen(false)
        }
      }
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(event.target as Node)
      ) {
        setIsNotificationsOpen(false)
      }
      if (
        workspaceRef.current &&
        !workspaceRef.current.contains(event.target as Node)
      ) {
        setIsWorkspaceMenuOpen(false)
      }
      if (
        appMenuRef.current &&
        !appMenuRef.current.contains(event.target as Node)
      ) {
        setIsAppMenuOpen(false)
      }
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setIsProfileMenuOpen(false)
      }
      if (
        overflowMenuRef.current &&
        !overflowMenuRef.current.contains(event.target as Node)
      ) {
        setIsOverflowMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [searchQuery])

  // Ölçüm ve Dinamik Sayfa Sığdırma Mantığı (Responsive Greedy Navigation)
  const measureNavOverflow = () => {
    if (!navContainerRef.current || !measureContainerRef.current) return
    const containerWidth = navContainerRef.current.clientWidth
    if (containerWidth <= 0) return

    const children = Array.from(measureContainerRef.current.children) as HTMLElement[]
    const widths: number[] = []
    let moreBtnWidth = 38

    children.forEach((child) => {
      const id = child.getAttribute('data-id')
      if (id === 'more-btn') {
        moreBtnWidth = child.getBoundingClientRect().width || 38
      } else if (id) {
        widths.push(child.getBoundingClientRect().width)
      }
    })

    if (widths.length === 0) return

    const computed = window.getComputedStyle(measureContainerRef.current)
    const gap = parseFloat(computed.gap) || 24

    // Tüm sayfaların "..." butonu olmadan sığıp sığmadığını kontrol et
    const totalAllWidth = widths.reduce((sum, w) => sum + w, 0) + (widths.length - 1) * gap
    if (totalAllWidth + 8 <= containerWidth) {
      setVisibleCount(navItems.length)
      return
    }

    // Sığmıyorsa, kaç sayfanın "..." butonuyla birlikte sığdığını hesapla (sağdan sola)
    let count = 0
    for (let i = widths.length - 1; i >= 1; i--) {
      const itemsWidth = widths.slice(0, i).reduce((sum, w) => sum + w, 0)
      const needed = itemsWidth + moreBtnWidth + i * gap
      if (needed + 8 <= containerWidth) {
        count = i
        break
      }
    }

    setVisibleCount(count)
  }

  useLayoutEffect(() => {
    measureNavOverflow()
  }, [navItems, activeDept])

  useEffect(() => {
    const container = navContainerRef.current
    if (!container) return

    const ro = new ResizeObserver(() => {
      measureNavOverflow()
    })
    ro.observe(container)

    window.addEventListener('resize', measureNavOverflow)

    if (document.fonts) {
      document.fonts.ready.then(() => {
        measureNavOverflow()
      })
    }

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measureNavOverflow)
    }
  }, [navItems, activeDept])

  // Sayfaları görünür ve taşan olarak ayır
  const visibleItems = navItems.slice(0, visibleCount)
  const overflowItems = navItems.slice(visibleCount)
  const hasOverflow = overflowItems.length > 0
  const isOverflowActive = overflowItems.some((item) => item.id === activeTab)

  // Ekran tekrar büyüyüp her şey sığdığında menüyü kapat
  useEffect(() => {
    if (!hasOverflow && isOverflowMenuOpen) {
      setIsOverflowMenuOpen(false)
    }
  }, [hasOverflow, isOverflowMenuOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOverflowMenuOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSwitchWorkspace = (dept: Department) => {
    const res = userStore.switchDepartment(dept)
    if (res.success) {
      setIsWorkspaceMenuOpen(false)
      // If currently on common pages (dashboard, shared, projects), stay on that page.
      // If currently on a department-specific page, switch to the target department's core page.
      const allowedPages = DEPARTMENT_MENU_CONFIG[dept] || []
      const isAllowedOnNewDept = activeTab === 'dashboard' || activeTab === 'shared' || activeTab === 'projects' || allowedPages.some((p) => p.id === activeTab)
      if (isAllowedOnNewDept) {
        onTabChange(activeTab)
      } else {
        const primaryPage = getPrimaryPageForDepartment(dept)
        onTabChange(primaryPage)
      }
    }
  }

  // Recent notifications or messages
  const recentMessages: { id: number; sender: string; text: string; time: string }[] = []

  return (
    <>
      {/* ==========================================================================
          MASAÜSTÜ SAĞ ÜST AKSİYON & PROFİL GRUBU (Top-Right Floating Pill Cluster)
          Görsel referanstaki gibi: Yuvarlak Beyaz İkon Butonları + Sağda Profil Hapı
         ========================================================================== */}
      <div
        className="hidden md:flex items-center justify-between gap-3 w-full md:pl-[236px] pr-6 lg:pr-10 2xl:pr-14 pt-4 pb-1 relative z-40 select-none"
        style={
          {
            width:
              isMessagesOpen && messagingMode === 'sidebar'
                ? `calc(100% - ${messagingSidebarWidth}px)`
                : '100%',
            transition: 'width 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            WebkitAppRegion: 'no-drag',
          } as React.CSSProperties
        }
      >
        {/* SOL: Sayfa İkonuyla Aynı Hizadan Başlayan Canlı Bildirim Önizlemesi */}
        <div className="flex items-center min-w-0">
          <AnimatePresence mode="wait">
            {previewNotif && (
              <motion.div
                key={previewNotif.id}
                ref={notifPreviewRef}
                initial={{ opacity: 0, y: 18, scale: 0.96 }}
                animate={
                  previewPhase === 'flying'
                    ? {
                        x: flyOffset.x,
                        y: flyOffset.y,
                        scale: 0.16,
                        opacity: 0,
                      }
                    : {
                        x: 0,
                        y: 0,
                        scale: 1,
                        opacity: 1,
                      }
                }
                exit={{ opacity: 0, y: -8, scale: 0.92 }}
                transition={
                  previewPhase === 'flying'
                    ? { duration: 0.46, ease: [0.32, 0, 0.15, 1] }
                    : { duration: 0.24, ease: [0.16, 1, 0.3, 1] }
                }
                onClick={() => {
                  notificationStore.markNotificationAsRead(previewNotif.id)
                  onTabChange(previewNotif.targetTab)
                  triggerFlyToBell()
                }}
                className="top-utility-pill h-10 max-w-[360px] lg:max-w-[420px] pl-2 pr-3 rounded-full border border-[#4a443f]/60 bg-white flex items-center gap-2.5 cursor-pointer shadow-md hover:border-[#b99881]/60 transition-colors pointer-events-auto"
              >
                <div className="w-7 h-7 rounded-full bg-[#b99881]/15 flex items-center justify-center shrink-0">
                  <Bell className="w-3.5 h-3.5 text-[#b99881]" strokeWidth={2.2} />
                </div>
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="text-[11.5px] font-bold text-white truncate">
                    {previewNotif.title}
                  </div>
                  <div className="text-[10.5px] text-[#8c857f] truncate">
                    {previewNotif.subtitle}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    triggerFlyToBell()
                  }}
                  className="p-1 rounded-full text-[#8c857f] hover:text-white transition-colors shrink-0 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* SAĞ: Aksiyon İkonları ve Profil Hapı */}
        <div className="ml-auto flex items-center gap-2.5 shrink-0">
        {/* 1. Arama (Yuvarlak beyaz kapsül buton; tıklandığında sola doğru genişler) */}
        <div ref={searchContainerRef} className="relative flex items-center justify-end">
          <motion.div
            initial={false}
            animate={{
              width: isSearchOpen ? 260 : 40,
            }}
            transition={{
              type: 'spring',
              stiffness: 340,
              damping: 28,
              mass: 0.8,
            }}
            className={`top-utility-pill h-10 rounded-full border border-[#4a443f]/60 bg-white flex items-center overflow-hidden select-none transition-colors ${
              isSearchOpen
                ? 'px-3.5'
                : 'justify-center cursor-pointer hover:border-[#b99881]/50'
            }`}
            onClick={() => {
              if (!isSearchOpen) {
                setIsSearchOpen(true)
                setTimeout(() => searchInputRef.current?.focus(), 80)
              }
            }}
            title={!isSearchOpen ? 'Arama Yap' : undefined}
          >
            <div className={`shrink-0 flex items-center justify-center ${isSearchOpen ? 'mr-2' : ''}`}>
              <Search className="w-[18px] h-[18px] text-[#b99881]" strokeWidth={2} />
            </div>

            <AnimatePresence>
              {isSearchOpen && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-center flex-1 min-w-0"
                >
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Kayıtlarda ara..."
                    value={searchQuery}
                    onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        if (!searchQuery) setIsSearchOpen(false)
                        else onSearchChange && onSearchChange('')
                      }
                    }}
                    className="w-full !bg-transparent !border-none text-xs text-[#f3efe9] placeholder-[#a69f99] focus:outline-none font-sans"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (searchQuery) {
                        onSearchChange && onSearchChange('')
                      } else {
                        setIsSearchOpen(false)
                      }
                    }}
                    className="text-[#a69f99] hover:text-white transition-colors p-1 ml-1 shrink-0 cursor-pointer rounded-full"
                    title="Kapat"
                  >
                    <X className="w-3.5 h-3.5" strokeWidth={2} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* 2. Hızlı Araçlar / Uygulama Menüsü (Yuvarlak Beyaz Buton) */}
        <div ref={appMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setIsAppMenuOpen(!isAppMenuOpen)}
            className="top-utility-pill w-10 h-10 rounded-full border border-[#4a443f]/60 bg-white hover:border-[#b99881]/50 transition-all cursor-pointer flex items-center justify-center"
            title="Hızlı Araçlar & Uygulama Menüsü"
          >
            <svg
              className="w-[18px] h-[18px] text-[#b99881]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </button>

          {isAppMenuOpen && (
            <div className="dropdown-panel absolute right-0 top-full mt-2.5 w-80 rounded-[26px] shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-2xl space-y-3 border border-[#4a443f]">
              <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-2">
                  <BookLogo className="w-5 h-5 text-[#b99881]" />
                  <span className="text-sm font-bold text-white">Hızlı Araçlar</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsAppMenuOpen(false)
                    onOpenSettings()
                  }}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#34302d] hover:bg-[#3d3733] border border-[#4a443f] text-xs font-semibold text-[#d6beae] hover:text-white transition-colors cursor-pointer"
                  title="Sistem ve Kişiselleştirme Ayarları"
                >
                  <Settings className="w-3.5 h-3.5 text-[#b99881]" />
                  <span>Ayarlar</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAppMenuOpen(false)
                    onOpenMail?.()
                  }}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#34302d] hover:bg-[#3d3733] border border-[#4a443f]/60 text-left transition-colors cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-full bg-[#282522] border border-[#b99881]/40 flex items-center justify-center text-[#b99881] group-hover:scale-105 transition-transform">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-white block">E-Posta</span>
                    <span className="text-[10px] text-[#8c857f] block truncate">Kurumsal Posta</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsAppMenuOpen(false)
                    onTabChange('contacts')
                  }}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#34302d] hover:bg-[#3d3733] border border-[#4a443f]/60 text-left transition-colors cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-full bg-[#282522] border border-[#b99881]/40 flex items-center justify-center text-[#b99881] group-hover:scale-105 transition-transform">
                    <User className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-white block">Kişiler</span>
                    <span className="text-[10px] text-[#8c857f] block truncate">Telefon Rehberi</span>
                  </div>
                </button>
              </div>

              <div>
                <span className="text-[10px] font-semibold uppercase text-[#8c857f] tracking-wider block mb-1.5 px-1">
                  Hesaplama & Araçlar
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: 'notepad' as ToolType, label: 'Not Defteri' },
                    { id: 'calculator' as ToolType, label: 'Hesap Mak.' },
                    { id: 'commission' as ToolType, label: 'Satış Primi' },
                    { id: 'currency' as ToolType, label: 'Döviz & Kur' },
                    { id: 'mortgage' as ToolType, label: 'Konut Kredisi' },
                    { id: 'deedFee' as ToolType, label: 'Tapu Harcı' },
                    { id: 'sqmPrice' as ToolType, label: 'm² Fiyat' },
                    { id: 'whatsapp' as ToolType, label: 'WhatsApp' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setIsAppMenuOpen(false)
                        onOpenTool?.(t.id)
                      }}
                      className="p-2 rounded-xl bg-[#34302d]/70 hover:bg-[#3d3733] border border-[#4a443f]/50 text-center transition-colors cursor-pointer group"
                    >
                      <span className="text-[11px] font-semibold text-[#c4bcb5] group-hover:text-white block truncate">
                        {t.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 4. Bildirimler (Yuvarlak Beyaz Buton + Kırmızı/Vurgu Bildirim Noktası) */}
        <div ref={notificationsRef} className={`relative ${isNotificationsOpen ? 'z-[60]' : 'z-20'}`}>
          <button
            type="button"
            onClick={() => {
              const willOpen = !isNotificationsOpen
              setIsNotificationsOpen(willOpen)
              if (willOpen && messageStore.getDisplayMode() === 'popup') {
                messageStore.setPanelOpen(false)
              }
            }}
            className={`top-utility-pill relative w-10 h-10 rounded-full border bg-white hover:border-[#b99881]/50 transition-all duration-300 cursor-pointer flex items-center justify-center ${
              isBellPulsing
                ? 'scale-115 border-[#b99881] ring-4 ring-[#b99881]/30'
                : 'border-[#4a443f]/60 scale-100'
            }`}
            title="Bildirimler"
          >
            <Bell
              className={`w-[18px] h-[18px] text-[#b99881] transition-transform duration-300 ${
                isBellPulsing ? 'rotate-12 scale-110' : ''
              }`}
              strokeWidth={2}
            />
            {totalUnreadNotifications > 0 && (
              <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
            )}
          </button>

          <NotificationsPopover
            isOpen={isNotificationsOpen}
            onClose={() => setIsNotificationsOpen(false)}
            onNavigate={(targetTab) => {
              notificationStore.markTabAsViewed(targetTab)
              onTabChange(targetTab)
            }}
          />
        </div>

        {/* 5. Kullanıcı Profil Hapı & Kompakt Açılır Menü (Popup) */}
        <div ref={profileMenuRef} className={`relative ${isProfileMenuOpen ? 'z-[60]' : 'z-20'}`}>
          <button
            type="button"
            onClick={() => {
              if (!currentUser) {
                onOpenProfile()
                return
              }
              const nextState = !isProfileMenuOpen
              setIsProfileMenuOpen(nextState)
              if (nextState) {
                setIsNotificationsOpen(false)
                setIsAppMenuOpen(false)
                if (messageStore.getDisplayMode() === 'popup') {
                  messageStore.setPanelOpen(false)
                }
              }
            }}
            className="top-utility-pill group h-10 flex items-center gap-2.5 pl-1.5 pr-3.5 rounded-full bg-white border border-[#4a443f]/60 hover:border-[#b99881]/50 transition-all cursor-pointer active:scale-[0.98]"
            title={
              currentUser
                ? `${currentUser.fullName} (@${currentUser.username}) • ${myPresenceMeta.label}${
                    myPresence?.locationNote ? ` — ${myPresence.locationNote}` : ''
                  }`
                : 'Giriş Yap'
            }
          >
            {/* Sol: Yuvarlak Avatar + Durum Noktası */}
            <div className="relative w-7 h-7 rounded-full bg-[#282522] border border-[#b99881]/50 flex items-center justify-center shrink-0">
              <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center">
                {currentUser?.avatarUrl ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.fullName}
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <span className="text-[10px] font-bold text-[#b99881] font-sans tracking-wide">
                    {currentUser?.fullName
                      ? currentUser.fullName
                          .trim()
                          .split(/\s+/)
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()
                      : 'DP'}
                  </span>
                )}
              </div>
              {currentUser && (
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white ${myPresenceMeta.dotClass}`}
                />
              )}
            </div>

            {/* Orta: Kullanıcı Adı */}
            <span className="text-[13px] font-medium text-[#f3efe9] truncate max-w-[130px]">
              {currentUser?.fullName || 'Giriş Yap'}
            </span>

            {/* Sağ: Küçük Aşağı Ok */}
            <ChevronDown
              className={`w-3.5 h-3.5 text-[#a69f99] shrink-0 transition-transform duration-200 ${
                isProfileMenuOpen ? 'rotate-180' : ''
              }`}
              strokeWidth={2.2}
            />
          </button>

          {/* Kompakt Profil & Hızlı Durum Açılır Menüsü (Popup) */}
          <AnimatePresence>
            {isProfileMenuOpen && currentUser && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="dropdown-panel absolute right-0 top-full mt-2.5 w-72 rounded-[24px] shadow-2xl p-3.5 z-50 backdrop-blur-2xl border border-[#4a443f] space-y-3"
              >
                {/* 1. Kullanıcı Kimlik Özeti */}
                <div className="flex items-center gap-3 px-1 pb-2.5 border-b border-[#4a443f]/60">
                  <div className="relative w-10 h-10 rounded-full bg-[#282522] border border-[#b99881]/50 flex items-center justify-center shrink-0">
                    {currentUser.avatarUrl ? (
                      <img
                        src={currentUser.avatarUrl}
                        alt={currentUser.fullName}
                        className="w-full h-full object-cover rounded-full"
                      />
                    ) : (
                      <span className="text-xs font-bold text-[#b99881]">
                        {currentUser.fullName
                          .trim()
                          .split(/\s+/)
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </span>
                    )}
                    <span
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-white ${myPresenceMeta.dotClass}`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-white truncate">
                      {currentUser.fullName}
                    </div>
                    <div className="text-[11px] text-[#8c857f] truncate">
                      @{currentUser.username} • {currentUser.department}
                    </div>
                  </div>
                </div>

                {/* 2. Tek Tıkla Hızlı Durum Seçimi */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8c857f]">
                      Durumum
                    </span>
                    <span className="text-[11px] font-semibold text-[#b99881]">
                      {myPresenceMeta.shortLabel}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {PRESENCE_STATUS_OPTIONS.slice(0, 6).map((opt) => {
                      const isSelected = (myPresence?.status || 'OFISTE') === opt.id
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            teamOperationsStore.updateUserPresence(currentUser.id, {
                              status: opt.id as PresenceStatusType,
                              locationNote: opt.id === 'OFISTE' ? '' : myPresence?.locationNote || '',
                              returnTime: opt.id === 'OFISTE' ? '' : myPresence?.returnTime || '',
                              updatedBy: currentUser.id,
                            })
                          }}
                          className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-full text-xs transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#b99881] text-white font-semibold'
                              : 'bg-[#34302d] text-[#a69f99] hover:text-white border border-[#4a443f]/50'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                isSelected ? 'bg-white' : opt.dotClass
                              }`}
                            />
                            <span className="truncate">{opt.shortLabel}</span>
                          </div>
                          {isSelected && <Check className="w-3 h-3 shrink-0" />}
                        </button>
                      )
                    })}
                  </div>

                  {/* Ofis dışındayken tek satır hızlı not */}
                  {myPresence?.status && myPresence.status !== 'OFISTE' && (
                    <input
                      type="text"
                      placeholder="Kısa konum / not ekle..."
                      value={myPresence.locationNote || ''}
                      onChange={(e) => {
                        teamOperationsStore.updateUserPresence(currentUser.id, {
                          status: myPresence.status,
                          locationNote: e.target.value,
                          returnTime: myPresence.returnTime || '',
                          updatedBy: currentUser.id,
                        })
                      }}
                      className="w-full mt-1 px-3 py-1.5 rounded-full text-xs border border-[#4a443f] focus:outline-none"
                    />
                  )}
                </div>

                {/* 3. Kompakt Menü Aksiyonları */}
                <div className="pt-2 border-t border-[#4a443f]/60 space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileMenuOpen(false)
                      onTabChange('teams')
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-full text-xs font-medium text-[#a69f99] hover:text-white transition-colors cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5 text-[#b99881] shrink-0" />
                    <span>Ekipler & Durum Panosu</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileMenuOpen(false)
                      onOpenSettings()
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-full text-xs font-medium text-[#a69f99] hover:text-white transition-colors cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5 text-[#b99881] shrink-0" />
                    <span>Sistem Ayarları</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileMenuOpen(false)
                      userStore.logout()
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-full text-xs font-semibold text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span>Çıkış Yap</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        </div>
      </div>

      <header
        className="w-full md:w-[216px] md:fixed md:inset-y-0 md:left-0 border-b md:border-b-0 md:border-r border-[#b99881]/20 bg-[#34302c] sticky top-0 z-40 transition-colors shadow-sm select-none"
      >
        {/* Sağ Alt Köşe Pencere Kontrolleri */}
        <WindowControls />

        {/* ==========================================================================
            MASAÜSTÜ SOL DİKEY NAV BAR (Desktop Vertical Sidebar)
           ========================================================================== */}
        <div className="hidden md:flex flex-col justify-between h-full w-full p-3">
          {/* Üst Alan: Logo */}
          <div className="px-3.5 pt-1 pb-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <BrandLogoLockup
              logoSize={22}
              gapClassName="gap-2"
              slideDistance={20}
              onClick={() => onTabChange('dashboard')}
            />
          </div>

          {/* Orta Alan: Dikey Sayfa Listesi */}
          <div
            className="flex-1 flex flex-col justify-center overflow-y-auto no-scrollbar py-2 my-1"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <motion.nav
              key={activeDept}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col gap-1"
            >
              {navItems.map((item) => {
                const isActive = activeTab === item.id
                const unread = notificationStore.getUnreadCountForTab(item.id)
                const Icon = getNavPageIcon(item.id)
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      notificationStore.markTabAsViewed(item.id)
                      onTabChange(item.id)
                    }}
                    className={`sidebar-pill-item relative w-full flex items-center justify-between px-3.5 py-2 rounded-full text-[13px] font-medium transition-all cursor-pointer select-none group ${
                      isActive
                        ? 'bg-[#b99881] text-white font-semibold'
                        : 'text-[#a69f99] hover:text-[#f3efe9] hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon
                        className={`w-4 h-4 transition-colors shrink-0 ${
                          isActive ? 'text-white' : 'text-[#a69f99] group-hover:text-white'
                        }`}
                        strokeWidth={isActive ? 2.2 : 1.9}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {unread > 0 && (
                      <span
                        className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                          isActive
                            ? 'bg-white/25 text-white'
                            : 'bg-[#b99881]/25 text-[#dfb76c] border border-[#b99881]/40'
                        }`}
                      >
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </button>
                )
              })}
            </motion.nav>
          </div>

          {/* Alt Alan: Departman Seçici + E-Posta & Ayarlar Kısayolu */}
          <div
            className="space-y-2.5"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            {/* Çalışma Alanı / Departman Seçicisi (Alttaki ikonların hemen üstünde) */}
            {isManagement && authorizedDepts.length > 1 ? (
              <div ref={workspaceRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsWorkspaceMenuOpen(!isWorkspaceMenuOpen)}
                  className="w-full flex items-center justify-between gap-1.5 px-3.5 py-2 rounded-full bg-[#282522] hover:bg-[#3d3733] border border-[#4a443f] text-xs text-[#d6beae] hover:text-white transition-all cursor-pointer select-none"
                  title="Departman / Çalışma Alanı Değiştir"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Layers className="w-3.5 h-3.5 text-[#b99881] shrink-0" />
                    <span className="font-semibold text-white truncate">{activeDept}</span>
                  </div>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-[#a69f99] shrink-0 transition-transform duration-200 ${
                      isWorkspaceMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <AnimatePresence>
                  {isWorkspaceMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.97 }}
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      className="dropdown-panel dropdown-panel-up absolute left-0 right-0 bottom-full mb-1.5 rounded-[22px] p-2 z-50 backdrop-blur-2xl border border-[#4a443f]"
                    >
                      <div className="px-2.5 py-1 text-[10px] font-semibold text-[#8c857f] uppercase tracking-wider">
                        Yetkili Çalışma Alanları
                      </div>
                      <div className="space-y-1 mt-0.5">
                        {authorizedDepts.map((dept) => {
                          const isCurrent = dept === activeDept
                          return (
                            <button
                              key={dept}
                              onClick={() => handleSwitchWorkspace(dept)}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-full text-xs transition-colors cursor-pointer text-left ${
                                isCurrent
                                  ? 'bg-[#b99881]/20 text-white font-semibold'
                                  : 'text-[#a69f99] hover:bg-[#34302d] hover:text-[#f3efe9]'
                              }`}
                            >
                              <span className="truncate">{dept}</span>
                              {isCurrent && <Check className="w-3.5 h-3.5 text-[#b99881] shrink-0" />}
                            </button>
                          )
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div
                className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#282522]/60 border border-[#4a443f]/60 text-xs select-none"
                title={`Çalışma Alanı: ${activeDept}`}
              >
                <Layers className="w-3.5 h-3.5 text-[#b99881] shrink-0" />
                <span className="font-semibold text-white truncate">{activeDept}</span>
              </div>
            )}

            <div className="flex items-center justify-around pt-1">
              {/* 1. Ayarlar */}
              <button
                type="button"
                onClick={onOpenSettings}
                className="sidebar-pill-item relative w-10 h-10 rounded-full flex items-center justify-center text-[#a69f99] hover:text-[#f3efe9] hover:bg-white/10 transition-colors cursor-pointer"
              >
                <Settings className="w-[18px] h-[18px] text-[#b99881] shrink-0" strokeWidth={1.9} />
              </button>

              {/* 2. Mail */}
              <button
                type="button"
                onClick={onOpenMail}
                className="sidebar-pill-item relative w-10 h-10 rounded-full flex items-center justify-center text-[#a69f99] hover:text-[#f3efe9] hover:bg-white/10 transition-colors cursor-pointer"
              >
                <Mail className="w-[18px] h-[18px] text-[#b99881] shrink-0" strokeWidth={1.9} />
                {unreadMailCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#b99881] text-white text-[9px] font-bold flex items-center justify-center">
                    {unreadMailCount > 99 ? '99+' : unreadMailCount}
                  </span>
                )}
              </button>

              {/* 3. Mesajlar */}
              <div ref={messagesRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsNotificationsOpen(false)
                    messageStore.togglePanel()
                  }}
                  className="sidebar-pill-item relative w-10 h-10 rounded-full flex items-center justify-center text-[#a69f99] hover:text-[#f3efe9] hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <IosChatBubbleIcon className="w-[18px] h-[18px] shrink-0" />
                  {currentUser && messageStore.getTotalUnreadCount(currentUser.id) > 0 && (
                    <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-[#34302c]" />
                  )}
                </button>

                <MessagingPanel
                  currentUser={currentUser}
                  isOpen={isMessagesOpen}
                  onClose={() => messageStore.setPanelOpen(false)}
                />
              </div>
            </div>
          </div>
        </div>

      {/* ==========================================================================
          MOBİL ÜST BAR (Mobile Top Header & Icon Strip)
         ========================================================================== */}
      <div className="md:hidden w-full">
        <div className="flex items-center justify-between h-[54px] px-4">
          <BrandLogoLockup
            logoSize={22}
            gapClassName="gap-2"
            slideDistance={20}
            onClick={() => onTabChange('dashboard')}
          />
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#282522] border border-[#4a443f] text-xs">
            <Layers className="w-3.5 h-3.5 text-[#b99881]" />
            <span className="font-semibold text-white">{activeDept}</span>
          </div>
        </div>

        {/* Mobil Görünüm Navigasyon: Yalnızca İkonlar Olarak, Header Bar Altında */}
        <motion.div
          key={`mobile-${activeDept}`}
          variants={{
            initial: {},
            animate: {
              transition: {
                staggerChildren: 0.04,
                delayChildren: 0.02,
              },
            },
          }}
          initial="initial"
          animate="animate"
          className="flex md:hidden items-center justify-around px-2 py-2 border-t border-[#4a443f]/60 bg-[#2b2724]/90 backdrop-blur-md gap-1 overflow-x-auto no-scrollbar"
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id
            const unread = notificationStore.getUnreadCountForTab(item.id)
            const Icon = getNavPageIcon(item.id)
            return (
              <motion.button
                key={item.id}
                variants={{
                  initial: { opacity: 0, y: 10, scale: 0.9 },
                  animate: {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    transition: { type: 'spring', stiffness: 360, damping: 24 },
                  },
                }}
                onClick={() => {
                  notificationStore.markTabAsViewed(item.id)
                  onTabChange(item.id)
                }}
                title={item.label}
                className={`relative p-2.5 rounded-full transition-all shrink-0 flex items-center justify-center cursor-pointer ${
                  isActive
                    ? 'text-[#b99881] bg-[#b99881]/15 border border-[#b99881]/40 shadow-sm scale-105'
                    : 'text-[#a69f99] hover:text-[#d6beae] hover:bg-white/5 border border-transparent'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" strokeWidth={isActive ? 2.2 : 1.8} />
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 rounded-full text-[9px] font-bold bg-[#b99881] text-[#282522] flex items-center justify-center shadow-xs">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </motion.button>
            )
          })}
        </motion.div>

        {/* Mobil Arama Barı */}
        <AnimatePresence>
          {isSearchOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden px-3 py-2 bg-[#282522]/95 border-t border-[#4a443f]/60 backdrop-blur-xl flex items-center gap-2 overflow-hidden"
            >
              <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#34302d] border border-[#b99881]/40 shadow-inner">
                <Search className="w-4 h-4 text-[#b99881] shrink-0" />
                <input
                  type="text"
                  placeholder="Kayıtlarda ara..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      if (!searchQuery) setIsSearchOpen(false)
                      else onSearchChange && onSearchChange('')
                    }
                  }}
                  className="w-full bg-transparent border-none text-xs text-[#f3efe9] placeholder-[#a69f99] focus:outline-none font-sans"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => onSearchChange && onSearchChange('')}
                    className="text-[#a69f99] hover:text-white p-0.5 shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsSearchOpen(false)
                  onSearchChange && onSearchChange('')
                }}
                className="text-xs text-[#b99881] font-semibold hover:text-white shrink-0 px-1 cursor-pointer"
              >
                Kapat
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 
        MOBİL SAĞ-ALT DİKEY YÜZEN İKON ÇUBUĞU (Vertical Floating Action Stack)
        Masaüstünde sağ üstte yer alan ikonlar mobilde sağ alta üst üste sıralanır:
        [9-Nokta Menü (dock kapalıysa)] -> Arama -> Bildirimler -> Mesajlar -> E-Posta -> Profil
      */}
      <div className="flex md:hidden fixed bottom-6 right-3.5 z-40 flex-col items-center gap-2 p-1.5 rounded-full bg-[#282522]/90 border border-[#b99881]/30 backdrop-blur-xl shadow-2xl">
        {/* 1. 9-Noktalı Menü (Dock kapalıysa) */}
        {!dockEnabled && (
          <button
            type="button"
            onClick={() => setIsAppMenuOpen(!isAppMenuOpen)}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              isAppMenuOpen ? 'bg-[#b99881] text-[#282522]' : 'text-[#d6beae] hover:text-white hover:bg-white/10'
            }`}
            title="Uygulama Menüsü & Araçlar"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="5" r="2" />
              <circle cx="12" cy="5" r="2" />
              <circle cx="19" cy="5" r="2" />
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
              <circle cx="5" cy="19" r="2" />
              <circle cx="12" cy="19" r="2" />
              <circle cx="19" cy="19" r="2" />
            </svg>
          </button>
        )}

        {/* 2. Arama */}
        <button
          type="button"
          onClick={() => {
            const nextState = !isSearchOpen
            setIsSearchOpen(nextState)
            if (nextState) {
              setTimeout(() => searchInputRef.current?.focus(), 100)
            }
          }}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
            isSearchOpen ? 'bg-[#b99881] text-[#282522]' : 'text-[#d6beae] hover:text-white hover:bg-white/10'
          }`}
          title="Arama Yap"
        >
          <Search className="w-4 h-4" strokeWidth={2} />
        </button>

        {/* 3. Bildirimler */}
        <button
          type="button"
          onClick={() => {
            const willOpen = !isNotificationsOpen
            setIsNotificationsOpen(willOpen)
            if (willOpen && messageStore.getDisplayMode() === 'popup') {
              messageStore.setPanelOpen(false)
            }
          }}
          className={`relative w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
            isNotificationsOpen ? 'bg-[#b99881] text-[#282522]' : 'text-[#d6beae] hover:text-white hover:bg-white/10'
          }`}
          title="Bildirimler"
        >
          <Bell className="w-4 h-4" strokeWidth={1.9} />
          {totalUnreadNotifications > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 rounded-full bg-[#b99881] text-[#1c1a18] text-[9px] font-extrabold flex items-center justify-center shadow-xs">
              {totalUnreadNotifications > 99 ? '99+' : totalUnreadNotifications}
            </span>
          )}
        </button>

        {/* 4. Yazışmalar (Chat) */}
        <button
          type="button"
          onClick={() => {
            setIsNotificationsOpen(false)
            messageStore.togglePanel()
          }}
          className={`relative w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
            isMessagesOpen ? 'bg-[#b99881] text-[#282522]' : 'text-[#d6beae] hover:text-white hover:bg-white/10'
          }`}
          title="Yazışmalar"
        >
          <IosChatBubbleIcon className="w-4 h-4" />
          {currentUser && messageStore.getTotalUnreadCount(currentUser.id) > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#b99881]" />
          )}
        </button>

        {/* 5. E-Posta */}
        <button
          type="button"
          onClick={onOpenMail}
          className="relative w-9 h-9 rounded-full flex items-center justify-center text-[#d6beae] hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          title="Kurumsal E-Posta Kutusu"
        >
          <Mail className="w-4 h-4" strokeWidth={1.9} />
          {unreadMailCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 rounded-full bg-[#b99881] text-[#1c1a18] text-[9px] font-extrabold flex items-center justify-center shadow-xs">
              {unreadMailCount > 99 ? '99+' : unreadMailCount}
            </span>
          )}
        </button>

        {/* 6. Profil Simgesi */}
        <button
          type="button"
          onClick={onOpenProfile}
          className="w-9 h-9 rounded-full bg-[#282522] border-2 border-[#b99881] shadow-md flex items-center justify-center transition-all cursor-pointer overflow-hidden shrink-0 hover:scale-105 active:scale-95 ring-1 ring-[#b99881]/30"
          title={
            currentUser
              ? `${currentUser.fullName} (@${currentUser.username}) - ${activeDept}`
              : 'Giriş Yap'
          }
        >
          {currentUser?.avatarUrl ? (
            <img
              src={currentUser.avatarUrl}
              alt={currentUser.fullName}
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            <span className="text-xs font-bold text-[#b99881] font-sans tracking-wide">
              {currentUser?.fullName
                ? currentUser.fullName
                    .trim()
                    .split(/\s+/)
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()
                : 'DP'}
            </span>
          )}
        </button>
      </div>

      {/* Mobil Popover ve Paneller (Masaüstü gizlendiğinde mobilde görünmelerini sağlar) */}
      <div className="md:hidden">
        {isNotificationsOpen && (
          <NotificationsPopover
            isOpen={true}
            onClose={() => setIsNotificationsOpen(false)}
            onNavigate={(targetTab) => {
              notificationStore.markTabAsViewed(targetTab)
              onTabChange(targetTab)
            }}
          />
        )}
        {isMessagesOpen && (
          <MessagingPanel
            currentUser={currentUser}
            isOpen={true}
            onClose={() => messageStore.setPanelOpen(false)}
          />
        )}
      </div>

      {/* Mobil Uygulama Menüsü Modalı */}
      <AnimatePresence>
        {!dockEnabled && isAppMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="dropdown-panel fixed right-3.5 bottom-24 w-[calc(100vw-28px)] max-w-sm rounded-[28px] bg-[#282522] border border-[#4a443f] shadow-2xl p-4 z-50 backdrop-blur-2xl space-y-3 md:hidden"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#4a443f]">
              <div className="flex items-center gap-2">
                <BookLogo className="w-5 h-5 text-[#b99881]" />
                <span className="text-sm font-bold text-white">Uygulama Menüsü</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAppMenuOpen(false)
                    onOpenSettings()
                  }}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#34302d] hover:bg-[#3d3733] border border-[#4a443f] text-xs font-semibold text-[#d6beae] hover:text-white transition-colors cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5 text-[#b99881]" />
                  <span>Ayarlar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAppMenuOpen(false)}
                  className="p-1 rounded-full hover:bg-white/10 text-[#a69f99]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsAppMenuOpen(false)
                  onOpenMail?.()
                }}
                className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#34302d] hover:bg-[#3d3733] border border-[#4a443f]/60 text-left transition-colors cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-full bg-[#282522] border border-[#b99881]/40 flex items-center justify-center text-[#b99881]">
                  <Mail className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-white block">E-Posta</span>
                  <span className="text-[10px] text-[#8c857f] block truncate">Kurumsal Posta</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsAppMenuOpen(false)
                  onTabChange('contacts')
                }}
                className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#34302d] hover:bg-[#3d3733] border border-[#4a443f]/60 text-left transition-colors cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-full bg-[#282522] border border-[#b99881]/40 flex items-center justify-center text-[#b99881]">
                  <User className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-white block">Kişiler</span>
                  <span className="text-[10px] text-[#8c857f] block truncate">Telefon Rehberi</span>
                </div>
              </button>
            </div>

            <div>
              <span className="text-[10px] font-semibold uppercase text-[#8c857f] tracking-wider block mb-1.5 px-1">
                Hızlı Araçlar
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: 'notepad' as ToolType, label: 'Not Defteri' },
                  { id: 'calculator' as ToolType, label: 'Hesap Mak.' },
                  { id: 'commission' as ToolType, label: 'Satış Primi' },
                  { id: 'currency' as ToolType, label: 'Döviz & Kur' },
                  { id: 'mortgage' as ToolType, label: 'Konut Kredisi' },
                  { id: 'deedFee' as ToolType, label: 'Tapu Harcı' },
                  { id: 'sqmPrice' as ToolType, label: 'm² Fiyat' },
                  { id: 'whatsapp' as ToolType, label: 'WhatsApp' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setIsAppMenuOpen(false)
                      onOpenTool?.(t.id)
                    }}
                    className="p-2 rounded-xl bg-[#34302d]/70 hover:bg-[#3d3733] border border-[#4a443f]/50 text-center transition-colors cursor-pointer group"
                  >
                    <span className="text-[11px] font-semibold text-[#c4bcb5] group-hover:text-white block truncate">
                      {t.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gizli Ölçüm Kapsayıcısı (Görünmez, dinamik responsive hesaplama amaçlı) */}
      <div
        ref={measureContainerRef}
        aria-hidden="true"
        className="flex items-center gap-5 lg:gap-7"
        style={{
          position: 'fixed',
          top: -9999,
          left: -9999,
          visibility: 'hidden',
          pointerEvents: 'none',
          opacity: 0,
          zIndex: -1,
        }}
      >
        {navItems.map((item) => {
          const unread = notificationStore.getUnreadCountForTab(item.id)
          const Icon = getNavPageIcon(item.id)
          return (
            <span
              key={item.id}
              data-id={item.id}
              className="text-[15px] font-medium py-1 whitespace-nowrap inline-flex items-center gap-1.5"
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
              {unread > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </span>
          )
        })}
        <div data-id="more-btn" className="p-1.5 flex items-center justify-center">
          <MoreHorizontal className="w-5 h-5" />
        </div>
      </div>
    </header>
    </>
  )
}
