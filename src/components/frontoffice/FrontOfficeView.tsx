import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { DoorOpen, RefreshCw, Search, Edit2 } from 'lucide-react'
import { VisitorContractButton } from '@/components/contracts/ContractWorkspace'
import { DateRangePicker, type DateRange } from '@/components/ui/DateRangePicker'
import { frontOfficeStore } from '@/services/frontOfficeStore'
import { userStore } from '@/services/userStore'
import type { OfficePayload, OfficeRecord } from '@/types/frontOffice'
import { officePersonIds, VISITOR_POTENTIAL_OPTIONS } from '@/types/frontOffice'
import type { OfficeCommand } from '@/services/frontOfficeRepository'
import { VisitorEntryRow } from './VisitorEntryRow'

const inputClass = 'w-full rounded-xl border border-[#4a443f] bg-transparent px-3 py-2 text-sm text-inherit'
function localDateTime() { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10) }
function empty(): OfficePayload {
  return { name: '', phone: '', notes: '', status: 'WAITING', visitedAt: localDateTime(), staffId: '', representativeId: '' }
}
export function FrontOfficeView() {
  const context = useSyncExternalStore(frontOfficeStore.subscribe, frontOfficeStore.getSnapshot)
  const [records, setRecords] = useState<OfficeRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const now = new Date()
    return { startDate: new Date(now.getFullYear(), now.getMonth(), 1), endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0), presetKey: 'THIS_MONTH', presetLabel: 'Bu Ay' }
  })
  const [savedMessage, setSavedMessage] = useState('')
  const [rowMenu, setRowMenu] = useState<{ x: number; y: number; record: OfficeRecord } | null>(null)
  const deleteRequest = useRef<{ id: string; revision: number; requestId: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [visitorDraft, setVisitorDraft] = useState(() => empty())
  const [visitorEditing, setVisitorEditing] = useState(false)
  const visitorRecord = useRef({ id: '', revision: 0 })
  const visitorRequest = useRef<{ key: string; command: OfficeCommand } | null>(null)
  const entryRef = useRef<HTMLFormElement>(null)
  const saveLock = useRef(false)
  const generation = useRef(0)
  const accountId = userStore.getCurrentUser()?.id
  async function refresh() {
    const current = ++generation.current
    setLoading(true); setError('')
    try {
      const rows = await frontOfficeStore.repository().list('visitors')
      if (current === generation.current) setRecords(rows.sort((a, b) => b.updated_at.localeCompare(a.updated_at)))
    } catch (e) { if (current === generation.current) setError(e instanceof Error ? e.message : 'Kayıtlar okunamadı.') }
    finally { if (current === generation.current) setLoading(false) }
  }
  useEffect(() => {
    setRecords([]); setPage(1); setQuery('')
    if (context.canAccess && !context.error) void refresh()
    return () => { generation.current++ }
  }, [context.canAccess, context.error, accountId])
  useEffect(() => { resetVisitor() }, [accountId])
  useEffect(() => {
    if (!rowMenu) return
    const close = () => setRowMenu(null)
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      window.removeEventListener('keydown', key)
    }
  }, [rowMenu])
  async function deleteVisitor(record: OfficeRecord) {
    setRowMenu(null)
    if (saveLock.current) return
    saveLock.current = true; setSaving(true); setSaveError('')
    const owner = accountId
    if (deleteRequest.current?.id !== record.id || deleteRequest.current.revision !== record.revision) {
      deleteRequest.current = { id: record.id, revision: record.revision, requestId: crypto.randomUUID() }
    }
    try {
      await frontOfficeStore.repository().deleteVisitor(record.id, record.revision, deleteRequest.current.requestId)
      if (userStore.getCurrentUser()?.id !== owner) return
      generation.current++
      setLoading(false); setRecords(old => old.filter(row => row.id !== record.id))
      if (visitorRecord.current.id === record.id) resetVisitor()
      deleteRequest.current = null
      setSavedMessage('Girdi silindi.')
    } catch (e) { if (userStore.getCurrentUser()?.id === owner) setSaveError(e instanceof Error ? e.message : 'Girdi silinemedi.') }
    finally { saveLock.current = false; setSaving(false) }
  }
  function personNames(payload: OfficePayload, role: 'staff' | 'representative') {
    const people = role === 'staff' ? context.consultants : context.representatives
    return officePersonIds(payload, role).map(id => people.find(person => person.id === id)?.name || 'Eski personel').join(', ') || '—'
  }
  function resetVisitor() {
    setVisitorDraft(empty()); setVisitorEditing(false); setSaveError('')
    visitorRecord.current = { id: '', revision: 0 }; visitorRequest.current = null
  }
  function open(record: OfficeRecord) {
      visitorRecord.current = { id: record.id, revision: record.revision }
      visitorRequest.current = null; setVisitorEditing(true); setVisitorDraft({ ...record.payload }); setSaveError('')
      entryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  async function saveVisitor(event: React.FormEvent) {
    event.preventDefault()
    if (saveLock.current) return
    saveLock.current = true; setSaving(true); setSaveError(''); setSavedMessage('')
    if (!visitorRecord.current.id) visitorRecord.current.id = crypto.randomUUID()
    const key = JSON.stringify({ ...visitorRecord.current, payload: visitorDraft })
    if (visitorRequest.current?.key !== key) visitorRequest.current = { key, command: { ...visitorRecord.current, payload: { ...visitorDraft }, kind: 'visitors', requestId: crypto.randomUUID() } }
    const owner = accountId
    try {
      const result = await frontOfficeStore.repository().save(visitorRequest.current.command)
      if (userStore.getCurrentUser()?.id !== owner) return
      generation.current++
      setLoading(false); setRecords(old => [result, ...old.filter(row => row.id !== result.id)])
      const date = new Date(result.payload.visitedAt + 'T12:00:00')
      const start = dateRange.startDate ? new Date(dateRange.startDate).setHours(0, 0, 0, 0) : -Infinity
      const end = dateRange.endDate ? new Date(dateRange.endDate).setHours(23, 59, 59, 999) : Infinity
      if (date.getTime() < start || date.getTime() > end) setDateRange({ startDate: new Date(date.getFullYear(), date.getMonth(), 1), endDate: new Date(date.getFullYear(), date.getMonth() + 1, 0), presetKey: 'CUSTOM' })
      setQuery(''); setPage(1); resetVisitor()
      setSavedMessage(visitorEditing ? 'Müşteri ziyareti güncellendi.' : 'Müşteri ziyareti kaydedildi.')
    } catch (e) { setSaveError(e instanceof Error ? e.message : 'Kayıt kaydedilemedi.') }
    finally { saveLock.current = false; setSaving(false) }
  }
  const filtered = records.filter(row => {
    const date = new Date(row.payload.visitedAt || row.updated_at)
    const start = dateRange.startDate ? new Date(dateRange.startDate).setHours(0, 0, 0, 0) : -Infinity
    const end = dateRange.endDate ? new Date(dateRange.endDate).setHours(23, 59, 59, 999) : Infinity
    return date.getTime() >= start && date.getTime() <= end && `${row.payload.name} ${row.payload.phone} ${row.payload.notes} ${row.payload.property || ''} ${row.payload.title || ''} ${row.payload.contractNumber || ''}`.toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr'))
  }).sort((a, b) => b.updated_at.localeCompare(a.updated_at) || b.id.localeCompare(a.id))
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pages)
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const title = 'Gelen Müşteriler'
  const unavailable = !context.canAccess || Boolean(context.error) || context.loading
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-bold flex items-center gap-2"><DoorOpen className="w-5 h-5" />{title}</h2><p className="text-sm text-[#a69f99] mt-1">Ön Ofis · Ofis ziyaretlerini ve görüşmeleri kaydedin.</p></div>
      <div className="flex flex-wrap items-center gap-2"><DateRangePicker value={dateRange} onChange={range => { setDateRange(range); setPage(1) }} align="right" /><button className="rounded-full border border-[#4a443f] p-2" aria-label="Listeyi yenile" disabled={loading} onClick={() => void frontOfficeStore.refresh().then(refresh)}><RefreshCw className="w-4 h-4" /></button></div>
    </div>
    {(context.error || error) && <p role="alert" className="rounded-xl border border-rose-400/30 p-3 text-sm text-rose-400">{context.error || error}</p>}
    {savedMessage && <p role="status" className="text-sm text-emerald-400">{savedMessage}</p>}
    {!context.canAccess && !context.loading && !context.error && <p>Bu alan için Ön Ofis Erişimi atanması gerekiyor.</p>}
    <div className="flex flex-wrap gap-3"><label className="flex gap-2 items-center flex-1 min-w-48"><Search className="w-4 h-4" /><input aria-label={`${title} içinde ara`} className={inputClass} placeholder="Ad, telefon veya sözleşme ara…" value={query} onChange={e => { setQuery(e.target.value); setPage(1) }} /></label></div>

    {loading && <p role="status">Kayıtlar yükleniyor…</p>}
      <form ref={entryRef} onSubmit={saveVisitor} aria-label="Müşteri kayıt satırı">
      <div className="overflow-x-auto rounded-2xl border border-[#4a443f]">
        <table className="office-visitors-table">
          <colgroup>
            {['12%', '12%', '11%', '13%', '11%', '13%'].map((width, index) => <col key={index} style={{ width }} />)}
            <col />
            <col className="office-actions-column" />
          </colgroup>
          <thead className="text-xs text-[#a69f99] border-b border-[#4a443f]"><tr>
            {['Tarih', 'Adı, Soyadı', 'Telefon', 'İlişkili Temsilci', 'Kanal', 'Satış Danışmanı', 'Açıklama'].map(label => <th key={label} scope="col">{label}</th>)}
            <th scope="col" className="office-actions-heading">İşlemler</th>
          </tr></thead>
          <tbody>
            <VisitorEntryRow value={visitorDraft} onChange={(key, value) => setVisitorDraft(old => ({...old, [key]: value}))} context={context} disabled={unavailable || saving || loading} editing={visitorEditing} onCancel={resetVisitor} />
            {saveError && <tr><td colSpan={8} className="p-3 text-rose-400" role="alert">{saveError}</td></tr>}
            {!visible.length && !loading && !error && <tr><td colSpan={8} className="p-8 text-center text-[#a69f99]">Seçilen tarih ve filtrelere uygun kayıt bulunamadı.</td></tr>}
            {visible.map(row => <tr key={row.id} data-visitor-record data-potential={row.payload.potential || undefined} className="border-b border-[#4a443f]/50 last:border-0"
              tabIndex={0}
              onContextMenu={event => { event.preventDefault(); if (!unavailable && !saving) setRowMenu({ x: Math.max(8, Math.min(event.clientX, window.innerWidth - 176)), y: Math.max(8, Math.min(event.clientY, window.innerHeight - 60)), record: row }) }}
              onKeyDown={event => { if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) { event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(); setRowMenu({ x: Math.max(8, Math.min(rect.left + 10, window.innerWidth - 176)), y: Math.max(8, Math.min(rect.bottom, window.innerHeight - 60)), record: row }) } }}>
            <td className="px-4 py-3 whitespace-nowrap">{new Date(row.payload.visitedAt || row.updated_at).toLocaleDateString('tr-TR')}</td>
            <td className="px-4 py-3 font-semibold">{row.payload.name}</td>
            <td className="px-4 py-3 whitespace-nowrap">{row.payload.phone}</td>
            <td className="px-4 py-3 break-words">{personNames(row.payload, 'representative')}</td>
            <td className="px-4 py-3">{row.payload.source || '—'}</td>
            <td className="px-4 py-3 break-words">{personNames(row.payload, 'staff')}</td>
            <td className="px-4 py-3 max-w-72 whitespace-pre-wrap break-words">
              {row.payload.notes || '—'}
              {row.payload.potential && <span className="sr-only"> ({VISITOR_POTENTIAL_OPTIONS.find(option => option.value === row.payload.potential)?.label})</span>}
            </td>
            <td className="px-4 py-3"><div className="office-row-actions">
              <button type="button" aria-label="Müşteri kaydını düzenle" title="Düzenle" className="p-1.5 rounded-full hover:bg-black/5" onClick={() => open(row)}><Edit2 className="w-3.5 h-3.5" /></button>
              <VisitorContractButton id={row.id} name={row.payload.name} phone={row.payload.phone} />
            </div></td>
          </tr>)}</tbody>
        </table>
      </div>
      </form>
    <div className="flex flex-wrap justify-between gap-3 text-sm items-center">
      <span>{filtered.length} kayıt · {currentPage}/{pages}</span>
      <div className="flex gap-3 items-center"><button disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Önceki</button><button disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>Sonraki</button></div>
      <label className="flex gap-2 items-center">Göster<select aria-label="Sayfa başına müşteri" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }} className="rounded-full border border-[#4a443f] bg-transparent px-3 py-1">{[20, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
    </div>
    {rowMenu && createPortal(<div role="menu" aria-label="Müşteri girdisi işlemleri" className="office-people-menu" style={{ left: rowMenu.x, top: rowMenu.y, width: 168 }}>
      <button role="menuitem" type="button" autoFocus className="office-people-option text-rose-400" disabled={saving || unavailable} onClick={() => void deleteVisitor(rowMenu.record)}>Girdiyi sil</button>
    </div>, document.body)}
  </div>
}
