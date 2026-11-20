import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { LockKeyhole } from 'lucide-react'
import { applicationLockStore } from '@/services/applicationLockStore'
import './ApplicationLock.css'

export function ApplicationLock() {
  const state = useSyncExternalStore(applicationLockStore.subscribe, applicationLockStore.getSnapshot)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const sequence = useRef(0)
  useEffect(() => {
    sequence.current++
    setPin(''); setError(''); setChecking(false)
    if (!state.locked) return
    input.current?.focus()
    const keepFocus = (event: FocusEvent) => {
      if (event.target !== input.current) input.current?.focus({ preventScroll: true })
    }
    document.addEventListener('focusin', keepFocus)
    return () => { sequence.current++; document.removeEventListener('focusin', keepFocus) }
  }, [state.locked])
  async function change(value: string) {
    const ticket = ++sequence.current
    const next = value.replace(/\D/g, '').slice(0, 8)
    setPin(next); setError(''); setChecking(false)
    if (next.length !== state.length) return
    setChecking(true)
    try {
      const success = await applicationLockStore.unlock(next)
      if (ticket === sequence.current && !success) { setError('Parola eşleşmedi.'); input.current?.select() }
    } catch { if (ticket === sequence.current) setError('Kilit açılamadı. Yeniden deneyin.') }
    finally { if (ticket === sequence.current) setChecking(false) }
  }
  if (!state.locked) return null
  return createPortal(<div id="application-lock-overlay" className="application-lock" onKeyDown={event => event.stopPropagation()}>
    <section role="dialog" aria-modal="true" aria-labelledby="application-lock-title" className="application-lock-card">
      <span className="application-lock-icon"><LockKeyhole size={24} strokeWidth={1.6} /></span>
      <h2 id="application-lock-title">Uygulama kilitli</h2>
      <p>Devam etmek için kilit parolanızı girin.</p>
      <input ref={input} autoFocus type="password" inputMode="numeric" autoComplete="off" maxLength={8}
        aria-label="Kilit parolası" value={pin} onChange={event => void change(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Tab') { event.preventDefault(); input.current?.focus() }
        }} />
      <div className="application-lock-feedback" aria-live="polite">
        {error ? <span role="alert">{error}</span> : checking ? 'Kontrol ediliyor…' : ''}
      </div>
    </section>
  </div>, document.body)
}
