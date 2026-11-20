import { useEffect, useRef, useState } from 'react'
import { GlassModal } from '@/components/ui/GlassModal'
import { userStore } from '@/services/userStore'
import { createPromissoryRepository, type SavedNote } from '@/services/promissoryRepository'
import { PromissoryNoteDocument } from './PromissoryNoteDocument'
import { printPromissoryNotes } from './printPromissoryNotes'
import { formatLira } from '@/utils/promissoryNotes'

export function SavedPromissoryNotes() {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<SavedNote[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<SavedNote | null>(null)
  const [page, setPage] = useState(0)
  const documentRef = useRef<HTMLDivElement>(null)
  const closePrint = useRef<(() => void) | undefined>(undefined)
  useEffect(() => () => closePrint.current?.(), [])
  async function load() {
    const client = userStore.getServerClient(), actor = userStore.getCurrentUser()?.id
    setOpen(true); setError(''); setRows([]); setLoading(true)
    try {
      if (!client) throw Error('Sunucu oturumu gerekli.')
      const result = await createPromissoryRepository(client).list()
      if (actor === userStore.getCurrentUser()?.id) setRows(result)
    } catch (e) { setError(e instanceof Error ? e.message : 'Senetler okunamadı.') }
    finally { setLoading(false) }
  }
  return <>
    <button type="button" className="rounded-full border border-[#4a443f] px-4 py-2 text-xs" onClick={() => void load()}>Kayıtlı Senetler</button>
    <GlassModal isOpen={open && !selected} onClose={() => setOpen(false)} title="Kayıtlı Senetler" maxWidth="4xl">
      {error && <p role="alert" className="text-sm text-rose-400">{error} <button className="underline" onClick={() => void load()}>Yenile</button></p>}
      {loading ? <p>Sunucudan okunuyor…</p> : !error && !rows.length ? <p>Henüz sunucuya kaydedilmiş senet yok.</p> : <div className="space-y-3">{rows.map(row => <button key={row.id} onClick={() => { setSelected(row); setPage(0) }} className="w-full rounded-xl border border-[#4a443f] p-3 text-left"><strong>{row.payload.details.issuerName}</strong><span className="block text-sm">{row.payload.notes.length} senet · {formatLira(row.payload.notes.reduce((sum, note) => sum + note.cents, 0))} TL · {new Date(row.updated_at).toLocaleDateString('tr-TR')}</span></button>)}</div>}
    </GlassModal>
    <GlassModal isOpen={Boolean(selected)} onClose={() => setSelected(null)} title="Kayıtlı Senet Belgesi" maxWidth="5xl">
      {selected && <div className="space-y-3"><div className="flex justify-between gap-3"><button onClick={() => setSelected(null)}>Listeye Dön</button><button onClick={() => { if (documentRef.current) { closePrint.current?.(); closePrint.current = printPromissoryNotes(documentRef.current, () => setError('Yazdırma penceresi açılamadı.')) } }}>Yazdır / PDF Kaydet</button></div>
        {error && <p role="alert" className="text-rose-400 text-sm">{error}</p>}
        <div className="overflow-auto max-h-[65vh]"><PromissoryNoteDocument ref={documentRef} details={selected.payload.details} notes={selected.payload.notes} activePage={page} /></div>
        <div className="flex justify-center gap-4"><button disabled={page === 0} onClick={() => setPage(page - 1)}>Önceki</button><span>{page + 1}/{Math.ceil(selected.payload.notes.length / 3) + Number(Boolean(selected.payload.details.accelerationText))}</span><button disabled={page + 1 >= Math.ceil(selected.payload.notes.length / 3) + Number(Boolean(selected.payload.details.accelerationText))} onClick={() => setPage(page + 1)}>Sonraki</button></div>
      </div>}
    </GlassModal>
  </>
}
