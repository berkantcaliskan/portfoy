import { Fragment, useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDownUp, Banknote, House, MapPin, Pencil, Plus, RefreshCw, Search, Trash2, UserRound } from 'lucide-react'
import { GlassModal } from '@/components/ui/GlassModal'
import { GlassButton } from '@/components/ui/GlassButton'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { PaginationBar } from '@/components/common/PaginationBar'
import { portfolioStore } from '@/services/portfolioStore'
import { userStore } from '@/services/userStore'
import type { PortfolioItem, PropertyType } from '@/types/portfolio'
import { formatCurrency } from '@/utils/formatters'
import { formatLira, parseLira } from '@/utils/promissoryNotes'
import './PropertyListingsView.css'

const propertyTypes: PropertyType[] = ['1+1', '2+1', '3+1', 'Villa', 'Diğer']
const listingType = (type: PropertyType) => propertyTypes.includes(type) ? type : 'Diğer'
const listingColors = [
  ['Yeşil', '#8abf9e'], ['Sarı', '#e6cc85'], ['Kırmızı', '#d98d91'], ['Mavi', '#89b6dc'], ['Mor', '#b6a0d4'],
  ['Pembe', '#dca8c4'], ['Turkuaz', '#83c5c1'], ['Turuncu', '#dfa875'], ['Zeytin', '#b4bc88'], ['Gri', '#b1b6c0'],
] as const
const hasPool = (item: PortfolioItem) => item.hasPool ?? item.features?.includes('Havuz') ?? false
interface ListingDraft {
  title: string
  price: string
  installmentPrice: string
  installmentTerms: string
  floor: string
  type: PropertyType
  typeDescription: string
  pool: string
  location: string
  consultant: string
  loan: string
  description: string
}
const blankDraft = (): ListingDraft => ({
  title: '', price: '', installmentPrice: '', installmentTerms: '', floor: '', type: '2+1',
  typeDescription: '', pool: 'false', location: '', consultant: '', loan: '', description: '',
})

export function PropertyListingsView() {
  const [items, setItems] = useState(() => portfolioStore.getAll())
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PortfolioItem | null>(null)
  const [draft, setDraft] = useState<ListingDraft>(blankDraft)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [savedMessage, setSavedMessage] = useState('')
  const saveLock = useRef(false)
  const [menu, setMenu] = useState<{ item: PortfolioItem; x: number; y: number } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PortfolioItem | null>(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const actionLock = useRef(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const accountId = userStore.getCurrentUser()?.id
  const readError = portfolioStore.getReadError()

  useEffect(() => portfolioStore.subscribe(() => setItems(portfolioStore.getAll())), [])
  useEffect(() => {
    if (!menu) return
    const outside = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenu(null) }
    const close = () => setMenu(null)
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    document.addEventListener('pointerdown', outside); window.addEventListener('keydown', key)
    window.addEventListener('resize', close); window.addEventListener('scroll', close, true)
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('keydown', key); window.removeEventListener('resize', close); window.removeEventListener('scroll', close, true) }
  }, [menu])
  useEffect(() => {
    let active = true
    setOpen(false); setSaveError(''); setSavedMessage(''); setQuery(''); setPage(1)
    setMenu(null); setDeleteTarget(null); setActionError('')
    setLoading(true)
    void portfolioStore.refreshFromBackend().finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [accountId])

  function newListing() {
    if (!saveError) { setEditing(null); setDraft(blankDraft()) }
    setOpen(true)
  }
  function editListing(item: PortfolioItem) {
    setEditing(item); setSaveError('')
    setDraft({
      title: item.title, price: formatLira(Math.round(item.price * 100)),
      installmentPrice: item.installmentPrice === undefined ? '' : formatLira(Math.round(item.installmentPrice * 100)),
      installmentTerms: item.installmentTerms || '', floor: item.floor || '', type: listingType(item.type),
      typeDescription: item.typeDescription || (listingType(item.type) === 'Diğer' && item.type !== 'Diğer' ? item.type : ''),
      pool: String(hasPool(item)),
      location: item.location, consultant: item.consultant || '', loan: item.loan || '', description: item.description,
    })
    setOpen(true)
  }
  function change<K extends keyof ListingDraft>(key: K, value: ListingDraft[K]) {
    setDraft(old => ({ ...old, [key]: value }))
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    if (saveLock.current) return
    if (draft.type === 'Diğer' && !draft.typeDescription.trim()) {
      setSaveError('Diğer gayrimenkul tipini açıklayın.')
      return
    }
    const price = parseLira(draft.price)
    const installmentPrice = draft.installmentPrice.trim() ? parseLira(draft.installmentPrice) : undefined
    if (price === null || price <= 0 || installmentPrice === null || installmentPrice === 0) {
      setSaveError('Fiyatları kontrol edin. Örneğin 3.500.000 veya 3.500.000,50 yazabilirsiniz.')
      return
    }
    saveLock.current = true; setSaving(true); setSaveError(''); setSavedMessage('')
    const owner = userStore.getCurrentUser()?.id
    try {
      if (!owner) throw Error('Portföy eklemek için giriş yapın.')
      const values = {
        title: draft.title.trim(), price: price / 100, installmentPrice: installmentPrice === undefined ? undefined : installmentPrice / 100,
        installmentTerms: draft.installmentTerms.trim(), floor: draft.floor.trim(), type: draft.type,
        typeDescription: draft.type === 'Diğer' ? draft.typeDescription.trim() : undefined,
        hasPool: draft.pool === 'true',
        location: draft.location.trim(), consultant: draft.consultant.trim(), loan: draft.loan.trim(),
        description: draft.description.trim(),
      }
      if (!values.title) throw Error('Portföy adını yazın.')
      if (editing) await portfolioStore.update(editing.id, values)
      else await portfolioStore.add({
        ...values, entryKind: 'EXTERNAL', createdByUserId: owner,
        projectCode: '', currency: 'TRY', netM2: 0, grossM2: 0, features: [], imageUrl: '', status: 'AVAILABLE',
      })
      if (userStore.getCurrentUser()?.id !== owner) return
      setOpen(false); setEditing(null); setDraft(blankDraft()); setQuery(''); setTypeFilter(''); setPage(1)
      setSavedMessage(editing ? 'Portföy güncellendi.' : 'Portföy kaydedildi.')
    } catch (error) {
      if (userStore.getCurrentUser()?.id === owner) setSaveError(error instanceof Error ? error.message : 'Portföy kaydedilemedi.')
    } finally { saveLock.current = false; setSaving(false) }
  }
  const filtered = items.filter(item => item.entryKind === 'EXTERNAL')
    .filter(item => (!typeFilter || listingType(item.type) === typeFilter) && [
      item.title, item.location, item.consultant, item.floor, item.type, item.typeDescription, item.loan, item.description,
    ].join(' ').toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr')))
    .sort((a, b) => Number(hasPool(b)) - Number(hasPool(a)) || (sort === 'price-asc' ? a.price - b.price : sort === 'price-desc' ? b.price - a.price : b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)))
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)))
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const user = userStore.getCurrentUser()
  const canEdit = (item: PortfolioItem) => user?.role === 'ADMIN' || item.createdByUserId === user?.id
    || (user?.role === 'MANAGER' && user.department === 'Satış')
  async function rowAction(item: PortfolioItem, color?: string) {
    if (actionLock.current || !canEdit(item)) return
    const owner = userStore.getCurrentUser()?.id
    actionLock.current = true; setActionBusy(true); setActionError(''); setMenu(null)
    try {
      if (color === undefined) await portfolioStore.delete(item.id)
      else await portfolioStore.update(item.id, { rowColor: color })
      if (owner === userStore.getCurrentUser()?.id) { setDeleteTarget(null); setSavedMessage(color === undefined ? 'Portföy silindi.' : 'Portföy rengi kaydedildi.') }
    } catch (error) { if (owner === userStore.getCurrentUser()?.id) setActionError(error instanceof Error ? error.message : 'İşlem tamamlanamadı.') }
    finally { actionLock.current = false; setActionBusy(false) }
  }
  const field = (label: string, key: Exclude<keyof ListingDraft, 'type'>, options: { required?: boolean; placeholder?: string; list?: string } = {}) =>
    <label className="listing-field">{label}<input className="listing-input" value={draft[key]}
      onChange={event => change(key, event.target.value)} maxLength={key === 'description' ? 4000 : 500}
      inputMode={key === 'price' || key === 'installmentPrice' ? 'decimal' : undefined} {...options} /></label>

  return <section className="property-listings">
    <div className="listing-page-header">
      <div><h2><House size={23} aria-hidden="true" />Portföyler</h2><p>Satışa sunduğunuz gayrimenkuller.</p></div>
      <GlassButton size="sm" icon={<Plus size={16} />} onClick={newListing} disabled={loading || Boolean(readError)}>Portföy ekle</GlassButton>
    </div>
    {readError && <p role="alert" className="listing-error">{readError}</p>}
    {actionError && <p role="alert" className="listing-error">{actionError}</p>}
    {savedMessage && <p role="status" className="listing-success">{savedMessage}</p>}
    <div className="listing-toolbar">
      <label className="listing-search"><Search size={17} aria-hidden="true" /><input className="bg-transparent" aria-label="Portföylerde ara"
        placeholder="Portföy, konum veya danışman ara…" value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} /></label>
      <CustomSelect title="Portföy tipi" className="listing-filter" value={typeFilter} onChange={event => { setTypeFilter(event.target.value); setPage(1) }}>
        <option value="">Tüm tipler</option>{propertyTypes.map(type => <option key={type} value={type}>{type}</option>)}
      </CustomSelect>
      <div className="listing-sort"><ArrowDownUp size={14} aria-hidden="true" /><CustomSelect title="Portföy sıralaması"
        className="listing-filter" value={sort} onChange={event => { setSort(event.target.value); setPage(1) }}>
        <option value="newest">Son eklenen</option><option value="price-asc">Fiyat · Artan</option><option value="price-desc">Fiyat · Azalan</option>
      </CustomSelect></div>
      <button type="button" title="Portföyleri yenile" aria-label="Portföyleri yenile" className="listing-refresh" disabled={loading}
        onClick={async () => { setLoading(true); try { await portfolioStore.refreshFromBackend() } finally { setLoading(false) } }}>
        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
      </button>
    </div>
    <div className="listing-table-panel" aria-busy={loading}>
      <div className="listing-table-scroll">
        <table className="listing-table">
          <colgroup>{['18%', '16%', '8%', '7%', '12%', '10%', '8%'].map((width, index) => <col key={index} style={{ width }} />)}<col /><col style={{ width: 44 }} /></colgroup>
          <thead><tr>{['Portföy adı', 'Fiyat', 'Kat · Daire', 'Tipi', 'Konum', 'Danışman', 'Kredi', 'Açıklama'].map(label => <th scope="col" key={label}>{label}</th>)}<th scope="col"><span className="sr-only">İşlemler</span></th></tr></thead>
          <tbody>
            {[true, false].map(pool => <Fragment key={String(pool)}>
              <tr className={`listing-category ${pool ? 'listing-pool' : 'listing-no-pool'}`}><th colSpan={9} scope="rowgroup">{pool ? 'Havuzlu' : 'Havuzsuz'} <span>{filtered.filter(item => hasPool(item) === pool).length}</span></th></tr>
              {visible.filter(item => hasPool(item) === pool).map(item => <tr key={item.id} data-listing-id={item.id}
                style={listingColors.some(([, color]) => color === item.rowColor) ? { backgroundColor: `color-mix(in srgb, ${item.rowColor} 14%, transparent)` } : undefined}
                onContextMenu={event => { event.preventDefault(); setMenu({ item, x: Math.max(8, Math.min(event.clientX, window.innerWidth - 232)), y: Math.max(8, Math.min(event.clientY, window.innerHeight - 180)) }) }}>
              <td><span className="listing-name">{item.title}</span></td>
              <td><div className="listing-prices">
                <div><span className="listing-price-label"><i />Peşin</span><strong>{formatCurrency(item.price, item.currency)}</strong></div>
                {item.installmentPrice !== undefined && <div className="listing-installment"><span className="listing-price-label"><i />Vadeli</span><strong>{formatCurrency(item.installmentPrice, item.currency)}</strong></div>}
                {item.installmentTerms && <span className="listing-payment-terms">{item.installmentTerms}</span>}
              </div></td>
              <td>{item.floor || <span className="listing-muted">—</span>}</td>
              <td><span className="listing-type">{listingType(item.type)}</span>
                {listingType(item.type) === 'Diğer' && <div className="mt-1 text-xs break-words">{item.typeDescription || (item.type !== 'Diğer' ? item.type : '')}</div>}</td>
              <td>{item.location ? <span className="listing-with-icon"><MapPin size={13} />{item.location}</span> : <span className="listing-muted">—</span>}</td>
              <td>{item.consultant ? <span className="listing-with-icon"><UserRound size={13} />{item.consultant}</span> : <span className="listing-muted">—</span>}</td>
              <td>{item.loan ? <span className="listing-with-icon"><Banknote size={13} />{item.loan}</span> : <span className="listing-muted">—</span>}</td>
              <td className="listing-notes">{item.description || <span className="listing-muted">—</span>}</td>
              <td>{canEdit(item) && <button type="button" className="listing-edit" title="Düzenle"
                aria-label={`${item.title} portföyünü düzenle`} onClick={() => editListing(item)}><Pencil size={14} /></button>}</td>
            </tr>)}
              {filtered.length > 0 && !visible.some(item => hasPool(item) === pool) && <tr><td colSpan={9} className="listing-category-empty">Bu sayfada gösterilecek portföy yok.</td></tr>}
            </Fragment>)}
            {!visible.length && <tr><td colSpan={9}><div className="listing-empty">
              <span className="listing-empty-icon"><House size={30} strokeWidth={1.4} /></span>
              <h3>{loading ? 'Portföyler yükleniyor…' : query || typeFilter ? 'Aramanıza uygun portföy bulunamadı.' : 'Henüz portföy eklenmedi.'}</h3>
              {!loading && !query && !typeFilter && !readError && <button type="button" onClick={newListing}><Plus size={15} />İlk portföyü ekle</button>}
            </div></td></tr>}
          </tbody>
        </table>
      </div>
      {filtered.length > 0 && <PaginationBar totalItems={filtered.length} currentPage={currentPage} pageSize={pageSize}
        onPageChange={setPage} onPageSizeChange={size => { setPageSize(size); setPage(1) }} />}
    </div>
    <GlassModal isOpen={open} onClose={() => { if (!saveLock.current) setOpen(false) }} title={editing ? 'Portföyü düzenle' : 'Portföy ekle'} maxWidth="3xl">
      <form onSubmit={save} className="listing-form">
        {saveError && <p role="alert" className="listing-error">{saveError}</p>}
        <fieldset disabled={saving}>
          <div className="listing-form-grid">
            <div className="listing-field-wide">{field('Portföy adı', 'title', { required: true })}</div>
            <label className="listing-field">Tipi<CustomSelect title="Gayrimenkul tipi" className="listing-input" value={draft.type}
              onChange={event => change('type', event.target.value as PropertyType)}>{propertyTypes.map(type => <option key={type} value={type}>{type}</option>)}</CustomSelect></label>
          </div>
          {draft.type === 'Diğer' && field('Tip açıklaması', 'typeDescription', { required: true, placeholder: 'Gayrimenkul tipini yazın' })}
          <label className="listing-field">Havuz durumu<CustomSelect title="Havuz durumu" className="listing-input" value={draft.pool} onChange={event => change('pool', event.target.value)}>
            <option value="true">Havuzlu</option><option value="false">Havuzsuz</option>
          </CustomSelect></label>
          <div className="listing-price-fields">
            {field('Peşin fiyat (TL)', 'price', { required: true, placeholder: '0,00' })}
            {field('Vadeli fiyat (TL)', 'installmentPrice', { placeholder: '0,00' })}
            <div className="listing-field-wide">{field('Vade / ödeme koşulları', 'installmentTerms', { placeholder: 'Peşinat, vade sayısı ve ödeme notu' })}</div>
          </div>
          <div className="listing-form-grid">
            {field('Kat · Daire', 'floor')}{field('Konum', 'location')}{field('Danışman', 'consultant', { list: 'listing-consultants' })}
            {field('Kredi', 'loan', { list: 'listing-loan-options' })}
          </div>
          <datalist id="listing-consultants">{userStore.getAllUsers().map(person => <option key={person.id} value={person.fullName} />)}</datalist>
          <datalist id="listing-loan-options"><option value="Krediye uygun" /><option value="Krediye uygun değil" /><option value="Bilgi bekleniyor" /></datalist>
          <div className="listing-field"><label htmlFor="listing-description">Açıklama</label>
            <textarea id="listing-description" className="listing-input" rows={3} maxLength={4000}
              value={draft.description} onChange={event => change('description', event.target.value)} />
          </div>
          <div className="listing-form-actions"><GlassButton type="button" variant="subtle" size="sm" onClick={() => setOpen(false)}>Vazgeç</GlassButton>
            <GlassButton type="submit" size="sm">{saving ? 'Kaydediliyor…' : 'Kaydet'}</GlassButton></div>
        </fieldset>
      </form>
    </GlassModal>
    {menu && createPortal(<div ref={menuRef} className="listing-context-menu" role="menu" aria-label="Portföy işlemleri" style={{ left: menu.x, top: menu.y }}>
      <button type="button" role="menuitem" disabled={actionBusy || !canEdit(menu.item)} className="listing-delete-action" onClick={() => { setDeleteTarget(menu.item); setActionError(''); setMenu(null) }}><Trash2 size={14} />Portföyü sil</button>
      <div className="listing-color-heading">Satır rengi<button type="button" disabled={actionBusy || !canEdit(menu.item)} onClick={() => void rowAction(menu.item, '')}>Temizle</button></div>
      <div className="listing-colors">{listingColors.map(([name, color]) => <button key={color} type="button" role="menuitem" aria-label={`${name} satır rengi`} title={name}
        disabled={actionBusy || !canEdit(menu.item)} onClick={() => void rowAction(menu.item, color)} style={{ backgroundColor: color }} className={menu.item.rowColor === color ? 'is-selected' : ''} />)}</div>
    </div>, document.body)}
    <GlassModal isOpen={Boolean(deleteTarget)} onClose={() => { if (!actionLock.current) setDeleteTarget(null) }} title="Portföyü sil" maxWidth="sm">
      <p className="text-sm">“{deleteTarget?.title}” portföyünü silmek istiyor musunuz?</p>
      {actionError && <p role="alert" className="listing-error">{actionError}</p>}
      <div className="listing-form-actions mt-5"><GlassButton size="sm" variant="subtle" disabled={actionBusy} onClick={() => setDeleteTarget(null)}>Vazgeç</GlassButton>
        <GlassButton size="sm" variant="danger" disabled={actionBusy} onClick={() => { if (deleteTarget) void rowAction(deleteTarget) }}>{actionBusy ? 'Siliniyor…' : 'Sil'}</GlassButton></div>
    </GlassModal>
  </section>
}
