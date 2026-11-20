import { useEffect, useRef, useState } from 'react'
import { RotateCcw, Trash2, RefreshCw } from 'lucide-react'
import { userStore } from '@/services/userStore'
import { leadStore } from '@/services/leadStore'
import { createLeadArchiveRepository, type ArchivedLead } from '@/services/leadArchiveRepository'

export function LeadTrashPanel() {
  const [rows, setRows] = useState<ArchivedLead[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [restoring, setRestoring] = useState('')
  const account = userStore.getCurrentUser()?.id
  const requests = useRef(new Map<string, string>())
  const active = useRef(true)
  const restoreLock = useRef(false)
  async function load() {
    const client = userStore.getServerClient()
    if (!client) return
    setLoading(true); setError('')
    try {
      const records = await createLeadArchiveRepository(client).list()
      if (active.current && account === userStore.getCurrentUser()?.id) setRows(records)
    } catch (error) { if (active.current) setError(error instanceof Error ? error.message : 'Çöp kutusu okunamadı.') }
    finally { if (active.current) setLoading(false) }
  }
  useEffect(() => {
    active.current = true
    setRows([]); requests.current.clear(); void load()
    return () => { active.current = false }
  }, [account])
  async function restore(id: string) {
    const client = userStore.getServerClient()
    if (!client || restoreLock.current) return
    restoreLock.current = true; setRestoring(id); setError('')
    const request = requests.current.get(id) || crypto.randomUUID()
    requests.current.set(id, request)
    try {
      await createLeadArchiveRepository(client).restore(request, id)
      if (active.current && account === userStore.getCurrentUser()?.id) {
        requests.current.delete(id)
        setRows(old => old.filter(row => row.id !== id))
        await leadStore.refreshFromSupabase()
      }
    } catch (error) { if (active.current) setError(error instanceof Error ? error.message : 'Kayıt geri yüklenemedi.') }
    finally { restoreLock.current = false; if (active.current) setRestoring('') }
  }
  return <section className="space-y-4">
    <div className="flex items-start justify-between gap-3">
      <div><h3 className="flex items-center gap-2 text-sm font-semibold"><Trash2 size={16} />Müşteri çöp kutusu</h3>
        <p className="mt-1 text-xs text-[#a69f99]">Silinen müşterileri buradan geri yükleyebilirsiniz.</p></div>
      <button type="button" aria-label="Müşteri çöp kutusunu yenile" disabled={loading || Boolean(restoring)}
        onClick={() => void load()} className="p-2 rounded-full border border-[#4a443f]/40"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button>
    </div>
    {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
    {!rows.length && <p className="py-10 text-center text-xs text-[#a69f99]">{loading ? 'Yükleniyor…' : 'Çöp kutusunda müşteri bulunmuyor.'}</p>}
    <ul className="space-y-2">{rows.map(row => <li key={row.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[#4a443f]/50 p-4">
      <div className="min-w-0"><h4 className="text-sm font-medium">{row.full_name}</h4><p className="mt-1 text-xs text-[#a69f99]">{row.phone}</p>
        <p className="mt-1 text-[10px] text-[#8c857f]">{new Date(row.archived_at).toLocaleString('tr')}</p></div>
      <button type="button" disabled={Boolean(restoring)} onClick={() => void restore(row.id)}
        className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs text-[var(--accent-color)] border border-[#4a443f]/40">
        <RotateCcw size={13} />{restoring === row.id ? 'Geri yükleniyor…' : 'Geri yükle'}
      </button>
    </li>)}</ul>
  </section>
}
