import React, { useState } from 'react'
import { GlassModal } from '@/components/ui/GlassModal'
import { GlassButton } from '@/components/ui/GlassButton'
import { GlassInput } from '@/components/ui/GlassInput'
import { PhoneInput } from '@/components/common/PhoneInput'
import { Lead, LeadStage, LeadSource } from '@/types/lead'
import { userStore } from '@/services/userStore'

interface LeadAddModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (lead: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>) => void
}

const SOURCES: { source: LeadSource; channel: string; label: string }[] = [
  { source: 'DIRECT', channel: 'Ofis / Lansman Ziyareti', label: 'Ofis / Lansman Ziyareti' },
  { source: 'DIRECT', channel: 'Telefon Çağrısı / Inbound', label: 'Telefon Çağrısı / Gelen Arama' },
  { source: 'WHATSAPP', channel: 'WhatsApp İletişim Hattı', label: 'WhatsApp İletişim Hattı' },
  { source: 'META_ADS', channel: 'Meta / Sosyal Medya', label: 'Sosyal Medya / Reklam' },
  { source: 'WEBSITE', channel: 'Web Sitesi / Portal', label: 'Web Sitesi / Portal' },
  { source: 'REFERRAL', channel: 'Tavsiye / Referans', label: 'Tavsiye / Referans' },
]

const STAGES: { stage: LeadStage; label: string }[] = [
  { stage: 'NEW', label: 'Giriş (Yeni Aday)' },
  { stage: 'CONTACTED', label: 'İlk Görüşme Yapıldı' },
  { stage: 'QUALIFIED', label: 'Nitelikli (Sıcak Portföy)' },
  { stage: 'APPOINTMENT', label: 'Randevu Planlandı' },
  { stage: 'OFFER', label: 'Teklif Aşamasında' },
]

const HOUSING_TYPES = [
  '1+1 Rezidans',
  '2+1 Konut',
  '3+1 Aile Konutu',
  '4+1 / Çatı Dubleks',
  'Müstakil Villa',
  'Ticari / Ofis',
  'Yatırımlık Arsa',
]

export const LeadAddModal: React.FC<LeadAddModalProps> = ({
  isOpen,
  onClose,
  onAdd,
}) => {
  const users = userStore.getAllUsers()

  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    secondaryPhone: '',
    email: '',
    sourceIndex: 0,
    stage: 'NEW' as LeadStage,
    assignedUserId: '',
    budget: '',
    preferredHousingType: '2+1 Konut',
    notes: '',
  })

  const [errors, setErrors] = useState<{
    fullName?: string
    phone?: string
  }>({})

  const resetForm = () => {
    setFormData({
      fullName: '',
      phone: '',
      secondaryPhone: '',
      email: '',
      sourceIndex: 0,
      stage: 'NEW',
      assignedUserId: '',
      budget: '',
      preferredHousingType: '2+1 Konut',
      notes: '',
    })
    setErrors({})
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const newErrors: { fullName?: string; phone?: string } = {}

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Lütfen müşteri ad ve soyadını giriniz.'
    }

    const cleanDigits = formData.phone.replace(/\D/g, '')
    if (!formData.phone.trim() || cleanDigits.length < 10) {
      newErrors.phone = 'Lütfen geçerli bir telefon numarası giriniz (en az 10 haneli).'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    const selectedSource = SOURCES[formData.sourceIndex] || SOURCES[0]
    const assignedUser = users.find((u) => u.id === formData.assignedUserId)

    onAdd({
      fullName: formData.fullName.trim(),
      phone: formData.phone.trim(),
      secondaryPhone: formData.secondaryPhone.trim() || undefined,
      whatsappPhone: formData.phone.trim(),
      email: formData.email.trim() || undefined,
      source: selectedSource.source,
      formName: selectedSource.source === 'META_ADS' ? 'Sosyal Medya Formu' : 'Manuel Kayıt',
      channel: selectedSource.channel,
      stage: formData.stage,
      isQualified: formData.stage === 'QUALIFIED',
      owner: assignedUser ? assignedUser.fullName : 'Atanmamış',
      assignedToUserId: assignedUser?.id,
      assignedToUserName: assignedUser?.fullName,
      budget: formData.budget ? Number(formData.budget) : undefined,
      preferredHousingType: formData.preferredHousingType,
      tags: [selectedSource.channel, formData.preferredHousingType, 'Manuel Kayıt'].filter(Boolean),
      notes: formData.notes.trim() || undefined,
    })

    resetForm()
    onClose()
  }

  return (
    <GlassModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Yeni Müşteri / Lead Ekle"
      description="Demirtürk Portföy CRM sistemine yeni müşteri kaydı oluşturun."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Ad Soyad */}
        <GlassInput
          label="Müşteri Adı Soyadı *"
          placeholder="Örn: Mehmet Demir"
          value={formData.fullName}
          onChange={(e) => {
            setFormData({ ...formData, fullName: e.target.value })
            if (errors.fullName) setErrors({ ...errors, fullName: undefined })
          }}
          error={errors.fullName}
          autoFocus
        />

        {/* Telefon & E-Posta */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <PhoneInput
            label="Telefon Numarası *"
            value={formData.phone}
            onChange={(val) => {
              setFormData({ ...formData, phone: val })
              if (errors.phone) setErrors({ ...errors, phone: undefined })
            }}
            error={errors.phone}
            required
          />

          <GlassInput
            label="E-posta Adresi (İsteğe Bağlı)"
            type="email"
            placeholder="Örn: mehmet@gmail.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
        </div>

        {/* İkincil Telefon / Kanal */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#f3efe9]">
              İletişim Kanalı / Müşteri Kaynağı
            </label>
            <select
              value={formData.sourceIndex}
              onChange={(e) => setFormData({ ...formData, sourceIndex: Number(e.target.value) })}
              className="w-full rounded-full bg-[#24211f] border border-[#4a443f] px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#b99881] cursor-pointer transition-colors"
            >
              {SOURCES.map((s, idx) => (
                <option key={idx} value={idx} className="bg-[#24211f] text-white">
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#f3efe9]">
              Aşama / Müşteri Durumu
            </label>
            <select
              value={formData.stage}
              onChange={(e) => setFormData({ ...formData, stage: e.target.value as LeadStage })}
              className="w-full rounded-full bg-[#24211f] border border-[#4a443f] px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#b99881] cursor-pointer transition-colors"
            >
              {STAGES.map((s) => (
                <option key={s.stage} value={s.stage} className="bg-[#24211f] text-white">
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Danışman Ataması & Konut Tipi */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#f3efe9]">
              Temsilci / Danışman Seçimi
            </label>
            <select
              value={formData.assignedUserId}
              onChange={(e) => setFormData({ ...formData, assignedUserId: e.target.value })}
              className="w-full rounded-full bg-[#24211f] border border-[#4a443f] px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#b99881] cursor-pointer transition-colors"
            >
              <option value="" className="bg-[#24211f] text-white">
                Atanmamış (Otomatik Atama Yok)
              </option>
              {users.map((u) => (
                <option key={u.id} value={u.id} className="bg-[#24211f] text-white">
                  {u.fullName} ({u.department || 'Genel'} - {u.role === 'ADMIN' ? 'Yönetici' : 'Danışman'})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#f3efe9]">
              Konut Tipi Tercihi
            </label>
            <select
              value={formData.preferredHousingType}
              onChange={(e) =>
                setFormData({ ...formData, preferredHousingType: e.target.value })
              }
              className="w-full rounded-full bg-[#24211f] border border-[#4a443f] px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#b99881] cursor-pointer transition-colors"
            >
              {HOUSING_TYPES.map((type) => (
                <option key={type} value={type} className="bg-[#24211f] text-white">
                  {type}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Bütçe & İkinci Telefon */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GlassInput
            label="Bütçe Beklentisi (₺)"
            type="number"
            placeholder="Örn: 5000000"
            value={formData.budget}
            onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
          />

          <GlassInput
            label="İkincil Telefon (İsteğe Bağlı)"
            type="tel"
            placeholder="Örn: 0532 000 00 00"
            value={formData.secondaryPhone}
            onChange={(e) => setFormData({ ...formData, secondaryPhone: e.target.value })}
          />
        </div>

        {/* Notlar */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-[#f3efe9]">
            İlk Görüşme / Talep Notu
          </label>
          <textarea
            rows={2}
            placeholder="Müşterinin özel isteği, ödeme planı tercihi veya görüşme notu..."
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="w-full rounded-[14px] bg-[#24211f] border border-[#4a443f] p-3 text-xs text-white placeholder-[#8c857f] focus:outline-none focus:border-[#b99881] transition-colors resize-none"
          />
        </div>

        {/* Butonlar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <GlassButton variant="subtle" size="sm" type="button" onClick={handleClose}>
            İptal
          </GlassButton>
          <GlassButton variant="gold" size="sm" type="submit" className="px-5 font-bold">
            Müşteriyi Kaydet
          </GlassButton>
        </div>
      </form>
    </GlassModal>
  )
}
