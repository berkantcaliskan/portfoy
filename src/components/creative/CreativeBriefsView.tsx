import { createPortal } from 'react-dom'
import { CustomSelect } from '@/components/ui/CustomSelect'
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
  X,
} from 'lucide-react'
import {
  creativeStore,
  CreativeBriefItem,
  BriefPriority,
  BriefStatus,
  CreativeFormat,
} from '@/services/creativeStore'
import { userStore } from '@/services/userStore'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlassButton } from '@/components/ui/GlassButton'

const PRIORITY_META: Record<BriefPriority, { label: string; badgeClass: string }> = {
  ACIL: {
    label: 'Acil Öncelik',
    badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  },
  YUKSEK: {
    label: 'Yüksek Öncelik',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  },
  NORMAL: {
    label: 'Normal',
    badgeClass: 'bg-[#34302d] text-[#d6beae] border-[#4a443f]',
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

  const handleAddBrief = async (e: React.FormEvent) => {
try {

    e.preventDefault()
    if (!title.trim()) return
    const currentUser = userStore.getCurrentUser()
    await creativeStore.addBrief({
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
  
} catch (error) { window.alert(error instanceof Error ? error.message : "Sunucu işlemi doğrulanamadı.") }
}

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-[#b99881]" />
            <h2 className="text-2xl font-bold text-white tracking-wide">
              Brief&apos;ler
            </h2>
          </div>
          <p className="text-xs text-[#a69f99] mt-1">
            Pazarlama, Satış ve Yönetim departmanlarından gelen kreatif briefler ve teslimat takibi.
          </p>
        </div>

        <GlassButton
          type="button"
          variant="gold"
          size="sm"
          onClick={() => setShowAddModal(true)}
          className="rounded-full px-4 py-2 text-xs font-bold"
        >
          <Plus className="w-4 h-4" />
          <span>Yeni Kreatif Brief Oluştur</span>
        </GlassButton>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <GlassCard className="py-3 px-4 bg-[#282522] border-[#4a443f]">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[13px] font-medium text-[#d6beae]">
              Yeni / Bekleyen Briefler
            </span>
            <AlertCircle className="w-4 h-4 text-[#b99881]" />
          </div>
          <div className="text-[28px] sm:text-[32px] font-semibold text-white mt-1.5 font-mono leading-none">
            {briefs.filter((b) => b.status === 'YENI_BRIEF').length}
          </div>
        </GlassCard>

        <GlassCard className="py-3 px-4 bg-[#282522] border-[#4a443f]">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[13px] font-medium text-[#d6beae]">
              Aktif Üretimdeki Briefler
            </span>
            <Clock className="w-4 h-4 text-[#b99881]" />
          </div>
          <div className="text-[28px] sm:text-[32px] font-semibold text-white mt-1.5 font-mono leading-none">
            {briefs.filter((b) => b.status === 'URETIMDE').length}
          </div>
        </GlassCard>

        <GlassCard className="py-3 px-4 bg-[#282522] border-[#4a443f]">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[13px] font-medium text-[#d6beae]">
              Teslim Edilen Briefler
            </span>
            <CheckCircle2 className="w-4 h-4 text-[#b99881]" />
          </div>
          <div className="text-[28px] sm:text-[32px] font-semibold text-white mt-1.5 font-mono leading-none">
            {briefs.filter((b) => b.status === 'TESLIM_EDILDI').length}
          </div>
        </GlassCard>
      </div>

      {/* Brief Cards */}
      <div className="space-y-3.5">
        {briefs.map((brief) => {
          const prio = PRIORITY_META[brief.priority]
          const stat = BRIEF_STATUS_META[brief.status]

          return (
            <GlassCard
              key={brief.id}
              className="p-5 bg-[#282522] border-[#4a443f] space-y-4"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${prio.badgeClass}`}
                    >
                      {prio.label}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-[#34302d] text-[#d6beae]">
                      {brief.format}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#a69f99]">
                      <Building2 className="w-3.5 h-3.5 text-[#b99881]" />
                      {brief.project}
                    </span>
                    <span className="text-[11px] text-[#8c857f]">
                      • Talep Eden: {brief.requestedBy} ({brief.requesterDepartment})
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white">{brief.title}</h3>
                </div>

                <div className="flex items-center gap-3 self-end lg:self-center">
                  <span className="text-xs text-[#a69f99]">
                    Teslim Tarihi:{' '}
                    <strong className="text-white">
                      {new Date(brief.deadline + 'T12:00:00').toLocaleDateString('tr-TR')}
                    </strong>
                  </span>

                  <CustomSelect
                    value={brief.status}
                    onChange={async (e) =>
                      { try { await creativeStore.updateBriefStatus(brief.id, e.target.value as BriefStatus) } catch (error) { window.alert(error instanceof Error ? error.message : "Sunucu işlemi doğrulanamadı.") } }
                    }
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border bg-[#34302d] text-white focus:outline-none ${stat.badgeClass}`}
                  >
                    <option value="YENI_BRIEF">Yeni Brief</option>
                    <option value="URETIMDE">Üretimde</option>
                    <option value="TESLIM_EDILDI">Teslim Edildi</option>
                  </CustomSelect>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                <div className="rounded-2xl bg-[#34302d] p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#b99881] flex items-center gap-1.5 mb-1">
                    <Target className="w-3.5 h-3.5" />
                    Hedef Kitle
                  </p>
                  <p className="text-xs text-white leading-relaxed">{brief.targetAudience}</p>
                </div>

                <div className="rounded-2xl bg-[#34302d] p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#b99881] flex items-center gap-1.5 mb-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    Ana Mesaj / Vurgu
                  </p>
                  <p className="text-xs text-white leading-relaxed">{brief.keyMessage}</p>
                </div>

                <div className="rounded-2xl bg-[#34302d] p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#b99881] flex items-center gap-1.5 mb-1">
                    <Package className="w-3.5 h-3.5" />
                    İstenen Teslimatlar
                  </p>
                  <p className="text-xs text-white leading-relaxed">{brief.deliverables}</p>
                </div>
              </div>
            </GlassCard>
          )
        })}
      </div>

      {/* Add Brief Modal */}
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
              <h3 className="text-base font-bold text-white">Yeni Kreatif Brief Oluştur</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-full border border-[#4a443f] text-[#a69f99] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddBrief} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                  Brief Başlığı
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Örn: Portre Projesi Lansman Reels & Story Paketi"
                  className="w-full px-3.5 py-2 rounded-full bg-[#1e1c1a] border border-[#4a443f] text-xs text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-[#f3efe9] mb-1">Proje</label>
                  <CustomSelect
                    value={project}
                    onChange={(e) => setProject(e.target.value)}
                    className="w-full px-3 py-2 rounded-full bg-[#1e1c1a] border border-[#4a443f] text-xs text-white"
                  >
                    <option value="Eksen - 2">Eksen - 2</option>
                    <option value="Portre">Portre</option>
                    <option value="İnception">İnception</option>
                    <option value="Modern">Modern</option>
                    <option value="Tria">Tria</option>
                    <option value="Kurumsal">Kurumsal</option>
                  </CustomSelect>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#f3efe9] mb-1">Öncelik</label>
                  <CustomSelect
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as BriefPriority)}
                    className="w-full px-3 py-2 rounded-full bg-[#1e1c1a] border border-[#4a443f] text-xs text-white"
                  >
                    <option value="ACIL">Acil</option>
                    <option value="YUKSEK">Yüksek</option>
                    <option value="NORMAL">Normal</option>
                  </CustomSelect>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                    Teslim Tarihi
                  </label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full px-3 py-2 rounded-full bg-[#1e1c1a] border border-[#4a443f] text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#f3efe9] mb-1">Format</label>
                <CustomSelect
                  value={format}
                  onChange={(e) => setFormat(e.target.value as CreativeFormat)}
                  className="w-full px-3.5 py-2 rounded-full bg-[#1e1c1a] border border-[#4a443f] text-xs text-white"
                >
                  <option value="Reels / Video">Reels / Video</option>
                  <option value="Story (9:16)">Story (9:16)</option>
                  <option value="Post / Kare (1:1)">Post / Kare (1:1)</option>
                  <option value="Karusel">Karusel</option>
                  <option value="3D Render">3D Render</option>
                  <option value="Katalog / Broşür">Katalog / Broşür</option>
                </CustomSelect>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                  Hedef Kitle
                </label>
                <input
                  type="text"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="Örn: İstanbul ve Avrupa’da yaşayan konut yatırımcıları"
                  className="w-full px-3.5 py-2 rounded-full bg-[#1e1c1a] border border-[#4a443f] text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                  Ana Mesaj / Vurgu
                </label>
                <textarea
                  rows={2}
                  value={keyMessage}
                  onChange={(e) => setKeyMessage(e.target.value)}
                  placeholder="Vurgulanacak ödeme modeli, lokasyon veya kampanya mesajı..."
                  className="w-full px-3.5 py-2 rounded-2xl bg-[#1e1c1a] border border-[#4a443f] text-xs text-white resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                  İstenen Teslimatlar (Ölçü & Adet)
                </label>
                <input
                  type="text"
                  value={deliverables}
                  onChange={(e) => setDeliverables(e.target.value)}
                  placeholder="Örn: 2 adet 9:16 Reels, 1 adet 4:5 Post"
                  className="w-full px-3.5 py-2 rounded-full bg-[#1e1c1a] border border-[#4a443f] text-xs text-white"
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
                  Briefi Gönder
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
