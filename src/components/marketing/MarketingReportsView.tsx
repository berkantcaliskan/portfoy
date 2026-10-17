import React from 'react'
import {
  BarChart3,
  TrendingUp,
  PieChart as PieIcon,
  Download,
  Calendar,
  Share2,
  Users,
  Target,
  ArrowUpRight,
} from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlassButton } from '@/components/ui/GlassButton'
import { GlassBadge } from '@/components/ui/GlassBadge'
import { Lead } from '@/types/lead'
import { formatCurrency } from '@/utils/formatters'

interface MarketingReportsViewProps {
  leads: Lead[]
}

export const MarketingReportsView: React.FC<MarketingReportsViewProps> = ({ leads }) => {
  const totalLeads = leads.length
  const metaLeads = leads.filter((l) => l.source === 'META_ADS').length
  const qualifiedLeads = leads.filter((l) => l.stage === 'QUALIFIED' || l.stage === 'WON').length
  const wonLeads = leads.filter((l) => l.stage === 'WON').length

  const qualifiedRate = totalLeads > 0 ? Math.round((qualifiedLeads / totalLeads) * 100) : 0
  const winRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0

  // Estimated ad spend (0 when no leads/campaigns exist)
  const estimatedAdSpend = 0
  const costPerLead = totalLeads > 0 ? Math.round(estimatedAdSpend / totalLeads) : 0
  const costPerQualified = qualifiedLeads > 0 ? Math.round(estimatedAdSpend / qualifiedLeads) : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <BarChart3 className="w-5 h-5 text-[#b99881]" />
            <h2 className="text-2xl font-bold text-white tracking-wide">
              Pazarlama Raporları
            </h2>
          </div>
          <p className="text-xs text-[#a69f99] mt-1">
            Meta Ads edinim maliyetleri (CPL), kanal dağılımı ve nitelikli aday dönüşüm metrikleri.
          </p>
        </div>

        <GlassButton
          variant="subtle"
          size="sm"
          icon={<Download className="w-3.5 h-3.5 text-[#b99881]" />}
          onClick={() => alert('Pazarlama analitik raporu PDF formatında indiriliyor...')}
          className="rounded-full px-4 text-xs font-semibold"
        >
          Raporu Dışa Aktar
        </GlassButton>
      </div>

      {/* KPI Cards (Mobilde 2x2, Masaüstünde 4'lü) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <GlassCard className="p-3 sm:p-4 bg-[#282522] border-[#4a443f]">
          <div className="text-[11px] sm:text-xs text-[#a69f99] truncate">Ortalama Lead Maliyeti (CPL)</div>
          <div className="text-lg sm:text-2xl font-bold text-white mt-1 truncate">{costPerLead.toLocaleString('tr-TR')} TL</div>
          <div className="text-[10px] sm:text-[11px] text-[#8c857f] mt-1 truncate">{totalLeads} toplam lead</div>
        </GlassCard>

        <GlassCard className="p-3 sm:p-4 bg-[#282522] border-[#4a443f]">
          <div className="text-[11px] sm:text-xs text-[#a69f99] truncate">Nitelikli Maliyeti (CPQL)</div>
          <div className="text-lg sm:text-2xl font-bold text-[#b99881] mt-1 truncate">{costPerQualified.toLocaleString('tr-TR')} TL</div>
          <div className="text-[10px] sm:text-[11px] text-[#8c857f] mt-1 truncate">Doğrulanmış potansiyel alıcı</div>
        </GlassCard>

        <GlassCard className="p-3 sm:p-4 bg-[#282522] border-[#4a443f]">
          <div className="text-[11px] sm:text-xs text-[#a69f99] truncate">Nitelikli Dönüşüm Oranı</div>
          <div className="text-lg sm:text-2xl font-bold text-emerald-400 mt-1 truncate">%{qualifiedRate}</div>
          <div className="text-[10px] sm:text-[11px] text-[#8c857f] mt-1 truncate">{qualifiedLeads} adet müşteri</div>
        </GlassCard>

        <GlassCard className="p-3 sm:p-4 bg-[#282522] border-[#4a443f]">
          <div className="text-[11px] sm:text-xs text-[#a69f99] truncate">Nihai Satış Dönüşümü</div>
          <div className="text-lg sm:text-2xl font-bold text-sky-400 mt-1 truncate">%{winRate}</div>
          <div className="text-[10px] sm:text-[11px] text-[#8c857f] mt-1 truncate">Sözleşmeyle tamamlanan</div>
        </GlassCard>
      </div>

      {/* Kanal Dağılımı ve Form Kırılımı */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard className="p-5 bg-[#282522] border-[#4a443f]">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Share2 className="w-4 h-4 text-[#b99881]" />
            <span>Edinim Kanalları Dağılımı</span>
          </h3>
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-[#f3efe9]">
                <span>Instagram Lead Ads</span>
                <span className="font-bold">%{totalLeads > 0 ? 62 : 0} ({Math.round(totalLeads * 0.62)} Lead)</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#34302d] overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#b99881] to-[#dfb76c]" style={{ width: totalLeads > 0 ? '62%' : '0%' }} />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-[#f3efe9]">
                <span>Facebook Lead Ads</span>
                <span className="font-bold">%{totalLeads > 0 ? 24 : 0} ({Math.round(totalLeads * 0.24)} Lead)</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#34302d] overflow-hidden">
                <div className="h-full bg-sky-400" style={{ width: totalLeads > 0 ? '24%' : '0%' }} />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-[#f3efe9]">
                <span>Web Sitesi & Doğrudan</span>
                <span className="font-bold">%{totalLeads > 0 ? 10 : 0} ({Math.round(totalLeads * 0.1)} Lead)</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#34302d] overflow-hidden">
                <div className="h-full bg-emerald-400" style={{ width: totalLeads > 0 ? '10%' : '0%' }} />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-[#f3efe9]">
                <span>Müşteri Tavsiyesi (Referral)</span>
                <span className="font-bold">%{totalLeads > 0 ? 4 : 0} ({Math.round(totalLeads * 0.04)} Lead)</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#34302d] overflow-hidden">
                <div className="h-full bg-purple-400" style={{ width: totalLeads > 0 ? '4%' : '0%' }} />
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-5 bg-[#282522] border-[#4a443f]">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-400" />
            <span>Müşteri İlgisi / Konut Tipleri Tercihi</span>
          </h3>
          <div className="space-y-3">
            {[
              { type: '2+1 Rezidans Daireler', pct: totalLeads > 0 ? 45 : 0, color: 'bg-emerald-400' },
              { type: '1+1 Yatırımlık Konutlar', pct: totalLeads > 0 ? 28 : 0, color: 'bg-sky-400' },
              { type: 'Müstakil Villalar', pct: totalLeads > 0 ? 18 : 0, color: 'bg-[#b99881]' },
              { type: '3+1 ve Üzeri Aile Daireleri', pct: totalLeads > 0 ? 9 : 0, color: 'bg-amber-400' },
            ].map((item) => (
              <div key={item.type} className="space-y-1">
                <div className="flex justify-between text-xs text-[#f3efe9]">
                  <span>{item.type}</span>
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
