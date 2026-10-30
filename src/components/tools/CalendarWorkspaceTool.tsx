import React, { useState, useEffect, useMemo } from 'react'
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  Users,
  Building2,
  Lock,
  Globe,
  Sparkles,
  Edit3,
  Trash2,
  Check,
  X,
  CheckCircle2,
  Layers,
  UserCheck,
} from 'lucide-react'
import {
  calendarStore,
  CalendarEvent,
  CalendarEventCategory,
  CalendarVisibilityScope,
  CATEGORY_META,
} from '@/services/calendarStore'
import { userStore, AppUser } from '@/services/userStore'
import { CANONICAL_DEPARTMENTS, Department } from '@/types/department'
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

type ScopeFilter = 'ALL' | 'MY_DEPT' | 'INTER_DEPT' | 'COMPANY' | 'PERSONAL_GROUP' | 'AUTO_SYNCED'

export const CalendarWorkspaceTool: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => userStore.getCurrentUser())
  const [allUsers, setAllUsers] = useState<AppUser[]>(() => userStore.getAll())
  const [events, setEvents] = useState<CalendarEvent[]>(() =>
    calendarStore.getVisibleEvents(userStore.getCurrentUser())
  )

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [viewMonthDate, setViewMonthDate] = useState<Date>(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [selectedDateIso, setSelectedDateIso] = useState<string | null>(null)
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('ALL')
  const [deptFilter, setDeptFilter] = useState<Department | 'ALL'>('ALL')

  // Oluşturma / Düzenleme Modal-Panel Durumu
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)

  // Form State
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formDate, setFormDate] = useState(todayIso)
  const [formTime, setFormTime] = useState('14:00')
  const [formEndTime, setFormEndTime] = useState('15:00')
  const [formLocation, setFormLocation] = useState('')
  const [formCategory, setFormCategory] = useState<CalendarEventCategory>('DEPARTMENT_PLAN')
  const [formVisibility, setFormVisibility] = useState<CalendarVisibilityScope>('DEPARTMENT')
  const [formDepartments, setFormDepartments] = useState<Department[]>(() =>
    currentUser?.department ? [currentUser.department] : ['Satış']
  )
  const [formUserIds, setFormUserIds] = useState<string[]>([])

  useEffect(() => {
    const refresh = () => {
      const u = userStore.getCurrentUser()
      setCurrentUser(u)
      setAllUsers(userStore.getAll())
      setEvents(calendarStore.getVisibleEvents(u))
    }
    const unsubCal = calendarStore.subscribe(refresh)
    const unsubUsr = userStore.subscribe(refresh)
    return () => {
      unsubCal()
      unsubUsr()
    }
  }, [])

  const year = viewMonthDate.getFullYear()
  const month = viewMonthDate.getMonth()

  const handlePrevMonth = () => {
    setViewMonthDate(new Date(year, month - 1, 1))
  }

  const handleNextMonth = () => {
    setViewMonthDate(new Date(year, month + 1, 1))
  }

  const handleJumpToday = () => {
    const now = new Date()
    setViewMonthDate(new Date(now.getFullYear(), now.getMonth(), 1))
    setSelectedDateIso(todayIso)
  }

  // Yeni Plan Ekleme Formunu Aç
  const handleOpenNewForm = (presetDate?: string) => {
    const defaultDept: Department = currentUser?.department || 'Satış'
    setEditingEvent(null)
    setFormTitle('')
    setFormDescription('')
    setFormDate(presetDate || selectedDateIso || todayIso)
    setFormTime('14:00')
    setFormEndTime('15:00')
    setFormLocation('')
    setFormCategory('DEPARTMENT_PLAN')
    setFormVisibility('DEPARTMENT')
    setFormDepartments([defaultDept])
    setFormUserIds(currentUser ? [currentUser.id] : [])
    setIsFormOpen(true)
  }

  // Mevcut Planı veya Otomatik Kaydı Düzenleme Formunu Aç
  const handleOpenEditForm = (ev: CalendarEvent) => {
    setEditingEvent(ev)
    setFormTitle(ev.title)
    setFormDescription(ev.description || '')
    setFormDate(ev.date)
    setFormTime(ev.time || '14:00')
    setFormEndTime(ev.endTime || '')
    setFormLocation(ev.location || '')
    setFormCategory(ev.category)
    setFormVisibility(ev.visibilityScope)
    setFormDepartments(
      ev.sharedDepartments && ev.sharedDepartments.length > 0
        ? [...ev.sharedDepartments]
        : [currentUser?.department || 'Satış']
    )
    setFormUserIds(
      ev.sharedUserIds && ev.sharedUserIds.length > 0
        ? [...ev.sharedUserIds]
        : currentUser
        ? [currentUser.id]
        : []
    )
    setIsFormOpen(true)
  }

  const toggleDepartmentSelection = (dept: Department) => {
    setFormDepartments((prev) => {
      if (prev.includes(dept)) {
        if (prev.length === 1) return prev // En az 1 departman kalsın
        return prev.filter((d) => d !== dept)
      }
      return [...prev, dept]
    })
  }

  const toggleUserSelection = (userId: string) => {
    setFormUserIds((prev) => {
      if (prev.includes(userId)) {
        return prev.filter((id) => id !== userId)
      }
      return [...prev, userId]
    })
  }

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formTitle.trim()) return

    // Seçilen kullanıcıların isimlerini bul
    const selectedUsers = allUsers.filter((u) => formUserIds.includes(u.id))
    const sharedUserNames = selectedUsers.map((u) => u.fullName)

    // Kategori ve görünürlük uyumunu sağla
    let finalCategory = formCategory
    if (formVisibility === 'COMPANY' && formCategory === 'DEPARTMENT_PLAN') {
      finalCategory = 'COMPANY_EVENT'
    } else if (
      formVisibility === 'DEPARTMENT' &&
      formDepartments.length > 1 &&
      formCategory === 'DEPARTMENT_PLAN'
    ) {
      finalCategory = 'INTER_DEPARTMENT'
    }

    const finalDepts: Department[] =
      formVisibility === 'COMPANY'
        ? [...CANONICAL_DEPARTMENTS]
        : formVisibility === 'DEPARTMENT'
        ? formDepartments
        : []

    const finalUserIds =
      formVisibility === 'PERSONAL'
        ? currentUser
          ? [currentUser.id]
          : []
        : formUserIds

    const finalUserNames =
      formVisibility === 'PERSONAL'
        ? currentUser
          ? [currentUser.fullName]
          : []
        : sharedUserNames

    if (editingEvent) {
      calendarStore.updateEvent(editingEvent.id, {
        title: formTitle.trim(),
        description: formDescription.trim(),
        date: formDate,
        time: formTime || '14:00',
        endTime: formEndTime || undefined,
        location: formLocation.trim(),
        category: finalCategory,
        visibilityScope: formVisibility,
        sharedDepartments: finalDepts,
        sharedUserIds: finalUserIds,
        sharedUserNames: finalUserNames,
      })
    } else {
      calendarStore.addEvent(
        {
          title: formTitle.trim(),
          description: formDescription.trim(),
          date: formDate,
          time: formTime || '14:00',
          endTime: formEndTime || undefined,
          location: formLocation.trim(),
          category: finalCategory,
          visibilityScope: formVisibility,
          sharedDepartments: finalDepts,
          sharedUserIds: finalUserIds,
          sharedUserNames: finalUserNames,
        },
        currentUser
      )
    }

    setIsFormOpen(false)
    setEditingEvent(null)
  }

  const handleToggleCompleted = (ev: CalendarEvent) => {
    const nextStatus = ev.status === 'COMPLETED' ? 'SCHEDULED' : 'COMPLETED'
    calendarStore.updateEvent(ev.id, { status: nextStatus })
  }

  const handleDeleteEvent = (id: string) => {
    calendarStore.deleteEvent(id)
    if (editingEvent?.id === id) {
      setIsFormOpen(false)
      setEditingEvent(null)
    }
  }

  // Filtrelenmiş etkinlikler
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (scopeFilter === 'MY_DEPT') {
        const myDept = currentUser?.department || 'Satış'
        if (ev.visibilityScope !== 'DEPARTMENT' || !ev.sharedDepartments.includes(myDept)) {
          return false
        }
      } else if (scopeFilter === 'INTER_DEPT') {
        if (ev.visibilityScope !== 'DEPARTMENT' || ev.sharedDepartments.length < 2) {
          return false
        }
      } else if (scopeFilter === 'COMPANY') {
        if (ev.visibilityScope !== 'COMPANY') return false
      } else if (scopeFilter === 'PERSONAL_GROUP') {
        if (ev.visibilityScope !== 'PERSONAL' && ev.visibilityScope !== 'USERS') return false
      } else if (scopeFilter === 'AUTO_SYNCED') {
        if (!ev.isAutoSynced) return false
      }

      if (deptFilter !== 'ALL') {
        if (
          ev.visibilityScope !== 'COMPANY' &&
          !ev.sharedDepartments.includes(deptFilter)
        ) {
          return false
        }
      }

      return true
    })
  }, [events, scopeFilter, deptFilter, currentUser?.department])

  // Takvim Hücreleri
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const totalDays = lastDay.getDate()

    let startOffset = firstDay.getDay() - 1
    if (startOffset < 0) startOffset = 6

    const cells: { dateIso: string | null; dayNumber: number | null }[] = []
    for (let i = 0; i < startOffset; i++) {
      cells.push({ dateIso: null, dayNumber: null })
    }
    for (let d = 1; d <= totalDays; d++) {
      const mm = String(month + 1).padStart(2, '0')
      const dd = String(d).padStart(2, '0')
      cells.push({ dateIso: `${year}-${mm}-${dd}`, dayNumber: d })
    }
    return cells
  }, [year, month])

  // Gün bazında etkinlik haritası
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    for (const ev of filteredEvents) {
      if (!map[ev.date]) map[ev.date] = []
      map[ev.date].push(ev)
    }
    return map
  }, [filteredEvents])

  // Sağ listede gösterilecek etkinlikler (Seçili gün varsa o gün, yoksa görüntülenen ayın etkinlikleri)
  const displayedListEvents = useMemo(() => {
    if (selectedDateIso) {
      return filteredEvents.filter((ev) => ev.date === selectedDateIso)
    }
    const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`
    return filteredEvents.filter((ev) => ev.date.startsWith(monthPrefix))
  }, [filteredEvents, selectedDateIso, year, month])

  const renderSharingBadge = (ev: CalendarEvent) => {
    if (ev.visibilityScope === 'COMPANY') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          <Globe className="w-2.5 h-2.5" />
          <span>Tüm Şirket</span>
        </span>
      )
    }
    if (ev.visibilityScope === 'PERSONAL') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
          <Lock className="w-2.5 h-2.5" />
          <span>Kişisel (Sadece Ben)</span>
        </span>
      )
    }
    if (ev.visibilityScope === 'USERS') {
      const names =
        ev.sharedUserNames && ev.sharedUserNames.length > 0
          ? ev.sharedUserNames.join(', ')
          : 'Seçili Kişi / Grup'
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30 max-w-[220px] truncate"
          title={`Paylaşılan Kişiler: ${names}`}
        >
          <Users className="w-2.5 h-2.5 shrink-0" />
          <span className="truncate">Grup / Kişi: {names}</span>
        </span>
      )
    }

    // DEPARTMENT (Tekil veya Çoğul)
    const depts = ev.sharedDepartments || []
    if (depts.length > 1) {
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30"
          title={`Departmanlar Arası: ${depts.join(', ')}`}
        >
          <Layers className="w-2.5 h-2.5 shrink-0" />
          <span>Departmanlar Arası ({depts.join(' + ')})</span>
        </span>
      )
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/15 text-teal-300 border border-teal-500/30">
        <Building2 className="w-2.5 h-2.5 shrink-0" />
        <span>{depts[0] || ev.createdByDepartment} Departmanı</span>
      </span>
    )
  }

  return (
    <div className="space-y-2.5">
      {/* Üst Aksiyon ve Kapsam Filtre Barı */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'ALL', label: 'Tümü' },
              { id: 'MY_DEPT', label: `${currentUser?.department || 'Departman'} Planları` },
              { id: 'INTER_DEPT', label: 'Departmanlar Arası' },
              { id: 'COMPANY', label: 'Tüm Şirket' },
              { id: 'PERSONAL_GROUP', label: 'Kişisel / Grup' },
              { id: 'AUTO_SYNCED', label: 'Otomatik Kayıtlar' },
            ] as { id: ScopeFilter; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setScopeFilter(tab.id)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer border ${
                scopeFilter === tab.id
                  ? 'bg-[#b99881] text-white border-[#b99881]'
                  : 'bg-[#24211f] text-[#a69f99] border-[#4a443f] hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <GlassButton
          variant="gold"
          size="sm"
          icon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => handleOpenNewForm()}
          className="rounded-full px-3.5 py-1 font-bold text-xs whitespace-nowrap shrink-0"
        >
          Yeni Plan Oluştur
        </GlassButton>
      </div>

      {/* Departman Bazlı Hızlı Filtre Şeridi */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs">
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[11px] font-semibold text-[#8c857f] mr-1">Departman:</span>
          <button
            type="button"
            onClick={() => setDeptFilter('ALL')}
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer border ${
              deptFilter === 'ALL'
                ? 'bg-[#b99881] text-white border-[#b99881] font-bold'
                : 'bg-transparent text-[#a69f99] border-[#4a443f] hover:text-white'
            }`}
          >
            Tüm Departmanlar
          </button>
          {CANONICAL_DEPARTMENTS.map((dept) => (
            <button
              key={dept}
              type="button"
              onClick={() => setDeptFilter(dept)}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer border ${
                deptFilter === dept
                  ? 'bg-[#b99881] text-white border-[#b99881] font-bold'
                  : 'bg-transparent text-[#a69f99] border-[#4a443f] hover:text-white'
              }`}
            >
              {dept}
            </button>
          ))}
        </div>
      </div>

      {/* PLAN EKLEME / DÜZENLEME PANELİ */}
      {isFormOpen && (
        <form
          onSubmit={handleSaveForm}
          className="p-4 rounded-[22px] bg-[#24211f] border border-[#b99881]/50 space-y-3.5"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-[#b99881]" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                {editingEvent
                  ? editingEvent.isAutoSynced
                    ? 'Otomatik Takvim Kaydını & Paylaşımı Düzenle'
                    : 'Planı & Paylaşımı Düzenle'
                  : 'Yeni Takvim Planı Oluştur'}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsFormOpen(false)
                setEditingEvent(null)
              }}
              className="p-1 rounded-full text-[#a69f99] hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-[#f3efe9] mb-1">
                Plan / Randevu / Görüşme Başlığı *
              </label>
              <input
                type="text"
                required
                placeholder="Örn: Haftalık Satış & Pazarlama Planlaması, Müşteri Görüşmesi..."
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="w-full px-3.5 py-2 rounded-full bg-[#1e1c1a] border border-[#4a443f] text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#f3efe9] mb-1">
                Plan Türü
              </label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as CalendarEventCategory)}
                className="w-full px-3.5 py-2 rounded-full bg-[#1e1c1a] border border-[#4a443f] text-xs text-white"
              >
                <option value="DEPARTMENT_PLAN">Departman Planı</option>
                <option value="INTER_DEPARTMENT">Departmanlar Arası Plan</option>
                <option value="COMPANY_EVENT">Tüm Şirket Planı</option>
                <option value="APPOINTMENT">Randevu</option>
                <option value="MEETING">Görüşme / Toplantı</option>
                <option value="FOLLOW_UP">Müşteri Takip / Arama</option>
                <option value="FINANCE">Finans / Tahsilat / Ödeme</option>
                <option value="TASK">Görev / Hatırlatma</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#f3efe9] mb-1">
                Tarih *
              </label>
              <input
                type="date"
                required
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-full bg-[#1e1c1a] border border-[#4a443f] text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#f3efe9] mb-1">
                Başlangıç Saati
              </label>
              <input
                type="time"
                value={formTime}
                onChange={(e) => setFormTime(e.target.value)}
                className="w-full px-3.5 py-2 rounded-full bg-[#1e1c1a] border border-[#4a443f] text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#f3efe9] mb-1">
                Bitiş Saati
              </label>
              <input
                type="time"
                value={formEndTime}
                onChange={(e) => setFormEndTime(e.target.value)}
                className="w-full px-3.5 py-2 rounded-full bg-[#1e1c1a] border border-[#4a443f] text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#f3efe9] mb-1">
                Konum / Kanal
              </label>
              <input
                type="text"
                placeholder="Merkez Ofis, Şantiye, Online..."
                value={formLocation}
                onChange={(e) => setFormLocation(e.target.value)}
                className="w-full px-3.5 py-2 rounded-full bg-[#1e1c1a] border border-[#4a443f] text-xs text-white"
              />
            </div>
          </div>

          {/* GÖRÜNÜRLÜK VE PAYLAŞIM SEÇİMİ (Departman Tekil/Çoğul, Kişisel/Grup, Tüm Şirket) */}
          <div className="p-3.5 rounded-[18px] bg-transparent border border-[#4a443f] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="block text-[11px] font-bold text-[#f3efe9]">
                Görünürlük & Kimlerle Paylaşılacak?
              </label>
              <span className="text-[10px] text-[#8c857f]">
                Departman (tekil/çoğul), kişisel/grup veya tüm şirket seçebilirsiniz
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setFormVisibility('DEPARTMENT')}
                className={`px-3 py-2 rounded-full text-xs font-semibold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  formVisibility === 'DEPARTMENT'
                    ? 'bg-[#b99881] text-white border-[#b99881]'
                    : 'bg-transparent text-[#a69f99] border-[#4a443f] hover:text-white'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 shrink-0" />
                <span>Departman (Tekil/Çoğul)</span>
              </button>

              <button
                type="button"
                onClick={() => setFormVisibility('COMPANY')}
                className={`px-3 py-2 rounded-full text-xs font-semibold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  formVisibility === 'COMPANY'
                    ? 'bg-[#b99881] text-white border-[#b99881]'
                    : 'bg-transparent text-[#a69f99] border-[#4a443f] hover:text-white'
                }`}
              >
                <Globe className="w-3.5 h-3.5 shrink-0" />
                <span>Tüm Şirket</span>
              </button>

              <button
                type="button"
                onClick={() => setFormVisibility('USERS')}
                className={`px-3 py-2 rounded-full text-xs font-semibold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  formVisibility === 'USERS'
                    ? 'bg-[#b99881] text-white border-[#b99881]'
                    : 'bg-transparent text-[#a69f99] border-[#4a443f] hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span>Belirli Kişiler / Grup</span>
              </button>

              <button
                type="button"
                onClick={() => setFormVisibility('PERSONAL')}
                className={`px-3 py-2 rounded-full text-xs font-semibold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  formVisibility === 'PERSONAL'
                    ? 'bg-[#b99881] text-white border-[#b99881]'
                    : 'bg-transparent text-[#a69f99] border-[#4a443f] hover:text-white'
                }`}
              >
                <Lock className="w-3.5 h-3.5 shrink-0" />
                <span>Kişisel (Sadece Ben)</span>
              </button>
            </div>

            {/* Departman Seçimi (Tekil veya Departmanlar Arası Çoğul) */}
            {formVisibility === 'DEPARTMENT' && (
              <div className="space-y-2 pt-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-[#f3efe9]">
                    Paylaşılacak Departmanlar ({formDepartments.length === 1 ? 'Tekil Departman' : `${formDepartments.length} Departman - Departmanlar Arası`}):
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setFormDepartments([currentUser?.department || 'Satış'])
                      }
                      className="text-[10px] px-2 py-0.5 rounded-full border border-[#4a443f] text-[#a69f99] hover:text-white cursor-pointer"
                    >
                      Sadece Departmanım
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setFormDepartments(['Müşteri İlişkileri', 'Satış'])
                      }
                      className="text-[10px] px-2 py-0.5 rounded-full border border-[#4a443f] text-[#a69f99] hover:text-white cursor-pointer"
                    >
                      Müşteri İlişkileri + Satış
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormDepartments([...CANONICAL_DEPARTMENTS])}
                      className="text-[10px] px-2 py-0.5 rounded-full border border-[#4a443f] text-[#a69f99] hover:text-white cursor-pointer"
                    >
                      Tümünü Seç
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {CANONICAL_DEPARTMENTS.map((dept) => {
                    const isSelected = formDepartments.includes(dept)
                    return (
                      <button
                        key={dept}
                        type="button"
                        onClick={() => toggleDepartmentSelection(dept)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-[#b99881] text-white border-[#b99881]'
                            : 'bg-transparent text-[#a69f99] border-[#4a443f] hover:text-white'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 shrink-0" />}
                        <span>{dept}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Belirli Kişiler / Grup Seçimi */}
            {(formVisibility === 'USERS' || formVisibility === 'DEPARTMENT') && (
              <div className="space-y-1.5 pt-1">
                <span className="block text-[11px] font-semibold text-[#f3efe9]">
                  {formVisibility === 'USERS'
                    ? 'Paylaşılacak Kişiler / Grup Seçin (Tek kişi veya birden fazla kişi):'
                    : 'İlgili Kişileri Etiketle (Opsiyonel):'}
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1">
                  {allUsers.map((u) => {
                    const isSelected = formUserIds.includes(u.id)
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => toggleUserSelection(u.id)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-[#b99881] text-white border-[#b99881] font-bold'
                            : 'bg-transparent text-[#a69f99] border-[#4a443f] hover:text-white'
                        }`}
                      >
                        <UserCheck className="w-3 h-3 shrink-0" />
                        <span>{u.fullName}</span>
                        <span className="opacity-75 text-[10px]">({u.department})</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#f3efe9] mb-1">
              Açıklama / Gündem Notu
            </label>
            <textarea
              rows={2}
              placeholder="Toplantı gündemi, randevu detayı veya hazırlık notları..."
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="w-full px-3.5 py-2 rounded-[14px] bg-[#1e1c1a] border border-[#4a443f] text-xs text-white resize-none"
            />
          </div>

          <div className="pt-1 pb-1 flex items-center justify-between gap-2">
            {editingEvent ? (
              <button
                type="button"
                onClick={() => handleDeleteEvent(editingEvent.id)}
                className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25 cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Takvimden Kaldır</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsFormOpen(false)
                  setEditingEvent(null)
                }}
                className="px-4 py-1.5 rounded-full text-xs glass-button-subtle border border-[#4a443f] text-[#a69f99] hover:text-white cursor-pointer"
              >
                Vazgeç
              </button>
              <GlassButton
                type="submit"
                variant="gold"
                size="sm"
                className="rounded-full px-5 font-bold"
              >
                {editingEvent ? 'Değişiklikleri Kaydet' : 'Planı Kaydet'}
              </GlassButton>
            </div>
          </div>
        </form>
      )}

      {/* ANA TAKVİM IZGARASI VE GÜNLÜK / AYLIK PLAN LİSTESİ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
        {/* Sol: Aylık Takvim Görünümü (7 Sütun) */}
        <div className="lg:col-span-7 p-3 rounded-[22px] bg-[#24211f] border border-[#4a443f] space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-full border border-[#4a443f] text-[#a69f99] hover:text-white cursor-pointer"
                title="Önceki Ay"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-bold text-white min-w-[125px] text-center whitespace-nowrap">
                {MONTH_NAMES_TR[month]} {year}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-full border border-[#4a443f] text-[#a69f99] hover:text-white cursor-pointer"
                title="Sonraki Ay"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              {selectedDateIso && (
                <button
                  type="button"
                  onClick={() => setSelectedDateIso(null)}
                  className="px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap shrink-0 border border-[#4a443f] text-[#a69f99] hover:text-white cursor-pointer"
                >
                  Tüm Ayı Göster
                </button>
              )}
              <button
                type="button"
                onClick={handleJumpToday}
                className="px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap shrink-0 bg-[#b99881] text-white border border-[#b99881] cursor-pointer shadow-xs"
              >
                Bugün
              </button>
            </div>
          </div>

          {/* Haftanın Günleri */}
          <div className="grid grid-cols-7 gap-1 text-center pt-0.5">
            {WEEKDAYS_TR.map((wd) => (
              <div key={wd} className="text-[10px] font-bold text-[#8c857f] uppercase py-0.5">
                {wd}
              </div>
            ))}
          </div>

          {/* Gün Hücreleri */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((cell, idx) => {
              if (!cell.dateIso || !cell.dayNumber) {
                return <div key={`empty-${idx}`} className="h-11 rounded-xl" />
              }

              const dayEvents = eventsByDate[cell.dateIso] || []
              const isSelected = selectedDateIso === cell.dateIso
              const isToday = cell.dateIso === todayIso

              return (
                <div
                  key={cell.dateIso}
                  onClick={() =>
                    setSelectedDateIso((prev) =>
                      prev === cell.dateIso ? null : cell.dateIso
                    )
                  }
                  onDoubleClick={() => handleOpenNewForm(cell.dateIso!)}
                  title="Günü filtrelemek için tıklayın, yeni plan eklemek için çift tıklayın"
                  className={`calendar-day-cell h-11 p-1.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between select-none ${
                    isSelected || isToday
                      ? 'calendar-today-cell bg-[#b99881] text-white border-[#b99881] shadow-sm'
                      : 'bg-transparent border-[#4a443f]/60 hover:!border-[var(--accent-color,#b99881)] text-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold leading-none ${
                        isSelected || isToday ? 'text-white' : 'text-white'
                      }`}
                    >
                      {cell.dayNumber}
                    </span>
                    {dayEvents.length > 0 && (
                      <span
                        className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-full ${
                          isSelected || isToday
                            ? 'bg-white/25 text-white'
                            : 'bg-[#b99881]/20 text-[#b99881]'
                        }`}
                      >
                        {dayEvents.length}
                      </span>
                    )}
                  </div>

                  {/* Etkinlik Noktaları / Kısa Başlık */}
                  <div className="flex items-center gap-1 overflow-hidden">
                    {dayEvents.slice(0, 3).map((ev) => {
                      const meta = CATEGORY_META[ev.category] || CATEGORY_META.DEPARTMENT_PLAN
                      return (
                        <span
                          key={ev.id}
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{
                            backgroundColor: isSelected || isToday ? '#ffffff' : meta.dotColor,
                          }}
                          title={`${ev.time} - ${ev.title}`}
                        />
                      )
                    })}
                    {dayEvents.length === 1 && (
                      <span
                        className={`text-[9px] truncate leading-tight ${
                          isSelected || isToday ? 'text-white' : 'text-[#8c857f]'
                        }`}
                      >
                        {dayEvents[0].title}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex items-center justify-between text-[10px] text-[#8c857f] pt-1">
            <span>İpucu: Güne çift tıklayarak doğrudan o güne plan ekleyebilirsiniz.</span>
            <span>Toplam {filteredEvents.length} kayıt</span>
          </div>
        </div>

        {/* Sağ: Seçili Gün veya Ayın Plan & Otomatik Kayıt Listesi (5 Sütun) */}
        <div className="lg:col-span-5 p-3 rounded-[22px] bg-[#24211f] border border-[#4a443f] space-y-2.5 flex flex-col max-h-[385px]">
          <div className="flex items-center justify-between gap-2 shrink-0">
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-white truncate">
                {selectedDateIso
                  ? `${selectedDateIso.split('-').reverse().join('.')} Tarihli Planlar`
                  : `${MONTH_NAMES_TR[month]} ${year} Planları`}
              </h4>
              <p className="text-[10px] text-[#8c857f] truncate">
                Randevu, görüşme, departman ve şirket planları
              </p>
            </div>

            {selectedDateIso && (
              <button
                type="button"
                onClick={() => handleOpenNewForm(selectedDateIso)}
                className="px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap shrink-0 bg-[#b99881] text-white cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3 h-3 shrink-0" />
                <span className="whitespace-nowrap">Bu Güne Ekle</span>
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {displayedListEvents.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <CalendarIcon className="w-7 h-7 text-[#8c857f] mx-auto opacity-40" />
                <p className="text-xs font-semibold text-white">
                  Bu görünümde kayıtlı plan bulunmuyor
                </p>
                <p className="text-[11px] text-[#8c857f] max-w-xs mx-auto">
                  Yeni bir departman planı, departmanlar arası toplantı veya şirket etkinliği ekleyebilirsiniz.
                </p>
              </div>
            ) : (
              displayedListEvents.map((ev) => {
                const catMeta = CATEGORY_META[ev.category] || CATEGORY_META.DEPARTMENT_PLAN
                const isDone = ev.status === 'COMPLETED'

                return (
                  <div
                    key={ev.id}
                    className={`p-3 rounded-[16px] bg-transparent border border-[#4a443f] hover:border-[#b99881]/70 transition-all space-y-2 ${
                      isDone ? 'opacity-65' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${catMeta.badgeClass}`}
                          >
                            {catMeta.label}
                          </span>
                          {ev.isAutoSynced && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              <Sparkles className="w-2.5 h-2.5" />
                              <span>Otomatik</span>
                            </span>
                          )}
                        </div>

                        <h5
                          className={`text-xs font-bold text-white leading-snug ${
                            isDone ? 'line-through' : ''
                          }`}
                        >
                          {ev.title}
                        </h5>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleCompleted(ev)}
                          className={`p-1.5 rounded-full border transition-colors cursor-pointer ${
                            isDone
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : 'border-[#4a443f] text-[#8c857f] hover:text-white'
                          }`}
                          title={isDone ? 'Tamamlandı (Geri Al)' : 'Tamamlandı İşaretle'}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditForm(ev)}
                          className="p-1.5 rounded-full border border-[#4a443f] text-[#a69f99] hover:text-white cursor-pointer"
                          title="Düzenle & Paylaşım Ayarlarını Değiştir"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {ev.description && (
                      <p className="text-[11px] text-[#a69f99] line-clamp-2 leading-relaxed">
                        {ev.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-[#8c857f]">
                        <span className="inline-flex items-center gap-1 font-semibold text-white">
                          <Clock className="w-3 h-3 text-[#b99881]" />
                          {ev.date.split('-').reverse().join('.')} • {ev.time}
                          {ev.endTime ? ` - ${ev.endTime}` : ''}
                        </span>
                        {ev.location && (
                          <span className="inline-flex items-center gap-1 truncate max-w-[140px]">
                            <MapPin className="w-3 h-3 text-[#b99881] shrink-0" />
                            <span className="truncate">{ev.location}</span>
                          </span>
                        )}
                      </div>

                      {renderSharingBadge(ev)}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
