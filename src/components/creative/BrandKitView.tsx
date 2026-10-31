import React, { useState, useRef } from 'react'
import {
  Sparkles,
  Copy,
  Check,
  Type,
  Layers,
  Monitor,
  Smartphone,
  ShieldCheck,
  Pencil,
  Upload,
  Image as ImageIcon,
  Plus,
  Trash2,
} from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { BookLogo } from '@/components/common/BookLogo'

function isLightBackgroundHex(hex: string): boolean {
  const clean = hex.replace('#', '').trim()
  if (clean.length !== 6) return false
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  if (isNaN(r) || isNaN(g) || isNaN(b)) return false
  const perceivedBrightness = 0.299 * r + 0.587 * g + 0.114 * b
  return perceivedBrightness > 185
}

function hexToRgbString(hex: string): string {
  const clean = hex.replace('#', '').trim()
  if (clean.length !== 6) return '0, 0, 0'
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '0, 0, 0'
  return `${r}, ${g}, ${b}`
}

interface BrandColorItem {
  id: string
  name: string
  hex: string
  rgb: string
  usage: string
}

interface TypographyState {
  headingLabel: string
  headingStyle: string
  headingFont: string
  headingDesc: string
  bodyLabel: string
  bodyStyle: string
  bodyFont: string
  bodyDesc: string
  footerTitle: string
  footerText: string
}

interface LogoState {
  brandTitle: string
  brandSubtitle: string
  darkLogoUrl: string
  lightLogoUrl: string
  clearSpaceRule: string
  formatsNote: string
}

interface FormatSpecItem {
  id: string
  title: string
  ratio: string
  resolution: string
  safeZone: string
  iconKey: 'smartphone' | 'layers' | 'shield' | 'monitor'
}

interface BrandKitData {
  colors: BrandColorItem[]
  typography: TypographyState
  logo: LogoState
  formats: FormatSpecItem[]
}

const DEFAULT_BRAND_KIT: BrandKitData = {
  colors: [
    {
      id: 'c1',
      name: 'Demirtürk Kurumsal Lacivert',
      hex: '#0F172A',
      rgb: '15, 23, 42',
      usage: 'Ana zemin, kurumsal antet ve katalog arka planları',
    },
    {
      id: 'c2',
      name: 'Demirtürk Prestij Altın',
      hex: '#D4AF37',
      rgb: '212, 175, 55',
      usage: 'Ödeme kampanyası vurguları, rozetler ve CTA butonları',
    },
    {
      id: 'c3',
      name: 'Portföy İndigo Aksan',
      hex: '#6366F1',
      rgb: '99, 102, 241',
      usage: 'Dijital reklam çerçeveleri ve modern proje vurguları',
    },
    {
      id: 'c4',
      name: 'Karasu Sahil Turkuazı',
      hex: '#0EA5E9',
      rgb: '14, 165, 233',
      usage: 'Havuz, deniz mesafesi ve yaz lansmanı kreatifleri',
    },
    {
      id: 'c5',
      name: 'Mimari Kırık Beyaz',
      hex: '#F8FAFC',
      rgb: '248, 250, 252',
      usage: 'Ana tipografi, okunabilir başlıklar ve açık tema kataloglar',
    },
  ],
  typography: {
    headingLabel: 'Başlıklar',
    headingStyle: 'Serif / Display',
    headingFont: 'The Seasons',
    headingDesc: 'Ana başlıklar, proje lansman kapakları ve prestij vurguları.',
    bodyLabel: 'Gövde Metni',
    bodyStyle: 'Sans-Serif',
    bodyFont: 'Plus Jakarta Sans',
    bodyDesc: 'Açıklama metinleri, katalog içerikleri, alt başlıklar ve arayüz yazıları.',
    footerTitle: 'Kurumsal Alt Bilgi (Footer)',
    footerText: 'demirturkinsaat.com • Kurumsal İletişim Hattı • Demirtürk İnşaat Logosu',
  },
  logo: {
    brandTitle: 'DEMİRTÜRK',
    brandSubtitle: 'HOLDİNG & İNŞAAT',
    darkLogoUrl: '',
    lightLogoUrl: '',
    clearSpaceRule: 'Logo çevresinde en az 24px güvenli boşluk bırakılmalı, oranları bozulmamalıdır.',
    formatsNote: 'SVG • PNG (Şeffaf) • PDF Vektörel',
  },
  formats: [
    {
      id: 'f1',
      title: 'Instagram Reels / Story & Meta Dikey Video',
      ratio: '9:16',
      resolution: '1080 × 1920 px',
      safeZone: 'Üstten 250px, alttan 420px metin güvenli alanı bırakılmalı',
      iconKey: 'smartphone',
    },
    {
      id: 'f2',
      title: 'Instagram & Meta Ads Dikey Post / Karusel',
      ratio: '4:5',
      resolution: '1080 × 1350 px',
      safeZone: 'Akışta en yüksek ekran kaplama oranı sağlayan ana reklam formatı',
      iconKey: 'layers',
    },
    {
      id: 'f3',
      title: 'Kare Kurumsal & Özel Gün Postu',
      ratio: '1:1',
      resolution: '1080 × 1080 px',
      safeZone: 'Köşelerden 90px iç boşluk (margin) ve sağ altta kurumsal logo',
      iconKey: 'shield',
    },
    {
      id: 'f4',
      title: 'Web Hero, YouTube & 3D Render Sunum',
      ratio: '16:9',
      resolution: '3840 × 2160 px (4K)',
      safeZone: 'demirturkinsaat.com proje sayfası ve TV sunum ekranları için',
      iconKey: 'monitor',
    },
  ],
}

const STORAGE_KEY = 'demirturk_brand_kit_v1'

function loadBrandKit(): BrandKitData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        colors: Array.isArray(parsed.colors) && parsed.colors.length > 0 ? parsed.colors : DEFAULT_BRAND_KIT.colors,
        typography: { ...DEFAULT_BRAND_KIT.typography, ...(parsed.typography || {}) },
        logo: { ...DEFAULT_BRAND_KIT.logo, ...(parsed.logo || {}) },
        formats: Array.isArray(parsed.formats) && parsed.formats.length > 0 ? parsed.formats : DEFAULT_BRAND_KIT.formats,
      }
    }
  } catch {}
  return DEFAULT_BRAND_KIT
}

export function BrandKitView() {
  const [data, setData] = useState<BrandKitData>(() => loadBrandKit())
  const [copiedHex, setCopiedHex] = useState<string | null>(null)
  const [editingSection, setEditingSection] = useState<'colors' | 'typography' | 'logo' | 'formats' | null>(null)

  const darkLogoInputRef = useRef<HTMLInputElement>(null)
  const lightLogoInputRef = useRef<HTMLInputElement>(null)

  const saveAll = (next: BrandKitData) => {
    setData(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {}
  }

  const handleCopyHex = (hex: string) => {
    if (editingSection === 'colors') return
    navigator.clipboard?.writeText(hex)
    setCopiedHex(hex)
    setTimeout(() => setCopiedHex(null), 1800)
  }

  const handleLogoUpload = (variant: 'darkLogoUrl' | 'lightLogoUrl', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        saveAll({
          ...data,
          logo: {
            ...data.logo,
            [variant]: reader.result,
          },
        })
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const getFormatIcon = (key: FormatSpecItem['iconKey']) => {
    switch (key) {
      case 'smartphone':
        return Smartphone
      case 'layers':
        return Layers
      case 'shield':
        return ShieldCheck
      case 'monitor':
      default:
        return Monitor
    }
  }

  const toggleEdit = (section: 'colors' | 'typography' | 'logo' | 'formats') => {
    setEditingSection((prev) => (prev === section ? null : section))
  }

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-5 h-5 text-[#b99881]" />
          <h2 className="text-2xl font-bold text-white tracking-wide">
            Marka Rehberi
          </h2>
        </div>
        <p className="text-xs text-[#a69f99] mt-1">
          Demirtürk İnşaat renk paleti, tipografi kuralları, kurumsal logo ve sosyal medya/Meta reklam güvenli alan ölçüleri.
        </p>
      </div>

      {/* ÜST SATIR: Sol %68 Kurumsal Renk Paleti (Bitişik) + Sağ %32 Tipografi */}
      <div className="grid grid-cols-1 xl:grid-cols-[68fr_32fr] gap-4 items-stretch">
        {/* 1. Sol Geniş: Kurumsal Renk Paleti */}
        <GlassCard className="p-5 bg-[#282522] border-[#4a443f] flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-white">Kurumsal Renk Paleti</h2>
              <p className="text-xs text-[#a69f99]">
                HEX kodunu kopyalamak için ilgili renk sütununa tıklayın
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggleEdit('colors')}
              title={editingSection === 'colors' ? 'Düzenlemeyi Tamamla' : 'Renk Paletini Düzenle'}
              className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shrink-0 ${
                editingSection === 'colors'
                  ? 'border-[#b99881] bg-[#b99881]/15 text-[#b99881]'
                  : 'border-[#4a443f] bg-[#34302d]/70 hover:border-[#b99881]/50 text-[#a69f99] hover:text-white'
              }`}
            >
              {editingSection === 'colors' ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Pencil className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {editingSection === 'colors' ? (
            <div className="space-y-2.5 flex-1">
              {data.colors.map((color, idx) => (
                <div
                  key={color.id}
                  className="grid grid-cols-1 sm:grid-cols-[44px_1.1fr_110px_1.6fr_36px] gap-2 items-center p-2.5 rounded-2xl bg-[#34302d]"
                >
                  <input
                    type="color"
                    value={color.hex.startsWith('#') && color.hex.length === 7 ? color.hex : '#5c6ac4'}
                    onChange={(e) => {
                      const nextHex = e.target.value.toUpperCase()
                      const nextColors = [...data.colors]
                      nextColors[idx] = {
                        ...color,
                        hex: nextHex,
                        rgb: hexToRgbString(nextHex),
                      }
                      saveAll({ ...data, colors: nextColors })
                    }}
                    className="w-9 h-9 rounded-xl cursor-pointer border-0 bg-transparent p-0"
                  />
                  <input
                    type="text"
                    value={color.name}
                    onChange={(e) => {
                      const nextColors = [...data.colors]
                      nextColors[idx] = { ...color, name: e.target.value }
                      saveAll({ ...data, colors: nextColors })
                    }}
                    placeholder="Renk adı"
                    className="bg-[#282522] border border-[#4a443f] rounded-full px-3 py-1.5 text-xs text-white focus:outline-none"
                  />
                  <input
                    type="text"
                    value={color.hex}
                    onChange={(e) => {
                      const nextHex = e.target.value.toUpperCase()
                      const nextColors = [...data.colors]
                      nextColors[idx] = {
                        ...color,
                        hex: nextHex,
                        rgb: hexToRgbString(nextHex),
                      }
                      saveAll({ ...data, colors: nextColors })
                    }}
                    placeholder="#0F172A"
                    className="bg-[#282522] border border-[#4a443f] rounded-full px-3 py-1.5 text-xs font-mono text-white focus:outline-none"
                  />
                  <input
                    type="text"
                    value={color.usage}
                    onChange={(e) => {
                      const nextColors = [...data.colors]
                      nextColors[idx] = { ...color, usage: e.target.value }
                      saveAll({ ...data, colors: nextColors })
                    }}
                    placeholder="Kullanım alanı"
                    className="bg-[#282522] border border-[#4a443f] rounded-full px-3 py-1.5 text-xs text-white focus:outline-none"
                  />
                  {data.colors.length > 2 && (
                    <button
                      type="button"
                      onClick={() => {
                        const nextColors = data.colors.filter((_, i) => i !== idx)
                        saveAll({ ...data, colors: nextColors })
                      }}
                      title="Rengi Kaldır"
                      className="w-8 h-8 rounded-full flex items-center justify-center text-rose-400 hover:bg-rose-500/15 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {data.colors.length < 7 && (
                <button
                  type="button"
                  onClick={() => {
                    const nextColors = [
                      ...data.colors,
                      {
                        id: `c-${Date.now()}`,
                        name: 'Yeni Kurumsal Ton',
                        hex: '#657A72',
                        rgb: '101, 122, 114',
                        usage: 'Yardımcı kurumsal vurgu ve grafik alanı',
                      },
                    ]
                    saveAll({ ...data, colors: nextColors })
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#34302d] border border-[#4a443f] text-xs font-semibold text-white cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Renk Sütunu Ekle</span>
                </button>
              )}
            </div>
          ) : (
            <div
              style={{
                gridTemplateColumns: `repeat(${data.colors.length}, minmax(0, 1fr))`,
              }}
              className="grid grid-cols-1 sm:grid-flow-col gap-0 rounded-[20px] overflow-hidden border border-black/10 flex-1 min-h-[290px]"
            >
              {data.colors.map((color) => {
                const isLight = isLightBackgroundHex(color.hex)
                const fgMain = isLight ? '#0F172A' : '#FFFFFF'
                const fgSub = isLight ? 'rgba(15, 23, 42, 0.82)' : 'rgba(255, 255, 255, 0.88)'
                const fgMuted = isLight ? 'rgba(15, 23, 42, 0.68)' : 'rgba(255, 255, 255, 0.75)'
                const pillBg = isLight ? 'rgba(15, 23, 42, 0.10)' : 'rgba(0, 0, 0, 0.28)'

                return (
                  <div
                    key={color.id}
                    data-auto-contrast={isLight ? 'light' : 'dark'}
                    onClick={() => handleCopyHex(color.hex)}
                    style={{ backgroundColor: color.hex, color: fgMain }}
                    className="group relative flex flex-col justify-between p-4 sm:p-4 min-h-[220px] sm:min-h-[290px] cursor-pointer transition-all duration-200 hover:brightness-[1.03]"
                  >
                    {/* Üst: Kopyala / HEX Rozeti */}
                    <div className="flex items-center justify-end">
                      <span
                        style={{ backgroundColor: pillBg, color: fgMain }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-md text-[11px] font-bold tracking-wide transition-transform group-hover:scale-105"
                      >
                        {copiedHex === color.hex ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            Kopyalandı
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 opacity-80" />
                            {color.hex}
                          </>
                        )}
                      </span>
                    </div>

                    {/* Alt: Renk Adı, RGB ve Kullanım Bilgisi doğrudan rengin içinde */}
                    <div className="space-y-1.5 pt-8">
                      <h3
                        style={{ color: fgMain }}
                        className="text-sm font-bold leading-snug"
                      >
                        {color.name}
                      </h3>
                      <p
                        style={{ color: fgMuted }}
                        className="text-[11px] font-mono font-semibold"
                      >
                        HEX: {color.hex} • RGB: {color.rgb}
                      </p>
                      <p
                        style={{ color: fgSub }}
                        className="text-xs leading-snug pt-0.5"
                      >
                        {color.usage}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </GlassCard>

        {/* 2. Sağ Dar: Kurumsal Tipografi */}
        <GlassCard className="p-5 bg-[#282522] border-[#4a443f] flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Type className="w-4 h-4 text-[#b99881]" />
              <h2 className="text-sm font-bold text-white">Tipografi</h2>
            </div>
            <button
              type="button"
              onClick={() => toggleEdit('typography')}
              title={editingSection === 'typography' ? 'Düzenlemeyi Tamamla' : 'Tipografiyi Düzenle'}
              className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shrink-0 ${
                editingSection === 'typography'
                  ? 'border-[#b99881] bg-[#b99881]/15 text-[#b99881]'
                  : 'border-[#4a443f] bg-[#34302d]/70 hover:border-[#b99881]/50 text-[#a69f99] hover:text-white'
              }`}
            >
              {editingSection === 'typography' ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Pencil className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {editingSection === 'typography' ? (
            <div className="space-y-2.5 flex-1">
              <div className="rounded-2xl bg-[#34302d] p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={data.typography.headingFont}
                    onChange={(e) =>
                      saveAll({
                        ...data,
                        typography: { ...data.typography, headingFont: e.target.value },
                      })
                    }
                    placeholder="Başlık fontu"
                    className="bg-[#282522] border border-[#4a443f] rounded-full px-3 py-1 text-xs text-white focus:outline-none"
                  />
                  <input
                    type="text"
                    value={data.typography.headingStyle}
                    onChange={(e) =>
                      saveAll({
                        ...data,
                        typography: { ...data.typography, headingStyle: e.target.value },
                      })
                    }
                    placeholder="Serif / Display"
                    className="bg-[#282522] border border-[#4a443f] rounded-full px-3 py-1 text-xs text-white focus:outline-none"
                  />
                </div>
                <input
                  type="text"
                  value={data.typography.headingDesc}
                  onChange={(e) =>
                    saveAll({
                      ...data,
                      typography: { ...data.typography, headingDesc: e.target.value },
                    })
                  }
                  className="w-full bg-[#282522] border border-[#4a443f] rounded-full px-3 py-1 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="rounded-2xl bg-[#34302d] p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={data.typography.bodyFont}
                    onChange={(e) =>
                      saveAll({
                        ...data,
                        typography: { ...data.typography, bodyFont: e.target.value },
                      })
                    }
                    placeholder="Gövde fontu"
                    className="bg-[#282522] border border-[#4a443f] rounded-full px-3 py-1 text-xs text-white focus:outline-none"
                  />
                  <input
                    type="text"
                    value={data.typography.bodyStyle}
                    onChange={(e) =>
                      saveAll({
                        ...data,
                        typography: { ...data.typography, bodyStyle: e.target.value },
                      })
                    }
                    placeholder="Sans-Serif"
                    className="bg-[#282522] border border-[#4a443f] rounded-full px-3 py-1 text-xs text-white focus:outline-none"
                  />
                </div>
                <input
                  type="text"
                  value={data.typography.bodyDesc}
                  onChange={(e) =>
                    saveAll({
                      ...data,
                      typography: { ...data.typography, bodyDesc: e.target.value },
                    })
                  }
                  className="w-full bg-[#282522] border border-[#4a443f] rounded-full px-3 py-1 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="rounded-2xl bg-[#34302d] p-3 space-y-1.5">
                <input
                  type="text"
                  value={data.typography.footerText}
                  onChange={(e) =>
                    saveAll({
                      ...data,
                      typography: { ...data.typography, footerText: e.target.value },
                    })
                  }
                  className="w-full bg-[#282522] border border-[#4a443f] rounded-full px-3 py-1 text-xs text-white focus:outline-none"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3 flex-1 flex flex-col justify-between">
              <div className="rounded-2xl bg-[#34302d] p-3.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-[#b99881] uppercase tracking-wider">
                    {data.typography.headingLabel}
                  </span>
                  <span className="text-[11px] font-semibold text-[#a69f99]">
                    {data.typography.headingStyle}
                  </span>
                </div>
                <div
                  style={{ fontFamily: "'The Seasons', 'Playfair Display', Georgia, serif" }}
                  className="text-xl font-bold text-white tracking-tight leading-tight pt-0.5"
                >
                  {data.typography.headingFont}
                </div>
                <p className="text-[11px] text-[#a69f99] leading-snug">
                  {data.typography.headingDesc}
                </p>
              </div>

              <div className="rounded-2xl bg-[#34302d] p-3.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-[#b99881] uppercase tracking-wider">
                    {data.typography.bodyLabel}
                  </span>
                  <span className="text-[11px] font-semibold text-[#a69f99]">
                    {data.typography.bodyStyle}
                  </span>
                </div>
                <div
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  className="text-lg font-bold text-white tracking-tight leading-tight pt-0.5"
                >
                  {data.typography.bodyFont}
                </div>
                <p className="text-[11px] text-[#a69f99] leading-snug">
                  {data.typography.bodyDesc}
                </p>
              </div>

              <div className="rounded-2xl bg-[#34302d] p-3 space-y-1">
                <span className="text-[11px] font-bold text-[#b99881] block">
                  {data.typography.footerTitle}
                </span>
                <p className="text-[11px] text-white leading-snug">
                  {data.typography.footerText}
                </p>
              </div>
            </div>
          )}
        </GlassCard>
      </div>

      {/* ALT SATIR (Üstteki düzenin ters simetriği): Sol %32 Kurumsal Logo + Sağ %68 Sosyal Medya & Meta Reklam Ölçü Standartları */}
      <div className="grid grid-cols-1 xl:grid-cols-[32fr_68fr] gap-4 items-stretch">
        {/* 3. Sol: Kurumsal Logo */}
        <GlassCard className="p-5 bg-[#282522] border-[#4a443f] flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-[#b99881]" />
              <h2 className="text-sm font-bold text-white">Logo</h2>
            </div>
            <button
              type="button"
              onClick={() => toggleEdit('logo')}
              title={editingSection === 'logo' ? 'Düzenlemeyi Tamamla' : 'Logoyu Düzenle'}
              className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shrink-0 ${
                editingSection === 'logo'
                  ? 'border-[#b99881] bg-[#b99881]/15 text-[#b99881]'
                  : 'border-[#4a443f] bg-[#34302d]/70 hover:border-[#b99881]/50 text-[#a69f99] hover:text-white'
              }`}
            >
              {editingSection === 'logo' ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Pencil className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          <input
            ref={darkLogoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleLogoUpload('darkLogoUrl', e)}
          />
          <input
            ref={lightLogoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleLogoUpload('lightLogoUrl', e)}
          />

          <div className="space-y-3 flex-1 flex flex-col justify-between">
            {/* Koyu ve Açık Zemin Logo Önizleme Kutuları */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* Koyu Zemin Logosu */}
              <div
                data-auto-contrast="dark"
                style={{ backgroundColor: '#0F172A', color: '#FFFFFF' }}
                className="relative rounded-2xl p-4 flex flex-col items-center justify-center min-h-[118px] border border-black/15 overflow-hidden group"
              >
                <span
                  style={{ color: 'rgba(255,255,255,0.65)' }}
                  className="absolute top-2 left-2.5 text-[9.5px] font-bold uppercase tracking-wider"
                >
                  Koyu Zemin
                </span>
                {data.logo.darkLogoUrl ? (
                  <img
                    src={data.logo.darkLogoUrl}
                    alt="Koyu Zemin Logo"
                    className="max-h-12 max-w-full object-contain mt-2"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1.5 mt-2">
                    <BookLogo size={30} isOpen />
                    <div className="text-center leading-none">
                      <div className="font-the-seasons text-xs font-bold tracking-widest text-white">
                        {data.logo.brandTitle}
                      </div>
                      <div className="text-[8.5px] tracking-[0.18em] opacity-75 mt-0.5 text-white">
                        {data.logo.brandSubtitle}
                      </div>
                    </div>
                  </div>
                )}

                {editingSection === 'logo' && (
                  <button
                    type="button"
                    onClick={() => darkLogoInputRef.current?.click()}
                    className="mt-2 px-2.5 py-1 rounded-full bg-white/15 hover:bg-white/25 text-[10px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Upload className="w-3 h-3" />
                    <span>Yükle</span>
                  </button>
                )}
              </div>

              {/* Açık Zemin Logosu */}
              <div
                data-auto-contrast="light"
                style={{ backgroundColor: '#F8FAFC', color: '#0F172A' }}
                className="relative rounded-2xl p-4 flex flex-col items-center justify-center min-h-[118px] border border-black/10 overflow-hidden group"
              >
                <span
                  style={{ color: 'rgba(15,23,42,0.62)' }}
                  className="absolute top-2 left-2.5 text-[9.5px] font-bold uppercase tracking-wider"
                >
                  Açık Zemin
                </span>
                {data.logo.lightLogoUrl ? (
                  <img
                    src={data.logo.lightLogoUrl}
                    alt="Açık Zemin Logo"
                    className="max-h-12 max-w-full object-contain mt-2"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1.5 mt-2">
                    <BookLogo size={30} isOpen />
                    <div className="text-center leading-none">
                      <div className="font-the-seasons text-xs font-bold tracking-widest">
                        {data.logo.brandTitle}
                      </div>
                      <div className="text-[8.5px] tracking-[0.18em] opacity-75 mt-0.5">
                        {data.logo.brandSubtitle}
                      </div>
                    </div>
                  </div>
                )}

                {editingSection === 'logo' && (
                  <button
                    type="button"
                    onClick={() => lightLogoInputRef.current?.click()}
                    className="mt-2 px-2.5 py-1 rounded-full bg-black/10 hover:bg-black/15 text-[10px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Upload className="w-3 h-3" />
                    <span>Yükle</span>
                  </button>
                )}
              </div>
            </div>

            {editingSection === 'logo' ? (
              <div className="rounded-2xl bg-[#34302d] p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={data.logo.brandTitle}
                    onChange={(e) =>
                      saveAll({
                        ...data,
                        logo: { ...data.logo, brandTitle: e.target.value },
                      })
                    }
                    placeholder="Marka Başlığı"
                    className="bg-[#282522] border border-[#4a443f] rounded-full px-3 py-1 text-xs text-white focus:outline-none"
                  />
                  <input
                    type="text"
                    value={data.logo.brandSubtitle}
                    onChange={(e) =>
                      saveAll({
                        ...data,
                        logo: { ...data.logo, brandSubtitle: e.target.value },
                      })
                    }
                    placeholder="Alt Başlık"
                    className="bg-[#282522] border border-[#4a443f] rounded-full px-3 py-1 text-xs text-white focus:outline-none"
                  />
                </div>
                <input
                  type="text"
                  value={data.logo.clearSpaceRule}
                  onChange={(e) =>
                    saveAll({
                      ...data,
                      logo: { ...data.logo, clearSpaceRule: e.target.value },
                    })
                  }
                  placeholder="Güvenli alan kuralı"
                  className="w-full bg-[#282522] border border-[#4a443f] rounded-full px-3 py-1 text-xs text-white focus:outline-none"
                />
              </div>
            ) : (
              <div className="rounded-2xl bg-[#34302d] p-3.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-[#b99881] uppercase tracking-wider">
                    Güvenli Alan & Kullanım
                  </span>
                  <span className="text-[10.5px] font-semibold text-[#a69f99]">
                    {data.logo.formatsNote}
                  </span>
                </div>
                <p className="text-[11px] text-[#a69f99] leading-snug">
                  {data.logo.clearSpaceRule}
                </p>
              </div>
            )}
          </div>
        </GlassCard>

        {/* 4. Sağ Geniş: Sosyal Medya & Meta Reklam Ölçü Standartları */}
        <GlassCard className="p-5 bg-[#282522] border-[#4a443f] flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#b99881]" />
              <h2 className="text-sm font-bold text-white">
                Sosyal Medya & Meta Reklam Ölçü Standartları
              </h2>
            </div>
            <button
              type="button"
              onClick={() => toggleEdit('formats')}
              title={editingSection === 'formats' ? 'Düzenlemeyi Tamamla' : 'Ölçü Standartlarını Düzenle'}
              className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shrink-0 ${
                editingSection === 'formats'
                  ? 'border-[#b99881] bg-[#b99881]/15 text-[#b99881]'
                  : 'border-[#4a443f] bg-[#34302d]/70 hover:border-[#b99881]/50 text-[#a69f99] hover:text-white'
              }`}
            >
              {editingSection === 'formats' ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Pencil className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 flex-1">
            {data.formats.map((spec, idx) => {
              const Icon = getFormatIcon(spec.iconKey)
              return (
                <div
                  key={spec.id}
                  className="rounded-2xl bg-[#34302d] p-3.5 flex items-start gap-3"
                >
                  <div className="w-9 h-9 rounded-2xl bg-[#282522] border border-[#4a443f] flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-[#b99881]" />
                  </div>
                  {editingSection === 'formats' ? (
                    <div className="flex-1 space-y-2">
                      <input
                        type="text"
                        value={spec.title}
                        onChange={(e) => {
                          const nextFormats = [...data.formats]
                          nextFormats[idx] = { ...spec, title: e.target.value }
                          saveAll({ ...data, formats: nextFormats })
                        }}
                        className="w-full bg-[#282522] border border-[#4a443f] rounded-full px-3 py-1 text-xs font-bold text-white focus:outline-none"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={spec.ratio}
                          onChange={(e) => {
                            const nextFormats = [...data.formats]
                            nextFormats[idx] = { ...spec, ratio: e.target.value }
                            saveAll({ ...data, formats: nextFormats })
                          }}
                          placeholder="Oran (4:5)"
                          className="bg-[#282522] border border-[#4a443f] rounded-full px-3 py-1 text-[11px] text-white focus:outline-none"
                        />
                        <input
                          type="text"
                          value={spec.resolution}
                          onChange={(e) => {
                            const nextFormats = [...data.formats]
                            nextFormats[idx] = { ...spec, resolution: e.target.value }
                            saveAll({ ...data, formats: nextFormats })
                          }}
                          placeholder="Çözünürlük"
                          className="bg-[#282522] border border-[#4a443f] rounded-full px-3 py-1 text-[11px] text-white focus:outline-none"
                        />
                      </div>
                      <input
                        type="text"
                        value={spec.safeZone}
                        onChange={(e) => {
                          const nextFormats = [...data.formats]
                          nextFormats[idx] = { ...spec, safeZone: e.target.value }
                          saveAll({ ...data, formats: nextFormats })
                        }}
                        className="w-full bg-[#282522] border border-[#4a443f] rounded-full px-3 py-1 text-[11px] text-white focus:outline-none"
                      />
                    </div>
                  ) : (
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h3 className="text-xs font-bold text-white">{spec.title}</h3>
                        <span className="px-2.5 py-0.5 rounded-full bg-[#282522] text-[10px] font-bold text-[#d6beae]">
                          {spec.ratio} • {spec.resolution}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#a69f99] leading-snug">{spec.safeZone}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </GlassCard>
      </div>
    </div>
  )
}
