import React, { useState, useEffect, useRef } from 'react'
import {
  Megaphone,
  Plus,
  Zap,
  CheckCircle2,
  Globe,
  Search,
  Upload,
  Settings,
  Copy,
  Check,
  Trash2,
  Play,
  Pause,
  Layers,
  Share2,
  MessageCircle,
} from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlassButton } from '@/components/ui/GlassButton'
import { GlassBadge } from '@/components/ui/GlassBadge'
import { GlassModal } from '@/components/ui/GlassModal'
import { metaStore } from '@/services/metaStore'
import {
  googleAdsStore,
  GoogleCampaignItem,
  GoogleConversionLog,
  GoogleAdsConfig,
} from '@/services/googleAdsStore'
import { leadStore } from '@/services/leadStore'
import { MetaFormSummary, MetaCapiEventLog } from '@/types/meta'
import { Lead } from '@/types/lead'

type CampaignPlatformTab = 'all' | 'meta' | 'google' | 'web'

export const MarketingCampaignsView: React.FC = () => {
  const [activePlatform, setActivePlatform] = useState<CampaignPlatformTab>('all')

  // Meta State
  const [forms, setForms] = useState<MetaFormSummary[]>(() => metaStore.getForms())
  const [capiLogs, setCapiLogs] = useState<MetaCapiEventLog[]>(() => metaStore.getCapiLogs())
  const [metaConfig, setMetaConfig] = useState(() => metaStore.getConfig())
  const [isSimulateOpen, setIsSimulateOpen] = useState(false)
  const metaCsvInputRef = useRef<HTMLInputElement>(null)

  // Google Ads State
  const [googleCampaigns, setGoogleCampaigns] = useState<GoogleCampaignItem[]>(() =>
    googleAdsStore.getCampaigns()
  )
  const [googleLogs, setGoogleLogs] = useState<GoogleConversionLog[]>(() =>
    googleAdsStore.getConversionLogs()
  )
  const [googleConfig, setGoogleConfig] = useState<GoogleAdsConfig>(() =>
    googleAdsStore.getConfig()
  )
  const [isGoogleSimulateOpen, setIsGoogleSimulateOpen] = useState(false)
  const [isGoogleConfigOpen, setIsGoogleConfigOpen] = useState(false)
  const [isAddGoogleCampOpen, setIsAddGoogleCampOpen] = useState(false)
  const googleCsvInputRef = useRef<HTMLInputElement>(null)

  // All Leads State (for Web & Digital channels + combined stats)
  const [allLeads, setAllLeads] = useState<Lead[]>(() => leadStore.getAllRaw())

  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 4000)
  }

  const copyText = (key: string, text: string) => {
    try {
      navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    } catch {}
  }

  useEffect(() => {
    const syncAll = () => {
      setForms(metaStore.getForms())
      setCapiLogs(metaStore.getCapiLogs())
      setMetaConfig(metaStore.getConfig())
      setGoogleCampaigns(googleAdsStore.getCampaigns())
      setGoogleLogs(googleAdsStore.getConversionLogs())
      setGoogleConfig(googleAdsStore.getConfig())
      setAllLeads(leadStore.getAllRaw())
    }
    const unsubMeta = metaStore.subscribe(syncAll)
    const unsubGoogle = googleAdsStore.subscribe(syncAll)
    const unsubLeads = leadStore.subscribe(syncAll)
    return () => {
      unsubMeta()
      unsubGoogle()
      unsubLeads()
    }
  }, [])

  // Meta Webhook Simulation Form State
  const [newLeadName, setNewLeadName] = useState('')
  const [newLeadPhone, setNewLeadPhone] = useState('')
  const [selectedFormName, setSelectedFormName] = useState(forms[0]?.name || 'Meta Lead Formu')
  const [leadBudget, setLeadBudget] = useState<number>(6500000)
  const [housingType, setHousingType] = useState('2+1 Rezidans')
  const [investmentPurpose, setInvestmentPurpose] = useState('Yatırım & Kira Getirisi')
  const [moveInTiming, setMoveInTiming] = useState('Hemen (1-3 Ay İçinde)')

  // Google Webhook Simulation Form State
  const [gLeadName, setGLeadName] = useState('')
  const [gLeadPhone, setGLeadPhone] = useState('')
  const [gLeadEmail, setGLeadEmail] = useState('')
  const [gFormName, setGFormName] = useState(
    googleCampaigns[0]?.formName || 'Google Arama - Konut Yatırım Formu'
  )
  const [gCampaignType, setGCampaignType] = useState<GoogleCampaignItem['campaignType']>(
    'Arama Ağı (Search)'
  )
  const [gKeyword, setGKeyword] = useState('satılık lüks daire projeleri')
  const [gHousingType, setGHousingType] = useState('2+1 Rezidans')
  const [gBudget, setGBudget] = useState<number>(7250000)

  // Add Google Campaign Modal State
  const [newGCampName, setNewGCampName] = useState('')
  const [newGCampType, setNewGCampType] = useState<GoogleCampaignItem['campaignType']>(
    'Arama Ağı (Search)'
  )
  const [newGCampFormName, setNewGCampFormName] = useState('')

  // Google Config Form State
  const [cfgCustomerId, setCfgCustomerId] = useState(googleConfig.customerId)
  const [cfgConversionId, setCfgConversionId] = useState(googleConfig.conversionId)
  const [cfgConversionLabel, setCfgConversionLabel] = useState(googleConfig.conversionLabel)
  const [cfgWebhookKey, setCfgWebhookKey] = useState(googleConfig.webhookKey)
  const [cfgAutoSync, setCfgAutoSync] = useState(googleConfig.autoSyncConversions)

  useEffect(() => {
    if (isGoogleConfigOpen) {
      const c = googleAdsStore.getConfig()
      setCfgCustomerId(c.customerId)
      setCfgConversionId(c.conversionId)
      setCfgConversionLabel(c.conversionLabel)
      setCfgWebhookKey(c.webhookKey)
      setCfgAutoSync(c.autoSyncConversions)
    }
  }, [isGoogleConfigOpen])

  const handleSimulateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLeadName.trim() || !newLeadPhone.trim()) return

    metaStore.simulateIncomingLead({
      fullName: newLeadName.trim(),
      phone: newLeadPhone.trim(),
      formName: selectedFormName || 'Meta Lead Formu',
      budget: leadBudget,
      preferredHousingType: housingType,
      investmentPurpose,
      moveInTiming,
    })

    setForms(metaStore.getForms())
    setIsSimulateOpen(false)
    setNewLeadName('')
    setNewLeadPhone('')
    showToast(
      'Canlı Meta Webhook başarıyla simüle edildi ve müşteri form cevaplarıyla CRM havuzuna işlendi.'
    )
  }

  const handleGoogleSimulateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!gLeadName.trim() || !gLeadPhone.trim()) return

    googleAdsStore.simulateIncomingGoogleLead({
      fullName: gLeadName.trim(),
      phone: gLeadPhone.trim(),
      email: gLeadEmail.trim() || undefined,
      formName: gFormName.trim() || 'Google Ads Arama Formu',
      campaignType: gCampaignType,
      budget: gBudget,
      preferredHousingType: gHousingType,
      searchKeyword: gKeyword.trim() || undefined,
    })

    setGoogleCampaigns(googleAdsStore.getCampaigns())
    setIsGoogleSimulateOpen(false)
    setGLeadName('')
    setGLeadPhone('')
    setGLeadEmail('')
    showToast(
      'Google Ads Lead Form Webhook başarıyla simüle edildi ve GCLID kimliğiyle CRM havuzuna eklendi.'
    )
  }

  const handleAddGoogleCampaign = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newGCampName.trim()) return
    googleAdsStore.addCampaign({
      name: newGCampName.trim(),
      campaignType: newGCampType,
      formName: newGCampFormName.trim() || newGCampName.trim(),
    })
    setNewGCampName('')
    setNewGCampFormName('')
    setIsAddGoogleCampOpen(false)
    showToast('Yeni Google Ads kampanyası ve form uzantısı tanımlandı.')
  }

  const handleSaveGoogleConfig = (e: React.FormEvent) => {
    e.preventDefault()
    googleAdsStore.saveConfig({
      customerId: cfgCustomerId.trim(),
      conversionId: cfgConversionId.trim(),
      conversionLabel: cfgConversionLabel.trim(),
      webhookKey: cfgWebhookKey.trim(),
      autoSyncConversions: cfgAutoSync,
    })
    googleAdsStore.flushQueuedConversions()
    setIsGoogleConfigOpen(false)
    showToast('Google Ads CRM ve Gelişmiş Dönüşüm (OCI) ayarları kaydedildi.')
  }

  const handleMetaCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const res = metaStore.importLeadsFromMetaCsvText(String(reader.result || ''))
      showToast(
        `Meta CSV dosyasından ${res.newCount} yeni potansiyel müşteri (${res.mergedCount} güncelleme) aktarıldı.`
      )
    }
    reader.readAsText(file, 'utf-8')
    e.target.value = ''
  }

  const handleGoogleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const res = googleAdsStore.importLeadsFromGoogleCsvText(String(reader.result || ''))
      showToast(
        `Google Ads CSV dosyasından ${res.newCount} yeni potansiyel müşteri (${res.mergedCount} güncelleme) aktarıldı.`
      )
    }
    reader.readAsText(file, 'utf-8')
    e.target.value = ''
  }

  // Metrics Calculation
  const totalMetaLeads = forms.reduce((acc, f) => acc + f.leadCount, 0)
  const avgMetaConversion =
    forms.length > 0
      ? Math.round(forms.reduce((acc, f) => acc + f.conversionRate, 0) / forms.length)
      : 0

  const totalGoogleLeads = googleCampaigns.reduce((acc, c) => acc + c.leadCount, 0)
  const avgGoogleConversion =
    googleCampaigns.length > 0
      ? Math.round(
          googleCampaigns.reduce((acc, c) => acc + c.conversionRate, 0) /
            googleCampaigns.length
        )
      : 0

  const webLeads = allLeads.filter(
    (l) =>
      l.source === 'WEBSITE' ||
      l.source === 'WHATSAPP' ||
      l.channel?.toLowerCase().includes('web')
  )
  const webConverted = webLeads.filter(
    (l) =>
      l.stage === 'QUALIFIED' ||
      l.stage === 'APPOINTMENT' ||
      l.stage === 'OFFER' ||
      l.stage === 'WON'
  ).length
  const avgWebConversion =
    webLeads.length > 0 ? Math.round((webConverted / webLeads.length) * 100) : 0

  const grandTotalLeads = totalMetaLeads + totalGoogleLeads + webLeads.length

  const TABS: {
    id: CampaignPlatformTab
    label: string
    badge: number
    sub: string
  }[] = [
    {
      id: 'all',
      label: 'Tümü',
      badge: grandTotalLeads,
      sub: 'Birleşik Görünüm',
    },
    {
      id: 'meta',
      label: 'Meta Ads',
      badge: totalMetaLeads,
      sub: 'Instagram & Facebook',
    },
    {
      id: 'google',
      label: 'Google Ads',
      badge: totalGoogleLeads,
      sub: 'Search, YouTube & PMax',
    },
    {
      id: 'web',
      label: 'Web & Dijital Kanallar',
      badge: webLeads.length,
      sub: 'Web Form, Portal & WhatsApp',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Hidden CSV Inputs */}
      <input
        ref={metaCsvInputRef}
        type="file"
        accept=".csv,.tsv,.txt"
        onChange={handleMetaCsvImport}
        className="hidden"
      />
      <input
        ref={googleCsvInputRef}
        type="file"
        accept=".csv,.tsv,.txt"
        onChange={handleGoogleCsvImport}
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Megaphone className="w-5 h-5 text-[#b99881]" />
            <h2 className="text-2xl font-bold text-white tracking-wide">Kampanyalar</h2>
          </div>
          <p className="text-xs text-[#a69f99] mt-1">
            Meta Ads, Google Ads ve Web & Dijital kanalların CRM entegrasyonları, form performansları ve dönüşüm sinyalleri.
          </p>
        </div>

        {/* Dynamic Platform Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {(activePlatform === 'all' || activePlatform === 'meta') && (
            <>
              <GlassButton
                variant="subtle"
                size="sm"
                icon={<Upload className="w-3.5 h-3.5" />}
                onClick={() => metaCsvInputRef.current?.click()}
                className="rounded-full px-3.5 text-xs font-semibold"
              >
                Meta CSV Yükle
              </GlassButton>
              <GlassButton
                variant="gold"
                size="sm"
                icon={<Zap className="w-3.5 h-3.5" />}
                onClick={() => {
                  if (!selectedFormName && forms[0]?.name) setSelectedFormName(forms[0].name)
                  setIsSimulateOpen(true)
                }}
                className="rounded-full px-4 text-xs font-semibold"
              >
                Meta Webhook Simülasyonu
              </GlassButton>
            </>
          )}

          {(activePlatform === 'all' || activePlatform === 'google') && (
            <>
              {activePlatform === 'google' && (
                <>
                  <GlassButton
                    variant="subtle"
                    size="sm"
                    icon={<Settings className="w-3.5 h-3.5" />}
                    onClick={() => setIsGoogleConfigOpen(true)}
                    className="rounded-full px-3.5 text-xs font-semibold"
                  >
                    Google CRM Bağlantısı
                  </GlassButton>
                  <GlassButton
                    variant="subtle"
                    size="sm"
                    icon={<Upload className="w-3.5 h-3.5" />}
                    onClick={() => googleCsvInputRef.current?.click()}
                    className="rounded-full px-3.5 text-xs font-semibold"
                  >
                    Google CSV Yükle
                  </GlassButton>
                  <GlassButton
                    variant="subtle"
                    size="sm"
                    icon={<Plus className="w-3.5 h-3.5" />}
                    onClick={() => setIsAddGoogleCampOpen(true)}
                    className="rounded-full px-3.5 text-xs font-semibold"
                  >
                    Kampanya Ekle
                  </GlassButton>
                </>
              )}
              <GlassButton
                variant="gold"
                size="sm"
                icon={<Search className="w-3.5 h-3.5" />}
                onClick={() => setIsGoogleSimulateOpen(true)}
                className="rounded-full px-4 text-xs font-semibold"
              >
                Google Webhook Simülasyonu
              </GlassButton>
            </>
          )}
        </div>
      </div>

      {/* Platform Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-[#282522] border border-[#4a443f] w-fit">
        {TABS.map((tab) => {
          const isActive = activePlatform === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActivePlatform(tab.id)}
              className={`flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#b99881] text-white shadow-sm'
                  : 'text-[#a69f99] hover:text-white hover:bg-[#34302d]/60'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isActive
                    ? 'bg-black/20 text-white'
                    : 'bg-[#34302d] text-[#d6beae] border border-[#4a443f]'
                }`}
              >
                {tab.badge}
              </span>
            </button>
          )
        })}
      </div>

      {successMsg && (
        <div className="p-3 rounded-[16px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* =====================================================================
          1. TÜMÜ SEKMESİ (Unified Multi-Channel Overview)
         ===================================================================== */}
      {activePlatform === 'all' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
              <div className="text-xs text-[#a69f99]">Toplam Kampanya Adayı</div>
              <div className="text-2xl font-bold text-white mt-1">{grandTotalLeads}</div>
              <div className="text-[11px] text-[#8c857f] mt-1">
                Meta + Google + Web Kanalları
              </div>
            </GlassCard>

            <GlassCard
              onClick={() => setActivePlatform('meta')}
              className="p-4 bg-[#282522] border-[#4a443f] hover:border-[#b99881]/60 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-sky-400">Meta Ads (IG & FB)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400 font-bold">
                  {forms.length} Form
                </span>
              </div>
              <div className="text-2xl font-bold text-white mt-1">{totalMetaLeads}</div>
              <div className="text-[11px] text-[#8c857f] mt-1">
                %{avgMetaConversion} dönüşüm • {capiLogs.length} CAPI sinyali
              </div>
            </GlassCard>

            <GlassCard
              onClick={() => setActivePlatform('google')}
              className="p-4 bg-[#282522] border-[#4a443f] hover:border-[#b99881]/60 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-400">
                  Google Ads (Search & PMax)
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-bold">
                  {googleCampaigns.length} Kampanya
                </span>
              </div>
              <div className="text-2xl font-bold text-white mt-1">{totalGoogleLeads}</div>
              <div className="text-[11px] text-[#8c857f] mt-1">
                %{avgGoogleConversion} dönüşüm • {googleLogs.length} OCI sinyali
              </div>
            </GlassCard>

            <GlassCard
              onClick={() => setActivePlatform('web')}
              className="p-4 bg-[#282522] border-[#4a443f] hover:border-[#b99881]/60 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400">
                  Web & Dijital Kanallar
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold">
                  Canlı
                </span>
              </div>
              <div className="text-2xl font-bold text-white mt-1">{webLeads.length}</div>
              <div className="text-[11px] text-[#8c857f] mt-1">
                %{avgWebConversion} dönüşüm • Web Sitesi & WhatsApp
              </div>
            </GlassCard>
          </div>

          {/* All Active Forms & Campaigns */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#b99881]" />
                <span>Tüm Aktif Kampanya ve Formlar</span>
              </h3>
            </div>

            {forms.length === 0 && googleCampaigns.length === 0 && webLeads.length === 0 ? (
              <div className="py-16 text-center rounded-2xl border border-dashed border-[#4a443f]">
                <Megaphone className="w-9 h-9 text-[#8c857f] mx-auto mb-2 opacity-40" />
                <p className="text-xs font-semibold text-white">Henüz aktif kampanya verisi yok</p>
                <p className="text-[11px] text-[#8c857f] mt-1">
                  Meta Ads veya Google Ads sekmelerinden CSV aktarabilir veya Webhook bağlantısı kurabilirsiniz.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {forms.map((form) => (
                  <GlassCard
                    key={`meta-${form.id}`}
                    className="p-5 bg-[#282522] border-[#4a443f] space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/25 font-semibold">
                        Meta Ads • IG & FB
                      </span>
                      <GlassBadge
                        size="sm"
                        variant={form.status === 'ACTIVE' ? 'success' : 'default'}
                      >
                        {form.status === 'ACTIVE' ? 'Aktif' : 'Durduruldu'}
                      </GlassBadge>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">{form.name}</h3>
                      <p className="text-xs text-[#a69f99] mt-0.5">{form.campaignName}</p>
                    </div>
                    <div className="pt-1 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[#8c857f]">Toplam Lead:</span>
                        <span className="text-white font-bold ml-1.5">{form.leadCount}</span>
                      </div>
                      <div>
                        <span className="text-[#8c857f]">Dönüşüm:</span>
                        <span className="text-emerald-400 font-bold ml-1.5">
                          %{form.conversionRate}
                        </span>
                      </div>
                    </div>
                    <div className="text-[10px] text-[#8c857f]">
                      Son Aday:{' '}
                      {form.lastLeadAt
                        ? new Date(form.lastLeadAt).toLocaleString('tr-TR')
                        : 'Kayıt yok'}
                    </div>
                  </GlassCard>
                ))}

                {googleCampaigns.map((camp) => (
                  <GlassCard
                    key={`google-${camp.id}`}
                    className="p-5 bg-[#282522] border-[#4a443f] space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/25 font-semibold">
                        Google Ads • {camp.campaignType}
                      </span>
                      <GlassBadge
                        size="sm"
                        variant={camp.status === 'ACTIVE' ? 'success' : 'default'}
                      >
                        {camp.status === 'ACTIVE' ? 'Aktif' : 'Duraklatıldı'}
                      </GlassBadge>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">{camp.name}</h3>
                      <p className="text-xs text-[#a69f99] mt-0.5">Form: {camp.formName}</p>
                    </div>
                    <div className="pt-1 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[#8c857f]">Toplam Lead:</span>
                        <span className="text-white font-bold ml-1.5">{camp.leadCount}</span>
                      </div>
                      <div>
                        <span className="text-[#8c857f]">Dönüşüm:</span>
                        <span className="text-emerald-400 font-bold ml-1.5">
                          %{camp.conversionRate}
                        </span>
                      </div>
                    </div>
                    <div className="text-[10px] text-[#8c857f]">
                      Son Aday:{' '}
                      {camp.lastLeadAt
                        ? new Date(camp.lastLeadAt).toLocaleString('tr-TR')
                        : 'Kayıt yok'}
                    </div>
                  </GlassCard>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          2. META ADS SEKMESİ (Instagram & Facebook Lead Ads + CAPI)
         ===================================================================== */}
      {activePlatform === 'meta' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
              <div className="text-xs text-[#a69f99]">Toplam Meta Kampanya Lead'i</div>
              <div className="text-2xl font-bold text-white mt-1">{totalMetaLeads}</div>
              <div className="text-[11px] text-[#8c857f] mt-1">
                {forms.length} Aktif Meta Reklam Formu
              </div>
            </GlassCard>

            <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
              <div className="text-xs text-emerald-400">Ortalama Dönüşüm</div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">%{avgMetaConversion}</div>
              <div className="text-[11px] text-[#8c857f] mt-1">Formdan randevuya dönüşüm</div>
            </GlassCard>

            <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
              <div className="text-xs text-sky-400">Meta Dönüşümler API (CAPI) Durumu</div>
              <div className="text-sm font-semibold text-white mt-2 flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    metaConfig.datasetId ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}
                />
                {metaConfig.datasetId
                  ? `Dataset: ${metaConfig.datasetId}`
                  : 'Dataset ID Bekleniyor (Ayarlar > Meta)'}
              </div>
              <div className="text-[11px] text-[#8c857f] mt-1">
                {capiLogs.length} CAPI Sinyali • SHA-256 Şifreli CRM Aktarımı
              </div>
            </GlassCard>
          </div>

          {/* Meta Dönüşümler API (CAPI) Sinyalleri */}
          <GlassCard className="p-5 bg-[#282522] border-[#4a443f] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#b99881]" />
                  <span>
                    Meta Dönüşümler API'si (CAPI) — Olumlu / Olumsuz Müşteri Sinyalleri
                  </span>
                </h3>
                <p className="text-xs text-[#a69f99] mt-0.5">
                  CRM'de aşaması değişen veya Nitelikli (QualifiedLead) / Olumsuz (DisqualifiedLead) olarak işaretlenen müşterilerin Meta'ya aktarım kaydı.
                </p>
              </div>
              {capiLogs.some((l) => l.status === 'QUEUED') && (
                <GlassButton
                  variant="subtle"
                  size="sm"
                  onClick={() => metaStore.flushQueuedCapiEvents()}
                  className="rounded-full px-3.5 text-xs font-semibold"
                >
                  Kuyruktaki Sinyalleri Gönder
                </GlassButton>
              )}
            </div>

            {capiLogs.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#8c857f] border border-dashed border-[#4a443f] rounded-2xl">
                Henüz Meta'ya gönderilmiş bir dönüşüm sinyali yok. Müşteri detayından{' '}
                <strong>Olumlu / Nitelikli</strong> veya <strong>Olumsuz</strong> butonuna tıkladığınızda ya da müşteri aşamasını değiştirdiğinizde burada listelenir.
              </div>
            ) : (
              <div className="divide-y divide-[#4a443f]/50 max-h-[220px] overflow-y-auto pr-1">
                {capiLogs.slice(0, 15).map((log) => (
                  <div
                    key={log.id}
                    className="py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                          log.eventName === 'QualifiedLead' || log.eventName === 'Purchase'
                            ? 'bg-emerald-500/12 text-emerald-400 border-emerald-500/30'
                            : log.eventName === 'DisqualifiedLead'
                            ? 'bg-rose-500/12 text-rose-400 border-rose-500/30'
                            : 'bg-sky-500/12 text-sky-300 border-sky-500/30'
                        }`}
                      >
                        {log.eventName}
                      </span>
                      <span className="font-bold text-white truncate">{log.leadName}</span>
                      <span className="text-[#8c857f]">•</span>
                      <span className="text-[#d6beae] font-medium">{log.signalLabel}</span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[11px] text-[#8c857f] font-mono">
                        {new Date(log.sentAt).toLocaleTimeString('tr-TR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          log.status === 'SENT'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : log.status === 'QUEUED'
                            ? 'bg-amber-500/15 text-amber-300'
                            : 'bg-rose-500/15 text-rose-400'
                        }`}
                        title={log.errorMessage || ''}
                      >
                        {log.status === 'SENT'
                          ? "Meta'ya İletildi"
                          : log.status === 'QUEUED'
                          ? 'Kuyrukta'
                          : 'Hata'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          {/* Meta Kampanya ve Form Kartları */}
          {forms.length === 0 ? (
            <div className="py-16 text-center flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#4a443f]">
              <Megaphone className="w-10 h-10 text-[#8c857f] mx-auto mb-3 opacity-40" />
              <h3 className="text-sm font-semibold text-white">Kayıtlı Meta formu bulunamadı</h3>
              <p className="text-xs text-[#8c857f] mt-1 max-w-sm mx-auto">
                Meta CSV Yükle veya Meta Webhook Simülasyonu ile form verilerini aktarabilirsiniz.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {forms.map((form) => (
                <GlassCard
                  key={form.id}
                  className="p-5 bg-[#282522] border-[#4a443f] space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/20 font-semibold">
                      Instagram & Facebook
                    </span>
                    <GlassBadge
                      size="sm"
                      variant={form.status === 'ACTIVE' ? 'success' : 'default'}
                    >
                      {form.status === 'ACTIVE' ? 'Aktif' : 'Durduruldu'}
                    </GlassBadge>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-white">{form.name}</h3>
                    <p className="text-xs text-[#a69f99] mt-0.5">{form.campaignName}</p>
                  </div>

                  <div className="pt-1 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[#8c857f]">Toplam Lead:</span>
                      <span className="text-white font-bold ml-1.5">{form.leadCount}</span>
                    </div>
                    <div>
                      <span className="text-[#8c857f]">Dönüşüm:</span>
                      <span className="text-emerald-400 font-bold ml-1.5">
                        %{form.conversionRate}
                      </span>
                    </div>
                  </div>

                  <div className="text-[10px] text-[#8c857f]">
                    Son Aday:{' '}
                    {form.lastLeadAt
                      ? new Date(form.lastLeadAt).toLocaleString('tr-TR')
                      : 'Kayıt yok'}
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          3. GOOGLE ADS SEKMESİ (Search, YouTube & PMax Lead Forms + OCI/GCLID)
         ===================================================================== */}
      {activePlatform === 'google' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
              <div className="text-xs text-[#a69f99]">Toplam Google Ads Lead'i</div>
              <div className="text-2xl font-bold text-white mt-1">{totalGoogleLeads}</div>
              <div className="text-[11px] text-[#8c857f] mt-1">
                {googleCampaigns.length} Google Lead Form Uzantısı
              </div>
            </GlassCard>

            <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
              <div className="text-xs text-emerald-400">Google Arama & PMax Dönüşümü</div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">
                %{avgGoogleConversion}
              </div>
              <div className="text-[11px] text-[#8c857f] mt-1">
                Anahtar kelime & formdan nitelikli adaya dönüşüm
              </div>
            </GlassCard>

            <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
              <div className="text-xs text-amber-400">
                Google Gelişmiş Dönüşümler (Enhanced Conversions / OCI)
              </div>
              <div className="text-sm font-semibold text-white mt-2 flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    googleConfig.conversionId ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}
                />
                {googleConfig.conversionId
                  ? `Hesap: ${googleConfig.customerId || googleConfig.conversionId}`
                  : 'Webhook Hazır • Conversion ID Bekleniyor'}
              </div>
              <div className="text-[11px] text-[#8c857f] mt-1">
                {googleLogs.length} Dönüşüm Sinyali • GCLID & SHA-256 Eşleştirme
              </div>
            </GlassCard>
          </div>

          {/* Google Ads Webhook & CRM Bağlantı Kartı */}
          <GlassCard className="p-5 bg-[#282522] border-[#4a443f] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Search className="w-4 h-4 text-[#b99881]" />
                  <span>
                    Google Ads Potansiyel Müşteri Formu Uzantısı (Lead Form Webhook) & CRM Bağlantısı
                  </span>
                </h3>
                <p className="text-xs text-[#a69f99] mt-0.5">
                  Google Ads kampanya ayarlarındaki <strong>Potansiyel Müşteri Formu Uzantısı &gt; Webhook Entegrasyonu</strong> bölümüne aşağıdaki URL ve anahtarı yapıştırarak Google reklamlarından gelen formları anında CRM'e düşürebilirsiniz.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <GlassButton
                  variant="subtle"
                  size="sm"
                  onClick={() => {
                    googleAdsStore.sendTestConversion()
                    showToast('Google Ads test dönüşüm sinyali (QualifiedLead + GCLID) oluşturuldu.')
                  }}
                  className="rounded-full px-3.5 text-xs font-semibold"
                >
                  Test Sinyali Gönder
                </GlassButton>
                <GlassButton
                  variant="gold"
                  size="sm"
                  icon={<Settings className="w-3.5 h-3.5" />}
                  onClick={() => setIsGoogleConfigOpen(true)}
                  className="rounded-full px-4 text-xs font-semibold"
                >
                  Yapılandır
                </GlassButton>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 rounded-2xl bg-[#34302d]/70 border border-[#4a443f] flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[#8c857f]">
                    Google Ads Webhook URL
                  </div>
                  <div className="text-xs font-mono text-white truncate mt-0.5">
                    {googleConfig.webhookUrl}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => copyText('g-url', googleConfig.webhookUrl)}
                  className="px-2.5 py-1.5 rounded-xl bg-[#282522] border border-[#4a443f] text-xs text-[#d6beae] hover:text-white flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  {copiedKey === 'g-url' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedKey === 'g-url' ? 'Kopyalandı' : 'Kopyala'}</span>
                </button>
              </div>

              <div className="p-3 rounded-2xl bg-[#34302d]/70 border border-[#4a443f] flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[#8c857f]">
                    Google Key (Doğrulama Anahtarı)
                  </div>
                  <div className="text-xs font-mono text-white truncate mt-0.5">
                    {googleConfig.webhookKey}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => copyText('g-key', googleConfig.webhookKey)}
                  className="px-2.5 py-1.5 rounded-xl bg-[#282522] border border-[#4a443f] text-xs text-[#d6beae] hover:text-white flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  {copiedKey === 'g-key' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedKey === 'g-key' ? 'Kopyalandı' : 'Kopyala'}</span>
                </button>
              </div>
            </div>
          </GlassCard>

          {/* Google Ads Çevrimdışı Dönüşüm Sinyalleri (Enhanced Conversions for Leads) */}
          <GlassCard className="p-5 bg-[#282522] border-[#4a443f] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#b99881]" />
                  <span>
                    Google Ads Gelişmiş Dönüşümler (Enhanced Conversions / GCLID) — CRM Kalite Sinyalleri
                  </span>
                </h3>
                <p className="text-xs text-[#a69f99] mt-0.5">
                  Google Ads üzerinden gelen adayların CRM'de Nitelikli, Teklif veya Satış aşamasına geçişlerinin GCLID ile Google Ads'e geri bildirimi.
                </p>
              </div>
              {googleLogs.some((l) => l.status === 'QUEUED') && googleConfig.conversionId && (
                <GlassButton
                  variant="subtle"
                  size="sm"
                  onClick={() => {
                    const c = googleAdsStore.flushQueuedConversions()
                    showToast(`${c} Google Ads dönüşüm sinyali gönderildi.`)
                  }}
                  className="rounded-full px-3.5 text-xs font-semibold"
                >
                  Kuyruktaki Sinyalleri Gönder
                </GlassButton>
              )}
            </div>

            {googleLogs.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#8c857f] border border-dashed border-[#4a443f] rounded-2xl">
                Henüz Google Ads'e gönderilmiş bir dönüşüm sinyali bulunmuyor. Google Ads kaynaklı bir müşterinin aşaması güncellendiğinde veya <strong>Test Sinyali Gönder</strong> butonuna tıklandığında burada listelenir.
              </div>
            ) : (
              <div className="divide-y divide-[#4a443f]/50 max-h-[220px] overflow-y-auto pr-1">
                {googleLogs.slice(0, 15).map((log) => (
                  <div
                    key={log.id}
                    className="py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                          log.conversionAction === 'QualifiedLead' ||
                          log.conversionAction === 'ConvertedLead'
                            ? 'bg-emerald-500/12 text-emerald-400 border-emerald-500/30'
                            : log.conversionAction === 'Disqualified'
                            ? 'bg-rose-500/12 text-rose-400 border-rose-500/30'
                            : 'bg-amber-500/12 text-amber-400 border-amber-500/30'
                        }`}
                      >
                        {log.conversionAction}
                      </span>
                      <span className="font-bold text-white truncate">{log.leadName}</span>
                      <span className="text-[#8c857f]">•</span>
                      <span className="text-[#d6beae] font-medium">{log.signalLabel}</span>
                      {log.gclid && (
                        <span className="text-[10px] font-mono text-[#8c857f] hidden sm:inline">
                          ({log.gclid})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[11px] text-[#8c857f] font-mono">
                        {new Date(log.sentAt).toLocaleTimeString('tr-TR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          log.status === 'SENT'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-amber-500/15 text-amber-300'
                        }`}
                      >
                        {log.status === 'SENT' ? "Google Ads'e İletildi" : 'Kuyrukta'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          {/* Google Ads Kampanya Kartları */}
          {googleCampaigns.length === 0 ? (
            <div className="py-16 text-center flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#4a443f]">
              <Search className="w-10 h-10 text-[#8c857f] mx-auto mb-3 opacity-40" />
              <h3 className="text-sm font-semibold text-white">
                Henüz tanımlanmış Google Ads kampanyası bulunmuyor
              </h3>
              <p className="text-xs text-[#8c857f] mt-1 max-w-md mx-auto">
                Üstteki <strong>Kampanya Ekle</strong>, <strong>Google CSV Yükle</strong> veya{' '}
                <strong>Google Webhook Simülasyonu</strong> butonlarıyla Google Arama, YouTube ve Performance Max kampanyalarınızı bağlayabilirsiniz.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {googleCampaigns.map((camp) => (
                <GlassCard
                  key={camp.id}
                  className="p-5 bg-[#282522] border-[#4a443f] space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/25 font-semibold">
                      {camp.campaignType}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <GlassBadge
                        size="sm"
                        variant={camp.status === 'ACTIVE' ? 'success' : 'default'}
                      >
                        {camp.status === 'ACTIVE' ? 'Aktif' : 'Duraklatıldı'}
                      </GlassBadge>
                      {camp.id.startsWith('gcamp-1') && (
                        <>
                          <button
                            type="button"
                            onClick={() => googleAdsStore.toggleCampaignStatus(camp.id)}
                            className="p-1 rounded-lg hover:bg-[#34302d] text-[#8c857f] hover:text-white cursor-pointer"
                            title={camp.status === 'ACTIVE' ? 'Duraklat' : 'Etkinleştir'}
                          >
                            {camp.status === 'ACTIVE' ? (
                              <Pause className="w-3.5 h-3.5" />
                            ) : (
                              <Play className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => googleAdsStore.deleteCampaign(camp.id)}
                            className="p-1 rounded-lg hover:bg-rose-500/15 text-[#8c857f] hover:text-rose-500 cursor-pointer"
                            title="Kampanyayı Sil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-white">{camp.name}</h3>
                    <p className="text-xs text-[#a69f99] mt-0.5">Form: {camp.formName}</p>
                  </div>

                  <div className="pt-1 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[#8c857f]">Toplam Lead:</span>
                      <span className="text-white font-bold ml-1.5">{camp.leadCount}</span>
                    </div>
                    <div>
                      <span className="text-[#8c857f]">Dönüşüm:</span>
                      <span className="text-emerald-400 font-bold ml-1.5">
                        %{camp.conversionRate}
                      </span>
                    </div>
                  </div>

                  <div className="text-[10px] text-[#8c857f]">
                    Son Aday:{' '}
                    {camp.lastLeadAt
                      ? new Date(camp.lastLeadAt).toLocaleString('tr-TR')
                      : 'Kayıt yok'}
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          4. WEB & DİJİTAL KANALLAR SEKMESİ (Web Sitesi, Portal & WhatsApp)
         ===================================================================== */}
      {activePlatform === 'web' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
              <div className="text-xs text-[#a69f99]">Toplam Web & Dijital Başvuru</div>
              <div className="text-2xl font-bold text-white mt-1">{webLeads.length}</div>
              <div className="text-[11px] text-[#8c857f] mt-1">
                Web İletişim Formları & WhatsApp Hattı
              </div>
            </GlassCard>

            <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
              <div className="text-xs text-emerald-400">Nitelikli Dönüşüm Oranı</div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">%{avgWebConversion}</div>
              <div className="text-[11px] text-[#8c857f] mt-1">
                {webConverted} onaylı nitelikli talep
              </div>
            </GlassCard>

            <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
              <div className="text-xs text-sky-400">Web Form & GTM Entegrasyonu</div>
              <div className="text-sm font-semibold text-white mt-2 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Canlı REST API Aktif</span>
              </div>
              <div className="text-[11px] text-[#8c857f] mt-1">
                Web sitesi iletişim ve proje talep formları otomatik düşer
              </div>
            </GlassCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <GlassCard className="p-5 bg-[#282522] border-[#4a443f] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 font-semibold flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" />
                  <span>Kurumsal Web Sitesi & Landing Page</span>
                </span>
                <GlassBadge size="sm" variant="success">
                  Aktif
                </GlassBadge>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  Web Sitesi Proje Bilgi & İletişim Formu
                </h3>
                <p className="text-xs text-[#a69f99] mt-0.5">
                  Kurumsal web sitesinden doldurulan bilgi alma ve katalog talepleri doğrudan CRM ve Talepler ekranına aktarılır.
                </p>
              </div>
              <div className="pt-1 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[#8c857f]">Toplam Başvuru:</span>
                  <span className="text-white font-bold ml-1.5">{webLeads.length}</span>
                </div>
                <div>
                  <span className="text-[#8c857f]">Dönüşüm:</span>
                  <span className="text-emerald-400 font-bold ml-1.5">%{avgWebConversion}</span>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="p-5 bg-[#282522] border-[#4a443f] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/25 font-semibold flex items-center gap-1.5">
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp Business & Dijital Portallar</span>
                </span>
                <GlassBadge size="sm" variant="success">
                  Aktif
                </GlassBadge>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  WhatsApp Tıkla-Yaz & İlan Portalları
                </h3>
                <p className="text-xs text-[#a69f99] mt-0.5">
                  Reklam ve web sayfasındaki WhatsApp butonlarından veya emlak portallarından gelen doğrudan müşteri adayları.
                </p>
              </div>
              <div className="pt-1 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[#8c857f]">Kanal Durumu:</span>
                  <span className="text-white font-bold ml-1.5">Otomatik Kayıt & Eşleştirme</span>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODALS (Meta Simulate, Google Simulate, Google Config, Add Google Camp)
         ===================================================================== */}
      <GlassModal
        isOpen={isSimulateOpen}
        onClose={() => setIsSimulateOpen(false)}
        title="Canlı Meta Lead Ads Webhook Simülasyonu: Yeni Aday"
      >
        <form onSubmit={handleSimulateSubmit} className="space-y-4">
          <p className="text-xs text-[#a69f99]">
            Instagram veya Facebook reklam formu üzerinden bir kullanıcının formu doldurup gönderdiği senaryoyu simüle edin. Veri doğrudan müşteri havuzuna ve ilgili kampanyaya işlenir.
          </p>

          <div>
            <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
              Meta Reklam Formu *
            </label>
            <input
              type="text"
              required
              placeholder="Örn: Negatif X veya Lansman Formu"
              value={selectedFormName}
              onChange={(e) => setSelectedFormName(e.target.value)}
              className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Aday Adı Soyadı *
              </label>
              <input
                type="text"
                required
                placeholder="Örn: Selim Karadağ"
                value={newLeadName}
                onChange={(e) => setNewLeadName(e.target.value)}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Telefon Numarası *
              </label>
              <input
                type="text"
                required
                placeholder="+90 532 123 45 67"
                value={newLeadPhone}
                onChange={(e) => setNewLeadPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                İlgilendiği Konut Tipi
              </label>
              <select
                value={housingType}
                onChange={(e) => setHousingType(e.target.value)}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              >
                <option value="1+1 Rezidans">1+1 Rezidans</option>
                <option value="2+1 Rezidans">2+1 Rezidans</option>
                <option value="3+1 Aile Dairesi">3+1 Aile Dairesi</option>
                <option value="Müstakil Villa">Müstakil Villa</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Tahmini Bütçe (TL)
              </label>
              <input
                type="number"
                value={leadBudget}
                onChange={(e) => setLeadBudget(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1 border-t border-[#4a443f]/40">
            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Form Sorusu: Alım Amacı
              </label>
              <select
                value={investmentPurpose}
                onChange={(e) => setInvestmentPurpose(e.target.value)}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              >
                <option value="Yatırım & Kira Getirisi">Yatırım & Kira Getirisi</option>
                <option value="Kendi Oturumum İçin">Kendi Oturumum İçin</option>
                <option value="Çocuklarım İçin Geleceğe Yatırım">
                  Çocuklarım İçin Geleceğe Yatırım
                </option>
                <option value="Ticari / Ofis Kullanımı">Ticari / Ofis Kullanımı</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Form Sorusu: Satın Alma Süresi
              </label>
              <select
                value={moveInTiming}
                onChange={(e) => setMoveInTiming(e.target.value)}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              >
                <option value="Hemen (1-3 Ay İçinde)">Hemen (1-3 Ay İçinde)</option>
                <option value="3 - 6 Ay İçinde">3 - 6 Ay İçinde</option>
                <option value="6 - 12 Ay (Proje Teslimine Kadar)">
                  6 - 12 Ay (Proje Teslimine Kadar)
                </option>
                <option value="Sadece Piyasa Araştırması">Sadece Piyasa Araştırması</option>
              </select>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsSimulateOpen(false)}
              className="px-4 py-2 rounded-full text-xs text-[#a69f99] hover:text-white cursor-pointer"
            >
              İptal
            </button>
            <GlassButton
              type="submit"
              variant="gold"
              size="sm"
              className="rounded-full px-5 font-bold"
            >
              Webhook Gönder
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      {/* GOOGLE ADS WEBHOOK SIMULATE MODAL */}
      <GlassModal
        isOpen={isGoogleSimulateOpen}
        onClose={() => setIsGoogleSimulateOpen(false)}
        title="Google Ads Potansiyel Müşteri Formu: Webhook Simülasyonu"
      >
        <form onSubmit={handleGoogleSimulateSubmit} className="space-y-4">
          <p className="text-xs text-[#a69f99]">
            Google Arama, YouTube veya Performance Max reklamındaki potansiyel müşteri formunun doldurulduğu senaryoyu simüle edin. Aday, GCLID tıklama kimliği ve arama kelimesiyle CRM'e kaydedilir.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Google Kampanya / Form Adı *
              </label>
              <input
                type="text"
                required
                value={gFormName}
                onChange={(e) => setGFormName(e.target.value)}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Kampanya Türü
              </label>
              <select
                value={gCampaignType}
                onChange={(e) =>
                  setGCampaignType(e.target.value as GoogleCampaignItem['campaignType'])
                }
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              >
                <option value="Arama Ağı (Search)">Arama Ağı (Search)</option>
                <option value="Performance Max">Performance Max</option>
                <option value="YouTube Lead Form">YouTube Lead Form</option>
                <option value="Display & Keşfet">Display & Keşfet</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Aday Adı Soyadı *
              </label>
              <input
                type="text"
                required
                placeholder="Örn: Hakan Çelik"
                value={gLeadName}
                onChange={(e) => setGLeadName(e.target.value)}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Telefon Numarası *
              </label>
              <input
                type="text"
                required
                placeholder="+90 532 123 45 67"
                value={gLeadPhone}
                onChange={(e) => setGLeadPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Arama Anahtar Kelimesi (Keyword)
              </label>
              <input
                type="text"
                placeholder="Örn: satılık 2+1 daire"
                value={gKeyword}
                onChange={(e) => setGKeyword(e.target.value)}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                İlgilendiği Konut Tipi
              </label>
              <select
                value={gHousingType}
                onChange={(e) => setGHousingType(e.target.value)}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              >
                <option value="1+1 Rezidans">1+1 Rezidans</option>
                <option value="2+1 Rezidans">2+1 Rezidans</option>
                <option value="3+1 Aile Dairesi">3+1 Aile Dairesi</option>
                <option value="Müstakil Villa">Müstakil Villa</option>
              </select>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsGoogleSimulateOpen(false)}
              className="px-4 py-2 rounded-full text-xs text-[#a69f99] hover:text-white cursor-pointer"
            >
              İptal
            </button>
            <GlassButton
              type="submit"
              variant="gold"
              size="sm"
              className="rounded-full px-5 font-bold"
            >
              Google Lead Gönder
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      {/* GOOGLE ADS CRM CONNECTION & OCI CONFIG MODAL */}
      <GlassModal
        isOpen={isGoogleConfigOpen}
        onClose={() => setIsGoogleConfigOpen(false)}
        title="Google Ads CRM Bağlantısı: Webhook & Dönüşüm Ayarları"
      >
        <form onSubmit={handleSaveGoogleConfig} className="space-y-4">
          <p className="text-xs text-[#a69f99]">
            Google Ads hesabınızı CRM'e bağlayarak hem Potansiyel Müşteri Formu Uzantılarından gelen verileri otomatik alabilir hem de GCLID ile Çevrimdışı Dönüşüm (Offline Conversion Import) gönderebilirsiniz.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Google Ads Müşteri ID (Customer ID)
              </label>
              <input
                type="text"
                placeholder="Örn: 482-910-3321"
                value={cfgCustomerId}
                onChange={(e) => setCfgCustomerId(e.target.value)}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Dönüşüm Kimliği (Conversion ID)
              </label>
              <input
                type="text"
                placeholder="Örn: AW-114829103"
                value={cfgConversionId}
                onChange={(e) => setCfgConversionId(e.target.value)}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Dönüşüm Etiketi (Conversion Label)
              </label>
              <input
                type="text"
                placeholder="Örn: Kx82Cj91L0aE"
                value={cfgConversionLabel}
                onChange={(e) => setCfgConversionLabel(e.target.value)}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Webhook Google Key (Güvenlik Anahtarı)
              </label>
              <input
                type="text"
                value={cfgWebhookKey}
                onChange={(e) => setCfgWebhookKey(e.target.value)}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white font-mono focus:outline-none focus:border-[#b99881]"
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={cfgAutoSync}
              onChange={(e) => setCfgAutoSync(e.target.checked)}
              className="rounded border-[#4a443f]"
            />
            <span className="text-xs text-[#d6beae]">
              Müşteri aşaması değiştiğinde (Nitelikli / Teklif / Satış) Google Ads'e otomatik dönüşüm sinyali gönder
            </span>
          </label>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsGoogleConfigOpen(false)}
              className="px-4 py-2 rounded-full text-xs text-[#a69f99] hover:text-white cursor-pointer"
            >
              İptal
            </button>
            <GlassButton
              type="submit"
              variant="gold"
              size="sm"
              className="rounded-full px-5 font-bold"
            >
              Kaydet
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      {/* ADD GOOGLE CAMPAIGN MODAL */}
      <GlassModal
        isOpen={isAddGoogleCampOpen}
        onClose={() => setIsAddGoogleCampOpen(false)}
        title="Yeni Google Ads Kampanyası Tanımla"
      >
        <form onSubmit={handleAddGoogleCampaign} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
              Kampanya Adı *
            </label>
            <input
              type="text"
              required
              placeholder="Örn: Google Arama - Lüks Konut Yatırımı"
              value={newGCampName}
              onChange={(e) => setNewGCampName(e.target.value)}
              className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
              Kampanya Türü
            </label>
            <select
              value={newGCampType}
              onChange={(e) =>
                setNewGCampType(e.target.value as GoogleCampaignItem['campaignType'])
              }
              className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
            >
              <option value="Arama Ağı (Search)">Arama Ağı (Search)</option>
              <option value="Performance Max">Performance Max</option>
              <option value="YouTube Lead Form">YouTube Lead Form</option>
              <option value="Display & Keşfet">Display & Keşfet</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
              Potansiyel Müşteri Formu Uzantısı Adı
            </label>
            <input
              type="text"
              placeholder="Örn: Arama Ağı Bilgi Formu"
              value={newGCampFormName}
              onChange={(e) => setNewGCampFormName(e.target.value)}
              className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddGoogleCampOpen(false)}
              className="px-4 py-2 rounded-full text-xs text-[#a69f99] hover:text-white cursor-pointer"
            >
              İptal
            </button>
            <GlassButton
              type="submit"
              variant="gold"
              size="sm"
              className="rounded-full px-5 font-bold"
            >
              Kampanya Oluştur
            </GlassButton>
          </div>
        </form>
      </GlassModal>
    </div>
  )
}
