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

const BRAND_COLORS = [
  {
    name: 'Demirtürk Kurumsal Lacivert',
    hex: '#0F172A',
    rgb: '15, 23, 42',
    usage: 'Ana zemin, kurumsal antet ve katalog arka planları',
    previewClass: 'bg-[#0F172A]',
  },
  {
    name: 'Demirtürk Prestij Altın',
    hex: '#D4AF37',
    rgb: '212, 175, 55',
    usage: 'Ödeme kampanyası vurguları, rozetler ve CTA butonları',
    previewClass: 'bg-[#D4AF37]',
  },
  {
    name: 'Portföy İndigo Aksan',
    hex: '#6366F1',
    rgb: '99, 102, 241',
    usage: 'Dijital reklam çerçeveleri ve modern proje vurguları',
    previewClass: 'bg-[#6366F1]',
  },
  {
    name: 'Karasu Sahil Turkuazı',
    hex: '#0EA5E9',
    rgb: '14, 165, 233',
    usage: 'Havuz, deniz mesafesi ve yaz lansmanı kreatifleri',
    previewClass: 'bg-[#0EA5E9]',
  },
  {
    name: 'Mimari Kırık Beyaz',
    hex: '#F8FAFC',
    rgb: '248, 250, 252',
    usage: 'Ana tipografi, okunabilir başlıklar ve açık tema kataloglar',
    previewClass: 'bg-[#F8FAFC]',
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
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Marka Rehberi & Kurumsal Materyal Standartları
          </h1>
          <p className="text-xs text-slate-400">
            Demirtürk İnşaat renk paleti, tipografi kuralları ve sosyal medya/Meta reklam güvenli alan ölçüleri
          </p>
        </div>
      </div>

      {/* Color Palette */}
      <div className="rounded-2xl bg-[#111520]/90 border border-white/[0.07] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white">Kurumsal Renk Paleti</h2>
            <p className="text-xs text-slate-400">
              HEX kodunu kopyalamak için renk kartına tıklayın
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {BRAND_COLORS.map((color) => (
            <div
              key={color.hex}
              onClick={() => handleCopyHex(color.hex)}
              className="group rounded-2xl bg-black/30 border border-white/[0.07] hover:border-white/20 overflow-hidden cursor-pointer transition-all"
            >
              <div className={`h-24 ${color.previewClass} relative flex items-end justify-end p-2.5 border-b border-white/10`}>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-black/65 backdrop-blur-md text-[10px] font-bold text-white">
                  {copiedHex === color.hex ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      Kopyalandı
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-slate-300" />
                      {color.hex}
                    </>
                  )}
                </span>
              </div>
              <div className="p-3 space-y-1">
                <h3 className="text-xs font-bold text-white">{color.name}</h3>
                <p className="text-[10px] text-slate-500">RGB: {color.rgb}</p>
                <p className="text-[11px] text-slate-400 leading-snug pt-1">{color.usage}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Typography & Safe Zones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Typography */}
        <div className="rounded-2xl bg-[#111520]/90 border border-white/[0.07] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Type className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-white">Kurumsal Tipografi & Metin Hiyerarşisi</h2>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl bg-black/30 p-3.5 border border-white/[0.06]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-amber-400">Ana Başlık Fontu (Display / Headline)</span>
                <span className="text-[11px] text-slate-400">Montserrat / Plus Jakarta Sans Bold</span>
              </div>
              <p className="text-lg font-extrabold text-white tracking-tight">
                KARASU’DA YENİ NESİL YATIRIM
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Büyük harf, sıkı satır aralığı (-2% tracking), yüksek kontrast.
              </p>
            </div>

            <div className="rounded-xl bg-black/30 p-3.5 border border-white/[0.06]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-sky-400">Gövde & Katalog Metni</span>
                <span className="text-[11px] text-slate-400">Inter Medium / Regular</span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">
                %30 peşinat ve 36 ay Demirtürk İnşaat güvencesiyle elden senet imkanı tüm projelerimizde geçerlidir.
              </p>
            </div>

            <div className="rounded-xl bg-black/30 p-3.5 border border-white/[0.06]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-emerald-400">Zorunlu Kurumsal Alt Bilgi (Footer)</span>
                <span className="text-[11px] text-slate-400">Tüm Reklam Kreatifleri</span>
              </div>
              <p className="text-xs text-slate-300">
                demirturkinsaat.com • 444 / Kurumsal İletişim Hattı • Demirtürk İnşaat Logosu
              </p>
            </div>
          </div>
        </div>

        {/* Social & Ad Format Dimensions */}
        <div className="rounded-2xl bg-[#111520]/90 border border-white/[0.07] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-fuchsia-400" />
            <h2 className="text-sm font-bold text-white">Sosyal Medya & Meta Reklam Ölçü Standartları</h2>
          </div>

          <div className="space-y-2.5">
            {FORMAT_SPECS.map((spec) => {
              const Icon = spec.icon
              return (
                <div
                  key={spec.title}
                  className="rounded-xl bg-black/30 p-3.5 border border-white/[0.06] flex items-start gap-3"
                >
                  <div className="w-9 h-9 rounded-xl bg-fuchsia-500/15 border border-fuchsia-500/25 flex items-center justify-center text-fuchsia-400 shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs font-bold text-white">{spec.title}</h3>
                      <span className="px-2 py-0.5 rounded bg-white/10 text-[10px] font-bold text-amber-300">
                        {spec.ratio} • {spec.resolution}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">{spec.safeZone}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
