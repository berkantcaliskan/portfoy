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

export function teamDepartmentLabel(member: { username: string; department: string }): string {
  return staffDepartmentLabels[member.username] ?? member.department
}

export function isTeamDirectoryMember(member: { username: string }): boolean {
  return member.username !== 'staging-meta-admin'
}

export function compareTeamMembers(a: { username: string; department: string; fullName: string }, b: { username: string; department: string; fullName: string }): number {
  const rank = (member: typeof a) => {
    const label = teamDepartmentLabel(member)
    const index = CANONICAL_DEPARTMENTS.findIndex(department => department === (label === 'Yönetici' ? 'Yönetim' : label))
    return index < 0 ? CANONICAL_DEPARTMENTS.length : index
  }
  return rank(a) - rank(b) || a.fullName.localeCompare(b.fullName, 'tr')
}
