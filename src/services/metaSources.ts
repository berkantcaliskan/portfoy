import type {Lead} from '../types/lead'

export function getMetaSourceChoices(lead?: Lead | null) {
  const byId = new Map<string, { id: string; label: string }>()
  for (const inquiry of lead?.inquiries || []) {
    if (!/^\d{1,32}$/.test(inquiry.metaLeadgenId || '')) continue
    const date = inquiry.createdAt ? new Date(inquiry.createdAt) : null
    const when = date && Number.isFinite(date.getTime()) ? date.toLocaleString('tr-TR') : ''
    const attribution = inquiry.metaAdName || inquiry.campaignName
    byId.set(inquiry.metaLeadgenId!, { id: inquiry.metaLeadgenId!, label: `${inquiry.formName || 'Meta başvurusu'}${attribution ? ` • ${attribution}` : ''}${when ? ` • ${when}` : ''} • …${inquiry.metaLeadgenId!.slice(-6)}` })
  }
  if (/^\d{1,32}$/.test(lead?.metaLeadId || '') && !byId.has(lead!.metaLeadId!)) {
    byId.set(lead!.metaLeadId!, { id: lead!.metaLeadId!, label: lead!.formName || 'Meta başvurusu' })
  }
  return [...byId.values()]
}
