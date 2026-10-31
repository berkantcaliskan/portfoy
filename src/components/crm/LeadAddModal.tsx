import React, { useState } from 'react'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { GlassModal } from '@/components/ui/GlassModal'
import { GlassButton } from '@/components/ui/GlassButton'
import { GlassInput } from '@/components/ui/GlassInput'
import { PhoneInput } from '@/components/common/PhoneInput'
import { Lead, LeadStage, CallCenterStatus, CALL_STATUS_OPTIONS } from '@/types/lead'
import { userStore } from '@/services/userStore'

interface LeadAddModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (lead: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>) => void
}

const STAGES: { stage: LeadStage; label: string }[] = [
  { stage: 'NEW', label: 'Potansiyel Müşteri' },
  { stage: 'CONTACTED', label: 'İletişim' },
  { stage: 'QUALIFIED', label: 'Nitelikli' },
  { stage: 'OFFER', label: 'Teklif' },
  { stage: 'WON', label: 'Dönüşüm' },
  { stage: 'LOST', label: 'Potansiyel Değil' },
]

export const HOUSING_TYPES = [
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
  const allUsers = userStore.getAllUsers()
  const customerRelationsUsers = allUsers.filter(
    (u) =>
      (u.department === 'Müşteri İlişkileri' ||
        u.departments?.includes('Müşteri İlişkileri')) &&
      u.role !== 'ADMIN'
  )

  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    callStatus: 'WAITING' as CallCenterStatus,
    stage: 'NEW' as LeadStage,
    assignedUserId: '',
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
      callStatus: 'WAITING',
      stage: 'NEW',
      assignedUserId: '',
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

    const assignedUser = customerRelationsUsers.find(
      (u) => u.id === formData.assignedUserId
    )

    onAdd({
      fullName: formData.fullName.trim(),
      phone: formData.phone.trim(),
      whatsappPhone: formData.phone.trim(),
      source: 'DIRECT',
      formName: 'Manuel Kayıt',
      channel: 'Manuel Kayıt',
      stage: formData.stage,
      callStatus: formData.callStatus,
      isQualified: formData.stage === 'QUALIFIED',
      owner: assignedUser ? assignedUser.fullName : 'Atanmamış',
      assignedToUserId: assignedUser?.id,
      assignedToUserName: assignedUser?.fullName,
      preferredHousingType: formData.preferredHousingType,
      tags: [formData.preferredHousingType, 'Manuel Kayıt'].filter(Boolean),
      notes: formData.notes.trim() || undefined,
    })

    resetForm()
    onClose()
  }

  return (
    <GlassModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Yeni Müşteri Ekle"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Adı ve Soyadı */}
        <GlassInput
          label="Adı ve Soyadı *"
          placeholder="Örn: Mehmet Demir"
          value={formData.fullName}
          onChange={(e) => {
            setFormData({ ...formData, fullName: e.target.value })
            if (errors.fullName) setErrors({ ...errors, fullName: undefined })
          }}
          error={errors.fullName}
          autoFocus
        />

        {/* Telefon Numarası */}
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

        {/* Bilgi (Call Center) & Aşama (Meta) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#f3efe9]">
              Bilgi (Call Center)
            </label>
            <CustomSelect
              value={formData.callStatus}
              onChange={(e) =>
                setFormData({ ...formData, callStatus: e.target.value as CallCenterStatus })
              }
              className="w-full rounded-full bg-[#24211f] border border-[#4a443f] px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#b99881] cursor-pointer transition-colors"
            >
              {CALL_STATUS_OPTIONS.map((cs) => (
                <option key={cs.id} value={cs.id} className="bg-[#24211f] text-white">
                  {cs.label}
                </option>
              ))}
            </CustomSelect>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#f3efe9]">
              Aşama (Meta)
            </label>
            <CustomSelect
              value={formData.stage}
              onChange={(e) => setFormData({ ...formData, stage: e.target.value as LeadStage })}
              className="w-full rounded-full bg-[#24211f] border border-[#4a443f] px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#b99881] cursor-pointer transition-colors"
            >
              {STAGES.map((s) => (
                <option key={s.stage} value={s.stage} className="bg-[#24211f] text-white">
                  {s.label}
                </option>
              ))}
            </CustomSelect>
          </div>
        </div>

        {/* Danışman Ata & Konut Tipi Tercihi */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#f3efe9]">
              Danışman Ata
            </label>
            <CustomSelect
              value={formData.assignedUserId}
              onChange={(e) => setFormData({ ...formData, assignedUserId: e.target.value })}
              className="w-full rounded-full bg-[#24211f] border border-[#4a443f] px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#b99881] cursor-pointer transition-colors"
            >
              <option value="" className="bg-[#24211f] text-white">
                Danışman ataması yapma
              </option>
              {customerRelationsUsers.map((u) => (
                <option key={u.id} value={u.id} className="bg-[#24211f] text-white">
                  {u.fullName}
                </option>
              ))}
            </CustomSelect>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#f3efe9]">
              Konut Tipi Tercihi
            </label>
            <CustomSelect
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
            </CustomSelect>
          </div>
        </div>

        {/* İlk Görüşme / Talep Notu */}
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
