import { useEffect, useState } from 'react'
import { appointmentStore } from '@/services/appointmentStore'
import { requestStore } from '@/services/requestStore'
import { accountingStore } from '@/services/accountingStore'
import { approvalStore } from '@/services/approvalStore'
import { sharedFileStore } from '@/services/sharedFileStore'
import { contactStore } from '@/services/contactStore'
import { portfolioStore } from '@/services/portfolioStore'
import { creativeStore } from '@/services/creativeStore'
import { calendarStore } from '@/services/calendarStore'
import { messageStore } from '@/services/messageStore'
import { teamOperationsStore } from '@/services/teamOperationsStore'
import { leadStore } from '@/services/leadStore'
import { googleAdsStore } from '@/services/googleAdsStore'

const sources = [appointmentStore, requestStore, accountingStore, approvalStore, sharedFileStore,
  contactStore, portfolioStore, creativeStore, calendarStore, messageStore, teamOperationsStore, leadStore, googleAdsStore]

export function BackendStatusBanner() {
  const [errors, setErrors] = useState<string[]>([])
  useEffect(() => {
    const update = () => setErrors([...new Set(sources.map(store => store.getReadError()).filter(Boolean))])
    const subscriptions = sources.map(store => store.subscribe(update))
    update()
    return () => subscriptions.forEach(unsubscribe => unsubscribe())
  }, [])
  if (!errors.length) return null
  return <div role="alert" className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 text-xs leading-relaxed"
    style={{ color: 'var(--tertiary-white)', background: 'color-mix(in srgb, #b58a35 14%, var(--card-surface))', borderColor: 'color-mix(in srgb, #b58a35 45%, transparent)' }}>
    <span>Sunucu kayıtları yenilenemedi: {errors.join(' · ')} Veriler güncel olmayabilir.</span>
    <button type="button" className="shrink-0 rounded-full border border-current/30 px-3 py-1 font-semibold hover:opacity-75"
      onClick={() => window.dispatchEvent(new Event('crm:refresh-requested'))}>Yeniden dene</button>
  </div>
}
