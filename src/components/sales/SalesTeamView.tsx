import React, { useState } from 'react'
import {
  Briefcase,
  Calculator,
  Calendar,
  CheckCircle2,
  ChevronRight,
  DollarSign,
  FileText,
  Filter,
  Kanban,
  MessageCircle,
  Phone,
  Plus,
  Sparkles,
  Table as TableIcon,
  Trophy,
  User,
  Users,
  ArrowUpRight,
} from 'lucide-react'
import { Lead, LeadStage, STAGE_CONFIGS } from '@/types/lead'
import { GlassButton } from '@/components/ui/GlassButton'
import { GlassBadge } from '@/components/ui/GlassBadge'
import { LuxurySelect } from '@/components/ui/LuxurySelect'
import { CommissionCalculatorModal } from './CommissionCalculatorModal'
import { formatCurrency, formatPhoneNumber, generateWhatsAppUrl } from '@/utils/formatters'

import { getAllUsers, AppUser } from '@/services/userStore'

interface SalesTeamViewProps {
  leads: Lead[]
  onSelectLead: (lead: Lead) => void
  onStageChange: (leadId: string, newStage: LeadStage) => void
  onOpenNewLead: () => void
  currentUser?: AppUser | null
}

export const SalesTeamView: React.FC<SalesTeamViewProps> = ({
  leads,
  onSelectLead,
  onStageChange,
  onOpenNewLead,
  currentUser: _currentUser,
}) => {
  const [selectedRep, setSelectedRep] = useState<string>('ALL')
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban')
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false)
  const [calcAmount, setCalcAmount] = useState<number>(5000000)

  // Real users from store
  const allUsers: AppUser[] = getAllUsers()
  const salesReps = [
    { id: 'ALL', name: 'Tüm Satış Ekibi' },
    ...allUsers.map((u: AppUser) => ({
      id: u.fullName,
      name: `${u.fullName} (${u.department})`,
    })),
  ]

  // Filter leads based on sales rep
  const filteredLeads = leads.filter((lead) => {
    if (selectedRep === 'ALL') return true
    return lead.owner === selectedRep
  })

  // Sales deal stages (Focused on sales rep workflow)
  const salesDealStages: LeadStage[] = [
    'CONTACTED',
    'APPOINTMENT',
    'PRESENTATION',
    'OFFER',
    'WON',
  ]

  // Calculations for KPI
  const closedLeads = filteredLeads.filter((l) => l.stage === 'WON')
  const totalClosedRevenue = closedLeads.reduce((acc, l) => acc + (l.budget || 0), 0)
  const totalEarnedCommission = Math.round(totalClosedRevenue * 0.02) // 2% standard rep commission
  const activeOfferCount = filteredLeads.filter((l) => l.stage === 'OFFER' || l.stage === 'PRESENTATION').length
  const monthlyQuota = 25000000
  const quotaAchievement = monthlyQuota > 0 ? Math.min(100, Math.round((totalClosedRevenue / monthlyQuota) * 100)) : 0

  // Rep leaderboard data dynamically calculated
  const leaderboardData = allUsers
    .filter((u: AppUser) => u.department === 'Satış' || u.department === 'Yönetim' || u.isManager || u.role === 'ADMIN')
    .map((rep: AppUser) => {
      const repLeads = leads.filter((l) => l.owner === rep.fullName && l.stage === 'WON')
      const closedVolume = repLeads.reduce((acc, l) => acc + (l.budget || 0), 0)
      const earnedCommission = Math.round(closedVolume * 0.02)
      return {
        name: rep.fullName,
        role: rep.isManager || rep.role === 'ADMIN' ? 'Yönetici' : `${rep.department} Danışmanı`,
        closedCount: repLeads.length,
        closedVolume,
        earnedCommission,
        rate: repLeads.length > 0 ? '100%' : '0%',
      }
    })

  const handleOpenCalcForLead = (lead: Lead, e: React.MouseEvent) => {
    e.stopPropagation()
    setCalcAmount(lead.budget || 5000000)
    setIsCalculatorOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Sales Header & Rep Switcher Bar (Katmansız & Çizgisiz) */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#b99881]/15 border border-[#b99881]/30 flex items-center justify-center text-[#b99881]">
              <Trophy className="w-4 h-4" />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-wide">
              Satış
            </h2>
          </div>
          <p className="text-xs text-[#a69f99] mt-1">
            Satış hedefleri, teklif aşamaları, kapora süreçleri ve komisyon yönetimi.
          </p>
        </div>

        {/* Rep Selector & Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Sales Rep Selector - Departman Açılır Menüsü Stiliyle Birebir Eşitlendi */}
          <LuxurySelect
            label="Satışçı:"
            icon={<Users className="w-3.5 h-3.5 text-[#b99881]" />}
            title="Yetkili Satış Danışmanı Seç"
            value={selectedRep}
            onChange={setSelectedRep}
            options={salesReps.map((rep) => ({
              value: rep.id,
              label: rep.name,
            }))}
            align="right"
            minWidth="w-64"
          />

          {/* Commission Calculator Button */}
          <GlassButton
            variant="subtle"
            size="sm"
            icon={<Calculator className="w-3.5 h-3.5 text-[#b99881]" />}
            onClick={() => {
              setCalcAmount(6000000)
              setIsCalculatorOpen(true)
            }}
            className="rounded-full px-4"
          >
            Prim Hesapla
          </GlassButton>

          {/* New Deal Button */}
          <GlassButton
            variant="gold"
            size="sm"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={onOpenNewLead}
            className="rounded-full px-4"
          >
            Yeni Satış Fırsatı
          </GlassButton>
        </div>
      </div>

      {/* Sales Representative KPI Cards (Mobilde 2x2, Masaüstünde 4'lü) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Card 1: Quota Progress */}
        <div className="p-3.5 sm:p-5 rounded-[22px] sm:rounded-[28px] bg-[#282522]/80 border border-[#4a443f] backdrop-blur-md flex flex-col justify-between space-y-2 sm:space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs text-[#a69f99] truncate">Aylık Satış Hedefi</span>
            <span className="text-xs font-mono font-bold text-[#b99881]">%{quotaAchievement}</span>
          </div>
          <div>
            <div className="text-lg sm:text-2xl font-bold text-white truncate">
              {formatCurrency(totalClosedRevenue)}
            </div>
            <span className="text-[10px] sm:text-[11px] text-[#8c857f] truncate block">
              Hedef: {formatCurrency(monthlyQuota)}
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full h-1.5 sm:h-2 rounded-full bg-[#1c1a18] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#98755f] to-[#b99881] rounded-full transition-all duration-500"
              style={{ width: `${quotaAchievement}%` }}
            />
          </div>
        </div>

        {/* Card 2: Earned Commission */}
        <div className="p-3.5 sm:p-5 rounded-[22px] sm:rounded-[28px] bg-[#282522]/80 border border-[#4a443f] backdrop-blur-md flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs text-[#a69f99] truncate">Kazanılan Prim</span>
            <span className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold shrink-0">
              %2
            </span>
          </div>
          <div className="text-lg sm:text-2xl font-bold text-emerald-400 truncate">
            {formatCurrency(totalEarnedCommission)}
          </div>
          <p className="text-[10px] sm:text-[11px] text-[#8c857f] truncate">
            {closedLeads.length} satıştan hak edilen
          </p>
        </div>

        {/* Card 3: Active Deals in Offer */}
        <div className="p-3.5 sm:p-5 rounded-[22px] sm:rounded-[28px] bg-[#282522]/80 border border-[#4a443f] backdrop-blur-md flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs text-[#a69f99] truncate">Sıcak Teklif</span>
            <span className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full bg-[#b99881]/15 text-[#b99881] font-bold shrink-0">
              Sıcak
            </span>
          </div>
          <div className="text-lg sm:text-2xl font-bold text-[#b99881] truncate">
            {activeOfferCount} aday
          </div>
          <p className="text-[10px] sm:text-[11px] text-[#8c857f] truncate">
            Teklif & sunum aşamasında
          </p>
        </div>

        {/* Card 4: Deals Closed Count */}
        <div className="p-3.5 sm:p-5 rounded-[22px] sm:rounded-[28px] bg-[#282522]/80 border border-[#4a443f] backdrop-blur-md flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs text-[#a69f99] truncate">Kapanan Satış</span>
            <span className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400 font-bold shrink-0">
              Kazanıldı
            </span>
          </div>
          <div className="text-lg sm:text-2xl font-bold text-sky-400 truncate">
            {closedLeads.length} sözleşme
          </div>
          <p className="text-[10px] sm:text-[11px] text-[#8c857f] truncate">
            Kapora & tapu devri tamam
          </p>
        </div>
      </div>

      {/* View Toggle Bar (Pill Shaped) */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-2.5 rounded-full bg-[#282522]/70 border border-[#4a443f]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-white">Satış Kapanış Hattı (Deal Flow)</span>
          <span className="text-[11px] text-[#8c857f]">
            ({filteredLeads.length} aktif anlaşma)
          </span>
        </div>

        {/* Kanban vs Table Mode Toggle */}
        <div className="flex items-center bg-[#24211f] p-1 rounded-full border border-[#4a443f]">
          <button
            onClick={() => setViewMode('kanban')}
            className={`flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'kanban'
                ? 'bg-[#423c38] text-white border border-[#b99881]/40 shadow-sm'
                : 'text-[#a69f99] hover:text-white'
            }`}
          >
            <Kanban className="w-3.5 h-3.5" />
            <span>Satış Hattı (Kanban)</span>
          </button>

          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'table'
                ? 'bg-[#423c38] text-white border border-[#b99881]/40 shadow-sm'
                : 'text-[#a69f99] hover:text-white'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Fırsat Tablosu</span>
          </button>
        </div>
      </div>

      {/* View 1: Deal Pipeline Kanban */}
      {viewMode === 'kanban' && (
        <div className="flex md:grid md:grid-cols-3 lg:grid-cols-5 gap-4 overflow-x-auto pb-2 no-scrollbar">
          {salesDealStages.map((stageKey) => {
            const stageLeads = filteredLeads.filter((l) => l.stage === stageKey)
            const stageConfig = STAGE_CONFIGS[stageKey]
            const stageTotalBudget = stageLeads.reduce((acc, l) => acc + (l.budget || 0), 0)

            return (
              <div
                key={stageKey}
                className="flex flex-col rounded-[28px] bg-[#282522]/50 border border-[#4a443f] p-3.5 min-w-[240px] space-y-3"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: stageConfig.accentColor }}
                    />
                    <span className="text-xs font-bold text-white">
                      {stageConfig.label}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-white/5 text-[#d6beae]">
                    {stageLeads.length}
                  </span>
                </div>

                {/* Stage Volume Sub-indicator */}
                {stageTotalBudget > 0 && (
                  <div className="text-[10px] text-[#8c857f] px-1 truncate">
                    Hacim: {formatCurrency(stageTotalBudget)}
                  </div>
                )}

                {/* Cards List */}
                <div className="space-y-2.5 flex-1 min-h-[300px]">
                  {stageLeads.length === 0 ? (
                    <div className="h-24 rounded-[20px] border border-dashed border-[#4a443f] flex items-center justify-center text-[11px] text-[#8c857f]">
                      Fırsat yok
                    </div>
                  ) : (
                    stageLeads.map((lead) => {
                      const estimatedCommission = lead.budget ? Math.round(lead.budget * 0.02) : 100000

                      return (
                        <div
                          key={lead.id}
                          onClick={() => onSelectLead(lead)}
                          className="group p-4 rounded-[22px] bg-[#34302d] hover:bg-[#3b3633] border border-[#4a443f] hover:border-[#b99881]/50 transition-all cursor-pointer shadow-sm space-y-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="text-xs font-bold text-white group-hover:text-[#b99881] transition-colors">
                                {lead.fullName}
                              </h4>
                              <p className="text-[11px] text-[#8c857f] mt-0.5">
                                {lead.preferredHousingType || 'Konut'} • {lead.owner}
                              </p>
                            </div>
                            <span className="text-[11px] font-bold text-[#b99881]">
                              {lead.budget ? formatCurrency(lead.budget) : 'Fiyat Belirlenmedi'}
                            </span>
                          </div>

                          {/* Commission Tag */}
                          <div className="flex items-center justify-between text-[10px] pt-2 border-t border-[#4a443f]">
                            <span className="text-[#a69f99]">Tahmini Prim:</span>
                            <span className="font-bold text-emerald-400">
                              {formatCurrency(estimatedCommission)}
                            </span>
                          </div>

                          {/* Quick Action Buttons */}
                          <div className="flex items-center justify-between gap-1 pt-1">
                            <div className="flex items-center gap-1">
                              <a
                                href={generateWhatsAppUrl(lead.phone, `Merhaba ${lead.fullName}, Demirtürk Portföy satış ofisinden teklif detaylarınızla ilgili yazıyorum.`)}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-1.5 rounded-full bg-[#24211f] hover:bg-emerald-500/20 text-[#a69f99] hover:text-emerald-400 transition-colors"
                                title="WhatsApp'tan Yaz"
                              >
                                <MessageCircle className="w-3 h-3" />
                              </a>
                              <button
                                type="button"
                                onClick={(e) => handleOpenCalcForLead(lead, e)}
                                className="p-1.5 rounded-full bg-[#24211f] hover:bg-white/10 text-[#a69f99] hover:text-white transition-colors"
                                title="Komisyon Hesapla"
                              >
                                <Calculator className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Stage Advance Button */}
                            {stageKey !== 'WON' && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const nextIndex = salesDealStages.indexOf(stageKey) + 1
                                  if (nextIndex < salesDealStages.length) {
                                    onStageChange(lead.id, salesDealStages[nextIndex])
                                  }
                                }}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#423c38] hover:bg-[#b99881] hover:text-[#1c1a18] text-[10px] font-bold text-[#d6beae] transition-colors"
                              >
                                <span>İlerlet</span>
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* View 2: Deals Table View */}
      {viewMode === 'table' && (
        <div className="rounded-[32px] bg-[#282522]/70 border border-[#4a443f] overflow-hidden shadow-glass">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.02] border-b border-[#4a443f] text-[#a69f99] uppercase font-semibold">
                <tr>
                  <th className="py-3.5 px-5">Müşteri</th>
                  <th className="py-3.5 px-4">Anlaşma Tutarı</th>
                  <th className="py-3.5 px-4">Satışçı</th>
                  <th className="py-3.5 px-4">Aşama</th>
                  <th className="py-3.5 px-4">Tahmini Prim (%2)</th>
                  <th className="py-3.5 px-5 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#4a443f]/60">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-[#8c857f]">
                      Kayıtlı satış fırsatı bulunmuyor.
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      onClick={() => onSelectLead(lead)}
                      className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-5 font-bold text-white">
                        {lead.fullName}
                        <span className="block text-[11px] font-normal text-[#8c857f]">
                          {lead.phone}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-[#b99881]">
                        {formatCurrency(lead.budget || 0)}
                      </td>
                      <td className="py-3 px-4 text-[#d6beae]">
                        {lead.owner || 'Atanmamış'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border"
                          style={{
                            borderColor: `${STAGE_CONFIGS[lead.stage]?.accentColor}40`,
                            backgroundColor: `${STAGE_CONFIGS[lead.stage]?.accentColor}15`,
                            color: STAGE_CONFIGS[lead.stage]?.accentColor,
                          }}
                        >
                          {STAGE_CONFIGS[lead.stage]?.label || lead.stage}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-emerald-400">
                        {formatCurrency(Math.round((lead.budget || 0) * 0.02))}
                      </td>
                      <td className="py-3 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <a
                            href={generateWhatsAppUrl(lead.phone, `Sayın ${lead.fullName}, satış teklifinizle ilgili detayları iletmek üzere yazıyorum.`)}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-full bg-[#34302d] hover:bg-emerald-500/20 text-[#a69f99] hover:text-emerald-400 transition-colors"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                          <button
                            onClick={(e) => handleOpenCalcForLead(lead, e)}
                            className="px-3 py-1 rounded-full bg-[#423c38] hover:bg-[#b99881] hover:text-[#1c1a18] text-xs font-semibold text-[#d6beae] transition-colors"
                          >
                            Hesapla
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sales Leaderboard (Satışçı Başarı Sıralaması) */}
      <div className="p-6 rounded-[32px] bg-[#282522]/80 border border-[#4a443f] backdrop-blur-md space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[#b99881]" />
            <h3 className="text-sm font-bold text-white">
              Satış Ekibi Başarı & Prim Tablosu
            </h3>
          </div>
          <span className="text-xs text-[#a69f99]">Bu Ayki Gerçekleşenler</span>
        </div>

        {leaderboardData.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#8c857f] rounded-[24px] border border-dashed border-[#4a443f]">
            Henüz satış ekibi danışmanı bulunmuyor. Ayarlar &gt; Ekip Yönetimi üzerinden yeni ekip üyeleri ekleyebilirsiniz.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {leaderboardData.map((rep, idx) => (
              <div
                key={rep.name}
                className="p-4 rounded-[24px] bg-[#34302d] border border-[#4a443f] flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#24211f] border border-[#b99881]/40 flex items-center justify-center font-bold text-sm text-[#b99881]">
                    #{idx + 1}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">{rep.name}</h4>
                    <p className="text-[10px] text-[#8c857f]">{rep.role}</p>
                    <p className="text-[11px] font-bold text-[#b99881] mt-0.5">
                      {formatCurrency(rep.closedVolume)} ({rep.closedCount} Satış)
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-[#8c857f] block">Hak Edilen Prim</span>
                  <span className="text-xs font-bold text-emerald-400">
                    {formatCurrency(rep.earnedCommission)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Commission Calculator Modal */}
      <CommissionCalculatorModal
        isOpen={isCalculatorOpen}
        onClose={() => setIsCalculatorOpen(false)}
        initialAmount={calcAmount}
      />
    </div>
  )
}
