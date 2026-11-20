import { CANONICAL_DEPARTMENTS } from './department'

const staffDepartmentLabels: Partial<Record<string, string>> = {
  murat: 'Yönetici',
  berkant: 'Pazarlama',
  ozlem: 'Muhasebe',
  hazal: 'Satış',
  levent: 'Satış',
  ertugrul: 'Satış',
  nazli: 'Müşteri İlişkileri',
  tugce: 'Müşteri İlişkileri',
  melisa: 'Müşteri İlişkileri',
  tugba: 'Ön Ofis',
}

/** Teknik/sistem hesapları: yalnızca adminlere, en altta ve "Sistem" kategorisinde gösterilir. */
const SYSTEM_USERNAMES = new Set(['staging-meta-admin'])
export const SYSTEM_CATEGORY_LABEL = 'Sistem'
export function isSystemAccount(member: { username?: string }): boolean {
  return !!member.username && SYSTEM_USERNAMES.has(member.username)
}

export function teamDepartmentLabel(member: { username: string; department: string }): string {
  if (isSystemAccount(member)) return SYSTEM_CATEGORY_LABEL
  return staffDepartmentLabels[member.username] ?? member.department
}

/**
 * Başkalarına gösterilecek departman. Yetkiler değişmez; yalnızca görünen etiket.
 * Adminler gerçek departmanı görür, diğerleri ekip rehberindeki etiketi (ör. Berkant → Pazarlama).
 */
export function visibleDepartment(
  member: { username?: string; department: string },
  viewer?: { role?: string } | null,
): string {
  if (isSystemAccount(member)) return SYSTEM_CATEGORY_LABEL
  if (viewer?.role === 'ADMIN' || !member.username) return member.department
  return teamDepartmentLabel({ username: member.username, department: member.department })
}

/** Adminlerin yetkili alanları tek tek departmanlar yerine "Yönetim" olarak gösterilir. */
export function visibleAuthorizedDepartments(member: { username?: string; role?: string; department: string; departments?: string[] }): string[] {
  if (isSystemAccount(member)) return [SYSTEM_CATEGORY_LABEL]
  if (member.role === 'ADMIN') return ['Yönetim']
  return member.departments?.length ? member.departments : [member.department]
}

export function isTeamDirectoryMember(member: { username: string }): boolean {
  return !isSystemAccount(member)
}

export function compareTeamMembers(a: { username: string; department: string; fullName: string }, b: { username: string; department: string; fullName: string }): number {
  const rank = (member: typeof a) => {
    const label = teamDepartmentLabel(member)
    const index = CANONICAL_DEPARTMENTS.findIndex(department => department === (label === 'Yönetici' ? 'Yönetim' : label))
    return index < 0 ? CANONICAL_DEPARTMENTS.length : index
  }
  return rank(a) - rank(b) || a.fullName.localeCompare(b.fullName, 'tr')
}
