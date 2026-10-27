export type Department =
  | 'Pazarlama'
  | 'Satış'
  | 'Müşteri İlişkileri'
  | 'Muhasebe'
  | 'Yönetim'

export const CANONICAL_DEPARTMENTS: Department[] = [
  'Pazarlama',
  'Satış',
  'Müşteri İlişkileri',
  'Muhasebe',
  'Yönetim',
]

export type UserRole = 'ADMIN' | 'MANAGER' | 'SPECIALIST' | 'REPRESENTATIVE' | 'MEMBER'
export type AccessScope = 'ALL' | 'DEPARTMENT' | 'ASSIGNED_ONLY'

export interface UserPermissions {
  canPullLeads?: boolean
  canAddCustomer?: boolean
  canDeleteCustomer?: boolean
  canAssignConsultant?: boolean
  canChangeStage?: boolean
  canManageMetaConfig?: boolean
  canEditProjectPrice?: boolean
  canChangeFlatStatus?: boolean
  canApproveDiscounts?: boolean
  canRefundDeposit?: boolean
  canManageTeam?: boolean
  canReshareFiles?: boolean
}

export type NavPageId =
  | 'dashboard'
  // Pazarlama
  | 'portfolio'
  | 'marketing-campaigns'
  | 'marketing-reports'
  // Satış
  | 'crm'
  | 'appointments'
  | 'sales-performance'
  // Müşteri İlişkileri
  | 'customers'
  | 'followups-appointments'
  | 'requests'
  // Muhasebe
  | 'collections'
  | 'payments'
  | 'financial-reports'
  // Yönetim
  | 'team-permissions'
  | 'executive-reports'
  | 'approvals'
  // Ortak sabitler
  | 'teams'
  | 'shared'
  | 'projects'
  // Dock / Başlat menüsü öğeleri
  | 'contacts'

export interface DepartmentPageConfig {
  id: NavPageId
  label: string
  description?: string
}

/**
 * DEFAULT PAGES PER DEPARTMENT:
 * 1. Başlangıç (dashboard)
 * Department-specific pages
 * Ekipler (teams) -> Paylaşılanlar'dan hemen önce
 * Paylaşılanlar (shared)
 * Projeler (projects)
 */
export const DEPARTMENT_MENU_CONFIG: Record<Department, DepartmentPageConfig[]> = {
  'Pazarlama': [
    { id: 'dashboard', label: 'Başlangıç' },
    { id: 'portfolio', label: 'Müşteriler' },
    { id: 'marketing-campaigns', label: 'Kampanyalar' },
    { id: 'marketing-reports', label: 'Raporlar' },
    { id: 'teams', label: 'Ekipler' },
    { id: 'shared', label: 'Paylaşılanlar' },
    { id: 'projects', label: 'Projeler' },
  ],
  'Satış': [
    { id: 'dashboard', label: 'Başlangıç' },
    { id: 'crm', label: 'Satış' },
    { id: 'appointments', label: 'Randevular' },
    { id: 'requests', label: 'Talepler' },
    { id: 'sales-performance', label: 'Performans' },
    { id: 'teams', label: 'Ekipler' },
    { id: 'shared', label: 'Paylaşılanlar' },
    { id: 'projects', label: 'Projeler' },
  ],
  'Müşteri İlişkileri': [
    { id: 'dashboard', label: 'Başlangıç' },
    { id: 'customers', label: 'Müşteriler' },
    { id: 'followups-appointments', label: 'Takip ve Randevular' },
    { id: 'requests', label: 'Talepler' },
    { id: 'teams', label: 'Ekipler' },
    { id: 'shared', label: 'Paylaşılanlar' },
    { id: 'projects', label: 'Projeler' },
  ],
  'Muhasebe': [
    { id: 'dashboard', label: 'Başlangıç' },
    { id: 'collections', label: 'Tahsilatlar' },
    { id: 'payments', label: 'Ödemeler' },
    { id: 'financial-reports', label: 'Finansal Raporlar' },
    { id: 'teams', label: 'Ekipler' },
    { id: 'shared', label: 'Paylaşılanlar' },
    { id: 'projects', label: 'Projeler' },
  ],
  'Yönetim': [
    { id: 'dashboard', label: 'Başlangıç' },
    { id: 'team-permissions', label: 'Ekip ve Yetkiler' },
    { id: 'executive-reports', label: 'Raporlar' },
    { id: 'approvals', label: 'Onaylar' },
    { id: 'teams', label: 'Ekipler' },
    { id: 'shared', label: 'Paylaşılanlar' },
    { id: 'projects', label: 'Projeler' },
  ],
}

export function normalizeDepartmentName(dept: string): Department {
  if (!dept) return 'Yönetim'
  const clean = dept.trim().toLowerCase()
  if (clean.includes('pazarlama')) return 'Pazarlama'
  if (clean.includes('satış') || clean.includes('satis')) return 'Satış'
  if (clean.includes('ilişki') || clean.includes('iliski') || clean.includes('müşteri') || clean.includes('musteri')) {
    return 'Müşteri İlişkileri'
  }
  if (clean.includes('muhasebe') || clean.includes('finans')) return 'Muhasebe'
  if (clean.includes('yönetim') || clean.includes('yonetim') || clean.includes('operasyon')) return 'Yönetim'
  return 'Yönetim'
}

export const PAGE_TO_DEPARTMENT_MAP: Record<NavPageId, Department | 'ALL'> = {
  dashboard: 'ALL',
  teams: 'ALL',
  shared: 'ALL',
  projects: 'ALL',
  contacts: 'ALL',
  requests: 'ALL', // Ortak Talepler (Satış & Müşteri İlişkileri)

  // Pazarlama
  portfolio: 'Pazarlama',
  'marketing-campaigns': 'Pazarlama',
  'marketing-reports': 'Pazarlama',

  // Satış
  crm: 'Satış',
  appointments: 'Satış',
  'sales-performance': 'Satış',

  // Müşteri İlişkileri
  customers: 'Müşteri İlişkileri',
  'followups-appointments': 'Müşteri İlişkileri',

  // Muhasebe
  collections: 'Muhasebe',
  payments: 'Muhasebe',
  'financial-reports': 'Muhasebe',

  // Yönetim
  'team-permissions': 'Yönetim',
  'executive-reports': 'Yönetim',
  approvals: 'Yönetim',
}

export function getDepartmentForPage(pageId: NavPageId): Department | null {
  const dept = PAGE_TO_DEPARTMENT_MAP[pageId]
  if (!dept || dept === 'ALL') return null
  return dept
}

export function getPrimaryPageForDepartment(dept: Department): NavPageId {
  switch (dept) {
    case 'Pazarlama':
      return 'portfolio'
    case 'Satış':
      return 'crm'
    case 'Müşteri İlişkileri':
      return 'customers'
    case 'Muhasebe':
      return 'collections'
    case 'Yönetim':
      return 'team-permissions'
    default:
      return 'dashboard'
  }
}

