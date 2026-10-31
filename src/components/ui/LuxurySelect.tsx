import React, { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
  subLabel?: string
  badge?: string | number
  icon?: React.ReactNode
}

export type LuxurySelectOption = SelectOption

export interface LuxurySelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  label?: string
  title?: string
  icon?: React.ReactNode
  placeholder?: string
  className?: string
  buttonClassName?: string
  minWidth?: string
  align?: 'left' | 'right'
  size?: 'sm' | 'md'
  compact?: boolean
  disabled?: boolean
}

export const LuxurySelect: React.FC<LuxurySelectProps> = ({
  value,
  onChange,
  options,
  label,
  title,
  icon,
  placeholder = 'Seçiniz...',
  className = '',
  buttonClassName = '',
  minWidth = 'min-w-[180px]',
  align = 'left',
  size = 'sm',
  compact = false,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState<{
    top: number
    left: number
    width: number
    openUpward: boolean
  }>({ top: 0, left: 0, width: 180, openUpward: false })

  const selectedOption = options.find((opt) => opt.value === value)

  const updatePosition = () => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const minW = Math.max(rect.width, 195)
    const estHeight = Math.min(options.length * 36 + 24, 260)
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const openUpward = spaceBelow < estHeight + 12 && spaceAbove > spaceBelow
    let left = align === 'right' ? rect.right - minW : rect.left
    if (left + minW > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - minW - 12)
    }
    if (left < 12) left = 12
    setCoords({
      top: openUpward ? rect.top - 6 : rect.bottom + 6,
      left,
      width: minW,
      openUpward,
    })
  }

  useLayoutEffect(() => {
    if (isOpen) updatePosition()
  }, [isOpen, options.length])

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (containerRef.current && containerRef.current.contains(target)) return
      if (menuRef.current && menuRef.current.contains(target)) return
      setIsOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    const handleScrollOrResize = (e: Event) => {
      if (menuRef.current && e.target && menuRef.current.contains(e.target as Node)) return
      updatePosition()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', handleScrollOrResize)
    window.addEventListener('scroll', handleScrollOrResize, true)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', handleScrollOrResize)
      window.removeEventListener('scroll', handleScrollOrResize, true)
    }
  }, [isOpen])

  const padClasses =
    compact || size === 'sm' ? 'px-3.5 py-2 text-xs' : 'px-4 py-2.5 text-sm'

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 bg-[#282522] border ${
          disabled
            ? 'opacity-50 cursor-not-allowed border-[#4a443f]'
            : isOpen
            ? 'border-[#b99881]/60 cursor-pointer'
            : 'border-[#4a443f] hover:border-[#b99881]/40 cursor-pointer'
        } rounded-full text-left transition-all duration-200 ${padClasses} ${minWidth} ${buttonClassName}`}
      >
        <div className="flex items-center gap-2 min-w-0 truncate">
          {icon && <span className="text-[#b99881] shrink-0">{icon}</span>}
          {label && (
            <span className="text-[#a69f99] font-normal shrink-0">{label}:</span>
          )}
          <span
            className={`truncate ${
              selectedOption ? 'text-[#f3efe9] font-semibold' : 'text-[#8c857f]'
            }`}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[#a69f99] shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-[#b99881]' : ''
          }`}
        />
      </button>

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            data-custom-select-portal="true"
            role="listbox"
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              minWidth: coords.width,
              maxWidth: Math.min(window.innerWidth - 24, Math.max(coords.width + 80, 320)),
              transform: coords.openUpward ? 'translateY(-100%)' : undefined,
              zIndex: 99999,
            }}
            className="dropdown-panel bg-[#282522] border border-[#4a443f] rounded-[22px] p-2 max-h-64 overflow-y-auto custom-scrollbar space-y-0.5 animate-fade-in"
          >
            {title && (
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#b99881]">
                {title}
              </div>
            )}
            {options.map((opt) => {
              const isSelected = opt.value === value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value)
                    setIsOpen(false)
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-full text-xs transition-colors cursor-pointer text-left ${
                    isSelected
                      ? 'is-active-dropdown-item bg-[#b99881]/20 text-white font-semibold'
                      : 'text-[#a69f99] hover:bg-[#34302d] hover:text-[#f3efe9]'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                    <div className="truncate">
                      <div className="truncate">{opt.label}</div>
                      {opt.subLabel && (
                        <div className="text-[10px] text-[#8c857f] truncate">
                          {opt.subLabel}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {opt.badge !== undefined && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#34302d] text-[#a69f99]">
                        {opt.badge}
                      </span>
                    )}
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-[#b99881] shrink-0" />
                    )}
                  </div>
                </button>
              )
            })}
          </div>,
          document.body
        )}
    </div>
  )
}
