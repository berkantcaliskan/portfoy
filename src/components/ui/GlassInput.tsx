import React from 'react'
import { cn } from '@/utils/cn'

interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode
  label?: string
  error?: string
}

export const GlassInput = React.forwardRef<HTMLInputElement, GlassInputProps>(
  ({ icon, label, error, className, ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label className="block text-xs font-medium text-slate-300">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && (
            <div className="absolute left-3.5 text-slate-400 pointer-events-none flex items-center">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              'glass-input w-full rounded-full py-2.5 text-sm text-white placeholder-slate-400/70',
              icon ? 'pl-10 pr-4' : 'px-4',
              error && 'border-rose-500/60 focus:border-rose-500',
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-rose-400">{error}</p>}
      </div>
    )
  }
)

GlassInput.displayName = 'GlassInput'
