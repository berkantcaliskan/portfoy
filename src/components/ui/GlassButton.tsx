import React from 'react'
import { motion, HTMLMotionProps } from 'framer-motion'
import { cn } from '@/utils/cn'

interface GlassButtonProps extends HTMLMotionProps<'button'> {
  children: React.ReactNode
  variant?: 'gold' | 'subtle' | 'outline' | 'emerald' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  icon?: React.ReactNode
  className?: string
}

export const GlassButton: React.FC<GlassButtonProps> = ({
  children,
  variant = 'gold',
  size = 'md',
  icon,
  className,
  ...props
}) => {
  const variantStyles = {
    gold: 'glass-button-gold text-slate-950 font-semibold',
    subtle: 'glass-button-subtle hover:text-white',
    outline: 'border border-brand-gold/40 text-brand-goldLight hover:bg-brand-gold/10 hover:border-brand-gold',
    emerald: 'bg-emerald-600/90 hover:bg-emerald-500 text-white shadow-[0_4px_20px_rgba(16,185,129,0.3)] border border-emerald-400/30 font-medium',
    danger: 'bg-rose-600/80 hover:bg-rose-500 text-white shadow-[0_4px_20px_rgba(244,63,94,0.3)] border border-rose-400/30 font-medium',
  }

  const sizeStyles = {
    sm: 'px-3.5 py-1.5 text-xs rounded-full gap-1.5',
    md: 'px-5 py-2 text-sm rounded-full gap-2',
    lg: 'px-6 py-2.5 text-base rounded-full gap-2.5',
  }

  return (
    <motion.button
      whileHover={{ scale: 1.015 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.15 }}
      className={cn(
        'inline-flex items-center justify-center font-medium transition-colors cursor-pointer select-none rounded-full',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </motion.button>
  )
}
