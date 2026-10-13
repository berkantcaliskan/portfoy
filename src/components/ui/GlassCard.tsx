import React from 'react'
import { cn } from '@/utils/cn'

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  variant?: 'default' | 'elevated' | 'gold' | 'interactive'
  className?: string
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  variant = 'default',
  className,
  ...props
}) => {
  const variantStyles = {
    default: 'glass-card-static',
    elevated: 'glass-panel-elevated',
    interactive: 'glass-card cursor-pointer',
    gold: 'glass-card border-brand-gold/30 hover:border-brand-gold/60 shadow-glass-glow',
  }

  return (
    <div
      className={cn(
        'rounded-[32px] p-6 transition-all duration-300 relative overflow-hidden',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
