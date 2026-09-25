import React, { useState } from 'react'
import {
  Building2,
  Calendar,
  CheckCircle2,
  DollarSign,
  Eye,
  Filter,
  Grid,
  Layers,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  Search,
  Tag,
  UserCheck,
  Users,
} from 'lucide-react'
import { Lead, LeadStage, STAGE_CONFIGS } from '@/types/lead'
import { PortfolioItem, PropertyStatus, PropertyType } from '@/types/portfolio'
import { PropertyCard } from './PropertyCard'
import { GlassButton } from '@/components/ui/GlassButton'
import { GlassBadge } from '@/components/ui/GlassBadge'
import { formatCurrency, formatDate, formatPhoneNumber, generateWhatsAppUrl } from '@/utils/formatters'

interface PortfolioViewProps {
  leads: Lead[]
  properties: PortfolioItem[]
  onSelectLead: (lead: Lead) => void
  onStageChange: (leadId: string, stage: LeadStage) => void
  onOpenAddLead: () => void
  onPropertyStatusChange: (id: string, status: PropertyStatus) => void
  onOpenAddProperty: () => void
  searchQuery?: string
}

export const PortfolioView: React.FC<PortfolioViewProps> = ({
  leads,
  properties,
  onSelectLead,
  onStageChange,
  onOpenAddLead,
  onPropertyStatusChange,
  onOpenAddProperty,
  searchQuery = '',
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'leads-table' | 'leads-cards' | 'properties'>('leads-table')
  const [selectedStage, setSelectedStage] = useState<string>('ALL')
  const [selectedHousingType, setSelectedHousingType] = useState<string>('ALL')

  // Filter leads based on stage, housing type, and search query
  const filteredLeads = leads.filter((lead) => {
    if (selectedStage !== 'ALL' && lead.stage !== selectedStage) return false
    if (selectedHousingType !== 'ALL' && lead.preferredHousingType !== selectedHousingType) return false
    if (
      searchQuery &&
      !lead.fullName.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !lead.phone.includes(searchQuery) &&
      !lead.formName.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false
    }
    return true
  })

  // Filter properties
  const filteredProperties = properties.filter((p) => {
    if (
      searchQuery &&
      !p.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !p.location.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !p.projectCode.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false
    }
    return true
  })

  // Customer metrics calculations
  const totalLeads = leads.length
  const hotLeads = leads.filter((l) => l.tags.some((t) => t.includes('Yüksek') || t.includes('Nakit')) || l.stage === 'OFFER' || l.stage === 'APPOINTMENT')
  const investors = leads.filter((l) => l.tags.some((t) => t.includes('Yatırım')) || (l.budget && l.budget >= 5000000))
  const inFollowUp = leads.filter((l) => l.stage === 'CONTACTED' || l.stage === 'APPOINTMENT' || l.stage === 'PRESENTATION')
  const totalBudgetVolume = leads.reduce((acc, l) => acc + (l.budget || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header Bar (Katmansız & Çizgisiz) */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#b99881]/15 border border-[#b99881]/30 flex items-center justify-center text-[#b99881]">
              <Users className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white">
              Müşteri Portföyü
            </h2>
          </div>
          <p className="text-xs text-[#a69f99] mt-1">
            Yatırımcı ve alıcı müşteri portföyünü, iletişim kanallarını, bütçelerini ve konut taleplerini yönetin.
          </p>
        </div>

        {/* Top Right Action: 'Yeni Veri' (Başlığın Karşısında / Sağında) */}
        <div className="flex items-center gap-3">
          <GlassButton
            variant="gold"
            size="sm"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={activeSubTab === 'properties' ? onOpenAddProperty : onOpenAddLead}
            className="rounded-full px-5 font-bold shadow-sm"
          >
            Yeni Veri
          </GlassButton>
        </div>
      </div>

      {/* KPI Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-[28px] bg-[#282522]/80 border border-[#4a443f] backdrop-blur-md">
          <span className="text-xs text-[#a69f99]">Toplam Müşteri Portföyü</span>
          <p className="text-2xl font-bold text-white mt-1">{totalLeads} Müşteri</p>
          <span className="text-[11px] text-[#8c857f] mt-1 block">
            Hacim: {formatCurrency(totalBudgetVolume)}
          </span>
        </div>

        <div className="p-5 rounded-[28px] bg-[#282522]/80 border border-[#4a443f] backdrop-blur-md">
          <span className="text-xs text-[#a69f99]">Sıcak Alıcılar (Hot Leads)</span>
          <p className="text-2xl font-bold text-amber-400 mt-1">{hotLeads.length} Alıcı</p>
          <span className="text-[11px] text-[#8c857f] mt-1 block">
            Nakit & yüksek alım niyeti
          </span>
        </div>

        <div className="p-5 rounded-[28px] bg-[#282522]/80 border border-[#4a443f] backdrop-blur-md">
          <span className="text-xs text-[#a69f99]">Yatırımcı Portföyü</span>
          <p className="text-2xl font-bold text-[#b99881] mt-1">{investors.length} Yatırımcı</p>
          <span className="text-[11px] text-[#8c857f] mt-1 block">
            Geliştirme & proje yatırımı
          </span>
        </div>

        <div className="p-5 rounded-[28px] bg-[#282522]/80 border border-[#4a443f] backdrop-blur-md">
          <span className="text-xs text-[#a69f99]">Görüşme & Takiptekiler</span>
          <p className="text-2xl font-bold text-sky-400 mt-1">{inFollowUp.length} Müşteri</p>
          <span className="text-[11px] text-[#8c857f] mt-1 block">
            Randevu & sunum sürecinde
          </span>
        </div>
      </div>

      {/* Sub-Navigation & Filter Bar (Pill Shaped) */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-2.5 rounded-full bg-[#282522]/70 border border-[#4a443f]">
        {/* Left: View Mode Pills */}
        <div className="flex items-center bg-[#24211f] p-1 rounded-full border border-[#4a443f]">
          <button
            onClick={() => setActiveSubTab('leads-table')}
            className={`flex items-center gap-1.5 px-4 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'leads-table'
                ? 'bg-[#423c38] text-white border border-[#b99881]/40 shadow-sm'
                : 'text-[#a69f99] hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Müşteri Tablosu</span>
          </button>

          <button
            onClick={() => setActiveSubTab('leads-cards')}
            className={`flex items-center gap-1.5 px-4 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'leads-cards'
                ? 'bg-[#423c38] text-white border border-[#b99881]/40 shadow-sm'
                : 'text-[#a69f99] hover:text-white'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Müşteri Kartları</span>
          </button>

          <button
            onClick={() => setActiveSubTab('properties')}
            className={`flex items-center gap-1.5 px-4 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'properties'
                ? 'bg-[#423c38] text-white border border-[#b99881]/40 shadow-sm'
                : 'text-[#a69f99] hover:text-white'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Gayrimenkul Portföyü</span>
          </button>
        </div>

        {/* Right: Filters (When viewing clients) */}
        {activeSubTab !== 'properties' && (
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-2 text-[#a69f99]">
              <Filter className="w-3.5 h-3.5 text-[#b99881]" />
              <span className="font-semibold text-white">Durum:</span>
              <select
                value={selectedStage}
                onChange={(e) => setSelectedStage(e.target.value)}
                className="rounded-full bg-[#34302d] border border-[#4a443f] px-3 py-1 text-xs text-white focus:outline-none focus:border-[#b99881] cursor-pointer"
              >
                <option value="ALL">Tüm Durumlar ({leads.length})</option>
                {Object.keys(STAGE_CONFIGS).map((k) => (
                  <option key={k} value={k}>
                    {STAGE_CONFIGS[k as LeadStage].label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 text-[#a69f99]">
              <span className="font-semibold text-white">Konut:</span>
              <select
                value={selectedHousingType}
                onChange={(e) => setSelectedHousingType(e.target.value)}
                className="rounded-full bg-[#34302d] border border-[#4a443f] px-3 py-1 text-xs text-white focus:outline-none focus:border-[#b99881] cursor-pointer"
              >
                <option value="ALL">Tüm Tipler</option>
                <option value="1+1">1+1 Daire</option>
                <option value="2+1">2+1 Daire</option>
                <option value="3+1">3+1 Daire</option>
                <option value="Villa">Villa / Müstakil</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Sub-Tab 1: Müşteri Listesi / Tablosu (Müşteri Yönetimi) */}
      {activeSubTab === 'leads-table' && (
        <div className="rounded-[32px] bg-[#282522]/70 border border-[#4a443f] overflow-hidden shadow-glass">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.02] border-b border-[#4a443f] text-[#a69f99] uppercase font-semibold">
                <tr>
                  <th className="py-3.5 px-5">Müşteri Profili</th>
                  <th className="py-3.5 px-4">İletişim & WhatsApp</th>
                  <th className="py-3.5 px-4">Talep & Bütçe</th>
                  <th className="py-3.5 px-4">Müşteri Durumu</th>
                  <th className="py-3.5 px-4">Danışman</th>
                  <th className="py-3.5 px-5 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#4a443f]/60">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-[#8c857f]">
                      {leads.length === 0
                        ? "Henüz kayıtlı müşteri bulunmuyor. Sağ üstteki 'Yeni Veri' butonuna tıklayarak ilk müşteriyi ekleyebilirsiniz."
                        : 'Kriterlere uygun müşteri bulunamadı.'}
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead) => {
                    const stageConfig = STAGE_CONFIGS[lead.stage] || STAGE_CONFIGS.NEW

                    return (
                      <tr
                        key={lead.id}
                        onClick={() => onSelectLead(lead)}
                        className="hover:bg-white/[0.02] transition-colors cursor-pointer group"
                      >
                        {/* Name & Tags */}
                        <td className="py-3.5 px-5">
                          <div className="font-bold text-white group-hover:text-[#b99881] transition-colors">
                            {lead.fullName}
                          </div>
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            {lead.tags.slice(0, 2).map((tag) => (
                              <span
                                key={tag}
                                className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-[#d6beae] border border-white/5"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Phone & Direct WhatsApp Link */}
                        <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-white">
                              {formatPhoneNumber(lead.phone)}
                            </span>
                            <a
                              href={generateWhatsAppUrl(lead.phone, `Merhaba Sayın ${lead.fullName}, Demirtürk Portföy müşteri hizmetlerinden ulaşıyorum.`)}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 rounded-full bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 transition-colors"
                              title="WhatsApp Görüşmesi Aç"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                            <a
                              href={`tel:${lead.phone}`}
                              className="p-1 rounded-full bg-sky-500/10 hover:bg-sky-500/25 text-sky-400 transition-colors"
                              title="Telefonla Ara"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                          </div>
                          {lead.email && (
                            <span className="text-[11px] text-[#8c857f] block truncate max-w-[180px]">
                              {lead.email}
                            </span>
                          )}
                        </td>

                        {/* Preferred Housing & Budget */}
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-[#b99881]">
                            {lead.budget ? formatCurrency(lead.budget) : 'Belirtilmedi'}
                          </span>
                          <span className="text-[11px] text-[#a69f99] block">
                            {lead.preferredHousingType || 'Genel Portföy'}
                          </span>
                        </td>

                        {/* Stage Selector */}
                        <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={lead.stage}
                            onChange={(e) => onStageChange(lead.id, e.target.value as LeadStage)}
                            className="text-[11px] font-semibold rounded-full px-2.5 py-1 bg-[#34302d] border border-[#4a443f] text-white focus:outline-none focus:border-[#b99881] cursor-pointer"
                          >
                            {Object.keys(STAGE_CONFIGS).map((k) => (
                              <option key={k} value={k}>
                                {STAGE_CONFIGS[k as LeadStage].label}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Assigned Consultant */}
                        <td className="py-3.5 px-4 text-[#f3efe9]">
                          {lead.owner}
                        </td>

                        {/* Action: Open Detail */}
                        <td className="py-3.5 px-5 text-right">
                          <button
                            onClick={() => onSelectLead(lead)}
                            className="px-3 py-1 rounded-full bg-[#423c38] hover:bg-[#b99881] hover:text-[#1c1a18] text-xs font-semibold text-[#d6beae] transition-colors cursor-pointer"
                          >
                            Müşteri Profili
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub-Tab 2: Müşteri Kartları Görünümü */}
      {activeSubTab === 'leads-cards' && (
        filteredLeads.length === 0 ? (
          <div className="p-16 text-center rounded-[32px] bg-[#282522]/40 border border-dashed border-[#4a443f] flex flex-col items-center justify-center space-y-3">
            <Users className="w-10 h-10 text-[#8c857f]" />
            <h4 className="text-sm font-bold text-white">Henüz Kayıtlı Müşteri Bulunmuyor</h4>
            <p className="text-xs text-[#a69f99]">
              Sağ üstteki 'Yeni Veri' butonuna tıklayarak portföyünüze ilk müşteriyi ekleyebilirsiniz.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLeads.map((lead) => (
              <div
                key={lead.id}
                onClick={() => onSelectLead(lead)}
                className="group p-5 rounded-[28px] bg-[#282522]/70 hover:bg-[#282522] border border-[#4a443f] hover:border-[#b99881]/40 transition-all flex flex-col justify-between space-y-4 shadow-glass cursor-pointer"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-white group-hover:text-[#b99881] transition-colors">
                        {lead.fullName}
                      </h3>
                      <p className="text-xs text-[#8c857f] mt-0.5">
                        {lead.owner} • {formatDate(lead.createdAt)}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-[#b99881]">
                      {lead.budget ? formatCurrency(lead.budget) : '-'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {lead.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#34302d] border border-[#4a443f] text-[#d6beae]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {lead.notes && (
                    <p className="text-xs text-[#a69f99] line-clamp-2 bg-[#34302d]/50 p-2.5 rounded-[18px] border border-[#4a443f]/60">
                      {lead.notes}
                    </p>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="pt-3 border-t border-[#4a443f] flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1.5">
                    <a
                      href={generateWhatsAppUrl(lead.phone, `Merhaba Sayın ${lead.fullName}, Demirtürk Portföy'den yazıyorum.`)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-xs text-emerald-400 transition-colors"
                    >
                      <MessageCircle className="w-3 h-3" />
                      <span>WhatsApp</span>
                    </a>
                    <a
                      href={`tel:${lead.phone}`}
                      className="p-1.5 rounded-full bg-[#34302d] hover:bg-white/10 text-[#a69f99] hover:text-white transition-colors"
                      title="Ara"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  <button
                    onClick={() => onSelectLead(lead)}
                    className="text-xs text-[#d6beae] hover:text-white font-semibold transition-colors"
                  >
                    Detay & Portföy →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Sub-Tab 3: Gayrimenkul Portföyü (Mülk Envanteri) */}
      {activeSubTab === 'properties' && (
        <div className="space-y-6">
          {filteredProperties.length === 0 ? (
            <div className="p-16 text-center rounded-[32px] bg-[#282522]/40 border border-dashed border-[#4a443f] flex flex-col items-center justify-center space-y-3">
              <Building2 className="w-10 h-10 text-[#8c857f]" />
              <h4 className="text-sm font-bold text-white">Henüz Portföyde Gayrimenkul Bulunmuyor</h4>
              <p className="text-xs text-[#a69f99]">
                Sağ üstteki 'Yeni Veri' butonuna tıklayarak ilk portföy mülkünü ekleyebilirsiniz.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProperties.map((property) => (
                <PropertyCard
                  key={property.id}
                  property={property}
                  onStatusChange={onPropertyStatusChange}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
