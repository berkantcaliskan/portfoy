import React, { useState } from 'react'
import { GlassModal } from '@/components/ui/GlassModal'
import { GlassButton } from '@/components/ui/GlassButton'
import { GlassInput } from '@/components/ui/GlassInput'
import { Lead, LeadStage } from '@/types/lead'
import { metaStore } from '@/services/metaStore'

interface LeadAddModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (lead: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>) => void
}

export const LeadAddModal: React.FC<LeadAddModalProps> = ({
  isOpen,
  onClose,
  onAdd,
}) => {
  const forms = metaStore.getForms()

  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    formName: forms[0]?.name || 'DMTRK | 1Q KONUT TİPİ | HIGH VOLUME | V1',
    stage: 'NEW' as LeadStage,
    owner: 'Demir Danışmanlık',
    budget: '',
    preferredHousingType: '1+1',
    tags: 'Meta Lead, Manuel',
    notes: '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.fullName.trim() || !formData.phone.trim()) return

    onAdd({
      fullName: formData.fullName.trim(),
      phone: formData.phone.trim(),
      whatsappPhone: formData.phone.trim(),
      email: formData.email.trim() || undefined,
      source: 'META_ADS',
      formName: formData.formName,
      channel: 'Instagram / Meta Ads',
      stage: formData.stage,
      owner: formData.owner,
      budget: formData.budget ? Number(formData.budget) : undefined,
      preferredHousingType: formData.preferredHousingType,
      tags: formData.tags.split(',').map((t) => t.trim()).filter(Boolean),
      notes: formData.notes.trim() || undefined,
    })

    // Reset & close
    setFormData({
      fullName: '',
      phone: '',
      email: '',
      formName: forms[0]?.name || 'DMTRK | 1Q KONUT TİPİ | HIGH VOLUME | V1',
      stage: 'NEW',
      owner: 'Demir Danışmanlık',
      budget: '',
      preferredHousingType: '1+1',
      tags: 'Meta Lead, Manuel',
      notes: '',
    })
    onClose()
  }

  return (
    <GlassModal
      isOpen={isOpen}
      onClose={onClose}
      title="Yeni Müşteri Adayı (Lead) Ekle"
      description="Demirtürk Portföy CRM sistemine yeni lead kaydı oluşturun."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <GlassInput
          label="Müşteri Adı Soyadı *"
          placeholder="Örn: Mehmet Demir"
          required
          value={formData.fullName}
          onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GlassInput
            label="Telefon Numarası *"
            placeholder="Örn: 05421234567"
            required
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />

          <GlassInput
            label="E-posta Adresi"
            type="email"
            placeholder="Örn: mehmet@gmail.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">
              Meta Reklam Formu
            </label>
            <select
              value={formData.formName}
              onChange={(e) => setFormData({ ...formData, formName: e.target.value })}
              className="w-full rounded-full bg-navy-950/80 border border-white/10 px-4 py-2.5 text-xs text-white focus:outline-none focus:border-brand-gold/60"
            >
              {forms.map((f) => (
                <option key={f.id} value={f.name}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">
              Konut Tipi Tercihi
            </label>
            <select
              value={formData.preferredHousingType}
              onChange={(e) =>
                setFormData({ ...formData, preferredHousingType: e.target.value })
              }
              className="w-full rounded-full bg-navy-950/80 border border-white/10 px-4 py-2.5 text-xs text-white focus:outline-none focus:border-brand-gold/60"
            >
              <option value="1+1">1+1 Rezidans</option>
              <option value="2+1">2+1 Konut</option>
              <option value="3+1">3+1 Aile Konutu</option>
              <option value="Villa">Müstakil Villa</option>
              <option value="Ticari">Ticari / Ofis</option>
              <option value="Arsa">Yatırımlık Arsa</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GlassInput
            label="Bütçe Beklentisi (₺)"
            type="number"
            placeholder="Örn: 4500000"
            value={formData.budget}
            onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
          />

          <GlassInput
            label="Temsilci / Danışman"
            value={formData.owner}
            onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-300">
            Açılış Notu
          </label>
          <textarea
            rows={2}
            placeholder="Müşterinin özel isteği, ödeme tercihi vb."
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="w-full rounded-[20px] bg-white/[0.04] border border-white/10 p-3 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-brand-gold/60"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
          <GlassButton variant="subtle" size="sm" type="button" onClick={onClose}>
            İptal
          </GlassButton>
          <GlassButton variant="gold" size="sm" type="submit">
            Kaydet
          </GlassButton>
        </div>
      </form>
    </GlassModal>
  )
}
