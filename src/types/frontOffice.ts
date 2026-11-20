import type { DepartmentPageConfig } from './department'

export const FRONT_OFFICE_MENU: DepartmentPageConfig[] = [
  { id: 'dashboard', label: 'Başlangıç' },
  { id: 'office-visitors', label: 'Gelen Müşteriler' },
  { id: 'office-contracts', label: 'Sözleşmeler' },
  { id: 'teams', label: 'Ekipler' },
  { id: 'shared', label: 'Paylaşılanlar' },
  { id: 'projects', label: 'Projeler' },
  { id: 'property-listings', label: 'Portföyler' },
]
export type OfficeKind = 'visitors' | 'contracts'
export const VISITOR_SOURCE_OPTIONS = ['Sosyal medya', 'Hepsiemlak', 'Sahibinden'] as const
export const VISITOR_POTENTIAL_OPTIONS = [
  { value: 'green', label: 'Yeşil — Yüksek potansiyel' },
  { value: 'yellow', label: 'Sarı — Orta potansiyel' },
  { value: 'red', label: 'Kırmızı — Düşük potansiyel' },
] as const
export type VisitorPotential = typeof VISITOR_POTENTIAL_OPTIONS[number]['value']

export interface OfficePayload {
  name: string
  phone: string
  status: string
  notes: string
  visitedAt?: string
  potential?: VisitorPotential | ''
  purpose?: string
  staffId?: string
  representativeId?: string
  staffIds?: string[]
  representativeIds?: string[]
  source?: typeof VISITOR_SOURCE_OPTIONS[number] | ''
  title?: string
  contractNumber?: string
  beneficiary?: string
  identityNo?: string
  address?: string
  property?: string
  amount?: string
  body?: string
  visitorId?: string
}
export interface OfficeRecord {
  id: string
  kind: OfficeKind
  payload: OfficePayload
  revision: number
  updated_at: string
}
export interface OfficeContext {
  canAccess: boolean
  isAdmin: boolean
  visitorPotentialColors?: boolean
  visitorDetails?: boolean
  assignments: string[]
  consultants: { id: string; name: string; department?: string }[]
  representatives: { id: string; name: string; department?: string }[]
}

export function officePersonIds(payload: OfficePayload, kind: 'staff' | 'representative'): string[] {
  return payload[`${kind}Ids`] ?? (payload[`${kind}Id`] ? [payload[`${kind}Id`]!] : [])
}

export function sortOfficePeople(people: OfficeContext['consultants'], firstDepartment: string) {
  const collator = new Intl.Collator('tr', { sensitivity: 'base', numeric: true })
  return [...people].sort((a, b) => Number(b.department === firstDepartment) - Number(a.department === firstDepartment)
    || collator.compare(a.department || '', b.department || '') || collator.compare(a.name, b.name) || a.id.localeCompare(b.id))
}
