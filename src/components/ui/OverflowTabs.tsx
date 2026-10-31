import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal, Check, X } from 'lucide-react'

export interface OverflowTabItem {
  id: string
  label?: React.ReactNode
  dropdownLabel?: React.ReactNode
  icon?: React.ReactNode
  iconOnly?: boolean
  title?: string
  onRemove?: (e: React.MouseEvent) => void
}

export interface OverflowTabsProps {
  tabs: OverflowTabItem[]
  activeId: string
  onSelect: (id: string) => void
  prefixLabel?: string
  trailingElement?: React.ReactNode
  className?: string
  size?: 'sm' | 'md'
}

export const OverflowTabs: React.FC<OverflowTabsProps> = ({
  tabs,
  activeId,
  onSelect,
  prefixLabel,
  trailingElement,
  className = '',
  size = 'md',
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const measureRowRef = useRef<HTMLDivElement>(null)
  const prefixRef = useRef<HTMLSpanElement>(null)
  const trailingRef = useRef<HTMLDivElement>(null)
  const moreBtnRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [visibleCount, setVisibleCount] = useState<number>(tabs.length)
  const [isOpen, setIsOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  const pillPadding = size === 'sm' ? 'px-3 py-1 text-[11px]' : 'px-3.5 py-1.5 text-xs'

  const recalculate = useCallback(() => {
    const container = containerRef.current
    const measureRow = measureRowRef.current
    if (!container || !measureRow) return

    const containerWidth = container.clientWidth
    if (containerWidth <= 0) return

    const gap = 6 // gap-1.5 = 6px
    const prefixW = prefixRef.current ? prefixRef.current.offsetWidth + gap : 0
    const trailingW = trailingRef.current ? trailingRef.current.offsetWidth + gap : 0
    const availableForTabs = containerWidth - prefixW - trailingW

    const children = Array.from(measureRow.children) as HTMLElement[]
    if (children.length === 0) {
      setVisibleCount(0)
      return
    }

    const widths = children.map((el) => el.offsetWidth)
    const totalAllWidth = widths.reduce((acc, w, idx) => acc + w + (idx > 0 ? gap : 0), 0)

    if (totalAllWidth <= availableForTabs) {
      setVisibleCount(tabs.length)
      return
    }

    // Reserve space for the "..." icon button (36px + gap)
    const moreBtnReserve = 38 + gap
    const budget = availableForTabs - moreBtnReserve

    let used = 0
    let fitCount = 0
    for (let i = 0; i < widths.length; i++) {
      const w = widths[i] + (i > 0 ? gap : 0)
      if (used + w <= budget) {
        used += w
        fitCount++
      } else {
        break
      }
    }

    setVisibleCount(Math.max(1, Math.min(fitCount, tabs.length - 1)))
  }, [tabs])

  useLayoutEffect(() => {
    recalculate()
  }, [recalculate, tabs, activeId])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const ro = new ResizeObserver(() => {
      recalculate()
    })
    ro.observe(container)
    window.addEventListener('resize', recalculate)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', recalculate)
    }
  }, [recalculate])

  const updateMenuPosition = useCallback(() => {
    if (!moreBtnRef.current) return
    const rect = moreBtnRef.current.getBoundingClientRect()
    const menuWidth = 235
    const left = Math.max(
      12,
      Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 12)
    )
    const top = Math.min(rect.bottom + 6, window.innerHeight - 280)
    setMenuPos({ top, left })
  }, [])

  useEffect(() => {
    if (!isOpen) return
    updateMenuPosition()

    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        moreBtnRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return
      }
      setIsOpen(false)
    }

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }

    window.addEventListener('mousedown', handleOutside)
    window.addEventListener('keydown', handleKey)
    window.addEventListener('resize', updateMenuPosition)
    window.addEventListener('scroll', updateMenuPosition, true)
    return () => {
      window.removeEventListener('mousedown', handleOutside)
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('resize', updateMenuPosition)
      window.removeEventListener('scroll', updateMenuPosition, true)
    }
  }, [isOpen, updateMenuPosition])

  const visibleTabs = tabs.slice(0, visibleCount)
  const overflowTabs = tabs.slice(visibleCount)
  const hasOverflowActive = overflowTabs.some((t) => t.id === activeId)

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden py-0.5 ${className}`}
    >
      {/* Hidden measurement row to get exact natural widths of all tabs */}
      <div
        ref={measureRowRef}
        aria-hidden="true"
        className="fixed -top-[9999px] -left-[9999px] pointer-events-none invisible flex items-center gap-1.5 whitespace-nowrap"
      >
        {tabs.map((tab) => (
          <div
            key={`measure-${tab.id}`}
            className={
              tab.iconOnly
                ? 'w-8 h-8 rounded-full inline-flex items-center justify-center shrink-0'
                : `inline-flex items-center gap-1.5 rounded-full font-bold whitespace-nowrap ${pillPadding}`
            }
          >
            {tab.icon}
            {!tab.iconOnly && <span>{tab.label}</span>}
            {tab.onRemove && <span className="w-3.5 h-3.5 inline-block" />}
          </div>
        ))}
      </div>

      {prefixLabel && (
        <span
          ref={prefixRef}
          className="text-xs text-[#8c857f] mr-0.5 shrink-0 whitespace-nowrap"
        >
          {prefixLabel}
        </span>
      )}

      {visibleTabs.map((tab) => {
        const isActive = tab.id === activeId
        return (
          <button
            key={tab.id}
            type="button"
            title={tab.title}
            onClick={() => onSelect(tab.id)}
            className={`tab-pill-btn transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              tab.iconOnly
                ? 'w-8 h-8 rounded-full inline-flex items-center justify-center'
                : `inline-flex items-center gap-1.5 rounded-full font-medium ${pillPadding}`
            } ${
              isActive
                ? 'is-active-tab-pill font-bold'
                : 'bg-[#34302d] text-[#a69f99] hover:text-white border border-[#4a443f]'
            }`}
          >
            {tab.icon}
            {!tab.iconOnly && <span>{tab.label}</span>}
            {tab.onRemove && (
              <span
                role="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.stopPropagation()
                  tab.onRemove?.(e)
                }}
                className="hover:text-rose-400 p-0.5 rounded-full inline-flex items-center justify-center"
                title="Sekmeyi Kaldır"
              >
                <X className="w-3 h-3" />
              </span>
            )}
          </button>
        )
      })}

      {overflowTabs.length > 0 && (
        <button
          ref={moreBtnRef}
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          title={`Diğer sekmeler (${overflowTabs.length})`}
          className={`tab-pill-btn inline-flex items-center justify-center w-8 h-8 rounded-full transition-all cursor-pointer shrink-0 ${
            hasOverflowActive || isOpen
              ? 'is-active-tab-pill font-bold'
              : 'bg-[#34302d] text-[#a69f99] hover:text-white border border-[#4a443f]'
          }`}
        >
          <MoreHorizontal className="w-4 h-4 shrink-0" />
        </button>
      )}

      {trailingElement && (
        <div ref={trailingRef} className="shrink-0 flex items-center">
          {trailingElement}
        </div>
      )}

      {isOpen &&
        overflowTabs.length > 0 &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed',
              top: `${menuPos.top}px`,
              left: `${menuPos.left}px`,
              zIndex: 99999,
            }}
            className="dropdown-panel rounded-[18px] bg-[#282522] border border-[#4a443f] p-1.5 min-w-[215px] max-w-[280px] max-h-[300px] overflow-y-auto space-y-1 backdrop-blur-2xl"
          >
            {overflowTabs.map((tab) => {
              const isActive = tab.id === activeId
              return (
                <div
                  key={`overflow-${tab.id}`}
                  onClick={() => {
                    onSelect(tab.id)
                    setIsOpen(false)
                  }}
                  title={tab.title}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-full text-xs transition-all cursor-pointer ${
                    isActive
                      ? 'tab-pill-btn is-active-tab-pill font-bold'
                      : 'text-[#d6beae] hover:text-white hover:bg-white/5 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                    {tab.icon && <span className="shrink-0">{tab.icon}</span>}
                    <span className="truncate">
                      {tab.dropdownLabel || tab.label || tab.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isActive && <Check className="w-3.5 h-3.5 shrink-0" />}
                    {tab.onRemove && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          tab.onRemove?.(e)
                        }}
                        className="hover:text-rose-400 p-0.5 rounded-full"
                        title="Sekmeyi Kaldır"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>,
          document.body
        )}
    </div>
  )
}

export default OverflowTabs
