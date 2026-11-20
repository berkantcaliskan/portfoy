import type { FlatUnit } from '../services/projectStore'

interface SalesPerson { id: string; fullName: string; department: string }
export interface SalesRank { id: string; name: string; count: number; percentage: number }

export type SalesPeriod = 'WEEK' | 'MONTH'

/** Dönemin başlangıcı: haftalıkta bu haftanın pazartesisi, aylıkta ayın ilk günü (yerel saatle 00:00). */
export function salesPeriodStart(period: SalesPeriod, now = new Date()): Date {
  if (period === 'MONTH') return new Date(now.getFullYear(), now.getMonth(), 1)
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  return start
}

export function buildSalesRanking(units: Pick<FlatUnit, 'status' | 'sale'>[], people: SalesPerson[], since?: Date): SalesRank[] {
  const rows = new Map<string, SalesRank>()
  for (const person of people.filter(person => person.department === 'Satış')) {
    rows.set(person.id, { id: person.id, name: person.fullName, count: 0, percentage: 0 })
  }
  let total = 0
  const inPeriod = (soldAt?: string) => {
    if (!since) return true
    const time = soldAt ? new Date(soldAt).getTime() : NaN
    return Number.isFinite(time) && time >= since.getTime()
  }
  for (const unit of units.filter(unit => unit.status === 'SATILDI' && inPeriod(unit.sale?.soldAt))) {
    const sale = unit.sale
    const matchingPeople = people.filter(person => person.fullName === sale?.soldByUserName)
    const person = sale?.soldByUserId ? people.find(person => person.id === sale.soldByUserId)
      : matchingPeople.length === 1 ? matchingPeople[0] : undefined
    const id = person?.id || sale?.soldByUserId || (sale?.soldByUserName ? 'legacy-' + sale.soldByUserName : 'unassigned')
    const name = person?.fullName || sale?.soldByUserName || 'Danışmanı belirtilmemiş'
    const row = rows.get(id) || { id, name, count: 0, percentage: 0 }
    row.count++
    rows.set(id, row)
    total++
  }
  for (const row of rows.values()) row.percentage = total ? row.count / total * 100 : 0
  return [...rows.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'tr'))
}
