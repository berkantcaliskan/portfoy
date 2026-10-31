import React, { useState } from 'react'
import {
  Sparkles,
  Copy,
  Check,
  Type,
  Layers,
  Monitor,
  Smartphone,
  ShieldCheck,
} from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'

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

const BRAND_COLORS = [
  {
    name: 'Demirtürk Kurumsal Lacivert',
    hex: '#0F172A',
    rgb: '15, 23, 42',
    usage: 'Ana zemin, kurumsal antet ve katalog arka planları',
  },
  {
    name: 'Demirtürk Prestij Altın',
    hex: '#D4AF37',
    rgb: '212, 175, 55',
    usage: 'Ödeme kampanyası vurguları, rozetler ve CTA butonları',
  },
  {
    name: 'Portföy İndigo Aksan',
    hex: '#6366F1',
    rgb: '99, 102, 241',
    usage: 'Dijital reklam çerçeveleri ve modern proje vurguları',
  },
  {
    name: 'Karasu Sahil Turkuazı',
    hex: '#0EA5E9',
    rgb: '14, 165, 233',
    usage: 'Havuz, deniz mesafesi ve yaz lansmanı kreatifleri',
  },
  {
    name: 'Mimari Kırık Beyaz',
    hex: '#F8FAFC',
    rgb: '248, 250, 252',
    usage: 'Ana tipografi, okunabilir başlıklar ve açık tema kataloglar',
  },
]

const FORMAT_SPECS = [
  {
    title: 'Instagram Reels / Story & Meta Dikey Video',
    ratio: '9:16',
    resolution: '1080 × 1920 px',
    safeZone: 'Üstten 250px, alttan 420px metin güvenli alanı bırakılmalı',
    icon: Smartphone,
  },
  {
    title: 'Instagram & Meta Ads Dikey Post / Karusel',
    ratio: '4:5',
    resolution: '1080 × 1350 px',
    safeZone: 'Akışta en yüksek ekran kaplama oranı sağlayan ana reklam formatı',
    icon: Layers,
  },
  {
    title: 'Kare Kurumsal & Özel Gün Postu',
    ratio: '1:1',
    resolution: '1080 × 1080 px',
    safeZone: 'Köşelerden 90px iç boşluk (margin) ve sağ altta kurumsal logo',
    icon: ShieldCheck,
  },
  {
    title: 'Web Hero, YouTube & 3D Render Sunum',
    ratio: '16:9',
    resolution: '3840 × 2160 px (4K)',
    safeZone: 'demirturkinsaat.com proje sayfası ve TV sunum ekranları için',
    icon: Monitor,
  },
]

export function BrandKitView() {
  const [copiedHex, setCopiedHex] = useState<string | null>(null)

  const handleCopyHex = (hex: string) => {
    navigator.clipboard?.writeText(hex)
    setCopiedHex(hex)
    setTimeout(() => setCopiedHex(null), 1800)
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
          Demirtürk İnşaat renk paleti, tipografi kuralları ve sosyal medya/Meta reklam güvenli alan ölçüleri.
        </p>
      </div>

      {/* Üst Satır: Sol %68 Kurumsal Renk Paleti (Bitişik) + Sağ %32 Kurumsal Tipografi */}
      <div className="grid grid-cols-1 xl:grid-cols-[68fr_32fr] gap-4 items-stretch">
        {/* Sol: Kurumsal Renk Paleti */}
        <GlassCard className="p-5 bg-[#282522] border-[#4a443f] flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">Kurumsal Renk Paleti</h2>
              <p className="text-xs text-[#a69f99]">
                HEX kodunu kopyalamak için ilgili renk sütununa tıklayın
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-0 rounded-[20px] overflow-hidden border border-black/10 shadow-sm flex-1 min-h-[290px]">
            {BRAND_COLORS.map((color) => {
              const isLight = isLightBackgroundHex(color.hex)
              const fgMain = isLight ? '#0F172A' : '#FFFFFF'
              const fgSub = isLight ? 'rgba(15, 23, 42, 0.82)' : 'rgba(255, 255, 255, 0.88)'
              const fgMuted = isLight ? 'rgba(15, 23, 42, 0.68)' : 'rgba(255, 255, 255, 0.75)'
              const pillBg = isLight ? 'rgba(15, 23, 42, 0.10)' : 'rgba(0, 0, 0, 0.28)'

              return (
                <div
                  key={color.hex}
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
        </GlassCard>

        {/* Sağ: Kurumsal Tipografi */}
        <GlassCard className="p-5 bg-[#282522] border-[#4a443f] flex flex-col justify-between space-y-4">
          <div className="flex items-center gap-2">
            <Type className="w-4 h-4 text-[#b99881]" />
            <h2 className="text-sm font-bold text-white">
              Tipografi
            </h2>
          </div>

          <div className="space-y-3 flex-1 flex flex-col justify-between">
            <div className="rounded-2xl bg-[#34302d] p-3.5 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-[#b99881] uppercase tracking-wider">
                  Başlıklar
                </span>
                <span className="text-[11px] font-semibold text-[#a69f99]">
                  Serif / Display
                </span>
              </div>
              <div
                style={{ fontFamily: "'The Seasons', 'Playfair Display', Georgia, serif" }}
                className="text-xl font-bold text-white tracking-tight leading-tight pt-0.5"
              >
                The Seasons
              </div>
              <p className="text-[11px] text-[#a69f99] leading-snug">
                Ana başlıklar, proje lansman kapakları ve prestij vurguları.
              </p>
            </div>

            <div className="rounded-2xl bg-[#34302d] p-3.5 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-[#b99881] uppercase tracking-wider">
                  Gövde Metni
                </span>
                <span className="text-[11px] font-semibold text-[#a69f99]">
                  Sans-Serif
                </span>
              </div>
              <div
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                className="text-lg font-bold text-white tracking-tight leading-tight pt-0.5"
              >
                Plus Jakarta Sans
              </div>
              <p className="text-[11px] text-[#a69f99] leading-snug">
                Açıklama metinleri, katalog içerikleri, alt başlıklar ve arayüz yazıları.
              </p>
            </div>

            <div className="rounded-2xl bg-[#34302d] p-3 space-y-1">
              <span className="text-[11px] font-bold text-[#b99881] block">
                Kurumsal Alt Bilgi (Footer)
              </span>
              <p className="text-[11px] text-white leading-snug">
                demirturkinsaat.com • Kurumsal İletişim Hattı • Demirtürk İnşaat Logosu
              </p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Sosyal Medya & Meta Reklam Ölçü Standartları */}
      <GlassCard className="p-5 bg-[#282522] border-[#4a443f] space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#b99881]" />
          <h2 className="text-sm font-bold text-white">
            Sosyal Medya & Meta Reklam Ölçü Standartları
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {FORMAT_SPECS.map((spec) => {
            const Icon = spec.icon
            return (
              <div
                key={spec.title}
                className="rounded-2xl bg-[#34302d] p-3.5 flex items-start gap-3"
              >
                <div className="w-9 h-9 rounded-2xl bg-[#282522] border border-[#4a443f] flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-[#b99881]" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="text-xs font-bold text-white">{spec.title}</h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#282522] text-[10px] font-bold text-[#d6beae]">
                      {spec.ratio} • {spec.resolution}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#a69f99] leading-snug">{spec.safeZone}</p>
                </div>
              </div>
            )
          })}
        </div>
      </GlassCard>
    </div>
  )
}
