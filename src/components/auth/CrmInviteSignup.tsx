import { useEffect, useState, type FormEvent } from 'react'
import { createCrmAccountService } from '@/services/crmAccountService'
import { createBackendPreviewClient } from '@/services/crmBackendClient'

export default function CrmInviteSignup() {
  const [client] = useState(createBackendPreviewClient)
  const [email, setEmail] = useState('')
  const [invite, setInvite] = useState('')
  const [password, setPassword] = useState('')
  const [hasSession, setHasSession] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    const { data } = client.auth.onAuthStateChange((_event, session) => setHasSession(Boolean(session)))
    return () => data.subscription.unsubscribe()
  }, [client])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setStatus('')
    const account = createCrmAccountService(client)
    try {
      if (!hasSession) {
        if (accepting) {
          await account.signInForInvite(email, password, invite.trim())
        } else {
          const redirect = window.location.protocol === 'file:' ? undefined : new URL('?workspace=register', window.location.href).href
          const result = await account.registerWithInvite(email, password, invite.trim(), redirect)
          if (result.confirmationRequired) {
            setAccepting(true)
            setStatus('E-postanızdaki doğrulama bağlantısını açın. Sonra bu ekrana dönüp parolanızla daveti kabul edin.')
            return
          }
        }
      }
      await account.acceptInvite(invite.trim() || undefined)
      window.location.assign('?')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Kayıt tamamlanamadı.')
    } finally {
      setPassword('')
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f5f2] p-6 flex items-center justify-center">
      <section className="w-full max-w-md space-y-5 rounded-3xl border bg-white p-8">
        <h1 className="text-2xl font-semibold">CRM daveti</h1>
        <form onSubmit={submit} className="space-y-4">
          {!hasSession && <>
            <label className="block">Davet edilen e-posta
              <input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} className="mt-1 block w-full rounded-lg border p-2" />
            </label>
            <label className="block">Davet kodu
              <input required type="password" autoComplete="off" value={invite} onChange={event => setInvite(event.target.value)} className="mt-1 block w-full rounded-lg border p-2" />
            </label>
            <label className="block">Parola
              <input required type="password" autoComplete={accepting ? 'current-password' : 'new-password'} minLength={accepting ? undefined : 12} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} className="mt-1 block w-full rounded-lg border p-2" />
            </label>
          </>}
          <button disabled={busy} className="rounded-lg bg-[#485a50] px-4 py-2 text-white disabled:opacity-50">
            {hasSession || accepting ? 'Daveti kabul et' : 'Davetle kaydol'}
          </button>
          {!hasSession && <button type="button" disabled={busy} className="block text-sm underline" onClick={() => {setAccepting(!accepting);setStatus('')}}>
            {accepting ? 'İlk kez kayıt oluyorum' : 'E-postamı zaten doğruladım'}
          </button>}
        </form>
        {status && <p role="status" className="text-sm">{status}</p>}
        <a href="?" className="text-sm underline">Giriş ekranına dön</a>
      </section>
    </main>
  )
}
