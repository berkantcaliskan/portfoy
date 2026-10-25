import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  Target,
  Clock,
  Home,
  CheckCircle2,
  AlertCircle,
  Share2,
  PhoneCall,
  TrendingUp,
  TurkishLira,
  Briefcase,
  FileCheck2,
  CalendarCheck,
  Building2,
  ArrowRight,
  ShieldCheck,
  BarChart3,
  Filter,
  Inbox,
  Megaphone,
  Layers,
} from 'lucide-react'
import { Lead, STAGE_CONFIGS } from '@/types/lead'
import { PortfolioItem } from '@/types/portfolio'
import { AppUser } from '@/services/userStore'
import { Department } from '@/types/department'
import { formatCurrency, formatDate } from '@/utils/formatters'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlassBadge } from '@/components/ui/GlassBadge'
import { appointmentStore } from '@/services/appointmentStore'
import { accountingStore } from '@/services/accountingStore'
import { projectStore } from '@/services/projectStore'
import { approvalStore } from '@/services/approvalStore'
import { requestStore } from '@/services/requestStore'
import { metaStore } from '@/services/metaStore'

interface DashboardViewProps {
  leads: Lead[]
  properties: PortfolioItem[]
  onSelectLead: (lead: Lead) => void
  onNavigateToTab?: (tab: any) => void
  currentUser?: AppUser | null
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  leads,
  properties: _properties,
  onSelectLead,
  onNavigateToTab,
  currentUser,
}) => {
  const department: Department = currentUser?.department || 'Pazarlama'

  // Sub-store states for department-specific widgets
  const appointments = appointmentStore.getAll(currentUser)
  const collections = accountingStore.getCollections()
  const payments = accountingStore.getPayments()
  const projects = projectStore.getAll()
  const approvals = approvalStore.getAll()
  const requests = requestStore.getAll()
  const metaForms = metaStore.getForms()

  // Focal chart & filter states
  const [chartRange, setChartRange] = useState<'7d' | '30d' | 'month'>('7d')
  const [leadFilter, setLeadFilter] = useState<'ALL' | 'NEW' | 'QUALIFIED'>('ALL')

  // Live computer time and interactive seconds state
  const [currentTime, setCurrentTime] = useState<Date>(() => new Date())
  const [showSeconds, setShowSeconds] = useState<boolean>(false)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Saate tıklandığında açılan saniye görünümünün 4-5 saniye sonra kendi kendine kapanması
  useEffect(() => {
    if (!showSeconds) return
    const autoCloseTimer = setTimeout(() => {
      setShowSeconds(false)
    }, 4500)
    return () => clearTimeout(autoCloseTimer)
  }, [showSeconds])

  const hours = String(currentTime.getHours()).padStart(2, '0')
  const minutes = String(currentTime.getMinutes()).padStart(2, '0')
  const seconds = String(currentTime.getSeconds()).padStart(2, '0')
  const formattedDate = currentTime.toLocaleDateString('tr-TR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // Son 7 günün tarih etiketleri ve aday sayıları (Odak Noktası Analitik Grafiği için)
  const last7DaysData = useMemo(() => {
    const days: { label: string; dateStr: string; total: number; qualified: number }[] = []
    const now = new Date()
    const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      const isoDay = d.toISOString().split('T')[0]
      const dayLeads = leads.filter((l) => (l.createdAt || '').startsWith(isoDay))
      const dayQualified = dayLeads.filter((l) => l.stage === 'QUALIFIED' || l.stage === 'WON')
      days.push({
        label: dayNames[d.getDay()],
        dateStr: `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`,
        total: dayLeads.length,
        qualified: dayQualified.length,
      })
    }
    return days
  }, [leads])

  // Sayfa Başlığı: 26 px, semibold (Tipografi Hiyerarşisi Standardı)
  const renderHeader = () => (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-2.5">
        <Home className="w-5 h-5 text-[#b99881]" strokeWidth={2.1} />
        <h1 className="text-[26px] font-semibold text-white tracking-tight leading-tight">
          Başlangıç
        </h1>
      </div>

      {/* Tarih ve Bilgisayar Saati */}
      <motion.div
        animate={{ x: showSeconds ? -10 : 0 }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        className="flex items-center gap-3 text-[12px] font-normal text-[#a69f99] select-none"
      >
        <span className="whitespace-nowrap hidden sm:inline">{formattedDate}</span>
        <button
          type="button"
          onClick={() => setShowSeconds((prev) => !prev)}
          title={showSeconds ? 'Saniyeyi gizlemek için tıklayın' : 'Saniyeyi görmek için tıklayın'}
          className="no-layer-btn group flex items-center gap-1.5 px-1 py-0.5 bg-transparent border-none text-[#d6beae] hover:text-white transition-all duration-200 cursor-pointer"
        >
          <Clock className="w-3.5 h-3.5 text-[#b99881] transition-colors" />
          <span className="font-mono tracking-tight text-[12px] font-semibold text-white">
            {hours}:{minutes}
          </span>
          <AnimatePresence>
            {showSeconds && (
              <motion.span
                key="seconds"
                initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                animate={{ opacity: 1, width: 'auto', marginLeft: 2 }}
                exit={{ opacity: 0, width: 0, marginLeft: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="font-mono text-[12px] font-semibold text-[#b99881] overflow-hidden whitespace-nowrap"
              >
                :{seconds}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </motion.div>
    </div>
  )

  // Ortak Odak Noktası Analitik Grafik Bileşeni (Sol Ana İçerik Alanı)
  const renderLeadFlowChart = () => {
    const maxVal = Math.max(4, ...last7DaysData.map((d) => d.total))
    const width = 620
    const height = 165
    const padX = 24
    const padY = 20
    const usableW = width - padX * 2
    const usableH = height - padY * 2

    const points = last7DaysData.map((d, idx) => {
      const x = padX + (idx / Math.max(1, last7DaysData.length - 1)) * usableW
      // Veri 0 olduğunda bile tabanda zarif ve okunabilir analitik iz çizgisi oluştur
      const normalized = d.total === 0 ? 0.06 : d.total / maxVal
      const y = padY + usableH - normalized * usableH
      return { x, y, ...d }
    })

    // Smooth cubic bezier SVG path
    const buildSmoothPath = (pts: { x: number; y: number }[]) => {
      if (pts.length === 0) return ''
      if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`
      let path = `M ${pts[0].x} ${pts[0].y}`
      for (let i = 0; i < pts.length - 1; i++) {
        const curr = pts[i]
        const next = pts[i + 1]
        const cpx1 = curr.x + (next.x - curr.x) * 0.45
        const cpy1 = curr.y
        const cpx2 = curr.x + (next.x - curr.x) * 0.55
        const cpy2 = next.y
        path += ` C ${cpx1} ${cpy1}, ${cpx2} ${cpy2}, ${next.x} ${next.y}`
      }
      return path
    }

    const linePath = buildSmoothPath(points)
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padY} L ${points[0].x} ${height - padY} Z`

    const totalPeriodLeads = last7DaysData.reduce((s, d) => s + d.total, 0)
    const qualifiedPeriodLeads = last7DaysData.reduce((s, d) => s + d.qualified, 0)
    const dailyAvg = (totalPeriodLeads / 7).toFixed(1)

    return (
      <GlassCard className="p-4 sm:p-5 bg-[#282522] border-[#4a443f]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#b99881]" />
              <h3 className="text-[14px] font-medium text-white">Aday Başvuru ve Etkileşim Akışı</h3>
            </div>
            <p className="text-[11.5px] font-normal text-[#a69f99] mt-0.5">
              Günlük gelen müşteri adayı hacmi ve nitelikli dönüşüm eğrisi
            </p>
          </div>

          {/* Dönem Seçici Filtre Sekmeleri (Pill Shape, Katmansız) */}
          <div className="inline-flex items-center gap-1.5 self-start sm:self-auto">
            {[
              { id: '7d' as const, label: 'Son 7 Gün' },
              { id: '30d' as const, label: 'Son 30 Gün' },
              { id: 'month' as const, label: 'Bu Ay' },
            ].map((tab) => {
              const active = chartRange === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setChartRange(tab.id)}
                  className={`px-3 py-1 rounded-full text-[11.5px] font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#b99881] text-[#282522] font-semibold'
                      : 'bg-[#34302d] text-[#a69f99] hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Grafik Üstü Mini Analitik Özet Şeridi */}
        <div className="grid grid-cols-3 gap-3 py-3">
          <div>
            <div className="text-[11.5px] font-normal text-[#a69f99]">Dönemlik Başvuru</div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-[22px] font-semibold font-mono text-white leading-none">
                {totalPeriodLeads}
              </span>
              <span className="text-[11px] font-normal text-[#a69f99]">kayıt</span>
            </div>
          </div>
          <div>
            <div className="text-[11.5px] font-normal text-[#a69f99]">Nitelikli Aday</div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-[22px] font-semibold font-mono text-white leading-none">
                {qualifiedPeriodLeads}
              </span>
              <span className="text-[11px] font-normal text-[#a69f99]">onaylı</span>
            </div>
          </div>
          <div>
            <div className="text-[11.5px] font-normal text-[#a69f99]">Günlük Ortalama</div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-[22px] font-semibold font-mono text-white leading-none">
                {dailyAvg}
              </span>
              <span className="text-[11px] font-normal text-[#a69f99]">aday/gün</span>
            </div>
          </div>
        </div>

        {/* SVG Eğrisel Grafik Alanı */}
        <div className="pt-2">
          <svg
            viewBox={`0 0 ${width} ${height + 18}`}
            className="w-full h-[165px] overflow-visible"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="leadFlowFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-color, #b99881)" stopOpacity="0.22" />
                <stop offset="100%" stopColor="var(--accent-color, #b99881)" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Yatay Kılavuz Çizgileri */}
            {[0, 0.33, 0.66, 1].map((ratio, idx) => {
              const y = padY + ratio * usableH
              const labelVal = Math.round(maxVal * (1 - ratio))
              return (
                <g key={idx}>
                  <line
                    x1={padX}
                    y1={y}
                    x2={width - padX}
                    y2={y}
                    stroke="currentColor"
                    strokeOpacity="0.1"
                    strokeDasharray={ratio < 1 ? '3 3' : undefined}
                  />
                  <text
                    x={4}
                    y={y + 3}
                    fontSize="10"
                    fill="currentColor"
                    opacity="0.5"
                    className="font-mono"
                  >
                    {labelVal}
                  </text>
                </g>
              )
            })}

            {/* Dolgu Alanı */}
            <path d={areaPath} fill="url(#leadFlowFill)" />

            {/* Ana Eğri Çizgisi */}
            <path
              d={linePath}
              fill="none"
              stroke="var(--accent-color, #b99881)"
              strokeWidth="2.2"
              strokeLinecap="round"
            />

            {/* Günlük Veri Noktaları ve Etiketleri */}
            {points.map((pt, i) => (
              <g key={i}>
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="3.5"
                  fill="var(--bg-base, #282522)"
                  stroke="var(--accent-color, #b99881)"
                  strokeWidth="2"
                />
                <text
                  x={pt.x}
                  y={height + 10}
                  textAnchor="middle"
                  fontSize="10.5"
                  fill="currentColor"
                  opacity="0.68"
                >
                  {pt.label} ({pt.dateStr})
                </text>
              </g>
            ))}
          </svg>
        </div>
      </GlassCard>
    )
  }

  // Sağ Sütun: Dönüşüm Hunisi (Sales Funnel — İlerleme Çubuklu Analitik Kart)
  const renderConversionFunnelCard = () => {
    const total = leads.length
    const contacted = leads.filter((l) => l.stage !== 'NEW').length
    const qualified = leads.filter((l) =>
      ['QUALIFIED', 'APPOINTMENT', 'PRESENTATION', 'OFFER', 'WON'].includes(l.stage)
    ).length
    const offerStage = leads.filter((l) =>
      ['PRESENTATION', 'OFFER', 'WON'].includes(l.stage)
    ).length
    const won = leads.filter((l) => l.stage === 'WON').length
    const convRate = total > 0 ? Math.round((won / total) * 100) : 0

    const stages = [
      { label: 'Toplam Başvuru', count: total, pct: total > 0 ? 100 : 0 },
      {
        label: 'İletişime Geçilen',
        count: contacted,
        pct: total > 0 ? Math.round((contacted / total) * 100) : 0,
      },
      {
        label: 'Nitelikli Aday',
        count: qualified,
        pct: total > 0 ? Math.round((qualified / total) * 100) : 0,
      },
      {
        label: 'Sunum & Teklif',
        count: offerStage,
        pct: total > 0 ? Math.round((offerStage / total) * 100) : 0,
      },
      {
        label: 'Kazanılan Satış',
        count: won,
        pct: total > 0 ? Math.round((won / total) * 100) : 0,
      },
    ]

    return (
      <GlassCard className="p-4 sm:p-5 bg-[#282522] border-[#4a443f]">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[14px] font-medium text-white">Dönüşüm Hunisi</h3>
          <span className="text-[11.5px] font-normal text-[#a69f99]">Aşama bazlı akış</span>
        </div>
        <p className="text-[11.5px] font-normal text-[#a69f99] mb-4">
          Adayların ilk başvurudan satışa ilerleme oranı
        </p>

        <div className="space-y-3.5">
          {stages.map((st, idx) => (
            <div key={idx} className="space-y-1.5">
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="font-medium text-white">{st.label}</span>
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="font-semibold text-white">{st.count}</span>
                  <span className="text-[11px] font-normal text-[#a69f99]">(%{st.pct})</span>
                </div>
              </div>
              <div className="w-full h-2 rounded-full bg-[#34302d] border border-[#4a443f] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#b99881] transition-all duration-500"
                  style={{ width: `${Math.max(st.count > 0 ? st.pct : 4, 4)}%`, opacity: st.count > 0 ? 1 : 0.25 }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-2 flex items-center justify-between">
          <span className="text-[12.5px] font-medium text-[#d6beae]">Net Dönüşüm Oranı</span>
          <span className="text-[18px] font-semibold font-mono text-white">%{convRate}</span>
        </div>
      </GlassCard>
    )
  }

  // 1. DİJİTAL PAZARLAMA BAŞLANGIÇ
  const renderMarketingDashboard = () => {
    const metaLeads = leads.filter((l) => l.source === 'META_ADS')
    const qualifiedCount = leads.filter((l) => l.stage === 'QUALIFIED' || l.stage === 'WON').length
    const qualifiedRate = leads.length > 0 ? Math.round((qualifiedCount / leads.length) * 100) : 0

    const filteredLeads = leads.filter((l) => {
      if (leadFilter === 'NEW') return l.stage === 'NEW'
      if (leadFilter === 'QUALIFIED') return l.stage === 'QUALIFIED' || l.stage === 'WON'
      return true
    })

    return (
      <div className="space-y-5">
        {/* Üst KPI Kartları: İnceltilmiş, Başlık (13-14px medium) -> Değer (32-36px semibold) -> Açıklama (11-12px regular) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <GlassCard className="py-3 px-4 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[13.5px] font-medium text-[#d6beae] truncate">
                Toplam Aday Havuzu
              </span>
              <Users className="w-4 h-4 text-[#b99881] shrink-0" />
            </div>
            <div className="flex items-baseline justify-between mt-1.5">
              <span className="text-[32px] sm:text-[34px] font-semibold text-white font-mono leading-none tracking-tight">
                {leads.length}
              </span>
              <span className="text-[11.5px] font-normal text-[#a69f99] truncate ml-2">
                Aktif veri tabanı
              </span>
            </div>
          </GlassCard>

          <GlassCard className="py-3 px-4 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[13.5px] font-medium text-[#d6beae] truncate">
                Meta Ads Leadleri
              </span>
              <Share2 className="w-4 h-4 text-[#b99881] shrink-0" />
            </div>
            <div className="flex items-baseline justify-between mt-1.5">
              <span className="text-[32px] sm:text-[34px] font-semibold text-white font-mono leading-none tracking-tight">
                {metaLeads.length}
              </span>
              <span className="text-[11.5px] font-normal text-[#a69f99] truncate ml-2">
                Instagram & Facebook
              </span>
            </div>
          </GlassCard>

          <GlassCard className="py-3 px-4 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[13.5px] font-medium text-[#d6beae] truncate">
                Nitelikli Aday Oranı
              </span>
              <Target className="w-4 h-4 text-[#b99881] shrink-0" />
            </div>
            <div className="flex items-baseline justify-between mt-1.5">
              <span className="text-[32px] sm:text-[34px] font-semibold text-white font-mono leading-none tracking-tight">
                %{qualifiedRate}
              </span>
              <span className="text-[11.5px] font-normal text-[#a69f99] truncate ml-2">
                {qualifiedCount} nitelikli aday
              </span>
            </div>
          </GlassCard>

          <GlassCard className="py-3 px-4 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[13.5px] font-medium text-[#d6beae] truncate">
                Meta Entegrasyon
              </span>
              <CheckCircle2 className="w-4 h-4 text-[#b99881] shrink-0" />
            </div>
            <div className="flex items-baseline justify-between mt-2">
              <div className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-white truncate">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="truncate">Webhook Canlı</span>
              </div>
              <span className="text-[11.5px] font-normal text-[#a69f99] truncate ml-2">
                Graph API v19.0
              </span>
            </div>
          </GlassCard>
        </div>

        {/* ANA ODAK NOKTASI DÜZENİ: Sol Ana Sütun (8/12) + Sağ Destekleyici Sütun (4/12) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Sol Ana İçerik Alanı (8/12): Grafik Paneli + Son Müşteri Başvuruları */}
          <div className="lg:col-span-8 space-y-5">
            {renderLeadFlowChart()}

            <GlassCard className="p-4 sm:p-5 bg-[#282522] border-[#4a443f]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-[14px] font-medium text-white">Son Müşteri Başvuruları</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-[#34302d] text-white">
                      {filteredLeads.length} Kayıt
                    </span>
                  </div>
                  <p className="text-[11.5px] font-normal text-[#a69f99] mt-0.5">
                    Reklam formları ve manuel kanallardan sisteme düşen son adaylar
                  </p>
                </div>

                {/* Durum Filtresi (Pill Shape, Katmansız) */}
                <div className="inline-flex items-center gap-1.5 self-start sm:self-auto">
                  {[
                    { id: 'ALL' as const, label: 'Tümü' },
                    { id: 'NEW' as const, label: 'Yeni' },
                    { id: 'QUALIFIED' as const, label: 'Nitelikli' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setLeadFilter(f.id)}
                      className={`px-3 py-1 rounded-full text-[11.5px] font-medium transition-colors cursor-pointer ${
                        leadFilter === f.id
                          ? 'bg-[#b99881] text-[#282522] font-semibold'
                          : 'bg-[#34302d] text-[#a69f99] hover:text-white'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredLeads.length === 0 ? (
                <div className="pt-3 pb-1 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3 text-left">
                    <Inbox className="w-5 h-5 text-[#b99881] shrink-0" />
                    <div>
                      <div className="text-[13.5px] font-medium text-white">
                        Henüz kayıtlı müşteri başvurusu bulunmuyor
                      </div>
                      <div className="text-[11.5px] font-normal text-[#a69f99] mt-0.5">
                        Meta Lead Ads webhook bağlantısı aktif; yeni form başvuruları anlık olarak burada listelenir.
                      </div>
                    </div>
                  </div>
                  {onNavigateToTab && (
                    <button
                      type="button"
                      onClick={() => onNavigateToTab('customers')}
                      className="btn-primary shrink-0 px-4 py-2 rounded-full text-[12px] font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Müşteri Yönetimi</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5 mt-3">
                  {filteredLeads.slice(0, 5).map((l) => (
                    <div
                      key={l.id}
                      onClick={() => onSelectLead(l)}
                      className="p-3 rounded-2xl bg-[#34302d] hover:bg-[#3d3733] cursor-pointer transition-colors flex items-center justify-between"
                    >
                      <div>
                        <div className="text-[13.5px] font-medium text-white">{l.fullName}</div>
                        <div className="text-[11.5px] font-normal text-[#a69f99] mt-0.5">{l.formName}</div>
                      </div>
                      <div className="text-right">
                        <GlassBadge size="sm" variant={l.stage === 'NEW' ? 'warning' : 'primary'}>
                          {STAGE_CONFIGS[l.stage]?.label || l.stage}
                        </GlassBadge>
                        <div className="text-[11px] font-normal text-[#8c857f] mt-1">
                          {formatDate(l.createdAt)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>

          {/* Sağ Destekleyici Sütun (4/12): Dönüşüm Hunisi + Aktif Meta Formları */}
          <div className="lg:col-span-4 space-y-5">
            {renderConversionFunnelCard()}

            <GlassCard className="p-4 sm:p-5 bg-[#282522] border-[#4a443f]">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-[14px] font-medium text-white">Aktif Meta Formları</h3>
                <span className="text-[11.5px] font-mono font-medium text-[#a69f99]">
                  {metaForms.length} Form
                </span>
              </div>
              <p className="text-[11.5px] font-normal text-[#a69f99] mb-3.5">
                Reklam kampanyalarına bağlı veri toplama formları
              </p>

              {metaForms.length === 0 ? (
                <div className="space-y-3 pt-1">
                  <div className="flex items-start gap-2.5">
                    <Megaphone className="w-4 h-4 text-[#b99881] shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[13px] font-medium text-white">
                        Tanımlı kampanya formu yok
                      </div>
                      <div className="text-[11.5px] font-normal text-[#a69f99] mt-0.5">
                        Instagram ve Facebook reklam formlarınızı bağlayarak otomatik aday akışını başlatın.
                      </div>
                    </div>
                  </div>
                  {onNavigateToTab && (
                    <button
                      type="button"
                      onClick={() => onNavigateToTab('marketing-campaigns')}
                      className="w-full py-2 px-4 rounded-full bg-[#34302d] hover:bg-[#3d3733] text-[12px] font-medium text-white flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <span>Kampanyalar & Formlar</span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#b99881]" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {metaForms.map((f) => (
                    <div key={f.id} className="p-3 rounded-2xl bg-[#34302d]">
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-medium text-white truncate max-w-[210px]">
                          {f.name}
                        </span>
                        <span className="text-[12px] font-semibold font-mono text-[#b99881]">
                          {f.leadCount} Lead
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11.5px] font-normal text-[#a69f99] mt-1">
                        <span className="truncate">{f.campaignName}</span>
                        <span className="font-mono font-medium text-white">
                          %{f.conversionRate} Dönüşüm
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>
        </div>
      </div>
    )
  }

  // 2. SATIŞ BAŞLANGIÇ
  const renderSalesDashboard = () => {
    const myLeads =
      currentUser?.scope === 'ASSIGNED_ONLY'
        ? leads.filter(
            (l) => l.assignedToUserId === currentUser.id || l.owner === currentUser.fullName
          )
        : leads

    const todayStr = new Date().toISOString().split('T')[0]
    const todayAppointments = appointments.filter((a) => a.date === todayStr)
    const hotOffers = myLeads.filter((l) => l.stage === 'OFFER' || l.stage === 'PRESENTATION')
    const allUnits = projects.flatMap((p) => p.units || [])
    const reservedUnits = allUnits.filter((u) => u.status === 'REZERVE')

    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <GlassCard className="py-3 px-4 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[13.5px] font-medium text-[#d6beae] truncate">
                Portföyümdeki Müşteriler
              </span>
              <Users className="w-4 h-4 text-[#b99881] shrink-0" />
            </div>
            <div className="flex items-baseline justify-between mt-1.5">
              <span className="text-[32px] sm:text-[34px] font-semibold text-white font-mono leading-none tracking-tight">
                {myLeads.length}
              </span>
              <span className="text-[11.5px] font-normal text-[#a69f99] truncate ml-2">
                Atanan aktif portföy
              </span>
            </div>
          </GlassCard>

          <GlassCard className="py-3 px-4 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[13.5px] font-medium text-[#d6beae] truncate">
                Bugünkü Randevular
              </span>
              <CalendarCheck className="w-4 h-4 text-[#b99881] shrink-0" />
            </div>
            <div className="flex items-baseline justify-between mt-1.5">
              <span className="text-[32px] sm:text-[34px] font-semibold text-white font-mono leading-none tracking-tight">
                {todayAppointments.length}
              </span>
              <span className="text-[11.5px] font-normal text-[#a69f99] truncate ml-2">
                Görüşme ve sunumlar
              </span>
            </div>
          </GlassCard>

          <GlassCard className="py-3 px-4 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[13.5px] font-medium text-[#d6beae] truncate">
                Sıcak Teklifler
              </span>
              <TrendingUp className="w-4 h-4 text-[#b99881] shrink-0" />
            </div>
            <div className="flex items-baseline justify-between mt-1.5">
              <span className="text-[32px] sm:text-[34px] font-semibold text-white font-mono leading-none tracking-tight">
                {hotOffers.length}
              </span>
              <span className="text-[11.5px] font-normal text-[#a69f99] truncate ml-2">
                Sunum & Teklif aşaması
              </span>
            </div>
          </GlassCard>

          <GlassCard className="py-3 px-4 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[13.5px] font-medium text-[#d6beae] truncate">
                Rezerve Daireler
              </span>
              <Building2 className="w-4 h-4 text-[#b99881] shrink-0" />
            </div>
            <div className="flex items-baseline justify-between mt-1.5">
              <span className="text-[32px] sm:text-[34px] font-semibold text-white font-mono leading-none tracking-tight">
                {reservedUnits.length}
              </span>
              <span className="text-[11.5px] font-normal text-[#a69f99] truncate ml-2">
                Opsiyonlu ünite
              </span>
            </div>
          </GlassCard>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-8 space-y-5">
            {renderLeadFlowChart()}

            <GlassCard className="p-4 sm:p-5 bg-[#282522] border-[#4a443f]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[14px] font-medium text-white">Bugünkü ve Yaklaşan Randevular</h3>
                <span className="text-[12px] font-mono font-semibold text-[#b99881]">
                  {appointments.length} Randevu
                </span>
              </div>
              {appointments.length === 0 ? (
                <div className="pt-1 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <CalendarCheck className="w-5 h-5 text-[#b99881] shrink-0" />
                    <div>
                      <div className="text-[13px] font-medium text-white">
                        Planlanmış aktif randevunuz bulunmuyor
                      </div>
                      <div className="text-[11.5px] font-normal text-[#a69f99]">
                        Yeni saha veya ofis görüşmesi planlamak için Randevular sekmesini kullanın.
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {appointments.slice(0, 4).map((a) => (
                    <div
                      key={a.id}
                      className="p-3 rounded-2xl bg-[#34302d] flex items-center justify-between"
                    >
                      <div>
                        <div className="text-[13.5px] font-medium text-white">{a.customerName}</div>
                        <div className="text-[11.5px] font-normal text-[#a69f99] mt-0.5">
                          {a.location} • {a.date} {a.time}
                        </div>
                      </div>
                      <GlassBadge size="sm" variant={a.type === 'ON_SITE' ? 'success' : 'info'}>
                        {a.type === 'ON_SITE' ? 'Ofis / Şantiye' : 'Online'}
                      </GlassBadge>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>

          <div className="lg:col-span-4 space-y-5">
            {renderConversionFunnelCard()}
          </div>
        </div>
      </div>
    )
  }

  // 3. MÜŞTERİ İLİŞKİLERİ BAŞLANGIÇ
  const renderCustomerRelationsDashboard = () => {
    const oct3Start = new Date('2026-10-02T21:00:00.000Z').getTime()
    const uncontactedLeads = leads.filter(
      (l) => l.stage === 'NEW' && new Date(l.createdAt).getTime() >= oct3Start
    )
    const qualifiedLeads = leads.filter((l) => l.stage === 'QUALIFIED')
    const openRequests = requests.filter((r) => r.status === 'Açık' || r.status === 'İşlemde')

    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <GlassCard className="py-3 px-4 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[13.5px] font-medium text-[#d6beae] truncate">
                İletişim Bekleyenler
              </span>
              <PhoneCall className="w-4 h-4 text-[#b99881] shrink-0" />
            </div>
            <div className="flex items-baseline justify-between mt-1.5">
              <span className="text-[32px] sm:text-[34px] font-semibold text-white font-mono leading-none tracking-tight">
                {uncontactedLeads.length}
              </span>
              <span className="text-[11.5px] font-normal text-[#a69f99] truncate ml-2">
                İlk arama bekleyen
              </span>
            </div>
          </GlassCard>

          <GlassCard className="py-3 px-4 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[13.5px] font-medium text-[#d6beae] truncate">
                Nitelikli Belirlenenler
              </span>
              <CheckCircle2 className="w-4 h-4 text-[#b99881] shrink-0" />
            </div>
            <div className="flex items-baseline justify-between mt-1.5">
              <span className="text-[32px] sm:text-[34px] font-semibold text-white font-mono leading-none tracking-tight">
                {qualifiedLeads.length}
              </span>
              <span className="text-[11.5px] font-normal text-[#a69f99] truncate ml-2">
                Satışa devredilecek
              </span>
            </div>
          </GlassCard>

          <GlassCard className="py-3 px-4 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[13.5px] font-medium text-[#d6beae] truncate">Açık Talepler</span>
              <AlertCircle className="w-4 h-4 text-[#b99881] shrink-0" />
            </div>
            <div className="flex items-baseline justify-between mt-1.5">
              <span className="text-[32px] sm:text-[34px] font-semibold text-white font-mono leading-none tracking-tight">
                {openRequests.length}
              </span>
              <span className="text-[11.5px] font-normal text-[#a69f99] truncate ml-2">
                Müşteri destek talebi
              </span>
            </div>
          </GlassCard>

          <GlassCard className="py-3 px-4 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[13.5px] font-medium text-[#d6beae] truncate">
                Organize Randevular
              </span>
              <CalendarCheck className="w-4 h-4 text-[#b99881] shrink-0" />
            </div>
            <div className="flex items-baseline justify-between mt-1.5">
              <span className="text-[32px] sm:text-[34px] font-semibold text-white font-mono leading-none tracking-tight">
                {appointments.length}
              </span>
              <span className="text-[11.5px] font-normal text-[#a69f99] truncate ml-2">
                Satışa yönlendirilen
              </span>
            </div>
          </GlassCard>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-8 space-y-5">{renderLeadFlowChart()}</div>
          <div className="lg:col-span-4 space-y-5">{renderConversionFunnelCard()}</div>
        </div>
      </div>
    )
  }

  // 4. MUHASEBE BAŞLANGIÇ
  const renderAccountingDashboard = () => {
    const collectedTotal = collections
      .filter((c) => c.status === 'COLLECTED')
      .reduce((acc, c) => acc + c.amount, 0)
    const pendingCollections = collections.filter((c) => c.status === 'PENDING')
    const pendingTotal = pendingCollections.reduce((acc, c) => acc + c.amount, 0)
    const overdueCollections = collections.filter((c) => c.status === 'OVERDUE')
    const pendingPayments = payments.filter((p) => p.status === 'PENDING')
    const pendingPaymentsTotal = pendingPayments.reduce((acc, p) => acc + p.amount, 0)

    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <GlassCard className="py-3 px-4 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[13.5px] font-medium text-[#d6beae] truncate">
                Tahsil Edilen Tutar
              </span>
              <TurkishLira className="w-4 h-4 text-[#b99881] shrink-0" />
            </div>
            <div className="text-[28px] sm:text-[32px] font-semibold text-white mt-1.5 font-mono leading-none tracking-tight truncate">
              {formatCurrency(collectedTotal)}
            </div>
            <div className="text-[11.5px] font-normal text-[#a69f99] mt-1 truncate">
              Kasaya giren nakit
            </div>
          </GlassCard>

          <GlassCard className="py-3 px-4 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[13.5px] font-medium text-[#d6beae] truncate">
                Bekleyen Tahsilatlar
              </span>
              <Clock className="w-4 h-4 text-[#b99881] shrink-0" />
            </div>
            <div className="text-[28px] sm:text-[32px] font-semibold text-white mt-1.5 font-mono leading-none tracking-tight truncate">
              {formatCurrency(pendingTotal)}
            </div>
            <div className="text-[11.5px] font-normal text-[#a69f99] mt-1 truncate">
              {pendingCollections.length} adet vadesi gelen
            </div>
          </GlassCard>

          <GlassCard className="py-3 px-4 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[13.5px] font-medium text-[#d6beae] truncate">
                Geciken Tahsilat
              </span>
              <AlertCircle className="w-4 h-4 text-[#b99881] shrink-0" />
            </div>
            <div className="text-[28px] sm:text-[32px] font-semibold text-white mt-1.5 font-mono leading-none tracking-tight truncate">
              {overdueCollections.length}
            </div>
            <div className="text-[11.5px] font-normal text-[#a69f99] mt-1 truncate">
              Takip gerektiren işlem
            </div>
          </GlassCard>

          <GlassCard className="py-3 px-4 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[13.5px] font-medium text-[#d6beae] truncate">
                Planlanan Ödemeler
              </span>
              <Briefcase className="w-4 h-4 text-[#b99881] shrink-0" />
            </div>
            <div className="text-[28px] sm:text-[32px] font-semibold text-white mt-1.5 font-mono leading-none tracking-tight truncate">
              {formatCurrency(pendingPaymentsTotal)}
            </div>
            <div className="text-[11.5px] font-normal text-[#a69f99] mt-1 truncate">
              Komisyon & Şantiye
            </div>
          </GlassCard>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <GlassCard className="p-4 sm:p-5 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[14px] font-medium text-white">
                Bekleyen & Vadesi Gelen Tahsilatlar
              </h3>
              <span className="text-[12px] font-mono font-semibold text-[#b99881]">
                {collections.length} İşlem
              </span>
            </div>
            {collections.length === 0 ? (
              <div className="text-[12.5px] text-[#a69f99]">
                Kayıtlı tahsilat işlemi bulunmuyor.
              </div>
            ) : (
              <div className="space-y-2.5">
                {collections.slice(0, 4).map((c) => (
                  <div
                    key={c.id}
                    className="p-3 rounded-2xl bg-[#34302d] flex items-center justify-between"
                  >
                    <div>
                      <div className="text-[13.5px] font-medium text-white">
                        {c.customerName} ({c.unitNumber})
                      </div>
                      <div className="text-[11.5px] font-normal text-[#a69f99] mt-0.5">
                        {c.projectName} • Vade: {c.dueDate}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[13.5px] font-semibold font-mono text-white">
                        {formatCurrency(c.amount)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          <GlassCard className="p-4 sm:p-5 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[14px] font-medium text-white">
                Planlanan Şantiye & Komisyon Ödemeleri
              </h3>
              <span className="text-[12px] font-mono font-medium text-[#a69f99]">
                {payments.length} Ödeme
              </span>
            </div>
            {payments.length === 0 ? (
              <div className="text-[12.5px] text-[#a69f99]">
                Planlanmış ödeme kaydı bulunmuyor.
              </div>
            ) : (
              <div className="space-y-2.5">
                {payments.slice(0, 4).map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-2xl bg-[#34302d] flex items-center justify-between"
                  >
                    <div>
                      <div className="text-[13.5px] font-medium text-white">{p.title}</div>
                      <div className="text-[11.5px] font-normal text-[#a69f99] mt-0.5">
                        {p.payee} • {p.dueDate}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[13.5px] font-semibold font-mono text-white">
                        {formatCurrency(p.amount)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    )
  }

  // 5. YÖNETİM BAŞLANGIÇ
  const renderExecutiveDashboard = () => {
    const pendingApprovals = approvals.filter((a) => a.status === 'BEKLEMEDE')
    const allUnits = projects.flatMap((p) => p.units || [])
    const soldUnits = allUnits.filter((u) => u.status === 'SATILDI')
    const totalSalesVolume = soldUnits.reduce((acc, u) => acc + (u.sale?.salePrice || u.price), 0)

    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <GlassCard className="py-3 px-4 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[13.5px] font-medium text-[#d6beae] truncate">
                Toplam Satış Hacmi
              </span>
              <TurkishLira className="w-4 h-4 text-[#b99881] shrink-0" />
            </div>
            <div className="text-[28px] sm:text-[32px] font-semibold text-white mt-1.5 font-mono leading-none tracking-tight truncate">
              {formatCurrency(totalSalesVolume)}
            </div>
            <div className="text-[11.5px] font-normal text-[#a69f99] mt-1 truncate">
              {soldUnits.length} daire sözleşmesi
            </div>
          </GlassCard>

          <GlassCard className="py-3 px-4 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[13.5px] font-medium text-[#d6beae] truncate">
                Bekleyen Onaylar
              </span>
              <FileCheck2 className="w-4 h-4 text-[#b99881] shrink-0" />
            </div>
            <div className="text-[32px] sm:text-[34px] font-semibold text-white mt-1.5 font-mono leading-none tracking-tight truncate">
              {pendingApprovals.length}
            </div>
            <div className="text-[11.5px] font-normal text-[#a69f99] mt-1 truncate">
              İskonto & Rezervasyon
            </div>
          </GlassCard>

          <GlassCard className="py-3 px-4 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[13.5px] font-medium text-[#d6beae] truncate">
                Proje Envanteri
              </span>
              <Building2 className="w-4 h-4 text-[#b99881] shrink-0" />
            </div>
            <div className="text-[32px] sm:text-[34px] font-semibold text-white mt-1.5 font-mono leading-none tracking-tight truncate">
              {projects.length}
            </div>
            <div className="text-[11.5px] font-normal text-[#a69f99] mt-1 truncate">
              {allUnits.length} bağımsız bölüm
            </div>
          </GlassCard>

          <GlassCard className="py-3 px-4 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[13.5px] font-medium text-[#d6beae] truncate">
                Sistem Durumu
              </span>
              <ShieldCheck className="w-4 h-4 text-[#b99881] shrink-0" />
            </div>
            <div className="text-[20px] sm:text-[22px] font-semibold text-white mt-2 leading-none truncate">
              5 Departman Aktif
            </div>
            <div className="text-[11.5px] font-normal text-[#a69f99] mt-1.5 truncate">
              Yetki modeli devrede
            </div>
          </GlassCard>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-8 space-y-5">{renderLeadFlowChart()}</div>
          <div className="lg:col-span-4 space-y-5">{renderConversionFunnelCard()}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      {renderHeader()}

      {department === 'Pazarlama' && renderMarketingDashboard()}
      {department === 'Satış' && renderSalesDashboard()}
      {department === 'Müşteri İlişkileri' && renderCustomerRelationsDashboard()}
      {department === 'Muhasebe' && renderAccountingDashboard()}
      {department === 'Yönetim' && renderExecutiveDashboard()}
    </div>
  )
}
