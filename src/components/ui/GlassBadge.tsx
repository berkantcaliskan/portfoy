import React from 'react'
import { cn } from '@/utils/cn'

export type GlassBadgeVariant =
  | 'gold'
  | 'sky'
  | 'emerald'
  | 'rose'
  | 'purple'
  | 'amber'
  | 'neutral'
  | 'success'
  | 'danger'
  | 'warning'
  | 'primary'
  | 'default'
  | 'info'

interface GlassBadgeProps {
  children: React.ReactNode
  variant?: GlassBadgeVariant
  size?: 'sm' | 'md'
  dot?: boolean
  className?: string
}

export const GlassBadge: React.FC<GlassBadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'sm',
  dot = false,
  className,
}) => {
  const variantStyles: Record<GlassBadgeVariant, string> = {
    neutral: 'bg-white/5 text-slate-300 border-white/10',
    gold: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    sky: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
    emerald: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    rose: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
    purple: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
    amber: 'bg-amber-500/15 text-amber-200 border-amber-500/30',
    success: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    danger: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
    warning: 'bg-amber-500/15 text-amber-200 border-amber-500/30',
    primary: 'bg-[#b99881]/20 text-[#d6beae] border-[#b99881]/30',
    default: 'bg-white/5 text-slate-300 border-white/10',
    info: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  }

  const dotStyles: Record<GlassBadgeVariant, string> = {
    neutral: 'bg-slate-400',
    gold: 'bg-amber-400',
    sky: 'bg-sky-400',
    emerald: 'bg-emerald-400',
    rose: 'bg-rose-400',
    purple: 'bg-purple-400',
    amber: 'bg-amber-400',
    success: 'bg-emerald-400',
    danger: 'bg-rose-400',
    warning: 'bg-amber-400',
    primary: 'bg-[#b99881]',
    default: 'bg-slate-400',
    info: 'bg-sky-400',
  }

  const sizeStyles = {
    sm: 'text-xs px-2.5 py-0.5 font-medium',
    md: 'text-sm px-3 py-1 font-semibold',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border backdrop-blur-md transition-colors',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dotStyles[variant])} />}
      {children}
    </span>
  )
}
