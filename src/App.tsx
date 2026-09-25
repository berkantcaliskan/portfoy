import React, { useState, useEffect } from 'react'
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
import { mailService } from '@/services/mailService'

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
import { Lead, LeadStage } from '@/types/lead'
import { PortfolioItem, PropertyStatus } from '@/types/portfolio'
import { DEPARTMENT_MENU_CONFIG, Department } from '@/types/department'

export function App() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(userStore.getCurrentUser())
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard')
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
    } catch {}

    const unsubMail = mailService.subscribe(() => {
      setUnreadMailCount(mailService.getUnreadCount(userStore.getCurrentUser()))
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
    const activeDept: Department = currentUser?.department || 'Pazarlama'
    const allowedPages = DEPARTMENT_MENU_CONFIG[activeDept] || []
    const isAllowed =
      activeTab === 'contacts' || allowedPages.some((p) => p.id === activeTab)

    if (!isAllowed) {
      setActiveTab('dashboard')
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

  return (
    <div className="min-h-screen bg-[#34302d] text-[#f3efe9] relative selection:bg-[#b99881]/30 selection:text-[#f3efe9] pb-24 font-sans">
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
      <main className="w-full px-6 lg:px-10 2xl:px-14 pt-6 relative z-10">
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
          />
        )}
        {activeTab === 'followups-appointments' && (
          <AppointmentsView
            pageTitle="Takip ve Randevular"
            subtitle="Müşteri geri arama takipleri ve satış ekibine yönlendirilen randevular."
            leads={filteredLeads}
          />
        )}
        {activeTab === 'requests' && <RequestsView />}

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
        onAdd={(newLead) => leadStore.add(newLead)}
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
    </div>
  )
}

export default App
