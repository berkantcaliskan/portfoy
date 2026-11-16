import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, Ellipsis, Eye, Plus, Printer, X } from 'lucide-react'
import { GlassButton } from '@/components/ui/GlassButton'
import { GlassModal } from '@/components/ui/GlassModal'
import {
  buildNoteSchedule, buildPaymentPeriods, dateInputValue, formatLira, getFinancedAmount,
  getPrepaymentTotal, insertInstallmentAbove, isNoteDate, MAX_NOTE_COUNT, NOTES_PER_PAGE,
  type InsertedInstallments, type NoteInstallment, type NoteOverride, type PaymentPeriodDraft,
} from '@/utils/promissoryNotes'
import { PromissoryNoteDocument, type NoteDocumentDetails } from './PromissoryNoteDocument'
import { printPromissoryNotes } from './printPromissoryNotes'
import './PromissoryNoteModal.css'

const input = 'mt-1 min-w-0 w-full rounded-lg border border-[#57504a] bg-[#211e1c] px-2.5 py-1.5 text-sm text-[#f3efe9] focus:border-[#c7a992] focus:outline-none'
const label = 'block min-w-0 text-xs text-[#d6beae]'
const INSTALLMENTS_PER_PAGE = 12
const PERIODS_PER_PAGE = 8

const debtorRoles = {
  individual: 'Borçlu (kendi adına)',
  company: 'Borçlu (şirket / tüzel kişi)',
  represented: 'Borçlu (temsilci ile)',
}
type DebtorRole = keyof typeof debtorRoles
type DownPayment = { id: number; amount: string; date: string }

function PageControls({ page, count, onChange }: { page: number; count: number; onChange: (page: number) => void }) {
  return (
    <div className="flex shrink-0 items-center justify-center gap-2">
      <GlassButton type="button" size="sm" variant="outline" disabled={page === 0}
        className="disabled:opacity-35" aria-label="Önceki sayfa" onClick={() => onChange(page - 1)}>
        <ChevronLeft size={16} />
      </GlassButton>
      <span className="min-w-16 text-center text-xs tabular-nums" aria-live="polite">{page + 1} / {count}</span>
      <GlassButton type="button" size="sm" variant="outline" disabled={page + 1 === count}
        className="disabled:opacity-35" aria-label="Sonraki sayfa" onClick={() => onChange(page + 1)}>
        <ChevronRight size={16} />
      </GlassButton>
    </div>
  )
}

export function PromissoryNoteModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [creditor, setCreditor] = useState('Demirtürk İnşaat')
  const [issuedOn, setIssuedOn] = useState(() => dateInputValue(new Date()))
  const [issuePlace, setIssuePlace] = useState('Karasu')
  const [consumer, setConsumer] = useState(true)
  const [nonNegotiable, setNonNegotiable] = useState(true)
  const [hasAcceleration, setHasAcceleration] = useState(false)
  const [accelerationText, setAccelerationText] = useState('')
  const [hasConsideration, setHasConsideration] = useState(false)
  const [consideration, setConsideration] = useState<'Malen' | 'Nakden'>('Malen')
  const [debtorRole, setDebtorRole] = useState<DebtorRole>('individual')
  const [issuerName, setIssuerName] = useState('')
  const [issuerBusinessName, setIssuerBusinessName] = useState('')
  const [signerName, setSignerName] = useState('')
  const [issuerId, setIssuerId] = useState('')
  const [address, setAddress] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [downPayments, setDownPayments] = useState<DownPayment[]>([{ id: 0, amount: '', date: '' }])
  const downPaymentIds = useRef(0)
  const [deposit, setDeposit] = useState('')
  const [hasDeposit, setHasDeposit] = useState(false)
  const [count, setCount] = useState('1')
  const [firstDue, setFirstDue] = useState('')
  const [overrides, setOverrides] = useState<Record<string, NoteOverride>>({})
  const [inserted, setInserted] = useState<InsertedInstallments>({})
  const [noteMenu, setNoteMenu] = useState<string | null>(null)
  const [increasing, setIncreasing] = useState(false)
  const [periodDrafts, setPeriodDrafts] = useState<PaymentPeriodDraft[]>([])
  const [periodPage, setPeriodPage] = useState<number | null>(null)
  const [preview, setPreview] = useState<NoteDocumentDetails | null>(null)
  const [previewPage, setPreviewPage] = useState(0)
  const [installmentPage, setInstallmentPage] = useState<number | null>(null)
  const [formStep, setFormStep] = useState<'parties' | 'plan'>('parties')
  const [paper, setPaper] = useState({ width: 0, height: 0, scale: 0 })
  const [error, setError] = useState('')
  const documentRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const insertedIds = useRef(0)
  const closePrint = useRef<(() => void) | undefined>(undefined)

  useEffect(() => () => closePrint.current?.(), [])
  useEffect(() => {
    if (noteMenu === null) return
    const dismiss = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('[data-note-menu]')) setNoteMenu(null)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        setNoteMenu(null)
      }
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', escape)
    }
  }, [noteMenu])
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const sheet = documentRef.current?.querySelector<HTMLElement>('.note-page:not([hidden])')
    if (!viewport || !sheet || !isOpen || !preview) return
    const fitPage = () => {
      const scale = Math.max(0, Math.min(1, (viewport.clientWidth - 16) / sheet.offsetWidth,
        (viewport.clientHeight - 16) / sheet.offsetHeight))
      setPaper({ width: sheet.offsetWidth * scale, height: sheet.offsetHeight * scale, scale })
    }
    fitPage()
    const resize = new ResizeObserver(fitPage)
    resize.observe(viewport)
    return () => resize.disconnect()
  }, [isOpen, preview, previewPage])

  const prepaid = getPrepaymentTotal([...downPayments.map(payment => payment.amount), hasDeposit ? deposit : ''])
  const target = getFinancedAmount(totalAmount, prepaid)
  const paymentPlan = buildPaymentPeriods(target, Number(count), periodDrafts)
  const schedule = buildNoteSchedule(target, Number(count), firstDue, overrides, {
    monthlyAmounts: increasing ? paymentPlan.amounts : undefined, inserted,
  })
  const printable = schedule.flatMap(note => (
    note.cents !== null && note.cents > 0 && isNoteDate(note.dueDate) ? [{ ...note, cents: note.cents }] : []
  ))
  const planned = schedule.reduce((sum, note) => sum + (note.cents ?? 0), 0)
  const totalIsValid = Number.isSafeInteger(planned) && planned <= 99_999_999_999_999
  const balance = target === null ? 0 : planned - target
  const notePageCount = Math.ceil(printable.length / NOTES_PER_PAGE)
  const installmentPageCount = Math.ceil(schedule.length / INSTALLMENTS_PER_PAGE)
  const periodPageCount = Math.max(1, Math.ceil(paymentPlan.periods.length / PERIODS_PER_PAGE))
  const currentPeriodPage = Math.min(periodPage ?? 0, periodPageCount - 1)
  const finalIssuerName = (debtorRole === 'company' ? issuerBusinessName : issuerName).trim()
  const totalLabel = (
    <p aria-live="polite" className={`text-sm ${balance ? 'text-amber-200' : 'text-[#f3efe9]'}`}>
      Senet toplamı <strong>{formatLira(planned)} TL</strong>
      {target !== null && balance !== 0 && ` · Kalan borçtan ${formatLira(Math.abs(balance))} TL ${balance > 0 ? 'fazla' : 'eksik'}`}
    </p>
  )

  const updateOverride = (id: string, change: NoteOverride) => {
    setOverrides(previous => ({ ...previous, [id]: { ...previous[id], ...change } }))
  }

  const updateDownPayment = (id: number, change: Partial<Omit<DownPayment, 'id'>>) => {
    setDownPayments(previous => previous.map(payment => payment.id === id ? { ...payment, ...change } : payment))
  }

  const addInstallmentAbove = (note: NoteInstallment) => {
    const id = `added-${++insertedIds.current}`
    setInserted(previous => insertInstallmentAbove(previous, id, note))
    updateOverride(id, { dueDate: note.dueDate })
    setNoteMenu(null)
  }

  const updatePeriod = (index: number, change: PaymentPeriodDraft) => {
    setPeriodDrafts(previous => {
      const next = [...previous]
      next[index] = { ...next[index], ...change }
      return next
    })
  }

  const openPreview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const protocol = accelerationText.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
    if (!creditor.trim() || !issuePlace.trim() || !finalIssuerName || !address.trim()
      || !isNoteDate(issuedOn) || (debtorRole !== 'individual' && !signerName.trim())) {
      setFormStep('parties')
      setError('Alacaklı, keşide ve borçlu bilgilerini tamamlayın.')
      return
    }
    if (!/^\d{10,11}$/.test(issuerId)) {
      setFormStep('parties')
      setError('T.C. kimlik numarasını 11, vergi numarasını 10 hane olarak yazın.')
      return
    }
    if (target === null || target <= 0) {
      setFormStep('plan')
      setError('Toplam tutarı ve önceden alınan tutarları kontrol edin. Senede bağlanacak tutar pozitif olmalı.')
      return
    }
    if (!schedule.length || !totalIsValid || !isNoteDate(firstDue)) {
      setFormStep('plan')
      setError('Alınacak toplam tutarı, geçerli bir senet sayısını ve ilk vade tarihini girin.')
      return
    }
    if (increasing && (paymentPlan.invalid || paymentPlan.amounts.length !== Number(count))) {
      setError('Artan ödeme dönemlerindeki tutarları ve ay sayılarını kontrol edin.')
      setPeriodPage(0)
      return
    }
    const invalid = schedule.find(note => note.cents === null || note.cents <= 0 || !isNoteDate(note.dueDate) || note.dueDate < issuedOn)
    if (invalid) {
      setError(`${invalid.number}. senette pozitif tutar ve keşide tarihinde veya sonrasında geçerli bir vade girin.`)
      setInstallmentPage(Math.floor((invalid.number - 1) / INSTALLMENTS_PER_PAGE))
      return
    }
    if (hasAcceleration && (!protocol.length || protocol.length > 22)) {
      setFormStep('plan')
      setError('Ayrı protokol için 1–22 satır arasında metin girin.')
      return
    }
    setError('')
    setPreviewPage(0)
    setPreview({
      creditor: creditor.trim(), issuedOn, issuePlace: issuePlace.trim(),
      issuerName: finalIssuerName, issuerId, address: address.trim(),
      signerName: debtorRole === 'individual' ? '' : signerName.trim(),
      nonNegotiable,
      consideration: hasConsideration ? consideration : '',
      accelerationText: hasAcceleration ? protocol.join('\n') : '',
    })
  }

  return (
    <GlassModal isOpen={isOpen} onClose={onClose} title={preview ? 'Senet önizleme' : installmentPage !== null ? 'Vadeleri düzenle' : periodPage !== null ? 'Artan ödeme planı' : 'Senet oluştur'}
      maxWidth="5xl" scrollable={!preview} className={preview ? 'note-modal note-modal-preview' : 'note-modal'}>
      {preview ? (
        <div className="flex h-full min-h-0 flex-col gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <GlassButton type="button" variant="outline" size="sm" icon={<ArrowLeft size={15} />} onClick={() => { setPreview(null); setError('') }}>
              Düzenlemeye dön
            </GlassButton>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-[#d6beae]">{printable.length} senet · {notePageCount} A4{preview.accelerationText && ' · 1 ayrı protokol'}</span>
              <GlassButton type="button" size="sm" icon={<Printer size={15} />} onClick={() => {
                if (!documentRef.current) return
                setError('')
                closePrint.current?.()
                closePrint.current = printPromissoryNotes(documentRef.current, () => setError('Yazdırma penceresi açılamadı. Tekrar deneyin.'))
              }}>
                Yazdır / PDF kaydet
              </GlassButton>
            </div>
          </div>
          {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
          {balance !== 0 && <p className="text-xs text-amber-200">Senet toplamı {formatLira(planned)} TL · Kalan borçtan {formatLira(Math.abs(balance))} TL {balance > 0 ? 'fazla' : 'eksik'}</p>}
          <div ref={viewportRef} className="note-preview-viewport">
            <div style={{ width: paper.width, height: paper.height }}>
              <div style={{ transform: `scale(${paper.scale})`, transformOrigin: 'top left' }}>
                <PromissoryNoteDocument ref={documentRef} details={preview} notes={printable} activePage={previewPage} />
              </div>
            </div>
          </div>
          <PageControls page={previewPage} count={notePageCount + Number(Boolean(preview.accelerationText))} onChange={setPreviewPage} />
        </div>
      ) : installmentPage !== null ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <GlassButton type="button" variant="outline" size="sm" icon={<ArrowLeft size={15} />} onClick={() => {
              setInstallmentPage(null)
              setNoteMenu(null)
              setError('')
            }}>Forma dön</GlassButton>
            {Object.keys(overrides).length > 0 && <button type="button" onClick={() => {
              setOverrides({})
              setInserted({})
              setInstallmentPage(0)
              setNoteMenu(null)
            }} className="text-xs underline">Otomatik plana dön</button>}
          </div>
          <p className="text-xs text-[#d6beae]">F4 ile bir önceki senedin tutarını kopyalayabilirsiniz.</p>
          <div className="note-installment-grid">
            <span className="text-xs text-[#d6beae]">Senet</span>
            <span className="text-xs text-[#d6beae]">Vade tarihi</span>
            <span className="text-xs text-[#d6beae]">Tutar (TL)</span>
            {schedule.slice(installmentPage * INSTALLMENTS_PER_PAGE, (installmentPage + 1) * INSTALLMENTS_PER_PAGE).map((note, rowIndex) => (
              <div className="contents" key={note.id}>
                <span className="text-xs font-semibold tabular-nums text-[#f3efe9]">{note.number}/{schedule.length}</span>
                <div className="relative flex min-w-0 items-center gap-1" data-note-menu>
                  <input className={input} type="date" aria-label={`${note.number}. senet vadesi`} value={note.dueDate}
                    onChange={event => updateOverride(note.id, { dueDate: event.target.value })}
                    onContextMenu={event => { event.preventDefault(); setNoteMenu(note.id) }} />
                  <button type="button" className="shrink-0 rounded p-1" aria-label={`${note.number}. vade işlemleri`}
                    aria-expanded={noteMenu === note.id} onClick={() => setNoteMenu(noteMenu === note.id ? null : note.id)}>
                    <Ellipsis size={16} />
                  </button>
                  {noteMenu === note.id && <div className={`dropdown-panel note-row-menu ${rowIndex >= 6 ? 'bottom-full' : 'top-full'}`}>
                    <button type="button" onClick={() => addInstallmentAbove(note)}>
                      <Plus size={14} /> Üstüne yeni vade ekle
                    </button>
                    {note.id !== String(note.month) && <button type="button" onClick={() => {
                      setInserted(previous => ({ ...previous, [note.month]: (previous[note.month] ?? []).filter(id => id !== note.id) }))
                      setOverrides(previous => {
                        const next = { ...previous }
                        delete next[note.id]
                        return next
                      })
                      const lastPage = Math.max(0, Math.ceil((schedule.length - 1) / INSTALLMENTS_PER_PAGE) - 1)
                      setInstallmentPage(Math.min(installmentPage, lastPage))
                      setNoteMenu(null)
                    }}>Eklenen vadeyi kaldır</button>}
                  </div>}
                </div>
                <input className={input} inputMode="decimal" maxLength={22} aria-label={`${note.number}. senet tutarı`} value={note.amount}
                  onChange={event => updateOverride(note.id, { amount: event.target.value })}
                  onKeyDown={event => {
                    if (event.key !== 'F4') return
                    event.preventDefault()
                    const previous = schedule[note.number - 2]
                    if (previous) updateOverride(note.id, { amount: previous.amount })
                  }} />
              </div>
            ))}
          </div>
          <PageControls page={installmentPage} count={installmentPageCount} onChange={page => {
            setInstallmentPage(page)
            setNoteMenu(null)
          }} />
          {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
          {totalLabel}
        </div>
      ) : periodPage !== null ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <GlassButton type="button" variant="outline" size="sm" icon={<ArrowLeft size={15} />} onClick={() => {
              setPeriodPage(null)
              setError('')
            }}>Forma dön</GlassButton>
            {periodDrafts.length > 0 && <button type="button" className="text-xs underline" onClick={() => {
              setPeriodDrafts([])
              setPeriodPage(0)
            }}>Dönemleri sıfırla</button>}
          </div>
          <p className="text-xs text-[#d6beae]">Aylık tutarı ve kaç ay uygulanacağını girin. Kalan ayların tutarı otomatik hesaplanır.</p>
          {!!paymentPlan.periods.length && <div className="note-period-grid">
            <span className={label}>Dönem</span>
            <span className={label}>Aylık ödeme (TL)</span>
            <span className={label}>Ay sayısı</span>
            {paymentPlan.periods.slice(currentPeriodPage * PERIODS_PER_PAGE, (currentPeriodPage + 1) * PERIODS_PER_PAGE).map((period, rowIndex) => {
              const index = currentPeriodPage * PERIODS_PER_PAGE + rowIndex
              return <div key={index} className="contents">
                <span className="text-xs tabular-nums">{index + 1}</span>
                <input className={input} aria-label={`${index + 1}. dönem aylık ödeme (TL)`} inputMode="decimal" maxLength={22} value={period.amount}
                  onChange={event => updatePeriod(index, { amount: event.target.value })} />
                <input className={input} aria-label={`${index + 1}. dönem ay sayısı`} type="number" min={1} max={period.remainingMonths} step={1} value={period.months}
                  onChange={event => updatePeriod(index, { months: event.target.value })} />
              </div>
            })}
          </div>}
          {!paymentPlan.periods.length && <p className="text-sm">Önce formda geçerli bir vade sayısı girin.</p>}
          {periodPageCount > 1 && <PageControls page={currentPeriodPage} count={periodPageCount} onChange={setPeriodPage} />}
          {paymentPlan.invalid && <p role="status" className="text-xs text-amber-200">Her döneme pozitif bir tutar ve kalan vade sayısına uygun bir ay sayısı girin.</p>}
          {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
          {totalLabel}
        </div>
      ) : (
        <form onSubmit={openPreview} className="note-form" data-form-step={formStep} noValidate>
          <fieldset data-note-step="parties" className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3">
            <legend className="mb-2 text-sm font-semibold text-white">Alacaklı ve keşide bilgileri</legend>
            <label className={`${label} col-span-2 sm:col-span-1`}>Lehdar (Alacaklı)
              <input className={input} required maxLength={150} value={creditor} onChange={event => setCreditor(event.target.value)} />
            </label>
            <label className={label}>Keşide tarihi
              <input className={input} required type="date" value={issuedOn} onChange={event => setIssuedOn(event.target.value)} />
            </label>
            <label className={label}>Keşide yeri
              <input className={input} required maxLength={65} placeholder="İlçe / il" value={issuePlace} onChange={event => setIssuePlace(event.target.value)} />
            </label>
          </fieldset>

          <fieldset data-note-step="plan" className="grid min-w-0 gap-2 border-t border-[#4a443f] pt-2 text-sm text-[#f3efe9]">
            <legend className="pr-2 text-sm font-semibold text-white">Senet kayıtları</legend>
            <div className="note-checkboxes">
              <label>
                <input type="checkbox" checked={consumer} onChange={event => setConsumer(event.target.checked)} />
                <span>Tüketici işlemi</span>
              </label>
              <label>
                <input type="checkbox" checked={nonNegotiable} onChange={event => setNonNegotiable(event.target.checked)} />
                <span>Ciro edilemez kaydı</span>
              </label>
              <label>
                <input type="checkbox" checked={hasAcceleration} onChange={event => setHasAcceleration(event.target.checked)} />
                <span>Muacceliyet kaydı</span>
              </label>
              <label>
                <input type="checkbox" checked={hasConsideration} onChange={event => setHasConsideration(event.target.checked)} />
                <span>Malen / nakden kaydı</span>
              </label>
            </div>
            {consumer && !nonNegotiable && <p className="text-xs text-[#a69f99]">Tüketici işlemlerinde her taksit için nama yazılı senet düzenlenir.</p>}
            {(hasAcceleration || hasConsideration) && <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
              {hasAcceleration && <label className={label}>Ayrı sözleşme / protokol metni
                <textarea className={`${input} resize-none`} required rows={2} maxLength={1400} value={accelerationText} onChange={event => setAccelerationText(event.target.value)} />
              </label>}
              {hasConsideration && <label className={label}>Bedel kaydı
                <select className={input} value={consideration} onChange={event => setConsideration(event.target.value === 'Nakden' ? 'Nakden' : 'Malen')}>
                  <option>Malen</option><option>Nakden</option>
                </select>
              </label>}
            </div>}
          </fieldset>

          <fieldset data-note-step="parties" className="note-debtor-grid">
            <legend className="mb-2 text-sm font-semibold text-white">Keşideci (Borçlu)</legend>
            <label className={`${label} col-span-full flex items-center gap-2`}>Sıfat
              <select className="note-role-select" aria-label="Sıfat" value={debtorRole} onChange={event => setDebtorRole(event.target.value as DebtorRole)}>
                {Object.entries(debtorRoles).map(([key, name]) => <option value={key} key={key}>{name}</option>)}
              </select>
            </label>
            {debtorRole === 'company' ? (
              <label className={label}>Ticaret unvanı
                <input className={input} required maxLength={150} value={issuerBusinessName} onChange={event => setIssuerBusinessName(event.target.value)} />
              </label>
            ) : (
              <label className={label}>Adı, Soyadı
                <input className={input} required maxLength={150} value={issuerName} onChange={event => setIssuerName(event.target.value)} />
              </label>
            )}
            <label className={label}>T.C. / Vergi no
              <input className={input} required inputMode="numeric" maxLength={11} pattern="[0-9]{10,11}" value={issuerId} onChange={event => setIssuerId(event.target.value.replace(/\D/g, ''))} />
            </label>
            <label className={`${label} col-span-full sm:col-span-1`}>Borçlu adresi
              <input className={input} required maxLength={240} value={address} onChange={event => setAddress(event.target.value)} />
            </label>
            {debtorRole !== 'individual' && <label className={`${label} col-span-full`}>Yetkili / temsilci adı soyadı
              <input className={input} required maxLength={120} value={signerName} onChange={event => setSignerName(event.target.value)} />
            </label>}
          </fieldset>

          <fieldset data-note-step="plan" className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3">
            <legend className="mb-2 text-sm font-semibold text-white">Senet planı</legend>
            <label className={`${label} col-span-2 sm:col-span-1`}>Alınacak toplam tutar (TL)
              <input className={input} required inputMode="decimal" maxLength={22} placeholder="3.500.000,00" value={totalAmount} onChange={event => setTotalAmount(event.target.value)} />
            </label>
            <label className={label}>Vade sayısı
              <input className={input} required type="number" min={1} max={MAX_NOTE_COUNT} step={1} value={count} onChange={event => setCount(event.target.value)} />
            </label>
            <label className={label}>İlk vade tarihi
              <input className={input} required type="date" min={issuedOn} value={firstDue} onChange={event => setFirstDue(event.target.value)} />
            </label>
            <div className="note-prepayments col-span-full">
              {downPayments.map((payment, index) => (
                <div key={payment.id} className="contents">
                  <div className="col-start-1 min-w-0">
                    {index === 0 && <span className={label}>Peşinat (TL)</span>}
                    <div className="note-prepayment-amount">
                      <input className={input} inputMode="decimal" maxLength={22} placeholder="0,00"
                        aria-label={index === 0 ? 'Peşinat (TL)' : `${index + 1}. peşinat tutarı (TL)`} value={payment.amount}
                        onChange={event => updateDownPayment(payment.id, { amount: event.target.value })} />
                      {index === 0 ? <button type="button" className="note-icon-button" aria-label="Peşinat ekle" title="Peşinat ekle" onClick={() => {
                        const id = ++downPaymentIds.current
                        setDownPayments(previous => [...previous, { id, amount: '', date: '' }])
                      }}><Plus size={16} /></button> : <button type="button" className="note-icon-button"
                        aria-label={`${index + 1}. peşinatı kaldır`}
                        onClick={() => setDownPayments(previous => previous.filter(entry => entry.id !== payment.id))}><X size={15} /></button>}
                    </div>
                  </div>
                  <div className="min-w-0">
                    {index === 0 && <span className={label}>Peşinat tarihi</span>}
                    <input className={input} type="date" aria-label={index === 0 ? 'Peşinat tarihi' : `${index + 1}. peşinat tarihi`}
                      value={payment.date} onChange={event => updateDownPayment(payment.id, { date: event.target.value })} />
                  </div>
                  {index === 0 && <div className="note-deposit min-w-0">
                    {hasDeposit ? (
                      <div className="note-prepayment-amount">
                        <label className={label}>Kapora (TL)
                          <input className={input} inputMode="decimal" maxLength={22} placeholder="0,00"
                            value={deposit} onChange={event => setDeposit(event.target.value)} />
                        </label>
                        <button type="button" className="note-icon-button" aria-label="Kaporayı kaldır" title="Kaporayı kaldır"
                          onClick={() => setHasDeposit(false)}><X size={15} /></button>
                      </div>
                    ) : (
                      <GlassButton type="button" size="sm" variant="outline" icon={<Plus size={14} />}
                        className="note-add-deposit" onClick={() => setHasDeposit(true)}>Kapora ekle</GlassButton>
                    )}
                  </div>}
                </div>
              ))}
              <p className="col-span-full text-right text-xs" aria-live="polite">Ön ödeme toplamı{' '}
                <strong>{prepaid === null ? 'Geçersiz tutar' : `${formatLira(prepaid)} TL`}</strong>
              </p>
            </div>
            <div className="col-span-full flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={increasing} onChange={event => {
                    setIncreasing(event.target.checked)
                    if (event.target.checked) { setPeriodPage(0); setError('') }
                  }} />
                  Artan ödeme oluştur
                </label>
                {increasing && <button type="button" className="text-xs underline" onClick={() => {
                  setPeriodPage(0)
                  setError('')
                }}>Dönemleri düzenle</button>}
              </div>
              {target !== null && <p className="text-xs">Senede bağlanacak tutar <strong>{formatLira(target)} TL</strong></p>}
            </div>
          </fieldset>

          {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <GlassButton type="button" className="note-step-back" size="sm" variant="outline" onClick={() => setFormStep('parties')}>Bilgilere dön</GlassButton>
            <GlassButton type="button" className="note-step-next" size="sm" onClick={() => setFormStep('plan')}>Vade planına geç</GlassButton>
            <div data-note-step="plan">{totalLabel}</div>
            <div data-note-step="plan" className="flex flex-wrap items-center gap-2">
              <GlassButton type="button" size="sm" variant="outline" disabled={!schedule.length} onClick={() => {
                setError('')
                setInstallmentPage(0)
              }}>Vadeleri düzenle</GlassButton>
              <GlassButton type="submit" size="sm" icon={<Eye size={15} />}>Senetleri önizle</GlassButton>
            </div>
          </div>
        </form>
      )}
    </GlassModal>
  )
}
