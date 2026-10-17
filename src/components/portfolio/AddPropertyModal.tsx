import React, { useState } from 'react'
import { GlassModal } from '@/components/ui/GlassModal'
import { GlassButton } from '@/components/ui/GlassButton'
import { GlassInput } from '@/components/ui/GlassInput'
import { PortfolioItem, PropertyType, PropertyStatus } from '@/types/portfolio'

interface AddPropertyModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (item: Omit<PortfolioItem, 'id' | 'createdAt'>) => void
}

export const AddPropertyModal: React.FC<AddPropertyModalProps> = ({
  isOpen,
  onClose,
  onAdd,
}) => {
  const [formData, setFormData] = useState({
    title: '',
    projectCode: 'DMT-NEW-01',
    type: '2+1' as PropertyType,
    location: 'Karasu, Sakarya',
    price: '',
    currency: 'TRY' as 'TRY' | 'USD' | 'EUR',
    netM2: '',
    grossM2: '',
    floor: '5. Kat',
    features: 'Akıllı Ev, Havuz, Otopark, Güvenlik',
    imageUrl: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80',
    description: '',
    status: 'AVAILABLE' as PropertyStatus,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim() || !formData.price) return

    onAdd({
      title: formData.title.trim(),
      projectCode: formData.projectCode.trim(),
      type: formData.type,
      location: formData.location.trim(),
      price: Number(formData.price),
      currency: formData.currency,
      netM2: Number(formData.netM2) || 80,
      grossM2: Number(formData.grossM2) || 100,
      floor: formData.floor,
      features: formData.features.split(',').map((f) => f.trim()).filter(Boolean),
      imageUrl: formData.imageUrl.trim() || 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80',
      description: formData.description.trim(),
      status: formData.status,
    })

    onClose()
  }

  return (
    <GlassModal
      isOpen={isOpen}
      onClose={onClose}
      title="Demirtürk Portföy - Yeni Gayrimenkul Ekle"
      description="Portföy envanterine yeni satılık/kiralık konut veya yatırım projesi kaydedin."
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <GlassInput
          label="İlan / Proje Başlığı *"
          placeholder="Örn: Demirtürk Prestige - 2+1 Lüks Daire"
          required
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <GlassInput
            label="Proje Kodu"
            value={formData.projectCode}
            onChange={(e) => setFormData({ ...formData, projectCode: e.target.value })}
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">
              Konut Tipi
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as PropertyType })}
              className="w-full rounded-full bg-navy-950 border border-white/10 px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-gold/60"
            >
              <option value="1+1">1+1 Rezidans</option>
              <option value="2+1">2+1 Daire</option>
              <option value="3+1">3+1 Daire</option>
              <option value="4+1">4+1 Lüks Daire</option>
              <option value="Villa">Müstakil Villa</option>
              <option value="Dubleks">Dubleks</option>
              <option value="Penthouse">Penthouse</option>
              <option value="Ticari">Ticari / Ofis</option>
              <option value="Arsa">Arsa</option>
            </select>
          </div>

          <GlassInput
            label="Konum"
            placeholder="Örn: Karasu, Sakarya"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <GlassInput
            label="Fiyat *"
            type="number"
            placeholder="Örn: 5250000"
            required
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
          />

          <GlassInput
            label="Net m²"
            type="number"
            placeholder="Örn: 85"
            value={formData.netM2}
            onChange={(e) => setFormData({ ...formData, netM2: e.target.value })}
          />

          <GlassInput
            label="Brüt m²"
            type="number"
            placeholder="Örn: 110"
            value={formData.grossM2}
            onChange={(e) => setFormData({ ...formData, grossM2: e.target.value })}
          />
        </div>

        <GlassInput
          label="Özellikler (Virgülle ayırın)"
          value={formData.features}
          onChange={(e) => setFormData({ ...formData, features: e.target.value })}
        />

        <GlassInput
          label="Görsel URL"
          value={formData.imageUrl}
          onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
        />

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-300">
            Açıklama & Detaylar
          </label>
          <textarea
            rows={2}
            placeholder="Projenin öne çıkan mimari ve yatırım detayları..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full rounded-xl bg-white/[0.04] border border-white/10 p-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-brand-gold/60"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <GlassButton variant="subtle" size="sm" type="button" onClick={onClose}>
            İptal
          </GlassButton>
          <GlassButton variant="gold" size="sm" type="submit">
            Portföye Ekle
          </GlassButton>
        </div>
      </form>
    </GlassModal>
  )
}
