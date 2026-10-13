import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/utils/cn'

interface GlassModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  description?: string
  children: React.ReactNode
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'full'
  className?: string
}

export const GlassModal: React.FC<GlassModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'xl',
  className,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = 'unset'
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  const maxWidthStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    '7xl': 'max-w-7xl',
    full: 'max-w-full',
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-center p-4 sm:p-6 md:p-8 pt-6 sm:pt-8 md:pt-10 pb-6 sm:pb-8 overflow-y-auto">
          {/* Backdrop Blur Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: 'spring', damping: 26, stiffness: 360 }}
            className={cn(
              'glass-modal relative w-full z-10 my-auto rounded-[28px] sm:rounded-[32px] bg-[#282522] border border-[#4a443f] p-5 sm:p-6 shadow-2xl flex flex-col max-h-[calc(100vh-2.5rem)] sm:max-h-[calc(100vh-3.5rem)]',
              maxWidthStyles[maxWidth],
              className
            )}
            style={{
              boxShadow:
                '0 25px 60px -15px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(185, 152, 129, 0.22)',
            }}
          >
            {/* Top glass reflection highlight */}
            <div className="pointer-events-none absolute -top-px left-10 right-10 h-px bg-gradient-to-r from-transparent via-[#b99881]/50 to-transparent" />

            {/* Header */}
            {(title || description) && (
              <div className="flex items-start justify-between pb-3.5 border-b border-[#4a443f]/70 mb-4 shrink-0">
                <div className="pr-4">
                  {title && (
                    <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
                      {title}
                    </h3>
                  )}
                  {description && (
                    <p className="text-xs text-[#a69f99] mt-0.5">{description}</p>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="rounded-full p-1.5 text-[#a69f99] hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
