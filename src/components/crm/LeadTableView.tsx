import React, { useState } from 'react'
import {
  MessageCircle,
  Phone,
  ArrowUpDown,
  Filter,
  Eye,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { Lead, LeadStage, STAGE_CONFIGS } from '@/types/lead'
import { GlassBadge } from '@/components/ui/GlassBadge'
import { LuxurySelect } from '@/components/ui/LuxurySelect'
import { formatCurrency, formatDate, formatPhoneNumber, formatPhoneDisplay, generateWhatsAppUrl } from '@/utils/formatters'

interface LeadTableViewProps {
  leads: Lead[]
  onSelectLead: (lead: Lead) => void
  onStageChange: (leadId: string, newStage: LeadStage) => void
}

export const LeadTableView: React.FC<LeadTableViewProps> = ({
  leads,
  onSelectLead,
  onStageChange,
}) => {
  const [selectedStage, setSelectedStage] = useState<string>('ALL')

  const filteredLeads = leads.filter(lead => {
    if (selectedStage !== 'ALL' && lead.stage !== selectedStage) {
      return false
    }
    return true
  })

  return (
    <div className="space-y-4">
      {/* Filter Toolbar (Pill Shaped) */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 rounded-full bg-navy-900/40 backdrop-blur-md border border-white/8">
        <LuxurySelect
          label="Aşama Filtresi:"
          icon={<Filter className="w-3.5 h-3.5 text-[#b99881]" />}
          title="Aşama / Durum Filtrele"
          value={selectedStage}
          onChange={setSelectedStage}
          options={[
            { value: 'ALL', label: `Tüm Aşamalar (${leads.length})` },
            ...Object.keys(STAGE_CONFIGS).map((k) => ({
              value: k,
              label: STAGE_CONFIGS[k as LeadStage].label,
            })),
          ]}
          align="left"
          minWidth="w-56"
        />

        <span className="text-xs text-slate-400">
          Toplam <b>{filteredLeads.length}</b> müşteri adayı listeleniyor
        </span>
      </div>

      {/* Table Container (Pill-Curved Card) */}
      <div className="rounded-[32px] bg-navy-900/40 backdrop-blur-xl border border-white/10 overflow-hidden shadow-glass">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.02] border-b border-white/8 text-xs text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Müşteri</th>
                <th className="py-3.5 px-4 font-semibold">İletişim & WhatsApp</th>
                <th className="py-3.5 px-4 font-semibold">Meta Reklam Formu</th>
                <th className="py-3.5 px-4 font-semibold">Aşama (Durum)</th>
                <th className="py-3.5 px-4 font-semibold">Talep & Bütçe</th>
                <th className="py-3.5 px-4 font-semibold">Temsilci</th>
                <th className="py-3.5 px-4 font-semibold">Tarih</th>
                <th className="py-3.5 px-4 font-semibold text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 text-sm">
                    Filtreye uygun kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => {
                  const stage = STAGE_CONFIGS[lead.stage]
                  const waUrl = generateWhatsAppUrl(lead.phone, lead.fullName)

                  return (
                    <tr
                      key={lead.id}
                      onClick={() => onSelectLead(lead)}
                      className="hover:bg-white/[0.03] transition-colors cursor-pointer group"
                    >
                      {/* Name */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white group-hover:text-brand-goldLight transition-colors">
                          {lead.fullName}
                        </div>
                        {lead.email && (
                          <div className="text-xs text-slate-400 truncate max-w-[160px]">
                            {lead.email}
                          </div>
                        )}
                      </td>

                      {/* Phone & WhatsApp */}
                      <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between w-[180px]">
                          <span className="font-mono text-xs text-slate-300 select-all tracking-wide">
                            {formatPhoneDisplay(lead.phone)}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-full bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-colors"
                              title="WhatsApp"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                            <a
                              href={`tel:${lead.phone}`}
                              className="p-1.5 rounded-full bg-sky-500/15 text-sky-400 hover:bg-sky-500 hover:text-white transition-colors"
                              title="Ara"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>
                      </td>

                      {/* Meta Form */}
                      <td className="py-3.5 px-4">
                        <span className="text-[11px] font-mono px-3 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 max-w-[200px] truncate block" title={lead.formName}>
                          {lead.formName}
                        </span>
                      </td>

                      {/* Stage Dropdown */}
                      <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={lead.stage}
                          onChange={(e) => onStageChange(lead.id, e.target.value as LeadStage)}
                          className="text-xs font-semibold rounded-full px-3 py-1 bg-navy-950 border border-white/10 text-slate-200 focus:outline-none focus:border-brand-gold/60 cursor-pointer"
                        >
                          {Object.keys(STAGE_CONFIGS).map((s) => (
                            <option key={s} value={s}>
                              {STAGE_CONFIGS[s as LeadStage].label}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Preferred Housing & Budget */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          {lead.preferredHousingType && (
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-brand-gold/15 text-brand-gold border border-brand-gold/30">
                              {lead.preferredHousingType}
                            </span>
                          )}
                          <span className="font-semibold text-xs text-emerald-400">
                            {lead.budget ? formatCurrency(lead.budget) : '-'}
                          </span>
                        </div>
                      </td>

                      {/* Owner */}
                      <td className="py-3.5 px-4 text-xs text-slate-300">
                        {lead.owner}
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-xs text-slate-400">
                        {formatDate(lead.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onSelectLead(lead)}
                          className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 text-slate-300 transition-colors"
                          title="Detay Görüntüle"
                        >
                          <Eye className="w-4 h-4" />
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
    </div>
  )
}
