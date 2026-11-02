import {
  Department,
  DEPARTMENT_MENU_CONFIG,
  NavPageId,
} from '@/types/department'
import { STAGE_CONFIGS, CALL_STATUS_OPTIONS, isLeadHandedOverToSales } from '@/types/lead'
import { AppUser, userStore } from '@/services/userStore'
import { leadStore } from '@/services/leadStore'
import { projectStore } from '@/services/projectStore'
import { creativeStore } from '@/services/creativeStore'
import { appointmentStore } from '@/services/appointmentStore'
import { requestStore } from '@/services/requestStore'
import { accountingStore } from '@/services/accountingStore'
import { approvalStore } from '@/services/approvalStore'
import { sharedFileStore } from '@/services/sharedFileStore'
import {
  teamOperationsStore,
  getPresenceMeta,
} from '@/services/teamOperationsStore'
import { metaStore } from '@/services/metaStore'
import { googleAdsStore } from '@/services/googleAdsStore'
import { formatCurrency } from '@/utils/formatters'

export interface SearchActionPayload {
  pageId: NavPageId
  leadId?: string
  projectId?: string
  unitId?: string
  creativeId?: string
  scheduleDate?: string
  subTab?: 'presence' | 'assets' | 'leaves'
  platformTab?: 'all' | 'meta' | 'google' | 'web'
  stageFilter?: string
  sectionQuery?: string
}

export interface SearchResultItem {
  id: string
  pageId: NavPageId
  pageLabel: string
  title: string
  subtitle: string
  badge?: string
  keywords: string
  isRecord?: boolean
  score: number
  payload: SearchActionPayload
}

export interface SearchPageGroup {
  pageId: NavPageId
  pageLabel: string
  items: SearchResultItem[]
  maxScore: number
}

export interface DepartmentSearchResponse {
  topResults: SearchResultItem[]
  pageGroups: SearchPageGroup[]
  totalCount: number
}

const BRAND_KIT_STORAGE_KEY = 'demirturk_brand_kit_v1'

const DEFAULT_BRAND_KIT_SNAPSHOT = {
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
    },
    {
      id: 'f2',
      title: 'Instagram & Meta Ads Dikey Post / Karusel',
      ratio: '4:5',
      resolution: '1080 × 1350 px',
      safeZone: 'Akışta en yüksek ekran kaplama oranı sağlayan ana reklam formatı',
    },
    {
      id: 'f3',
      title: 'Kare Kurumsal & Özel Gün Postu',
      ratio: '1:1',
      resolution: '1080 × 1080 px',
      safeZone: 'Köşelerden 90px iç boşluk (margin) ve sağ altta kurumsal logo',
    },
    {
      id: 'f4',
      title: 'Web Hero, YouTube & 3D Render Sunum',
      ratio: '16:9',
      resolution: '3840 × 2160 px (4K)',
      safeZone: 'demirturkinsaat.com proje sayfası ve TV sunum ekranları için',
    },
  ],
}

function getBrandKitSnapshot() {
  try {
    const raw = localStorage.getItem(BRAND_KIT_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        colors:
          Array.isArray(parsed.colors) && parsed.colors.length > 0
            ? parsed.colors
            : DEFAULT_BRAND_KIT_SNAPSHOT.colors,
        typography: {
          ...DEFAULT_BRAND_KIT_SNAPSHOT.typography,
          ...(parsed.typography || {}),
        },
        logo: {
          ...DEFAULT_BRAND_KIT_SNAPSHOT.logo,
          ...(parsed.logo || {}),
        },
        formats:
          Array.isArray(parsed.formats) && parsed.formats.length > 0
            ? parsed.formats
            : DEFAULT_BRAND_KIT_SNAPSHOT.formats,
      }
    }
  } catch {}
  return DEFAULT_BRAND_KIT_SNAPSHOT
}

export function normalizeTr(input: string): string {
  if (!input) return ''
  return input
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/â/g, 'a')
    .replace(/î/g, 'i')
    .replace(/û/g, 'u')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildPageCandidates(
  pageId: NavPageId,
  pageLabel: string,
  activeDept: Department,
  currentUser: AppUser | null
): Omit<SearchResultItem, 'score'>[] {
  const results: Omit<SearchResultItem, 'score'>[] = []
  const leads = leadStore.getAll(currentUser)
  const projects = projectStore.getAll()
  const appointments = appointmentStore.getAll(currentUser)
  const requests = requestStore.getAll()
  const collections = accountingStore.getCollections()
  const payments = accountingStore.getPayments()
  const approvals = approvalStore.getAll()

  const add = (
    id: string,
    title: string,
    subtitle: string,
    keywords: string,
    badge?: string,
    isRecord = false,
    extraPayload?: Partial<SearchActionPayload>
  ) => {
    results.push({
      id: `${pageId}:${id}`,
      pageId,
      pageLabel,
      title,
      subtitle,
      badge,
      keywords: `${title} ${subtitle} ${badge || ''} ${keywords} ${pageLabel}`,
      isRecord,
      payload: {
        pageId,
        sectionQuery: title,
        ...extraPayload,
      },
    })
  }

  // ---------------------------------------------------------------------------
  // 1. BAŞLANGIÇ (dashboard)
  // ---------------------------------------------------------------------------
  if (pageId === 'dashboard') {
    if (activeDept === 'Pazarlama') {
      const metaLeadsCount = leads.filter((l) => l.source === 'META_ADS').length
      const qualifiedCount = leads.filter((l) => l.stage === 'QUALIFIED' || l.stage === 'WON').length
      add(
        'kpi-pool',
        'Toplam Aday Havuzu',
        `Aktif veri tabanı • ${leads.length} kayıtlı müşteri adayı`,
        'başlangıç kpi aday havuzu toplam müşteri lead',
        `${leads.length} Aday`
      )
      add(
        'kpi-meta',
        'Meta Ads Leadleri',
        `Instagram & Facebook reklamlarından gelen ${metaLeadsCount} başvuru`,
        'meta ads instagram facebook reklam lead başvuru',
        `${metaLeadsCount} Lead`
      )
      add(
        'kpi-qualified',
        'Nitelikli Aday Oranı',
        `Doğrulanmış potansiyel alıcılar • ${qualifiedCount} nitelikli aday`,
        'nitelikli aday oranı dönüşüm onaylı',
        `${qualifiedCount} Nitelikli`
      )
      add(
        'kpi-webhook',
        'Meta Entegrasyon — Webhook Canlı',
        'Graph API v19.0 bağlantısı ve gerçek zamanlı form akışı',
        'meta entegrasyon webhook canlı graph api pixel',
        'Canlı'
      )
      add(
        'chart-flow',
        'Aday Başvuru ve Etkileşim Akışı',
        'Günlük gelen müşteri adayı hacmi ve nitelikli dönüşüm eğrisi (Son 7 Gün / 30 Gün / Bu Ay)',
        'grafik aday başvuru etkileşim akışı günlük ortalama dönemlik',
        'Analitik Grafik'
      )
      add(
        'card-funnel',
        'Dönüşüm Hunisi (Sales Funnel)',
        'Toplam Başvuru, İletişime Geçilen, Nitelikli Aday, Sunum & Teklif, Kazanılan Satış oranları',
        'dönüşüm hunisi sales funnel aşama bazlı akış net dönüşüm oranı',
        'Huni Analizi'
      )
      add(
        'card-recent-leads',
        'Son Müşteri Başvuruları',
        'Reklam formları ve manuel kanallardan sisteme düşen son adaylar',
        'son müşteri başvuruları yeni nitelikli tümü',
        `${leads.length} Kayıt`
      )
      add(
        'card-meta-forms',
        'Aktif Meta Formları',
        'Reklam kampanyalarına bağlı veri toplama formları özeti',
        'aktif meta formları kampanya reklam form',
        `${metaStore.getForms().length} Form`
      )
    } else if (activeDept === 'Kreatif') {
      const schedule = creativeStore.getSchedule()
      const creatives = creativeStore.getCreatives()
      const comments = creativeStore.getComments()
      add(
        'kpi-upcoming-days',
        'Yaklaşan Özel Günler Çizelgesi Hızlı Bakışı',
        'Resmi bayramlar, anma günleri ve kampanya takvimi hazırlık durumu',
        'yaklaşan özel günler çizelge bayram takvim hazırlık',
        `${schedule.length} Plan`
      )
      add(
        'kpi-active-creatives',
        'Kreatifler Hızlı Bakışı',
        'Son üretilen reklam kreatifleri, Reels, Story, Karusel, 3D Render ve onay durumları',
        'aktif kreatifler hızlı bakışı reels story karusel render tasarım',
        `${creatives.length} Kreatif`
      )
      add(
        'kpi-creative-comments',
        'Kreatif Yorumları & Hızlı Geri Bildirim',
        'Tasarımlar ve videolar için iletilen son revize notları, yorumlar ve onaylar',
        'kreatif yorumları revize onay geri bildirim notlar',
        `${comments.length} Yorum`
      )
      add(
        'kpi-approved-creatives',
        'Onaylı & Yayında Kreatifler',
        'Meta Ads ve Sosyal Medya kanallarında aktif yayında olan tasarımlar',
        'onaylı yayında kreatifler meta ads sosyal medya',
        'Aktif'
      )
    } else if (activeDept === 'Satış') {
      const hotOffers = leads.filter((l) => l.stage === 'OFFER' || l.stage === 'PRESENTATION')
      const allUnits = projects.flatMap((p) => p.units || [])
      const reservedUnits = allUnits.filter((u) => u.status === 'REZERVE')
      add(
        'kpi-my-leads',
        'Portföyümdeki Müşteriler',
        'Atanan aktif müşteri portföyü ve satış takibi',
        'portföyümdeki müşteriler satış danışman atanan',
        `${leads.length} Müşteri`
      )
      add(
        'kpi-today-apts',
        'Bugünkü ve Yaklaşan Randevular',
        'Müşteri görüşmeleri, proje sunumları ve şantiye ziyaretleri',
        'bugünkü yaklaşan randevular görüşme sunum',
        `${appointments.length} Randevu`
      )
      add(
        'kpi-hot-offers',
        'Sıcak Teklifler (Sunum & Teklif Aşaması)',
        'Sunum yapılmış ve fiyat teklifi aşamasındaki müşteriler',
        'sıcak teklifler sunum pazarlık opsiyon',
        `${hotOffers.length} Teklif`
      )
      add(
        'kpi-reserved-units',
        'Rezerve Daireler (Opsiyonlu Üniteler)',
        'Projelerde müşteriler adına rezerve edilen daire ve villalar',
        'rezerve daireler opsiyonlu ünite konut',
        `${reservedUnits.length} Ünite`
      )
      add(
        'chart-flow',
        'Aday Başvuru ve Etkileşim Akışı',
        'Günlük gelen müşteri adayı hacmi ve nitelikli dönüşüm eğrisi',
        'grafik aday başvuru etkileşim akışı',
        'Analitik Grafik'
      )
      add(
        'card-funnel',
        'Dönüşüm Hunisi (Sales Funnel)',
        'Adayların ilk başvurudan satışa ilerleme oranı',
        'dönüşüm hunisi sales funnel aşama bazlı akış',
        'Huni Analizi'
      )
    } else if (activeDept === 'Müşteri İlişkileri') {
      const openReqs = requests.filter((r) => r.status === 'Açık' || r.status === 'İşlemde')
      add(
        'kpi-uncontacted',
        'İletişim Bekleyenler (İlk Arama Bekleyen)',
        'Henüz aranmamış yeni müşteri başvuruları',
        'iletişim bekleyenler ilk arama yeni başvuru',
        'Çağrı Merkezi'
      )
      add(
        'kpi-qualified-crm',
        'Nitelikli Belirlenenler (Satışa Devredilecek)',
        'Araması tamamlanıp satış ekibine yönlendirilecek adaylar',
        'nitelikli belirlenenler satışa devir onaylı',
        'Nitelikli'
      )
      add(
        'kpi-open-requests',
        'Açık Müşteri Talepleri',
        'Çözüm bekleyen müşteri bilgi ve destek talepleri',
        'açık talepler müşteri destek talep',
        `${openReqs.length} Açık`
      )
      add(
        'kpi-organized-apts',
        'Organize Edilen Randevular',
        'Satış ekibine yönlendirilen müşteri görüşmeleri',
        'organize randevular satış yönlendirme',
        `${appointments.length} Randevu`
      )
      add(
        'chart-flow',
        'Aday Başvuru ve Etkileşim Akışı',
        'Günlük gelen müşteri adayı hacmi ve nitelikli dönüşüm eğrisi',
        'grafik aday başvuru etkileşim akışı',
        'Analitik Grafik'
      )
      add(
        'card-funnel',
        'Dönüşüm Hunisi',
        'Adayların ilk başvurudan satışa ilerleme oranı',
        'dönüşüm hunisi aşama bazlı akış',
        'Huni Analizi'
      )
    } else if (activeDept === 'Muhasebe') {
      const collectedTotal = collections
        .filter((c) => c.status === 'COLLECTED')
        .reduce((acc, c) => acc + c.amount, 0)
      add(
        'kpi-collected',
        'Tahsil Edilen Tutar (Kasaya Giren Nakit)',
        `Tamamlanan tahsilatların toplamı: ${formatCurrency(collectedTotal)}`,
        'tahsil edilen tutar kasa nakit giriş',
        formatCurrency(collectedTotal)
      )
      add(
        'kpi-pending-col',
        'Bekleyen & Vadesi Gelen Tahsilatlar',
        'Sözleşmeli peşinat, kapora ve ara ödeme taksitleri',
        'bekleyen tahsilatlar vadesi gelen alacak',
        `${collections.length} İşlem`
      )
      add(
        'kpi-overdue-col',
        'Geciken Tahsilat İşlemleri',
        'Vadesi geçmiş ve takip gerektiren müşteri ödemeleri',
        'geciken tahsilat vade takip',
        'Vade Takibi'
      )
      add(
        'kpi-planned-pay',
        'Planlanan Şantiye & Komisyon Ödemeleri',
        'Yaklaşan tedarikçi, şantiye hakediş ve satış primi ödemeleri',
        'planlanan ödemeler şantiye komisyon gider',
        `${payments.length} Ödeme`
      )
    } else if (activeDept === 'Yönetim') {
      const pendingApprovals = approvals.filter((a) => a.status === 'BEKLEMEDE')
      add(
        'kpi-exec-volume',
        'Toplam Satış Hacmi (Sözleşme Cirosu)',
        'Tamamlanan daire ve villa satış sözleşmeleri toplamı',
        'toplam satış hacmi ciro sözleşme yönetim',
        'Konsolide Ciro'
      )
      add(
        'kpi-exec-approvals',
        'Bekleyen Yönetici Onayları',
        'İskonto, kapora iadesi ve rezervasyon uzatma talepleri',
        'bekleyen onaylar iskonto kapora rezervasyon',
        `${pendingApprovals.length} Bekleyen`
      )
      add(
        'kpi-exec-inventory',
        'Proje Envanteri & Bağımsız Bölümler',
        `${projects.length} aktif proje ve tüm daire/villa stok durumu`,
        'proje envanteri bağımsız bölüm stok daire',
        `${projects.length} Proje`
      )
      add(
        'kpi-exec-status',
        'Sistem Durumu — 6 Departman Aktif',
        'Departman bazlı yetki modeli ve bulut senkronizasyonu devrede',
        'sistem durumu 6 departman aktif yetki modeli',
        'Aktif'
      )
      add(
        'chart-flow',
        'Aday Başvuru ve Etkileşim Akışı',
        'Günlük gelen müşteri adayı hacmi ve nitelikli dönüşüm eğrisi',
        'grafik aday başvuru etkileşim akışı',
        'Analitik Grafik'
      )
      add(
        'card-funnel',
        'Dönüşüm Hunisi',
        'Adayların ilk başvurudan satışa ilerleme oranı',
        'dönüşüm hunisi aşama bazlı akış',
        'Huni Analizi'
      )
    }
  }

  // ---------------------------------------------------------------------------
  // 2. MÜŞTERİLER / SATIŞ (portfolio, customers, crm)
  // ---------------------------------------------------------------------------
  if (pageId === 'portfolio' || pageId === 'customers' || pageId === 'crm') {
    const pageLeads = pageId === 'crm' ? leads.filter((l) => isLeadHandedOverToSales(l)) : leads
    add(
      'sec-all-customers',
      `${pageLabel} — Müşteri Portföyü & Aday Yönetimi`,
      `Toplam ${pageLeads.length} müşteri kaydı, aşama filtreleri, arama ve hızlı WhatsApp/çağrı aksiyonları`,
      'müşteriler adaylar satış kanban tablo liste yeni müşteri ekle filtre',
      `${pageLeads.length} Kayıt`
    )
    add(
      'sec-stage-new',
      'Potansiyel Müşteriler (Yeni Başvuru)',
      'Sisteme yeni düşen ve ilk değerlendirme bekleyen adaylar',
      'potansiyel müşteri yeni başvuru new lead',
      'Aşama Filtresi',
      false,
      { stageFilter: 'NEW' }
    )
    add(
      'sec-stage-call-again',
      'Tekrar Aranacak Müşteriler',
      'Geri dönüş planlanan ve tekrar aranacak müşteri listesi',
      'tekrar aranacak geri arama call again',
      'Çağrı Durumu',
      false,
      { stageFilter: 'CALL_AGAIN' }
    )
    add(
      'sec-stage-qualified',
      'Nitelikli Müşteriler',
      'Satın alma niyeti doğrulanmış nitelikli potansiyel alıcılar',
      'nitelikli adaylar qualified onaylı',
      'Aşama Filtresi',
      false,
      { stageFilter: 'QUALIFIED' }
    )
    add(
      'sec-stage-offer',
      'Teklif & Sunum Aşamasındaki Müşteriler',
      'Proje sunumu yapılmış ve fiyat teklifi iletilmiş adaylar',
      'teklif sunum randevu pazarlık offer',
      'Aşama Filtresi',
      false,
      { stageFilter: 'OFFER' }
    )
    add(
      'sec-stage-won',
      'Dönüşüm (Satış Tamamlanan Müşteriler)',
      'Sözleşmesi tamamlanan ve daire satışı gerçekleşen müşteriler',
      'dönüşüm satış tamamlandı kazanılan won purchase',
      'Aşama Filtresi',
      false,
      { stageFilter: 'WON' }
    )

    for (const lead of pageLeads) {
      const stageLabel = STAGE_CONFIGS[lead.stage]?.label || lead.stage
      const callOpt = CALL_STATUS_OPTIONS.find((c) => c.id === lead.callStatus)
      const callLabel = callOpt ? callOpt.label : lead.callStatus || ''
      add(
        `lead-${lead.id}`,
        lead.fullName,
        `${lead.phone} • ${lead.formName || lead.channel || 'Doğrudan'} ${
          lead.preferredHousingType ? `• ${lead.preferredHousingType}` : ''
        } ${lead.owner ? `• Danışman: ${lead.owner}` : ''}`,
        `${lead.fullName} ${lead.phone} ${lead.email || ''} ${lead.formName} ${lead.source} ${stageLabel} ${callLabel} ${
          lead.preferredHousingType || ''
        } ${lead.notes || ''} ${(lead.tags || []).join(' ')}`,
        stageLabel,
        true,
        { leadId: lead.id }
      )
    }
  }

  // ---------------------------------------------------------------------------
  // 3. KAMPANYALAR (marketing-campaigns)
  // ---------------------------------------------------------------------------
  if (pageId === 'marketing-campaigns') {
    const metaForms = metaStore.getForms()
    const capiLogs = metaStore.getCapiLogs()
    const metaConfig = metaStore.getConfig()
    const googleCampaigns = googleAdsStore.getCampaigns()
    const googleLogs = googleAdsStore.getConversionLogs()

    add(
      'sec-meta-ads',
      'Meta Ads (Instagram & Facebook Lead Kampanyaları)',
      `${metaConfig.pageName} • Dataset ID: ${metaConfig.datasetId} • CAPI & Webhook Entegrasyonu`,
      'meta ads instagram facebook kampanya pixel dataset capi webhook veriyi gönder',
      'Meta Ads',
      false,
      { platformTab: 'meta' }
    )
    add(
      'sec-google-ads',
      'Google Ads (Arama Ağı, Performance Max & YouTube Formları)',
      'Google Ads lead form webhook bağlantısı ve çevrimdışı dönüşüm sinyalleri',
      'google ads arama ağı search performance max youtube kampanya gclid dönüşüm',
      'Google Ads',
      false,
      { platformTab: 'google' }
    )
    add(
      'sec-web-channels',
      'Web Sitesi & Dijital Başvuru Kanalları',
      'demirturkinsaat.com iletişim formları, WhatsApp hattı ve CSV toplu aktarım',
      'web sitesi dijital kanallar whatsapp form csv içe aktar',
      'Web & Dijital',
      false,
      { platformTab: 'web' }
    )

    for (const form of metaForms) {
      add(
        `meta-form-${form.id}`,
        form.name,
        `Kampanya: ${form.campaignName} • ${form.leadCount} Lead • %${form.conversionRate} Dönüşüm`,
        `meta form ${form.name} ${form.campaignName} instagram facebook reklam`,
        form.status === 'ACTIVE' ? 'Aktif Form' : 'Duraklatıldı',
        true,
        { platformTab: 'meta' }
      )
    }

    for (const gCamp of googleCampaigns) {
      add(
        `google-camp-${gCamp.id}`,
        gCamp.name,
        `${gCamp.campaignType} • Form: ${gCamp.formName} • ${gCamp.leadCount} Lead`,
        `google ads kampanya ${gCamp.name} ${gCamp.campaignType} ${gCamp.formName}`,
        gCamp.status === 'ACTIVE' ? 'Aktif' : 'Duraklatıldı',
        true,
        { platformTab: 'google' }
      )
    }

    for (const log of capiLogs.slice(0, 20)) {
      add(
        `capi-log-${log.id}`,
        `Meta CAPI: ${log.leadName} (${log.signalLabel})`,
        `Olay: ${log.eventName} • Aşama: ${log.stage} • Tel: ${log.phone}`,
        `meta capi sinyal log ${log.leadName} ${log.eventName} ${log.signalLabel} ${log.phone}`,
        log.status === 'SENT' ? 'Gönderildi' : 'Kuyrukta',
        true,
        { platformTab: 'meta' }
      )
    }

    for (const gLog of googleLogs.slice(0, 20)) {
      add(
        `google-log-${gLog.id}`,
        `Google Dönüşüm: ${gLog.leadName} (${gLog.signalLabel})`,
        `Aksiyon: ${gLog.conversionAction} • Aşama: ${gLog.stage}`,
        `google ads dönüşüm log ${gLog.leadName} ${gLog.conversionAction} ${gLog.signalLabel}`,
        gLog.status === 'SENT' ? 'Gönderildi' : 'Kuyrukta',
        true,
        { platformTab: 'google' }
      )
    }
  }

  // ---------------------------------------------------------------------------
  // 4. PAZARLAMA RAPORLARI (marketing-reports)
  // ---------------------------------------------------------------------------
  if (pageId === 'marketing-reports') {
    add(
      'rep-cpl',
      'Ortalama Lead Maliyeti (CPL) & Nitelikli Maliyeti (CPQL)',
      'Meta Ads edinim maliyetleri ve doğrulanmış potansiyel alıcı birim maliyeti',
      'ortalama lead maliyeti cpl nitelikli maliyeti cpql pazarlama raporları',
      'Maliyet Analizi'
    )
    add(
      'rep-channels',
      'Edinim Kanalları Dağılımı',
      'Instagram Lead Ads (%62), Facebook Lead Ads (%24), Web Sitesi & Doğrudan (%10), Müşteri Tavsiyesi Referral (%4)',
      'edinim kanalları dağılımı instagram facebook web sitesi doğrudan müşteri tavsiyesi referral oran bar',
      'Kanal Kırılımı'
    )
    add(
      'rep-housing',
      'Müşteri İlgisi / Konut Tipleri Tercihi',
      '2+1 Rezidans Daireler (%45), 1+1 Yatırımlık Konutlar (%28), Müstakil Villalar (%18), 3+1 Aile Daireleri (%9)',
      'müşteri ilgisi konut tipleri tercihi 2+1 rezidans 1+1 yatırımlık müstakil villa 3+1 daire',
      'Konut Tercihi'
    )
    add(
      'rep-export',
      'Pazarlama Analitik Raporunu Dışa Aktar',
      'Kampanya dönüşüm ve kanal performans raporunu PDF olarak indir',
      'raporu dışa aktar pdf indir pazarlama analitik',
      'PDF Rapor'
    )
  }

  // ---------------------------------------------------------------------------
  // 5. ÇİZELGE (creative-schedule)
  // ---------------------------------------------------------------------------
  if (pageId === 'creative-schedule') {
    const scheduleItems = creativeStore.getSchedule()
    add(
      'sch-overview',
      'Kreatif Çizelge — Özel Günler, Bayramlar & Kampanya Takvimi',
      `Takvim ve Liste görünümü • Toplam ${scheduleItems.length} planlanmış içerik ve özel gün`,
      'çizelge takvim görünümü liste görünümü resmi bayram özel gün kampanya lansman prodüksiyon çekim düzenli içerik',
      `${scheduleItems.length} Plan`
    )
    add(
      'sch-cat-bayram',
      'Resmi Bayramlar & Ulusal Anma Günleri',
      '29 Ekim, 10 Kasım, 23 Nisan, 19 Mayıs, 30 Ağustos kurumsal kutlama ve anma planları',
      'resmi bayram ulusal gün kutlama anma takvim',
      'Kategori'
    )
    add(
      'sch-cat-kampanya',
      'Kampanya & Lansman Çizelgesi',
      'Proje lansmanları, ödeme kampanyaları ve reklam çıkış tarihleri',
      'kampanya lansman reklam çıkış takvimi',
      'Kategori'
    )
    add(
      'sch-cat-cekim',
      'Prodüksiyon / Şantiye & Drone Çekim Planı',
      'Proje sahası fotoğraf, video ve Reels prodüksiyon günleri',
      'prodüksiyon çekim şantiye drone video fotoğraf',
      'Kategori'
    )

    const catLabels: Record<string, string> = {
      RESMI_BAYRAM: 'Resmi Bayram',
      OZEL_GUN: 'Özel Gün',
      KAMPANYA: 'Kampanya & Lansman',
      CEKIM: 'Prodüksiyon / Çekim',
      ICERIK: 'Düzenli İçerik',
    }
    const statusLabels: Record<string, string> = {
      PLANLANDI: 'Planlandı',
      TASARIMDA: 'Tasarımda',
      ONAY_BEKLIYOR: 'Onay Bekliyor',
      HAZIR: 'Yayına Hazır',
      YAYINLANDI: 'Yayınlandı',
    }

    for (const item of scheduleItems) {
      const catLabel = catLabels[item.category] || item.category
      const stLabel = statusLabels[item.status] || item.status
      add(
        `sch-item-${item.id}`,
        item.title,
        `${item.date} • ${catLabel} • Proje: ${item.project} • Sorumlu: ${item.assignedTo}`,
        `${item.title} ${item.date} ${catLabel} ${stLabel} ${item.project} ${item.assignedTo} ${(item.channels || []).join(' ')} ${item.notes || ''}`,
        stLabel,
        true,
        { scheduleDate: item.date }
      )
    }
  }

  // ---------------------------------------------------------------------------
  // 6. STÜDYO (creatives)
  // ---------------------------------------------------------------------------
  if (pageId === 'creatives') {
    const creatives = creativeStore.getCreatives()
    const comments = creativeStore.getComments()

    add(
      'crt-overview',
      'Kreatif Stüdyo — Tasarım, Video & Reklam Galerisi',
      `Reels, Story, Post, Karusel, 3D Render ve Katalog çalışmaları (${creatives.length} kreatif)`,
      'stüdyo kreatif galeri tasarım video reels story post karusel 3d render katalog broşür billboard yeni kreatif yükle',
      `${creatives.length} Kreatif`
    )

    const stLabels: Record<string, string> = {
      TASLAK: 'Taslak',
      INCELEMEDE: 'İncelemede',
      REVIZE: 'Revize Bekliyor',
      ONAYLANDI: 'Onaylandı',
      YAYINDA: 'Yayında',
    }

    for (const crt of creatives) {
      const stLabel = stLabels[crt.status] || crt.status
      add(
        `crt-item-${crt.id}`,
        `${crt.code} — ${crt.title}`,
        `${crt.project} • ${crt.format} (${crt.aspectRatio}) • ${crt.platform} • Tasarımcı: ${crt.designer}`,
        `${crt.code} ${crt.title} ${crt.project} ${crt.format} ${crt.platform} ${stLabel} ${crt.designer} ${crt.headline} ${crt.adCopy} ${crt.ctaText}`,
        stLabel,
        true,
        { creativeId: crt.id }
      )
    }

    for (const cm of comments) {
      add(
        `crt-cmt-${cm.id}`,
        `Yorum (${cm.creativeCode}): ${cm.content}`,
        `${cm.authorName} (${cm.authorDepartment}) • ${cm.creativeTitle}${cm.pinNote ? ` • 📍 ${cm.pinNote}` : ''}`,
        `yorum revize onay ${cm.creativeCode} ${cm.creativeTitle} ${cm.authorName} ${cm.content} ${cm.pinNote || ''}`,
        cm.type === 'REVIZE' ? 'Revize Notu' : cm.type === 'ONAY' ? 'Onay' : 'Yorum',
        true,
        { creativeId: cm.creativeId }
      )
    }
  }

  // ---------------------------------------------------------------------------
  // 7. BRIEF'LER (creative-briefs)
  // ---------------------------------------------------------------------------
  if (pageId === 'creative-briefs') {
    const briefs = creativeStore.getBriefs()
    add(
      'brf-overview',
      "Kreatif Brief'ler & Tasarım Talepleri",
      `Pazarlama, Satış ve Yönetim departmanlarından gelen briefler ve teslimat takibi (${briefs.length} brief)`,
      'briefler kreatif brief oluştur tasarım talebi hedef kitle ana mesaj teslimatlar',
      `${briefs.length} Brief`
    )

    const statusMap: Record<string, string> = {
      YENI_BRIEF: 'Yeni Brief',
      URETIMDE: 'Üretimde',
      TESLIM_EDILDI: 'Teslim Edildi',
    }

    for (const b of briefs) {
      const stLabel = statusMap[b.status] || b.status
      add(
        `brf-item-${b.id}`,
        b.title,
        `${b.project} • ${b.format} • Talep Eden: ${b.requestedBy} (${b.requesterDepartment}) • Teslim: ${b.deadline}`,
        `${b.title} ${b.project} ${b.format} ${b.priority} ${stLabel} ${b.requestedBy} ${b.targetAudience} ${b.keyMessage} ${b.deliverables} ${b.assignedDesigner}`,
        stLabel,
        true
      )
    }
  }

  // ---------------------------------------------------------------------------
  // 8. MARKA REHBERİ (brand-kit)
  // ---------------------------------------------------------------------------
  if (pageId === 'brand-kit') {
    const bk = getBrandKitSnapshot()

    add(
      'bk-colors-card',
      'Kurumsal Renk Paleti',
      bk.colors.map((c: any) => `${c.name} (${c.hex})`).join(' • '),
      `kurumsal renk paleti hex rgb renkler ${bk.colors.map((c: any) => `${c.name} ${c.hex} ${c.usage}`).join(' ')}`,
      `${bk.colors.length} Renk`
    )

    for (const c of bk.colors) {
      add(
        `bk-color-${c.id}`,
        `${c.name} (${c.hex})`,
        `RGB: ${c.rgb} • Kullanım: ${c.usage}`,
        `renk paleti ${c.name} ${c.hex} ${c.rgb} ${c.usage}`,
        c.hex,
        true
      )
    }

    add(
      'bk-typography-card',
      `Kurumsal Tipografi — ${bk.typography.headingFont} & ${bk.typography.bodyFont}`,
      `Başlıklar: ${bk.typography.headingFont} (${bk.typography.headingStyle}) • Gövde: ${bk.typography.bodyFont} (${bk.typography.bodyStyle})`,
      `kurumsal tipografi yazı tipi font başlıklar gövde metni ${bk.typography.headingFont} ${bk.typography.bodyFont} ${bk.typography.headingDesc} ${bk.typography.bodyDesc}`,
      'Tipografi',
      true
    )

    add(
      'bk-footer-rule',
      `${bk.typography.footerTitle}`,
      bk.typography.footerText,
      `kurumsal alt bilgi footer ${bk.typography.footerTitle} ${bk.typography.footerText}`,
      'Alt Bilgi',
      true
    )

    add(
      'bk-logo-card',
      `Kurumsal Logo Kullanımı — ${bk.logo.brandTitle} ${bk.logo.brandSubtitle}`,
      `Koyu ve Açık Zemin Logo Varyantları • ${bk.logo.clearSpaceRule} • ${bk.logo.formatsNote}`,
      `kurumsal logo kullanımı koyu zemin logosu açık zemin logosu şeffaf png svg vektörel pdf ${bk.logo.brandTitle} ${bk.logo.brandSubtitle} ${bk.logo.clearSpaceRule}`,
      'Logo Rehberi',
      true
    )

    add(
      'bk-formats-card',
      'Sosyal Medya & Reklam Format Ölçüleri (Güvenli Alanlar)',
      bk.formats.map((f: any) => `${f.title} (${f.ratio})`).join(' • '),
      `sosyal medya reklam format ölçüleri güvenli alan safe zone çözünürlük ${bk.formats.map((f: any) => `${f.title} ${f.ratio} ${f.resolution} ${f.safeZone}`).join(' ')}`,
      `${bk.formats.length} Format`
    )

    for (const f of bk.formats) {
      add(
        `bk-format-${f.id}`,
        `${f.title} (${f.ratio})`,
        `Çözünürlük: ${f.resolution} • Güvenli Alan: ${f.safeZone}`,
        `format ölçü ${f.title} ${f.ratio} ${f.resolution} ${f.safeZone}`,
        f.ratio,
        true
      )
    }
  }

  // ---------------------------------------------------------------------------
  // 9. RANDEVULAR / TAKİP VE RANDEVULAR (appointments, followups-appointments)
  // ---------------------------------------------------------------------------
  if (pageId === 'appointments' || pageId === 'followups-appointments') {
    add(
      'apt-overview',
      `${pageLabel} — Görüşme, Sunum & Şantiye Ziyareti Takvimi`,
      `Toplam ${appointments.length} randevu kaydı • Online, Satış Ofisi ve Şantiye görüşmeleri`,
      'randevular takip görüşme proje sunumu şantiye ziyareti satış ofisi online randevu planla',
      `${appointments.length} Randevu`
    )

    const typeLabels: Record<string, string> = {
      ONLINE: 'Online Görüşme',
      OFFICE: 'Satış Ofisi',
      ON_SITE: 'Şantiye / Proje Ziyareti',
    }
    const statusLabels: Record<string, string> = {
      SCHEDULED: 'Planlandı',
      COMPLETED: 'Tamamlandı',
      CANCELLED: 'İptal Edildi',
      NO_SHOW: 'Gelmedi',
    }

    for (const apt of appointments) {
      const tLabel = typeLabels[apt.type] || apt.type
      const sLabel = statusLabels[apt.status] || apt.status
      add(
        `apt-item-${apt.id}`,
        `${apt.customerName} — ${tLabel}`,
        `${apt.date} ${apt.time} • Konum: ${apt.location} • Danışman: ${apt.assignedToUserName}${
          apt.projectName ? ` • Proje: ${apt.projectName}` : ''
        }`,
        `randevu ${apt.customerName} ${apt.customerPhone} ${apt.date} ${apt.time} ${apt.location} ${tLabel} ${sLabel} ${apt.assignedToUserName} ${apt.projectName || ''} ${apt.notes || ''}`,
        sLabel,
        true,
        apt.leadId ? { leadId: apt.leadId } : undefined
      )
    }
  }

  // ---------------------------------------------------------------------------
  // 10. TALEPLER (requests)
  // ---------------------------------------------------------------------------
  if (pageId === 'requests') {
    add(
      'req-overview',
      'Müşteri Talepleri & Destek Merkezi',
      `Satış öncesi bilgi, proje & kat planı, ödeme planı ve satış sonrası destek talepleri (${requests.length} talep)`,
      'talepler müşteri destek satış öncesi bilgi proje kat planı ödeme finansman satış sonrası destek açık işlemde çözüldü',
      `${requests.length} Talep`
    )

    for (const req of requests) {
      add(
        `req-item-${req.id}`,
        `${req.subject} — ${req.customerName}`,
        `${req.category} • Öncelik: ${req.priority} • Sorumlu: ${req.assignedToUserName} • Tel: ${req.customerPhone}`,
        `talep ${req.subject} ${req.customerName} ${req.customerPhone} ${req.category} ${req.priority} ${req.status} ${req.assignedToUserName} ${req.notes || ''}`,
        req.status,
        true
      )
    }
  }

  // ---------------------------------------------------------------------------
  // 11. PERFORMANS (sales-performance)
  // ---------------------------------------------------------------------------
  if (pageId === 'sales-performance') {
    const allUnits = projects.flatMap((p) => p.units || [])
    const soldUnits = allUnits.filter((u) => u.status === 'SATILDI')
    const totalVolume = soldUnits.reduce((acc, u) => acc + (u.sale?.salePrice || u.price), 0)

    add(
      'sp-volume',
      'Gerçekleşen Ciro & Satış Hacmi',
      `${soldUnits.length} daire sözleşmesi • Toplam Hacim: ${formatCurrency(totalVolume)}`,
      'gerçekleşen ciro satış hacmi performans kota sözleşme',
      formatCurrency(totalVolume)
    )
    add(
      'sp-commission',
      'Tahakkuk Eden Satış Primi (%2 Danışman Primi)',
      `Toplam tahakkuk eden komisyon: ${formatCurrency(Math.round(totalVolume * 0.02))}`,
      'tahakkuk eden prim komisyon hakediş danışman primi yüzde 2',
      formatCurrency(Math.round(totalVolume * 0.02))
    )
    add(
      'sp-leaderboard',
      'Danışman Satış Sıralaması (Leaderboard)',
      'Satış kadrosu kota gerçekleşmesi, satılan ünite ve prim sıralaması',
      'danışman satış sıralaması leaderboard skor tablosu aktif danışman',
      'Skor Tablosu'
    )
  }

  // ---------------------------------------------------------------------------
  // 12. TAHSİLATLAR (collections)
  // ---------------------------------------------------------------------------
  if (pageId === 'collections') {
    add(
      'col-overview',
      'Tahsilatlar — Kapora, Peşinat & Taksit Yönetimi',
      `Toplam ${collections.length} tahsilat kaydı, makbuz kesimi ve kapora iade işlemleri`,
      'tahsilatlar kapora peşinat taksit ara ödeme tam ödeme makbuz dekont iade',
      `${collections.length} Kayıt`
    )

    const typeLabels: Record<string, string> = {
      DEPOSIT: 'Kapora / Ön Ödeme',
      DOWN_PAYMENT: 'Peşinat',
      INSTALLMENT: 'Ara Ödeme / Taksit',
      FULL_PAYMENT: 'Tam Ödeme',
    }
    const statusLabels: Record<string, string> = {
      COLLECTED: 'Tahsil Edildi',
      PENDING: 'Bekliyor',
      OVERDUE: 'Gecikmiş',
      REFUNDED: 'İade Edildi',
    }

    for (const col of collections) {
      const tLabel = typeLabels[col.type] || col.type
      const sLabel = statusLabels[col.status] || col.status
      add(
        `col-item-${col.id}`,
        `${col.customerName} — ${formatCurrency(col.amount)} (${tLabel})`,
        `${col.projectName} • Daire: ${col.unitNumber} • Vade: ${col.dueDate}${
          col.receiptNo ? ` • Makbuz: ${col.receiptNo}` : ''
        }`,
        `tahsilat ${col.customerName} ${col.projectName} ${col.unitNumber} ${tLabel} ${sLabel} ${col.amount} ${col.dueDate} ${col.receiptNo || ''} ${col.paymentMethod || ''} ${col.notes || ''}`,
        sLabel,
        true
      )
    }
  }

  // ---------------------------------------------------------------------------
  // 13. ÖDEMELER (payments)
  // ---------------------------------------------------------------------------
  if (pageId === 'payments') {
    add(
      'pay-overview',
      'Ödemeler & Kurumsal Gider Yönetimi',
      `Şantiye hakedişleri, satış komisyonları, reklam bütçesi ve ofis giderleri (${payments.length} kayıt)`,
      'ödemeler giderler şantiye inşaat komisyon pazarlama reklam ofis vergi fatura',
      `${payments.length} Ödeme`
    )

    const catLabels: Record<string, string> = {
      COMMISSION: 'Satış Komisyonu',
      CONSTRUCTION: 'Şantiye & İnşaat',
      MARKETING: 'Pazarlama & Reklam',
      OFFICE: 'Ofis & Genel Gider',
      TAX: 'Vergi & Harç',
    }
    const statusLabels: Record<string, string> = {
      PAID: 'Ödendi',
      PENDING: 'Bekliyor',
      OVERDUE: 'Gecikmiş',
    }

    for (const pay of payments) {
      const cLabel = catLabels[pay.category] || pay.category
      const sLabel = statusLabels[pay.status] || pay.status
      add(
        `pay-item-${pay.id}`,
        `${pay.title} — ${formatCurrency(pay.amount)}`,
        `Alıcı: ${pay.payee} • ${cLabel} • Vade: ${pay.dueDate}${
          pay.invoiceNo ? ` • Fatura: ${pay.invoiceNo}` : ''
        }`,
        `ödeme gider ${pay.title} ${pay.payee} ${cLabel} ${sLabel} ${pay.amount} ${pay.dueDate} ${pay.invoiceNo || ''} ${pay.notes || ''}`,
        sLabel,
        true
      )
    }
  }

  // ---------------------------------------------------------------------------
  // 14. FİNANSAL RAPORLAR (financial-reports)
  // ---------------------------------------------------------------------------
  if (pageId === 'financial-reports') {
    add(
      'fin-cashflow',
      'Net Nakit Akışı & Gerçekleşen Nakit Pozisyonu',
      'Kasaya giren toplam tahsilat girişi ve toplam gider çıkışı dengesi',
      'net nakit akışı gerçekleşen nakit pozisyonu tahsilat girişi gider çıkışı finansal raporlar',
      'Nakit Akışı'
    )
    add(
      'fin-receivables',
      'Bekleyen Vadeli Alacaklar & Öngörülen Borçlar',
      'Sözleşmeli peşinat/taksit alacakları ve yaklaşan şantiye/komisyon ödemeleri',
      'bekleyen vadeli alacaklar öngörülen borçlar giderler peşinat taksit hakediş',
      'Vade Dengesi'
    )
    add(
      'fin-expenses',
      'Gider Dağılım Kalemleri',
      'Şantiye ve İnşaat Hakedişleri (%68), Satış Başarı Komisyonları (%18), Meta & Dijital Reklam (%10), Ofis (%4)',
      'gider dağılım kalemleri şantiye inşaat hakediş satış komisyon meta reklam bütçesi ofis yönetim',
      'Gider Analizi'
    )
    add(
      'fin-export',
      'Mizan Tablosunu İndir (Excel)',
      'Finansal mizan ve nakit akış tablosunu dışa aktar',
      'mizan tablosunu indir excel finansal rapor dışa aktar',
      'Excel'
    )
  }

  // ---------------------------------------------------------------------------
  // 15. EKİP VE YETKİLER (team-permissions)
  // ---------------------------------------------------------------------------
  if (pageId === 'team-permissions') {
    const allUsers = userStore.getAllUsers()
    add(
      'tp-overview',
      'Ekip ve Yetkiler — Kullanıcı & Erişim Matrisi',
      `${allUsers.length} personel hesabı, departman atamaları, proje fiyat ve iskonto onay yetkileri`,
      'ekip ve yetkiler kullanıcı yönetimi yeni ekip üyesi ekle şifre rol erişim kapsamı yetki matrisi',
      `${allUsers.length} Üye`
    )

    for (const u of allUsers) {
      add(
        `tp-user-${u.id}`,
        `${u.fullName} (@${u.username})`,
        `Departman: ${(u.departments || [u.department]).join(', ')} • Rol: ${u.role} • Kapsam: ${u.scope}`,
        `ekip yetki personel ${u.fullName} ${u.username} ${u.department} ${(u.departments || []).join(' ')} ${u.role} ${u.email || ''}`,
        u.department,
        true
      )
    }
  }

  // ---------------------------------------------------------------------------
  // 16. YÖNETİCİ RAPORLARI (executive-reports)
  // ---------------------------------------------------------------------------
  if (pageId === 'executive-reports') {
    add(
      'exec-consolidated',
      'Yönetici Konsolide Raporları (5 Departman Özeti)',
      'Pazarlama, Müşteri İlişkileri, Satış, Muhasebe & Finans ve Genel Yönetim uçtan uca performans göstergeleri',
      'yönetici konsolide raporları ciro net nakit pozisyonu aday havuzu aktif proje portföyü yönetim raporu al pdf',
      'Konsolide Rapor'
    )
    add(
      'exec-dept-cards',
      'Departman Performans Kartları Özeti',
      '1. Pazarlama (Meta Lead), 2. Müşteri İlişkileri (Nitelikli Doğrulama), 3. Satış (Daire Satışı), 4. Muhasebe (Tahsilat)',
      'departman kartları özeti pazarlama müşteri ilişkileri satış ekibi muhasebe finans genel yönetim',
      'Departmanlar'
    )
  }

  // ---------------------------------------------------------------------------
  // 17. ONAYLAR (approvals)
  // ---------------------------------------------------------------------------
  if (pageId === 'approvals') {
    add(
      'app-overview',
      'Yönetici Onayları — İskonto, Kapora İadesi & Opsiyon Uzatma',
      `Toplam ${approvals.length} onay talebi (${approvals.filter((a) => a.status === 'BEKLEMEDE').length} beklemede)`,
      'yönetici onayları iskonto indirim kapora iadesi rezervasyon uzatma özel ödeme planı beklemede onaylandı reddedildi',
      `${approvals.length} Talep`
    )

    for (const app of approvals) {
      add(
        `app-item-${app.id}`,
        `${app.title} — ${app.customerName}`,
        `${app.type} • Proje: ${app.projectName} ${app.unitNumber ? `(${app.unitNumber})` : ''} • Talep Eden: ${app.requestedByUserName}`,
        `onay ${app.title} ${app.type} ${app.customerName} ${app.projectName} ${app.unitNumber || ''} ${app.reason} ${app.requestedByUserName} ${app.status}`,
        app.status === 'BEKLEMEDE'
          ? 'Beklemede'
          : app.status === 'ONAYLANDI'
          ? 'Onaylandı'
          : 'Reddedildi',
        true
      )
    }
  }

  // ---------------------------------------------------------------------------
  // 18. EKİPLER (teams)
  // ---------------------------------------------------------------------------
  if (pageId === 'teams') {
    const allUsers = userStore.getAllUsers()
    const assets = teamOperationsStore.getAssets()
    const leaves = teamOperationsStore.getLeaves()

    add(
      'teams-presence-board',
      'Arkadaşımı bul — Canlı Durum Panosu',
      `Ofiste, Gösterimde, Tapuda, Şantiyede, Toplantıda veya İzinli olan ${allUsers.length} ekip üyesi`,
      'ekipler arkadaşımı bul canlı durum panosu kim nerede ofiste dışarıda gösterimde sahada tapuda şantiyede molada izinli',
      'Durum Panosu',
      false,
      { subTab: 'presence' }
    )
    add(
      'teams-assets-board',
      'Araçlar ve anahtarlar — Zimmet Takibi',
      `Şirket araçları, örnek daire anahtarları ve saha ekipmanları (${assets.length} envanter)`,
      'şirket aracı portföy daire anahtarı ofis saha ekipmanı zimmet plaka teslim al',
      `${assets.length} Zimmet`,
      false,
      { subTab: 'assets' }
    )
    add(
      'teams-leaves-board',
      'İzinler — İzin & Saatlik Çıkış Takibi',
      `Saatlik çıkış, yıllık izin, mazeret izni ve sağlık raporu kayıtları (${leaves.length} kayıt)`,
      'izin talebi saatlik çıkış dış görev yıllık izin mazeret izni sağlık raporu',
      `${leaves.length} Kayıt`,
      false,
      { subTab: 'leaves' }
    )

    for (const u of allUsers) {
      const pres = teamOperationsStore.getUserPresence(u.id)
      const meta = getPresenceMeta(pres?.status)
      add(
        `team-member-${u.id}`,
        `${u.fullName} — ${meta.label}`,
        `${u.department} • @${u.username}${pres?.locationNote ? ` • Konum: ${pres.locationNote}` : ''}${
          pres?.returnTime ? ` • Dönüş: ${pres.returnTime}` : ''
        }`,
        `ekip personel ${u.fullName} ${u.username} ${u.department} ${meta.label} ${meta.shortLabel} ${pres?.locationNote || ''}`,
        meta.shortLabel,
        true,
        { subTab: 'presence' }
      )
    }

    for (const asset of assets) {
      add(
        `team-asset-${asset.id}`,
        `${asset.name} (${asset.codeOrPlate})`,
        asset.holderUserName
          ? `Kullanımda: ${asset.holderUserName}${asset.destinationNote ? ` • ${asset.destinationNote}` : ''}`
          : 'Ofiste Müsait — Teslim Alınabilir',
        `araç anahtar ekipman zimmet ${asset.name} ${asset.codeOrPlate} ${asset.category} ${asset.holderUserName || 'müsait'} ${asset.destinationNote || ''}`,
        asset.holderUserName ? `Zimmet: ${asset.holderUserName}` : 'Müsait',
        true,
        { subTab: 'assets' }
      )
    }

    for (const lv of leaves) {
      add(
        `team-leave-${lv.id}`,
        `${lv.userName} — ${lv.leaveType.replace('_', ' ')}`,
        `${lv.startDate} - ${lv.endDate} • ${lv.reason}`,
        `izin görev ${lv.userName} ${lv.userDepartment} ${lv.leaveType} ${lv.reason} ${lv.startDate}`,
        lv.status,
        true,
        { subTab: 'leaves' }
      )
    }
  }

  // ---------------------------------------------------------------------------
  // 19. PAYLAŞILANLAR (shared)
  // ---------------------------------------------------------------------------
  if (pageId === 'shared') {
    const files = sharedFileStore.getFilesForUser(currentUser)
    add(
      'shared-overview',
      'Paylaşılanlar — Kurumsal Bulut & Dosya Havuzu',
      `Yetkinize açık ${files.length} paylaşılan belge, katalog, fiyat listesi, görsel ve video`,
      'paylaşılanlar bulut dosya klasör yükle indir fotoğraf video belge pdf excel word katalog sözleşme',
      `${files.length} Dosya`
    )

    for (const f of files) {
      add(
        `shared-file-${f.id}`,
        f.name,
        `${f.type.toUpperCase()} • ${f.size} • Yükleyen: ${f.uploadedByUserName}${
          f.notes ? ` • ${f.notes}` : ''
        }`,
        `dosya belge paylaşılan ${f.name} ${f.type} ${f.notes || ''} ${f.folder || ''} ${f.uploadedByUserName}`,
        f.size,
        true
      )
    }
  }

  // ---------------------------------------------------------------------------
  // 20. PROJELER (projects)
  // ---------------------------------------------------------------------------
  if (pageId === 'projects') {
    const allUnits = projects.flatMap((p) => p.units || [])
    add(
      'proj-overview',
      'Projeler — Mimari Kat Planları (Kroki) & Daire Envanteri',
      `${projects.length} aktif proje ve toplam ${allUnits.length} bağımsız bölüm (Satışta, Rezerve, Satıldı)`,
      'projeler kat planı kroki daire villa envanter fiyat listesi yeni proje ekle',
      `${projects.length} Proje`
    )

    for (const proj of projects) {
      const units = proj.units || []
      const availableCount = units.filter((u) => u.status === 'SATISTA').length
      const reservedCount = units.filter((u) => u.status === 'REZERVE').length
      const soldCount = units.filter((u) => u.status === 'SATILDI').length

      add(
        `proj-item-${proj.id}`,
        `${proj.name} (${proj.code})`,
        `${proj.location} • ${units.length} Bağımsız Bölüm (${availableCount} Satışta, ${reservedCount} Rezerve, ${soldCount} Satıldı) • Teslim: ${proj.deliveryDate}`,
        `proje ${proj.name} ${proj.code} ${proj.location} ${proj.city} ${proj.district || ''} ${proj.mevki || ''} ${proj.type} ${proj.paymentBanner || ''} ${proj.parcelInfo || ''} ${proj.description || ''}`,
        proj.status === 'SATISTA' ? 'Satışta' : proj.status === 'TAMAMLANDI' ? 'Tamamlandı' : 'Yakında',
        true,
        { projectId: proj.id }
      )

      for (const unit of units) {
        const statusText =
          unit.statusLabel ||
          (unit.status === 'SATISTA'
            ? 'Satışta'
            : unit.status === 'REZERVE'
            ? 'Rezerve'
            : 'Satıldı')
        const customerInfo =
          unit.sale?.customerName
            ? ` • Alıcı: ${unit.sale.customerName}`
            : unit.reservation?.customerName
            ? ` • Rezerve: ${unit.reservation.customerName}`
            : ''
        const floorText = unit.floor === 0 ? 'Zemin Kat' : `${unit.floor}. Kat`

        add(
          `proj-unit-${proj.id}-${unit.id}`,
          `${proj.name} — Daire ${unit.unitNumber} (${unit.roomType})`,
          `${unit.block || 'A Blok'} • ${floorText} • ${unit.grossSqm} m² Brüt / ${unit.netSqm} m² Net${
            unit.facade ? ` • ${unit.facade}` : ''
          }${unit.price > 0 ? ` • ${formatCurrency(unit.price)}` : ''}${customerInfo}`,
          `${proj.name} daire ${unit.unitNumber} no ${unit.unitNumber} ${unit.roomType} ${unit.block || ''} ${floorText} ${statusText} ${unit.facade || ''} ${unit.description || ''} ${unit.sale?.customerName || ''} ${unit.reservation?.customerName || ''}`,
          statusText,
          true,
          { projectId: proj.id, unitId: unit.id }
        )
      }
    }
  }

  return results
}

function scoreCandidate(
  candidate: Omit<SearchResultItem, 'score'>,
  rawQuery: string,
  normQuery: string,
  tokens: string[],
  activeTab: NavPageId
): number {
  const normTitle = normalizeTr(candidate.title)
  const normSubtitle = normalizeTr(candidate.subtitle)
  const normBadge = normalizeTr(candidate.badge || '')
  const normPage = normalizeTr(candidate.pageLabel)
  const normKeywords = normalizeTr(candidate.keywords)

  // Every token must match somewhere in the candidate's combined searchable text
  for (const token of tokens) {
    if (!normKeywords.includes(token)) {
      return 0
    }
  }

  let score = 0

  // Full query matches against Title
  if (normTitle === normQuery) {
    score += 220
  } else if (normTitle.startsWith(normQuery)) {
    score += 155
  } else if (normTitle.includes(` ${normQuery}`) || normTitle.includes(`-${normQuery}`) || normTitle.includes(`(${normQuery}`)) {
    score += 125
  } else if (normTitle.includes(normQuery)) {
    score += 95
  }

  // Full query matches against Subtitle / Badge / PageLabel
  if (normBadge === normQuery || normBadge.startsWith(normQuery)) {
    score += 75
  } else if (normSubtitle.startsWith(normQuery) || normSubtitle.includes(` ${normQuery}`)) {
    score += 65
  } else if (normSubtitle.includes(normQuery)) {
    score += 48
  }

  if (normPage === normQuery || normPage.startsWith(normQuery)) {
    score += 40
  }

  // Individual token matches
  for (const token of tokens) {
    if (normTitle.startsWith(token) || normTitle.includes(` ${token}`)) {
      score += 36
    } else if (normTitle.includes(token)) {
      score += 24
    } else if (normBadge.includes(token)) {
      score += 18
    } else if (normSubtitle.includes(token)) {
      score += 14
    } else {
      score += 8
    }
  }

  // Exact case/accent bonus if raw lowercase matches
  const lowerRaw = rawQuery.trim().toLocaleLowerCase('tr-TR')
  if (candidate.title.toLocaleLowerCase('tr-TR').includes(lowerRaw)) {
    score += 10
  }

  // Concrete record priority over generic section headers (unless searching page name directly)
  if (candidate.isRecord) {
    score += 8
  }

  // Active page tie-breaker boost
  if (candidate.pageId === activeTab) {
    score += 4
  }

  return score
}

export function searchDepartmentWorkspace(
  query: string,
  activeDept: Department,
  currentUser: AppUser | null,
  activeTab: NavPageId
): DepartmentSearchResponse {
  const trimmed = query.trim()
  if (!trimmed) {
    return { topResults: [], pageGroups: [], totalCount: 0 }
  }

  const normQuery = normalizeTr(trimmed)
  const tokens = normQuery.split(' ').filter(Boolean)
  if (tokens.length === 0) {
    return { topResults: [], pageGroups: [], totalCount: 0 }
  }

  const departmentPages =
    DEPARTMENT_MENU_CONFIG[activeDept] || DEPARTMENT_MENU_CONFIG['Pazarlama']

  const allScored: SearchResultItem[] = []

  for (const pageCfg of departmentPages) {
    const candidates = buildPageCandidates(
      pageCfg.id,
      pageCfg.label,
      activeDept,
      currentUser
    )
    for (const cand of candidates) {
      const score = scoreCandidate(cand, trimmed, normQuery, tokens, activeTab)
      if (score > 0) {
        allScored.push({ ...cand, score })
      }
    }
  }

  if (allScored.length === 0) {
    return { topResults: [], pageGroups: [], totalCount: 0 }
  }

  // Sort all results by score descending
  allScored.sort((a, b) => b.score - a.score)

  // 1. ÖNCE EN ALAKALI (BAŞLIKSIZ):
  // En yüksek puanlı 1–3 sonucu en üstte başlıksız olarak göster
  const topCount =
    allScored.length <= 2 ? 1 : allScored.length <= 5 ? 2 : 3
  const topResults = allScored.slice(0, topCount)
  const topIds = new Set(topResults.map((r) => r.id))

  // 2. SONRA SAYFASINA GÖRE:
  // Departmandaki her sayfa için eşleşen sonuçları grupla
  const groupsMap = new Map<NavPageId, { label: string; items: SearchResultItem[]; allPageItems: SearchResultItem[]; maxScore: number }>()

  for (const pageCfg of departmentPages) {
    groupsMap.set(pageCfg.id, {
      label: pageCfg.label,
      items: [],
      allPageItems: [],
      maxScore: 0,
    })
  }

  for (const item of allScored) {
    const grp = groupsMap.get(item.pageId)
    if (!grp) continue
    grp.allPageItems.push(item)
    if (item.score > grp.maxScore) {
      grp.maxScore = item.score
    }
    if (!topIds.has(item.id)) {
      grp.items.push(item)
    }
  }

  const pageGroups: SearchPageGroup[] = []
  for (const [pageId, grp] of groupsMap.entries()) {
    if (grp.allPageItems.length === 0) continue
    // Eğer o sayfadaki tek sonuç zaten üstteki başlıksız "en alakalı" kısmında yer aldıysa
    // ve başka sonuç yoksa bile sayfa grubunun boş kalmaması için o öğeyi sayfasının altında da göster;
    // birden fazla sonuç varsa tekrarı önlemek için kalan sonuçları göster.
    const finalItems = grp.items.length > 0 ? grp.items.slice(0, 6) : grp.allPageItems.slice(0, 3)
    pageGroups.push({
      pageId,
      pageLabel: grp.label,
      items: finalItems,
      maxScore: grp.maxScore,
    })
  }

  // Sayfa gruplarını o sayfadaki en yüksek alaka puanına göre sırala
  pageGroups.sort((a, b) => b.maxScore - a.maxScore)

  return {
    topResults,
    pageGroups,
    totalCount: allScored.length,
  }
}
