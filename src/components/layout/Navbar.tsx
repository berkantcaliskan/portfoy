import React, { useState, useRef, useEffect } from 'react'
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
} from 'lucide-react'
import { AppUser, userStore } from '@/services/userStore'
import {
  Department,
  CANONICAL_DEPARTMENTS,
  DEPARTMENT_MENU_CONFIG,
  NavPageId,
} from '@/types/department'
import { BookLogo } from '@/components/common/BookLogo'
import { ToolType } from '@/components/tools/QuickToolsModal'

export type NavTab = NavPageId

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
  const [isMessagesOpen, setIsMessagesOpen] = useState(false)
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false)
  const [isAppMenuOpen, setIsAppMenuOpen] = useState(false)

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
  const workspaceRef = useRef<HTMLDivElement>(null)
  const appMenuRef = useRef<HTMLDivElement>(null)

  // Current active department workspace
  const activeDept: Department = currentUser?.department || 'Pazarlama'

  // Available departments user can switch between
  const authorizedDepts: Department[] =
    currentUser?.role === 'ADMIN'
      ? CANONICAL_DEPARTMENTS
      : currentUser?.departments && currentUser.departments.length > 0
      ? currentUser.departments
      : [activeDept]

  // Exact 6 pages for this active department
  const navItems = DEPARTMENT_MENU_CONFIG[activeDept] || DEPARTMENT_MENU_CONFIG['Pazarlama']

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
        setIsMessagesOpen(false)
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
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [searchQuery])

  const handleSwitchWorkspace = (dept: Department) => {
    const res = userStore.switchDepartment(dept)
    if (res.success) {
      setIsWorkspaceMenuOpen(false)
      // Navigate to Başlangıç on department switch
      onTabChange('dashboard')
    }
  }

  // Recent notifications or messages
  const recentMessages: { id: number; sender: string; text: string; time: string }[] = []

  return (
    <header className="w-full border-b border-[#4a443f] bg-[#34302d]/95 backdrop-blur-md sticky top-0 z-40 transition-colors">
      <div className="w-full px-6 lg:px-10 2xl:px-14">
        <div className="flex items-center justify-between h-16 gap-6">
          
          {/* Sol Kısım: Logo + Portföy + Çalışma Alanı (Workspace Switcher) */}
          <div className="flex items-center gap-4">
            <div
              className="flex items-center gap-3 shrink-0 cursor-pointer select-none group"
              onClick={() => onTabChange('dashboard')}
            >
              {/* 45 Derece Sağa Açık Kitap Logosu */}
              <div className="flex items-center justify-center text-[#b99881] transition-transform group-hover:scale-105">
                <BookLogo size={24} className="text-[#b99881]" />
              </div>

              {/* Marka Adı (Uygulamada SADECE burada The Seasons kullanılır) */}
              <span className="font-the-seasons text-xl tracking-wide font-normal text-white group-hover:text-[#d6beae] transition-colors">
                Portföy
              </span>
            </div>

            {/* Çalışma Alanı Seçicisi (Multi-Department Switcher) */}
            {authorizedDepts.length > 1 && (
              <div ref={workspaceRef} className="relative hidden sm:block">
                <button
                  type="button"
                  onClick={() => setIsWorkspaceMenuOpen(!isWorkspaceMenuOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#282522] hover:bg-[#3d3733] border border-[#4a443f] text-sm text-[#d6beae] hover:text-white transition-all cursor-pointer select-none"
                  title="Departman / Çalışma Alanı Değiştir"
                >
                  <Layers className="w-4 h-4 text-[#b99881]" />
                  <span className="font-semibold text-white">{activeDept}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-[#a69f99] transition-transform duration-200 ${isWorkspaceMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {isWorkspaceMenuOpen && (
                  <div className="absolute left-0 mt-2 w-56 rounded-[20px] bg-[#282522] border border-[#4a443f] shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3 py-1.5 text-xs font-semibold text-[#8c857f] uppercase tracking-wider">
                      Yetkili Çalışma Alanları
                    </div>
                    <div className="space-y-1">
                      {authorizedDepts.map((dept) => {
                        const isCurrent = dept === activeDept
                        return (
                          <button
                            key={dept}
                            onClick={() => handleSwitchWorkspace(dept)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-[14px] text-sm transition-colors cursor-pointer text-left ${
                              isCurrent
                                ? 'bg-[#b99881]/20 text-white font-semibold'
                                : 'text-[#a69f99] hover:bg-[#34302d] hover:text-[#f3efe9]'
                            }`}
                          >
                            <span>{dept}</span>
                            {isCurrent && <Check className="w-4 h-4 text-[#b99881]" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Ortadaki Sayfalar: Her Departmanda KESİNLİKLE EN FAZLA 6 SAYFA */}
          <nav className="hidden md:flex items-center gap-6 lg:gap-8">
            {navItems.map((item) => {
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`relative text-[15px] font-medium transition-all cursor-pointer py-1 select-none ${
                    isActive
                      ? 'text-white font-semibold'
                      : 'text-[#a69f99] hover:text-[#f3efe9]'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-[#b99881] rounded-full" />
                  )}
                </button>
              )
            })}
          </nav>

          {/* Sağ Alan: [9-Noktalı Menü (Dock kapalıysa)] -> Arama -> Mesajlar -> Mail -> Profil (Yalnızca Profil Yuvarlak) */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* 1. 9-Noktalı Uygulama Menüsü (Yalnızca Dock Kapalı / Off İse Görünür - Yuvarlak Değil) */}
            {!dockEnabled && (
              <div ref={appMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsAppMenuOpen(!isAppMenuOpen)}
                  className={`p-2 rounded-lg transition-colors cursor-pointer flex items-center justify-center ${
                    isAppMenuOpen
                      ? 'text-[#b99881] bg-white/10'
                      : 'text-[#d6beae] hover:text-white hover:bg-white/5'
                  }`}
                  title="Uygulama Menüsü & Araçlar"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
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

                {isAppMenuOpen && (
                  <div className="absolute right-0 mt-2 w-80 rounded-[28px] bg-[#282522]/95 border border-[#4a443f] shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl space-y-3">
                    <div className="flex items-center justify-between pb-3 border-b border-[#4a443f]">
                      <div className="flex items-center gap-2">
                        <BookLogo className="w-5 h-5 text-[#b99881]" />
                        <span className="text-sm font-bold text-white">Uygulama Menüsü</span>
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
                  </div>
                )}
              </div>
            )}

            {/* 2. Arama Barı (Yuvarlak Değil, Yalnızca İkon - Tıklandığında Input Açılır) */}
            <div ref={searchContainerRef} className="relative flex items-center justify-end">
              {isSearchOpen ? (
                <div className="flex items-center w-56 sm:w-68 bg-[#282522] border border-[#b99881]/50 rounded-full px-3.5 py-1.5 shadow-lg transition-all animate-in fade-in slide-in-from-right-2 duration-150">
                  <Search className="w-4 h-4 text-[#b99881] shrink-0 mr-2" strokeWidth={2} />
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
                    className="w-full bg-transparent border-none text-xs text-[#f3efe9] placeholder-[#a69f99] focus:outline-none font-sans"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (searchQuery) {
                        onSearchChange && onSearchChange('')
                      } else {
                        setIsSearchOpen(false)
                      }
                    }}
                    className="text-[#a69f99] hover:text-white transition-colors p-0.5 ml-1 shrink-0 cursor-pointer"
                    title="Kapat"
                  >
                    <X className="w-3.5 h-3.5" strokeWidth={2} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsSearchOpen(true)
                    setTimeout(() => searchInputRef.current?.focus(), 60)
                  }}
                  className="p-2 rounded-lg text-[#d6beae] hover:text-white hover:bg-white/5 transition-colors cursor-pointer flex items-center justify-center"
                  title="Arama Yap"
                >
                  <Search className="w-5 h-5" strokeWidth={1.9} />
                </button>
              )}
            </div>

            {/* 3. Mesajlar İkonu (Yuvarlak Değil) */}
            <div ref={messagesRef} className="relative">
              <button
                type="button"
                onClick={() => setIsMessagesOpen(!isMessagesOpen)}
                className={`relative p-2 rounded-lg transition-colors cursor-pointer flex items-center justify-center ${
                  isMessagesOpen
                    ? 'text-[#b99881] bg-white/10'
                    : 'text-[#d6beae] hover:text-white hover:bg-white/5'
                }`}
                title="Müşteri Mesajları ve Bildirimler"
              >
                <MessageSquare className="w-5 h-5" strokeWidth={1.9} />
                {recentMessages.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#b99881]" />
                )}
              </button>

              {/* Mesajlar Dropdown */}
              {isMessagesOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-[24px] bg-[#282522] border border-[#4a443f] shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#4a443f]">
                    <span className="text-sm font-bold text-white">Müşteri Mesajları</span>
                    {recentMessages.length > 0 && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#b99881]/20 text-[#b99881] font-semibold">
                        {recentMessages.length} Yeni
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    {recentMessages.length === 0 ? (
                      <div className="p-4 text-center text-sm text-[#8c857f]">
                        Gelen yeni mesaj bulunmuyor.
                      </div>
                    ) : (
                      recentMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className="p-2.5 rounded-[16px] bg-[#34302d] hover:bg-[#3d3733] border border-[#4a443f]/60 transition-colors cursor-pointer space-y-1"
                          onClick={() => setIsMessagesOpen(false)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-white">{msg.sender}</span>
                            <span className="text-xs text-[#8c857f] flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {msg.time}
                            </span>
                          </div>
                          <p className="text-xs text-[#a69f99] line-clamp-2">{msg.text}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 4. E-Posta İkonu (Yuvarlak Değil) */}
            <button
              type="button"
              onClick={onOpenMail}
              className="relative p-2 rounded-lg text-[#d6beae] hover:text-white hover:bg-white/5 transition-colors cursor-pointer flex items-center justify-center"
              title="Kurumsal E-Posta Kutusu"
            >
              <Mail className="w-5 h-5" strokeWidth={1.9} />
              {unreadMailCount > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#b99881] text-[#1c1a18] text-[9px] font-extrabold flex items-center justify-center shadow-xs">
                  {unreadMailCount > 99 ? '99+' : unreadMailCount}
                </span>
              )}
            </button>

            {/* 5. Profil Simgesi (YALNIZCA BU DÜĞME YUVARLAK: 38px Avatar Çemberi) */}
            <button
              type="button"
              onClick={onOpenProfile}
              className="w-[38px] h-[38px] rounded-full bg-[#282522] border-2 border-[#b99881] shadow-md flex items-center justify-center transition-all cursor-pointer overflow-hidden shrink-0 hover:scale-105 active:scale-95 ml-1 ring-2 ring-[#b99881]/25 hover:ring-[#b99881]/50"
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
        </div>

        {/* Mobil Görünüm Navigasyon */}
        <div className="flex md:hidden items-center justify-around py-2 border-t border-[#4a443f] gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`py-1 px-2.5 rounded-full text-xs font-medium transition-colors shrink-0 ${
                  isActive ? 'text-[#b99881] font-bold bg-white/5' : 'text-[#a69f99]'
                }`}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      </div>
    </header>
  )
}
