import {usePersonalTools} from '@/services/personalToolWorkspace'
import { WeatherTool, DEFAULT_WEATHER_CITIES } from './WeatherTool'
import { CurrencyTool } from './CurrencyTool'
import { CannedRepliesTool, type CannedReply } from './CannedRepliesTool'
import React, { useState, useEffect } from 'react'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calculator,
  FileText,
  TurkishLira,
  TrendingUp,
  Percent,
  Copy,
  Check,
  X,
  Plus,
  Trash2,
  Calendar,
  Building,
  ArrowRightLeft,
  PieChart,
  Layers,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Scale,
  CreditCard,
  MapPin,
  Compass,
  FileCheck,
  Bell,
  QrCode,
  BarChart3,
  ShieldCheck,
  Receipt,
  Home,
  Sun,
  Timer,
  CheckSquare,
  Square,
  Target,
  Wallet,
  Eye,
  EyeOff,
  Users,
  Building2,
  Globe,
  Lock,
  MessageSquareText,
} from 'lucide-react'
import { GlassButton } from '@/components/ui/GlassButton'
import { GlassBadge } from '@/components/ui/GlassBadge'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import { formatCurrency, generateWhatsAppUrl } from '@/utils/formatters'
import { CalendarWorkspaceTool } from './CalendarWorkspaceTool'
import { userStore, AppUser } from '@/services/userStore'
import { CANONICAL_DEPARTMENTS, Department } from '@/types/department'

export type ToolType =
  | 'payments'
  | 'notepad'
  | 'calculator'
  | 'currency'
  | 'mortgage'
  | 'whatsapp'
  | 'sqmPrice'
  | 'roi'
  | 'bargain'
  | 'downpayment'
  | 'parsel'
  | 'compass'
  | 'valuation'
  | 'contracts'
  | 'target'
  | 'reminders'
  | 'qr'
  | 'market'
  | 'calendar'
  | 'dask'
  | 'taxincome'
  | 'aidat'
  | 'weather'
  | 'timer'
  | 'replies'

export type NoteShareScope = 'PRIVATE' | 'USERS' | 'DEPARTMENTS' | 'COMPANY'

interface NoteItem {
  id: string
  title: string
  content: string
  updatedAt: string
  ownerId?: string
  ownerName?: string
  ownerDepartment?: Department
  shareScope?: NoteShareScope
  sharedUserIds?: string[]
  sharedDepartments?: Department[]
  sharedAt?: string
}

const STORAGE_KEY_NOTES = 'demirturk_notepad_notes_v1'

interface PaymentRecord {
  id: string
  item: string
  amount: number
  date: string
}

const STORAGE_KEY_PAYMENTS = 'demirturk_tool_payments_v1'

const DEFAULT_PAYMENTS: PaymentRecord[] = []

interface QuickToolsModalProps {
  isOpen: boolean
  onClose: () => void
  initialTool?: ToolType
}

export const QuickToolsModal: React.FC<QuickToolsModalProps> = ({
  isOpen,
  onClose,
  initialTool = 'calculator',
}) => {
  const [activeTool, setActiveTool] = useState<ToolType>(initialTool)
  const [copied, setCopied] = useState<string | null>(null)

  // ESC key and body lock
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.body.style.overflow = 'unset'
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  // Sync initialTool when modal opens
  useEffect(() => {
    if (isOpen && initialTool) {
      setActiveTool(initialTool)
    }
  }, [isOpen, initialTool])

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  // ==========================================
  // ÖDEMELER (PAYMENTS) STATE & LOGIC
  // ==========================================
  const currentUser=userStore.getCurrentUser()
  const tools=usePersonalTools(currentUser?.id||'',isOpen)
  const field=tools.field
  const [payments,setPayments]=field<PaymentRecord[]>('payments',[])

  const [newPaymentItem, setNewPaymentItem] = useState('')
  const [newPaymentAmount, setNewPaymentAmount] = useState('')
  const [newPaymentDate, setNewPaymentDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [isTotalRevealed, setIsTotalRevealed] = useState(false)

  const handleAddPayment = (e: React.FormEvent) => {
    e.preventDefault()
    const amountNum = parseFloat(newPaymentAmount.replace(/,/g, '.'))
    if (!newPaymentItem.trim() || isNaN(amountNum) || amountNum <= 0) return

    const newRecord: PaymentRecord = {
      id: 'pay-' + crypto.randomUUID(),
      item: newPaymentItem.trim(),
      amount: amountNum,
      date: newPaymentDate || new Date().toISOString().slice(0, 10),
    }

    const updated = [newRecord, ...payments]
    setPayments(updated)

    setNewPaymentItem('')
    setNewPaymentAmount('')
  }

  const handleDeletePayment = (id: string) => {
    const updated = payments.filter((p) => p.id !== id)
    setPayments(updated)
  }

  const totalPaymentsAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0)

  // ==========================================
  // 1. NOT DEFTERİ (NOTEPAD) STATE & LOGIC
  // ==========================================
  const [notes,setNotes]=field<NoteItem[]>('notes',[])
  const visibleNotes=notes
  const [selectedNoteId, setSelectedNoteId] = useState<string>(visibleNotes[0]?.id || notes[0]?.id || '')
  const activeNote = visibleNotes.find((n) => n.id === selectedNoteId) || visibleNotes[0]

  const saveNotesToStorage=setNotes

  const handleCreateNote = () => {
    const newNote: NoteItem = {
      id: 'note-' + crypto.randomUUID(),
      title: 'Yeni Not',
      content: '',
      updatedAt: 'Az önce',
      ownerId: currentUser?.id,
      ownerName: currentUser?.fullName,
      ownerDepartment: currentUser?.department,
      shareScope: 'PRIVATE',
      sharedUserIds: [],
      sharedDepartments: [],
    }
    const updated = [newNote, ...notes]
    saveNotesToStorage(updated)
    setSelectedNoteId(newNote.id)
  }

  const handleUpdateActiveNote = (updates: Partial<NoteItem>) => {
    if (!activeNote) return
    const updated = notes.map((n) =>
      n.id === activeNote.id
        ? { ...n, ...updates, updatedAt: 'Az önce' }
        : n
    )
    saveNotesToStorage(updated)
  }

  const handleDeleteNote = (id: string) => {
    const updated = notes.filter((n) => n.id !== id)
    saveNotesToStorage(updated)
    if (selectedNoteId === id && updated.length > 0) {
      setSelectedNoteId(updated[0].id)
    }
  }


  // ==========================================
  // 2. HESAP MAKİNESİ (CALCULATOR) STATE & LOGIC
  // ==========================================
  const [calcInput, setCalcInput] = field<string>('calcInput', '0')
  const [calcPrev, setCalcPrev] = field<string>('calcPrev', '')
  const [calcOp, setCalcOp] = field<string | null>('calcOp', null)
  const [calcResetOnNext, setCalcResetOnNext] = field<boolean>('calcResetOnNext', false)

  const handleCalcDigit = (digit: string) => {
    if (calcResetOnNext || calcInput === '0') {
      setCalcInput(digit)
      setCalcResetOnNext(false)
    } else {
      if (digit === '.' && calcInput.includes('.')) return
      setCalcInput(calcInput + digit)
    }
  }

  const handleCalcOp = (op: string) => {
    setCalcPrev(`${calcInput} ${op}`)
    setCalcOp(op)
    setCalcResetOnNext(true)
  }

  const handleCalcEquals = () => {
    if (!calcOp || !calcPrev) return
    const prevNum = parseFloat(calcPrev.split(' ')[0])
    const currNum = parseFloat(calcInput)
    let res = 0

    switch (calcOp) {
      case '+':
        res = prevNum + currNum
        break
      case '-':
        res = prevNum - currNum
        break
      case '×':
        res = prevNum * currNum
        break
      case '÷':
        res = currNum !== 0 ? prevNum / currNum : 0
        break
      default:
        return
    }

    const roundedRes = Math.round(res * 100) / 100
    setCalcPrev(`${prevNum} ${calcOp} ${currNum} =`)
    setCalcInput(String(roundedRes))
    setCalcOp(null)
    setCalcResetOnNext(true)
  }

  const handleCalcClear = () => {
    setCalcInput('0')
    setCalcPrev('')
    setCalcOp(null)
    setCalcResetOnNext(false)
  }

  const handleCalcQuickPercentage = (pct: number) => {
    const val = parseFloat(calcInput) || 0
    const res = Math.round(val * pct * 100) / 100
    setCalcPrev(`${val} × %${pct * 100} =`)
    setCalcInput(String(res))
    setCalcResetOnNext(true)
  }

  // ==========================================
  // 4. DÖVİZ & KUR ÇEVİRİCİ STATE & LOGIC
  // ==========================================
  const [currencyAmount, setCurrencyAmount] = field<number>('currencyAmount', 0)
  const [baseCurrency, setBaseCurrency] = field<string>('baseCurrency', 'USD')

  // ==========================================
  // 5. KONUT KREDİSİ STATE & LOGIC
  // ==========================================
  const [mortgageLoan, setMortgageLoan] = field<number>('mortgageLoan', 0)
  const [mortgageRate, setMortgageRate] = field('mortgageRate',2.89) // Aylık %2.89
  const [mortgageMonths, setMortgageMonths] = field('mortgageMonths',120) // 120 ay

  // Aylık taksit hesabı
  const r = mortgageRate / 100
  const n = mortgageMonths
  const monthlyPayment =
    r > 0 ? Math.round((mortgageLoan * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1)) : 0
  const totalRepayment = monthlyPayment * n
  const totalInterest = totalRepayment - mortgageLoan

  // ==========================================
  // 7. WHATSAPP ŞABLONLARI STATE & LOGIC
  // ==========================================
  const [waClientName, setWaClientName] = field('waClientName', '')
  const [waProperty, setWaProperty] = field('waProperty', '')
  const [waPrice, setWaPrice] = field('waPrice', '')
  const [waTemplateType, setWaTemplateType] = field<'sunum' | 'randevu' | 'teklif' | 'kapora'>('waTemplateType', 'sunum')

  const generateWaText = () => {
    switch (waTemplateType) {
      case 'sunum':
        return `Merhaba Sayın ${waClientName},\n\nİncelediğiniz *${waProperty}* projemize ait güncel kat planları, fiyat tablosu ve e-kataloğu ekte bilgilerinize sunarım.\n\nFiyat: *${waPrice}*\nÖdeme Planı: Peşin alımda özel indirim / vadeli seçenekler mevcuttur.\n\nDetayları görüşmek üzere iyi günler dilerim.\nDemirtürk Portföy Yönetimi`
      case 'randevu':
        return `Sayın ${waClientName} merhaba,\n\n*${waProperty}* projemizin örnek daire sunumu ve lansman ofisi randevunuz onaylanmıştır.\n\nKonum ve kahve ikramımız eşliğinde projemizi yerinde incelemek üzere sizleri ağırlamaktan memnuniyet duyacağız.\nDemirtürk Portföy`
      case 'teklif':
        return `Sayın ${waClientName},\n\nİlgilendiğiniz *${waProperty}* için hazırlanan özel teklif özeti:\n• Liste Fiyatı: ${waPrice}\n• Sözleşme Şartları: Hemen Teslim / Tapu Hazır\n\nTeklifi onaylamanız halinde satış sözleşmesi taslağı iletilecektir.`
      case 'kapora':
        return `Sayın ${waClientName},\n\n*${waProperty}* ünitesinin adınıza rezerve edilebilmesi için kapora protokolü hazırlanmıştır.\n\nİlgili kapora dekontunun tarafımıza iletilmesi akabinde tapu devir işlemleri başlatılacaktır.`
    }
  }

  // ==========================================
  // 8. METREKARE & BİRİM FİYAT STATE & LOGIC
  // ==========================================
  const [sqmPriceTotal, setSqmPriceTotal] = field<number>('sqmPriceTotal', 0)
  const [sqmGross, setSqmGross] = field<number>('sqmGross', 0)
  const [sqmNet, setSqmNet] = field<number>('sqmNet', 0)

  const grossUnit = sqmGross > 0 ? Math.round(sqmPriceTotal / sqmGross) : 0
  const netUnit = sqmNet > 0 ? Math.round(sqmPriceTotal / sqmNet) : 0
  const efficiency = sqmGross > 0 ? Math.round((sqmNet / sqmGross) * 100) : 0

  // ==========================================
  // 9. ROI & KİRA AMORTİSMANI
  // ==========================================
  const [roiPrice, setRoiPrice] = field<number>('roiPrice', 0)
  const [roiRent, setRoiRent] = field<number>('roiRent', 0)
  const [roiDues, setRoiDues] = field<number>('roiDues', 0)
  const roiYearlyNet = Math.max(0, (roiRent - roiDues) * 12)
  const roiYears = roiPrice > 0 && roiYearlyNet > 0 ? (roiPrice / roiYearlyNet).toFixed(1) : '0'
  const roiYield = roiPrice > 0 ? ((roiYearlyNet / roiPrice) * 100).toFixed(2) : '0'

  // ==========================================
  // 10. PAZARLIK & İNDİRİM MARJI
  // ==========================================
  const [bargainListed, setBargainListed] = field<number>('bargainListed', 0)
  const [bargainOffer, setBargainOffer] = field<number>('bargainOffer', 0)
  const bargainDiscount = Math.max(0, bargainListed - bargainOffer)
  const bargainRate = bargainListed > 0 ? ((bargainDiscount / bargainListed) * 100).toFixed(1) : '0'

  // ==========================================
  // 11. PEŞİNAT & ARA ÖDEME
  // ==========================================
  const [downTotal, setDownTotal] = field<number | ''>('downTotal', 0)
  const [downRate, setDownRate] = field<number | ''>('downRate', 0)
  const [downInterimAmount, setDownInterimAmount] = field<number | ''>('downInterimAmount', 0)
  const [downMonths, setDownMonths] = field<number | ''>('downMonths', 0)

  const activeDownTotal = Math.max(0, typeof downTotal === 'number' ? downTotal : 0)
  const activeDownRate = Math.max(0, Math.min(100, typeof downRate === 'number' ? downRate : 0))
  const activeDownInterimAmount = Math.max(0, typeof downInterimAmount === 'number' ? downInterimAmount : 0)
  const activeDownMonths = Math.max(0, typeof downMonths === 'number' ? downMonths : 0)

  const downInitial = Math.round((activeDownTotal * activeDownRate) / 100)
  const downTotalInterim = activeDownInterimAmount
  const downRemaining = Math.max(0, activeDownTotal - downInitial - downTotalInterim)
  const downMonthly = activeDownMonths > 0 ? Math.round(downRemaining / activeDownMonths) : 0

  // ==========================================
  // 12. TKGM PARSEL & İMAR
  // ==========================================
  const [parselCity, setParselCity] = field('parselCity', '')
  const [parselDistrict, setParselDistrict] = field('parselDistrict', '')
  const [parselNeighborhood, setParselNeighborhood] = field('parselNeighborhood', '')
  const [parselAda, setParselAda] = field('parselAda', '')
  const [parselNo, setParselNo] = field('parselNo', '')
  const [parselKaks, setParselKaks] = field('parselKaks', 0)
  const [parselTaks, setParselTaks] = field('parselTaks', 0)
  const [parselArea, setParselArea] = field('parselArea', 0)

  // ==========================================
  // 13. COMPASS (GÜNEŞ & CEPHE)
  // ==========================================
  const [compassDir, setCompassDir] = field<'guney' | 'dogu' | 'bati' | 'kuzey'>('compassDir', 'guney')

  // ==========================================
  // 14. VALUATION (EKSPERTİZ)
  // ==========================================
  const [valSqm, setValSqm] = field('valSqm', 0)
  const [valGross, setValGross] = field('valGross', 0)
  const [valAge, setValAge] = field<'0' | '1-5' | '6-15' | '16+'>('valAge', '0')
  const [valFloor, setValFloor] = field<'ara' | 'giris' | 'dubleks'>('valFloor', 'ara')

  // ==========================================
  // 15. CONTRACTS (HAZIR SÖZLEŞMELER)
  // ==========================================
  const [contractType, setContractType] = field<'yerGosterme' | 'yetki' | 'kapora'>('contractType', 'yerGosterme')
  const [contractClient, setContractClient] = field('contractClient', '')
  const [contractAddress, setContractAddress] = field('contractAddress', '')
  const [contractPrice, setContractPrice] = field('contractPrice', '')

  // ==========================================
  // 16. TARGET (SATIŞ HEDEFİ)
  // ==========================================
  const [targetQuota, setTargetQuota] = field('targetQuota', 0)
  const [targetRealized, setTargetRealized] = field('targetRealized', 0)

  // ==========================================
  // 17. REMINDERS (HATIRLATICILAR)
  // ==========================================
  const [reminders, setReminders] = field<{ id: string; text: string; done: boolean }[]>('reminders', [])
  const [newReminderText, setNewReminderText] = field('newReminderText', '')

  // ==========================================
  // 18. QR KARTVİZİT
  // ==========================================
  const [qrName, setQrName] = field('qrName', '')
  const [qrPhone, setQrPhone] = field('qrPhone', '')


  // ==========================================
  // 21. DASK
  // ==========================================
  const [daskArea, setDaskArea] = field('daskArea', 0)

  // ==========================================
  // 22. TAX INCOME (KİRA GELİR VERGİSİ)
  // ==========================================
  const [taxYearlyRent, setTaxYearlyRent] = field('taxYearlyRent', 0)

  // ==========================================
  // 23. AİDAT DAĞITICI
  // ==========================================
  const [aidatTotal, setAidatTotal] = field('aidatTotal', 0)
  const [aidatUnits, setAidatUnits] = field('aidatUnits', 0)

  // ==========================================
  // 24. WEATHER (SAHA HAVA DURUMU)
  // ==========================================
  const [weatherCities, setWeatherCities] = field<string[]>('weatherCities', DEFAULT_WEATHER_CITIES)
  const [cannedReplies, setCannedReplies] = field<CannedReply[]>('cannedReplies', [])
  const isMarketingUser = currentUser?.department === 'Pazarlama'

  // ==========================================
  // 25. TIMER (KRONOMETRE)
  // ==========================================
  const [timer,setTimer]=field('timer',{started:0,elapsed:0})
  const [clock,setClock]=useState(Date.now)
  const isTimerRunning=Boolean(timer.started)
  const timerSeconds=timer.elapsed+(timer.started?Math.max(0,Math.floor((clock-timer.started)/1000)):0)
  useEffect(()=>{if(!isTimerRunning||!isOpen)return;setClock(Date.now());const interval=setInterval(()=>setClock(Date.now()),500);return ()=>clearInterval(interval)},[isTimerRunning,isOpen])

  // ==========================================
  // TOOLS NAVIGATION CONFIG (26 ÇALIŞAN ARAÇ)
  // ==========================================
  const toolsList: { id: ToolType; label: string; icon: any }[] = [
    { id: 'calendar', label: 'Takvim', icon: Calendar },
    { id: 'payments', label: 'Ödemeler', icon: Wallet },
    { id: 'notepad', label: 'Not Defteri', icon: FileText },
    { id: 'calculator', label: 'Hesap Makinesi', icon: Calculator },
    { id: 'currency', label: 'Döviz & Kur', icon: ArrowRightLeft },
    { id: 'mortgage', label: 'Konut Kredisi', icon: TrendingUp },
    { id: 'whatsapp', label: 'WhatsApp Şablon', icon: WhatsAppIcon },
    { id: 'sqmPrice', label: 'm² Birim Fiyat', icon: Layers },
    { id: 'roi', label: 'Kira Amortismanı', icon: Scale },
    { id: 'bargain', label: 'Pazarlık Marjı', icon: Percent },
    { id: 'downpayment', label: 'Peşinat Planı', icon: CreditCard },
    { id: 'parsel', label: 'TKGM Parsel', icon: MapPin },
    { id: 'target', label: 'Satış Hedefi', icon: Target },
    { id: 'reminders', label: 'Tapu Hatırlatıcı', icon: Bell },
    { id: 'qr', label: 'Dijital Kartvizit', icon: QrCode },
    { id: 'market', label: 'Piyasa Endeksi', icon: BarChart3 },
    { id: 'weather', label: 'Hava Durumu', icon: Sun },
    { id: 'timer', label: 'Görüşme Kronometresi', icon: Timer },
    ...(isMarketingUser ? [{ id: 'replies' as const, label: 'Hazır Mesajlar', icon: MessageSquareText }] : []),
  ]

  const currentTool = toolsList.find((t) => t.id === activeTool)

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
          {/* Backdrop Blur Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/65 backdrop-blur-md cursor-pointer"
          />

          {/* QUICK TOOLS WRAPPER (Sol Menü ve Sağ Pencere Birlikte Eşzamanlı Açılır/Kapanır) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 flex items-stretch gap-5 max-w-[96vw] h-[680px] max-h-[90vh]"
          >
            {/* Left Sidebar Menu (Katmansız, doğrudan liste) */}
            <aside className="modal-layerless-aside w-[226px] shrink-0 flex flex-col justify-between py-3 text-[#f5f5f2] select-none">
              <div className="flex-1 overflow-y-auto pr-3.5 space-y-4">
                <div className="modal-aside-heading text-[10px] font-bold uppercase tracking-wider px-3 mb-2 flex items-center justify-between">
                  <span>Uygulamalar</span>
                  <span className="text-[9px]">{toolsList.length} Araç</span>
                </div>
                <nav className="space-y-1">
                  {toolsList.map((tool) => {
                    const Icon = tool.icon
                    const isActive = activeTool === tool.id
                    return (
                      <button
                        key={tool.id}
                        type="button"
                        onClick={() => setActiveTool(tool.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-full text-xs transition-colors cursor-pointer text-left ${
                          isActive
                            ? 'bg-[#b99881] text-white font-bold is-active-aside-btn'
                            : 'hover:bg-white/12 font-medium'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{tool.label}</span>
                      </button>
                    )
                  })}
                </nav>
              </div>
            </aside>

            {/* Sağ Pencere */}
            <div
              className={`glass-modal ${
                activeTool === 'calendar' ? 'w-[960px]' : 'w-[820px]'
              } max-w-[calc(96vw-242px)] h-full rounded-[32px] bg-[#282522] border border-[#4a443f] shadow-2xl flex flex-col overflow-hidden text-[#f3efe9] select-none font-sans relative transition-[width] duration-200`}
            >
              {/* Modal Header */}
              <div className="px-7 pt-5 pb-2 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  {currentTool ? <currentTool.icon className="w-4.5 h-4.5 text-[#b99881] shrink-0" /> : <Calculator className="w-4.5 h-4.5 text-[#b99881] shrink-0" />}
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-white tracking-wide truncate">
                      {currentTool?.label || 'Başlat Uygulaması'}
                    </h2>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-full text-[#a69f99] hover:text-white hover:bg-black/5 transition-colors cursor-pointer"
                  title="Kapat"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {tools.state.error&&<div role="alert" className="px-6 py-2 text-sm">{tools.state.error} {tools.state.conflict?<><button onClick={()=>void tools.resolve(false)}>Sunucudakini kullan</button> · <button onClick={()=>void tools.resolve(true)}>Düzenlememi kaydet</button></>:<button onClick={tools.retry}>Tekrar dene</button>}</div>}
              {!tools.state.ready&&!tools.state.error&&<p role="status" className="px-6">Araç verileri yükleniyor…</p>}
              {tools.state.saving&&<small role="status" className="px-6">Kaydediliyor…</small>}
              {/* Right Content Area */}
              <div hidden={!tools.state.ready} inert={!tools.state.ready||tools.state.conflict||undefined} className="flex-1 p-7 pt-4 overflow-y-auto space-y-4">

                {/* ---------------------------------------------------- */}
                {/* TOOL 0: ÖDEMELER (PAYMENTS & EXPENSE TRACKER)        */}
                {/* ---------------------------------------------------- */}
                {activeTool === 'payments' && (
                  <div className="space-y-4">
                    {/* Payment Add Form */}
                    <form onSubmit={handleAddPayment} className="p-4 sm:p-5 rounded-2xl bg-[#282522] border border-[#4a443f] space-y-3.5">
                      <div className="text-base font-bold text-white flex items-center gap-2">
                        <Wallet className="w-4.5 h-4.5 text-[#b99881]" />
                        <span>Yeni Ödeme Kaydı Ekle</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                        <div className="sm:col-span-6">
                          <label className="text-sm font-medium text-[#d6beae] block mb-1.5">
                            Satın Alınan (Hizmet / Ürün / Masraf) *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Örn: Noter tasdik masrafı, Reklam bütçesi..."
                            value={newPaymentItem}
                            onChange={(e) => setNewPaymentItem(e.target.value)}
                            className="w-full bg-[#1c1a18] border border-[#4a443f] focus:border-[#b99881] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none placeholder-[#8c857f]"
                          />
                        </div>

                        <div className="sm:col-span-3">
                          <label className="text-sm font-medium text-[#d6beae] block mb-1.5">
                            Ödeme Tutarı (₺) *
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            required
                            placeholder="Örn: 5000"
                            value={newPaymentAmount}
                            onChange={(e) => {
                              const raw = e.target.value
                              if (raw.startsWith('-')) return
                              setNewPaymentAmount(raw)
                            }}
                            className="w-full bg-[#1c1a18] border border-[#4a443f] focus:border-[#b99881] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none placeholder-[#8c857f] font-mono"
                          />
                        </div>

                        <div className="sm:col-span-3">
                          <label className="text-sm font-medium text-[#d6beae] block mb-1.5">
                            Tarih
                          </label>
                          <input
                            type="date"
                            value={newPaymentDate}
                            onChange={(e) => setNewPaymentDate(e.target.value)}
                            className="w-full bg-[#1c1a18] border border-[#4a443f] focus:border-[#b99881] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end pt-1">
                        <GlassButton
                          variant="gold"
                          size="sm"
                          type="submit"
                          icon={<Plus className="w-4 h-4" />}
                          className="rounded-full px-6 py-2.5 text-base font-semibold"
                        >
                          Ödemeyi Kaydet
                        </GlassButton>
                      </div>
                    </form>

                    {/* Payments List */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm text-[#d6beae] px-1">
                        <span className="font-bold uppercase tracking-wider text-sm">
                          Kayıtlı Ödemeler ({payments.length})
                        </span>
                        <span className="text-xs sm:text-sm text-[#8c857f]">Kronolojik Liste</span>
                      </div>

                      {payments.length === 0 ? (
                        <div className="p-8 text-center rounded-2xl bg-[#282522]/50 border border-[#4a443f] text-[#a69f99] text-sm">
                          Henüz kaydedilmiş ödeme bulunmuyor. Yukarıdaki formdan yeni ödeme ekleyebilirsiniz.
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                          {payments.map((p) => (
                            <div
                              key={p.id}
                              className="p-3.5 rounded-2xl bg-[#282522] border border-[#4a443f] hover:border-[#b99881]/50 transition-colors flex items-center justify-between gap-3 group"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="text-base font-bold text-white truncate">
                                  {p.item}
                                </div>
                                <div className="text-xs text-[#8c857f] mt-0.5 flex items-center gap-2">
                                  <span>{p.date}</span>
                                  <span>•</span>
                                  <span className="text-[#d6beae]">Ödeme Notu</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-base font-bold font-mono text-[#b99881]">
                                  {formatCurrency(p.amount)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePayment(p.id)}
                                  className="p-1.5 rounded-lg text-[#8c857f] hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                  title="Sil"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* ALTTINDA TOPLAM GÖSTERİMİ: TIKLANMADIĞI SÜRECE TOPLAM GÖRÜNMEZ */}
                    <div className="pt-3 border-t border-[#4a443f]">
                      <div
                        onClick={() => setIsTotalRevealed(!isTotalRevealed)}
                        className="p-4 rounded-2xl bg-[#282522] border border-[#4a443f] hover:border-[#b99881]/60 transition-all cursor-pointer select-none group flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="w-10 h-10 rounded-xl bg-[#1c1a18] border border-[#4a443f] flex items-center justify-center text-[#b99881] group-hover:scale-105 transition-transform">
                            {isTotalRevealed ? (
                              <EyeOff className="w-5 h-5 text-[#b99881]" />
                            ) : (
                              <Eye className="w-5 h-5 text-[#8c857f]" />
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-[#b99881] uppercase tracking-wider">
                              Genel Toplam Ödeme
                            </div>
                            <div className="text-sm text-[#d6beae]">
                              {isTotalRevealed ? 'Gizlemek için tıklayın' : 'Görmek için tıklayın (Gizli)'}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          {isTotalRevealed ? (
                            <div className="text-xl font-bold font-mono text-emerald-400">
                              {formatCurrency(totalPaymentsAmount)}
                            </div>
                          ) : (
                            <div className="text-xl font-bold font-mono text-[#8c857f] tracking-widest flex items-center justify-end gap-1">
                              <span>••••••</span>
                              <span className="text-sm font-normal">₺</span>
                            </div>
                          )}
                          <div className="text-xs text-[#8c857f]">
                            {payments.length} adet ödeme kalemi
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ---------------------------------------------------- */}
                {/* TOOL 1: NOT DEFTERİ (NOTEPAD)                        */}
                {/* ---------------------------------------------------- */}
        {activeTool === 'notepad' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-h-[360px]">
            {/* Notes List Column */}
            <div className="p-3.5 rounded-2xl bg-[#282522] border border-[#4a443f] flex flex-col justify-between space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between pb-2 border-b border-[#4a443f]">
                  <span className="text-sm font-bold text-white flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#b99881]" />
                    Notlarım ({visibleNotes.length})
                  </span>
                  <button
                    onClick={handleCreateNote}
                    className="p-1 rounded-full bg-[#34302d] hover:bg-[#b99881] hover:text-[#1c1a18] text-[#d6beae] transition-colors cursor-pointer"
                    title="Yeni Not Ekle"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
                  {visibleNotes.map((note) => {
                    return (
                      <div
                        key={note.id}
                        onClick={() => setSelectedNoteId(note.id)}
                        className={`p-2.5 rounded-xl cursor-pointer transition-all border ${
                          activeNote?.id === note.id
                            ? 'bg-[#34302d] border-[#b99881] text-white shadow-sm'
                            : 'bg-[#24211f] border-transparent text-[#a69f99] hover:text-white hover:bg-[#2e2a27]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <h5 className="text-sm font-bold truncate">
                            {note.title || 'Başlıksız Not'}
                          </h5>
                        </div>
                        <p className="text-xs text-[#8c857f] truncate mt-0.5">
                          {note.content || 'İçerik boş...'}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>

              <span className="text-xs text-[#8c857f] block text-center">
                Notlarınız kişisel hesabınıza kaydedilir.
              </span>
            </div>

            {/* Note Editor Column */}
            <div className="md:col-span-2 p-4 rounded-2xl bg-[#282522] border border-[#4a443f] flex flex-col justify-between space-y-3 relative">
              {activeNote ? (
                <div className="space-y-3 flex-1 flex flex-col">
                  <div className="flex items-center justify-between gap-3">
                    <input
                      type="text"
                      value={activeNote.title}
                      onChange={(e) => handleUpdateActiveNote({ title: e.target.value })}
                      placeholder="Not Başlığı..."
                      className="w-full bg-transparent text-sm font-bold text-white focus:outline-none placeholder-[#8c857f]"
                    />
                    <div className="flex items-center gap-1.5 shrink-0">

                      <button
                        onClick={() => copyToClipboard(activeNote.content, 'note')}
                        className="p-1.5 rounded-lg bg-[#34302d] hover:bg-white/10 text-[#d6beae] text-xs flex items-center gap-1 cursor-pointer"
                        title="Metni Kopyala"
                      >
                        {copied === 'note' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteNote(activeNote.id)}
                        className="p-1.5 rounded-lg bg-[#34302d] hover:bg-rose-500/20 text-[#a69f99] hover:text-rose-400 cursor-pointer"
                        title="Notu Sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>


                  <textarea
                    rows={8}
                    value={activeNote.content}
                    onChange={(e) => handleUpdateActiveNote({ content: e.target.value })}
                    placeholder="Müşteri talepleri, telefonlar, hatırlatmalar ve portföy bilgileri..."
                    className="w-full flex-1 bg-[#1c1a18]/60 border border-[#4a443f] rounded-xl p-3 text-sm text-[#f3efe9] focus:outline-none focus:border-[#b99881] resize-none"
                  />

                  <div className="flex items-center justify-between text-xs text-[#8c857f]">
                    <span>{activeNote.content.length} karakter</span>
                    <span>Güncellendi: {activeNote.updatedAt}</span>
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-[#8c857f]">
                  Henüz seçili not yok. 'Yeni Not' butonuna tıklayın.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TOOL 2: HESAP MAKİNESİ (CALCULATOR)                  */}
        {/* ---------------------------------------------------- */}
        {activeTool === 'calculator' && (
          <div className="max-w-md mx-auto p-5 rounded-[28px] bg-[#282522] border border-[#4a443f] shadow-xl space-y-4">
            {/* Display */}
            <div className="p-4 rounded-2xl bg-[#1c1a18] border border-[#4a443f] text-right space-y-1">
              <div className="text-xs font-mono text-[#8c857f] h-4">{calcPrev}</div>
              <div className="text-2xl font-mono font-bold text-white tracking-wide truncate">
                {calcInput}
              </div>
            </div>

            {/* Quick Real Estate Presets */}
            <div className="grid grid-cols-2 gap-1.5">


              <button
                onClick={() => handleCalcQuickPercentage(0.2)}
                className="py-2 rounded-xl bg-[#34302d] hover:bg-[#b99881] hover:text-[#1c1a18] text-sm font-bold text-[#b99881] transition-colors"
                title="Yüzde 20 KDV"
              >
                %20 KDV
              </button>
              <button
                onClick={() => handleCalcQuickPercentage(0.1)}
                className="py-2 rounded-xl bg-[#34302d] hover:bg-[#b99881] hover:text-[#1c1a18] text-sm font-bold text-[#b99881] transition-colors"
                title="Yüzde 10 Kapora"
              >
                %10 Kapora
              </button>
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-4 gap-2 text-base font-bold">
              <button onClick={handleCalcClear} className="p-3 rounded-xl bg-[#3d3733] text-rose-400 hover:bg-rose-500/20">C</button>
              <button onClick={() => setCalcInput(String(-parseFloat(calcInput)))} className="p-3 rounded-xl bg-[#34302d] text-[#a69f99] hover:bg-white/10">±</button>
              <button onClick={() => handleCalcQuickPercentage(0.01)} className="p-3 rounded-xl bg-[#34302d] text-[#a69f99] hover:bg-white/10">%</button>
              <button onClick={() => handleCalcOp('÷')} className="p-3 rounded-xl bg-[#423c38] text-[#b99881] hover:bg-[#b99881] hover:text-[#1c1a18]">÷</button>

              <button onClick={() => handleCalcDigit('7')} className="p-3 rounded-xl bg-[#2e2a27] text-white hover:bg-[#3d3733]">7</button>
              <button onClick={() => handleCalcDigit('8')} className="p-3 rounded-xl bg-[#2e2a27] text-white hover:bg-[#3d3733]">8</button>
              <button onClick={() => handleCalcDigit('9')} className="p-3 rounded-xl bg-[#2e2a27] text-white hover:bg-[#3d3733]">9</button>
              <button onClick={() => handleCalcOp('×')} className="p-3 rounded-xl bg-[#423c38] text-[#b99881] hover:bg-[#b99881] hover:text-[#1c1a18]">×</button>

              <button onClick={() => handleCalcDigit('4')} className="p-3 rounded-xl bg-[#2e2a27] text-white hover:bg-[#3d3733]">4</button>
              <button onClick={() => handleCalcDigit('5')} className="p-3 rounded-xl bg-[#2e2a27] text-white hover:bg-[#3d3733]">5</button>
              <button onClick={() => handleCalcDigit('6')} className="p-3 rounded-xl bg-[#2e2a27] text-white hover:bg-[#3d3733]">6</button>
              <button onClick={() => handleCalcOp('-')} className="p-3 rounded-xl bg-[#423c38] text-[#b99881] hover:bg-[#b99881] hover:text-[#1c1a18]">-</button>

              <button onClick={() => handleCalcDigit('1')} className="p-3 rounded-xl bg-[#2e2a27] text-white hover:bg-[#3d3733]">1</button>
              <button onClick={() => handleCalcDigit('2')} className="p-3 rounded-xl bg-[#2e2a27] text-white hover:bg-[#3d3733]">2</button>
              <button onClick={() => handleCalcDigit('3')} className="p-3 rounded-xl bg-[#2e2a27] text-white hover:bg-[#3d3733]">3</button>
              <button onClick={() => handleCalcOp('+')} className="p-3 rounded-xl bg-[#423c38] text-[#b99881] hover:bg-[#b99881] hover:text-[#1c1a18]">+</button>

              <button onClick={() => handleCalcDigit('0')} className="p-3 rounded-xl col-span-2 bg-[#2e2a27] text-white hover:bg-[#3d3733]">0</button>
              <button onClick={() => handleCalcDigit('.')} className="p-3 rounded-xl bg-[#2e2a27] text-white hover:bg-[#3d3733]">,</button>
              <button onClick={handleCalcEquals} className="p-3 rounded-xl bg-[#b99881] text-[#1c1a18] font-bold hover:bg-[#d6beae]">=</button>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TOOL 4: DÖVİZ & KUR ÇEVİRİCİ                         */}
        {/* ---------------------------------------------------- */}
        {activeTool === 'currency' && (
          <CurrencyTool amount={currencyAmount} onAmountChange={setCurrencyAmount} base={baseCurrency} onBaseChange={setBaseCurrency} />
        )}

        {/* ---------------------------------------------------- */}
        {/* TOOL 5: KONUT KREDİSİ & TAKSİT                       */}
        {/* ---------------------------------------------------- */}
        {activeTool === 'mortgage' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-[#d6beae] block mb-1.5">Kredi Tutarı (₺)</label>
                <input
                  type="number"
                  step="50000"
                  value={mortgageLoan}
                  onChange={(e) => setMortgageLoan(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#282522] border border-[#4a443f] rounded-xl px-3.5 py-2 text-sm font-bold text-white focus:outline-none focus:border-[#b99881]"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#d6beae] block mb-1.5">Aylık Faiz Oranı (%)</label>
                <input
                  type="number"
                  step="0.05"
                  value={mortgageRate}
                  onChange={(e) => setMortgageRate(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#282522] border border-[#4a443f] rounded-xl px-3.5 py-2 text-sm font-bold text-white focus:outline-none focus:border-[#b99881]"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#d6beae] block mb-1.5">Vade (Ay)</label>
                <CustomSelect
                  value={mortgageMonths}
                  onChange={(e) => setMortgageMonths(parseInt(e.target.value) || 120)}
                  className="w-full bg-[#282522] border border-[#4a443f] rounded-xl px-3.5 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-[#b99881]"
                >
                  <option value="36">36 Ay (3 Yıl)</option>
                  <option value="60">60 Ay (5 Yıl)</option>
                  <option value="84">84 Ay (7 Yıl)</option>
                  <option value="120">120 Ay (10 Yıl)</option>
                </CustomSelect>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-[#282522] border border-[#b99881]/50">
                <span className="text-sm font-medium text-[#c4bcb5]">Aylık Taksit Tutarı</span>
                <p className="text-xl font-bold text-[#b99881] mt-1">{formatCurrency(monthlyPayment)}</p>
                <span className="text-xs sm:text-sm text-[#8c857f]">{mortgageMonths} ay sabit ödeme</span>
              </div>
              <div className="p-4 rounded-2xl bg-[#282522] border border-[#4a443f]">
                <span className="text-sm font-medium text-[#c4bcb5]">Toplam Geri Ödeme</span>
                <p className="text-xl font-bold text-white mt-1">{formatCurrency(totalRepayment)}</p>
                <span className="text-xs sm:text-sm text-[#8c857f]">Ana para + faiz toplamı</span>
              </div>
              <div className="p-4 rounded-2xl bg-[#282522] border border-[#4a443f]">
                <span className="text-sm font-medium text-[#c4bcb5]">Toplam Faiz Yükü</span>
                <p className="text-xl font-bold text-amber-400 mt-1">{formatCurrency(totalInterest)}</p>
                <span className="text-xs sm:text-sm text-[#8c857f]">Vade boyunca ödenecek faiz</span>
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TOOL 7: WHATSAPP ŞABLONLARI                         */}
        {/* ---------------------------------------------------- */}
        {activeTool === 'whatsapp' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium text-[#d6beae] block mb-1.5">Müşteri Hitap</label>
                <input
                  type="text"
                  value={waClientName}
                  onChange={(e) => setWaClientName(e.target.value)}
                  className="w-full bg-[#282522] border border-[#4a443f] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#d6beae] block mb-1.5">Proje / Mülk</label>
                <input
                  type="text"
                  value={waProperty}
                  onChange={(e) => setWaProperty(e.target.value)}
                  className="w-full bg-[#282522] border border-[#4a443f] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#d6beae] block mb-1.5">Şablon Türü</label>
                <CustomSelect
                  value={waTemplateType}
                  onChange={(e) => setWaTemplateType(e.target.value as any)}
                  className="w-full bg-[#282522] border border-[#4a443f] rounded-xl px-3.5 py-2.5 text-sm font-bold text-white focus:outline-none"
                >
                  <option value="sunum">Katalog & Sunum Paylaşımı</option>
                  <option value="randevu">Lansman Ofisi Randevusu</option>
                  <option value="teklif">Fiyat & Teklif Özeti</option>
                  <option value="kapora">Kapora & Rezervasyon Bilgisi</option>
                </CustomSelect>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#1c1a18] border border-[#4a443f] space-y-3">
              <span className="text-sm font-bold text-[#b99881] block">WhatsApp Mesaj Önizlemesi</span>
              <pre className="text-sm text-[#e2ddd5] whitespace-pre-wrap font-sans leading-relaxed">
                {generateWaText()}
              </pre>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <GlassButton
                variant="subtle"
                size="sm"
                icon={copied === 'wa' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                onClick={() => copyToClipboard(generateWaText(), 'wa')}
                className="rounded-full px-4"
              >
                {copied === 'wa' ? 'Kopyalandı' : 'Metni Kopyala'}
              </GlassButton>

              <GlassButton
                variant="gold"
                size="sm"
                icon={<WhatsAppIcon className="w-3.5 h-3.5" />}
                onClick={() => window.open(generateWhatsAppUrl('905320000000', generateWaText()), '_blank')}
                className="rounded-full px-5"
              >
                WhatsApp Web'de Aç
              </GlassButton>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TOOL 8: METREKARE BİRİM FİYAT & VERİMLİLİK          */}
        {/* ---------------------------------------------------- */}
        {activeTool === 'sqmPrice' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium text-[#d6beae] block mb-1.5">Toplam Satış Bedeli (₺)</label>
                <input
                  type="number"
                  step="50000"
                  value={sqmPriceTotal}
                  onChange={(e) => setSqmPriceTotal(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#282522] border border-[#4a443f] rounded-xl px-3.5 py-2 text-sm font-bold text-white focus:outline-none focus:border-[#b99881]"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#d6beae] block mb-1.5">Brüt Alan (m²)</label>
                <input
                  type="number"
                  value={sqmGross}
                  onChange={(e) => setSqmGross(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#282522] border border-[#4a443f] rounded-xl px-3.5 py-2 text-sm font-bold text-white focus:outline-none focus:border-[#b99881]"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#d6beae] block mb-1.5">Net Alan (m²)</label>
                <input
                  type="number"
                  value={sqmNet}
                  onChange={(e) => setSqmNet(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#282522] border border-[#4a443f] rounded-xl px-3.5 py-2 text-sm font-bold text-white focus:outline-none focus:border-[#b99881]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-4 rounded-2xl bg-[#282522] border border-[#4a443f]">
                <span className="text-sm font-medium text-[#c4bcb5]">Brüt m² Birim Fiyatı</span>
                <p className="text-xl font-bold text-white mt-1">{formatCurrency(grossUnit)} / m²</p>
                <span className="text-xs sm:text-sm text-[#8c857f]">{sqmGross} m² brüt üzerinden</span>
              </div>
              <div className="p-4 rounded-2xl bg-[#282522] border border-[#b99881]/40">
                <span className="text-sm font-medium text-[#c4bcb5]">Net m² Birim Fiyatı</span>
                <p className="text-xl font-bold text-[#b99881] mt-1">{formatCurrency(netUnit)} / m²</p>
                <span className="text-xs sm:text-sm text-[#8c857f]">{sqmNet} m² net kullanım alanı</span>
              </div>
              <div className="p-4 rounded-2xl bg-[#282522] border border-[#4a443f]">
                <span className="text-sm font-medium text-[#c4bcb5]">Net / Brüt Verimlilik Oranı</span>
                <p className="text-xl font-bold text-emerald-400 mt-1">%{efficiency}</p>
                <span className="text-xs sm:text-sm text-[#8c857f]">
                  {efficiency >= 80 ? 'Yüksek verimli kat planı' : 'Standart kat planı'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TOOL 9: KİRA AMORTİSMANI (ROI)                       */}
        {/* ---------------------------------------------------- */}
        {activeTool === 'roi' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium text-[#d6beae] block mb-1.5">Satın Alma Bedeli (₺)</label>
                <input
                  type="number"
                  step="100000"
                  value={roiPrice}
                  onChange={(e) => setRoiPrice(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#282522] border border-[#4a443f] rounded-xl px-3.5 py-2 text-sm font-bold text-white focus:outline-none focus:border-[#b99881]"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#d6beae] block mb-1.5">Aylık Beklenen Kira (₺)</label>
                <input
                  type="number"
                  step="1000"
                  value={roiRent}
                  onChange={(e) => setRoiRent(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#282522] border border-[#4a443f] rounded-xl px-3.5 py-2 text-sm font-bold text-white focus:outline-none focus:border-[#b99881]"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#d6beae] block mb-1.5">Aylık Aidat/Yönetim (₺)</label>
                <input
                  type="number"
                  step="250"
                  value={roiDues}
                  onChange={(e) => setRoiDues(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#282522] border border-[#4a443f] rounded-xl px-3.5 py-2 text-sm font-bold text-white focus:outline-none focus:border-[#b99881]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-4 rounded-2xl bg-[#282522] border border-[#4a443f]">
                <span className="text-sm font-medium text-[#c4bcb5]">Amortisman Süresi</span>
                <p className="text-xl font-bold text-emerald-400 mt-1">{roiYears} Yıl</p>
                <span className="text-xs sm:text-sm text-[#8c857f]">Geri dönüş yılı</span>
              </div>
              <div className="p-4 rounded-2xl bg-[#282522] border border-[#b99881]/40">
                <span className="text-sm font-medium text-[#c4bcb5]">Yıllık Net Getiri (Yield)</span>
                <p className="text-xl font-bold text-[#b99881] mt-1">%{roiYield}</p>
                <span className="text-xs sm:text-sm text-[#8c857f]">Yıllık net getiri oranı</span>
              </div>
              <div className="p-4 rounded-2xl bg-[#282522] border border-[#4a443f]">
                <span className="text-sm font-medium text-[#c4bcb5]">Yıllık Net Kira Hacmi</span>
                <p className="text-xl font-bold text-white mt-1">{formatCurrency(roiYearlyNet)}</p>
                <span className="text-xs sm:text-sm text-[#8c857f]">Aidat düşülmüş net</span>
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TOOL 10: PAZARLIK & İNDİRİM MARJI                   */}
        {/* ---------------------------------------------------- */}
        {activeTool === 'bargain' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-[#d6beae] block mb-1.5">Liste / İlan Fiyatı (₺)</label>
                <input
                  type="number"
                  step="50000"
                  value={bargainListed}
                  onChange={(e) => setBargainListed(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#282522] border border-[#4a443f] rounded-xl px-3.5 py-2 text-sm font-bold text-white focus:outline-none focus:border-[#b99881]"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#d6beae] block mb-1.5">Alıcı Teklifi (₺)</label>
                <input
                  type="number"
                  step="50000"
                  value={bargainOffer}
                  onChange={(e) => setBargainOffer(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#282522] border border-[#4a443f] rounded-xl px-3.5 py-2 text-sm font-bold text-white focus:outline-none focus:border-[#b99881]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-4 rounded-2xl bg-[#282522] border border-[#4a443f]">
                <span className="text-sm font-medium text-[#c4bcb5]">İskonto Tutarı</span>
                <p className="text-xl font-bold text-rose-400 mt-1">{formatCurrency(bargainDiscount)}</p>
                <span className="text-xs sm:text-sm text-[#8c857f]">Pazarlık indirimi</span>
              </div>
              <div className="p-4 rounded-2xl bg-[#282522] border border-[#b99881]/40">
                <span className="text-sm font-medium text-[#c4bcb5]">İskonto Oranı</span>
                <p className="text-xl font-bold text-[#b99881] mt-1">%{bargainRate}</p>
                <span className="text-xs sm:text-sm text-[#8c857f]">Liste fiyatına oranla</span>
              </div>

            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TOOL 11: PEŞİNAT & ARA ÖDEME PLANI                  */}
        {/* ---------------------------------------------------- */}
        {activeTool === 'downpayment' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-sm font-medium text-[#d6beae] block mb-1.5">Toplam Bedel (₺)</label>
                <input
                  type="number"
                  min="0"
                  step="100000"
                  value={downTotal}
                  onChange={(e) => {
                    const val = e.target.value.trim()
                    if (val === '') {
                      setDownTotal('')
                    } else {
                      const parsed = parseFloat(val)
                      setDownTotal(isNaN(parsed) ? '' : Math.max(0, parsed))
                    }
                  }}
                  className="w-full bg-[#282522] border border-[#4a443f] rounded-xl px-3.5 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-[#b99881]"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#d6beae] block mb-1.5">Peşinat (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={downRate}
                  onChange={(e) => {
                    const val = e.target.value.trim()
                    if (val === '') {
                      setDownRate('')
                    } else {
                      const parsed = parseFloat(val)
                      setDownRate(isNaN(parsed) ? '' : Math.max(0, Math.min(100, parsed)))
                    }
                  }}
                  className="w-full bg-[#282522] border border-[#4a443f] rounded-xl px-3.5 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-[#b99881]"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#d6beae] block mb-1.5">Ara Ödeme Tutarı (₺)</label>
                <input
                  type="number"
                  min="0"
                  step="50000"
                  value={downInterimAmount}
                  onChange={(e) => {
                    const val = e.target.value.trim()
                    if (val === '') {
                      setDownInterimAmount('')
                    } else {
                      const parsed = parseFloat(val)
                      setDownInterimAmount(isNaN(parsed) ? '' : Math.max(0, parsed))
                    }
                  }}
                  className="w-full bg-[#282522] border border-[#4a443f] rounded-xl px-3.5 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-[#b99881]"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#d6beae] block mb-1.5">Vade (Ay)</label>
                <input
                  type="number"
                  min="0"
                  value={downMonths}
                  onChange={(e) => {
                    const val = e.target.value.trim()
                    if (val === '') {
                      setDownMonths('')
                    } else {
                      const parsed = parseInt(val, 10)
                      setDownMonths(isNaN(parsed) ? '' : Math.max(0, parsed))
                    }
                  }}
                  className="w-full bg-[#282522] border border-[#4a443f] rounded-xl px-3.5 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-[#b99881]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-4 rounded-2xl bg-[#282522] border border-[#4a443f]">
                <span className="text-sm font-medium text-[#c4bcb5]">İlk Peşinat</span>
                <p className="text-xl font-bold text-white mt-1">{formatCurrency(downInitial)}</p>
                <span className="text-xs sm:text-sm text-[#8c857f]">%{activeDownRate} oranında</span>
              </div>
              <div className="p-4 rounded-2xl bg-[#282522] border border-[#b99881]/40">
                <span className="text-sm font-medium text-[#c4bcb5]">Aylık Eşit Taksit</span>
                <p className="text-xl font-bold text-emerald-400 mt-1">{formatCurrency(downMonthly)}</p>
                <span className="text-xs sm:text-sm text-[#8c857f]">
                  {activeDownMonths > 0 ? `${activeDownMonths} ay boyunca` : 'Kalan bakiye: ' + formatCurrency(downRemaining)}
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-[#282522] border border-[#4a443f]">
                <span className="text-sm font-medium text-[#c4bcb5]">Ara Ödeme</span>
                <p className="text-xl font-bold text-[#b99881] mt-1">{formatCurrency(downTotalInterim)}</p>
                <span className="text-xs sm:text-sm text-[#8c857f]">Toplam bedelden düşülen</span>
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TOOL 12: TKGM PARSEL & İMAR                         */}
        {/* ---------------------------------------------------- */}
        {activeTool === 'parsel' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-sm font-medium text-[#d6beae] block mb-1.5">İl</label>
                <input
                  type="text"
                  value={parselCity}
                  onChange={(e) => setParselCity(e.target.value)}
                  className="w-full bg-[#282522] border border-[#4a443f] rounded-xl px-3.5 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#d6beae] block mb-1.5">İlçe</label>
                <input
                  type="text"
                  value={parselDistrict}
                  onChange={(e) => setParselDistrict(e.target.value)}
                  className="w-full bg-[#282522] border border-[#4a443f] rounded-xl px-3.5 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#d6beae] block mb-1.5">Ada No</label>
                <input
                  type="text"
                  value={parselAda}
                  onChange={(e) => setParselAda(e.target.value)}
                  className="w-full bg-[#282522] border border-[#4a443f] rounded-xl px-3.5 py-2 text-sm text-white font-mono"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#d6beae] block mb-1.5">Parsel No</label>
                <input
                  type="text"
                  value={parselNo}
                  onChange={(e) => setParselNo(e.target.value)}
                  className="w-full bg-[#282522] border border-[#4a443f] rounded-xl px-3.5 py-2 text-sm text-white font-mono"
                />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#282522] border border-[#4a443f] flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-sm font-bold text-white block">TKGM Parsel Sorgu Entegrasyonu</span>
                <span className="text-xs sm:text-sm text-[#8c857f]">Resmi Tapu ve Kadastro Genel Müdürlüğü CBS harita sorgusu</span>
              </div>
              <a
                href="https://parselsorgu.tkgm.gov.tr/"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-full bg-[#b99881] text-[#1c1a18] font-bold text-xs flex items-center gap-1.5 shadow-sm hover:bg-[#d6beae] transition-colors"
              >
                <span>TKGM'de Aç</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-[#282522] border border-[#4a443f]">
                <span className="text-sm font-medium text-[#c4bcb5]">Taban Alanı (TAKS: {parselTaks})</span>
                <p className="text-xl font-bold text-white mt-1">{Math.round(parselArea * parselTaks)} m²</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#282522] border border-[#4a443f]">
                <span className="text-sm font-medium text-[#c4bcb5]">Toplam İnşaat Alanı (KAKS: {parselKaks})</span>
                <p className="text-xl font-bold text-[#b99881] mt-1">{Math.round(parselArea * parselKaks)} m²</p>
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TOOL 13: COMPASS (GÜNEŞ & CEPHE)                    */}
        {/* ---------------------------------------------------- */}
        {activeTool === 'compass' && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              {(['guney', 'dogu', 'bati', 'kuzey'] as const).map((dir) => (
                <button
                  key={dir}
                  onClick={() => setCompassDir(dir)}
                  className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                    compassDir === dir
                      ? 'bg-[#b99881] text-[#1c1a18] border-[#b99881] font-bold'
                      : 'bg-[#282522] text-[#a69f99] border-[#4a443f] hover:text-white'
                  }`}
                >
                  <span className="capitalize text-xs block font-bold">{dir} Cephe</span>
                </button>
              ))}
            </div>

            <div className="p-5 rounded-2xl bg-[#282522] border border-[#4a443f] space-y-2">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Compass className="w-4 h-4 text-[#b99881]" />
                <span className="capitalize">{compassDir} Cephe Özellikleri & Müşteri Notu</span>
              </h4>
              <p className="text-xs text-[#c4bcb5] leading-relaxed">
                {compassDir === 'guney' &&
                  'Günün en verimli saatlerinde (11:00 - 17:00) kesintisiz doğal güneş ışığı. Isınma maliyetlerinde %30\'a varan tasarruf sağlar. Salon ve ebeveyn yatak odası için piyasada en çok talep gören ve değeri artan yöndür.'}
                {compassDir === 'dogu' &&
                  'Sabahın erken saatlerinde aydınlık ve ferah başlangıç. Yaz aylarında öğleden sonra serin ve konforludur. Mutfak ve çocuk odası için en ideal ışık açısına sahiptir.'}
                {compassDir === 'bati' &&
                  'Öğleden sonra ve akşamüstü gün batımı ışığı alır. Kışın öğleden sonra evi ısıtır. Özellikle akşam saatlerini evde geçiren çalışan kitle için keyifli bir yaşam alanı sunar.'}
                {compassDir === 'kuzey' &&
                  'Homojen, parlamasız ve dengeli dolaylı ışık. Yazın aşırı sıcaklardan korunmak ve serin kalmak isteyenler, kütüphane ve çalışma odaları için tercih sebebidir.'}
              </p>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TOOL 14: VALUATION (EKSPERTİZ & DEĞERLEME)          */}
        {/* ---------------------------------------------------- */}
        {activeTool === 'valuation' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-sm font-medium text-[#d6beae] block mb-1.5">Emsal m² Fiyatı (₺)</label>
                <input
                  type="number"
                  step="5000"
                  value={valSqm}
                  onChange={(e) => setValSqm(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#282522] border border-[#4a443f] rounded-xl px-3.5 py-2 text-sm text-white font-bold"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#d6beae] block mb-1.5">Brüt m²</label>
                <input
                  type="number"
                  value={valGross}
                  onChange={(e) => setValGross(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#282522] border border-[#4a443f] rounded-xl px-3.5 py-2 text-sm text-white font-bold"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#d6beae] block mb-1.5">Bina Yaşı</label>
                <CustomSelect
                  value={valAge}
                  onChange={(e: any) => setValAge(e.target.value)}
                  className="w-full bg-[#282522] border border-[#4a443f] rounded-xl px-3.5 py-2 text-sm text-white"
                >
                  <option value="0">Sıfır / Yeni</option>
                  <option value="1-5">1 - 5 Yaş</option>
                  <option value="6-15">6 - 15 Yaş</option>
                  <option value="16+">16+ Yaş</option>
                </CustomSelect>
              </div>
              <div>
                <label className="text-sm font-medium text-[#d6beae] block mb-1.5">Kat Konumu</label>
                <CustomSelect
                  value={valFloor}
                  onChange={(e: any) => setValFloor(e.target.value)}
                  className="w-full bg-[#282522] border border-[#4a443f] rounded-xl px-3.5 py-2 text-sm text-white"
                >
                  <option value="ara">Ara Kat</option>
                  <option value="giris">Giriş / Bahçe</option>
                  <option value="dubleks">Çatı Dubleks</option>
                </CustomSelect>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#282522] border border-[#b99881]/40 flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-[#d6beae] block mb-1">Tahmini Piyasa Ekspertiz Değeri</span>
                <p className="text-2xl font-bold text-white mt-1">
                  {formatCurrency(
                    Math.round(
                      valSqm *
                        valGross *
                        (valAge === '0' ? 1.05 : valAge === '1-5' ? 1 : valAge === '6-15' ? 0.9 : 0.8) *
                        (valFloor === 'ara' ? 1.05 : 1)
                    )
                  )}
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-[#b99881]/20 text-[#b99881] text-xs font-bold">
                Emsal Analizi
              </span>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TOOL 15: CONTRACTS (HAZIR SÖZLEŞMELER)              */}
        {/* ---------------------------------------------------- */}
        {activeTool === 'contracts' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              {(['yerGosterme', 'yetki', 'kapora'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setContractType(type)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    contractType === type ? 'bg-[#b99881] text-[#1c1a18] font-bold' : 'bg-[#282522] text-[#a69f99]'
                  }`}
                >
                  {type === 'yerGosterme' ? 'Yer Gösterme' : type === 'yetki' ? 'Yetki Belgesi' : 'Kapora Protokolü'}
                </button>
              ))}
            </div>

            <div className="p-4 rounded-2xl bg-[#1e1c1a] border border-[#4a443f] text-xs font-mono text-[#c4bcb5] leading-relaxed whitespace-pre-line max-h-48 overflow-y-auto">
              {contractType === 'yerGosterme' &&
                `TAŞINMAZ GÖSTERME BELGESİ\n\nAlıcı Adayı: ${contractClient}\nTaşınmaz: ${contractAddress}\nBedel: ${contractPrice}\n\nİşbu belge ile yukarıda belirtilen taşınmaz tarafıma gösterilmiş olup, taşınmazın satın alınması durumunda yasal hizmet bedelinin Demirtürk Portföy Yönetimi'ne ödeneceğini kabul ve taahhüt ederim.\n\nTarih: ${new Date().toLocaleDateString('tr-TR')}`}
              {contractType === 'yetki' &&
                `GAYRİMENKUL PAZARLAMA VE SATIŞ YETKİ BELGESİ\n\nMülk Sahibi: ${contractClient}\nTaşınmaz: ${contractAddress}\nYetkili Ofis: Demirtürk Portföy\n\nMülk sahibi, yukarıda kayıtlı taşınmazın satış ve pazarlama faaliyetlerini yürütmek üzere Demirtürk Portföy'ü yetkili kılmıştır.`}
              {contractType === 'kapora' &&
                `KAPORA & CAYMA AKÇESİ PROTOKOLÜ\n\nAlıcı: ${contractClient}\nTaşınmaz: ${contractAddress}\nKararlaştırılan Bedel: ${contractPrice}\n\nTaşınmazın satış işlemlerinin başlatılması amacıyla kapora bedeli teslim alınmıştır. Taraflardan biri haksız cayarsa yasal cayma tazminatı hükümleri geçerlidir.`}
            </div>

            <div className="flex justify-end">
              <GlassButton
                variant="gold"
                size="sm"
                icon={<Copy className="w-3.5 h-3.5" />}
                onClick={() => copyToClipboard(`Sözleşme Metni (${contractType}): Hazırlandı.`, 'contract')}
                className="rounded-full px-4"
              >
                {copied === 'contract' ? 'Kopyalandı' : 'Metni Kopyala'}
              </GlassButton>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TOOL 16: TARGET (SATIŞ HEDEFİ)                      */}
        {/* ---------------------------------------------------- */}
        {activeTool === 'target' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-[#d6beae] block mb-1.5">Aylık Ciro Hedefi (₺)</label>
                <input
                  type="number"
                  step="5000000"
                  value={targetQuota}
                  onChange={(e) => setTargetQuota(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#282522] border border-[#4a443f] rounded-xl px-3.5 py-2 text-sm font-bold text-white"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#d6beae] block mb-1.5">Gerçekleşen Ciro (₺)</label>
                <input
                  type="number"
                  step="1000000"
                  value={targetRealized}
                  onChange={(e) => setTargetRealized(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#282522] border border-[#4a443f] rounded-xl px-3.5 py-2 text-sm font-bold text-white"
                />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#282522] border border-[#4a443f] space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-[#a69f99]">Hedef Başarı Oranı</span>
                <span className="text-emerald-400">
                  %{targetQuota > 0 ? Math.min(100, Math.round((targetRealized / targetQuota) * 100)) : 0}
                </span>
              </div>
              <div className="w-full h-3 bg-[#1e1c1a] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#b99881] to-emerald-400 rounded-full transition-all"
                  style={{
                    width: `${targetQuota > 0 ? Math.min(100, Math.round((targetRealized / targetQuota) * 100)) : 0}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-[#8c857f] pt-1">
                <span>Kalan Hedef: {formatCurrency(Math.max(0, targetQuota - targetRealized))}</span>
                <span>Kotanın tamamlanmasına %{targetQuota > 0 ? Math.max(0, 100 - Math.round((targetRealized / targetQuota) * 100)) : 0} kaldı</span>
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TOOL 17: REMINDERS (TAPU HATIRLATICI)               */}
        {/* ---------------------------------------------------- */}
        {activeTool === 'reminders' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Yeni görev veya tapu takip notu ekle..."
                value={newReminderText}
                onChange={(e) => setNewReminderText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newReminderText.trim()) {
                    setReminders([...reminders, { id: Date.now().toString(), text: newReminderText.trim(), done: false }])
                    setNewReminderText('')
                  }
                }}
                className="flex-1 bg-[#282522] border border-[#4a443f] rounded-xl px-3.5 py-2 text-xs text-white"
              />
              <button
                onClick={() => {
                  if (newReminderText.trim()) {
                    setReminders([...reminders, { id: Date.now().toString(), text: newReminderText.trim(), done: false }])
                    setNewReminderText('')
                  }
                }}
                className="px-4 py-2 rounded-xl bg-[#b99881] text-[#1c1a18] font-bold text-xs"
              >
                Ekle
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto">
              {reminders.map((r) => (
                <div
                  key={r.id}
                  onClick={() =>
                    setReminders(reminders.map((item) => (item.id === r.id ? { ...item, done: !item.done } : item)))
                  }
                  className="flex items-center justify-between p-3 rounded-xl bg-[#282522] border border-[#4a443f] hover:border-[#b99881]/50 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    {r.done ? (
                      <CheckSquare className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Square className="w-4 h-4 text-[#8c857f]" />
                    )}
                    <span className={`text-xs ${r.done ? 'line-through text-[#8c857f]' : 'text-white'}`}>{r.text}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setReminders(reminders.filter((item) => item.id !== r.id))
                    }}
                    className="text-[#8c857f] hover:text-rose-400 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TOOL 18: QR (DİJİTAL KARTVİZİT)                     */}
        {/* ---------------------------------------------------- */}
        {activeTool === 'qr' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div className="p-5 rounded-2xl bg-[#282522] border border-[#4a443f] space-y-3">
              <div>
                <label className="text-sm font-medium text-[#d6beae] block mb-1.5">Danışman Ad Soyad</label>
                <input
                  type="text"
                  value={qrName}
                  onChange={(e) => setQrName(e.target.value)}
                  className="w-full bg-[#1e1c1a] border border-[#4a443f] rounded-xl px-3.5 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#d6beae] block mb-1.5">Telefon Numarası</label>
                <input
                  type="text"
                  value={qrPhone}
                  onChange={(e) => setQrPhone(e.target.value)}
                  className="w-full bg-[#1e1c1a] border border-[#4a443f] rounded-xl px-3.5 py-2 text-sm text-white"
                />
              </div>
              <GlassButton
                variant="gold"
                size="sm"
                icon={<Copy className="w-3.5 h-3.5" />}
                onClick={() => copyToClipboard(`BEGIN:VCARD\nFN:${qrName}\nTEL:${qrPhone}\nEND:VCARD`, 'qr')}
                className="w-full justify-center rounded-xl"
              >
                {copied === 'qr' ? 'VCard Kopyalandı' : 'Kartvizit Bilgisini Kopyala'}
              </GlassButton>
            </div>

            <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-[#1e1c1a] border border-[#4a443f] text-center space-y-3">
              <div className="w-28 h-28 rounded-2xl bg-white p-3 flex items-center justify-center shadow-lg">
                <QrCode className="w-20 h-20 text-[#1c1a18]" />
              </div>
              <div>
                <span className="text-sm font-bold text-white block">{qrName}</span>
                <span className="text-xs text-[#b99881]">Demirtürk Portföy Danışmanı</span>
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TOOL 19: MARKET (PİYASA ENDEKSİ & METRİKLER)        */}
        {/* ---------------------------------------------------- */}
        {activeTool === 'market' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-[#282522] border border-[#4a443f]">
                <span className="text-sm font-medium text-[#c4bcb5]">TCMB Konut Endeksi</span>
                <p className="text-xl font-bold text-emerald-400 mt-1">+%42.8</p>
                <span className="text-xs sm:text-sm text-[#8c857f]">Yıllık nominal artış</span>
              </div>
              <div className="p-4 rounded-2xl bg-[#282522] border border-[#4a443f]">
                <span className="text-sm font-medium text-[#c4bcb5]">İstanbul Ort. m² Fiyatı</span>
                <p className="text-xl font-bold text-white mt-1">48.500 ₺</p>
                <span className="text-xs sm:text-sm text-[#8c857f]">Genel ortalama</span>
              </div>
              <div className="p-4 rounded-2xl bg-[#282522] border border-[#4a443f]">
                <span className="text-sm font-medium text-[#c4bcb5]">Ort. Amortisman Süresi</span>
                <p className="text-xl font-bold text-[#b99881] mt-1">16.4 Yıl</p>
                <span className="text-xs sm:text-sm text-[#8c857f]">Kira çarpanı</span>
              </div>
              <div className="p-4 rounded-2xl bg-[#282522] border border-[#4a443f]">
                <span className="text-sm font-medium text-[#c4bcb5]">Konut Kredisi Faiz Ort.</span>
                <p className="text-xl font-bold text-amber-400 mt-1">%2.79</p>
                <span className="text-xs sm:text-sm text-[#8c857f]">Aylık referans</span>
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TOOL 20: CALENDAR (KURUMSAL & ORTAK TAKVİM)          */}
        {/* ---------------------------------------------------- */}
        {activeTool === 'calendar' && <CalendarWorkspaceTool payments={payments} />}

        {/* ---------------------------------------------------- */}
        {/* TOOL 21: DASK                                        */}
        {/* ---------------------------------------------------- */}
        {activeTool === 'dask' && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[#d6beae] block mb-1.5">Daire Brüt Alanı (m²)</label>
              <input
                type="number"
                value={daskArea}
                onChange={(e) => setDaskArea(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#282522] border border-[#4a443f] rounded-xl px-3.5 py-2 text-sm font-bold text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-[#282522] border border-[#4a443f]">
                <span className="text-sm font-medium text-[#c4bcb5]">Azami DASK Teminat Tutarı</span>
                <p className="text-xl font-bold text-white mt-1">{formatCurrency(daskArea * 6500)}</p>
                <span className="text-xs sm:text-sm text-[#8c857f]">6.500 ₺/m² birim maliyet</span>
              </div>
              <div className="p-4 rounded-2xl bg-[#282522] border border-[#b99881]/40">
                <span className="text-sm font-medium text-[#c4bcb5]">Tahmini Yıllık DASK Bedeli</span>
                <p className="text-xl font-bold text-emerald-400 mt-1">{formatCurrency(Math.round(daskArea * 14.5))} / Yıl</p>
                <span className="text-xs sm:text-sm text-[#8c857f]">1. Derece Deprem Bölgesi</span>
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TOOL 22: KİRA GELİR VERGİSİ                         */}
        {/* ---------------------------------------------------- */}
        {activeTool === 'taxincome' && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[#d6beae] block mb-1.5">Yıllık Toplam Brüt Kira Geliri (₺)</label>
              <input
                type="number"
                step="25000"
                value={taxYearlyRent}
                onChange={(e) => setTaxYearlyRent(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#282522] border border-[#4a443f] rounded-xl px-3.5 py-2 text-sm font-bold text-white"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-[#282522] border border-[#4a443f]">
                <span className="text-sm font-medium text-[#c4bcb5]">İstisna Tutarı</span>
                <p className="text-xl font-bold text-white mt-1">33.000 ₺</p>
                <span className="text-xs sm:text-sm text-[#8c857f]">Konut kira istisnası</span>
              </div>
              <div className="p-4 rounded-2xl bg-[#282522] border border-[#4a443f]">
                <span className="text-sm font-medium text-[#c4bcb5]">Götürü Gider (%15)</span>
                <p className="text-xl font-bold text-[#b99881] mt-1">{formatCurrency(Math.round(Math.max(0, taxYearlyRent - 33000) * 0.15))}</p>
                <span className="text-xs sm:text-sm text-[#8c857f]">Yasal gider indirimi</span>
              </div>
              <div className="p-4 rounded-2xl bg-[#282522] border border-[#b99881]/40">
                <span className="text-sm font-medium text-[#c4bcb5]">Tahmini Vergi (%15)</span>
                <p className="text-lg font-bold text-rose-400 mt-1">
                  {formatCurrency(Math.round(Math.max(0, taxYearlyRent - 33000) * 0.85 * 0.15))}
                </p>
                <span className="text-xs sm:text-sm text-[#8c857f]">1. Vergi dilimi üzerinden</span>
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TOOL 23: AİDAT DAĞITICI                             */}
        {/* ---------------------------------------------------- */}
        {activeTool === 'aidat' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-[#d6beae] block mb-1.5">Aylık Toplam Site/Bina Masrafı (₺)</label>
                <input
                  type="number"
                  step="5000"
                  value={aidatTotal}
                  onChange={(e) => setAidatTotal(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#282522] border border-[#4a443f] rounded-xl px-3.5 py-2 text-sm font-bold text-white"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#d6beae] block mb-1.5">Toplam Daire Sayısı</label>
                <input
                  type="number"
                  value={aidatUnits}
                  onChange={(e) => setAidatUnits(parseInt(e.target.value) || 1)}
                  className="w-full bg-[#282522] border border-[#4a443f] rounded-xl px-3.5 py-2 text-sm font-bold text-white"
                />
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-[#282522] border border-[#b99881]/40 text-center">
              <span className="text-sm font-medium text-[#c4bcb5]">Daire Başına Düşen Aylık Aidat</span>
              <p className="text-2xl font-bold text-emerald-400 mt-1">
                {formatCurrency(aidatUnits > 0 ? Math.round(aidatTotal / aidatUnits) : 0)}
              </p>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TOOL 24: SAHA HAVA DURUMU                           */}
        {/* ---------------------------------------------------- */}
        {activeTool === 'weather' && <WeatherTool cities={weatherCities} onChange={setWeatherCities} />}
        {activeTool === 'replies' && isMarketingUser && <CannedRepliesTool replies={cannedReplies} onChange={setCannedReplies} />}

        {/* ---------------------------------------------------- */}
        {/* TOOL 25: GÖRÜŞME KRONOMETRESİ                       */}
        {/* ---------------------------------------------------- */}
        {activeTool === 'timer' && (
          <div className="p-6 rounded-2xl bg-[#282522] border border-[#4a443f] text-center space-y-4">
            <div className="text-4xl font-mono font-bold text-white tracking-widest">
              {String(Math.floor(timerSeconds / 60)).padStart(2, '0')}:{String(timerSeconds % 60).padStart(2, '0')}
            </div>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => {setClock(Date.now());setTimer({elapsed:timerSeconds,started:isTimerRunning?0:Date.now()})}}
                className={`px-6 py-2 rounded-full font-bold text-xs transition-colors ${
                  isTimerRunning ? 'bg-rose-500 text-white' : 'bg-[#b99881] text-[#1c1a18]'
                }`}
              >
                {isTimerRunning ? 'Durdur' : 'Başlat'}
              </button>
              <button
                onClick={() => {
                  setTimer({started:0,elapsed:0})
                }}
                className="px-6 py-2 rounded-full bg-[#34302d] text-[#a69f99] hover:text-white font-bold text-xs"
              >
                Sıfırla
              </button>
            </div>
            <p className="text-xs text-[#8c857f]">Müşteri mülk turu ve teklif görüşmesi süresini takip edin.</p>
          </div>
        )}
      </div>
    </div>
  </motion.div>
</div>
)}
</AnimatePresence>,
    document.body
  )
}
