import { DateRange, PresetKey } from '@/components/ui/DateRangePicker'

const STORAGE_KEY = 'demirturk_crm_date_filter_v2'

interface SavedDateFilter {
  presetKey: PresetKey
  customStartDate: string | null
  customEndDate: string | null
  presetLabel?: string
  savedDayString: string // e.g. "2026-10-03" to detect midnight crossover
}

function getLocalDayString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Computes exact start and end Date objects for a given preset relative to "now".
 * For presets like TODAY, LAST_7_DAYS, THIS_MONTH, it dynamically calculates
 * based on the current local calendar day.
 */
export function computeRangeForPreset(
  preset: PresetKey,
  customStart?: Date | null,
  customEnd?: Date | null
): DateRange {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

  if (preset === 'TODAY') {
    return {
      startDate: today,
      endDate: todayEnd,
      presetKey: 'TODAY',
      presetLabel: 'Bugün',
    }
  }

  if (preset === 'LAST_7_DAYS') {
    const start = new Date(today)
    start.setDate(today.getDate() - 6)
    return {
      startDate: start,
      endDate: todayEnd,
      presetKey: 'LAST_7_DAYS',
      presetLabel: 'Son 1 Hafta',
    }
  }

  if (preset === 'LAST_14_DAYS') {
    const start = new Date(today)
    start.setDate(today.getDate() - 13)
    return {
      startDate: start,
      endDate: todayEnd,
      presetKey: 'LAST_14_DAYS',
      presetLabel: 'Son 2 Hafta',
    }
  }

  if (preset === 'LAST_30_DAYS') {
    const start = new Date(today)
    start.setDate(today.getDate() - 29)
    return {
      startDate: start,
      endDate: todayEnd,
      presetKey: 'LAST_30_DAYS',
      presetLabel: 'Son 1 Ay',
    }
  }

  if (preset === 'THIS_MONTH') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0)
    return {
      startDate: start,
      endDate: todayEnd,
      presetKey: 'THIS_MONTH',
      presetLabel: 'Bu Ay',
    }
  }

  if (preset === 'CUSTOM') {
    return {
      startDate: customStart || null,
      endDate: customEnd || null,
      presetKey: 'CUSTOM',
      presetLabel: 'Özel Aralık',
    }
  }

  // ALL (Tüm Zamanlar)
  return {
    startDate: null,
    endDate: null,
    presetKey: 'ALL',
    presetLabel: 'Tümü',
  }
}

/**
 * Loads the saved date range from localStorage.
 * If the saved filter was a dynamic preset (e.g. TODAY), it automatically adapts
 * to the CURRENT day ("uygulama kapansa bile :: sadece hazır tarihler o güne uyarlanır").
 */
export function loadSavedDateRange(): DateRange {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return computeRangeForPreset('ALL')
    }

    const saved: SavedDateFilter = JSON.parse(raw)
    const customStart = saved.customStartDate ? new Date(saved.customStartDate) : null
    const customEnd = saved.customEndDate ? new Date(saved.customEndDate) : null

    // For CUSTOM dates: keep the exact selected dates intact
    if (saved.presetKey === 'CUSTOM') {
      return {
        startDate: customStart,
        endDate: customEnd,
        presetKey: 'CUSTOM',
        presetLabel: saved.presetLabel || 'Özel Aralık',
      }
    }

    // For ALL: keep ALL
    if (saved.presetKey === 'ALL') {
      return computeRangeForPreset('ALL')
    }

    // For presets (TODAY, LAST_7_DAYS, THIS_MONTH, etc.): dynamically compute relative to today!
    return computeRangeForPreset(saved.presetKey, customStart, customEnd)
  } catch (e) {
    console.error('Error loading saved date range:', e)
    return computeRangeForPreset('ALL')
  }
}

/**
 * Persists the user's date range to localStorage.
 */
export function saveDateRange(range: DateRange) {
  try {
    const now = new Date()
    const data: SavedDateFilter = {
      presetKey: range.presetKey || (range.startDate ? 'CUSTOM' : 'ALL'),
      customStartDate: range.startDate ? range.startDate.toISOString() : null,
      customEndDate: range.endDate ? range.endDate.toISOString() : null,
      presetLabel: range.presetLabel,
      savedDayString: getLocalDayString(now),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    console.error('Failed to save date range:', e)
  }
}

/**
 * Checks if midnight has passed. If so and a preset (like TODAY) is active,
 * returns the newly adapted DateRange. Otherwise returns null.
 */
export function checkDayRollover(currentRange: DateRange): DateRange | null {
  if (!currentRange.presetKey || currentRange.presetKey === 'ALL' || currentRange.presetKey === 'CUSTOM') {
    return null
  }

  const now = new Date()
  const todayStr = getLocalDayString(now)
  
  if (currentRange.startDate) {
    const rangeStartStr = getLocalDayString(new Date(currentRange.startDate))
    if (currentRange.presetKey === 'TODAY' && rangeStartStr !== todayStr) {
      // Day has changed! Adapt to new day
      return computeRangeForPreset('TODAY')
    }
  }

  return null
}
