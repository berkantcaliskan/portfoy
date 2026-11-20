export const NOTES_PER_PAGE = 3
export const MAX_NOTE_COUNT = 360

const money = new Intl.NumberFormat('tr-TR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function parseLira(value: string): number | null {
  const [text, unit, extra] = value.trim().toLocaleLowerCase('tr-TR').split(/\s+/)
  if (extra || (unit && unit !== 'bin' && unit !== 'milyon')) return null
  const match = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/.exec(text)
    ?? /^(\d+)\.(\d{1,2})$/.exec(text)
  if (!match) return null
  const amount = Number(match[1].replaceAll('.', '')) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
  const cents = amount * (unit === 'bin' ? 1000 : unit === 'milyon' ? 1_000_000 : 1)
  return Number.isSafeInteger(cents) && cents <= 99_999_999_999_999 ? cents : null
}

export function formatLira(cents: number) {
  return money.format(cents / 100)
}

const ones = ['', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz']
const tens = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan']
const scales = ['', 'bin', 'milyon', 'milyar']

function integerInWords(value: number) {
  if (!value) return 'sıfır'
  const groups: string[] = []
  for (let scale = 0; value > 0; scale++, value = Math.floor(value / 1000)) {
    const group = value % 1000
    if (!group) continue
    if (scale === 1 && group === 1) {
      groups.unshift('bin')
      continue
    }
    const hundreds = Math.floor(group / 100)
    const words = [
      hundreds > 1 ? ones[hundreds] : '',
      hundreds > 0 ? 'yüz' : '',
      tens[Math.floor(group / 10) % 10],
      ones[group % 10],
      scales[scale],
    ]
    groups.unshift(words.filter(Boolean).join(' '))
  }
  return groups.join(' ')
}

export function liraInWords(cents: number) {
  const lira = integerInWords(Math.floor(cents / 100)) + ' Türk lirası'
  const fraction = cents % 100
  return fraction ? lira + ' ' + integerInWords(fraction) + ' kuruş' : lira
}

export function isNoteDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false
  const date = new Date(value + 'T00:00:00Z')
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function dateInputValue(date: Date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}

function installmentDate(firstDue: string, offset: number) {
  const date = new Date(firstDue + 'T00:00:00Z')
  const day = date.getUTCDate()
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() + offset + 1)
  date.setUTCDate(0)
  date.setUTCDate(Math.min(day, date.getUTCDate()))
  return date.getUTCFullYear() <= 9999 ? date.toISOString().slice(0, 10) : ''
}

export interface NoteOverride {
  amount?: string
  dueDate?: string
}

export interface NoteInstallment {
  id: string
  month: number
  number: number
  amount: string
  cents: number | null
  dueDate: string
}

export interface PaymentPeriodDraft {
  amount?: string
  months?: string
}

export function getPrepaymentTotal(payments: readonly string[]) {
  let total = 0
  for (const payment of payments) {
    if (!payment.trim()) continue
    const cents = parseLira(payment)
    if (cents === null) return null
    total += cents
    if (!Number.isSafeInteger(total)) return null
  }
  return total
}

export function getFinancedAmount(total: string, prepaid: number | null) {
  const gross = parseLira(total)
  return gross === null || prepaid === null ? null : gross - prepaid
}

function splitCents(total: number | null, terms: number, length = terms) {
  if (total === null || total < 0) return Array<null>(length).fill(null)
  const share = Math.floor(total / terms)
  const remainder = total % terms
  return Array.from({ length }, (_, index) => share + Number(index < remainder))
}

export function buildPaymentPeriods(
  total: number | null,
  count: number,
  drafts: readonly PaymentPeriodDraft[],
) {
  const amounts: (number | null)[] = []
  const periods: { amount: string; months: string; remainingMonths: number }[] = []
  let balance = total
  let invalid = false
  if (!Number.isInteger(count) || count < 1 || count > MAX_NOTE_COUNT) return { periods, amounts, invalid, balance }

  for (let remaining = count; remaining > 0;) {
    const draft = drafts[periods.length]
    const months = draft?.months ?? String(remaining)
    const duration = Number(months)
    const validDuration = /^\d+$/.test(months) && duration > 0 && duration <= remaining
    const automatic = draft?.amount === undefined
    const perMonth = automatic
      ? balance !== null && balance >= 0 ? Math.floor(balance / remaining) : null
      : parseLira(draft.amount ?? '')
    const portion = validDuration && automatic ? splitCents(balance, remaining, duration) : []
    const periodTotal = !validDuration || perMonth === null ? null
      : automatic ? portion.reduce<number>((sum, cents) => sum + (cents ?? 0), 0) : perMonth * duration
    periods.push({
      amount: draft?.amount ?? (perMonth === null ? '' : formatLira(perMonth)),
      months, remainingMonths: remaining,
    })
    if (!validDuration || periodTotal === null || !Number.isSafeInteger(periodTotal) || perMonth === null || perMonth === 0) {
      invalid = true
      break
    }
    amounts.push(...(automatic ? portion : Array<number>(duration).fill(perMonth)))
    remaining -= duration
    balance = balance === null ? null : balance - periodTotal
  }
  return { periods, amounts, invalid, balance }
}

export type InsertedInstallments = Readonly<Record<number, readonly string[]>>

export function insertInstallmentAbove(
  inserted: InsertedInstallments, id: string, before: Pick<NoteInstallment, 'id' | 'month'>,
): InsertedInstallments {
  const siblings = [...(inserted[before.month] ?? [])]
  const index = siblings.indexOf(before.id)
  siblings.splice(index === -1 ? siblings.length : index, 0, id)
  return { ...inserted, [before.month]: siblings }
}

export function buildNoteSchedule(
  total: number | null,
  count: number,
  firstDue: string,
  overrides: Readonly<Record<string, NoteOverride>>,
  options: { monthlyAmounts?: readonly (number | null)[]; inserted?: InsertedInstallments } = {},
): NoteInstallment[] {
  if (!Number.isInteger(count) || count < 1 || count > MAX_NOTE_COUNT) return []
  const monthlyAmounts = options.monthlyAmounts ?? splitCents(total, count)
  const hasFirstDue = isNoteDate(firstDue)
  const notes: NoteInstallment[] = []
  for (let month = 1; month <= count; month++) {
    const baseId = String(month)
    const date = hasFirstDue ? installmentDate(firstDue, month - 1) : ''
    const baseDate = overrides[baseId]?.dueDate ?? date
    for (const id of [...(options.inserted?.[month] ?? []), baseId]) {
      const override = overrides[id]
      const cents = override?.amount !== undefined
        ? parseLira(override.amount)
        : id === baseId ? monthlyAmounts[month - 1] ?? null : null
      notes.push({
        id, month, number: notes.length + 1, cents,
        amount: override?.amount ?? (cents === null ? '' : formatLira(cents)),
        dueDate: override?.dueDate ?? baseDate,
      })
    }
  }
  return notes
}

export function groupNotePages<T>(notes: readonly T[]): T[][] {
  const pages: T[][] = []
  for (let index = 0; index < notes.length; index += NOTES_PER_PAGE) {
    pages.push(notes.slice(index, index + NOTES_PER_PAGE))
  }
  return pages
}
