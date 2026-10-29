export type ScheduleCategory =
  | 'OZEL_GUN'
  | 'RESMI_BAYRAM'
  | 'KAMPANYA'
  | 'CEKIM'
  | 'ICERIK'

export type SchedulePrepStatus =
  | 'PLANLANDI'
  | 'TASARIMDA'
  | 'ONAY_BEKLIYOR'
  | 'HAZIR'
  | 'YAYINLANDI'

export interface CreativeScheduleItem {
  id: string
  title: string
  date: string // YYYY-MM-DD
  category: ScheduleCategory
  status: SchedulePrepStatus
  project: string
  assignedTo: string
  channels: string[]
  notes: string
  isAnnualSpecialDay?: boolean
  createdAt: string
}

export type CreativeStatus =
  | 'TASLAK'
  | 'INCELEMEDE'
  | 'REVIZE'
  | 'ONAYLANDI'
  | 'YAYINDA'

export type CreativeFormat =
  | 'Reels / Video'
  | 'Story (9:16)'
  | 'Post / Kare (1:1)'
  | 'Karusel'
  | '3D Render'
  | 'Katalog / Broşür'
  | 'Billboard / Outdoor'

export interface CreativeAssetItem {
  id: string
  code: string
  title: string
  project: string
  format: CreativeFormat
  platform: string
  status: CreativeStatus
  designer: string
  dueDate: string
  version: string
  aspectRatio: '9:16' | '1:1' | '4:5' | '16:9'
  accentGradient: string
  previewImageUrl?: string
  headline: string
  adCopy: string
  ctaText: string
  specialDayTitle?: string
  createdAt: string
  updatedAt: string
}

export type CommentBadgeType = 'YORUM' | 'REVIZE' | 'ONAY'

export interface CreativeCommentItem {
  id: string
  creativeId: string
  creativeCode: string
  creativeTitle: string
  authorName: string
  authorDepartment: string
  content: string
  type: CommentBadgeType
  pinNote?: string // örn: "00:04 sn" veya "Slayt 2 • Başlık"
  isResolved: boolean
  createdAt: string
}

export type BriefPriority = 'ACIL' | 'YUKSEK' | 'NORMAL'
export type BriefStatus = 'YENI_BRIEF' | 'URETIMDE' | 'TESLIM_EDILDI'

export interface CreativeBriefItem {
  id: string
  title: string
  requestedBy: string
  requesterDepartment: string
  project: string
  format: CreativeFormat
  priority: BriefPriority
  deadline: string
  status: BriefStatus
  targetAudience: string
  keyMessage: string
  deliverables: string
  assignedDesigner: string
  createdAt: string
}

const STORAGE_KEY_SCHEDULE = 'demirturk_creative_schedule_v1'
const STORAGE_KEY_CREATIVES = 'demirturk_creatives_v1'
const STORAGE_KEY_COMMENTS = 'demirturk_creative_comments_v1'
const STORAGE_KEY_BRIEFS = 'demirturk_creative_briefs_v1'

function getDynamicDateStr(month: number, day: number): string {
  const now = new Date()
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let targetYear = now.getFullYear()
  const candidate = new Date(targetYear, month - 1, day)
  // If more than 7 days in the past, roll to next year so upcoming calendar stays fresh
  const diffDays = Math.ceil((candidate.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < -7) {
    targetYear += 1
  }
  const m = String(month).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${targetYear}-${m}-${d}`
}

function getRelativeDateStr(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const DEFAULT_SCHEDULE: CreativeScheduleItem[] = [
  {
    id: 'sch-29ekim',
    title: '29 Ekim Cumhuriyet Bayramı Kurumsal Kutlama Filmi & Post',
    date: getDynamicDateStr(10, 29),
    category: 'RESMI_BAYRAM',
    status: 'HAZIR',
    project: 'Kurumsal • Tüm Projeler',
    assignedTo: 'Kreatif Ekip',
    channels: ['Instagram', 'Meta Ads', 'LinkedIn', 'Story'],
    notes: 'Demirtürk İnşaat kurumsal logo animasyonlu Reels ve 4:5 post tasarımı hazırlandı.',
    isAnnualSpecialDay: true,
    createdAt: '2026-10-15T09:00:00.000Z',
  },
  {
    id: 'sch-10kasim',
    title: '10 Kasım Atatürk’ü Anma Günü Özel Görsel & Motion Tasarım',
    date: getDynamicDateStr(11, 10),
    category: 'OZEL_GUN',
    status: 'TASARIMDA',
    project: 'Kurumsal • Tüm Projeler',
    assignedTo: 'Kreatif Ekip',
    channels: ['Instagram', 'Story', 'Web Banner'],
    notes: 'Siyah-beyaz minimal tipografi ve anma videosu kurgulanıyor.',
    isAnnualSpecialDay: true,
    createdAt: '2026-10-20T10:00:00.000Z',
  },
  {
    id: 'sch-kasim-kampanya',
    title: 'Kasım Ara Tatil & Sonbahar Karasu Tanıtım Turu Kampanyası',
    date: getRelativeDateStr(6),
    category: 'KAMPANYA',
    status: 'ONAY_BEKLIYOR',
    project: 'Eksen - 2 & Portre',
    assignedTo: 'Kreatif Ekip',
    channels: ['Meta Ads', 'Instagram Reels', 'Web Form'],
    notes: 'Hafta sonu tanıtım turu odaklı 3 farklı kanca (hook) içeren Reels seti.',
    isAnnualSpecialDay: false,
    createdAt: '2026-10-22T11:30:00.000Z',
  },
  {
    id: 'sch-24kasim',
    title: '24 Kasım Öğretmenler Günü Kutlama & Özel Lansman İletişimi',
    date: getDynamicDateStr(11, 24),
    category: 'OZEL_GUN',
    status: 'PLANLANDI',
    project: 'Kurumsal • Modern & Tria',
    assignedTo: 'Kreatif Ekip',
    channels: ['Instagram', 'Story', 'Meta Ads'],
    notes: 'Öğretmenlere özel ödeme kolaylığı vurgulu karusel ve kutlama postu.',
    isAnnualSpecialDay: true,
    createdAt: '2026-10-24T14:00:00.000Z',
  },
  {
    id: 'sch-yilbasi',
    title: 'Yeni Yıl (Yılbaşı) Kampanyası & "Yeni Yılda Yeni Eviniz" Serisi',
    date: getDynamicDateStr(12, 31),
    category: 'OZEL_GUN',
    status: 'PLANLANDI',
    project: 'Tüm Projeler',
    assignedTo: 'Kreatif Ekip',
    channels: ['Meta Ads', 'Instagram', 'YouTube Shorts', 'Web'],
    notes: 'Aralık ortası başlayacak yıl sonu yatırım fırsatları kreatif paketi.',
    isAnnualSpecialDay: true,
    createdAt: '2026-10-25T15:00:00.000Z',
  },
  {
    id: 'sch-sevgililer',
    title: '14 Şubat Sevgililer Günü "Hayalinizdeki Yuva" Konsepti',
    date: getDynamicDateStr(2, 14),
    category: 'OZEL_GUN',
    status: 'PLANLANDI',
    project: 'Portre & İnception',
    assignedTo: 'Kreatif Ekip',
    channels: ['Instagram', 'Reels', 'Meta Ads'],
    notes: 'Çiftlere yönelik yaşam alanı ve havuz başı konseptli duygusal video.',
    isAnnualSpecialDay: true,
    createdAt: '2026-10-26T10:00:00.000Z',
  },
  {
    id: 'sch-8mart',
    title: '8 Mart Dünya Kadınlar Günü Kurumsal İletişim',
    date: getDynamicDateStr(3, 8),
    category: 'OZEL_GUN',
    status: 'PLANLANDI',
    project: 'Kurumsal',
    assignedTo: 'Kreatif Ekip',
    channels: ['Instagram', 'LinkedIn', 'Story'],
    notes: 'Mimari ve yaşamda kadın dokunuşu temalı özel gün tasarımı.',
    isAnnualSpecialDay: true,
    createdAt: '2026-10-26T12:00:00.000Z',
  },
  {
    id: 'sch-23nisan',
    title: '23 Nisan Ulusal Egemenlik ve Çocuk Bayramı Özel İçeriği',
    date: getDynamicDateStr(4, 23),
    category: 'RESMI_BAYRAM',
    status: 'PLANLANDI',
    project: 'Kurumsal • Tüm Projeler',
    assignedTo: 'Kreatif Ekip',
    channels: ['Instagram', 'Story', 'Reels'],
    notes: 'Site içi çocuk oyun alanları ve gelecek nesiller temalı bayram videosu.',
    isAnnualSpecialDay: true,
    createdAt: '2026-10-26T13:00:00.000Z',
  },
  {
    id: 'sch-19mayis',
    title: '19 Mayıs Atatürk’ü Anma, Gençlik ve Spor Bayramı',
    date: getDynamicDateStr(5, 19),
    category: 'RESMI_BAYRAM',
    status: 'PLANLANDI',
    project: 'Kurumsal',
    assignedTo: 'Kreatif Ekip',
    channels: ['Instagram', 'Story', 'LinkedIn'],
    notes: 'Dinamik tipografi ve Karasu sahil/yaşam konseptli kutlama kreatifi.',
    isAnnualSpecialDay: true,
    createdAt: '2026-10-26T14:00:00.000Z',
  },
  {
    id: 'sch-30agustos',
    title: '30 Ağustos Zafer Bayramı Kurumsal Kutlama Tasarımı',
    date: getDynamicDateStr(8, 30),
    category: 'RESMI_BAYRAM',
    status: 'PLANLANDI',
    project: 'Kurumsal',
    assignedTo: 'Kreatif Ekip',
    channels: ['Instagram', 'Story', 'Billboard'],
    notes: '30 Ağustos Zafer Bayramı özel kurumsal görsel ve motion video.',
    isAnnualSpecialDay: true,
    createdAt: '2026-10-26T15:00:00.000Z',
  },
]

const DEFAULT_CREATIVES: CreativeAssetItem[] = [
  {
    id: 'crt-101',
    code: 'KRT-101',
    title: 'Eksen - 2 • %30 Peşinat + 36 Ay Elden Senet Reels (Hook A)',
    project: 'Eksen - 2',
    format: 'Reels / Video',
    platform: 'Instagram & Meta Ads',
    status: 'INCELEMEDE',
    designer: 'Kreatif Ekip',
    dueDate: getRelativeDateStr(2),
    version: 'v2.4',
    aspectRatio: '9:16',
    accentGradient: 'from-indigo-600 via-blue-700 to-slate-900',
    headline: 'BANKASIZ, KEFİLSİZ, FAİZSİZ 36 AY SENETLE KARASU’DA EV SAHİBİ OLUN',
    adCopy: 'Eksen-2 projesinde havuzlu site içinde 1+1 ve 2+1 daire fırsatları! Sadece %30 peşinatla hemen sözleşme, kalanı 36 ay Demirtürk İnşaat güvencesiyle elden senet.',
    ctaText: 'Tanıtım Turu Randevusu Al',
    specialDayTitle: 'Kasım Kampanyası',
    createdAt: '2026-10-27T10:15:00.000Z',
    updatedAt: '2026-10-29T08:30:00.000Z',
  },
  {
    id: 'crt-102',
    code: 'KRT-102',
    title: '29 Ekim Cumhuriyet Bayramı • "Cumhuriyetimizin 103. Yılı Kutlu Olsun"',
    project: 'Kurumsal',
    format: 'Post / Kare (1:1)',
    platform: 'Instagram Organik',
    status: 'YAYINDA',
    designer: 'Kreatif Ekip',
    dueDate: getDynamicDateStr(10, 29),
    version: 'v3.0',
    aspectRatio: '1:1',
    accentGradient: 'from-red-700 via-rose-800 to-slate-950',
    headline: 'CUMHURİYETİMİZİN 103. YILI KUTLU OLSUN',
    adCopy: 'Geleceği sağlam temeller üzerine inşa ederken en büyük ilhamımız Cumhuriyet. 29 Ekim Cumhuriyet Bayramımız kutlu olsun! — Demirtürk İnşaat',
    ctaText: 'Kurumsal Paylaşım',
    specialDayTitle: '29 Ekim Cumhuriyet Bayramı',
    createdAt: '2026-10-25T14:00:00.000Z',
    updatedAt: '2026-10-29T07:00:00.000Z',
  },
  {
    id: 'crt-103',
    code: 'KRT-103',
    title: 'Portre Projesi • Mimari Detaylar & İç Mekan 5’li Karusel Seti',
    project: 'Portre',
    format: 'Karusel',
    platform: 'Instagram & Meta Ads',
    status: 'REVIZE',
    designer: 'Kreatif Ekip',
    dueDate: getRelativeDateStr(1),
    version: 'v1.8',
    aspectRatio: '4:5',
    accentGradient: 'from-amber-600 via-orange-700 to-stone-900',
    headline: 'ESTETİK MİMARİ, YÜKSEK KİRA GETİRİSİ: PORTRE KARASU',
    adCopy: 'Denize yürüme mesafesinde, modern peyzaj ve havuz konseptiyle Portre projesinde yerinizi ayırtın. Ücretsiz Karasu tanıtım turumuza katılın.',
    ctaText: 'Formu Doldur • Bilgi Al',
    createdAt: '2026-10-26T11:20:00.000Z',
    updatedAt: '2026-10-28T17:45:00.000Z',
  },
  {
    id: 'crt-104',
    code: 'KRT-104',
    title: '10 Kasım Atatürk’ü Anma • Minimal Tipografi & Sesli Reels',
    project: 'Kurumsal',
    format: 'Story (9:16)',
    platform: 'Instagram Organik',
    status: 'TASLAK',
    designer: 'Kreatif Ekip',
    dueDate: getDynamicDateStr(11, 10),
    version: 'v1.1',
    aspectRatio: '9:16',
    accentGradient: 'from-zinc-700 via-neutral-900 to-black',
    headline: 'SAYGI, ÖZLEM VE MİNNETLE ANIYORUZ (1881 - ∞)',
    adCopy: 'Cumhuriyetimizin kurucusu Gazi Mustafa Kemal Atatürk’ü aramızdan ayrılışının yıl dönümünde saygı ve minnetle anıyoruz.',
    ctaText: 'Anma Paylaşımı',
    specialDayTitle: '10 Kasım Atatürk’ü Anma',
    createdAt: '2026-10-28T09:00:00.000Z',
    updatedAt: '2026-10-28T16:10:00.000Z',
  },
  {
    id: 'crt-105',
    code: 'KRT-105',
    title: 'İnception & Modern • Hafta Sonu Ücretsiz Tanıtım Turu Daveti',
    project: 'İnception',
    format: 'Reels / Video',
    platform: 'Instagram & Meta Ads',
    status: 'ONAYLANDI',
    designer: 'Kreatif Ekip',
    dueDate: getRelativeDateStr(3),
    version: 'v2.0',
    aspectRatio: '9:16',
    accentGradient: 'from-emerald-600 via-teal-800 to-slate-950',
    headline: 'PROJELERİMİZİ YERİNDE GÖRÜN: HAFTA SONU TANITIM TURU',
    adCopy: 'Karasu’daki tüm projelerimizi ve örnek dairelerimizi uzman yatırım danışmanlarımızla yerinde inceleyin. Hemen randevu formunu doldurun.',
    ctaText: 'Ücretsiz Tur Kaydı Oluştur',
    specialDayTitle: 'Kasım Kampanyası',
    createdAt: '2026-10-27T15:00:00.000Z',
    updatedAt: '2026-10-29T09:10:00.000Z',
  },
  {
    id: 'crt-106',
    code: 'KRT-106',
    title: 'Tria Projesi • Havuz & Gece Aydınlatmalı Dış Cephe 3D Render',
    project: 'Tria',
    format: '3D Render',
    platform: 'Web & Landing',
    status: 'INCELEMEDE',
    designer: 'Kreatif Ekip',
    dueDate: getRelativeDateStr(4),
    version: 'v1.3',
    aspectRatio: '16:9',
    accentGradient: 'from-purple-700 via-violet-800 to-slate-950',
    headline: 'TRİA KARASU • YENİ NESİL YAŞAM ALANI',
    adCopy: 'Yüksek çözünürlüklü 4K gece aydınlatmalı dış cephe ve havuz başı render çıktısı (demirturkinsaat.com hero alanı ve katalog için).',
    ctaText: 'Web & Katalog Görseli',
    createdAt: '2026-10-28T13:00:00.000Z',
    updatedAt: '2026-10-29T10:00:00.000Z',
  },
]

const DEFAULT_COMMENTS: CreativeCommentItem[] = [
  {
    id: 'cmt-1',
    creativeId: 'crt-103',
    creativeCode: 'KRT-103',
    creativeTitle: 'Portre Projesi • Mimari Detaylar & İç Mekan 5’li Karusel Seti',
    authorName: 'Pazarlama Yönetimi',
    authorDepartment: 'Pazarlama',
    content: '2. slayttaki "36 Ay Elden Senet" rozetini biraz daha büyütüp kontrastını artırabilir miyiz? Mobilde kaydırırken ilk bakışta okunması dönüşümü artırır.',
    type: 'REVIZE',
    pinNote: 'Slayt 2 • Sağ Üst Rozet',
    isResolved: false,
    createdAt: '2026-10-29T08:45:00.000Z',
  },
  {
    id: 'cmt-2',
    creativeId: 'crt-101',
    creativeCode: 'KRT-101',
    creativeTitle: 'Eksen - 2 • %30 Peşinat + 36 Ay Elden Senet Reels (Hook A)',
    authorName: 'Yönetim',
    authorDepartment: 'Yönetim',
    content: 'İlk 3 saniyedeki drone girişi çok başarılı olmuş. Son ekrandaki telefon ve web sitesi bilgisinin ekranda kalma süresini 1.5 saniye uzatalım.',
    type: 'YORUM',
    pinNote: '00:14 sn • Kapanış Kartı',
    isResolved: false,
    createdAt: '2026-10-29T09:20:00.000Z',
  },
  {
    id: 'cmt-3',
    creativeId: 'crt-105',
    creativeCode: 'KRT-105',
    creativeTitle: 'İnception & Modern • Hafta Sonu Ücretsiz Tanıtım Turu Daveti',
    authorName: 'Satış Ekibi',
    authorDepartment: 'Satış',
    content: 'Tanıtım turu vurgusu ve örnek daire görüntüleri tam müşterilerin sorduğu detayları içeriyor, Meta reklamlarına çıkabiliriz.',
    type: 'ONAY',
    pinNote: 'Genel Akış',
    isResolved: true,
    createdAt: '2026-10-29T09:50:00.000Z',
  },
  {
    id: 'cmt-4',
    creativeId: 'crt-106',
    creativeCode: 'KRT-106',
    creativeTitle: 'Tria Projesi • Havuz & Gece Aydınlatmalı Dış Cephe 3D Render',
    authorName: 'Kreatif Ekip',
    authorDepartment: 'Kreatif',
    content: 'Su yansıması ve balkon sıcak LED ışık tonları güncellendi, v1.3 olarak incelemeye sunuldu.',
    type: 'YORUM',
    pinNote: 'Havuz & Cephe Işıklandırma',
    isResolved: false,
    createdAt: '2026-10-29T10:05:00.000Z',
  },
]

const DEFAULT_BRIEFS: CreativeBriefItem[] = [
  {
    id: 'brf-1',
    title: 'Kasım Ayı Meta Lead Kampanyası • 3 Farklı Hook Reels Paketi',
    requestedBy: 'Pazarlama Departmanı',
    requesterDepartment: 'Pazarlama',
    project: 'Eksen - 2',
    format: 'Reels / Video',
    priority: 'ACIL',
    deadline: getRelativeDateStr(2),
    status: 'URETIMDE',
    targetAudience: 'İstanbul, Kocaeli, Sakarya ve Avrupa’da yaşayan 28-55 yaş arası yatırımcılar',
    keyMessage: 'Banka kredisi olmadan %30 peşinat ve 36 ay faizsiz senetle Karasu’da havuzlu sitede daire fırsatı.',
    deliverables: '3 adet 9:16 Reels (15-25 sn), 3 adet 9:16 Story kapak görseli',
    assignedDesigner: 'Kreatif Ekip',
    createdAt: '2026-10-26T10:00:00.000Z',
  },
  {
    id: 'brf-2',
    title: 'Satış Ofisi Sunum Dosyası & WhatsApp Yatırım Katalog Güncellemesi',
    requestedBy: 'Satış Departmanı',
    requesterDepartment: 'Satış',
    project: 'Portre & Modern',
    format: 'Katalog / Broşür',
    priority: 'YUKSEK',
    deadline: getRelativeDateStr(5),
    status: 'YENI_BRIEF',
    targetAudience: 'Müşteri ilişkileri ve satış temsilcilerinin WhatsApp üzerinden katalog gönderdiği sıcak müşteriler',
    keyMessage: 'Kat planları, konum avantajları ve ödeme modelleri tablosunun mobil ekranda kolay okunur PDF formatı.',
    deliverables: 'Mobil uyumlu dikey PDF Katalog (TR & EN) + WhatsApp özet görsel kartları',
    assignedDesigner: 'Kreatif Ekip',
    createdAt: '2026-10-27T14:30:00.000Z',
  },
  {
    id: 'brf-3',
    title: '10 Kasım & 24 Kasım Kurumsal Özel Gün Görsel Setleri',
    requestedBy: 'Yönetim',
    requesterDepartment: 'Yönetim',
    project: 'Kurumsal',
    format: 'Post / Kare (1:1)',
    priority: 'NORMAL',
    deadline: getDynamicDateStr(11, 8),
    status: 'URETIMDE',
    targetAudience: 'Tüm sosyal medya takipçileri, kurumsal paydaşlar ve web sitesi ziyaretçileri',
    keyMessage: 'Demirtürk İnşaat kurumsal kimliğine uygun, saygın ve estetik özel gün iletişimi.',
    deliverables: '4:5 Instagram Post, 9:16 Story ve LinkedIn yatay görsel',
    assignedDesigner: 'Kreatif Ekip',
    createdAt: '2026-10-28T11:00:00.000Z',
  },
]

type Listener = () => void

class CreativeStore {
  private schedule: CreativeScheduleItem[] = []
  private creatives: CreativeAssetItem[] = []
  private comments: CreativeCommentItem[] = []
  private briefs: CreativeBriefItem[] = []
  private listeners: Set<Listener> = new Set()

  constructor() {
    this.loadFromStorage()
    if (typeof window !== 'undefined') {
      window.addEventListener('demirturk:cloud-db-synced', () => {
        this.loadFromStorage(false)
        this.notify()
      })
    }
  }

  private loadFromStorage(seedIfEmpty = true) {
    try {
      const rawSchedule = localStorage.getItem(STORAGE_KEY_SCHEDULE)
      if (rawSchedule) {
        const parsed = JSON.parse(rawSchedule)
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.schedule = parsed
        } else if (seedIfEmpty) {
          this.schedule = [...DEFAULT_SCHEDULE]
          localStorage.setItem(STORAGE_KEY_SCHEDULE, JSON.stringify(this.schedule))
        }
      } else if (seedIfEmpty) {
        this.schedule = [...DEFAULT_SCHEDULE]
        localStorage.setItem(STORAGE_KEY_SCHEDULE, JSON.stringify(this.schedule))
      }

      const rawCreatives = localStorage.getItem(STORAGE_KEY_CREATIVES)
      if (rawCreatives) {
        const parsed = JSON.parse(rawCreatives)
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.creatives = parsed
        } else if (seedIfEmpty) {
          this.creatives = [...DEFAULT_CREATIVES]
          localStorage.setItem(STORAGE_KEY_CREATIVES, JSON.stringify(this.creatives))
        }
      } else if (seedIfEmpty) {
        this.creatives = [...DEFAULT_CREATIVES]
        localStorage.setItem(STORAGE_KEY_CREATIVES, JSON.stringify(this.creatives))
      }

      const rawComments = localStorage.getItem(STORAGE_KEY_COMMENTS)
      if (rawComments) {
        const parsed = JSON.parse(rawComments)
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.comments = parsed
        } else if (seedIfEmpty) {
          this.comments = [...DEFAULT_COMMENTS]
          localStorage.setItem(STORAGE_KEY_COMMENTS, JSON.stringify(this.comments))
        }
      } else if (seedIfEmpty) {
        this.comments = [...DEFAULT_COMMENTS]
        localStorage.setItem(STORAGE_KEY_COMMENTS, JSON.stringify(this.comments))
      }

      const rawBriefs = localStorage.getItem(STORAGE_KEY_BRIEFS)
      if (rawBriefs) {
        const parsed = JSON.parse(rawBriefs)
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.briefs = parsed
        } else if (seedIfEmpty) {
          this.briefs = [...DEFAULT_BRIEFS]
          localStorage.setItem(STORAGE_KEY_BRIEFS, JSON.stringify(this.briefs))
        }
      } else if (seedIfEmpty) {
        this.briefs = [...DEFAULT_BRIEFS]
        localStorage.setItem(STORAGE_KEY_BRIEFS, JSON.stringify(this.briefs))
      }
    } catch (e) {
      console.error('Failed to load creativeStore:', e)
      if (this.schedule.length === 0) this.schedule = [...DEFAULT_SCHEDULE]
      if (this.creatives.length === 0) this.creatives = [...DEFAULT_CREATIVES]
      if (this.comments.length === 0) this.comments = [...DEFAULT_COMMENTS]
      if (this.briefs.length === 0) this.briefs = [...DEFAULT_BRIEFS]
    }
  }

  private saveSchedule() {
    try {
      localStorage.setItem(STORAGE_KEY_SCHEDULE, JSON.stringify(this.schedule))
    } catch {}
    this.notify()
  }

  private saveCreatives() {
    try {
      localStorage.setItem(STORAGE_KEY_CREATIVES, JSON.stringify(this.creatives))
    } catch {}
    this.notify()
  }

  private saveComments() {
    try {
      localStorage.setItem(STORAGE_KEY_COMMENTS, JSON.stringify(this.comments))
    } catch {}
    this.notify()
  }

  private saveBriefs() {
    try {
      localStorage.setItem(STORAGE_KEY_BRIEFS, JSON.stringify(this.briefs))
    } catch {}
    this.notify()
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify() {
    this.listeners.forEach((l) => l())
  }

  // --- SCHEDULE / SPECIAL DAYS ---
  getSchedule(): (CreativeScheduleItem & { daysLeft: number })[] {
    const now = new Date()
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

    return [...this.schedule]
      .map((item) => {
        const parts = item.date.split('-').map(Number)
        const target =
          parts.length === 3
            ? new Date(parts[0], parts[1] - 1, parts[2]).getTime()
            : new Date(item.date).getTime()
        const daysLeft = Math.round((target - todayMidnight) / (1000 * 60 * 60 * 24))
        return { ...item, daysLeft }
      })
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  addScheduleItem(
    data: Omit<CreativeScheduleItem, 'id' | 'createdAt'>
  ): CreativeScheduleItem {
    const newItem: CreativeScheduleItem = {
      ...data,
      id: 'sch-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      createdAt: new Date().toISOString(),
    }
    this.schedule.push(newItem)
    this.saveSchedule()
    return newItem
  }

  updateScheduleStatus(id: string, status: SchedulePrepStatus) {
    this.schedule = this.schedule.map((item) =>
      item.id === id ? { ...item, status } : item
    )
    this.saveSchedule()
  }

  deleteScheduleItem(id: string) {
    this.schedule = this.schedule.filter((item) => item.id !== id)
    this.saveSchedule()
  }

  // --- CREATIVES ---
  getCreatives(): CreativeAssetItem[] {
    return [...this.creatives].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  addCreative(
    data: Omit<CreativeAssetItem, 'id' | 'code' | 'createdAt' | 'updatedAt'>
  ): CreativeAssetItem {
    const nextNum = 101 + this.creatives.length
    const nowIso = new Date().toISOString()
    const newItem: CreativeAssetItem = {
      ...data,
      id: 'crt-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      code: `KRT-${nextNum}`,
      createdAt: nowIso,
      updatedAt: nowIso,
    }
    this.creatives.unshift(newItem)
    this.saveCreatives()
    return newItem
  }

  updateCreativeStatus(id: string, status: CreativeStatus) {
    const nowIso = new Date().toISOString()
    this.creatives = this.creatives.map((c) =>
      c.id === id ? { ...c, status, updatedAt: nowIso } : c
    )
    this.saveCreatives()
  }

  updateCreative(id: string, updates: Partial<CreativeAssetItem>) {
    const nowIso = new Date().toISOString()
    this.creatives = this.creatives.map((c) =>
      c.id === id ? { ...c, ...updates, updatedAt: nowIso } : c
    )
    this.saveCreatives()
  }

  deleteCreative(id: string) {
    this.creatives = this.creatives.filter((c) => c.id !== id)
    this.comments = this.comments.filter((cm) => cm.creativeId !== id)
    this.saveCreatives()
    this.saveComments()
  }

  // --- COMMENTS ---
  getComments(creativeId?: string): CreativeCommentItem[] {
    const filtered = creativeId
      ? this.comments.filter((c) => c.creativeId === creativeId)
      : [...this.comments]
    return filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  addComment(data: {
    creativeId: string
    authorName: string
    authorDepartment: string
    content: string
    type?: CommentBadgeType
    pinNote?: string
  }): CreativeCommentItem | null {
    const creative = this.creatives.find((c) => c.id === data.creativeId)
    if (!creative) return null

    const commentType: CommentBadgeType = data.type || 'YORUM'
    const newComment: CreativeCommentItem = {
      id: 'cmt-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      creativeId: creative.id,
      creativeCode: creative.code,
      creativeTitle: creative.title,
      authorName: data.authorName,
      authorDepartment: data.authorDepartment,
      content: data.content.trim(),
      type: commentType,
      pinNote: data.pinNote?.trim() || undefined,
      isResolved: commentType === 'ONAY',
      createdAt: new Date().toISOString(),
    }

    this.comments.unshift(newComment)
    this.saveComments()

    if (commentType === 'REVIZE' && creative.status !== 'REVIZE') {
      this.updateCreativeStatus(creative.id, 'REVIZE')
    } else if (commentType === 'ONAY' && creative.status === 'INCELEMEDE') {
      this.updateCreativeStatus(creative.id, 'ONAYLANDI')
    }

    return newComment
  }

  toggleCommentResolved(commentId: string) {
    this.comments = this.comments.map((c) =>
      c.id === commentId ? { ...c, isResolved: !c.isResolved } : c
    )
    this.saveComments()
  }

  // --- BRIEFS ---
  getBriefs(): CreativeBriefItem[] {
    return [...this.briefs].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  addBrief(
    data: Omit<CreativeBriefItem, 'id' | 'createdAt'>
  ): CreativeBriefItem {
    const newBrief: CreativeBriefItem = {
      ...data,
      id: 'brf-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      createdAt: new Date().toISOString(),
    }
    this.briefs.unshift(newBrief)
    this.saveBriefs()
    return newBrief
  }

  updateBriefStatus(id: string, status: BriefStatus) {
    this.briefs = this.briefs.map((b) => (b.id === id ? { ...b, status } : b))
    this.saveBriefs()
  }
}

export const creativeStore = new CreativeStore()
