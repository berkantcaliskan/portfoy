import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ChevronRight, LoaderCircle } from 'lucide-react'
import { userStore, type SwitchTarget } from '@/services/userStore'
import { compareTeamMembers, teamDepartmentLabel } from '@/types/teamDirectory'

export function AccountSwitchPanel({ onBack }: { onBack: () => void }) {
  const [accounts, setAccounts] = useState<SwitchTarget[] | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const switching = useRef(false)
  useEffect(() => {
    let active = true
    setError('')
    userStore.listSwitchTargets().then(rows => {
      if (active) setAccounts(rows.sort(compareTeamMembers))
    }).catch(err => { if (active) setError(err.message) })
    return () => { active = false }
  }, [attempt])

  async function choose(account: SwitchTarget) {
    if (switching.current) return
    switching.current = true
    setBusy(account.id)
    setError('')
    try {
      await userStore.switchStaffAccount(account.id)
    } catch (err) {
      switching.current = false
      setBusy('')
      setError(err instanceof Error ? err.message : 'Hesaba geçilemedi.')
    }
  }

  return <section aria-label="Şu hesaba geç" aria-busy={Boolean(busy)}>
    <div className="flex items-center gap-2 border-b border-[#4a443f]/60 pb-2">
      <button type="button" aria-label="Profile geri dön" disabled={Boolean(busy)} onClick={onBack}
        className="rounded-full p-2 hover:bg-[#4a443f]/40"><ArrowLeft size={15}/></button>
      <h3 className="text-sm font-semibold">Şu hesaba geç…</h3>
    </div>
    {error && <div role="alert" className="px-2 pt-2 text-xs text-rose-500">{error}
      {accounts === null && <button type="button" className="ml-2 underline" onClick={() => setAttempt(n => n+1)}>Tekrar dene</button>}
    </div>}
    {accounts === null && !error && <p role="status" className="px-2 py-3 text-xs">Hesaplar yükleniyor…</p>}
    {accounts?.length === 0 && <p className="px-2 py-3 text-xs">Geçiş yapılabilecek hesap bulunamadı.</p>}
    <ul className="mt-1 max-h-[min(54vh,26rem)] overflow-y-auto overscroll-contain">
      {accounts?.map(account => <li key={account.id}>
        <button type="button" disabled={Boolean(busy) || !account.available} onClick={() => void choose(account)}
          className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left hover:bg-[#4a443f]/30 disabled:opacity-60">
          <span className="min-w-0"><span className="block truncate text-sm font-semibold">{account.fullName}</span>
            <span className="block truncate text-xs opacity-70">@{account.username} · {teamDepartmentLabel(account)}</span>
            {!account.available && <span className="text-xs">Hesap doğrulaması gerekiyor</span>}
          </span>
          {busy === account.id ? <LoaderCircle aria-label="Geçiş yapılıyor" size={15} className="shrink-0 animate-spin"/>
            : account.available && <ChevronRight size={15} className="shrink-0 opacity-60"/>}
        </button>
      </li>)}
    </ul>
  </section>
}
