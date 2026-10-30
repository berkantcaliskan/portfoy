import React, { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { Calendar as CalendarIcon, ChevronDown, ChevronLeft, ChevronRight, RotateCcw, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export type PresetKey = 'ALL' | 'TODAY' | 'LAST_7_DAYS' | 'LAST_14_DAYS' | 'LAST_30_DAYS' | 'THIS_MONTH' | 'CUSTOM'

export interface DateRange {
  startDate: Date | null
  endDate: Date | null
  presetKey?: PresetKey
  presetLabel?: string
}

export interface DateRangePickerProps {
  value: DateRange
  onChange: (range: DateRange) => void
  className?: string
  align?: 'left' | 'right'
}

const PRESETS: { id: PresetKey; label: string }[] = [
  { id: 'ALL', label: 'Tümü' },
  { id: 'TODAY', label: 'Bugün' },
  { id: 'LAST_7_DAYS', label: 'Son 1 Hafta' },
  { id: 'LAST_14_DAYS', label: 'Son 2 Hafta' },
  { id: 'LAST_30_DAYS', label: 'Son 1 Ay' },
  { id: 'THIS_MONTH', label: 'Bu Ay' },
]

const MONTH_NAMES_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
]

const WEEKDAY_NAMES_TR = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz']

const POPOVER_DESKTOP_WIDTH = 684
const MIN_VIEWPORT_LEFT = 92 // Sol menü (sidebar) üzerine binmesini engeller
const VIEWPORT_RIGHT_MARGIN = 24

function isSameDay(d1?: Date | null, d2?: Date | null): boolean {
  if (!d1 || !d2) return false
  const date1 = new Date(d1)
  const date2 = new Date(d2)
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

function isDateInRange(date: Date, start?: Date | null, end?: Date | null): boolean {
  if (!start) return false
  const dStart = new Date(start)
  const t = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const s = new Date(dStart.getFullYear(), dStart.getMonth(), dStart.getDate()).getTime()
  if (!end) return t === s
  const dEnd = new Date(end)
  const e = new Date(dEnd.getFullYear(), dEnd.getMonth(), dEnd.getDate()).getTime()
  return t >= s && t <= e
}

function formatDateDisplay(d: Date | null): string {
  if (!d) return ''
  const date = new Date(d)
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear()
  return `${day}.${month}.${year}`
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  value,
  onChange,
  className = '',
  align = 'right',
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [popoverCoords, setPopoverCoords] = useState<{ top: number; left: number }>({
    top: 0,
    left: MIN_VIEWPORT_LEFT,
  })

  const now = new Date()

  // Base view date: show the month of startDate (or current month) and previous month side-by-side
  const [viewDate, setViewDate] = useState<Date>(() => {
    if (value.startDate) {
      const d = new Date(value.startDate)
      return new Date(d.getFullYear(), d.getMonth() - 1, 1)
    }
    return new Date(now.getFullYear(), now.getMonth() - 1, 1)
  })

  const [activePreset, setActivePreset] = useState<PresetKey>(() => {
    return value.presetKey || (value.startDate ? 'CUSTOM' : 'ALL')
  })

  // Sync activePreset when value changes externally (e.g. from saved dateFilterService)
  useEffect(() => {
    if (value.presetKey) {
      setActivePreset(value.presetKey)
    } else if (value.startDate) {
      setActivePreset('CUSTOM')
    } else {
      setActivePreset('ALL')
    }
  }, [value.presetKey, value.startDate, value.endDate])

  // Popover açıldığında konumunu bir kez hesapla ve ekran/sidebar sınırlarına sabitle.
  // Tarih seçimi değiştiğinde buton genişliği değişse bile yatay konumu sabit tutar (kaymayı önler).
  useLayoutEffect(() => {
    if (!isOpen || !containerRef.current) return

    const computeInitialPosition = () => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const vw = window.innerWidth
      const effectiveWidth = Math.min(POPOVER_DESKTOP_WIDTH, vw - MIN_VIEWPORT_LEFT - VIEWPORT_RIGHT_MARGIN)

      const desiredLeft =
        align === 'right' ? rect.right - effectiveWidth : rect.left

      const maxLeft = Math.max(MIN_VIEWPORT_LEFT, vw - effectiveWidth - VIEWPORT_RIGHT_MARGIN)
      const clampedLeft = Math.max(MIN_VIEWPORT_LEFT, Math.min(desiredLeft, maxLeft))

      setPopoverCoords({
        top: Math.round(rect.bottom + 8),
        left: Math.round(clampedLeft),
      })
    }

    const updateTopOnScroll = () => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      setPopoverCoords((prev) => ({
        ...prev,
        top: Math.round(rect.bottom + 8),
      }))
    }

    computeInitialPosition()
    window.addEventListener('resize', computeInitialPosition)
    window.addEventListener('scroll', updateTopOnScroll, true)
    return () => {
      window.removeEventListener('resize', computeInitialPosition)
      window.removeEventListener('scroll', updateTopOnScroll, true)
    }
  }, [isOpen, align])

  // Outside click & escape handler
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  // Navigation handlers
  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))
  }
  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))
  }

  // Preset click handler
  const handlePresetSelect = (preset: PresetKey) => {
    setActivePreset(preset)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (preset === 'ALL') {
      onChange({ startDate: null, endDate: null, presetKey: 'ALL', presetLabel: 'Tümü' })
      setIsOpen(false)
      return
    }

    if (preset === 'TODAY') {
      const start = new Date(today)
      const end = new Date(today)
      onChange({ startDate: start, endDate: end, presetKey: 'TODAY', presetLabel: 'Bugün' })
      setViewDate(new Date(today.getFullYear(), today.getMonth() - 1, 1))
      setIsOpen(false)
      return
    }

    if (preset === 'LAST_7_DAYS') {
      const start = new Date(today)
      start.setDate(today.getDate() - 6)
      onChange({ startDate: start, endDate: today, presetKey: 'LAST_7_DAYS', presetLabel: 'Son 1 Hafta' })
      setViewDate(new Date(today.getFullYear(), today.getMonth() - 1, 1))
      setIsOpen(false)
      return
    }

    if (preset === 'LAST_14_DAYS') {
      const start = new Date(today)
      start.setDate(today.getDate() - 13)
      onChange({ startDate: start, endDate: today, presetKey: 'LAST_14_DAYS', presetLabel: 'Son 2 Hafta' })
      setViewDate(new Date(today.getFullYear(), today.getMonth() - 1, 1))
      setIsOpen(false)
      return
    }

    if (preset === 'LAST_30_DAYS') {
      const start = new Date(today)
      start.setDate(today.getDate() - 29)
      onChange({ startDate: start, endDate: today, presetKey: 'LAST_30_DAYS', presetLabel: 'Son 1 Ay' })
      setViewDate(new Date(today.getFullYear(), today.getMonth() - 1, 1))
      setIsOpen(false)
      return
    }

    if (preset === 'THIS_MONTH') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      onChange({ startDate: start, endDate: today, presetKey: 'THIS_MONTH', presetLabel: 'Bu Ay' })
      setViewDate(new Date(today.getFullYear(), today.getMonth() - 1, 1))
      setIsOpen(false)
      return
    }
  }

  /**
   * Meta-style Date Click Logic:
   * 1. If no start date: sets start = date, end = null
   * 2. If start date exists and no end date:
   *    - Clicking same date: clears selection ("aynı tarihe ikinci tık eğer aralık yoksa seçimi kaldırır")
   *    - Clicking different date: sets range [start, end]
   * 3. If range [start, end] already exists:
   *    - Clicking start: collapses to just [end, null] ("aralığı varsa diğer tarihi seçer")
   *    - Clicking end: collapses to just [start, null] ("aralığı varsa diğer tarihi seçer")
   *    - Clicking a new date: sets new start = date, end = null
   */
  const handleDateClick = (clickedDate: Date) => {
    setActivePreset('CUSTOM')
    const normalized = new Date(clickedDate.getFullYear(), clickedDate.getMonth(), clickedDate.getDate(), 0, 0, 0)
    const { startDate, endDate } = value

    // Case 1: No selection yet
    if (!startDate) {
      onChange({ startDate: normalized, endDate: null, presetKey: 'CUSTOM', presetLabel: 'Özel Aralık' })
      return
    }

    // Case 2: Only start date is selected (single day)
    if (startDate && !endDate) {
      if (isSameDay(startDate, normalized)) {
        // Same date clicked again with no range -> clears selection
        onChange({ startDate: null, endDate: null, presetKey: 'ALL', presetLabel: 'Tümü' })
      } else if (normalized.getTime() < new Date(startDate).getTime()) {
        onChange({ startDate: normalized, endDate: new Date(startDate), presetKey: 'CUSTOM', presetLabel: 'Özel Aralık' })
      } else {
        onChange({ startDate: new Date(startDate), endDate: normalized, presetKey: 'CUSTOM', presetLabel: 'Özel Aralık' })
      }
      return
    }

    // Case 3: Range [startDate, endDate] is already active
    if (startDate && endDate) {
      if (isSameDay(startDate, endDate) && isSameDay(startDate, normalized)) {
        // Single-day range clicked again -> clears selection
        onChange({ startDate: null, endDate: null, presetKey: 'ALL', presetLabel: 'Tümü' })
      } else {
        // Any date clicked while a multi-day range is active (including clicking the 2nd selected date again)
        // moves the start date to the clicked date
        onChange({ startDate: normalized, endDate: null, presetKey: 'CUSTOM', presetLabel: 'Özel Aralık' })
      }
    }
  }

  // Display label for the pill button
  const getTriggerLabel = () => {
    if (value.presetLabel && value.presetLabel !== 'Özel Aralık') {
      return value.presetLabel
    }
    if (value.startDate && value.endDate) {
      if (isSameDay(value.startDate, value.endDate)) {
        return formatDateDisplay(value.startDate)
      }
      return `${formatDateDisplay(value.startDate)} - ${formatDateDisplay(value.endDate)}`
    }
    if (value.startDate) {
      return `${formatDateDisplay(value.startDate)}`
    }
    return 'Tüm Zamanlar'
  }

  // Calendar Month Generator (Monday-first)
  const renderMonthCalendar = (year: number, month: number) => {
    const firstDayOfMonth = new Date(year, month, 1)
    const lastDayOfMonth = new Date(year, month + 1, 0)
    const totalDays = lastDayOfMonth.getDate()

    let startDayOfWeek = firstDayOfMonth.getDay() - 1
    if (startDayOfWeek === -1) startDayOfWeek = 6

    const days: (Date | null)[] = []
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null)
    }
    for (let d = 1; d <= totalDays; d++) {
      days.push(new Date(year, month, d))
    }

    return (
      <div className="w-[248px] shrink-0 select-none">
        {/* Month Title */}
        <div className="text-center font-bold text-white text-xs py-1 uppercase tracking-wide">
          {MONTH_NAMES_TR[month]} {year}
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 text-center py-1">
          {WEEKDAY_NAMES_TR.map((wd) => (
            <div key={wd} className="text-[10px] font-bold text-[#8c857f]">
              {wd}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-y-1 text-center pt-1">
          {days.map((date, idx) => {
            if (!date) {
              return <div key={`empty-${idx}`} className="h-7 w-7" />
            }

            const isStart = isSameDay(date, value.startDate)
            const isEnd = isSameDay(date, value.endDate)
            const inRange = isDateInRange(date, value.startDate, value.endDate)
            const isToday = isSameDay(date, now)
            const hasMultiDayRange = Boolean(
              value.startDate && value.endDate && !isSameDay(value.startDate, value.endDate)
            )

            return (
              <div key={date.toISOString()} className="relative h-7 flex items-center justify-center">
                {/* Meta-style connecting ribbon bar */}
                {inRange && hasMultiDayRange && (
                  <div
                    className={`absolute inset-y-0.5 bg-[#b99881]/25 ${
                      isStart
                        ? 'left-1/2 right-0 rounded-l-full'
                        : isEnd
                        ? 'left-0 right-1/2 rounded-r-full'
                        : 'left-0 right-0'
                    }`}
                  />
                )}

                {/* Day button - Seçildiğinde veya Bugün olduğunda vurgu renginde yuvarlak içinde */}
                <button
                  type="button"
                  onClick={() => handleDateClick(date)}
                  className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center text-xs transition-colors cursor-pointer ${
                    isStart || isEnd
                      ? 'bg-[#b99881] text-white font-bold shadow-sm scale-105'
                      : isToday
                      ? 'calendar-today-cell bg-[#b99881] text-white font-bold shadow-sm'
                      : inRange
                      ? 'text-white font-semibold'
                      : 'text-[#d6cec7] hover:text-white'
                  }`}
                >
                  {date.getDate()}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const month1Year = viewDate.getFullYear()
  const month1Month = viewDate.getMonth()

  const month2Date = new Date(month1Year, month1Month + 1, 1)
  const month2Year = month2Date.getFullYear()
  const month2Month = month2Date.getMonth()

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className} ${isOpen ? 'z-50' : 'z-20'}`}>
      {/* Trigger Button: Pill-shaped with dark mat luxury background */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#24211f] hover:bg-[#34302d] border border-[#4a443f] hover:border-[#b99881]/60 text-xs transition-all cursor-pointer select-none ${
          isOpen ? 'border-[#b99881] ring-1 ring-[#b99881]/30 bg-[#2e2a27]' : ''
        } ${value.startDate ? 'text-amber-200 border-[#b99881]/60' : 'text-[#d6beae]'}`}
      >
        <CalendarIcon className="w-3.5 h-3.5 text-[#b99881] shrink-0" />
        <span className="text-xs text-[#a69f99] font-medium shrink-0">Tarih:</span>
        <span className="font-semibold text-white truncate max-w-[190px]">
          {getTriggerLabel()}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[#a69f99] transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-[#b99881]' : ''
          }`}
        />
      </button>

      {/* Floating Meta-Style Date Range Picker Panel (Sabit Genişlik ve Sabit Koordinat) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'fixed',
              top: `${popoverCoords.top}px`,
              left: `${popoverCoords.left}px`,
            }}
            className="dropdown-panel popover-panel w-[684px] max-w-[calc(100vw-108px)] rounded-[24px] z-[90] bg-[#1a1715] border border-[#4a443f] shadow-[0_24px_60px_rgba(0,0,0,0.95)] p-0 overflow-hidden"
          >
            {/* Header / Content Split */}
            <div className="flex flex-col md:flex-row">
              {/* Sol Sütun: Hazır Tarihler (Katmansız, Düz ve Sade Metin) */}
              <div className="w-full md:w-36 shrink-0 py-4 px-4 flex flex-col justify-between select-none">
                <div className="space-y-2.5">
                  {PRESETS.map((p) => {
                    const isSelected = activePreset === p.id
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handlePresetSelect(p.id)}
                        className={`no-layer-btn w-full flex items-center justify-between text-xs py-1 transition-colors cursor-pointer text-left ${
                          isSelected
                            ? 'text-[#b99881] font-bold'
                            : 'text-[#a69f99] hover:text-white'
                        }`}
                      >
                        <span>{p.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#b99881] shrink-0" />}
                      </button>
                    )
                  })}
                </div>

                <div className="pt-3 mt-4 border-t border-[#4a443f]/50">
                  <button
                    type="button"
                    onClick={() => handlePresetSelect('ALL')}
                    className="no-layer-btn flex items-center gap-1.5 text-[11px] text-[#8c857f] hover:text-white transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3 text-[#b99881]" />
                    <span>Temizle</span>
                  </button>
                </div>
              </div>

              {/* Dikey İnce Ayırıcı Çizgi */}
              <div className="hidden md:block border-l border-[#4a443f]/50 my-3 shrink-0" />

              {/* Sağ Alan: İki Ay Yan Yana Takvim Görünümü */}
              <div className="flex-1 min-w-0 p-4 space-y-3">
                {/* Ay Değiştirme Butonları */}
                <div className="flex items-center justify-between px-2">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="p-1.5 rounded-full hover:bg-[#2d2926] text-[#a69f99] hover:text-white transition-colors cursor-pointer"
                    title="Önceki Ay"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="text-xs font-semibold text-[#f3efe9]">
                    Tarih Seç
                  </span>

                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="p-1.5 rounded-full hover:bg-[#2d2926] text-[#a69f99] hover:text-white transition-colors cursor-pointer"
                    title="Sonraki Ay"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* İki Ay Yan Yana */}
                <div className="flex flex-col sm:flex-row gap-5 items-start justify-center">
                  {renderMonthCalendar(month1Year, month1Month)}
                  <div className="hidden sm:block h-56 border-l border-[#4a443f]/50 shrink-0" />
                  {renderMonthCalendar(month2Year, month2Month)}
                </div>

                {/* Footer Bar */}
                <div className="flex items-center justify-between gap-2 pt-3 border-t border-[#4a443f]/50 text-xs">
                  <div className="text-[11px] text-[#a69f99] truncate min-w-0 flex-1">
                    {value.startDate && value.endDate ? (
                      <span>
                        Seçili: <strong className="text-white">{formatDateDisplay(value.startDate)}</strong> – <strong className="text-white">{formatDateDisplay(value.endDate)}</strong>
                      </span>
                    ) : value.startDate ? (
                      <span>
                        Başlangıç: <strong className="text-white">{formatDateDisplay(value.startDate)}</strong> (Bitiş gününü seçin)
                      </span>
                    ) : (
                      <span>Tüm zamanlar görüntüleniyor</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handlePresetSelect('ALL')}
                      className="px-3 py-1 rounded-full text-xs text-[#a69f99] hover:text-white bg-[#282522] border border-[#4a443f] hover:bg-[#34302d] transition-colors cursor-pointer"
                    >
                      Sıfırla
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="btn-primary px-4 py-1 rounded-full text-xs font-bold text-white bg-[#b99881] hover:bg-[#c9a891] transition-all cursor-pointer"
                    >
                      Uygula
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
