import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Navbar, NavTab } from '@/components/layout/Navbar'
import { AppDock } from '@/components/layout/AppDock'
import { DashboardView } from '@/components/dashboard/DashboardView'
import { LeadDetailModal } from '@/components/crm/LeadDetailModal'
import { LeadAddModal } from '@/components/crm/LeadAddModal'
import { PortfolioView } from '@/components/portfolio/PortfolioView'
import { ContactsView } from '@/components/contacts/ContactsView'
import { AddPropertyModal } from '@/components/portfolio/AddPropertyModal'
import { ProjectsView } from '@/components/projects/ProjectsView'
import { SharedFilesView } from '@/components/shared/SharedFilesView'
import { SalesTeamView } from '@/components/sales/SalesTeamView'
import { QuickToolsModal, ToolType } from '@/components/tools/QuickToolsModal'
import { LoginModal } from '@/components/auth/LoginModal'
import { SettingsModal } from '@/components/settings/SettingsModal'
import { MailWorkspaceModal } from '@/components/mail/MailWorkspaceModal'
import { AuthScreen } from '@/components/auth/AuthScreen'
import { mailService } from '@/services/mailService'
import { X } from 'lucide-react'
import { formatPhoneNumber } from '@/utils/formatters'

// Department-Specific Views
import { MarketingCampaignsView } from '@/components/marketing/MarketingCampaignsView'
import { MarketingReportsView } from '@/components/marketing/MarketingReportsView'
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
import { PortfolioItem, PropertyStatus } from '@/types/portfolio'
import {
  DEPARTMENT_MENU_CONFIG,
  Department,
  NavPageId,
  getDepartmentForPage,
} from '@/types/department'
import { notificationStore } from '@/services/notificationStore'

export function App() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(userStore.getCurrentUser())
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

  const setActiveTab = (tab: NavTab) => {
    const cleanTab = (tab || '').replace(/^#\/?/, '') as NavTab
    const finalTab = cleanTab || 'dashboard'

    // Auto-sync department if navigating to a page owned by another department
    const targetDept = getDepartmentForPage(finalTab as NavPageId)
    const activeDept = currentUser?.department || 'Pazarlama'

    if (targetDept && targetDept !== activeDept) {
      userStore.switchDepartment(targetDept)
    }

    notificationStore.markTabAsViewed(finalTab)
    setActiveTabState(finalTab)
    if (typeof window !== 'undefined') {
      if (window.location.hash !== `#${finalTab}`) {
        window.location.hash = finalTab
      }
    }
  }

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace(/^#\/?/, '') as NavTab
      if (hash && hash !== activeTab) {
        setActiveTab(hash)
      }
    }
    window.addEventListener('hashchange', handleHash)
    return () => window.removeEventListener('hashchange', handleHash)
  }, [activeTab, currentUser?.department])

  const [searchQuery, setSearchQuery] = useState('')
  const [activeTool, setActiveTool] = useState<ToolType | null>(null)

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const [isMailWorkspaceOpen, setIsMailWorkspaceOpen] = useState(false)
  const [unreadMailCount, setUnreadMailCount] = useState<number>(() => mailService.getUnreadCount(userStore.getCurrentUser()))

  // Reactive state from stores
  const [leads, setLeads] = useState<Lead[]>(() => leadStore.getAll(currentUser))
  const [properties, setProperties] = useState<PortfolioItem[]>(() => portfolioStore.getAll())

  // Modal states
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [isLeadDetailOpen, setIsLeadDetailOpen] = useState(false)
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false)
  const [isAddPropertyOpen, setIsAddPropertyOpen] = useState(false)

  // Floating realtime incoming lead notification
  const [realtimeAlertLead, setRealtimeAlertLead] = useState<Lead | null>(null)

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

  // Listen for realtime new incoming leads
  useEffect(() => {
    const handleNewLeadEvent = (e: any) => {
      const incoming = e.detail as Lead
      if (incoming) {
        setRealtimeAlertLead(incoming)
        // Auto-dismiss alert after 8 seconds
        setTimeout(() => {
          setRealtimeAlertLead((prev) => (prev?.id === incoming.id ? null : prev))
        }, 8000)
      }
    }
    window.addEventListener('demirturk:new-lead', handleNewLeadEvent)
    return () => window.removeEventListener('demirturk:new-lead', handleNewLeadEvent)
  }, [])

  // Subscriptions to stores & initial theme sync
  useEffect(() => {
    try {
      const savedAccent = localStorage.getItem('demirturk_theme_accent')
      if (savedAccent && savedAccent !== 'gold') {
        document.documentElement.setAttribute('data-theme-accent', savedAccent)
      }
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
    if (!userStore.hasAdmin()) {
      setIsLoginModalOpen(true)
    }
  }, [])

  // Auto-redirect if activeTab is not in current department's 6 pages (except contacts dock item)
  useEffect(() => {
    if (!currentUser) return
    const activeDept: Department = currentUser.department || 'Pazarlama'
    const allowedPages = DEPARTMENT_MENU_CONFIG[activeDept] || []
    const isAllowed =
      activeTab === 'contacts' || allowedPages.some((p) => p.id === activeTab)

    if (!isAllowed) {
      const targetDept = getDepartmentForPage(activeTab as NavPageId)
      const canSwitch =
        targetDept &&
        (currentUser.role === 'ADMIN' ||
          (currentUser.isManager && currentUser.departments?.includes(targetDept)))

      if (canSwitch && targetDept) {
        userStore.switchDepartment(targetDept)
      } else {
        setActiveTab('dashboard')
      }
    }
  }, [currentUser?.department, activeTab])

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
    setSelectedLead(lead)
    setIsLeadDetailOpen(true)
  }

  const handleStageChange = (leadId: string, newStage: LeadStage) => {
    leadStore.updateStage(leadId, newStage, currentUser)
  }

  const handlePropertyStatusChange = (id: string, status: PropertyStatus) => {
    portfolioStore.updateStatus(id, status)
  }

  // Not logged in: Show dedicated modern Sign In & Sign Up screen
  if (!currentUser) {
    return (
      <AuthScreen
        onLoginSuccess={(user) => {
          setCurrentUser(user)
          setIsLoginModalOpen(false)
        }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-[#383830] text-[#f3efe9] relative selection:bg-[#b99881]/30 selection:text-[#f3efe9] pb-24 font-sans overflow-x-hidden">
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
          transition: 'width 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className="px-3 sm:px-6 lg:px-10 2xl:px-14 pt-3 sm:pt-6 pb-24 sm:pb-28 relative z-10 overflow-x-clip"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
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
              <PortfolioView
                leads={filteredLeads}
                properties={properties}
                onSelectLead={handleSelectLead}
                onStageChange={handleStageChange}
                onOpenAddLead={() => setIsAddLeadOpen(true)}
                onPropertyStatusChange={handlePropertyStatusChange}
                onOpenAddProperty={() => setIsAddPropertyOpen(true)}
                searchQuery={searchQuery}
              />
            )}
            {activeTab === 'marketing-campaigns' && <MarketingCampaignsView />}
            {activeTab === 'marketing-reports' && <MarketingReportsView leads={filteredLeads} />}

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
              <AppointmentsView
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

            {/* YÖNETİM SAYFALARI */}
            {activeTab === 'team-permissions' && <TeamPermissionsView />}
            {activeTab === 'executive-reports' && <ExecutiveReportsView leads={filteredLeads} />}
            {activeTab === 'approvals' && <ApprovalsView />}

            {/* 5. Sayfa: Paylaşılanlar (Tüm Departmanlarda Daima 5. Sayfa) */}
            {activeTab === 'shared' && <SharedFilesView />}

            {/* 6. Sayfa: Projeler (Tüm Departmanlarda Daima 6. Sayfa) */}
            {activeTab === 'projects' && (
              <ProjectsView onNavigateToPortfolio={() => setActiveTab('portfolio')} />
            )}

            {/* Dock / Başlat Menüsü: Kişiler */}
            {activeTab === 'contacts' && <ContactsView />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Modals */}
      <LeadDetailModal
        lead={selectedLead}
        isOpen={isLeadDetailOpen}
        onClose={() => setIsLeadDetailOpen(false)}
        onStageChange={handleStageChange}
      />

      <LeadAddModal
        isOpen={isAddLeadOpen}
        onClose={() => setIsAddLeadOpen(false)}
        onAdd={(newLead) => {
          leadStore.add(newLead)
          setLeads(leadStore.getAll(userStore.getCurrentUser()))
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
          userStore.logout()
          setCurrentUser(null)
        }}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        currentUser={currentUser}
      />

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

      {/* Realtime New Lead Floating Alert Banner */}
      <AnimatePresence>
        {realtimeAlertLead && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 22, stiffness: 320 }}
            className="fixed top-20 right-6 z-[99999] max-w-md w-full bg-[#1c1917]/95 border border-[#b99881] rounded-[24px] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.85)] backdrop-blur-2xl flex items-center justify-between gap-3 text-white"
          >
            <div className="flex items-center gap-3 truncate mr-1">
              <div className="w-10 h-10 rounded-full bg-[#b99881]/20 border border-[#b99881]/50 flex items-center justify-center shrink-0">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-[#b99881]"></span>
                </span>
              </div>
              <div className="truncate">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#b99881]">
                    Yeni Müşteri Düştü
                  </span>
                  <span className="text-[10px] text-[#a69f99]">Canlı</span>
                </div>
                <h4 className="font-bold text-sm text-white truncate max-w-[210px]">
                  {realtimeAlertLead.fullName}
                </h4>
                <p className="text-xs text-[#a69f99] font-mono truncate max-w-[220px]">
                  {formatPhoneNumber(realtimeAlertLead.phone)} • {realtimeAlertLead.formName || 'Meta Ads Formu'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  handleSelectLead(realtimeAlertLead)
                  setRealtimeAlertLead(null)
                }}
                className="px-3.5 py-1.5 rounded-full text-xs font-bold text-[#1c1917] bg-[#b99881] hover:bg-[#c9a891] transition-all cursor-pointer shadow-md shadow-[#b99881]/20"
              >
                İncele
              </button>
              <button
                type="button"
                onClick={() => setRealtimeAlertLead(null)}
                className="p-1 rounded-full text-[#8c857f] hover:text-white transition-colors cursor-pointer"
                title="Kapat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
