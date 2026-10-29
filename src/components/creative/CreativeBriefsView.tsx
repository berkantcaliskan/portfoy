import React, { useState, useEffect } from 'react'
import {
  FileText,
  Plus,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertCircle,
  Target,
  Package,
  Building2,
} from 'lucide-react'
import {
  creativeStore,
  CreativeBriefItem,
  BriefPriority,
  BriefStatus,
  CreativeFormat,
} from '@/services/creativeStore'
import { userStore } from '@/services/userStore'

const PRIORITY_META: Record<BriefPriority, { label: string; badgeClass: string }> = {
  ACIL: {
    label: 'Acil Öncelik',
    badgeClass: 'bg-red-500/15 text-red-400 border-red-500/30',
  },
  YUKSEK: {
    label: 'Yüksek Öncelik',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  },
  NORMAL: {
    label: 'Normal',
    badgeClass: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  },
}

const BRIEF_STATUS_META: Record<BriefStatus, { label: string; badgeClass: string }> = {
  YENI_BRIEF: {
    label: 'Yeni Brief',
    badgeClass: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  },
  URETIMDE: {
    label: 'Üretimde',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  },
  TESLIM_EDILDI: {
    label: 'Teslim Edildi',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  },
}

export function CreativeBriefsView() {
  const [briefs, setBriefs] = useState<CreativeBriefItem[]>(() =>
    creativeStore.getBriefs()
  )
  const [showAddModal, setShowAddModal] = useState(false)

  // Form states
  const [title, setTitle] = useState('')
  const [project, setProject] = useState('Eksen - 2')
  const [format, setFormat] = useState<CreativeFormat>('Reels / Video')
  const [priority, setPriority] = useState<BriefPriority>('YUKSEK')
  const [deadline, setDeadline] = useState(() => new Date().toISOString().slice(0, 10))
  const [targetAudience, setTargetAudience] = useState('')
  const [keyMessage, setKeyMessage] = useState('')
  const [deliverables, setDeliverables] = useState('')

  useEffect(() => {
    const unsub = creativeStore.subscribe(() => {
      setBriefs(creativeStore.getBriefs())
    })
    return unsub
  }, [])

  const handleAddBrief = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    const currentUser = userStore.getCurrentUser()
    creativeStore.addBrief({
      title: title.trim(),
      requestedBy: currentUser?.fullName || 'Pazarlama Ekibi',
      requesterDepartment: currentUser?.department || 'Pazarlama',
      project,
      format,
      priority,
      deadline,
      status: 'YENI_BRIEF',
      targetAudience: targetAudience.trim() || 'Yatırımcılar ve konut alıcıları',
      keyMessage: keyMessage.trim() || 'Demirtürk İnşaat ödeme kolaylığı ve proje avantajları',
      deliverables: deliverables.trim() || '9:16 Reels + 4:5 Post',
      assignedDesigner: 'Kreatif Ekip',
    })
    setTitle('')
    setTargetAudience('')
    setKeyMessage('')
    setDeliverables('')
    setShowAddModal(false)
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Kreatif Brief & Tasarım Talepleri
            </h1>
            <p className="text-xs text-slate-400">
              Pazarlama, Satış ve Yönetim departmanlarından gelen kreatif briefler ve teslimat takibi
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs transition-all shadow-lg shadow-sky-500/20"
        >
          <Plus className="w-4 h-4" />
          Yeni Kreatif Brief Oluştur
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="rounded-2xl bg-[#111520]/90 border border-white/[0.07] p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-slate-400">Yeni / Bekleyen Briefler</p>
            <p className="text-2xl font-bold text-sky-400 mt-1">
              {briefs.filter((b) => b.status === 'YENI_BRIEF').length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/25 flex items-center justify-center text-sky-400">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-2xl bg-[#111520]/90 border border-white/[0.07] p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-slate-400">Aktif Üretimdeki Briefler</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">
              {briefs.filter((b) => b.status === 'URETIMDE').length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-2xl bg-[#111520]/90 border border-white/[0.07] p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-slate-400">Teslim Edilen Briefler</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">
              {briefs.filter((b) => b.status === 'TESLIM_EDILDI').length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Brief Cards */}
      <div className="space-y-4">
        {briefs.map((brief) => {
          const prio = PRIORITY_META[brief.priority]
          const stat = BRIEF_STATUS_META[brief.status]

          return (
            <div
              key={brief.id}
              className="rounded-2xl bg-[#111520]/90 border border-white/[0.07] p-5 space-y-4 hover:border-white/[0.14] transition-all"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2.5 py-0.5 rounded-md text-[10px] font-semibold border ${prio.badgeClass}`}
                    >
                      {prio.label}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-medium bg-white/[0.05] text-slate-300 border border-white/[0.08]">
                      {brief.format}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                      <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                      {brief.project}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      • Talep Eden: {brief.requestedBy} ({brief.requesterDepartment})
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white">{brief.title}</h3>
                </div>

                <div className="flex items-center gap-3 self-end lg:self-center">
                  <span className="text-xs text-slate-400">
                    Teslim Tarihi:{' '}
                    <strong className="text-slate-200">
                      {new Date(brief.deadline + 'T12:00:00').toLocaleDateString('tr-TR')}
                    </strong>
                  </span>

                  <select
                    value={brief.status}
                    onChange={(e) =>
                      creativeStore.updateBriefStatus(brief.id, e.target.value as BriefStatus)
                    }
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border bg-[#0c0f17] focus:outline-none ${stat.badgeClass}`}
                  >
                    <option value="YENI_BRIEF">Yeni Brief</option>
                    <option value="URETIMDE">Üretimde</option>
                    <option value="TESLIM_EDILDI">Teslim Edildi</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-white/[0.06]">
                <div className="rounded-xl bg-black/25 p-3 border border-white/[0.05]">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-400 flex items-center gap-1.5 mb-1">
                    <Target className="w-3.5 h-3.5" />
                    Hedef Kitle
                  </p>
                  <p className="text-xs text-slate-300 leading-relaxed">{brief.targetAudience}</p>
                </div>

                <div className="rounded-xl bg-black/25 p-3 border border-white/[0.05]">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 mb-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    Ana Mesaj / Vurgu
                  </p>
                  <p className="text-xs text-slate-300 leading-relaxed">{brief.keyMessage}</p>
                </div>

                <div className="rounded-xl bg-black/25 p-3 border border-white/[0.05]">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 mb-1">
                    <Package className="w-3.5 h-3.5" />
                    İstenen Teslimatlar
                  </p>
                  <p className="text-xs text-slate-300 leading-relaxed">{brief.deliverables}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Add Brief Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#121622] border border-white/10 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Yeni Kreatif Brief Oluştur</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Kapat
              </button>
            </div>

            <form onSubmit={handleAddBrief} className="space-y-3.5">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Brief Başlığı</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Örn: Portre Projesi Lansman Reels & Story Paketi"
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Proje</label>
                  <select
                    value={project}
                    onChange={(e) => setProject(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl bg-[#0d1018] border border-white/10 text-xs text-white"
                  >
                    <option value="Eksen - 2">Eksen - 2</option>
                    <option value="Portre">Portre</option>
                    <option value="İnception">İnception</option>
                    <option value="Modern">Modern</option>
                    <option value="Tria">Tria</option>
                    <option value="Kurumsal">Kurumsal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Öncelik</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as BriefPriority)}
                    className="w-full px-2.5 py-2 rounded-xl bg-[#0d1018] border border-white/10 text-xs text-white"
                  >
                    <option value="ACIL">Acil</option>
                    <option value="YUKSEK">Yüksek</option>
                    <option value="NORMAL">Normal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Teslim Tarihi</label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Format</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as CreativeFormat)}
                  className="w-full px-3 py-2 rounded-xl bg-[#0d1018] border border-white/10 text-xs text-white"
                >
                  <option value="Reels / Video">Reels / Video</option>
                  <option value="Story (9:16)">Story (9:16)</option>
                  <option value="Post / Kare (1:1)">Post / Kare (1:1)</option>
                  <option value="Karusel">Karusel</option>
                  <option value="3D Render">3D Render</option>
                  <option value="Katalog / Broşür">Katalog / Broşür</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Hedef Kitle</label>
                <input
                  type="text"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="Örn: İstanbul ve Avrupa’da yaşayan konut yatırımcıları"
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Ana Mesaj / Vurgu</label>
                <textarea
                  rows={2}
                  value={keyMessage}
                  onChange={(e) => setKeyMessage(e.target.value)}
                  placeholder="Vurgulanacak ödeme modeli, lokasyon veya kampanya mesajı..."
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">İstenen Teslimatlar (Ölçü & Adet)</label>
                <input
                  type="text"
                  value={deliverables}
                  onChange={(e) => setDeliverables(e.target.value)}
                  placeholder="Örn: 2 adet 9:16 Reels, 1 adet 4:5 Post"
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white"
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
                  className="px-4 py-2 rounded-xl bg-sky-500 text-slate-950 font-semibold text-xs hover:bg-sky-400"
                >
                  Briefi Gönder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
