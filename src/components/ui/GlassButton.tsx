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
    gold: 'glass-button-gold text-[#f3efe9] font-medium shadow-none',
    subtle: 'glass-button-subtle text-[#d6beae] hover:text-white shadow-none',
    outline: 'border border-[#b99881]/30 text-[#d6beae] hover:bg-[#b99881]/10 hover:border-[#b99881]/50 shadow-none',
    emerald: 'bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-200 border border-emerald-500/30 font-medium shadow-none',
    danger: 'bg-rose-950/70 hover:bg-rose-900/80 text-rose-200 border border-rose-500/30 font-medium shadow-none',
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
