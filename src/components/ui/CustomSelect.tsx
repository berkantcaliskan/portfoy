import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'

export interface CustomSelectProps {
  value?: string | number
  defaultValue?: string | number
  onChange?: (e: any) => void
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  children?: React.ReactNode
  className?: string
  style?: React.CSSProperties
  disabled?: boolean
  required?: boolean
  title?: string
  name?: string
  id?: string
}

interface ParsedOption {
  value: string
  label: string
  disabled?: boolean
}

function extractText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (React.isValidElement(node)) {
    return extractText((node.props as any)?.children)
  }
  return ''
}

function parseOptionsFromChildren(children: React.ReactNode): ParsedOption[] {
  const result: ParsedOption[] = []

  const walk = (nodes: React.ReactNode) => {
    React.Children.forEach(nodes, (child) => {
      if (!React.isValidElement(child)) return
      const el = child as React.ReactElement<any>
      if (el.type === 'option') {
        const label = extractText(el.props.children)
        const val =
          el.props.value !== undefined && el.props.value !== null
            ? String(el.props.value)
            : label
        result.push({
          value: val,
          label,
          disabled: Boolean(el.props.disabled),
        })
      } else if (el.props && el.props.children) {
        walk(el.props.children)
      }
    })
  }

  walk(children)
  return result
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  defaultValue,
  onChange,
  onClick,
  children,
  className = '',
  style,
  disabled = false,
  title,
  name,
  id,
}) => {
  const options = useMemo(() => parseOptionsFromChildren(children), [children])
  const isControlled = value !== undefined
  const [internalVal, setInternalVal] = useState<string>(() => {
    if (value !== undefined) return String(value)
    if (defaultValue !== undefined) return String(defaultValue)
    return options[0]?.value ?? ''
  })

  const currentVal = isControlled ? String(value ?? '') : internalVal
  const selectedOption =
    options.find((o) => o.value === currentVal) || options[0] || { value: '', label: '' }

  const [isOpen, setIsOpen] = useState(false)
  const [hasExternalChevron, setHasExternalChevron] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState<{
    top: number
    left: number
    width: number
    openUpward: boolean
  }>({ top: 0, left: 0, width: 180, openUpward: false })

  useLayoutEffect(() => {
    const parent = triggerRef.current?.parentElement
    if (parent) {
      const ext = parent.querySelector('.pointer-events-none[class*="right-"]')
      setHasExternalChevron(Boolean(ext))
    }
  }, [])

  const updatePosition = () => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const minW = Math.max(rect.width, 176)
    const estHeight = Math.min(options.length * 36 + 16, 260)
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const openUpward = spaceBelow < estHeight + 12 && spaceAbove > spaceBelow

    let left = rect.left
    if (left + minW > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - minW - 12)
    }

    setCoords({
      top: openUpward ? rect.top - 6 : rect.bottom + 6,
      left,
      width: minW,
      openUpward,
    })
  }

  useLayoutEffect(() => {
    if (isOpen) {
      updatePosition()
    }
  }, [isOpen, options.length])

  useEffect(() => {
    if (!isOpen) return

    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current && triggerRef.current.contains(target)) return
      if (menuRef.current && menuRef.current.contains(target)) return
      setIsOpen(false)
    }

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }

    const handleScrollOrResize = (e: Event) => {
      if (menuRef.current && e.target && menuRef.current.contains(e.target as Node)) {
        return
      }
      updatePosition()
    }

    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleKey)
    window.addEventListener('resize', handleScrollOrResize)
    window.addEventListener('scroll', handleScrollOrResize, true)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleKey)
      window.removeEventListener('resize', handleScrollOrResize)
      window.removeEventListener('scroll', handleScrollOrResize, true)
    }
  }, [isOpen])

  const handleSelect = (nextValue: string) => {
    if (!isControlled) {
      setInternalVal(nextValue)
    }
    if (onChange) {
      const syntheticEvent = {
        target: { value: nextValue, name: name || '' },
        currentTarget: { value: nextValue, name: name || '' },
        preventDefault: () => {},
        stopPropagation: () => {},
      }
      onChange(syntheticEvent)
    }
    setIsOpen(false)
  }

  const cleanedClassName = className
    .replace(/\bappearance-none\b/g, '')
    .trim()

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        name={name}
        type="button"
        disabled={disabled}
        title={title || selectedOption.label}
        style={style}
        onClick={(e) => {
          if (onClick) onClick(e)
          if (disabled) return
          setIsOpen((prev) => !prev)
        }}
        className={`inline-flex items-center justify-between gap-2 text-left select-none transition-colors ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        } ${cleanedClassName || 'bg-[#282522] border border-[#4a443f] rounded-full px-3.5 py-2 text-xs text-white'}`}
      >
        <span className="truncate flex-1">{selectedOption.label}</span>
        {!hasExternalChevron && (
          <ChevronDown
            className={`w-3.5 h-3.5 text-[#a69f99] shrink-0 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-[#b99881]' : ''
            }`}
          />
        )}
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
            onClick={(e) => e.stopPropagation()}
            className="dropdown-panel bg-[#282522] border border-[#4a443f] rounded-[22px] p-2 max-h-64 overflow-y-auto custom-scrollbar space-y-0.5 animate-fade-in"
          >
            {options.map((opt, idx) => {
              const isSelected = opt.value === currentVal
              return (
                <button
                  key={`${opt.value}-${idx}`}
                  type="button"
                  disabled={opt.disabled}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (opt.disabled) return
                    handleSelect(opt.value)
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-full text-xs transition-colors cursor-pointer text-left ${
                    isSelected
                      ? 'is-active-dropdown-item bg-[#b99881]/20 text-white font-semibold'
                      : 'text-[#a69f99] hover:bg-[#34302d] hover:text-[#f3efe9]'
                  } ${opt.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-[#b99881] shrink-0" />}
                </button>
              )
            })}
          </div>,
          document.body
        )}
    </>
  )
}
