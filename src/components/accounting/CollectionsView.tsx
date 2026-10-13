import React, { useState, useEffect } from 'react'
import {
  TurkishLira,
  Plus,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCcw,
  Receipt,
  FileText,
  Filter,
} from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlassButton } from '@/components/ui/GlassButton'
import { GlassBadge } from '@/components/ui/GlassBadge'
import { GlassModal } from '@/components/ui/GlassModal'
import {
  accountingStore,
  CollectionRecord,
  CollectionType,
  CollectionStatus,
} from '@/services/accountingStore'
import { userStore, AppUser } from '@/services/userStore'
import { formatCurrency } from '@/utils/formatters'
import { permissionService } from '@/services/permissionService'

export const CollectionsView: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(userStore.getCurrentUser())
  const [collections, setCollections] = useState<CollectionRecord[]>(() => accountingStore.getCollections())
  const [filterStatus, setFilterStatus] = useState<string>('ALL')

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [selectedRefundCol, setSelectedRefundCol] = useState<CollectionRecord | null>(null)
  const [refundReason, setRefundReason] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Add form
  const [customerName, setCustomerName] = useState('')
  const [projectName, setProjectName] = useState('Demirtürk Panorama Rezidans')
  const [unitNumber, setUnitNumber] = useState('D-03')
  const [type, setType] = useState<CollectionType>('DEPOSIT')
  const [amount, setAmount] = useState<number>(150000)
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentMethod, setPaymentMethod] = useState('Banka Havalesi')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    const unsub = accountingStore.subscribe(() => {
      setCollections(accountingStore.getCollections())
    })
    return () => unsub()
  }, [])

  const filtered = collections.filter((c) => {
    if (filterStatus !== 'ALL' && c.status !== filterStatus) return false
    return true
  })

  const totalCollected = collections
    .filter((c) => c.status === 'COLLECTED')
    .reduce((acc, c) => acc + c.amount, 0)
  const totalPending = collections
    .filter((c) => c.status === 'PENDING')
    .reduce((acc, c) => acc + c.amount, 0)
  const totalOverdue = collections
    .filter((c) => c.status === 'OVERDUE')
    .reduce((acc, c) => acc + c.amount, 0)

  const handleMarkCollected = (id: string) => {
    accountingStore.markCollectionAsPaid(id)
    setSuccessMsg('Tahsilat makbuzu düzenlendi ve tahsil edildi olarak kaydedildi.')
    setTimeout(() => setSuccessMsg(null), 3000)
  }

  const handleOpenRefund = (col: CollectionRecord) => {
    setSelectedRefundCol(col)
    setRefundReason('')
    setErrorMsg(null)
  }

  const handleExecuteRefund = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRefundCol || !currentUser) return

    const res = accountingStore.refundDeposit(selectedRefundCol.id, currentUser, refundReason)
    if (!res.success) {
      setErrorMsg(res.error || 'İade yetkisi doğrulanamadı.')
      return
    }

    setSelectedRefundCol(null)
    setSuccessMsg('Kapora iadesi onaylandı ve muhasebe iade kaydı oluşturuldu.')
    setTimeout(() => setSuccessMsg(null), 3500)
  }

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!customerName.trim() || !amount) return

    accountingStore.addCollection({
      customerName: customerName.trim(),
      projectName,
      unitNumber,
      type,
      amount: Number(amount),
      dueDate,
      status: 'PENDING',
      paymentMethod,
      notes,
    })

    setIsAddModalOpen(false)
    setCustomerName('')
    setSuccessMsg('Yeni tahsilat planı oluşturuldu.')
    setTimeout(() => setSuccessMsg(null), 3000)
  }

  const canRefund = permissionService.canRefundDeposit(currentUser)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <TurkishLira className="w-5 h-5 text-[#b99881]" />
            <h2 className="text-2xl font-bold text-white tracking-wide">
              Tahsilatlar
            </h2>
          </div>
          <p className="text-xs text-[#a69f99] mt-1">
            Satış sözleşmelerine bağlı kaporalar, peşinatlar, taksitler ve banka mutabakatları.
          </p>
        </div>

        <GlassButton
          variant="gold"
          size="sm"
          icon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => setIsAddModalOpen(true)}
          className="rounded-full px-4 text-xs font-semibold"
        >
          Tahsilat Planı Ekle
        </GlassButton>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3 rounded-[16px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
          <div className="text-xs text-[#a69f99]">Tahsil Edilen Toplam</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{formatCurrency(totalCollected)}</div>
          <div className="text-[11px] text-[#8c857f] mt-1">Nakit ve banka hesaplarında</div>
        </GlassCard>

        <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
          <div className="text-xs text-[#a69f99]">Bekleyen Tahsilatlar</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">{formatCurrency(totalPending)}</div>
          <div className="text-[11px] text-[#8c857f] mt-1">Gelecek vadeli alacaklar</div>
        </GlassCard>

        <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
          <div className="text-xs text-[#a69f99]">Gecikmedeki Tahsilatlar</div>
          <div className="text-2xl font-bold text-rose-400 mt-1">{formatCurrency(totalOverdue)}</div>
          <div className="text-[11px] text-[#8c857f] mt-1">Vadesi geçmiş taksitler</div>
        </GlassCard>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-2 p-4 rounded-[20px] bg-[#282522] border border-[#4a443f]">
        <span className="text-xs text-[#8c857f] mr-1">Filtre:</span>
        {['ALL', 'COLLECTED', 'PENDING', 'OVERDUE', 'REFUNDED'].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
              filterStatus === s
                ? 'bg-[#b99881] text-[#282522] font-bold shadow-sm'
                : 'bg-[#34302d] text-[#a69f99] hover:text-white border border-[#4a443f]'
            }`}
          >
            {s === 'ALL' ? 'Tümü' : s === 'COLLECTED' ? 'Tahsil Edildi' : s === 'PENDING' ? 'Bekliyor' : s === 'OVERDUE' ? 'Gecikmede' : 'İade Edildi'}
          </button>
        ))}
      </div>

      {/* Tablo */}
      <GlassCard className="p-5 bg-[#282522] border-[#4a443f]">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-[#4a443f] text-[#8c857f] text-[11px]">
                <th className="py-2.5 px-3">Müşteri</th>
                <th className="py-2.5 px-3">Proje & Ünite</th>
                <th className="py-2.5 px-3">Tür</th>
                <th className="py-2.5 px-3">Tutar</th>
                <th className="py-2.5 px-3">Vade Tarihi</th>
                <th className="py-2.5 px-3">Durum</th>
                <th className="py-2.5 px-3 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#4a443f]/60 text-[#f3efe9]">
              {filtered.map((col) => (
                <tr key={col.id} className="hover:bg-[#34302d] transition-colors">
                  <td className="py-3 px-3 font-semibold text-white">
                    {col.customerName}
                    {col.receiptNo && (
                      <div className="text-[10px] text-[#8c857f] font-normal">{col.receiptNo}</div>
                    )}
                  </td>
                  <td className="py-3 px-3 text-[#a69f99]">
                    {col.projectName} ({col.unitNumber})
                  </td>
                  <td className="py-3 px-3">
                    <span className="text-[11px] font-medium text-[#d6beae]">
                      {col.type === 'DEPOSIT' ? 'Ön Kapora' : col.type === 'DOWN_PAYMENT' ? 'Peşinat' : col.type === 'INSTALLMENT' ? 'Taksit' : 'Tam Ödeme'}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-bold text-white">
                    {formatCurrency(col.amount)}
                  </td>
                  <td className="py-3 px-3 text-[#a69f99]">{col.dueDate}</td>
                  <td className="py-3 px-3">
                    <GlassBadge
                      size="sm"
                      variant={col.status === 'COLLECTED' ? 'success' : col.status === 'OVERDUE' ? 'danger' : col.status === 'REFUNDED' ? 'default' : 'warning'}
                    >
                      {col.status === 'COLLECTED' ? 'Tahsil Edildi' : col.status === 'OVERDUE' ? 'Gecikmede' : col.status === 'REFUNDED' ? 'İade Edildi' : 'Bekliyor'}
                    </GlassBadge>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {col.status !== 'COLLECTED' && col.status !== 'REFUNDED' && (
                        <button
                          onClick={() => handleMarkCollected(col.id)}
                          className="px-2.5 py-1 rounded-[8px] bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-semibold cursor-pointer"
                        >
                          Tahsil Et
                        </button>
                      )}

                      {col.type === 'DEPOSIT' && col.status === 'COLLECTED' && canRefund && (
                        <button
                          onClick={() => handleOpenRefund(col)}
                          className="px-2.5 py-1 rounded-[8px] bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-semibold cursor-pointer"
                          title="Kapora İadesi Gerçekleştir"
                        >
                          İade
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* KAPORA İADE MODALI */}
      <GlassModal
        isOpen={selectedRefundCol !== null}
        onClose={() => setSelectedRefundCol(null)}
        title={`Kapora İadesi - ${selectedRefundCol?.customerName}`}
      >
        <form onSubmit={handleExecuteRefund} className="space-y-4">
          <div className="p-3 rounded-[14px] bg-[#34302d] border border-[#4a443f] text-xs text-[#a69f99]">
            <div className="text-white font-semibold flex justify-between">
              <span>{selectedRefundCol?.projectName} ({selectedRefundCol?.unitNumber})</span>
              <span>{formatCurrency(selectedRefundCol?.amount || 0)}</span>
            </div>
            <div className="mt-1">
              Bu işlem kapora bedelini iade edildi statüsüne geçirecektir.
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-[12px] bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
              İade Gerekçesi *
            </label>
            <textarea
              rows={3}
              required
              placeholder="Vazgeçme nedeni, banka dekont no, müşteri IBAN bilgisi..."
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white placeholder-[#8c857f] focus:outline-none focus:border-[#b99881]"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setSelectedRefundCol(null)}
              className="px-4 py-2 rounded-full text-xs text-[#a69f99] hover:text-white cursor-pointer"
            >
              Vazgeç
            </button>
            <GlassButton type="submit" variant="gold" size="sm" className="rounded-full px-5 font-bold">
              İadeyi Onayla
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      {/* YENİ TAHSİLAT PLANI MODALI */}
      <GlassModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Yeni Tahsilat Planı Ekle"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
              Müşteri Adı Soyadı *
            </label>
            <input
              type="text"
              required
              placeholder="Örn: Murat Şahin"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                İlgili Proje
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Daire No
              </label>
              <input
                type="text"
                value={unitNumber}
                onChange={(e) => setUnitNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Tahsilat Türü
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as CollectionType)}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              >
                <option value="DEPOSIT">Ön Kapora</option>
                <option value="DOWN_PAYMENT">Peşinat</option>
                <option value="INSTALLMENT">Taksit</option>
                <option value="FULL_PAYMENT">Tam Ödeme</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Tutar (TL) *
              </label>
              <input
                type="number"
                required
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Vade Tarihi *
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Ödeme Yöntemi
              </label>
              <input
                type="text"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>
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
