import React from 'react'
import {
  TrendingUp,
  Download,
  Building2,
  Users,
  DollarSign,
  Share2,
  CheckCircle2,
  Calendar,
  Layers,
  Award,
} from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlassButton } from '@/components/ui/GlassButton'
import { Lead } from '@/types/lead'
import { projectStore } from '@/services/projectStore'
import { accountingStore } from '@/services/accountingStore'
import { formatCurrency } from '@/utils/formatters'

interface ExecutiveReportsViewProps {
  leads: Lead[]
}

export const ExecutiveReportsView: React.FC<ExecutiveReportsViewProps> = ({ leads }) => {
  const projects = projectStore.getAll()
  const allUnits = projects.flatMap((p) => p.units || [])
  const soldUnits = allUnits.filter((u) => u.status === 'SATILDI')
  const totalVolume = soldUnits.reduce((acc, u) => acc + (u.sale?.salePrice || u.price), 0)

  const collections = accountingStore.getCollections()
  const payments = accountingStore.getPayments()
  const totalInflow = collections.filter((c) => c.status === 'COLLECTED').reduce((acc, c) => acc + c.amount, 0)
  const totalOutflow = payments.filter((p) => p.status === 'PAID').reduce((acc, p) => acc + p.amount, 0)

  const qualifiedLeads = leads.filter((l) => l.stage === 'QUALIFIED' || l.stage === 'WON').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <TrendingUp className="w-5 h-5 text-[#b99881]" />
            <h2 className="text-2xl font-bold text-white tracking-wide">
              Yönetici Konsolide Raporları
            </h2>
          </div>
          <p className="text-xs text-[#a69f99] mt-1">
            5 departmanın uçtan uca performans göstergeleri, toplam ciro, nakit akışı ve dönüşüm hunisi.
          </p>
        </div>

        <GlassButton
          variant="subtle"
          size="sm"
          icon={<Download className="w-3.5 h-3.5 text-[#b99881]" />}
          onClick={() => alert('Yönetici brifing raporu PDF formatında oluşturuluyor...')}
          className="rounded-full px-4 text-xs font-semibold"
        >
          Yönetim Raporu Al
        </GlassButton>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
          <div className="text-xs text-[#a69f99]">Konsolide Sözleşme Cirosu</div>
          <div className="text-xl font-bold text-white mt-1">{formatCurrency(totalVolume)}</div>
          <div className="text-[11px] text-emerald-400 mt-1">{soldUnits.length} Ünite tamamlandı</div>
        </GlassCard>

        <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
          <div className="text-xs text-[#a69f99]">Net Nakit Pozisyonu</div>
          <div className="text-xl font-bold text-emerald-400 mt-1">{formatCurrency(totalInflow - totalOutflow)}</div>
          <div className="text-[11px] text-[#8c857f] mt-1">Tahsilat eksi ödemeler</div>
        </GlassCard>

        <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
          <div className="text-xs text-[#a69f99]">Toplam Aday Havuzu</div>
          <div className="text-2xl font-bold text-sky-400 mt-1">{leads.length}</div>
          <div className="text-[11px] text-[#8c857f] mt-1">{qualifiedLeads} Nitelikli müşteri</div>
        </GlassCard>

        <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
          <div className="text-xs text-[#a69f99]">Aktif Proje Portföyü</div>
          <div className="text-2xl font-bold text-[#b99881] mt-1">{projects.length}</div>
          <div className="text-[11px] text-[#8c857f] mt-1">{allUnits.length} Toplam daire/villa</div>
        </GlassCard>
      </div>

      {/* Departman Kartları Özeti */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <GlassCard className="p-5 bg-[#282522] border-[#4a443f] space-y-2">
          <div className="flex justify-between items-center text-xs text-[#8c857f]">
            <span>1. Departman</span>
            <span className="text-sky-400 font-semibold">Pazarlama</span>
          </div>
          <div className="text-lg font-bold text-white">{leads.filter((l) => l.source === 'META_ADS').length} Meta Lead</div>
          <p className="text-[11px] text-[#a69f99]">
            Instagram & Facebook kampanyaları üzerinden gelen toplam lead adedi.
          </p>
        </GlassCard>

        <GlassCard className="p-5 bg-[#282522] border-[#4a443f] space-y-2">
          <div className="flex justify-between items-center text-xs text-[#8c857f]">
            <span>2. Departman</span>
            <span className="text-teal-400 font-semibold">Müşteri İlişkileri</span>
          </div>
          <div className="text-lg font-bold text-white">{qualifiedLeads} Nitelikli Doğrulama</div>
          <p className="text-[11px] text-[#a69f99]">
            Araması tamamlanıp satış aşamasına uygun görülen potansiyel alıcılar.
          </p>
        </GlassCard>

        <GlassCard className="p-5 bg-[#282522] border-[#4a443f] space-y-2">
          <div className="flex justify-between items-center text-xs text-[#8c857f]">
            <span>3. Departman</span>
            <span className="text-[#b99881] font-semibold">Satış Ekibi</span>
          </div>
          <div className="text-lg font-bold text-white">{soldUnits.length} Daire Satışı</div>
          <p className="text-[11px] text-[#a69f99]">
            Sunum, opsiyonlama ve satış sözleşmesiyle sonuçlandırılan bağımsız bölümler.
          </p>
        </GlassCard>

        <GlassCard className="p-5 bg-[#282522] border-[#4a443f] space-y-2">
          <div className="flex justify-between items-center text-xs text-[#8c857f]">
            <span>4. Departman</span>
            <span className="text-emerald-400 font-semibold">Muhasebe & Finans</span>
          </div>
          <div className="text-lg font-bold text-emerald-400">{formatCurrency(totalInflow)}</div>
          <p className="text-[11px] text-[#a69f99]">
            Sözleşmelerden banka hesaplarına aktarılan net nakit tahsilat toplamı.
          </p>
        </GlassCard>

        <GlassCard className="p-5 bg-[#282522] border-[#4a443f] space-y-2">
          <div className="flex justify-between items-center text-xs text-[#8c857f]">
            <span>5. Departman</span>
            <span className="text-purple-400 font-semibold">Genel Yönetim</span>
          </div>
          <div className="text-lg font-bold text-white">{projects.length} Aktif Proje</div>
          <p className="text-[11px] text-[#a69f99]">
            Çift rezervasyonu engelleyen kilitler ve hedefli güvenli dosya paylaşımı devrede.
          </p>
        </GlassCard>
      </div>
    </div>
  )
}
