import { useState, useSyncExternalStore } from 'react'
import { LockKeyhole } from 'lucide-react'
import { applicationLockStore, LOCK_DELAYS } from '@/services/applicationLockStore'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { GlassButton } from '@/components/ui/GlassButton'

export function ApplicationLockSettings() {
  const state = useSyncExternalStore(applicationLockStore.subscribe, applicationLockStore.getSnapshot)
  const [mode, setMode] = useState<'none' | 'enable' | 'disable'>('none')
  const [pin, setPin] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [delay, setDelay] = useState(0)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  function begin() { setPin(''); setConfirmation(''); setError(''); setMode(state.configured ? 'disable' : 'enable') }
  async function save() {
    if (saving) return
    if (mode === 'enable' && (pin !== confirmation || !/^\d{4,8}$/.test(pin))) {
      setError(pin !== confirmation ? 'Parolalar aynı olmalı.' : '4–8 rakamlı bir parola belirleyin.')
      return
    }
    setSaving(true); setError('')
    try {
      if (mode === 'enable') await applicationLockStore.configure(pin, delay)
      else if (!await applicationLockStore.disable(pin)) { setError('Parola eşleşmedi.'); return }
      setMode('none'); setPin(''); setConfirmation('')
    } catch { setError('Kilit ayarı bu cihaza kaydedilemedi. Yeniden deneyin.') }
    finally { setSaving(false) }
  }
  const inputClass = 'w-full rounded-xl border border-[var(--glass-border)] bg-[var(--card-surface)] px-3 py-2.5 text-sm'
  return <div className="space-y-5">
    <div><h3 className="text-sm font-bold">Gizlilik ve Güvenlik</h3><p className="mt-1 text-xs text-[#a69f99]">Bu cihazdaki hesabınızın uygulama kilidi.</p></div>
    <div className="rounded-2xl border border-[var(--glass-border)] p-4 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-2 text-sm font-medium"><LockKeyhole size={17} />Uygulamayı kilitle</span>
        <button type="button" role="switch" aria-label="Uygulamayı kilitle" aria-checked={state.configured} disabled={saving}
          onClick={begin} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${state.configured ? 'bg-[var(--accent-color)]' : 'bg-[#a69f99]/30'}`}>
          <span className={`absolute top-0.5 size-5 rounded-full bg-white transition-transform ${state.configured ? 'left-0.5 translate-x-5' : 'left-0.5'}`} />
        </button>
      </div>
      {(state.configured || mode === 'enable') && <label className="block space-y-2 text-xs">Pencereden ayrıldıktan sonra
        <CustomSelect title="Uygulama kilidi süresi" className={inputClass} value={state.configured ? state.delay : delay}
          onChange={event => {
            const next = Number(event.target.value)
            try { if (state.configured) applicationLockStore.setDelay(next); else setDelay(next) }
            catch { setError('Süre kaydedilemedi.') }
          }}>{LOCK_DELAYS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</CustomSelect>
      </label>}
      {mode !== 'none' && <div className="space-y-3 border-t border-[var(--glass-border)] pt-4">
        <label className="block space-y-2 text-xs">{mode === 'enable' ? 'Kilit parolası · 4–8 rakam' : 'Mevcut kilit parolası'}
          <input type="password" inputMode="numeric" autoComplete="off" maxLength={8} value={pin} className={inputClass}
            onChange={event => setPin(event.target.value.replace(/\D/g, ''))} disabled={saving} />
        </label>
        {mode === 'enable' && <label className="block space-y-2 text-xs">Kilit parolasını tekrar girin
          <input type="password" inputMode="numeric" autoComplete="off" maxLength={8} value={confirmation} className={inputClass}
            onChange={event => setConfirmation(event.target.value.replace(/\D/g, ''))} disabled={saving} />
        </label>}
        <div className="flex justify-end gap-2">
          <GlassButton type="button" size="sm" variant="subtle" disabled={saving} onClick={() => { setMode('none'); setPin(''); setConfirmation(''); setError('') }}>Vazgeç</GlassButton>
          <GlassButton type="button" size="sm" disabled={saving} onClick={() => void save()}>{saving ? 'Kaydediliyor…' : mode === 'enable' ? 'Kilidi etkinleştir' : 'Kilidi kapat'}</GlassButton>
        </div>
      </div>}
      {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
    </div>
  </div>
}
