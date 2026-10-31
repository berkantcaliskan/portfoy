import React from 'react'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { motion } from 'framer-motion'
import {
  MapPin,
  Maximize2,
  Tag,
  CheckCircle,
  Clock,
  Home,
  Layers,
  Sparkles,
  Share2,
} from 'lucide-react'
import { PortfolioItem, PropertyStatus } from '@/types/portfolio'
import { formatCurrency } from '@/utils/formatters'
import { GlassBadge } from '@/components/ui/GlassBadge'

interface PropertyCardProps {
  property: PortfolioItem
  onStatusChange: (id: string, status: PropertyStatus) => void
}

export const PropertyCard: React.FC<PropertyCardProps> = ({
  property,
  onStatusChange,
}) => {
  const statusBadges: Record<PropertyStatus, { label: string; variant: 'emerald' | 'amber' | 'neutral' }> = {
    AVAILABLE: { label: 'Satışta', variant: 'emerald' },
    RESERVED: { label: 'Rezerve', variant: 'amber' },
    SOLD: { label: 'Satıldı', variant: 'neutral' },
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="group rounded-[32px] bg-navy-900/40 backdrop-blur-xl border border-white/10 hover:border-brand-gold/40 transition-all duration-300 overflow-hidden flex flex-col shadow-glass hover:shadow-glass-glow"
    >
      {/* Property Image & Status Overlays */}
      <div className="relative h-48 w-full overflow-hidden">
        <img
          src={property.imageUrl}
          alt={property.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-transparent to-black/30" />

        {/* Project Code & Type Tag (Pill Shaped) */}
        <div className="absolute top-3.5 left-3.5 flex items-center gap-2">
          <span className="text-[11px] font-bold px-3 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-brand-goldLight border border-brand-gold/30">
            {property.projectCode}
          </span>
          <span className="text-[11px] font-bold px-3 py-0.5 rounded-full bg-white/10 backdrop-blur-md text-white border border-white/20">
            {property.type}
          </span>
        </div>

        {/* Status Badge */}
        <div className="absolute top-3 right-3">
          <GlassBadge
            variant={statusBadges[property.status].variant}
            dot
            size="sm"
          >
            {statusBadges[property.status].label}
          </GlassBadge>
        </div>

        {/* Price display over gradient */}
        <div className="absolute bottom-3 left-3 right-3 flex items-baseline justify-between">
          <span className="text-lg font-black text-white tracking-tight drop-shadow-md">
            {formatCurrency(property.price, property.currency)}
          </span>
          <span className="text-xs text-slate-300 drop-shadow">
            {property.netM2} m² Net / {property.grossM2} m² Brüt
          </span>
        </div>
      </div>

      {/* Property Content */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div>
          <h4 className="text-sm font-bold text-white group-hover:text-brand-goldLight transition-colors line-clamp-1">
            {property.title}
          </h4>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
            <MapPin className="w-3.5 h-3.5 text-brand-gold shrink-0" />
            <span className="truncate">{property.location}</span>
            {property.floor && (
              <span className="text-slate-500">• {property.floor}</span>
            )}
          </div>
          <p className="text-xs text-slate-300/80 mt-2 line-clamp-2">
            {property.description}
          </p>
        </div>

        {/* Features Tag Pills (Pill Shaped) */}
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/5">
          {property.features.slice(0, 3).map((feat, idx) => (
            <span
              key={idx}
              className="text-[10px] px-3 py-1 rounded-full bg-white/[0.04] text-slate-300 border border-white/5"
            >
              {feat}
            </span>
          ))}
          {property.features.length > 3 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full text-slate-400">
              +{property.features.length - 3}
            </span>
          )}
        </div>

        {/* Card Footer: Status Switcher */}
        <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-400">Durumu Değiştir:</span>
          <CustomSelect
            value={property.status}
            onChange={(e) => onStatusChange(property.id, e.target.value as PropertyStatus)}
            className="text-xs font-semibold rounded-full px-3 py-1 bg-navy-950 border border-white/10 text-slate-200 focus:outline-none focus:border-brand-gold/60 cursor-pointer"
          >
            <option value="AVAILABLE">Satışta</option>
            <option value="RESERVED">Rezerve</option>
            <option value="SOLD">Satıldı</option>
          </CustomSelect>
        </div>
      </div>
    </motion.div>
  )
}
