import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Search, Check } from 'lucide-react'

export interface CountryInfo {
  code: string // ISO
  name: string
  dialCode: string
  flag: string
  format: (rawDigits: string) => string
}

export const COUNTRIES: CountryInfo[] = [
  {
    code: 'TR',
    name: 'Türkiye',
    dialCode: '+90',
    flag: '🇹🇷',
    format: (digits) => {
      // 10 digits expected: 544 849 11 25
      const d = digits.slice(0, 10)
      if (d.length <= 3) return d
      if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`
      if (d.length <= 8) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`
      return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8, 10)}`
    },
  },
  {
    code: 'DE',
    name: 'Almanya',
    dialCode: '+49',
    flag: '🇩🇪',
    format: (digits) => {
      const d = digits.slice(0, 11)
      if (d.length <= 4) return d
      return `${d.slice(0, 4)} ${d.slice(4)}`
    },
  },
  {
    code: 'GB',
    name: 'Birleşik Krallık',
    dialCode: '+44',
    flag: '🇬🇧',
    format: (digits) => {
      const d = digits.slice(0, 10)
      if (d.length <= 4) return d
      return `${d.slice(0, 4)} ${d.slice(4)}`
    },
  },
  {
    code: 'US',
    name: 'Amerika Birleşik Devletleri',
    dialCode: '+1',
    flag: '🇺🇸',
    format: (digits) => {
      const d = digits.slice(0, 10)
      if (d.length <= 3) return d
      if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`
      return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
    },
  },
  {
    code: 'AE',
    name: 'Birleşik Arap Emirlikleri',
    dialCode: '+971',
    flag: '🇦🇪',
    format: (digits) => {
      const d = digits.slice(0, 9)
      if (d.length <= 2) return d
      if (d.length <= 5) return `${d.slice(0, 2)} ${d.slice(2)}`
      return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`
    },
  },
  {
    code: 'FR',
    name: 'Fransa',
    dialCode: '+33',
    flag: '🇫🇷',
    format: (digits) => {
      const d = digits.slice(0, 9)
      if (d.length <= 1) return d
      if (d.length <= 3) return `${d.slice(0, 1)} ${d.slice(1)}`
      if (d.length <= 5) return `${d.slice(0, 1)} ${d.slice(1, 3)} ${d.slice(3)}`
      if (d.length <= 7) return `${d.slice(0, 1)} ${d.slice(1, 3)} ${d.slice(3, 5)} ${d.slice(5)}`
      return `${d.slice(0, 1)} ${d.slice(1, 3)} ${d.slice(3, 5)} ${d.slice(5, 7)} ${d.slice(7)}`
    },
  },
  {
    code: 'NL',
    name: 'Hollanda',
    dialCode: '+31',
    flag: '🇳🇱',
    format: (digits) => {
      const d = digits.slice(0, 9)
      if (d.length <= 1) return d
      return `${d.slice(0, 1)} ${d.slice(1)}`
    },
  },
  {
    code: 'RU',
    name: 'Rusya',
    dialCode: '+7',
    flag: '🇷🇺',
    format: (digits) => {
      const d = digits.slice(0, 10)
      if (d.length <= 3) return d
      if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`
      return `${d.slice(0, 3)} ${d.slice(3, 6)}-${d.slice(6)}`
    },
  },
  {
    code: 'AZ',
    name: 'Azerbaycan',
    dialCode: '+994',
    flag: '🇦🇿',
    format: (digits) => {
      const d = digits.slice(0, 9)
      if (d.length <= 2) return d
      if (d.length <= 5) return `${d.slice(0, 2)} ${d.slice(2)}`
      if (d.length <= 7) return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`
      return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7)}`
    },
  },
  {
    code: 'SA',
    name: 'Suudi Arabistan',
    dialCode: '+966',
    flag: '🇸🇦',
    format: (digits) => {
      const d = digits.slice(0, 9)
      if (d.length <= 2) return d
      if (d.length <= 5) return `${d.slice(0, 2)} ${d.slice(2)}`
      return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`
    },
  },
  {
    code: 'QA',
    name: 'Katar',
    dialCode: '+974',
    flag: '🇶🇦',
    format: (digits) => {
      const d = digits.slice(0, 8)
      if (d.length <= 4) return d
      return `${d.slice(0, 4)} ${d.slice(4)}`
    },
  },
  {
    code: 'KW',
    name: 'Kuveyt',
    dialCode: '+965',
    flag: '🇰🇼',
    format: (digits) => {
      const d = digits.slice(0, 8)
      if (d.length <= 4) return d
      return `${d.slice(0, 4)} ${d.slice(4)}`
    },
  },
  {
    code: 'CH',
    name: 'İsviçre',
    dialCode: '+41',
    flag: '🇨🇭',
    format: (digits) => {
      const d = digits.slice(0, 9)
      if (d.length <= 2) return d
      if (d.length <= 5) return `${d.slice(0, 2)} ${d.slice(2)}`
      return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`
    },
  },
  {
    code: 'IT',
    name: 'İtalya',
    dialCode: '+39',
    flag: '🇮🇹',
    format: (digits) => {
      const d = digits.slice(0, 10)
      if (d.length <= 3) return d
      return `${d.slice(0, 3)} ${d.slice(3)}`
    },
  },
  {
    code: 'ES',
    name: 'İspanya',
    dialCode: '+34',
    flag: '🇪🇸',
    format: (digits) => {
      const d = digits.slice(0, 9)
      if (d.length <= 3) return d
      if (d.length <= 5) return `${d.slice(0, 3)} ${d.slice(3)}`
      if (d.length <= 7) return `${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5)}`
      return `${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 7)} ${d.slice(7)}`
    },
  },
]

interface PhoneInputProps {
  label?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  className?: string
  error?: string
  id?: string
  name?: string
  autoFocus?: boolean
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  className = '',
  error,
  id,
  name,
  autoFocus,
}) => {
  const [selectedCountry, setSelectedCountry] = useState<CountryInfo>(COUNTRIES[0]) // TR default
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Parse initial value to detect country
  useEffect(() => {
    if (!value) return
    const trimmed = value.trim()
    if (trimmed.startsWith('+')) {
      const found = COUNTRIES.find((c) => trimmed.startsWith(c.dialCode))
      if (found) {
        setSelectedCountry(found)
      }
    }
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Auto focus search input when dropdown opens
  useEffect(() => {
    if (isDropdownOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 60)
    } else {
      setSearchQuery('')
    }
  }, [isDropdownOpen])

  // Extract raw digits after dialCode
  const formatValue = (country: CountryInfo, inputStr: string): string => {
    if (!inputStr) return ''

    let clean = inputStr.trim()

    // If starts with dialCode, strip it
    if (clean.startsWith(country.dialCode)) {
      clean = clean.slice(country.dialCode.length).trim()
    } else if (clean.startsWith(country.dialCode.replace('+', ''))) {
      clean = clean.slice(country.dialCode.length - 1).trim()
    }

    // Turkish or local leading 0
    if (clean.startsWith('0')) {
      clean = clean.slice(1).trim()
    }

    // Keep only numbers
    const digitsOnly = clean.replace(/\D/g, '')

    if (digitsOnly.length === 0) {
      return country.dialCode + ' '
    }

    const formattedBody = country.format(digitsOnly)
    return `${country.dialCode} ${formattedBody}`
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value

    // If completely cleared
    if (!raw.trim()) {
      onChange('')
      return
    }

    // Check if user changed country code manually (e.g. pasted +49...)
    if (raw.startsWith('+')) {
      const match = COUNTRIES.find((c) => raw.startsWith(c.dialCode))
      if (match && match.code !== selectedCountry.code) {
        setSelectedCountry(match)
        const formatted = formatValue(match, raw)
        onChange(formatted)
        return
      }
    }

    const formatted = formatValue(selectedCountry, raw)
    onChange(formatted)
  }

  const handleSelectCountry = (country: CountryInfo) => {
    setSelectedCountry(country)
    setIsDropdownOpen(false)

    // Re-format existing digits with new country
    const currentDigits = value.replace(/\D/g, '')
    // remove previous dialCode digits if present
    const prevDialDigits = selectedCountry.dialCode.replace(/\D/g, '')
    let rawDigits = currentDigits
    if (rawDigits.startsWith(prevDialDigits)) {
      rawDigits = rawDigits.slice(prevDialDigits.length)
    }

    if (rawDigits.length > 0) {
      const formatted = `${country.dialCode} ${country.format(rawDigits)}`
      onChange(formatted)
    } else {
      onChange(`${country.dialCode} `)
    }
  }

  // Filter countries for search
  const filteredCountries = COUNTRIES.filter((c) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase().trim()
    return (
      c.name.toLowerCase().includes(q) ||
      c.dialCode.includes(q) ||
      c.code.toLowerCase().includes(q)
    )
  })

  // Display value fallback
  const displayValue = value || `${selectedCountry.dialCode} `

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
          {label}
        </label>
      )}
      {/* Container Box */}
      <div className={`flex items-center w-full rounded-full bg-[#24211f] border ${error ? 'border-rose-500/80 focus-within:border-rose-400' : 'border-[#4a443f] focus-within:border-[#b99881]'} transition-colors overflow-hidden`}>
        {/* Country Flag & DialCode Button */}
        <button
          type="button"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center gap-1.5 px-3.5 py-2.5 bg-[#34302d] hover:bg-[#3d3733] border-r border-[#4a443f] text-xs font-semibold text-white transition-colors cursor-pointer select-none shrink-0"
          title="Ülke Kodunu Değiştir"
        >
          <span className="text-base leading-none">{selectedCountry.flag}</span>
          <span className="font-mono text-[11px] text-[#d6beae]">{selectedCountry.dialCode}</span>
          <ChevronDown
            className={`w-3 h-3 text-[#a69f99] transition-transform duration-200 ${
              isDropdownOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* Number Input */}
        <input
          id={id}
          name={name}
          type="tel"
          required={required}
          autoFocus={autoFocus}
          placeholder={placeholder || `${selectedCountry.dialCode} 5XX XXX XX XX`}
          value={displayValue}
          onChange={handleInputChange}
          className="w-full bg-transparent px-3 py-2.5 text-xs text-[#f3efe9] placeholder-[#7d756f] focus:outline-none font-mono"
        />
      </div>
      {error && <p className="text-xs text-rose-400 mt-1.5 font-medium">{error}</p>}

      {/* Country Selection Dropdown - Yukarıdan Aşağıya Slide */}
      <AnimatePresence>
        {isDropdownOpen && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="dropdown-panel absolute left-0 top-full mt-2 w-72 max-h-80 rounded-2xl p-2 z-50 flex flex-col gap-2 backdrop-blur-2xl border border-[#4a443f]"
            style={{ colorScheme: 'dark' }}
          >
            {/* Search Box */}
            <div className="relative shrink-0">
              <Search className="w-3.5 h-3.5 text-[#8c857f] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Ülke veya kod ara (+90, Almanya)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#1d1a18] border border-[#3d3733] text-xs text-white placeholder-[#7d756f] focus:outline-none focus:border-[#b99881]"
              />
            </div>

            {/* Countries List */}
            <div className="overflow-y-auto space-y-1 flex-1 pr-1 custom-scrollbar">
              {filteredCountries.length === 0 ? (
                <div className="p-4 text-center text-xs text-[#8c857f]">Sonuç bulunamadı</div>
              ) : (
                filteredCountries.map((c) => {
                  const isSelected = c.code === selectedCountry.code
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => handleSelectCountry(c)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer text-left ${
                        isSelected
                          ? 'bg-[#b99881]/20 text-white font-semibold'
                          : 'text-[#d6beae] hover:bg-[#34302d] hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span className="text-base leading-none">{c.flag}</span>
                        <span className="truncate">{c.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-[11px] text-[#b99881]">{c.dialCode}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#b99881]" />}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
