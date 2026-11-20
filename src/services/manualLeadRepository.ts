import type { SupabaseClient } from '@supabase/supabase-js'
import type { Lead } from '@/types/lead'
import { rowToLead } from './dbMapper'

export class ManualLeadValidationError extends Error {}

export async function createManualLead(client: SupabaseClient, requestId: string,
  lead: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>): Promise<Lead> {
  const payload = {
    fullName: lead.fullName, phone: lead.phone, notes: lead.notes || '',
    stage: lead.stage || 'NEW', callStatus: lead.callStatus || 'WAITING',
    assignedToUserId: lead.assignedToUserId || '',
    preferredHousingType: lead.preferredHousingType || '',
  }
  let result
  try {
    const customChannel=lead.channel && ['Sahibinden','Hepsiemlak','Direkt'].includes(lead.channel)
    result = await client.rpc(customChannel ? 'crm_manual_lead_channel' : 'crm_create_manual_lead',
      { p_request: requestId, p_payload: payload, ...(customChannel ? {p_channel:lead.channel} : {}) })
      .abortSignal(AbortSignal.timeout(15000))
  } catch {
    throw Error('Sunucudan kayıt onayı alınamadı. Bilgileri koruyarak Kaydet ile yeniden deneyin.')
  }
  if (result.error) {
    const message = String(result.error.message || '')
    if (result.error.code === 'PGRST202') throw new ManualLeadValidationError('Müşteri kayıt güncellemesi sunucuda henüz kurulmamış.')
    if (message.includes('crm_manual_lead_forbidden')) throw new ManualLeadValidationError('Müşteri ekleme yetkiniz bulunmuyor.')
    if (message.includes('crm_manual_lead_invalid')) throw new ManualLeadValidationError('Müşteri bilgilerini ve seçilen temsilciyi kontrol edin.')
    if (message.includes('crm_manual_lead_conflict')) throw Error('Önceki kaydın bilgileriyle tekrar deneyin.')
    throw Error('Müşteri kaydı sunucuda doğrulanamadı. Kaydet ile yeniden deneyin.')
  }
  const row = result.data
  if (!row || row.id !== 'crm-manual-' + requestId || row.source !== 'DIRECT' || !row.created_at || !row.updated_at) {
    throw Error('Sunucudan gelen müşteri kaydı doğrulanamadı. Kaydet ile yeniden deneyin.')
  }
  return rowToLead(row)
}
