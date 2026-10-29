import React, { useState, useEffect } from 'react'
import {
  Calendar,
  Plus,
  Flag,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertCircle,
  Filter,
  Trash2,
  Search,
  Megaphone,
  Camera,
  Layers,
} from 'lucide-react'
import {
  creativeStore,
  CreativeScheduleItem,
  ScheduleCategory,
  SchedulePrepStatus,
} from '@/services/creativeStore'

const CATEGORY_CONFIG: Record<
  ScheduleCategory,
  { label: string; badgeClass: string; icon: React.ComponentType<{ className?: string }> }
> = {
  RESMI_BAYRAM: {
    label: 'Resmi Bayram',
    badgeClass: 'bg-red-500/15 text-red-400 border-red-500/30',
    icon: Flag,
  },
  OZEL_GUN: {
    label: 'Özel Gün',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    icon: Sparkles,
  },
  KAMPANYA: {
    label: 'Kampanya & Lansman',
    badgeClass: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
    icon: Megaphone,
  },
  CEKIM: {
    label: 'Prodüksiyon / Çekim',
    badgeClass: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    icon: Camera,
  },
  ICERIK: {
    label: 'Düzenli İçerik',
    badgeClass: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    icon: Layers,
  },
}

const STATUS_CONFIG: Record<
  SchedulePrepStatus,
  { label: string; badgeClass: string }
> = {
  PLANLANDI: {
    label: 'Planlandı',
    badgeClass: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  },
  TASARIMDA: {
    label: 'Tasarımda',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  },
  ONAY_BEKLIYOR: {
    label: 'Onay Bekliyor',
    badgeClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  },
  HAZIR: {
    label: 'Yayına Hazır',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  },
  YAYINLANDI: {
    label: 'Yayınlandı',
    badgeClass: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  },
}

export function CreativeScheduleView() {
  const [items, setItems] = useState<(CreativeScheduleItem & { daysLeft: number })[]>(() =>
    creativeStore.getSchedule()
  )
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)

  // Form states
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [category, setCategory] = useState<ScheduleCategory>('OZEL_GUN')
  const [status, setStatus] = useState<SchedulePrepStatus>('PLANLANDI')
  const [project, setProject] = useState('Kurumsal • Tüm Projeler')
  const [channelsText, setChannelsText] = useState('Instagram, Story, Meta Ads')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    const unsub = creativeStore.subscribe(() => {
      setItems(creativeStore.getSchedule())
    })
    return unsub
  }, [])

  const filteredItems = items.filter((item) => {
    if (categoryFilter === 'SPECIAL' && item.category !== 'OZEL_GUN' && item.category !== 'RESMI_BAYRAM') {
      return false
    } else if (categoryFilter !== 'ALL' && categoryFilter !== 'SPECIAL' && item.category !== categoryFilter) {
      return false
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return (
        item.title.toLowerCase().includes(q) ||
        item.project.toLowerCase().includes(q) ||
        item.notes.toLowerCase().includes(q)
      )
    }
    return true
  })

  const upcoming30DaysCount = items.filter((i) => i.daysLeft >= 0 && i.daysLeft <= 30).length
  const inDesignCount = items.filter((i) => i.status === 'TASARIMDA' || i.status === 'ONAY_BEKLIYOR').length
  const readyCount = items.filter((i) => i.status === 'HAZIR' || i.status === 'YAYINLANDI').length

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !date) return
    creativeStore.addScheduleItem({
      title: title.trim(),
      date,
      category,
      status,
      project: project.trim() || 'Kurumsal',
      assignedTo: 'Kreatif Ekip',
      channels: channelsText
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
      notes: notes.trim(),
      isAnnualSpecialDay: category === 'OZEL_GUN' || category === 'RESMI_BAYRAM',
    })
    setTitle('')
    setNotes('')
    setShowAddModal(false)
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                Özel Günler & Kreatif Üretim Çizelgesi
              </h1>
              <p className="text-xs text-slate-400">
                Resmi bayramlar, özel günler, kampanya lansmanları ve içerik hazırlık takvimi
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-all shadow-lg shadow-amber-500/20"
        >
          <Plus className="w-4 h-4" />
          Yeni Özel Gün / Plan Ekle
        </button>
      </div>

      {/* Summary Strips */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
        <div className="rounded-2xl bg-[#111520]/90 border border-white/[0.07] p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-slate-400">Toplam Takvim Maddesi</p>
            <p className="text-2xl font-bold text-white mt-1">{items.length}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Yıllık özel gün & kampanya</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-indigo-400">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-2xl bg-[#111520]/90 border border-white/[0.07] p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-slate-400">Yaklaşan (30 Gün İçinde)</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">{upcoming30DaysCount}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Öncelikli hazırlık gerektiren</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-2xl bg-[#111520]/90 border border-white/[0.07] p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-slate-400">Tasarımda & Onayda</p>
            <p className="text-2xl font-bold text-sky-400 mt-1">{inDesignCount}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Aktif kreatif üretim</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/25 flex items-center justify-center text-sky-400">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-2xl bg-[#111520]/90 border border-white/[0.07] p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-slate-400">Yayına Hazır / Yayınlandı</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{readyCount}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Tamamlanan özel günler</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#111520]/80 border border-white/[0.06] rounded-2xl p-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-slate-500 ml-1.5 mr-1" />
          {[
            { id: 'ALL', label: 'Tümü' },
            { id: 'SPECIAL', label: 'Özel Gün & Bayramlar' },
            { id: 'KAMPANYA', label: 'Kampanyalar' },
            { id: 'CEKIM', label: 'Prodüksiyon / Çekim' },
            { id: 'ICERIK', label: 'Düzenli İçerik' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCategoryFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                categoryFilter === tab.id
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Özel gün, proje veya not ara..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-black/30 border border-white/[0.07] text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/40"
          />
        </div>
      </div>

      {/* Timeline / Schedule List */}
      <div className="space-y-3">
        {filteredItems.map((item) => {
          const catMeta = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.OZEL_GUN
          const statusMeta = STATUS_CONFIG[item.status] || STATUS_CONFIG.PLANLANDI
          const CatIcon = catMeta.icon
          const formattedDate = new Date(item.date + 'T12:00:00').toLocaleDateString('tr-TR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            weekday: 'short',
          })

          let countdownBadge = null
          if (item.daysLeft === 0) {
            countdownBadge = (
              <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse">
                BUGÜN
              </span>
            )
          } else if (item.daysLeft > 0 && item.daysLeft <= 14) {
            countdownBadge = (
              <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {item.daysLeft} gün kaldı
              </span>
            )
          } else if (item.daysLeft > 14) {
            countdownBadge = (
              <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white/[0.05] text-slate-300 border border-white/[0.08]">
                {item.daysLeft} gün sonra
              </span>
            )
          } else {
            countdownBadge = (
              <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white/[0.03] text-slate-500 border border-white/[0.05]">
                {Math.abs(item.daysLeft)} gün önce
              </span>
            )
          }

          return (
            <div
              key={item.id}
              className="rounded-2xl bg-[#111520]/90 border border-white/[0.07] hover:border-white/[0.14] transition-all p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3.5">
                {/* Date Box */}
                <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex flex-col items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold uppercase text-amber-400">
                    {new Date(item.date + 'T12:00:00').toLocaleDateString('tr-TR', { month: 'short' })}
                  </span>
                  <span className="text-lg font-extrabold text-white leading-tight">
                    {new Date(item.date + 'T12:00:00').getDate()}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${catMeta.badgeClass}`}
                    >
                      <CatIcon className="w-3 h-3" />
                      {catMeta.label}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">{formattedDate}</span>
                    {countdownBadge}
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/[0.04] text-slate-300 border border-white/[0.06]">
                      {item.project}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-white">{item.title}</h3>

                  {item.notes && (
                    <p className="text-xs text-slate-400 leading-relaxed">{item.notes}</p>
                  )}

                  {item.channels && item.channels.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      {item.channels.map((ch) => (
                        <span
                          key={ch}
                          className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
                        >
                          {ch}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Controls */}
              <div className="flex items-center gap-2.5 self-end lg:self-center shrink-0">
                <select
                  value={item.status}
                  onChange={(e) =>
                    creativeStore.updateScheduleStatus(
                      item.id,
                      e.target.value as SchedulePrepStatus
                    )
                  }
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border bg-[#0c0f17] focus:outline-none cursor-pointer ${statusMeta.badgeClass}`}
                >
                  <option value="PLANLANDI">Planlandı</option>
                  <option value="TASARIMDA">Tasarımda</option>
                  <option value="ONAY_BEKLIYOR">Onay Bekliyor</option>
                  <option value="HAZIR">Yayına Hazır</option>
                  <option value="YAYINLANDI">Yayınlandı</option>
                </select>

                <button
                  onClick={() => creativeStore.deleteScheduleItem(item.id)}
                  title="Takvimden Sil"
                  className="p-2 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#121622] border border-white/10 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Yeni Özel Gün / Çizelge Planı Ekle</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Kapat
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Başlık / Özel Gün Adı</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Örn: 18 Mart Çanakkale Zaferi Anma Tasarımı"
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Tarih</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Kategori</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ScheduleCategory)}
                    className="w-full px-3 py-2 rounded-xl bg-[#0d1018] border border-white/10 text-xs text-white focus:outline-none"
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
                  <label className="block text-xs text-slate-400 mb-1">İlgili Proje</label>
                  <input
                    type="text"
                    value={project}
                    onChange={(e) => setProject(e.target.value)}
                    placeholder="Kurumsal • Tüm Projeler"
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Hazırlık Durumu</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as SchedulePrepStatus)}
                    className="w-full px-3 py-2 rounded-xl bg-[#0d1018] border border-white/10 text-xs text-white focus:outline-none"
                  >
                    <option value="PLANLANDI">Planlandı</option>
                    <option value="TASARIMDA">Tasarımda</option>
                    <option value="ONAY_BEKLIYOR">Onay Bekliyor</option>
                    <option value="HAZIR">Yayına Hazır</option>
                    <option value="YAYINLANDI">Yayınlandı</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Mecralar (Virgülle ayırın)</label>
                <input
                  type="text"
                  value={channelsText}
                  onChange={(e) => setChannelsText(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Kreatif Hazırlık Notu</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Görsel dili, ölçü formatları ve dikkat edilecek detaylar..."
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-xs text-slate-300 hover:bg-white/10"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-semibold text-xs hover:bg-amber-400"
                >
                  Çizelgeye Ekle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
