import React, { useState, useEffect, useRef } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export interface LuxurySelectOption {
  value: string
  label: string
  sublabel?: string
  icon?: React.ReactNode
}

export interface LuxurySelectProps {
  options: LuxurySelectOption[]
  value: string
  onChange: (value: string) => void
  label?: string
  title?: string
  placeholder?: string
  icon?: React.ReactNode
  className?: string
  align?: 'left' | 'right'
  minWidth?: string
  disabled?: boolean
}

export const LuxurySelect: React.FC<LuxurySelectProps> = ({
  options,
  value,
  onChange,
  label,
  title,
  placeholder = 'Seçiniz...',
  icon,
  className = '',
  align = 'right',
  minWidth = 'min-w-[220px] w-max max-w-[320px]',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [opensUpward, setOpensUpward] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find((opt) => opt.value === value)

  const handleToggle = () => {
    if (disabled) return
    if (!isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      if (spaceBelow < 280 && rect.top > 280) {
        setOpensUpward(true)
      } else {
        setOpensUpward(false)
      }
    }
    setIsOpen(!isOpen)
  }

  useEffect(() => {
    if (!isOpen) return

    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className} ${isOpen ? 'z-50' : 'z-20'}`}>
      {/* Trigger Button: Pill-shaped with dark mat luxury background */}
      <button
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#24211f] hover:bg-[#34302d] border border-[#4a443f] hover:border-[#b99881]/60 text-xs transition-all cursor-pointer select-none ${
          isOpen ? 'border-[#b99881] ring-1 ring-[#b99881]/30 bg-[#2e2a27]' : ''
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {icon && <span className="text-[#b99881] shrink-0 flex items-center">{icon}</span>}
        {label && <span className="text-xs text-[#a69f99] font-medium shrink-0">{label}</span>}
        <span className="font-semibold text-white truncate max-w-[170px] sm:max-w-[230px]">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[#a69f99] transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-[#b99881]' : ''
          }`}
        />
      </button>

      {/* Floating Dropdown Panel: Context-aware smooth slide */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{
              opacity: 0,
              y: opensUpward ? 16 : -14,
              scale: 0.96,
            }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
            }}
            exit={{
              opacity: 0,
              y: opensUpward ? 10 : -10,
              scale: 0.97,
            }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={`dropdown-panel absolute ${
              align === 'right' ? 'right-0' : 'left-0'
            } ${
              opensUpward ? 'bottom-full mb-2 dropdown-panel-up' : 'top-full mt-2 dropdown-panel-down'
            } ${minWidth} rounded-[20px] p-2.5 z-50 bg-[#1e1b18] backdrop-blur-2xl border border-[#4a443f] shadow-[0_16px_40px_rgba(0,0,0,0.85)]`}
          >
            {title && (
              <div className="px-3 py-1.5 text-xs font-semibold text-[#8c857f] uppercase tracking-wider">
                {title}
              </div>
            )}

            <div className="space-y-1 max-h-72 overflow-y-auto pr-0.5 custom-scrollbar">
              {options.map((opt) => {
                const isCurrent = opt.value === value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value)
                      setIsOpen(false)
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-[14px] text-xs sm:text-sm transition-colors cursor-pointer text-left ${
                      isCurrent
                        ? 'bg-[#b99881]/20 text-white font-semibold'
                        : 'text-[#a69f99] hover:bg-[#34302d] hover:text-[#f3efe9]'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate mr-2">
                      {opt.icon && <span className="text-[#b99881] shrink-0">{opt.icon}</span>}
                      <span className="truncate">{opt.label}</span>
                      {opt.sublabel && (
                        <span className="text-[10px] text-[#8c857f] shrink-0 font-normal">
                          {opt.sublabel}
                        </span>
                      )}
                    </div>
                    {isCurrent && <Check className="w-4 h-4 text-[#b99881] shrink-0 ml-1.5" />}
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
