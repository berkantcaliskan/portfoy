import React, { useState, useEffect } from 'react'
import {
  AlertCircle,
  Plus,
  CheckCircle2,
  Clock,
  User,
  Phone,
  Filter,
  MessageSquare,
} from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlassButton } from '@/components/ui/GlassButton'
import { GlassBadge } from '@/components/ui/GlassBadge'
import { GlassModal } from '@/components/ui/GlassModal'
import {
  requestStore,
  CustomerRequest,
  RequestPriority,
  RequestStatus,
} from '@/services/requestStore'
import { userStore, AppUser } from '@/services/userStore'

export const RequestsView: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(userStore.getCurrentUser())
  const [requests, setRequests] = useState<CustomerRequest[]>(() => requestStore.getAll())
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  // Form states
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState<CustomerRequest['category']>('Proje & Kat Planı')
  const [priority, setPriority] = useState<RequestPriority>('Orta')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    const unsub = requestStore.subscribe(() => {
      setRequests(requestStore.getAll())
    })
    return () => unsub()
  }, [])

  const filtered = requests.filter((r) => {
    if (filterStatus !== 'ALL' && r.status !== filterStatus) return false
    return true
  })

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!customerName.trim() || !subject.trim()) return

    requestStore.addRequest({
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      subject: subject.trim(),
      category,
      priority,
      status: 'Açık',
      assignedToUserName: currentUser?.fullName || 'Müşteri Temsilcisi',
      notes: notes.trim(),
    })

    setIsAddModalOpen(false)
    setCustomerName('')
    setCustomerPhone('')
    setSubject('')
    setNotes('')
  }

  const handleStatusChange = (id: string, newStatus: RequestStatus) => {
    requestStore.updateStatus(id, newStatus)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-[#b99881]" />
            <h2 className="text-xl font-bold tracking-tight text-white">
              Talepler
            </h2>
          </div>
          <p className="text-xs text-[#a69f99] mt-1">
            Müşteri soruları, teknik kat planı talepleri, satış öncesi bilgi ve destek kayıtları.
          </p>
        </div>

        <GlassButton
          variant="gold"
          size="sm"
          icon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => setIsAddModalOpen(true)}
          className="rounded-full px-4 text-xs font-semibold"
        >
          Yeni Talep Kaydet
        </GlassButton>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-2 p-4 rounded-[20px] bg-[#282522] border border-[#4a443f]">
        <span className="text-xs text-[#8c857f] mr-1">Filtre:</span>
        {['ALL', 'Açık', 'İşlemde', 'Çözüldü'].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
              filterStatus === s
                ? 'bg-[#b99881] text-[#282522] font-bold shadow-sm'
                : 'bg-[#34302d] text-[#a69f99] hover:text-white border border-[#4a443f]'
            }`}
          >
            {s === 'ALL' ? 'Tümü' : s}
          </button>
        ))}
      </div>

      {/* Talep Kartları */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center rounded-[24px] bg-[#282522] border border-[#4a443f]">
          <AlertCircle className="w-10 h-10 text-[#8c857f] mx-auto mb-3 opacity-40" />
          <h3 className="text-sm font-semibold text-white">Talep kaydı bulunamadı</h3>
          <p className="text-xs text-[#8c857f] mt-1">
            Açık veya işlemde müşteri talebi bulunmamaktadır.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((req) => (
            <div
              key={req.id}
              className="p-5 rounded-[20px] bg-[#282522] border border-[#4a443f] hover:border-[#b99881]/70 transition-all flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-bold text-white line-clamp-1">{req.subject}</span>
                  <GlassBadge
                    size="sm"
                    variant={req.status === 'Çözüldü' ? 'success' : req.status === 'İşlemde' ? 'warning' : 'danger'}
                  >
                    {req.status}
                  </GlassBadge>
                </div>

                <div className="space-y-1 text-xs text-[#a69f99] mt-3">
                  <div className="flex items-center gap-1.5 text-white font-medium">
                    <User className="w-3.5 h-3.5 text-[#b99881]" />
                    <span>{req.customerName}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-[#8c857f]" />
                    <span>{req.customerPhone}</span>
                  </div>
                  <div className="text-[11px] text-[#8c857f] pt-1">
                    Kategori: {req.category} • Öncelik: {req.priority}
                  </div>
                  {req.notes && (
                    <div className="p-2 rounded-[10px] bg-[#34302d] text-[11px] text-[#d6beae] mt-2">
                      {req.notes}
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-[#4a443f]/60 flex items-center justify-between text-xs">
                <span className="text-[#8c857f] text-[10px]">Temsilci: {req.assignedToUserName}</span>
                <div className="flex items-center gap-1.5">
                  {req.status !== 'İşlemde' && req.status !== 'Çözüldü' && (
                    <button
                      onClick={() => handleStatusChange(req.id, 'İşlemde')}
                      className="px-2 py-1 rounded-[8px] bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 text-[11px] font-semibold cursor-pointer"
                    >
                      İşleme Al
                    </button>
                  )}
                  {req.status !== 'Çözüldü' && (
                    <button
                      onClick={() => handleStatusChange(req.id, 'Çözüldü')}
                      className="px-2 py-1 rounded-[8px] bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-[11px] font-semibold cursor-pointer"
                    >
                      Çözüldü
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* YENİ TALEP MODALI */}
      <GlassModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Yeni Müşteri Destek / Bilgi Talebi"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Müşteri Adı Soyadı *
              </label>
              <input
                type="text"
                required
                placeholder="Örn: Ahmet Ulucak"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Telefon Numarası
              </label>
              <input
                type="text"
                placeholder="+90 542 000 00 00"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
              Talep Konusu *
            </label>
            <input
              type="text"
              required
              placeholder="Örn: Balkon cam kapama ve mimari izin süreci"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Kategori
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              >
                <option value="Proje & Kat Planı">Proje & Kat Planı</option>
                <option value="Satış Öncesi Bilgi">Satış Öncesi Bilgi</option>
                <option value="Ödeme & Finansman">Ödeme & Finansman</option>
                <option value="Satış Sonrası Destek">Satış Sonrası Destek</option>
                <option value="Genel Talep">Genel Talep</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Öncelik
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as RequestPriority)}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              >
                <option value="Düşük">Düşük</option>
                <option value="Orta">Orta</option>
                <option value="Yüksek">Yüksek</option>
                <option value="Acil">Acil</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
              Ayrıntılı Talep Notu
            </label>
            <textarea
              rows={3}
              placeholder="Müşterinin ilettiği özel detaylar..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white placeholder-[#8c857f] focus:outline-none focus:border-[#b99881]"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 rounded-full text-xs text-[#a69f99] hover:text-white cursor-pointer"
            >
              Vazgeç
            </button>
            <GlassButton type="submit" variant="gold" size="sm" className="rounded-full px-5 font-bold">
              Talebi Kaydet
            </GlassButton>
          </div>
        </form>
      </GlassModal>
    </div>
  )
}
