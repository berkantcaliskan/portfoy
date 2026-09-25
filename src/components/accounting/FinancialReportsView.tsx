import React from 'react'
import {
  TrendingUp,
  DollarSign,
  Download,
  Calendar,
  CreditCard,
  PieChart as PieIcon,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
} from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlassButton } from '@/components/ui/GlassButton'
import { accountingStore } from '@/services/accountingStore'
import { formatCurrency } from '@/utils/formatters'

export const FinancialReportsView: React.FC = () => {
  const collections = accountingStore.getCollections()
  const payments = accountingStore.getPayments()

  const totalInflow = collections
    .filter((c) => c.status === 'COLLECTED')
    .reduce((acc, c) => acc + c.amount, 0)
  const totalOutflow = payments
    .filter((p) => p.status === 'PAID')
    .reduce((acc, p) => acc + p.amount, 0)
  const netCashFlow = totalInflow - totalOutflow

  const projectedInflow = collections
    .filter((c) => c.status === 'PENDING')
    .reduce((acc, c) => acc + c.amount, 0)
  const projectedOutflow = payments
    .filter((p) => p.status === 'PENDING')
    .reduce((acc, p) => acc + p.amount, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <TrendingUp className="w-5 h-5 text-[#b99881]" />
            <h2 className="text-xl font-bold tracking-tight text-white">
              Finansal Raporlar
            </h2>
          </div>
          <p className="text-xs text-[#a69f99] mt-1">
            Nakit akışı, gelir-gider dengesi, bekleyen vadeli alacaklar ve proje bazlı karlılık analizi.
          </p>
        </div>

        <GlassButton
          variant="subtle"
          size="sm"
          icon={<Download className="w-3.5 h-3.5 text-[#b99881]" />}
          onClick={() => alert('Finansal mizan ve nakit akış tablosu Excel formatında indiriliyor...')}
          className="rounded-full px-4 text-xs font-semibold"
        >
          Mizan Tablosunu İndir
        </GlassButton>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
          <div className="text-xs text-[#a69f99] flex items-center justify-between">
            <span>Net Nakit Akışı</span>
            <Wallet className="w-4 h-4 text-[#b99881]" />
          </div>
          <div className={`text-2xl font-bold mt-1 ${netCashFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatCurrency(netCashFlow)}
          </div>
          <div className="text-[11px] text-[#8c857f] mt-1">Gerçekleşen Giriş - Çıkış</div>
        </GlassCard>

        <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
          <div className="text-xs text-[#a69f99] flex items-center justify-between">
            <span>Bekleyen Vadeli Alacaklar</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            {formatCurrency(projectedInflow)}
          </div>
          <div className="text-[11px] text-[#8c857f] mt-1">Sözleşmeli peşinat ve taksitler</div>
        </GlassCard>

        <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
          <div className="text-xs text-[#a69f99] flex items-center justify-between">
            <span>Öngörülen Borçlar & Giderler</span>
            <ArrowDownRight className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 mt-1">
            {formatCurrency(projectedOutflow)}
          </div>
          <div className="text-[11px] text-[#8c857f] mt-1">Yaklaşan hakediş ve komisyonlar</div>
        </GlassCard>
      </div>

      {/* Finansal Denge ve Gelir Dağılımı */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard className="p-5 bg-[#282522] border-[#4a443f]">
          <h3 className="text-sm font-semibold text-white mb-4">
            Gerçekleşen Nakit Pozisyonu
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1 text-[#f3efe9]">
                <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <ArrowUpRight className="w-3.5 h-3.5" /> Toplam Tahsilat Girişi
                </span>
                <span className="font-bold">{formatCurrency(totalInflow)}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#34302d] overflow-hidden">
                <div className="h-full bg-emerald-400" style={{ width: '100%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1 text-[#f3efe9]">
                <span className="flex items-center gap-1.5 text-rose-400 font-semibold">
                  <ArrowDownRight className="w-3.5 h-3.5" /> Toplam Gider Çıkışı
                </span>
                <span className="font-bold">{formatCurrency(totalOutflow)}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#34302d] overflow-hidden">
                <div
                  className="h-full bg-rose-400"
                  style={{ width: `${totalInflow > 0 ? Math.min(100, Math.round((totalOutflow / totalInflow) * 100)) : 0}%` }}
                />
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-5 bg-[#282522] border-[#4a443f]">
          <h3 className="text-sm font-semibold text-white mb-4">
            Gider Dağılım Kalemleri
          </h3>
          <div className="space-y-3">
            {[
              { label: 'Şantiye ve İnşaat Hakedişleri', pct: 68, color: 'bg-[#b99881]' },
              { label: 'Satış Başarı Komisyonları', pct: 18, color: 'bg-emerald-400' },
              { label: 'Meta & Dijital Reklam Bütçesi', pct: 10, color: 'bg-sky-400' },
              { label: 'Ofis ve Genel Yönetim', pct: 4, color: 'bg-amber-400' },
            ].map((item) => (
              <div key={item.label} className="space-y-1">
                <div className="flex justify-between text-xs text-[#f3efe9]">
                  <span>{item.label}</span>
                  <span className="font-bold">%{item.pct}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[#34302d] overflow-hidden">
                  <div className={`h-full ${item.color}`} style={{ width: `${item.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  )
}
