import { teamOperationsStore } from '@/services/teamOperationsStore'
import { googleAdsStore } from '@/services/googleAdsStore'
import { brandKitStore } from '@/services/brandKitStore'
import { calendarStore } from '@/services/calendarStore'
import { contactStore } from '@/services/contactStore'
import { creativeStore } from '@/services/creativeStore'
import React, { useState, useEffect, useLayoutEffect, useCallback, useSyncExternalStore } from 'react'
import { frontOfficeStore } from '@/services/frontOfficeStore'
import { FRONT_OFFICE_MENU } from '@/types/frontOffice'
import { AccountingArchive } from '@/components/accounting/AccountingArchive'
import { ContractProvider, ContractsPage, CustomerContractButton } from '@/components/contracts/ContractWorkspace'
import { ModalHeaderAccessory } from '@/components/ui/GlassModal'
import { FrontOfficeView } from '@/components/frontoffice/FrontOfficeView'
import { BackendStatusBanner } from '@/components/common/BackendStatusBanner'
import { motion, AnimatePresence } from 'framer-motion'
import { Navbar, NavTab } from '@/components/layout/Navbar'
import { AppDock } from '@/components/layout/AppDock'
import { DashboardView } from '@/components/dashboard/DashboardView'
import { LeadDetailModal } from '@/components/crm/LeadDetailModal'
import { LeadAddModal } from '@/components/crm/LeadAddModal'
import { ContactsView } from '@/components/contacts/ContactsView'
import { AddPropertyModal } from '@/components/portfolio/AddPropertyModal'
import { PropertyListingsView } from '@/components/portfolio/PropertyListingsView'
import { ProjectsView } from '@/components/projects/ProjectsView'
import { SharedFilesView } from '@/components/shared/SharedFilesView'
import { SalesTeamView } from '@/components/sales/SalesTeamView'
import { QuickToolsModal, ToolType } from '@/components/tools/QuickToolsModal'
import { LoginModal } from '@/components/auth/LoginModal'
import { SettingsModal, applyAccentColorChoice } from '@/components/settings/SettingsModal'
import { MailWorkspaceModal } from '@/components/mail/MailWorkspaceModal'
import { AuthScreen } from '@/components/auth/AuthScreen'
import { FirstLoginPasswordScreen } from '@/components/auth/FirstLoginPasswordScreen'
import { OpeningAnimation } from '@/components/common/OpeningAnimation'
import { IdleScreenSaver } from '@/components/common/IdleScreenSaver'
import { ApplicationLock } from '@/components/common/ApplicationLock'
import { applicationLockStore } from '@/services/applicationLockStore'
import { AmbientSceneOverlay } from '@/components/common/AmbientSceneOverlay'
import { mailService } from '@/services/mailService'
import { formatPhoneNumber } from '@/utils/formatters'

// Department-Specific Views
import { MarketingCampaignsView } from '@/components/marketing/MarketingCampaignsView'
import { MarketingReportsView } from '@/components/marketing/MarketingReportsView'
import { CreativeScheduleView } from '@/components/creative/CreativeScheduleView'
import { CreativesGalleryView } from '@/components/creative/CreativesGalleryView'
import { CreativeBriefsView } from '@/components/creative/CreativeBriefsView'
import { BrandKitView } from '@/components/creative/BrandKitView'
import { AppointmentsView } from '@/components/appointments/AppointmentsView'
import { SalesPerformanceView } from '@/components/sales/SalesPerformanceView'
import { CustomersView } from '@/components/crm/CustomersView'
import { RequestsView } from '@/components/crm/RequestsView'
import { CollectionsView } from '@/components/accounting/CollectionsView'
import { PaymentsView } from '@/components/accounting/PaymentsView'
import { FinancialReportsView } from '@/components/accounting/FinancialReportsView'
import { TeamPermissionsView } from '@/components/admin/TeamPermissionsView'
import { ExecutiveReportsView } from '@/components/admin/ExecutiveReportsView'
import { ApprovalsView } from '@/components/admin/ApprovalsView'
import { TeamsView } from '@/components/teams/TeamsView'

import { leadStore } from '@/services/leadStore'
import { portfolioStore } from '@/services/portfolioStore'
import { userStore, AppUser } from '@/services/userStore'
import { projectStore } from '@/services/projectStore'
import { appointmentStore } from '@/services/appointmentStore'
import { requestStore } from '@/services/requestStore'
import { accountingStore } from '@/services/accountingStore'
import { approvalStore } from '@/services/approvalStore'
import { sharedFileStore } from '@/services/sharedFileStore'
import { syncService } from '@/services/syncService'
import { messageStore } from '@/services/messageStore'
import { Lead, LeadStage } from '@/types/lead'
import { PortfolioItem } from '@/types/portfolio'
import {
  DEPARTMENT_MENU_CONFIG,
  Department,
  getDepartmentForPage,
} from '@/types/department'
import { notificationStore } from '@/services/notificationStore'
import { SearchResultItem, normalizeTr } from '@/services/departmentSearchService'

const screenSaverDisabledKey = 'demirturk_screensaver_disabled'

export function App() {
  const [screenSaverDisabled, setScreenSaverDisabled] = useState(() => {
    try { return localStorage.getItem(screenSaverDisabledKey) === 'true' } catch { return false }
  })
  const changeScreenSaverPreference = (disabled: boolean) => {
    setScreenSaverDisabled(disabled)
    try { localStorage.setItem(screenSaverDisabledKey, String(disabled)) } catch { /* Applies for this session. */ }
  }
  const office = useSyncExternalStore(frontOfficeStore.subscribe, frontOfficeStore.getSnapshot)
  useEffect(() => frontOfficeStore.start(), [])
  const [projectSync, setProjectSync] = useState(projectStore.getSyncState())
  useEffect(() => projectStore.subscribe(() => setProjectSync(projectStore.getSyncState())), [])
  const [showOpening, setShowOpening] = useState(false)
  const [currentUser, setCurrentUser] = useState<AppUser | null>(userStore.getCurrentUser())
  const applicationLock = useSyncExternalStore(applicationLockStore.subscribe, applicationLockStore.getSnapshot)
  useLayoutEffect(() => applicationLockStore.start(currentUser && !currentUser.mustChangePassword ? currentUser.id : null),
    [currentUser?.id, currentUser?.mustChangePassword])
  useEffect(()=>{userStore.startServerAuth()},[])
  useEffect(() => {
    if (!userStore.centralAuthEnabled || !currentUser?.id || currentUser.mustChangePassword) return
    return leadStore.connectCentralFeed(currentUser.id)
  }, [currentUser?.id, currentUser?.mustChangePassword])
  useEffect(() => {
    if (!userStore.centralAuthEnabled) return
    const refresh = () => { void appointmentStore.refreshFromBackend() }
    appointmentStore.setAccount(currentUser?.id ?? null)
    refresh()
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [currentUser?.id])
  useEffect(() => {
    if (!userStore.centralAuthEnabled) return
    requestStore.setAccount(currentUser?.id ?? null)
    accountingStore.setAccount(currentUser?.id ?? null)
    approvalStore.setAccount(currentUser?.id ?? null)
    sharedFileStore.setAccount(currentUser?.id ?? null)
    projectStore.setAccount(currentUser?.id ?? null)
    contactStore.setAccount(currentUser?.id ?? null)
    portfolioStore.setAccount(currentUser?.id ?? null)
    creativeStore.setAccount(currentUser?.id ?? null)
    calendarStore.setAccount(currentUser?.id ?? null)
    brandKitStore.setAccount(currentUser?.id ?? null)
    messageStore.setAccount(currentUser?.id ?? null)
    teamOperationsStore.setAccount(currentUser?.id ?? null)
    googleAdsStore.setAccount(currentUser?.id ?? null)
    const refresh = () => {
      void leadStore.refreshFromSupabase()
      void requestStore.refreshFromSupabase()
      void accountingStore.refreshFromBackend()
      void approvalStore.refreshFromBackend()
      void sharedFileStore.refreshFromBackend()
      void projectStore.refreshFromBackend()
      void contactStore.refreshFromBackend()
      void portfolioStore.refreshFromBackend()
      void creativeStore.refreshFromBackend()
      void calendarStore.refreshFromBackend()
      void brandKitStore.refreshFromBackend()
      void messageStore.refreshFromBackend()
      void teamOperationsStore.refreshFromBackend()
      void googleAdsStore.refreshFromBackend()
    }
    refresh()
    window.addEventListener('focus', refresh)
    window.addEventListener('crm:refresh-requested', refresh)
    const timer=setInterval(()=>{if(document.visibilityState==='visible')void teamOperationsStore.refreshFromBackend()},15000)
    const messageTimer=setInterval(()=>{if(document.visibilityState==='visible')void messageStore.refreshFromBackend()},2000)
    return () => { window.removeEventListener('focus', refresh);window.removeEventListener('crm:refresh-requested', refresh);clearInterval(timer);clearInterval(messageTimer) }
  }, [currentUser?.id])
  const [activeTab, setActiveTabState] = useState<NavTab>(() => {
    const raw = typeof window !== 'undefined' ? window.location.hash.replace(/^#\/?/, '') : 'dashboard'
    return (raw as NavTab) || 'dashboard'
  })

  // Adaptive layout state when messaging sidebar is open
  const [isMessagingOpen, setIsMessagingOpen] = useState(messageStore.isPanelOpen())
  const [messagingMode, setMessagingMode] = useState(messageStore.getDisplayMode())
  const [messagingSidebarWidth, setMessagingSidebarWidth] = useState(messageStore.getSidebarWidth())

  useEffect(() => {
    const update = () => {
      setIsMessagingOpen(messageStore.isPanelOpen())
      setMessagingMode(messageStore.getDisplayMode())
      setMessagingSidebarWidth(messageStore.getSidebarWidth())
    }
    const unsub = messageStore.subscribe(update)
    return unsub
  }, [])

  useEffect(() => {
    notificationStore.markTabAsViewed(activeTab)
  }, [])

  const setActiveTab = useCallback((tab: NavTab) => {
    const cleanTab = (tab || '').replace(/^#\/?/, '') as NavTab
    let finalTab = cleanTab || 'dashboard'
    const account = userStore.getCurrentUser()
    const officeState = frontOfficeStore.getSnapshot()
    const sharedContractPage = !officeState.active && (account?.department === 'Muhasebe' || account?.department === 'Yönetim')
    const officePage = finalTab === 'office-visitors' || (finalTab === 'office-contracts' && !sharedContractPage)
    if (officePage) {
      if (!officeState.canAccess || !frontOfficeStore.activate(true)) finalTab = 'dashboard'
    } else if (officeState.active && !FRONT_OFFICE_MENU.some(page => page.id === finalTab)) {
      frontOfficeStore.activate(false)
    }
    if (account && !officePage && finalTab !== 'contacts' && !DEPARTMENT_MENU_CONFIG[account.department].some(page => page.id === finalTab)) {
      const targetDept = getDepartmentForPage(finalTab)
      if (!targetDept || !userStore.switchDepartment(targetDept).success) finalTab = 'dashboard'
    }

    notificationStore.markTabAsViewed(finalTab)
    setActiveTabState(finalTab)
    if (typeof window !== 'undefined') {
      if (window.location.hash !== `#${finalTab}`) {
        window.location.hash = finalTab
      }
    }
  }, [])

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace(/^#\/?/, '') as NavTab
      if (hash && hash !== activeTab) {
        setActiveTab(hash)
      }
    }
    window.addEventListener('hashchange', handleHash)
    return () => window.removeEventListener('hashchange', handleHash)
  }, [activeTab, setActiveTab])

  const [searchQuery, setSearchQuery] = useState('')
  const [activeTool, setActiveTool] = useState<ToolType | null>(null)

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const [isMailWorkspaceOpen, setIsMailWorkspaceOpen] = useState(false)
  const [unreadMailCount, setUnreadMailCount] = useState<number>(() => mailService.getUnreadCount(userStore.getCurrentUser()))
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('demirturk_sidebar_collapsed') === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    const handleSidebarCollapseChange = () => {
      try {
        setIsSidebarCollapsed(localStorage.getItem('demirturk_sidebar_collapsed') === 'true')
      } catch {}
    }
    window.addEventListener('demirturk_sidebar_collapsed_changed', handleSidebarCollapseChange)
    return () => window.removeEventListener('demirturk_sidebar_collapsed_changed', handleSidebarCollapseChange)
  }, [])

  // Reactive state from stores
  const [leads, setLeads] = useState<Lead[]>(() => leadStore.getAll(currentUser))
  const [properties, setProperties] = useState<PortfolioItem[]>(() => portfolioStore.getAll())

  // Modal states
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [isLeadDetailOpen, setIsLeadDetailOpen] = useState(false)
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false)
  const [isAddPropertyOpen, setIsAddPropertyOpen] = useState(false)
  useEffect(() => {
    if (!applicationLock.locked) return
    setActiveTabState('dashboard')
    setIsLeadDetailOpen(false); setSelectedLead(null); setIsAddLeadOpen(false); setIsAddPropertyOpen(false)
    setIsSettingsModalOpen(false)
  }, [applicationLock.locked])

  // Global F5 and Ctrl+R / Cmd+R instant page reload support
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r')) {
        e.preventDefault()
        window.location.reload()
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  // Subscriptions to stores & initial theme sync
  useEffect(() => {
    try {
      const savedAccent = localStorage.getItem('demirturk_theme_accent')
      const isNightTheme =
        savedAccent === 'night' ||
        savedAccent === 'amber' ||
        savedAccent === 'emerald' ||
        savedAccent === 'sapphire' ||
        savedAccent === 'platinum'
      if (isNightTheme) {
        document.documentElement.setAttribute('data-theme-accent', 'night')
      } else {
        document.documentElement.removeAttribute('data-theme-accent')
      }
      const defaultAccentId = isNightTheme ? 'sage' : 'indigo'
      const savedCustomAccentColor = localStorage.getItem('demirturk_accent_color') || defaultAccentId
      applyAccentColorChoice(savedCustomAccentColor)

      const savedContrast = localStorage.getItem('demirturk_theme_contrast')
      if (savedContrast === 'deep') {
        document.documentElement.setAttribute('data-theme-contrast', 'deep')
      }
      const savedFontSize = localStorage.getItem('demirturk_font_size')
      if (savedFontSize) {
        document.documentElement.setAttribute('data-font-size', savedFontSize)
      }
    } catch {}

    const unsubMail = mailService.subscribe(() => {
      setUnreadMailCount(mailService.getUnreadCount(userStore.getCurrentUser()))
    })

    // Cloud Database Persistence & Realtime Init (Pure Data Mode)
    syncService.init({
      onLeadsLoaded: (loadedLeads, loadedActivities) => {
        leadStore.setLoadedLeads(loadedLeads, loadedActivities)
      },

      onProjectsLoaded: (loadedProjects) => {
        projectStore.setLoadedProjects(loadedProjects)
      },

      onAppointmentsLoaded: (loadedApts) => {
        appointmentStore.setLoadedAppointments(loadedApts)
      },

      onRequestsLoaded: (loadedReqs) => {
        requestStore.setLoadedRequests(loadedReqs)
      },

      getInitialUsers: () => userStore.getAll(),
      onUsersLoaded: (loadedUsers) => {
        userStore.setLoadedUsers(loadedUsers)
      },

      onAccountingLoaded: (cols, pays) => {
        accountingStore.setLoadedAccounting(cols, pays)
      },

      onApprovalsLoaded: (loadedApps) => {
        approvalStore.setLoadedApprovals(loadedApps)
      },

      onFilesLoaded: (loadedFiles) => {
        sharedFileStore.setLoadedFiles(loadedFiles)
      },
    })

    return () => {
      unsubMail()
    }
  }, [])
  useEffect(() => {
    const unsubUser = userStore.subscribe(() => {
      const u = userStore.getCurrentUser()
      setCurrentUser(u)
      setLeads(leadStore.getAll(u))
    })

    const unsubLead = leadStore.subscribe(() => {
      setLeads(leadStore.getAll(userStore.getCurrentUser()))
      if (selectedLead) {
        const updated = leadStore.getById(selectedLead.id, userStore.getCurrentUser())
        if (updated) setSelectedLead(updated)
        else {
          setSelectedLead(null)
          setIsLeadDetailOpen(false)
        }
      }
    })

    const unsubPort = portfolioStore.subscribe(() => {
      setProperties(portfolioStore.getAll())
    })

    return () => {
      unsubUser()
      unsubLead()
      unsubPort()
    }
  }, [selectedLead])

  // If no admin exists in system, automatically prompt register admin
  useEffect(() => {
    if (!userStore.centralAuthEnabled && !userStore.hasAdmin()) {
      setIsLoginModalOpen(true)
    }
  }, [])

  // Auto-redirect if activeTab is not in current department's 6 pages (except contacts dock item)
  useEffect(() => {
    if (!currentUser) return
    const activeDept: Department = currentUser.department || 'Pazarlama'
    if ((activeTab === 'office-visitors' || activeTab === 'office-contracts') && office.loading) return
    const allowedPages = office.active && office.canAccess ? FRONT_OFFICE_MENU : DEPARTMENT_MENU_CONFIG[activeDept] || []
    const isAllowed =
      activeTab === 'contacts' || allowedPages.some((p) => p.id === activeTab)

    if (!isAllowed) setActiveTab(activeTab)
  }, [currentUser, activeTab, setActiveTab, office.active, office.canAccess, office.loading])

  // Filter leads based on search query
  const filteredLeads = leads.filter((l) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      l.fullName.toLowerCase().includes(q) ||
      l.phone.includes(q) ||
      l.formName.toLowerCase().includes(q) ||
      (l.preferredHousingType && l.preferredHousingType.toLowerCase().includes(q))
    )
  })

  const handleSelectLead = (lead: Lead) => {
    const visible = leadStore.getById(lead.id, userStore.getCurrentUser())
    if (!visible) return
    setSelectedLead(visible)
    setIsLeadDetailOpen(true)
  }

  const handleStageChange = (leadId: string, newStage: LeadStage) => {
    leadStore.updateStage(leadId, newStage, currentUser)
  }

  useEffect(() => {
    let lastHandledKey = ''
    const handleSearchSelect = (e: Event) => {
      const customEvent = e as CustomEvent<SearchResultItem>
      const item = customEvent.detail
      if (!item) return

      const payload = item.payload || { pageId: item.pageId }
      if (payload.leadId) {
        const found =
          leadStore.getById(payload.leadId, userStore.getCurrentUser()) ||
          leadStore.getAllRaw().find((l) => l.id === payload.leadId)
        if (found) {
          setSelectedLead(found)
          setIsLeadDetailOpen(true)
        }
      }

      if (payload.stageFilter) {
        window.dispatchEvent(
          new CustomEvent('demirturk:switch-customer-stage-tab', {
            detail: payload.stageFilter,
          })
        )
      }

      const rawSearchText = (payload.sectionQuery || item.title || '')
        .split('—')[0]
        .split('(')[0]
        .trim()
      const normTarget = normalizeTr(rawSearchText)
      const dedupeKey = `${item.id}:${Math.floor(Date.now() / 600)}`
      if (normTarget && normTarget.length >= 2 && lastHandledKey !== dedupeKey) {
        const mainEl = document.querySelector('main')
        if (mainEl) {
          const nodes = Array.from(
            mainEl.querySelectorAll('h1, h2, h3, h4, span, div, td, p')
          ) as HTMLElement[]
          const matchEl = nodes.find((el) => {
            if (el.children.length > 4) return false
            const txt = normalizeTr(el.textContent || '')
            return txt.length > 0 && txt.length < 180 && txt.includes(normTarget)
          })
          if (matchEl) {
            lastHandledKey = dedupeKey
            const targetCard = (matchEl.closest('.glass-card') || matchEl) as HTMLElement
            targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' })
            try {
              targetCard.animate(
                [
                  { outline: '2px solid var(--accent-color, #5c6ac4)', outlineOffset: '2px' },
                  { outline: '2px solid transparent', outlineOffset: '6px' },
                ],
                { duration: 1500, easing: 'ease-out' }
              )
            } catch {}
          }
        }
      }
    }

    window.addEventListener('demirturk:search-select', handleSearchSelect)
    return () => window.removeEventListener('demirturk:search-select', handleSearchSelect)
  }, [])

  // Not logged in: Show dedicated modern Sign In & Sign Up screen
  if (currentUser?.mustChangePassword) {
    return (
      <FirstLoginPasswordScreen key={currentUser.id} centralAuth={userStore.centralAuthEnabled}
        onSave={(currentPassword, newPassword) => userStore.finishFirstLoginPassword(currentPassword, newPassword)}
        onBack={() => userStore.logout()} />
    )
  }
  if (!currentUser) {
    return (
      <>
        <AnimatePresence>
          {showOpening && <OpeningAnimation onComplete={() => setShowOpening(false)} />}
        </AnimatePresence>
        <AuthScreen
          onLoginSuccess={(user) => {
            setCurrentUser(user)
            setIsLoginModalOpen(false)
          }}
        />
      </>
    )
  }

  return (
    <ContractProvider key={currentUser.id} account={currentUser} enabled={!applicationLock.locked && (office.active && office.canAccess || ['Ön Ofis', 'Muhasebe', 'Satış', 'Yönetim'].includes(currentUser.department) || currentUser.role === 'ADMIN')}>
    <div inert={applicationLock.locked || undefined} aria-hidden={applicationLock.locked || undefined} className="min-h-screen bg-[#f5f5f2] text-[#292d2b] relative selection:bg-[#657a72]/25 selection:text-[#292d2b] pb-6 font-sans overflow-x-hidden">
      <AnimatePresence>
        {showOpening && <OpeningAnimation onComplete={() => setShowOpening(false)} />}
      </AnimatePresence>

      {userStore.centralAuthEnabled && (projectSync.dirty || projectSync.error) && (
        <div role="status" className="sticky top-0 z-[100] bg-amber-50 border-b border-amber-300 p-3 text-sm">
          {projectSync.error || (projectSync.saving ? 'Proje sunucuya kaydediliyor…' : 'Proje değişiklikleri henüz sunucuda doğrulanmadı.')}
          {!projectSync.saving && <>
            <button className="ml-3 underline" onClick={() => void projectStore.flushToBackend().catch(() => {})}>Tekrar kaydet</button>
            <button className="ml-3 underline" onClick={() => { if (window.confirm('Kaydedilmemiş proje değişiklikleri bırakılıp sunucudaki kayıt okunsun mu?')) void projectStore.discardDraftAndReload().catch(error => window.alert(error.message)) }}>Sunucudaki kaydı yükle</button>
          </>}
        </div>
      )}
      {userStore.centralAuthEnabled && <BackendStatusBanner />}
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenProfile={() => setIsLoginModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenMail={() => setIsMailWorkspaceOpen(true)}
        onOpenTool={(tool) => setActiveTool(tool)}
        unreadMailCount={unreadMailCount}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        currentUser={currentUser}
      />

      {/* Main Fluid Responsive Canvas */}
      <main
        style={{
          width:
            isMessagingOpen && messagingMode === 'sidebar' && typeof window !== 'undefined' && window.innerWidth >= 768
              ? `calc(100% - ${messagingSidebarWidth}px)`
              : '100%',
          transition: 'width 0.2s cubic-bezier(0.16, 1, 0.3, 1), padding-left 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        className={`px-3 sm:px-6 ${
          isSidebarCollapsed ? 'md:pl-[88px]' : 'md:pl-[236px]'
        } lg:pr-10 2xl:pr-14 pt-3 md:pt-2 pb-9 sm:pb-10 relative z-10 overflow-x-clip transition-[padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]`}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="w-full page-mexican-wave"
          >
            {/* 1. Başlangıç (Tüm Departmanlarda Daima 1. Sayfa) */}
            {activeTab === 'dashboard' && (
              <DashboardView
                leads={leads}
                properties={properties}
                onSelectLead={handleSelectLead}
                onNavigateToTab={setActiveTab}
                currentUser={currentUser}
              />
            )}

            {/* PAZARLAMA SAYFALARI */}
            {activeTab === 'portfolio' && (
              <CustomersView
                isMarketingView={true}
                leads={filteredLeads}
                onSelectLead={handleSelectLead}
                currentUser={currentUser}
                onOpenNewLead={() => setIsAddLeadOpen(true)}
              />
            )}
            {activeTab === 'marketing-campaigns' && <MarketingCampaignsView />}
            {activeTab === 'marketing-reports' && <MarketingReportsView leads={filteredLeads} />}

            {/* KREATİF SAYFALARI */}
            {activeTab === 'creative-schedule' && <CreativeScheduleView />}
            {activeTab === 'creatives' && <CreativesGalleryView />}
            {activeTab === 'creative-briefs' && <CreativeBriefsView />}
            {activeTab === 'brand-kit' && <BrandKitView />}

            {/* SATIŞ SAYFALARI */}
            {activeTab === 'crm' && (
              <SalesTeamView
                leads={filteredLeads}
                onSelectLead={handleSelectLead}
                onStageChange={handleStageChange}
                onOpenNewLead={() => setIsAddLeadOpen(true)}
                currentUser={currentUser}
              />
            )}
            {activeTab === 'appointments' && (
              <AppointmentsView
                pageTitle="Randevular"
                subtitle="Müşteri görüşmeleri, proje sunumları ve şantiye ziyaretleri takvimi."
                leads={filteredLeads}
              />
            )}
            {activeTab === 'sales-performance' && <SalesPerformanceView leads={filteredLeads} />}

            {/* MÜŞTERİ İLİŞKİLERİ SAYFALARI */}
            {activeTab === 'customers' && (
              <CustomersView
                leads={filteredLeads}
                onSelectLead={handleSelectLead}
                currentUser={currentUser}
                onOpenNewLead={() => setIsAddLeadOpen(true)}
              />
            )}
            {activeTab === 'followups-appointments' && (
              <AppointmentsView sourceColumns
                pageTitle="Takip ve Randevular"
                subtitle="Müşteri geri arama takipleri ve satış ekibine yönlendirilen randevular."
                leads={filteredLeads}
              />
            )}
            {/* MÜŞTERİ İLİŞKİLERİ & SATIŞ ORTAK TALEPLER SAYFASI */}
            {activeTab === 'requests' && (
              <RequestsView
                currentUser={currentUser}
                leads={leadStore.getAllRaw()}
                onSelectLead={handleSelectLead}
              />
            )}

            {/* MUHASEBE SAYFALARI */}
            {activeTab === 'collections' && <CollectionsView />}
            {activeTab === 'payments' && <PaymentsView />}
            {activeTab === 'financial-reports' && <FinancialReportsView />}
            {activeTab === 'office-visitors' && office.canAccess && <FrontOfficeView />}
            {activeTab === 'office-contracts' && <ContractsPage />}
            {activeTab === 'accounting-archive' && currentUser.department === 'Muhasebe' && <AccountingArchive key={currentUser.id}/>}

            {/* YÖNETİM SAYFALARI */}
            {activeTab === 'team-permissions' && <TeamPermissionsView />}
            {activeTab === 'executive-reports' && <ExecutiveReportsView leads={filteredLeads} />}
            {activeTab === 'approvals' && <ApprovalsView />}

            {/* Ortak Sayfa: Ekipler (Paylaşılanlar'dan Hemen Önce) */}
            {activeTab === 'teams' && (
              <TeamsView
                currentUser={currentUser}
                onOpenProfile={() => setIsLoginModalOpen(true)}
              />
            )}

            {/* Paylaşılanlar */}
            {activeTab === 'shared' && <SharedFilesView />}

            {/* Projeler */}
            {activeTab === 'projects' && (
              <ProjectsView onNavigateToPortfolio={() => setActiveTab('portfolio')} />
            )}
            {activeTab === 'property-listings' && <PropertyListingsView />}

            {/* Dock / Başlat Menüsü: Kişiler */}
            {activeTab === 'contacts' && <ContactsView />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Modals */}
      <ModalHeaderAccessory.Provider value={selectedLead ? <CustomerContractButton lead={selectedLead} onOpen={() => setIsLeadDetailOpen(false)} /> : null}>
      <LeadDetailModal
        lead={selectedLead}
        isOpen={isLeadDetailOpen}
        onClose={() => setIsLeadDetailOpen(false)}
        onStageChange={handleStageChange}
      />

      </ModalHeaderAccessory.Provider>

      <LeadAddModal
        isOpen={isAddLeadOpen}
        onClose={() => setIsAddLeadOpen(false)}
        onAdd={async (newLead, requestId) => {
          const saved = await leadStore.addManual(newLead, requestId)
          setLeads(leadStore.getAll(userStore.getCurrentUser()))
          window.dispatchEvent(new CustomEvent('demirturk:manual-lead-saved', { detail: saved }))
        }}
      />

      <AddPropertyModal
        isOpen={isAddPropertyOpen}
        onClose={() => setIsAddPropertyOpen(false)}
        onAdd={(newProp) => portfolioStore.add(newProp)}
      />

      {/* Quick Tools Modal */}
      <QuickToolsModal
        isOpen={activeTool !== null}
        onClose={() => setActiveTool(null)}
        initialTool={activeTool || 'calculator'}
      />

      {/* Login / Registration Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        currentUser={currentUser}
        onLoginSuccess={(user) => setCurrentUser(user)}
        onLogout={() => {
          if ((projectStore.getSyncState().dirty || brandKitStore.state().dirty) && !window.confirm('Kaydedilmemiş proje değişiklikleri var. Yine de çıkılsın mı?')) return
          userStore.logout()
          setCurrentUser(null)
        }}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenTeams={() => setActiveTab('teams')}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        currentUser={currentUser}
        screenSaverDisabled={screenSaverDisabled}
        onScreenSaverDisabledChange={changeScreenSaverPreference}
      />
      {!screenSaverDisabled && !applicationLock.locked && <IdleScreenSaver key={currentUser.id} />}
      <ApplicationLock />

      {/* Ambient Animated Background & Bottom Edge Scene */}
      <AmbientSceneOverlay sidebarCollapsed={isSidebarCollapsed} />

      {/* Bottom Dock with Start Menu */}
      <AppDock
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenTool={(tool) => setActiveTool(tool)}
        onOpenAddLead={() => setIsAddLeadOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenProfile={() => setIsLoginModalOpen(true)}
        onOpenMail={() => setIsMailWorkspaceOpen(true)}
        currentUser={currentUser}
      />

      {/* Mail Workspace Modal (Mailcow Webmail) */}
      <MailWorkspaceModal
        isOpen={isMailWorkspaceOpen}
        onClose={() => setIsMailWorkspaceOpen(false)}
        currentUser={currentUser}
      />
    </div>
    </ContractProvider>
  )
}

export default App
