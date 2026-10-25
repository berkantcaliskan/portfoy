import React, { useState, useEffect } from 'react'
import {
  Calendar,
  Clock,
  MapPin,
  Plus,
  Video,
  Building,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  User,
  Phone,
  Filter,
} from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlassButton } from '@/components/ui/GlassButton'
import { GlassBadge } from '@/components/ui/GlassBadge'
import { GlassModal } from '@/components/ui/GlassModal'
import {
  appointmentStore,
  Appointment,
  AppointmentType,
  AppointmentStatus,
} from '@/services/appointmentStore'
import { userStore, AppUser } from '@/services/userStore'
import { Lead } from '@/types/lead'
import { PhoneInput } from '@/components/common/PhoneInput'
import { formatAppointmentDate, toTitleCase } from '@/utils/formatters'

interface AppointmentsViewProps {
  pageTitle?: string
  subtitle?: string
  leads?: Lead[]
}

export const AppointmentsView: React.FC<AppointmentsViewProps> = ({
  pageTitle = 'Randevular',
  subtitle = 'Müşteri görüşmeleri, proje sunumları ve şantiye ziyaretleri takvimi.',
  leads = [],
}) => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(userStore.getCurrentUser())
  const [appointments, setAppointments] = useState<Appointment[]>(() => appointmentStore.getAll(currentUser))
  const [filterType, setFilterType] = useState<string>('ALL')
  const [filterStatus, setFilterStatus] = useState<string>('ALL')

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [isOutcomeModalOpen, setIsOutcomeModalOpen] = useState(false)
  const [outcomeStatus, setOutcomeStatus] = useState<AppointmentStatus>('COMPLETED')
  const [outcomeNote, setOutcomeNote] = useState('')

  // Add form
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [time, setTime] = useState('14:00')
  const [location, setLocation] = useState('Demirtürk Panorama Satış Ofisi')
  const [type, setType] = useState<AppointmentType>('ON_SITE')
  const [projectName, setProjectName] = useState('Demirtürk Panorama Rezidans')
  const [assignedToUserName, setAssignedToUserName] = useState(currentUser?.fullName || 'Satış Danışmanı')
  const [notes, setNotes] = useState('')

  const allUsers = userStore.getAllUsers()

  useEffect(() => {
    const unsub = appointmentStore.subscribe(() => {
      setAppointments(appointmentStore.getAll(userStore.getCurrentUser()))
    })
    const unsubUser = userStore.subscribe(() => {
      const u = userStore.getCurrentUser()
      setCurrentUser(u)
      setAppointments(appointmentStore.getAll(u))
    })
    return () => {
      unsub()
      unsubUser()
    }
  }, [])

  const filtered = appointments.filter((a) => {
    if (filterType !== 'ALL' && a.type !== filterType) return false
    if (filterStatus !== 'ALL' && a.status !== filterStatus) return false
    return true
  })

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!customerName.trim()) return

    const effectiveUser =
      currentUser ||
      userStore.getCurrentUser() ||
      ({
        id: 'usr-demo-rel',
        fullName: 'Müşteri Temsilcisi',
        department: 'Müşteri İlişkileri',
        role: 'SPECIALIST',
        companyName: 'Demirtürk Portföy',
        departments: ['Müşteri İlişkileri'],
        isManager: false,
        scope: 'ALL',
        permissions: {},
        username: 'temsilci',
        password: '',
        createdAt: new Date().toISOString(),
      } as AppUser)

    appointmentStore.createAppointment(
      {
        customerName,
        customerPhone,
        date,
        time,
        location,
        type,
        assignedToUserName,
        projectName,
        notes,
      },
      effectiveUser
    )

    setIsAddModalOpen(false)
    setCustomerName('')
    setCustomerPhone('')
    setNotes('')
  }

  const handleOpenOutcome = (apt: Appointment, targetStatus: AppointmentStatus) => {
    setSelectedAppointment(apt)
    setOutcomeStatus(targetStatus)
    setOutcomeNote('')
    setIsOutcomeModalOpen(true)
  }

  const handleSaveOutcome = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAppointment) return

    appointmentStore.updateStatus(selectedAppointment.id, outcomeStatus, outcomeNote)
    setIsOutcomeModalOpen(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-[#b99881]" />
            <h2 className="text-2xl font-bold text-white tracking-wide">
              {pageTitle}
            </h2>
          </div>
          <p className="text-xs text-[#a69f99] mt-1">
            {subtitle}
          </p>
        </div>

        <GlassButton
          variant="gold"
          size="sm"
          icon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => setIsAddModalOpen(true)}
          className="rounded-full px-4 text-xs font-semibold"
        >
          Randevu Oluştur
        </GlassButton>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-xs text-[#8c857f] mr-1">Filtre:</span>
          {['ALL', 'ON_SITE', 'ONLINE', 'OFFICE'].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                filterType === t
                  ? 'bg-[#b99881] text-[#282522] font-bold shadow-sm'
                  : 'bg-[#34302d] text-[#a69f99] hover:text-white border border-[#4a443f]'
              }`}
            >
              {t === 'ALL' ? 'Tüm Türler' : t === 'ON_SITE' ? 'Şantiye' : t === 'ONLINE' ? 'Online' : 'Ofis'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {['ALL', 'SCHEDULED', 'COMPLETED', 'CANCELLED'].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                filterStatus === s
                  ? 'bg-[#b99881] text-[#282522] font-bold shadow-sm'
                  : 'bg-[#34302d] text-[#a69f99] hover:text-white border border-[#4a443f]'
              }`}
            >
              {s === 'ALL' ? 'Tümü' : s === 'SCHEDULED' ? 'Planlanan' : s === 'COMPLETED' ? 'Tamamlanan' : 'İptal'}
            </button>
          ))}
        </div>
      </div>

      {/* Randevu Kartları */}
      {filtered.length === 0 ? (
        <div className="py-20 text-center flex flex-col items-center justify-center">
          <Calendar className="w-10 h-10 text-[#8c857f] mx-auto mb-3 opacity-40" />
          <h3 className="text-sm font-semibold text-white">Kayıtlı randevu bulunamadı</h3>
          <p className="text-xs text-[#8c857f] mt-1 max-w-sm mx-auto">
            Seçili filtrelere uygun planlanmış bir randevu veya görüşme kaydı bulunmuyor.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((apt) => {
            const isDone = apt.status === 'COMPLETED'
            const isCancelled = apt.status === 'CANCELLED'

            return (
              <div
                key={apt.id}
                className={`p-5 rounded-[20px] border transition-all duration-200 flex flex-col justify-between space-y-3 ${
                  isDone
                    ? 'bg-[#24211f] border-emerald-500/20 opacity-80'
                    : isCancelled
                    ? 'bg-[#24211f] border-rose-500/20 opacity-60'
                    : 'bg-[#282522] border-[#4a443f] hover:border-[#b99881]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-[#b99881]" />
                      {apt.customerName}
                    </span>
                    <GlassBadge
                      size="sm"
                      variant={isDone ? 'success' : isCancelled ? 'danger' : 'primary'}
                    >
                      {apt.status === 'SCHEDULED' ? 'Planlandı' : apt.status === 'COMPLETED' ? 'Tamamlandı' : 'İptal'}
                    </GlassBadge>
                  </div>

                  <div className="space-y-1.5 text-xs text-[#a69f99] mt-3">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-[#8c857f]" />
                      <span>{apt.customerPhone}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-[#8c857f]" />
                      <span>{formatAppointmentDate(apt.date, apt.time)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-[#8c857f]" />
                      <span className="truncate">{apt.location}</span>
                    </div>
                    {apt.projectName && (
                      <div className="flex items-center gap-2 text-[#b99881]">
                        <Building className="w-3.5 h-3.5" />
                        <span>{apt.projectName}</span>
                      </div>
                    )}
                    {apt.notes && (
                      <p className="text-[11px] text-[#d6beae] mt-2 italic">
                        "{apt.notes}"
                      </p>
                    )}
                    {apt.outcomeNote && (
                      <p className="text-[11px] text-white mt-1 font-medium">
                        Sonuç: {apt.outcomeNote}
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between text-xs">
                  <span className="text-[#8c857f] text-[11px]">Sorumlu: {apt.assignedToUserName}</span>
                  {apt.status === 'SCHEDULED' && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenOutcome(apt, 'COMPLETED')}
                        className="p-1.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors cursor-pointer"
                        title="Randevuyu Tamamlandı Olarak İşaretle"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenOutcome(apt, 'CANCELLED')}
                        className="p-1.5 rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
                        title="Randevuyu İptal Et"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* YENİ RANDEVU MODALI */}
      <GlassModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Yeni Randevu ve Görüşme Planla"
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
                onChange={(e) => setCustomerName(toTitleCase(e.target.value))}
                className="w-full px-3.5 py-2 rounded-full bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Telefon Numarası *
              </label>
              <PhoneInput
                required
                value={customerPhone}
                onChange={(val) => setCustomerPhone(val)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Tarih *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-full bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Saat *
              </label>
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3.5 py-2 rounded-full bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Görüşme Türü
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as AppointmentType)}
                className="w-full px-3.5 py-2 rounded-full bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              >
                <option value="ON_SITE">Şantiye / Proje</option>
                <option value="OFFICE">Satış Ofisi</option>
                <option value="ONLINE">Online (Meet/Zoom)</option>
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
                value={projectName}
                onChange={(e) => setProjectName(toTitleCase(e.target.value))}
                className="w-full px-3.5 py-2 rounded-full bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Atanan Danışman
              </label>
              <select
                value={assignedToUserName}
                onChange={(e) => setAssignedToUserName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-full bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              >
                {allUsers.map((u) => (
                  <option key={u.id} value={u.fullName}>
                    {u.fullName} ({u.department})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
              Konum / Toplantı Linki
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(toTitleCase(e.target.value))}
              className="w-full px-3.5 py-2 rounded-full bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
              Görüşme Notu / Ajanda
            </label>
            <textarea
              rows={2}
              placeholder="Görüşülecek daire tipleri, ödeme alternatifleri vb."
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
              Randevuyu Kaydet
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      {/* SONUÇ NOTU MODALI */}
      <GlassModal
        isOpen={isOutcomeModalOpen}
        onClose={() => setIsOutcomeModalOpen(false)}
        title={`Görüşme Sonucu - ${selectedAppointment?.customerName}`}
      >
        <form onSubmit={handleSaveOutcome} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
              Görüşme Durumu
            </label>
            <div className="flex gap-3 text-xs">
              <button
                type="button"
                onClick={() => setOutcomeStatus('COMPLETED')}
                className={`flex-1 py-2 rounded-full border font-semibold cursor-pointer ${
                  outcomeStatus === 'COMPLETED'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                    : 'bg-[#24211f] border-[#4a443f] text-[#a69f99]'
                }`}
              >
                Tamamlandı
              </button>
              <button
                type="button"
                onClick={() => setOutcomeStatus('CANCELLED')}
                className={`flex-1 py-2 rounded-full border font-semibold cursor-pointer ${
                  outcomeStatus === 'CANCELLED'
                    ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                    : 'bg-[#24211f] border-[#4a443f] text-[#a69f99]'
                }`}
              >
                İptal / Gelmedi
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
              Görüşme Sonuç Notu
            </label>
            <textarea
              rows={3}
              required
              placeholder="Müşterinin geri bildirimi, teklif sonucu veya takip adımı..."
              value={outcomeNote}
              onChange={(e) => setOutcomeNote(e.target.value)}
              className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white placeholder-[#8c857f] focus:outline-none focus:border-[#b99881]"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsOutcomeModalOpen(false)}
              className="px-4 py-2 rounded-full text-xs text-[#a69f99] hover:text-white cursor-pointer"
            >
              Vazgeç
            </button>
            <GlassButton type="submit" variant="gold" size="sm" className="rounded-full px-5 font-bold">
              Durumu Güncelle
            </GlassButton>
          </div>
        </form>
      </GlassModal>
    </div>
  )
}
