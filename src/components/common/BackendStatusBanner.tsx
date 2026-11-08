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

const sources = [appointmentStore, requestStore, accountingStore, approvalStore, sharedFileStore,
  contactStore, portfolioStore, creativeStore, calendarStore, messageStore, teamOperationsStore]

export function BackendStatusBanner() {
  const [errors, setErrors] = useState<string[]>([])
  useEffect(() => {
    const update = () => setErrors([...new Set(sources.map(store => store.getReadError()).filter(Boolean))])
    const subscriptions = sources.map(store => store.subscribe(update))
    update()
    return () => subscriptions.forEach(unsubscribe => unsubscribe())
  }, [])
  if (!errors.length) return null
  return <div role="alert" className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm">
    Sunucu görünümü tam doğrulanamadı: {errors.join(' · ')} Pencereye yeniden döndüğünüzde kayıtlar tekrar okunur.
  </div>
}
