import React, { useState, useEffect } from 'react'
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  MessageCircle,
  Building,
  Briefcase,
  Trash2,
  Edit2,
  X,
  UserCheck,
  Tag,
  Filter,
} from 'lucide-react'
import { contactStore, Contact, ContactCategory } from '@/services/contactStore'
import { userStore } from '@/services/userStore'
import { GlassButton } from '@/components/ui/GlassButton'
import { GlassBadge } from '@/components/ui/GlassBadge'
import { GlassModal } from '@/components/ui/GlassModal'
import { PhoneInput } from '@/components/common/PhoneInput'
import { formatPhoneNumber, generateWhatsAppUrl } from '@/utils/formatters'

export const ContactsView: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>(contactStore.getAll())
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)

  const [form, setForm] = useState<{
    fullName: string
    phone: string
    email: string
    category: ContactCategory
    company: string
    title: string
    notes: string
  }>({
    fullName: '',
    phone: '',
    email: '',
    category: 'MUSTERI',
    company: '',
    title: '',
    notes: '',
  })

  // Subscribe to contact store updates
  useEffect(() => {
    const unsub = contactStore.subscribe(() => {
      setContacts(contactStore.getAll())
    })
    return unsub
  }, [])

  // Combine store contacts with any registered team members if desired
  const allUsers = userStore.getAllUsers()
  // We can create virtual contacts for team members if they aren't in contacts already
  const teamMemberContacts: Contact[] = allUsers
    .filter((u) => !contacts.some((c) => c.fullName.toLowerCase() === u.fullName.toLowerCase()))
    .map((u) => ({
      id: `usr-${u.id}`,
      fullName: u.fullName,
      phone: '+90 532 000 0000',
      email: u.email || `${u.username}@demirturk.com`,
      category: 'EKIP',
      company: u.companyName || 'Demirtürk Gayrimenkul',
      title: u.isManager || u.role === 'ADMIN' ? 'Yönetici' : `${u.department} Danışmanı`,
      notes: `@${u.username}`,
      createdAt: u.createdAt,
    }))

  const combinedContacts = [...contacts, ...teamMemberContacts]

  // Filter contacts
  const filteredContacts = combinedContacts.filter((contact) => {
    if (selectedCategory !== 'ALL' && contact.category !== selectedCategory) return false
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      contact.fullName.toLowerCase().includes(q) ||
      contact.phone.includes(q) ||
      (contact.email && contact.email.toLowerCase().includes(q)) ||
      (contact.company && contact.company.toLowerCase().includes(q)) ||
      (contact.title && contact.title.toLowerCase().includes(q))
    )
  })

  const categoryLabels: Record<ContactCategory, { label: string; color: string }> = {
    EKIP: { label: 'Ekip & Danışman', color: '#b99881' },
    MUSTERI: { label: 'Müşteri / Alıcı', color: '#60a5fa' },
    ORTAK: { label: 'İş Ortağı & Noter', color: '#34d399' },
    DIGER: { label: 'Diğer', color: '#a69f99' },
  }

  const handleOpenAdd = () => {
    setEditingContact(null)
    setForm({
      fullName: '',
      phone: '',
      email: '',
      category: 'MUSTERI',
      company: '',
      title: '',
      notes: '',
    })
    setIsModalOpen(true)
  }

  const handleOpenEdit = (contact: Contact) => {
    // If it's a virtual team member, allow creating a permanent entry
    setEditingContact(contact)
    setForm({
      fullName: contact.fullName,
      phone: contact.phone,
      email: contact.email || '',
      category: contact.category,
      company: contact.company || '',
      title: contact.title || '',
      notes: contact.notes || '',
    })
    setIsModalOpen(true)
  }

  const handleDelete = (id: string) => {
    if (id.startsWith('usr-')) {
      alert('Sistem ekip üyeleri Ayarlar > Ekip Yönetimi alanından yönetilir.')
      return
    }
    if (confirm('Bu kişiyi rehberden silmek istediğinize emin misiniz?')) {
      contactStore.delete(id)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.fullName.trim() || !form.phone.trim()) return

    if (editingContact && !editingContact.id.startsWith('usr-')) {
      contactStore.update(editingContact.id, {
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        category: form.category,
        company: form.company.trim() || undefined,
        title: form.title.trim() || undefined,
        notes: form.notes.trim() || undefined,
      })
    } else {
      contactStore.add({
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        category: form.category,
        company: form.company.trim() || undefined,
        title: form.title.trim() || undefined,
        notes: form.notes.trim() || undefined,
      })
    }

    setIsModalOpen(false)
  }

  return (
    <div className="space-y-6">
      {/* Header Bar (Katmansız & Çizgisiz) */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#b99881]/15 border border-[#b99881]/30 flex items-center justify-center text-[#b99881]">
              <UserCheck className="w-4 h-4" />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-wide">
              Kişiler
            </h2>
          </div>
          <p className="text-xs text-[#a69f99] mt-1">
            Ekip arkadaşlarınız, yatırımcılar, alıcılar, noterler, eksperler ve iş ortaklarınızın iletişim rehberi.
          </p>
        </div>

        {/* Action Button: Yeni Kişi Ekle */}
        <div className="flex items-center gap-3">
          <GlassButton
            variant="gold"
            size="sm"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={handleOpenAdd}
            className="rounded-full px-5 font-bold shadow-sm"
          >
            Yeni Kişi Ekle
          </GlassButton>
        </div>
      </div>

      {/* Filter and Search Bar (Pill Shaped) */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-2.5 rounded-full bg-[#282522]/70 border border-[#4a443f]">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'ALL', label: 'Tümü', count: combinedContacts.length },
            { id: 'EKIP', label: 'Ekip & Danışmanlar', count: combinedContacts.filter((c) => c.category === 'EKIP').length },
            { id: 'MUSTERI', label: 'Müşteriler', count: combinedContacts.filter((c) => c.category === 'MUSTERI').length },
            { id: 'ORTAK', label: 'İş Ortakları & Noter', count: combinedContacts.filter((c) => c.category === 'ORTAK').length },
          ].map((cat) => {
            const isActive = selectedCategory === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#423c38] text-white border border-[#b99881]/50 font-bold'
                    : 'text-[#a69f99] hover:text-white hover:bg-white/5'
                }`}
              >
                <span>{cat.label}</span>
                <span className="text-[10px] opacity-70">({cat.count})</span>
              </button>
            )
          })}
        </div>

        {/* Search Box */}
        <div className="relative w-48 sm:w-64">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#a69f99]" />
          <input
            type="text"
            placeholder="Kişilerde ara (ad, tel, kurum)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#34302d] border border-[#4a443f] rounded-full pl-9 pr-3.5 py-1 text-xs text-white placeholder-[#8c857f] focus:outline-none focus:border-[#b99881]"
          />
        </div>
      </div>

      {/* Contacts Grid */}
      {filteredContacts.length === 0 ? (
        <div className="p-16 text-center rounded-[32px] bg-[#282522]/40 border border-dashed border-[#4a443f] flex flex-col items-center justify-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-[#34302d] border border-[#4a443f] flex items-center justify-center text-[#b99881]">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-base font-bold text-white">Rehberde Kayıtlı Kişi Bulunmuyor</h4>
            <p className="text-xs text-[#a69f99] mt-1">
              {contacts.length === 0
                ? "Henüz kişi eklenmedi. 'Yeni Kişi Ekle' butonunu kullanarak ilk kişiyi ekleyebilirsiniz."
                : 'Arama kriterlerinize uygun kişi bulunamadı.'}
            </p>
          </div>
          <GlassButton
            variant="gold"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={handleOpenAdd}
            className="rounded-full px-5 mt-2"
          >
            Yeni Kişi Ekle
          </GlassButton>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredContacts.map((contact) => {
            const catInfo = categoryLabels[contact.category] || categoryLabels.DIGER
            const initials = contact.fullName
              .split(' ')
              .map((p) => p[0])
              .slice(0, 2)
              .join('')
              .toUpperCase()

            return (
              <div
                key={contact.id}
                className="group p-5 rounded-[28px] bg-[#282522]/70 hover:bg-[#282522] border border-[#4a443f] hover:border-[#b99881]/40 transition-all flex flex-col justify-between space-y-4 shadow-glass"
              >
                {/* Top: Avatar + Name + Category Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-[#34302d] border border-[#b99881]/40 flex items-center justify-center text-sm font-bold text-[#b99881] shrink-0">
                      {initials}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white group-hover:text-[#d6beae] transition-colors">
                        {contact.fullName}
                      </h4>
                      {contact.title && (
                        <p className="text-xs text-[#a69f99] mt-0.5">{contact.title}</p>
                      )}
                      {contact.company && (
                        <p className="text-[11px] text-[#8c857f] flex items-center gap-1 mt-0.5">
                          <Building className="w-3 h-3 text-[#b99881]" />
                          <span>{contact.company}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <span
                    className="text-[10px] px-2.5 py-0.5 rounded-full font-bold border shrink-0"
                    style={{
                      borderColor: `${catInfo.color}40`,
                      backgroundColor: `${catInfo.color}15`,
                      color: catInfo.color,
                    }}
                  >
                    {catInfo.label}
                  </span>
                </div>

                {/* Notes if any */}
                {contact.notes && (
                  <p className="text-xs text-[#a69f99] bg-[#34302d]/40 p-2.5 rounded-[18px] border border-[#4a443f]/60 line-clamp-2">
                    {contact.notes}
                  </p>
                )}

                {/* Bottom Actions Row */}
                <div className="pt-3 border-t border-[#4a443f] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {/* WhatsApp */}
                    <a
                      href={generateWhatsAppUrl(contact.phone, `Merhaba Sayın ${contact.fullName}, Demirtürk Portföy'den yazıyorum.`)}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors"
                      title="WhatsApp Mesajı Aç"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </a>

                    {/* Phone Call */}
                    <a
                      href={`tel:${contact.phone}`}
                      className="p-2 rounded-full bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 transition-colors"
                      title={formatPhoneNumber(contact.phone)}
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>

                    {/* Email */}
                    {contact.email && (
                      <a
                        href={`mailto:${contact.email}`}
                        className="p-2 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 transition-colors"
                        title={contact.email}
                      >
                        <Mail className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {!contact.id.startsWith('usr-') && (
                      <>
                        <button
                          onClick={() => handleOpenEdit(contact)}
                          className="p-1.5 rounded-full hover:bg-white/10 text-[#a69f99] hover:text-white transition-colors"
                          title="Düzenle"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(contact.id)}
                          className="p-1.5 rounded-full hover:bg-rose-500/20 text-[#a69f99] hover:text-rose-400 transition-colors"
                          title="Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add / Edit Contact Modal */}
      <GlassModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingContact ? 'Kişiyi Düzenle' : 'Yeni Kişi Ekle'}
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="text-[#a69f99] block mb-1">Ad Soyad *</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Mehmet Özkan"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  className="w-full bg-[#34302d] border border-[#4a443f] rounded-full px-4 py-2 text-white focus:outline-none focus:border-[#b99881]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#a69f99] block mb-1">Kategori *</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value as ContactCategory })}
                    className="w-full bg-[#34302d] border border-[#4a443f] rounded-full px-4 py-2 text-white focus:outline-none focus:border-[#b99881]"
                  >
                    <option value="MUSTERI">Müşteri / Alıcı</option>
                    <option value="EKIP">Ekip & Danışman</option>
                    <option value="ORTAK">İş Ortağı & Noter</option>
                    <option value="DIGER">Diğer</option>
                  </select>
                </div>
                <div>
                  <PhoneInput
                    label="Telefon *"
                    value={form.phone}
                    onChange={(val) => setForm({ ...form, phone: val })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#a69f99] block mb-1">E-posta</label>
                  <input
                    type="email"
                    placeholder="ornek@alan.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full bg-[#34302d] border border-[#4a443f] rounded-full px-4 py-2 text-white focus:outline-none focus:border-[#b99881]"
                  />
                </div>
                <div>
                  <label className="text-[#a69f99] block mb-1">Şirket / Kurum</label>
                  <input
                    type="text"
                    placeholder="Örn: Kadıköy 4. Noterliği"
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                    className="w-full bg-[#34302d] border border-[#4a443f] rounded-full px-4 py-2 text-white focus:outline-none focus:border-[#b99881]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[#a69f99] block mb-1">Unvan / Görev</label>
                <input
                  type="text"
                  placeholder="Örn: Başkatip, Yatırım Danışmanı, Avukat"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full bg-[#34302d] border border-[#4a443f] rounded-full px-4 py-2 text-white focus:outline-none focus:border-[#b99881]"
                />
              </div>

              <div>
                <label className="text-[#a69f99] block mb-1">Notlar</label>
                <textarea
                  rows={2}
                  placeholder="İlgili projeler, referans veya hatırlatmalar..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full bg-[#34302d] border border-[#4a443f] rounded-2xl px-4 py-2 text-white focus:outline-none focus:border-[#b99881] resize-none"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-1.5 rounded-full border border-[#4a443f] text-[#a69f99] hover:text-white"
                >
                  İptal
                </button>
                <GlassButton type="submit" variant="gold" size="sm" className="rounded-full px-5 font-bold">
                  {editingContact ? 'Kaydet' : 'Kişiyi Ekle'}
                </GlassButton>
              </div>
            </form>
      </GlassModal>
    </div>
  )
}
