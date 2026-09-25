import React from 'react'
import { motion } from 'framer-motion'
import {
  MessageCircle,
  Phone,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Building,
  UserCheck,
  Tag,
  ChevronRight,
} from 'lucide-react'
import { Lead, LeadStage, STAGE_CONFIGS } from '@/types/lead'
import { GlassBadge } from '@/components/ui/GlassBadge'
import { formatCurrency, formatPhoneNumber, generateWhatsAppUrl } from '@/utils/formatters'

interface LeadKanbanBoardProps {
  leads: Lead[]
  onSelectLead: (lead: Lead) => void
  onStageChange: (leadId: string, newStage: LeadStage) => void
}

const ORDERED_STAGES: LeadStage[] = [
  'NEW',
  'CONTACTED',
  'APPOINTMENT',
  'PRESENTATION',
  'OFFER',
  'WON',
  'LOST',
]

export const LeadKanbanBoard: React.FC<LeadKanbanBoardProps> = ({
  leads,
  onSelectLead,
  onStageChange,
}) => {
  const getNextStage = (current: LeadStage): LeadStage | null => {
    const idx = ORDERED_STAGES.indexOf(current)
    if (idx < ORDERED_STAGES.length - 2) {
      return ORDERED_STAGES[idx + 1]
    }
    return null
  }

  const getPrevStage = (current: LeadStage): LeadStage | null => {
    const idx = ORDERED_STAGES.indexOf(current)
    if (idx > 0 && current !== 'LOST') {
      return ORDERED_STAGES[idx - 1]
    }
    return null
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-6 pt-2 snap-x select-none">
      {ORDERED_STAGES.map((stageKey) => {
        const config = STAGE_CONFIGS[stageKey]
        const stageLeads = leads.filter((l) => l.stage === stageKey)
        const totalBudget = stageLeads.reduce((acc, l) => acc + (l.budget || 0), 0)

        return (
          <div
            key={stageKey}
            className="flex-shrink-0 w-80 flex flex-col rounded-[32px] bg-navy-900/40 backdrop-blur-xl border border-white/8 p-4 snap-start shadow-glass"
          >
            {/* Column Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/8 mb-3">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    backgroundColor: config.accentColor,
                    boxShadow: `0 0 10px ${config.accentColor}`,
                  }}
                />
                <h4 className="text-xs font-bold text-slate-200 tracking-wider">
                  {config.label}
                </h4>
              </div>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-300">
                {stageLeads.length}
              </span>
            </div>

            {/* Total Budget subhead */}
            {totalBudget > 0 && (
              <div className="text-[11px] text-slate-400 mb-2.5 px-1 flex justify-between">
                <span>Hacim:</span>
                <span className="font-semibold text-brand-gold">
                  {formatCurrency(totalBudget)}
                </span>
              </div>
            )}

            {/* Leads List */}
            <div className="flex-1 space-y-3 overflow-y-auto max-h-[calc(100vh-250px)] pr-1">
              {stageLeads.length === 0 ? (
                <div className="h-28 rounded-[24px] border border-dashed border-white/10 flex items-center justify-center text-xs text-slate-500">
                  Kayıt yok
                </div>
              ) : (
                stageLeads.map((lead) => {
                  const nextStage = getNextStage(lead.stage)
                  const prevStage = getPrevStage(lead.stage)
                  const waUrl = generateWhatsAppUrl(lead.phone, lead.fullName)

                  return (
                    <motion.div
                      key={lead.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="group rounded-[24px] p-4 bg-navy-850/60 hover:bg-navy-800/80 backdrop-blur-md border border-white/10 hover:border-brand-gold/40 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-glass-glow"
                      onClick={() => onSelectLead(lead)}
                    >
                      {/* Top Row: Name & Preferred Housing */}
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <h5 className="text-sm font-semibold text-white group-hover:text-brand-goldLight transition-colors line-clamp-1">
                          {lead.fullName}
                        </h5>
                        {lead.preferredHousingType && (
                          <span className="shrink-0 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-brand-gold/15 text-brand-goldLight border border-brand-gold/30">
                            {lead.preferredHousingType}
                          </span>
                        )}
                      </div>

                      {/* Meta Form Source Tag */}
                      <p className="text-[11px] text-[#b99881] line-clamp-1 mb-2 bg-[#b99881]/10 px-2.5 py-0.5 rounded-full border border-[#b99881]/25 font-mono">
                        {lead.formName}
                      </p>

                      {/* Phone & Budget */}
                      <div className="flex items-center justify-between text-xs text-slate-300 mb-2">
                        <span className="text-[11px] text-slate-400 font-mono">
                          {formatPhoneNumber(lead.phone)}
                        </span>
                        {lead.budget && (
                          <span className="font-bold text-emerald-400 text-xs">
                            {formatCurrency(lead.budget)}
                          </span>
                        )}
                      </div>

                      {/* Owner & Tags */}
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-3">
                        <span className="flex items-center gap-1">
                          <UserCheck className="w-3 h-3 text-slate-400" />
                          {lead.owner}
                        </span>
                        {lead.tags && lead.tags.length > 0 && (
                          <span className="text-slate-400 truncate max-w-[110px]">
                            #{lead.tags[0]}
                          </span>
                        )}
                      </div>

                      {/* Action Bar (WhatsApp, Call, Stage Switchers) */}
                      <div
                        className="pt-2 border-t border-white/5 flex items-center justify-between gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Quick Contact buttons */}
                        <div className="flex items-center gap-1.5">
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-full bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500 hover:text-white border border-emerald-500/30 transition-colors"
                            title="WhatsApp İle Mesaj Gönder"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                          <a
                            href={`tel:${lead.phone}`}
                            className="p-2 rounded-full bg-sky-500/15 text-sky-400 hover:bg-sky-500 hover:text-white border border-sky-500/30 transition-colors"
                            title="Doğrudan Ara"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        </div>

                        {/* Stage transition buttons */}
                        <div className="flex items-center gap-1">
                          {prevStage && (
                            <button
                              onClick={() => onStageChange(lead.id, prevStage)}
                              className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 text-slate-300 transition-colors cursor-pointer"
                              title={`Geri al: ${STAGE_CONFIGS[prevStage].label}`}
                            >
                              <ArrowLeft className="w-3 h-3" />
                            </button>
                          )}
                          {nextStage && (
                            <button
                              onClick={() => onStageChange(lead.id, nextStage)}
                              className="flex items-center gap-1 px-3 py-1 rounded-full bg-brand-gold/20 hover:bg-brand-gold hover:text-navy-950 text-brand-goldLight border border-brand-gold/40 text-[11px] font-semibold transition-all cursor-pointer"
                              title={`İlerle: ${STAGE_CONFIGS[nextStage].label}`}
                            >
                              <span>İlerle</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                          {lead.stage !== 'WON' && lead.stage !== 'LOST' && (
                            <button
                              onClick={() => onStageChange(lead.id, 'WON')}
                              className="w-6 h-6 rounded-full bg-emerald-500/15 hover:bg-emerald-500 hover:text-white text-emerald-300 border border-emerald-500/30 text-[10px] font-bold transition-colors cursor-pointer flex items-center justify-center"
                              title="Satış Olarak İşaretle"
                            >
                              ✓
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )
                })
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
