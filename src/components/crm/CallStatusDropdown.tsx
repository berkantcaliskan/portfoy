import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Check } from 'lucide-react'
import { CallCenterStatus, CALL_STATUS_OPTIONS } from '@/types/lead'

interface CallStatusDropdownProps {
  value?: CallCenterStatus | string
  onChange: (newStatus: CallCenterStatus) => void
  disabled?: boolean
  className?: string
}

export const CallStatusDropdown: React.FC<CallStatusDropdownProps> = ({
  value = 'WAITING',
  onChange,
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [opensUpward, setOpensUpward] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 0,
  })

  const currentOption =
    CALL_STATUS_OPTIONS.find((opt) => opt.id === value || opt.label === value) ||
    CALL_STATUS_OPTIONS[0]

  const updatePosition = () => {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const dropdownHeight = 310

    let top = rect.bottom + 4
    const isUp = spaceBelow < dropdownHeight && rect.top > dropdownHeight
    if (isUp) {
      top = rect.top - dropdownHeight - 4
    }
    setOpensUpward(isUp)

    setCoords({
      top,
      left: rect.left,
      width: Math.max(rect.width, 185),
    })
  }

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (disabled) return
    if (!isOpen) {
      updatePosition()
      setIsOpen(true)
    } else {
      setIsOpen(false)
    }
  }

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setIsOpen(false)
      }
    }

    const handleScrollOrResize = (e: Event) => {
      if (menuRef.current && e.target instanceof Node && menuRef.current.contains(e.target)) {
        return
      }
      setIsOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('scroll', handleScrollOrResize, true)
    window.addEventListener('resize', handleScrollOrResize)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('scroll', handleScrollOrResize, true)
      window.removeEventListener('resize', handleScrollOrResize)
    }
  }, [isOpen])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        data-dropdown-open={isOpen ? 'true' : undefined}
        onClick={handleToggle}
        className={`px-3 py-1.5 rounded-full bg-[#282522] hover:bg-[#34302d] border border-[#4a443f] hover:border-[#b99881]/60 text-xs font-semibold text-white flex items-center justify-between gap-2 cursor-pointer transition-all select-none shadow-sm ${
          isOpen ? 'border-[#b99881] ring-1 ring-[#b99881]/40' : ''
        } ${className}`}
        title="Çağrı Merkezi Bilgi Durumu Seç"
      >
        <div className="flex items-center gap-2 truncate">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: currentOption.dotColor }}
          />
          <span className="truncate">{currentOption.label}</span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[#a69f99] shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-[#b99881]' : ''
          }`}
        />
      </button>

      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              ref={menuRef}
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
              style={{
                position: 'fixed',
                top: `${coords.top}px`,
                left: `${coords.left}px`,
                minWidth: `${coords.width}px`,
                zIndex: 99999,
              }}
              className="dropdown-panel rounded-[16px] backdrop-blur-2xl p-1.5 space-y-0.5 border border-[#4a443f]"
              onClick={(e) => e.stopPropagation()}
            >
              {CALL_STATUS_OPTIONS.map((opt) => {
                const isSelected = opt.id === currentOption.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onChange(opt.id)
                      setIsOpen(false)
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[10px] text-xs font-medium cursor-pointer transition-colors text-left ${
                      isSelected
                        ? 'bg-[#b99881]/25 text-white font-bold'
                        : 'text-[#d6beae] hover:bg-[#34302d] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: opt.dotColor }}
                      />
                      <span>{opt.label}</span>
                    </div>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-[#b99881] shrink-0" />
                    )}
                  </button>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
