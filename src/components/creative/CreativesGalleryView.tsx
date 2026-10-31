import { createPortal } from 'react-dom'
import React, { useState, useEffect } from 'react'
import {
  Palette,
  Plus,
  MessageSquare,
  AlertTriangle,
  Sparkles,
  Send,
  Search,
  Eye,
  Upload,
  Trash2,
  X,
} from 'lucide-react'
import {
  creativeStore,
  CreativeAssetItem,
  CreativeCommentItem,
  CreativeFormat,
  CreativeStatus,
  CommentBadgeType,
} from '@/services/creativeStore'
import { userStore } from '@/services/userStore'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlassButton } from '@/components/ui/GlassButton'

export const CREATIVE_STATUS_META: Record<
  CreativeStatus,
  { label: string; badgeClass: string; dotClass: string }
> = {
  TASLAK: {
    label: 'Taslak',
    badgeClass: 'bg-[#34302d] text-[#d6beae] border-[#4a443f]',
    dotClass: 'bg-slate-400',
  },
  INCELEMEDE: {
    label: 'İncelemede',
    badgeClass: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    dotClass: 'bg-sky-400',
  },
  REVIZE: {
    label: 'Revize Bekliyor',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    dotClass: 'bg-amber-400',
  },
  ONAYLANDI: {
    label: 'Onaylandı',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    dotClass: 'bg-emerald-400',
  },
  YAYINDA: {
    label: 'Yayında',
    badgeClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    dotClass: 'bg-blue-400',
  },
}

const GRADIENT_PRESETS = [
  { label: 'İndigo Gece', value: 'from-indigo-600 via-blue-700 to-slate-900' },
  { label: 'Cumhuriyet Kırmızısı', value: 'from-red-700 via-rose-800 to-slate-950' },
  { label: 'Altın & Kehribar', value: 'from-amber-600 via-orange-700 to-stone-900' },
  { label: 'Zümrüt Yeşil', value: 'from-emerald-600 via-teal-800 to-slate-950' },
  { label: 'Mor & Kadife', value: 'from-purple-700 via-violet-800 to-slate-950' },
  { label: 'Antrasit Minimal', value: 'from-zinc-700 via-neutral-900 to-black' },
]

export function CreativesGalleryView() {
  const [creatives, setCreatives] = useState<CreativeAssetItem[]>(() =>
    creativeStore.getCreatives()
  )
  const [comments, setComments] = useState<CreativeCommentItem[]>(() =>
    creativeStore.getComments()
  )
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCreativeId, setSelectedCreativeId] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Comment input states
  const [commentText, setCommentText] = useState('')
  const [commentType, setCommentType] = useState<CommentBadgeType>('YORUM')
  const [commentPin, setCommentPin] = useState('')

  // New creative form states
  const [newTitle, setNewTitle] = useState('')
  const [newProject, setNewProject] = useState('Eksen - 2')
  const [newFormat, setNewFormat] = useState<CreativeFormat>('Reels / Video')
  const [newPlatform, setNewPlatform] = useState('Instagram & Meta Ads')
  const [newHeadline, setNewHeadline] = useState('')
  const [newAdCopy, setNewAdCopy] = useState('')
  const [newCtaText, setNewCtaText] = useState('Tanıtım Turu Randevusu Al')
  const [newDueDate, setNewDueDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [newGradient, setNewGradient] = useState(GRADIENT_PRESETS[0].value)
  const [newPreviewImage, setNewPreviewImage] = useState<string | undefined>(undefined)

  useEffect(() => {
    const unsub = creativeStore.subscribe(() => {
      setCreatives(creativeStore.getCreatives())
      setComments(creativeStore.getComments())
    })
    return unsub
  }, [])

  const selectedCreative =
    creatives.find((c) => c.id === selectedCreativeId) || null
  const selectedComments = selectedCreative
    ? comments.filter((cm) => cm.creativeId === selectedCreative.id)
    : []

  const filteredCreatives = creatives.filter((c) => {
    if (statusFilter !== 'ALL' && c.status !== statusFilter) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return (
        c.title.toLowerCase().includes(q) ||
        c.project.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.headline.toLowerCase().includes(q)
      )
    }
    return true
  })

  const handleImageFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    targetId?: string
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : undefined
      if (targetId && dataUrl) {
        creativeStore.updateCreative(targetId, { previewImageUrl: dataUrl })
      } else if (dataUrl) {
        setNewPreviewImage(dataUrl)
      }
    }
    reader.readAsDataURL(file)
  }

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCreative || !commentText.trim()) return
    const currentUser = userStore.getCurrentUser()
    creativeStore.addComment({
      creativeId: selectedCreative.id,
      authorName: currentUser?.fullName || 'Kreatif Ekip',
      authorDepartment: currentUser?.department || 'Kreatif',
      content: commentText.trim(),
      type: commentType,
      pinNote: commentPin.trim() || undefined,
    })
    setCommentText('')
    setCommentPin('')
  }

  const handleCreateCreative = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    const currentUser = userStore.getCurrentUser()
    const created = creativeStore.addCreative({
      title: newTitle.trim(),
      project: newProject,
      format: newFormat,
      platform: newPlatform,
      status: 'INCELEMEDE',
      designer: currentUser?.fullName || 'Kreatif Ekip',
      dueDate: newDueDate,
      version: 'v1.0',
      aspectRatio:
        newFormat.includes('9:16') || newFormat.includes('Reels')
          ? '9:16'
          : newFormat.includes('1:1')
          ? '1:1'
          : '4:5',
      accentGradient: newGradient,
      previewImageUrl: newPreviewImage,
      headline: newHeadline.trim() || newTitle.trim().toUpperCase(),
      adCopy: newAdCopy.trim() || 'Demirtürk İnşaat güvencesiyle Karasu projelerimizi keşfedin.',
      ctaText: newCtaText.trim() || 'Detaylı Bilgi Al',
    })
    setNewTitle('')
    setNewHeadline('')
    setNewAdCopy('')
    setNewPreviewImage(undefined)
    setShowCreateModal(false)
    setSelectedCreativeId(created.id)
  }

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Palette className="w-5 h-5 text-[#b99881]" />
            <h2 className="text-2xl font-bold text-white tracking-wide">
              Stüdyo
            </h2>
          </div>
          <p className="text-xs text-[#a69f99] mt-1">
            Reklam kreatifleri, sosyal medya tasarımları, 3D renderlar ve ekip içi revize/yorum akışı.
          </p>
        </div>

        <GlassButton
          type="button"
          variant="gold"
          size="sm"
          onClick={() => setShowCreateModal(true)}
          className="rounded-full px-4 py-2 text-xs font-bold"
        >
          <Plus className="w-4 h-4" />
          <span>Yeni Kreatif Yükle / Oluştur</span>
        </GlassButton>
      </div>

      {/* Filter Bar (Dış katmansız, her sekme kendi pill-shaped katmanıyla) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { id: 'ALL', label: `Tümü (${creatives.length})` },
            {
              id: 'INCELEMEDE',
              label: `İncelemede (${creatives.filter((c) => c.status === 'INCELEMEDE').length})`,
            },
            {
              id: 'REVIZE',
              label: `Revize (${creatives.filter((c) => c.status === 'REVIZE').length})`,
            },
            {
              id: 'ONAYLANDI',
              label: `Onaylandı (${creatives.filter((c) => c.status === 'ONAYLANDI').length})`,
            },
            {
              id: 'YAYINDA',
              label: `Yayında (${creatives.filter((c) => c.status === 'YAYINDA').length})`,
            },
            {
              id: 'TASLAK',
              label: `Taslak (${creatives.filter((c) => c.status === 'TASLAK').length})`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border ${
                statusFilter === tab.id
                  ? 'bg-[#b99881] text-white border-[#b99881] shadow-sm'
                  : 'bg-[#282522] text-[#a69f99] border-[#4a443f] hover:text-white hover:border-[#b99881]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 text-[#8c857f] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="KRT kodu, proje veya başlık ara..."
            className="w-full pl-9 pr-3.5 py-2 rounded-full bg-[#282522] border border-[#4a443f] text-xs text-white placeholder:text-[#8c857f] focus:outline-none"
          />
        </div>
      </div>

      {/* Creatives Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredCreatives.map((item) => {
          const statusMeta = CREATIVE_STATUS_META[item.status]
          const itemComments = comments.filter((cm) => cm.creativeId === item.id)
          const unresolvedReviseCount = itemComments.filter(
            (cm) => !cm.isResolved && cm.type === 'REVIZE'
          ).length

          return (
            <GlassCard
              key={item.id}
              onClick={() => setSelectedCreativeId(item.id)}
              className="group bg-[#282522] border-[#4a443f] overflow-hidden flex flex-col cursor-pointer p-0"
            >
              {/* Visual Mockup / Preview Banner */}
              <div
                className={`dark-preview-canvas relative h-48 bg-gradient-to-br ${item.accentGradient} p-4 flex flex-col justify-between overflow-hidden`}
              >
                {item.previewImageUrl && (
                  <img
                    src={item.previewImageUrl}
                    alt={item.title}
                    className="absolute inset-0 w-full h-full object-cover opacity-85 group-hover:scale-105 transition-transform duration-500"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/25" />

                {/* Top row inside preview */}
                <div className="relative z-10 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2.5 py-0.5 rounded-full bg-black/65 backdrop-blur-md text-[10px] font-bold text-white border border-white/15">
                      {item.code} • {item.version}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-black/55 backdrop-blur-md text-[10px] font-medium text-white border border-white/10">
                      {item.format}
                    </span>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border backdrop-blur-md ${statusMeta.badgeClass}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotClass}`} />
                    {statusMeta.label}
                  </span>
                </div>

                {/* Bottom row inside preview */}
                <div className="relative z-10 space-y-1.5">
                  <span className="inline-block text-[10px] uppercase tracking-wider font-bold text-white/85">
                    DEMİRTÜRK İNŞAAT • {item.project}
                  </span>
                  <p className="text-xs font-extrabold text-white line-clamp-2 leading-snug drop-shadow">
                    {item.headline}
                  </p>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/55 backdrop-blur-md text-[10px] font-semibold text-white">
                    <Sparkles className="w-3 h-3" />
                    {item.ctaText}
                  </div>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-[#a69f99]">
                    <span>{item.platform}</span>
                    <span>
                      Teslim: {new Date(item.dueDate + 'T12:00:00').toLocaleDateString('tr-TR')}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white line-clamp-1">
                    {item.title}
                  </h3>
                  <p className="text-xs text-[#a69f99] line-clamp-2 leading-relaxed">
                    {item.adCopy}
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-[#d6beae]">
                      <MessageSquare className="w-3.5 h-3.5 text-[#b99881]" />
                      {itemComments.length} Yorum
                    </span>
                    {unresolvedReviseCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-semibold">
                        <AlertTriangle className="w-3 h-3" />
                        {unresolvedReviseCount} Açık Revize
                      </span>
                    )}
                  </div>

                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#b99881] group-hover:translate-x-0.5 transition-transform">
                    <Eye className="w-3.5 h-3.5" />
                    İncele & Yorum Yaz
                  </span>
                </div>
              </div>
            </GlassCard>
          )
        })}
      </div>

      {/* Selected Creative Detail & Comments Modal */}
      {selectedCreative && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[100] bg-black/65 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setSelectedCreativeId(null)}
        >
          <div
            className="glass-modal w-full max-w-4xl max-h-[90vh] rounded-[24px] bg-[#282522] border border-[#4a443f] shadow-2xl overflow-hidden flex flex-col lg:flex-row"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left: Creative Visual & Metadata */}
            <div className="lg:w-1/2 p-5 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full bg-[#34302d] border border-[#4a443f] text-xs font-bold text-white">
                    {selectedCreative.code}
                  </span>
                  <span className="text-xs text-[#a69f99]">{selectedCreative.format}</span>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedCreative.status}
                    onChange={(e) =>
                      creativeStore.updateCreativeStatus(
                        selectedCreative.id,
                        e.target.value as CreativeStatus
                      )
                    }
                    className="px-3 py-1 rounded-full text-xs font-semibold border border-[#4a443f] bg-[#34302d] text-white focus:outline-none"
                  >
                    <option value="TASLAK">Taslak</option>
                    <option value="INCELEMEDE">İncelemede</option>
                    <option value="REVIZE">Revize Bekliyor</option>
                    <option value="ONAYLANDI">Onaylandı</option>
                    <option value="YAYINDA">Yayında</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      creativeStore.deleteCreative(selectedCreative.id)
                      setSelectedCreativeId(null)
                    }}
                    title="Kreatifi Sil"
                    className="p-1.5 rounded-full border border-[#4a443f] text-[#a69f99] hover:text-rose-400 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Large Preview Box */}
              <div
                className={`dark-preview-canvas relative rounded-2xl bg-gradient-to-br ${selectedCreative.accentGradient} p-6 min-h-[240px] flex flex-col justify-between overflow-hidden border border-[#4a443f]`}
              >
                {selectedCreative.previewImageUrl && (
                  <img
                    src={selectedCreative.previewImageUrl}
                    alt={selectedCreative.title}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/20" />

                <div className="relative z-10 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white/90">
                    DEMİRTÜRK İNŞAAT • {selectedCreative.project}
                  </span>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/65 hover:bg-black/80 text-[11px] text-white border border-white/15 cursor-pointer transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    Görsel Değiştir
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageFileChange(e, selectedCreative.id)}
                    />
                  </label>
                </div>

                <div className="relative z-10 space-y-2 pt-8">
                  <h4 className="text-base font-extrabold text-white leading-snug">
                    {selectedCreative.headline}
                  </h4>
                  <p className="text-xs text-white/90 leading-relaxed">
                    {selectedCreative.adCopy}
                  </p>
                  <div className="pt-1">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/65 text-white text-xs font-bold border border-white/15">
                      {selectedCreative.ctaText}
                    </span>
                  </div>
                </div>
              </div>

              {/* Metadata Details */}
              <div className="space-y-2.5 bg-[#34302d] rounded-2xl p-3.5 border border-[#4a443f] text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-[#a69f99]">Başlık:</span>
                  <span className="text-white font-semibold text-right">
                    {selectedCreative.title}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[#a69f99]">Proje & Platform:</span>
                  <span className="text-white">
                    {selectedCreative.project} • {selectedCreative.platform}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[#a69f99]">Sorumlu & Sürüm:</span>
                  <span className="text-white">
                    {selectedCreative.designer} ({selectedCreative.version})
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Creative Comments & Revision Thread */}
            <div className="lg:w-1/2 p-5 flex flex-col justify-between max-h-[85vh]">
              <div className="flex items-center justify-between pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-[#b99881]" />
                    Kreatif Yorumları & Revize Notları ({selectedComments.length})
                  </h3>
                  <p className="text-[11px] text-[#a69f99]">
                    Saniye/slayt belirterek revize isteyebilir veya onay verebilirsiniz
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCreativeId(null)}
                  className="p-1.5 rounded-full border border-[#4a443f] text-[#a69f99] hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Comments Feed */}
              <div className="flex-1 overflow-y-auto py-3 space-y-2.5 pr-1">
                {selectedComments.length === 0 ? (
                  <div className="text-center py-10 text-xs text-[#a69f99]">
                    Bu kreatif için henüz yorum veya revize notu girilmemiş.
                  </div>
                ) : (
                  selectedComments.map((cm) => (
                    <div
                      key={cm.id}
                      className={`rounded-2xl p-3 bg-[#34302d] border border-[#4a443f] transition-all ${
                        cm.isResolved ? 'opacity-65' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-white">{cm.authorName}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#282522] text-[#a69f99]">
                            {cm.authorDepartment}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                              cm.type === 'REVIZE'
                                ? 'bg-amber-500/20 text-amber-400'
                                : cm.type === 'ONAY'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-sky-500/20 text-sky-400'
                            }`}
                          >
                            {cm.type === 'REVIZE'
                              ? 'Revize Notu'
                              : cm.type === 'ONAY'
                              ? 'Onay'
                              : 'Yorum'}
                          </span>
                          {cm.pinNote && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#282522] text-[#d6beae]">
                              📍 {cm.pinNote}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => creativeStore.toggleCommentResolved(cm.id)}
                          className={`text-[10px] px-2.5 py-0.5 rounded-full border transition-colors cursor-pointer ${
                            cm.isResolved
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                              : 'bg-[#282522] text-[#a69f99] border-[#4a443f] hover:text-white'
                          }`}
                        >
                          {cm.isResolved ? '✓ Çözüldü' : 'Çözüldü İşaretle'}
                        </button>
                      </div>

                      <p className="text-xs text-white leading-relaxed">{cm.content}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Add Comment Form */}
              <form onSubmit={handlePostComment} className="pt-3 space-y-2.5">
                <div className="flex items-center gap-2">
                  <select
                    value={commentType}
                    onChange={(e) => setCommentType(e.target.value as CommentBadgeType)}
                    className="px-3 py-1.5 rounded-full bg-[#1e1c1a] border border-[#4a443f] text-xs text-white focus:outline-none"
                  >
                    <option value="YORUM">💬 Yorum</option>
                    <option value="REVIZE">🛠️ Revize İste</option>
                    <option value="ONAY">✅ Onay Ver</option>
                  </select>

                  <input
                    type="text"
                    value={commentPin}
                    onChange={(e) => setCommentPin(e.target.value)}
                    placeholder="Konum / Saniye (Örn: 00:04 sn veya Slayt 2)"
                    className="flex-1 px-3.5 py-1.5 rounded-full bg-[#1e1c1a] border border-[#4a443f] text-xs text-white placeholder:text-[#8c857f] focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Kreatif hakkında yorum veya revize notunuzu yazın..."
                    className="flex-1 px-3.5 py-2 rounded-full bg-[#1e1c1a] border border-[#4a443f] text-xs text-white placeholder:text-[#8c857f] focus:outline-none"
                  />
                  <GlassButton
                    type="submit"
                    variant="gold"
                    size="sm"
                    className="rounded-full px-4 py-2 text-xs font-bold"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Gönder</span>
                  </GlassButton>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Create New Creative Modal */}
      {showCreateModal && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[100] bg-black/65 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="glass-modal w-full max-w-lg rounded-[24px] bg-[#282522] border border-[#4a443f] p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Yeni Kreatif Oluştur / Yükle</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-full border border-[#4a443f] text-[#a69f99] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCreative} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                  Kreatif Başlığı
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Örn: Eksen-2 Havuz & Senet Avantajı Reels Kurgusu"
                  className="w-full px-3.5 py-2 rounded-full bg-[#1e1c1a] border border-[#4a443f] text-xs text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#f3efe9] mb-1">Proje</label>
                  <select
                    value={newProject}
                    onChange={(e) => setNewProject(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-full bg-[#1e1c1a] border border-[#4a443f] text-xs text-white focus:outline-none"
                  >
                    <option value="Eksen - 2">Eksen - 2</option>
                    <option value="Portre">Portre</option>
                    <option value="İnception">İnception</option>
                    <option value="Modern">Modern</option>
                    <option value="Tria">Tria</option>
                    <option value="Kurumsal">Kurumsal • Tüm Projeler</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#f3efe9] mb-1">Format</label>
                  <select
                    value={newFormat}
                    onChange={(e) => setNewFormat(e.target.value as CreativeFormat)}
                    className="w-full px-3.5 py-2 rounded-full bg-[#1e1c1a] border border-[#4a443f] text-xs text-white focus:outline-none"
                  >
                    <option value="Reels / Video">Reels / Video</option>
                    <option value="Story (9:16)">Story (9:16)</option>
                    <option value="Post / Kare (1:1)">Post / Kare (1:1)</option>
                    <option value="Karusel">Karusel</option>
                    <option value="3D Render">3D Render</option>
                    <option value="Katalog / Broşür">Katalog / Broşür</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                    Mecra / Platform
                  </label>
                  <input
                    type="text"
                    value={newPlatform}
                    onChange={(e) => setNewPlatform(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-full bg-[#1e1c1a] border border-[#4a443f] text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                    Teslim / Yayın Tarihi
                  </label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-full bg-[#1e1c1a] border border-[#4a443f] text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                  Görsel Üstü Ana Başlık (Headline)
                </label>
                <input
                  type="text"
                  value={newHeadline}
                  onChange={(e) => setNewHeadline(e.target.value)}
                  placeholder="Örn: 36 AY ELDEN SENETLE KARASU’DA DAİRE FIRSATI"
                  className="w-full px-3.5 py-2 rounded-full bg-[#1e1c1a] border border-[#4a443f] text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                  Reklam Metni / Açıklama (Copy)
                </label>
                <textarea
                  rows={2}
                  value={newAdCopy}
                  onChange={(e) => setNewAdCopy(e.target.value)}
                  placeholder="Reklam açıklaması veya kreatif kurgu özeti..."
                  className="w-full px-3.5 py-2 rounded-2xl bg-[#1e1c1a] border border-[#4a443f] text-xs text-white focus:outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                    CTA Buton Metni
                  </label>
                  <input
                    type="text"
                    value={newCtaText}
                    onChange={(e) => setNewCtaText(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-full bg-[#1e1c1a] border border-[#4a443f] text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                    Tema Rengi
                  </label>
                  <select
                    value={newGradient}
                    onChange={(e) => setNewGradient(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-full bg-[#1e1c1a] border border-[#4a443f] text-xs text-white focus:outline-none"
                  >
                    {GRADIENT_PRESETS.map((g) => (
                      <option key={g.value} value={g.value}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                  Önizleme Görseli Yükle (Opsiyonel)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageFileChange(e)}
                  className="w-full text-xs text-[#a69f99]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
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
                  Kreatifi Kaydet
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
