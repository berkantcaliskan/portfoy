import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Footprints, RefreshCw } from 'lucide-react'
import { userStore } from '@/services/userStore'
import { createSalesRotationRepository, orderFromNext, type SalesRotation } from '@/services/salesRotationRepository'

const REFRESH_MS = 30_000

export function SalesRotationCard() {
  const [rotation, setRotation] = useState<SalesRotation | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const version = useRef(0)

  const repository = () => {
    const client = userStore.getServerClient()
    if (!client) throw Error('Çıkış sırası için sunucu oturumu gerekli.')
    return createSalesRotationRepository(client)
  }

  const load = useCallback(async () => {
    const v = ++version.current
    try {
      const data = await repository().get()
      if (v === version.current) { setRotation(data); setError('') }
    } catch (e) {
      if (v === version.current) setError((e as Error).message)
    }
  }, [])

  // Sunucu güncellemesi yoksa tekrar tekrar sormayalım
  const unavailable = !rotation && error.includes('henüz uygulanmamış')
  useEffect(() => {
    if (unavailable) return
    void load()
    const timer = window.setInterval(() => void load(), REFRESH_MS)
    window.addEventListener('focus', load)
    return () => { version.current++; window.clearInterval(timer); window.removeEventListener('focus', load) }
  }, [load, unavailable])

  async function mark(id: string) {
    if (!rotation || busy) return
    setBusy(id); setError('')
    try {
      version.current++
      setRotation(await repository().mark(id, rotation.revision))
    } catch (e) {
      setError((e as Error).message)
      void load()
    } finally { setBusy(null) }
  }

  // Sunucu güncellemesi kurulmadıysa kartı hiç göstermeyelim
  if (unavailable) return null

  const ordered = rotation ? orderFromNext(rotation.members, rotation.lastId) : []
  const last = rotation?.members.find(m => m.id === rotation.lastId)

  return (
    <div className="mb-5 rounded-[24px] bg-[#282522]/80 border border-[#4a443f] px-5 py-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Footprints className="w-4 h-4 text-[#b99881]" />
          <h3 className="text-[14px] font-medium text-white">Müşteriye Çıkış Sırası</h3>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-[#8c857f]">
          {last && rotation?.updatedAt && (
            <span>
              Son çıkan: <span className="text-[#d6beae] font-semibold">{last.name}</span>
              {' · '}{new Date(rotation.updatedAt).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              {rotation.updatedBy ? ` · ${rotation.updatedBy}` : ''}
            </span>
          )}
          <button type="button" onClick={() => void load()} title="Sırayı yenile" aria-label="Sırayı yenile"
            className="p-1 rounded-full text-[#a69f99] hover:text-white hover:bg-white/10">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {error && <p role="alert" className="mb-2 text-xs text-rose-300">{error}</p>}

      {!rotation ? (
        !error && <p className="text-xs text-[#a69f99]">Sıra yükleniyor…</p>
      ) : ordered.length === 0 ? (
        <p className="text-xs text-[#a69f99]">Sırada satış danışmanı yok.</p>
      ) : (
        <ol className="flex flex-wrap items-stretch gap-2">
          {ordered.map((member, index) => {
            const isNext = index === 0
            return (
              <li key={member.id}
                className={`flex items-center gap-2.5 rounded-full border pl-1.5 pr-2 py-1.5 ${isNext ? 'border-[var(--accent-color,#b99881)] bg-[#34302d]' : 'border-[#4a443f] bg-[#24211f]/60'}`}>
                <span className={`flex w-7 h-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isNext ? 'bg-[var(--accent-color,#b99881)] text-white' : 'bg-[#34302d] text-[#a69f99]'}`}>
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className={`block text-[13px] font-semibold leading-tight ${isNext ? 'text-white' : 'text-[#d6beae]'}`}>{member.name}</span>
                  {isNext && <span className="block text-[10px] text-[#b99881] leading-tight">Sıradaki</span>}
                </span>
                {rotation.canMark && (
                  <button type="button" disabled={busy !== null}
                    onClick={() => { if (window.confirm(`${member.name} müşteriye çıktı olarak işaretlensin mi?`)) void mark(member.id) }}
                    title="Müşteriye çıktı olarak işaretle"
                    className={`ml-1 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50 ${isNext ? 'bg-[var(--accent-color,#b99881)] text-white hover:opacity-90' : 'text-[#a69f99] hover:text-white hover:bg-white/10'}`}>
                    <Check className="w-3 h-3" />{busy === member.id ? 'Kaydediliyor…' : 'Çıktı'}
                  </button>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
