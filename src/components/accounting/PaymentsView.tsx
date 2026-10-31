import React, { useState, useEffect } from 'react'
import { CustomSelect } from '@/components/ui/CustomSelect'
import {
  CreditCard,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  DollarSign,
  Briefcase,
} from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlassButton } from '@/components/ui/GlassButton'
import { GlassBadge } from '@/components/ui/GlassBadge'
import { GlassModal } from '@/components/ui/GlassModal'
import { OverflowTabs } from '@/components/ui/OverflowTabs'
import {
  accountingStore,
  PaymentRecord,
  PaymentCategory,
  PaymentStatus,
} from '@/services/accountingStore'
import { userStore, AppUser } from '@/services/userStore'
import { formatCurrency } from '@/utils/formatters'

export const PaymentsView: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(userStore.getCurrentUser())
  const [payments, setPayments] = useState<PaymentRecord[]>(() => accountingStore.getPayments())
  const [filterCategory, setFilterCategory] = useState<string>('ALL')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Add form
  const [title, setTitle] = useState('')
  const [payee, setPayee] = useState('')
  const [category, setCategory] = useState<PaymentCategory>('COMMISSION')
  const [amount, setAmount] = useState<number>(50000)
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0])
  const [invoiceNo, setInvoiceNo] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    const unsub = accountingStore.subscribe(() => {
      setPayments(accountingStore.getPayments())
    })
    return () => unsub()
  }, [])

  const filtered = payments.filter((p) => {
    if (filterCategory !== 'ALL' && p.category !== filterCategory) return false
    return true
  })

  const totalPaid = payments
    .filter((p) => p.status === 'PAID')
    .reduce((acc, p) => acc + p.amount, 0)
  const totalPending = payments
    .filter((p) => p.status === 'PENDING')
    .reduce((acc, p) => acc + p.amount, 0)

  const handleMarkPaid = (id: string) => {
    accountingStore.markPaymentAsPaid(id)
    setSuccessMsg('Ödeme tamamlandı olarak işaretlendi.')
    setTimeout(() => setSuccessMsg(null), 3000)
  }

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !payee.trim() || !amount) return

    accountingStore.addPayment({
      title: title.trim(),
      payee: payee.trim(),
      category,
      amount: Number(amount),
      dueDate,
      status: 'PENDING',
      invoiceNo,
      notes,
    })

    setIsAddModalOpen(false)
    setTitle('')
    setPayee('')
    setSuccessMsg('Yeni gider/ödeme kaydı oluşturuldu.')
    setTimeout(() => setSuccessMsg(null), 3000)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <CreditCard className="w-5 h-5 text-[#b99881]" />
            <h2 className="text-2xl font-bold text-white tracking-wide">
              Ödemeler
            </h2>
          </div>
          <p className="text-xs text-[#a69f99] mt-1">
            Satış danışmanı komisyonları, şantiye müteahhit hakedişleri ve operasyonel giderler.
          </p>
        </div>

        <GlassButton
          variant="gold"
          size="sm"
          icon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => setIsAddModalOpen(true)}
          className="rounded-full px-4 text-xs font-semibold"
        >
          Ödeme Planla
        </GlassButton>
      </div>

      {successMsg && (
        <div className="p-3 rounded-[16px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
          <div className="text-xs text-[#a69f99]">Gerçekleşen Ödemeler</div>
          <div className="text-2xl font-bold text-white mt-1">{formatCurrency(totalPaid)}</div>
          <div className="text-[11px] text-emerald-400 mt-1">Hesaptan çıkan tutar</div>
        </GlassCard>

        <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
          <div className="text-xs text-[#a69f99]">Planlanan Ödemeler</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">{formatCurrency(totalPending)}</div>
          <div className="text-[11px] text-[#8c857f] mt-1">Vadesi yaklaşan hakedişler</div>
        </GlassCard>

        <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
          <div className="text-xs text-[#a69f99]">Toplam Ödeme Kalemi</div>
          <div className="text-2xl font-bold text-sky-400 mt-1">{payments.length}</div>
          <div className="text-[11px] text-[#8c857f] mt-1">Komisyon & Şantiye</div>
        </GlassCard>
      </div>

      {/* Filter Bar */}
      <OverflowTabs
        prefixLabel="Kategori:"
        activeId={filterCategory}
        onSelect={(id) => setFilterCategory(id)}
        tabs={[
          { id: 'ALL', label: 'Tümü' },
          { id: 'COMMISSION', label: 'Danışman Komisyonu' },
          { id: 'CONSTRUCTION', label: 'Şantiye Hakedişi' },
          { id: 'MARKETING', label: 'Pazarlama' },
          { id: 'OFFICE', label: 'Ofis Gideri' },
        ]}
      />

      {/* Tablo (Boşken Katmansız ve Ortalı) */}
      {filtered.length === 0 ? (
        <div className="py-20 text-center flex flex-col items-center justify-center">
          <p className="text-sm font-semibold text-[#f3efe9]">
            Kayıtlı ödeme bulunamadı
          </p>
          <p className="text-xs text-[#a69f99] mt-1">
            Bu kategoriye uygun ödeme veya hakediş kaydı bulunmuyor.
          </p>
        </div>
      ) : (
        <GlassCard className="p-5 bg-[#282522] border-[#4a443f]">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[#4a443f] text-[#8c857f] text-[11px]">
                  <th className="py-2.5 px-3">Başlık</th>
                  <th className="py-2.5 px-3">Alıcı / Firma</th>
                  <th className="py-2.5 px-3">Kategori</th>
                  <th className="py-2.5 px-3">Tutar</th>
                  <th className="py-2.5 px-3">Vade</th>
                  <th className="py-2.5 px-3">Durum</th>
                  <th className="py-2.5 px-3 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#4a443f]/60 text-[#f3efe9]">
                {filtered.map((pay) => (
                  <tr key={pay.id} className="hover:bg-[#34302d] transition-colors">
                    <td className="py-3 px-3 font-semibold text-white">
                      {pay.title}
                      {pay.invoiceNo && (
                        <div className="text-[10px] text-[#8c857f] font-normal">{pay.invoiceNo}</div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-[#a69f99]">{pay.payee}</td>
                    <td className="py-3 px-3">
                      <span className="text-[11px] text-[#d6beae]">
                        {pay.category === 'COMMISSION' ? 'Komisyon' : pay.category === 'CONSTRUCTION' ? 'İnşaat/Şantiye' : pay.category === 'MARKETING' ? 'Reklam/Pazarlama' : 'Ofis'}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-bold text-white">
                      {formatCurrency(pay.amount)}
                    </td>
                    <td className="py-3 px-3 text-[#a69f99]">{pay.dueDate}</td>
                    <td className="py-3 px-3">
                      <GlassBadge
                        size="sm"
                        variant={pay.status === 'PAID' ? 'success' : 'warning'}
                      >
                        {pay.status === 'PAID' ? 'Ödendi' : 'Bekliyor'}
                      </GlassBadge>
                    </td>
                    <td className="py-3 px-3 text-right">
                      {pay.status !== 'PAID' && (
                        <button
                          onClick={() => handleMarkPaid(pay.id)}
                          className="px-3 py-1 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-semibold cursor-pointer"
                        >
                          Öde
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* YENİ ÖDEME PLANI MODALI */}
      <GlassModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Yeni Ödeme / Hakediş Planla"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
              Ödeme Başlığı *
            </label>
            <input
              type="text"
              required
              placeholder="Örn: 2026 Q3 Satış Primi"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2 rounded-full bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Alıcı Kişi / Şirket *
              </label>
              <input
                type="text"
                required
                placeholder="Örn: Berkant Çalışkan"
                value={payee}
                onChange={(e) => setPayee(e.target.value)}
                className="w-full px-3.5 py-2 rounded-full bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Kategori
              </label>
              <CustomSelect
                value={category}
                onChange={(e) => setCategory(e.target.value as PaymentCategory)}
                className="w-full px-3.5 py-2 rounded-full bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              >
                <option value="COMMISSION">Danışman Komisyonu</option>
                <option value="CONSTRUCTION">Şantiye Hakedişi</option>
                <option value="MARKETING">Reklam & Pazarlama</option>
                <option value="OFFICE">Ofis & Operasyon</option>
              </CustomSelect>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Tutar (TL) *
              </label>
              <input
                type="number"
                required
                value={amount === 0 ? '' : amount}
                onChange={(e) => setAmount(e.target.value === '' ? 0 : Number(e.target.value))}
                className="w-full px-3.5 py-2 rounded-full bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Vade Tarihi *
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-full bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
              Fatura / Makbuz No
            </label>
            <input
              type="text"
              placeholder="Örn: FTR-2026-892"
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
              className="w-full px-3.5 py-2 rounded-full bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
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
              Kaydet
            </GlassButton>
          </div>
        </form>
      </GlassModal>
    </div>
  )
}
