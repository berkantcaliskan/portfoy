import React, { useRef, useState, useSyncExternalStore } from 'react'
import { DoorOpen } from 'lucide-react'
import { frontOfficeStore } from '@/services/frontOfficeStore'
import type { AppUser } from '@/services/userStore'
import { isSystemAccount, SYSTEM_CATEGORY_LABEL } from '@/types/teamDirectory'

export function FrontOfficeAccessPanel({ users }: { users: AppUser[] }) {
  const state = useSyncExternalStore(frontOfficeStore.subscribe, frontOfficeStore.getSnapshot)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const pending = useRef(false)
  if (!state.isAdmin) return null
  async function assign(user: AppUser, enabled: boolean) {
    if (pending.current) return
    pending.current = true; setBusy(user.id); setError('')
    try { await frontOfficeStore.repository().assign(user.id, enabled); await frontOfficeStore.refresh() }
    catch (e) { setError(e instanceof Error ? e.message : 'Erişim kaydedilemedi.') }
    finally { pending.current = false; setBusy('') }
  }
  return <section className="rounded-3xl border border-[#4a443f] p-5 space-y-3">
    <h3 className="font-semibold flex gap-2 items-center"><DoorOpen className="w-4 h-4" /> Ön Ofis Erişimi</h3>
    <p className="text-xs text-[#a69f99]">Departmanı değiştirmeden Gelen Müşteriler ve Sözleşmeler alanını açar. ADMIN hesapları bu alana erişebilir.</p>
    {(state.error || error) && <p role="alert" className="text-sm text-rose-400">{error || state.error} <button className="underline" onClick={() => void frontOfficeStore.refresh()}>Yeniden kontrol et</button></p>}
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{[...users.filter(u => !isSystemAccount(u)), ...users.filter(isSystemAccount)].map(user => <label key={user.id} className="flex items-center gap-2 rounded-xl border border-[#4a443f] p-3 text-sm">
      <input type="checkbox" checked={user.role === 'ADMIN' || state.assignments.includes(user.id)} disabled={Boolean(busy) || state.loading || Boolean(state.error) || user.role === 'ADMIN'} onChange={e => void assign(user, e.target.checked)} />
      <span>{user.fullName}<span className="block text-xs text-[#a69f99]">{busy === user.id ? 'Kaydediliyor…' : isSystemAccount(user) ? `${SYSTEM_CATEGORY_LABEL} · Erişim açık` : user.role === 'ADMIN' ? 'ADMIN · Erişim açık' : user.department}</span></span>
    </label>)}</div>
  </section>
}
