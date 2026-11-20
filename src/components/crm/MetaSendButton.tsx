import React, { useEffect, useRef, useState } from 'react'
import { Send, LoaderCircle } from 'lucide-react'
import { metaStore, PendingMetaResult } from '@/services/metaStore'
import { GlassModal } from '@/components/ui/GlassModal'
import { GlassButton } from '@/components/ui/GlassButton'
import { userStore } from '@/services/userStore'

export function MetaSendButton() {
  const account = userStore.getCurrentUser()?.authUserId
  const [count, setCount] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [targets, setTargets] = useState<PendingMetaResult[] | null>(null)
  const [sources, setSources] = useState<Record<string,string>>({})
  const lock = useRef(false)
  const current = () => account === userStore.getCurrentUser()?.authUserId
  useEffect(() => {
    let active = true
    setCount(null); setMessage(''); setError(''); setTargets(null); setSources({})
    const refresh = async () => {
      if (lock.current) return
      try { const rows = await metaStore.getServerPendingResults(); if (active && current()) setCount(rows.length) }
      catch { /* Tıklama sırasında hata açıkça gösterilir; eski sayı başarı sayılmaz. */ }
    }
    void refresh()
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void refresh() }, 30000)
    return () => { active = false; clearInterval(timer) }
  }, [account])
  const send = async (rows: PendingMetaResult[]) => {
    const result = await metaStore.sendServerPendingResults(rows, sources, text => { if (current()) setMessage(text) })
    if (!current()) return
    setTargets(null)
    setMessage(`Meta ${result.sent} sonucu kabul etti${result.waiting ? `; ${result.waiting} bekliyor` : ''}${result.failed ? `; ${result.failed} gönderilemedi` : ''}.`)
    setError(result.errors.slice(0, 5).join(' · '))
    try { const remaining = await metaStore.getServerPendingResults(); if (current()) setCount(remaining.length) }
    catch { if (current()) { setCount(null); setError(old => `${old} Kalan kayıt sayısı yenilenemedi; yeniden kontrol edin.`) } }
  }
  const run = async (selected?: PendingMetaResult[]) => {
    if (lock.current) return
    lock.current = true; setBusy(true); setError(''); setMessage('Sonuçlar sunucudan kontrol ediliyor…')
    try {
      const rows = selected || await metaStore.getServerPendingResults()
      if (!current()) return
      setCount(rows.length)
      if (!rows.length) { setMessage('Gönderilmeyi bekleyen uygun sonuç yok.'); return }
      if (!selected && rows.some(row => row.sources.length > 1)) {
        setTargets(rows); setMessage('Birden fazla başvurusu olan müşterilerin ilgili başvurusunu seçin.'); return
      }
      await send(rows)
    } catch (e) { if (current()) { setError(e instanceof Error ? e.message : 'Gönderim tamamlanamadı.'); setMessage('') } }
    finally { lock.current = false; setBusy(false) }
  }
  return <>
    <button type="button" disabled={busy} onClick={() => void run()}
      title="18 Kasım 2026 ve sonrasındaki gönderilmemiş uygun sonuçları sunucudan kontrol edip gönder"
      className="flex items-center gap-1.5 rounded-full border border-[#4a443f] bg-[var(--accent-color)] px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
      {busy ? <LoaderCircle size={14} className="animate-spin" /> : <Send size={14} />}
      {busy ? 'Gönderiliyor…' : `Veriyi Gönder${count !== null ? ` (${count})` : ''}`}
    </button>
    {(message || error) && <div className="basis-full text-xs" role={error ? 'alert' : 'status'} aria-live="polite">
      {message && <p>{message}</p>}{error && <p className="mt-1 text-rose-400">{error}</p>}
    </div>}
    <GlassModal isOpen={targets !== null} onClose={() => { if (!busy) setTargets(null) }} title="İlgili başvuruyu seçin" maxWidth="lg">
      <p className="mb-4 text-xs">Diğer uygun sonuçlar da aynı işlemde gönderilecek. 18 Kasım öncesi başvurular gönderilmez.</p>
      <div className="space-y-3">{targets?.filter(row => row.sources.length > 1).map(row => <label key={row.id} className="block text-xs">
        <span>{row.fullName}</span><select disabled={busy} value={sources[row.id] || ''} onChange={event => setSources(old => ({ ...old, [row.id]: event.target.value }))}
          className="mt-1 w-full rounded-xl border border-[#4a443f] bg-[var(--card-surface)] px-3 py-2">
          <option value="">Başvuru seçin</option>{row.sources.map(source => <option key={source.id} value={source.id}>{source.label}</option>)}
        </select>
      </label>)}</div>
      <div className="mt-5 flex justify-end gap-2"><GlassButton variant="subtle" size="sm" disabled={busy} onClick={() => setTargets(null)}>Vazgeç</GlassButton>
        <GlassButton variant="gold" size="sm" disabled={busy || targets?.some(row => row.sources.length > 1 && !sources[row.id])} onClick={() => targets && void run(targets)}>Gönder</GlassButton></div>
    </GlassModal>
  </>
}
