import { useRef, useState, type FormEvent } from 'react'
import { BrandLogoLockup } from '@/components/common/BookLogo'
import { WindowControls } from '@/components/common/WindowControls'

interface FirstLoginPasswordScreenProps {
  centralAuth: boolean
  onSave: (currentPassword: string, newPassword: string) => Promise<void>
  onBack: () => void
}

export function FirstLoginPasswordScreen({ centralAuth, onSave, onBack }: FirstLoginPasswordScreenProps) {
  const [showPasswords, setShowPasswords] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const submitting = useRef(false)
  const inputType = showPasswords ? 'text' : 'password'
  const inputClass = 'w-full min-w-0 rounded-xl border border-[#c9d0ca] bg-white px-3 py-2.5 text-sm text-[#292d2b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#52695f]'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    const fields = new FormData(event.currentTarget)
    const current = String(fields.get('currentPassword') ?? '')
    const next = String(fields.get('newPassword') ?? '')
    if (next !== fields.get('confirmation')) {
      setError('Yeni parola ve tekrarı eşleşmiyor.')
      return
    }
    submitting.current = true
    setSaving(true)
    setError('')
    try {
      await onSave(current, next)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Parola işlemi tamamlanamadı. Tekrar deneyin.')
    } finally {
      submitting.current = false
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#f5f5f2] text-[#292d2b]">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#292d2b]/10 bg-[#e3e5e1] px-4 sm:px-6"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <BrandLogoLockup logoSize={22} gapClassName="gap-2.5" slideDistance={22}
          textClassName="font-the-seasons text-lg tracking-wide text-[#292d2b]" />
        <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}><WindowControls /></div>
      </header>
      <main className="grid flex-1 place-items-center px-4 py-6 sm:py-10">
        <section aria-labelledby="first-login-title" className="w-full max-w-sm rounded-3xl border border-[#dce1dc] bg-white p-5 shadow-sm sm:p-7">
          <h1 id="first-login-title" className="text-xl font-semibold tracking-tight sm:text-2xl">Yeni parola belirleyin</h1>
          <p className="mt-1.5 text-sm text-[#52615a]">Portföy’e ilk girişiniz için yeni bir parola seçin.</p>
          <form className="mt-5 space-y-3.5" aria-busy={saving} onSubmit={handleSubmit}>
            <fieldset disabled={saving} className="min-w-0 space-y-3.5">
              {centralAuth && (
                <label className="block space-y-1 text-sm font-medium">
                  Geçici parola
                  <input className={inputClass} name="currentPassword" type={inputType} autoComplete="current-password" required autoFocus />
                </label>
              )}
              <label className="block space-y-1 text-sm font-medium">
                Yeni parola
                <input className={inputClass} name="newPassword" type={inputType} autoComplete="new-password"
                  aria-describedby="first-login-password-rules" minLength={centralAuth ? 12 : 6} maxLength={centralAuth ? 128 : undefined} required autoFocus={!centralAuth} />
              </label>
              <p id="first-login-password-rules" className="text-xs text-[#52615a]">
                {centralAuth ? '12–128 karakter, en az bir harf ve bir rakam.' : 'En az 6 karakter.'}
              </p>
              <label className="block space-y-1 text-sm font-medium">
                Yeni parola tekrarı
                <input className={inputClass} name="confirmation" type={inputType} autoComplete="new-password" required />
              </label>
              <label className="flex items-center gap-2 text-sm text-[#52615a]">
                <input type="checkbox" checked={showPasswords} onChange={event => setShowPasswords(event.target.checked)} />
                Parolaları göster
              </label>
            </fieldset>
            {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
            <button type="submit" disabled={saving}
              className="w-full rounded-xl bg-[#40594f] px-3 py-2.5 text-sm font-semibold text-white hover:bg-[#31483f] disabled:opacity-60">
              {saving ? 'Kaydediliyor…' : 'Kaydet ve devam et'}
            </button>
            <button type="button" disabled={saving} onClick={onBack}
              className="mx-auto block px-3 py-1 text-sm font-medium text-[#52615a] underline-offset-4 hover:underline disabled:opacity-60">
              Girişe dön
            </button>
          </form>
        </section>
      </main>
    </div>
  )
}
