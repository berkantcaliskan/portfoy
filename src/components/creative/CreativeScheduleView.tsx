import { createPortal } from 'react-dom'
import React, { useState, useEffect, useMemo } from 'react'
import {
  Calendar as CalendarIcon,
  Plus,
  Flag,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Search,
  Megaphone,
  Camera,
  Layers,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  X,
} from 'lucide-react'
import {
  creativeStore,
  CreativeScheduleItem,
  ScheduleCategory,
  SchedulePrepStatus,
} from '@/services/creativeStore'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlassButton } from '@/components/ui/GlassButton'

const MONTH_NAMES_TR = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
]

const WEEKDAYS_TR = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

const CATEGORY_CONFIG: Record<
  ScheduleCategory,
  {
    label: string
    badgeClass: string
    dotColor: string
    icon: React.ComponentType<{ className?: string }>
  }
> = {
  RESMI_BAYRAM: {
    label: 'Resmi Bayram',
    badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    dotColor: '#f43f5e',
    icon: Flag,
  },
  OZEL_GUN: {
    label: 'Özel Gün',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    dotColor: '#f59e0b',
    icon: Sparkles,
  },
  KAMPANYA: {
    label: 'Kampanya & Lansman',
    badgeClass: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    dotColor: '#0ea5e9',
    icon: Megaphone,
  },
  CEKIM: {
    label: 'Prodüksiyon / Çekim',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    dotColor: '#10b981',
    icon: Camera,
  },
  ICERIK: {
    label: 'Düzenli İçerik',
    badgeClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    dotColor: '#3b82f6',
    icon: Layers,
  },
}

const STATUS_CONFIG: Record<
  SchedulePrepStatus,
  { label: string; badgeClass: string }
> = {
  PLANLANDI: {
    label: 'Planlandı',
    badgeClass: 'bg-[#34302d] text-[#d6beae] border-[#4a443f]',
  },
  TASARIMDA: {
    label: 'Tasarımda',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  },
  ONAY_BEKLIYOR: {
    label: 'Onay Bekliyor',
    badgeClass: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  },
  HAZIR: {
    label: 'Yayına Hazır',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  },
  YAYINLANDI: {
    label: 'Yayınlandı',
    badgeClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  },
}

function getTodayIso(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const CreativeScheduleView: React.FC = () => {
  const [items, setItems] = useState<(CreativeScheduleItem & { daysLeft: number })[]>(() =>
    creativeStore.getSchedule()
  )
  // İlk görünüm Takvim Görünümü ('calendar')
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | ScheduleCategory>('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  // Takvim ay/yıl durumu
  const todayIso = useMemo(() => getTodayIso(), [])
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  // Güne tıklandığında açılan gün detay modalı
  const [selectedDayIso, setSelectedDayIso] = useState<string | null>(null)

  // Yeni Plan Ekleme Modalı
  const [showAddModal, setShowAddModal] = useState(false)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [category, setCategory] = useState<ScheduleCategory>('OZEL_GUN')
  const [status, setStatus] = useState<SchedulePrepStatus>('PLANLANDI')
  const [project, setProject] = useState('Kurumsal • Tüm Projeler')
  const [assignedTo, setAssignedTo] = useState('Kreatif Ekip')
  const [channelsText, setChannelsText] = useState('Instagram, Story, Meta Ads')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    const sync = () => setItems(creativeStore.getSchedule())
    return creativeStore.subscribe(sync)
  }, [])

  // Takvim görünümündeyken sayfa aşağı kaydırmasını tamamen kapat
  useEffect(() => {
    if (viewMode === 'calendar') {
      const prevOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prevOverflow
      }
    }
  }, [viewMode])

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchTitle = item.title.toLowerCase().includes(q)
        const matchProject = item.project.toLowerCase().includes(q)
        const matchNotes = item.notes.toLowerCase().includes(q)
        if (!matchTitle && !matchProject && !matchNotes) return false
      }
      return true
    })
  }, [items, categoryFilter, searchQuery])

  // Ay bilgileri ve 7 sütunlu takvim hücreleri
  const year = currentMonthDate.getFullYear()
  const month = currentMonthDate.getMonth()

  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1)
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const startOffset = (firstDayOfMonth.getDay() + 6) % 7 // Pazartesi = 0

    const cells: Array<{
      dateIso: string | null
      dayNumber: number | null
    }> = []

    for (let i = 0; i < startOffset; i++) {
      cells.push({ dateIso: null, dayNumber: null })
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      cells.push({ dateIso: iso, dayNumber: d })
    }

    while (cells.length % 7 !== 0) {
      cells.push({ dateIso: null, dayNumber: null })
    }

    return cells
  }, [year, month])

  const numWeekRows = Math.max(5, Math.ceil(calendarDays.length / 7))

  // Tarihe göre gruplanmış kayıtlar (Yıllık özel günler her yıl aynı ay-günde de eşleşebilir)
  const itemsByDate = useMemo(() => {
    const map: Record<string, (CreativeScheduleItem & { daysLeft: number })[]> = {}
    for (const item of filteredItems) {
      if (!map[item.date]) map[item.date] = []
      map[item.date].push(item)

      // Yıllık özel gün ise ve farklı bir yıla bakılıyorsa o yılın aynı ay/gününde de göster
      if (item.isAnnualSpecialDay) {
        const parts = item.date.split('-')
        if (parts.length === 3) {
          const altIso = `${year}-${parts[1]}-${parts[2]}`
          if (altIso !== item.date) {
            if (!map[altIso]) map[altIso] = []
            if (!map[altIso].some((x) => x.id === item.id)) {
              map[altIso].push(item)
            }
          }
        }
      }
    }
    return map
  }, [filteredItems, year])

  const selectedDayItems = useMemo(() => {
    if (!selectedDayIso) return []
    return itemsByDate[selectedDayIso] || []
  }, [selectedDayIso, itemsByDate])

  const handlePrevMonth = () => {
    setCurrentMonthDate(new Date(year, month - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonthDate(new Date(year, month + 1, 1))
  }

  const handleJumpToday = () => {
    const now = new Date()
    setCurrentMonthDate(new Date(now.getFullYear(), now.getMonth(), 1))
  }

  const openAddModalForDate = (targetDateIso?: string) => {
    setDate(targetDateIso || selectedDayIso || todayIso)
    setShowAddModal(true)
  }

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !date) return

    const channels = channelsText
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean)

    creativeStore.addScheduleItem({
      title: title.trim(),
      date,
      category,
      status,
      project: project.trim() || 'Kurumsal',
      assignedTo: assignedTo.trim() || 'Kreatif Ekip',
      channels: channels.length > 0 ? channels : ['Instagram'],
      notes: notes.trim(),
      isAnnualSpecialDay: category === 'RESMI_BAYRAM' || category === 'OZEL_GUN',
    })

    setTitle('')
    setNotes('')
    setShowAddModal(false)
  }

  const upcomingCount = items.filter((i) => i.daysLeft >= 0 && i.daysLeft <= 45).length
  const inDesignCount = items.filter(
    (i) => i.status === 'TASARIMDA' || i.status === 'ONAY_BEKLIYOR'
  ).length
  const readyCount = items.filter(
    (i) => i.status === 'HAZIR' || i.status === 'YAYINLANDI'
  ).length

  const formatSelectedDayLabel = (iso: string) => {
    const d = new Date(iso + 'T12:00:00')
    return d.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      weekday: 'long',
    })
  }

  return (
    <div
      className={
        viewMode === 'calendar'
          ? 'h-[calc(100vh-92px)] overflow-hidden flex flex-col gap-2.5 select-none'
          : 'space-y-4 pb-6'
      }
    >
      {/* ÜST BAŞLIK & GÖRÜNÜM SEÇİCİ BAR */}
      <div className="shrink-0 flex flex-col xl:flex-row xl:items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <div>
            <div className="flex items-center gap-2.5">
              <CalendarIcon className="w-5 h-5 text-[#b99881]" />
              <h2 className="text-2xl font-bold text-white tracking-wide leading-tight">
                Çizelge
              </h2>
            </div>
            <p className="text-xs text-[#a69f99] mt-0.5 hidden sm:block">
              {viewMode === 'calendar'
                ? 'Detayları görmek veya işlem yapmak için takvimde ilgili güne tıklayın'
                : 'Resmi bayramlar, anma günleri ve kampanya hazırlık listesi'}
            </p>
          </div>

          {/* Takvim Görünümündeyken Ay Navigasyonu */}
          {viewMode === 'calendar' && (
            <div className="flex items-center gap-1.5 pl-0 sm:pl-2">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-full border border-[#4a443f] text-[#a69f99] hover:text-white cursor-pointer transition-colors"
                title="Önceki Ay"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs sm:text-sm font-bold text-white min-w-[120px] text-center whitespace-nowrap">
                {MONTH_NAMES_TR[month]} {year}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-full border border-[#4a443f] text-[#a69f99] hover:text-white cursor-pointer transition-colors"
                title="Sonraki Ay"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleJumpToday}
                className="px-3 py-1 rounded-full text-[11px] font-bold bg-[#b99881] text-white border border-[#b99881] cursor-pointer transition-colors shadow-xs"
              >
                Bugün
              </button>
            </div>
          )}
        </div>

        {/* Sağ: Kategori Filtreleri + Takvim/Liste Görünüm Değiştirici + Yeni Ekle */}
        <div className="flex flex-wrap items-center gap-2 justify-between xl:justify-end">
          {/* Hızlı Kategori Hapları (Takvim görünümünde doğrudan üst barda, her biri kendi pill-shaped katmanıyla) */}
          {viewMode === 'calendar' && (
            <div className="hidden 2xl:flex items-center gap-1.5">
              {(
                [
                  { id: 'ALL', label: 'Tümü' },
                  { id: 'RESMI_BAYRAM', label: 'Resmi Bayram' },
                  { id: 'OZEL_GUN', label: 'Özel Gün' },
                  { id: 'KAMPANYA', label: 'Kampanya' },
                  { id: 'CEKIM', label: 'Çekim' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCategoryFilter(tab.id)}
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors cursor-pointer border ${
                    categoryFilter === tab.id
                      ? 'bg-[#b99881] text-white border-[#b99881] font-bold shadow-xs'
                      : 'bg-[#34302d] text-[#a69f99] border-[#4a443f] hover:text-white hover:border-[#b99881]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1.5">
            {/* Görünüm Seçici: Takvim (Varsayılan) | Liste (Dış katmansız, kendi pill-shaped katmanlarıyla) */}
            <div className="inline-flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setViewMode('calendar')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer border ${
                  viewMode === 'calendar'
                    ? 'bg-[#b99881] text-white border-[#b99881] shadow-sm'
                    : 'bg-[#34302d] text-[#a69f99] border-[#4a443f] hover:text-white hover:border-[#b99881]'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Takvim Görünümü</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer border ${
                  viewMode === 'list'
                    ? 'bg-[#b99881] text-white border-[#b99881] shadow-sm'
                    : 'bg-[#34302d] text-[#a69f99] border-[#4a443f] hover:text-white hover:border-[#b99881]'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Liste Görünümü</span>
              </button>
            </div>

            <GlassButton
              type="button"
              variant="gold"
              size="sm"
              onClick={() => openAddModalForDate()}
              className="rounded-full px-3.5 py-1.5 text-xs font-bold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Yeni Plan Ekle</span>
            </GlassButton>
          </div>
        </div>
      </div>

      {/* =====================================================================
          1. TAKVİM GÖRÜNÜMÜ (EKRANA YAYILMIŞ, AŞAĞI KAYDIRMASIZ, GÜNE TIKLAMALI)
          ===================================================================== */}
      {viewMode === 'calendar' && (
        <div className="flex-1 min-h-0 p-3 sm:p-4 rounded-[22px] bg-[#282522] border border-[#4a443f] glass-card-static flex flex-col overflow-hidden">
          {/* Haftanın Günleri Başlığı */}
          <div className="grid grid-cols-7 gap-1.5 text-center pb-2 shrink-0">
            {WEEKDAYS_TR.map((wd) => (
              <div
                key={wd}
                className="text-[11px] font-bold text-[#8c857f] uppercase tracking-wider py-0.5"
              >
                {wd}
              </div>
            ))}
          </div>

          {/* Tam Ekrana Yayılmış Gün Hücreleri (Aşağı Kaydırma Yok) */}
          <div
            className="grid grid-cols-7 gap-1.5 flex-1 min-h-0"
            style={{
              gridTemplateRows: `repeat(${numWeekRows}, minmax(0, 1fr))`,
            }}
          >
            {calendarDays.map((cell, idx) => {
              if (!cell.dateIso || !cell.dayNumber) {
                return (
                  <div
                    key={`empty-${idx}`}
                    className="rounded-2xl bg-[#34302d]/35 border border-transparent"
                  />
                )
              }

              const dayItems = itemsByDate[cell.dateIso] || []
              const isToday = cell.dateIso === todayIso
              const isSelected = selectedDayIso === cell.dateIso

              return (
                <div
                  key={cell.dateIso}
                  onClick={() => setSelectedDayIso(cell.dateIso)}
                  className={`calendar-day-cell p-2 sm:p-2.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between overflow-hidden ${
                    isSelected || isToday
                      ? 'calendar-today-cell bg-[#b99881] text-white border-[#b99881] shadow-sm'
                      : dayItems.length > 0
                      ? 'bg-[#34302d]/80 border-[#4a443f] hover:border-[#b99881] text-white'
                      : 'bg-transparent border-[#4a443f]/60 hover:border-[#b99881] text-white'
                  }`}
                >
                  {/* Üst Satır: Gün Numarası & Kayıt Sayısı */}
                  <div className="flex items-center justify-between gap-1 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-xs sm:text-sm font-bold leading-none font-mono ${
                          isSelected || isToday ? 'text-white' : 'text-white'
                        }`}
                      >
                        {cell.dayNumber}
                      </span>
                      {isToday && (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                            isSelected || isToday
                              ? 'bg-white/25 text-white'
                              : 'bg-[#b99881]/20 text-[#b99881]'
                          }`}
                        >
                          Bugün
                        </span>
                      )}
                    </div>

                    {dayItems.length > 0 && (
                      <span
                        className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full leading-none ${
                          isSelected || isToday
                            ? 'bg-white/25 text-white'
                            : 'bg-[#b99881]/20 text-[#b99881]'
                        }`}
                      >
                        {dayItems.length} plan
                      </span>
                    )}
                  </div>

                  {/* Orta/Alt: Günün Etkinlik Başlıkları */}
                  <div className="space-y-1 overflow-hidden mt-1">
                    {dayItems.slice(0, 2).map((ev) => {
                      const catMeta = CATEGORY_CONFIG[ev.category]
                      return (
                        <div
                          key={ev.id}
                          className={`px-2 py-1 rounded-xl text-[10px] font-semibold truncate flex items-center gap-1.5 ${
                            isSelected || isToday
                              ? 'bg-white/20 text-white'
                              : 'bg-[#282522] text-white border border-[#4a443f]/60'
                          }`}
                        >
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{
                              backgroundColor: isSelected || isToday ? '#ffffff' : catMeta.dotColor,
                            }}
                          />
                          <span className="truncate">{ev.title}</span>
                        </div>
                      )
                    })}
                    {dayItems.length > 2 && (
                      <div
                        className={`text-[10px] font-semibold pl-1 truncate ${
                          isSelected || isToday ? 'text-white/90' : 'text-[#a69f99]'
                        }`}
                      >
                        +{dayItems.length - 2} kayıt daha
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* =====================================================================
          2. LİSTE GÖRÜNÜMÜ (MEVCUT LİSTE DÜZENİ - UYGULAMA TEMA RENKLERİYLE)
          ===================================================================== */}
      {viewMode === 'list' && (
        <>
          {/* 4 Özet KPI Kartı */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <GlassCard className="py-3 px-4 bg-[#282522] border-[#4a443f]">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[13px] font-medium text-[#d6beae] truncate">
                  Toplam Takvim Maddesi
                </span>
                <CalendarIcon className="w-4 h-4 text-[#b99881] shrink-0" />
              </div>
              <div className="text-[28px] sm:text-[32px] font-semibold text-white mt-1.5 font-mono leading-none">
                {items.length}
              </div>
              <div className="text-[11.5px] text-[#a69f99] mt-1 truncate">
                Yıllık özel gün & kampanya planı
              </div>
            </GlassCard>

            <GlassCard className="py-3 px-4 bg-[#282522] border-[#4a443f]">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[13px] font-medium text-[#d6beae] truncate">
                  Yaklaşan (45 Gün)
                </span>
                <Clock className="w-4 h-4 text-[#b99881] shrink-0" />
              </div>
              <div className="text-[28px] sm:text-[32px] font-semibold text-white mt-1.5 font-mono leading-none">
                {upcomingCount}
              </div>
              <div className="text-[11.5px] text-[#a69f99] mt-1 truncate">
                Önümüzdeki 45 gün içindeki takvim
              </div>
            </GlassCard>

            <GlassCard className="py-3 px-4 bg-[#282522] border-[#4a443f]">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[13px] font-medium text-[#d6beae] truncate">
                  Hazırlık / Tasarımda
                </span>
                <AlertCircle className="w-4 h-4 text-[#b99881] shrink-0" />
              </div>
              <div className="text-[28px] sm:text-[32px] font-semibold text-white mt-1.5 font-mono leading-none">
                {inDesignCount}
              </div>
              <div className="text-[11.5px] text-[#a69f99] mt-1 truncate">
                Üretimi veya onayı devam edenler
              </div>
            </GlassCard>

            <GlassCard className="py-3 px-4 bg-[#282522] border-[#4a443f]">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[13px] font-medium text-[#d6beae] truncate">
                  Yayına Hazır / Onaylı
                </span>
                <CheckCircle2 className="w-4 h-4 text-[#b99881] shrink-0" />
              </div>
              <div className="text-[28px] sm:text-[32px] font-semibold text-white mt-1.5 font-mono leading-none">
                {readyCount}
              </div>
              <div className="text-[11.5px] text-[#a69f99] mt-1 truncate">
                Tasarımı tamamlanan özel günler
              </div>
            </GlassCard>
          </div>

          {/* Filtre & Arama Barı (Dış katmansız, her sekme kendi pill-shaped katmanıyla) */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {(
                [
                  { id: 'ALL', label: 'Tümü' },
                  { id: 'RESMI_BAYRAM', label: 'Resmi Bayramlar' },
                  { id: 'OZEL_GUN', label: 'Özel Günler' },
                  { id: 'KAMPANYA', label: 'Kampanya & Lansman' },
                  { id: 'CEKIM', label: 'Prodüksiyon / Çekim' },
                  { id: 'ICERIK', label: 'Düzenli İçerik' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCategoryFilter(tab.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border ${
                    categoryFilter === tab.id
                      ? 'bg-[#b99881] text-white border-[#b99881] shadow-sm'
                      : 'bg-[#282522] text-[#a69f99] border-[#4a443f] hover:text-white hover:border-[#b99881]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative w-full lg:w-72">
              <Search className="w-3.5 h-3.5 text-[#8c857f] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Özel gün, proje veya not ara..."
                className="w-full pl-9 pr-3.5 py-2 rounded-full bg-[#282522] border border-[#4a443f] text-xs text-white placeholder:text-[#8c857f] focus:outline-none"
              />
            </div>
          </div>

          {/* Liste Satırları */}
          <div className="space-y-3">
            {filteredItems.map((item) => {
              const catMeta = CATEGORY_CONFIG[item.category]
              const statusMeta = STATUS_CONFIG[item.status]
              const CatIcon = catMeta.icon
              const dateObj = new Date(item.date + 'T12:00:00')
              const formattedDate = dateObj.toLocaleDateString('tr-TR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                weekday: 'long',
              })

              const isUrgent =
                item.daysLeft >= 0 &&
                item.daysLeft <= 10 &&
                item.status !== 'HAZIR' &&
                item.status !== 'YAYINLANDI'

              return (
                <GlassCard
                  key={item.id}
                  className="p-4 bg-[#282522] border-[#4a443f] flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-14 h-14 rounded-2xl bg-[#34302d] border border-[#4a443f] flex flex-col items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold uppercase text-[#b99881]">
                        {dateObj.toLocaleDateString('tr-TR', { month: 'short' })}
                      </span>
                      <span className="text-lg font-extrabold text-white leading-tight font-mono">
                        {dateObj.getDate()}
                      </span>
                    </div>

                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${catMeta.badgeClass}`}
                        >
                          <CatIcon className="w-3 h-3" />
                          {catMeta.label}
                        </span>

                        <span className="text-xs text-[#a69f99]">{formattedDate}</span>

                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                            item.daysLeft < 0
                              ? 'bg-[#34302d] text-[#a69f99] border-[#4a443f]'
                              : item.daysLeft === 0
                              ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                              : item.daysLeft <= 14
                              ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                              : 'bg-[#34302d] text-[#d6beae] border-[#4a443f]'
                          }`}
                        >
                          {item.daysLeft < 0
                            ? `${Math.abs(item.daysLeft)} gün geçti`
                            : item.daysLeft === 0
                            ? 'BUGÜN!'
                            : `${item.daysLeft} gün kaldı`}
                        </span>

                        {isUrgent && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                            Hazırlık Acil
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm sm:text-base font-bold text-white leading-snug">
                        {item.title}
                      </h3>

                      <p className="text-xs text-[#a69f99] leading-relaxed">{item.notes}</p>

                      <div className="flex items-center gap-2 flex-wrap pt-1">
                        <span className="text-[11px] text-[#8c857f]">
                          Proje: <strong className="text-white">{item.project}</strong>
                        </span>
                        <span className="text-[#8c857f]">•</span>
                        <span className="text-[11px] text-[#8c857f]">
                          Sorumlu: <strong className="text-white">{item.assignedTo}</strong>
                        </span>
                        <span className="text-[#8c857f]">•</span>
                        <div className="flex items-center gap-1 flex-wrap">
                          {item.channels.map((ch) => (
                            <span
                              key={ch}
                              className="px-2 py-0.5 rounded-full bg-[#34302d] text-[10px] font-medium text-[#d6beae]"
                            >
                              {ch}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sağ Kontroller */}
                  <div className="flex items-center gap-2.5 self-end lg:self-center shrink-0">
                    <select
                      value={item.status}
                      onChange={(e) =>
                        creativeStore.updateScheduleStatus(
                          item.id,
                          e.target.value as SchedulePrepStatus
                        )
                      }
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border bg-[#34302d] text-white focus:outline-none cursor-pointer ${statusMeta.badgeClass}`}
                    >
                      <option value="PLANLANDI">Planlandı</option>
                      <option value="TASARIMDA">Tasarımda</option>
                      <option value="ONAY_BEKLIYOR">Onay Bekliyor</option>
                      <option value="HAZIR">Yayına Hazır</option>
                      <option value="YAYINLANDI">Yayınlandı</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => creativeStore.deleteScheduleItem(item.id)}
                      title="Takvimden Sil"
                      className="p-2 rounded-full border border-[#4a443f] text-[#a69f99] hover:text-rose-400 hover:border-rose-500/40 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </GlassCard>
              )
            })}
          </div>
        </>
      )}

      {/* =====================================================================
          GÜNE TIKLANDIĞINDA AÇILAN GÜN DETAY & İŞLEM MODALI
          ===================================================================== */}
      {selectedDayIso && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[100] bg-black/65 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setSelectedDayIso(null)}
        >
          <div
            className="glass-modal w-full max-w-xl rounded-[24px] bg-[#282522] border border-[#4a443f] p-5 sm:p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#34302d] border border-[#4a443f] flex items-center justify-center shrink-0">
                  <CalendarIcon className="w-5 h-5 text-[#b99881]" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    {formatSelectedDayLabel(selectedDayIso)}
                  </h3>
                  <p className="text-xs text-[#a69f99]">
                    {selectedDayItems.length > 0
                      ? `Bu tarihte ${selectedDayItems.length} plan / özel gün kaydı bulunuyor`
                      : 'Bu tarihte henüz kayıtlı bir özel gün veya üretim planı yok'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDayIso(null)}
                className="p-1.5 rounded-full border border-[#4a443f] text-[#a69f99] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {selectedDayItems.length === 0 ? (
                <div className="py-10 text-center space-y-2.5 rounded-2xl bg-[#34302d] p-6">
                  <CalendarIcon className="w-8 h-8 text-[#b99881] mx-auto opacity-70" />
                  <div className="text-sm font-bold text-white">
                    Bu güne ait plan bulunmuyor
                  </div>
                  <p className="text-xs text-[#a69f99] max-w-xs mx-auto">
                    Aşağıdaki butonu kullanarak doğrudan seçili güne yeni bir özel gün, çekim veya kampanya planı ekleyebilirsiniz.
                  </p>
                </div>
              ) : (
                selectedDayItems.map((item) => {
                  const catMeta = CATEGORY_CONFIG[item.category]
                  const CatIcon = catMeta.icon
                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl bg-[#34302d] border border-[#4a443f] space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${catMeta.badgeClass}`}
                          >
                            <CatIcon className="w-3 h-3" />
                            {catMeta.label}
                          </span>
                          <h4 className="text-sm font-bold text-white leading-snug">
                            {item.title}
                          </h4>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <select
                            value={item.status}
                            onChange={(e) =>
                              creativeStore.updateScheduleStatus(
                                item.id,
                                e.target.value as SchedulePrepStatus
                              )
                            }
                            className="px-3 py-1 rounded-full text-xs font-semibold border border-[#4a443f] bg-[#282522] text-white focus:outline-none cursor-pointer"
                          >
                            <option value="PLANLANDI">Planlandı</option>
                            <option value="TASARIMDA">Tasarımda</option>
                            <option value="ONAY_BEKLIYOR">Onay Bekliyor</option>
                            <option value="HAZIR">Yayına Hazır</option>
                            <option value="YAYINLANDI">Yayınlandı</option>
                          </select>

                          <button
                            type="button"
                            onClick={() => creativeStore.deleteScheduleItem(item.id)}
                            title="Takvimden Sil"
                            className="p-1.5 rounded-full border border-[#4a443f] text-[#a69f99] hover:text-rose-400 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {item.notes && (
                        <p className="text-xs text-[#a69f99] leading-relaxed">{item.notes}</p>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-[#8c857f]">
                        <span>
                          Proje: <strong className="text-white">{item.project}</strong> • Sorumlu:{' '}
                          <strong className="text-white">{item.assignedTo}</strong>
                        </span>
                        <div className="flex items-center gap-1 flex-wrap">
                          {item.channels.map((ch) => (
                            <span
                              key={ch}
                              className="px-2 py-0.5 rounded-full bg-[#282522] text-[10px] font-medium text-[#d6beae]"
                            >
                              {ch}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedDayIso(null)}
                className="px-4 py-2 rounded-full text-xs font-semibold glass-button-subtle border border-[#4a443f] text-[#a69f99] hover:text-white cursor-pointer"
              >
                Kapat
              </button>

              <GlassButton
                type="button"
                variant="gold"
                size="sm"
                onClick={() => openAddModalForDate(selectedDayIso)}
                className="rounded-full px-4 py-2 text-xs font-bold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Bu Güne Yeni Plan Ekle</span>
              </GlassButton>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* =====================================================================
          YENİ ÖZEL GÜN / ÇİZELGE PLANI EKLEME MODALI
          ===================================================================== */}
      {showAddModal && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[100] bg-black/65 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="glass-modal w-full max-w-lg rounded-[24px] bg-[#282522] border border-[#4a443f] p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                Yeni Özel Gün / Çizelge Planı Ekle
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-full border border-[#4a443f] text-[#a69f99] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                  Başlık / Özel Gün Adı
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Örn: 18 Mart Çanakkale Zaferi Anma Tasarımı"
                  className="w-full px-3.5 py-2 rounded-full bg-[#1e1c1a] border border-[#4a443f] text-xs text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                    Tarih
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-full bg-[#1e1c1a] border border-[#4a443f] text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                    Kategori
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ScheduleCategory)}
                    className="w-full px-3.5 py-2 rounded-full bg-[#1e1c1a] border border-[#4a443f] text-xs text-white focus:outline-none"
                  >
                    <option value="OZEL_GUN">Özel Gün</option>
                    <option value="RESMI_BAYRAM">Resmi Bayram</option>
                    <option value="KAMPANYA">Kampanya & Lansman</option>
                    <option value="CEKIM">Prodüksiyon / Çekim</option>
                    <option value="ICERIK">Düzenli İçerik</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                    İlgili Proje
                  </label>
                  <input
                    type="text"
                    value={project}
                    onChange={(e) => setProject(e.target.value)}
                    placeholder="Kurumsal • Tüm Projeler"
                    className="w-full px-3.5 py-2 rounded-full bg-[#1e1c1a] border border-[#4a443f] text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                    Hazırlık Durumu
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as SchedulePrepStatus)}
                    className="w-full px-3.5 py-2 rounded-full bg-[#1e1c1a] border border-[#4a443f] text-xs text-white focus:outline-none"
                  >
                    <option value="PLANLANDI">Planlandı</option>
                    <option value="TASARIMDA">Tasarımda</option>
                    <option value="ONAY_BEKLIYOR">Onay Bekliyor</option>
                    <option value="HAZIR">Yayına Hazır</option>
                    <option value="YAYINLANDI">Yayınlandı</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                    Sorumlu Ekip / Kişi
                  </label>
                  <input
                    type="text"
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-full bg-[#1e1c1a] border border-[#4a443f] text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                    Mecralar (Virgülle)
                  </label>
                  <input
                    type="text"
                    value={channelsText}
                    onChange={(e) => setChannelsText(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-full bg-[#1e1c1a] border border-[#4a443f] text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                  Kreatif Hazırlık Notu
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Görsel dili, ölçü formatları ve dikkat edilecek detaylar..."
                  className="w-full px-3.5 py-2 rounded-2xl bg-[#1e1c1a] border border-[#4a443f] text-xs text-white focus:outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-full glass-button-subtle border border-[#4a443f] text-xs text-[#a69f99] hover:text-white cursor-pointer"
                >
                  Vazgeç
                </button>
                <GlassButton
                  type="submit"
                  variant="gold"
                  size="sm"
                  className="rounded-full px-5 py-2 text-xs font-bold"
                >
                  Çizelgeye Ekle
                </GlassButton>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
