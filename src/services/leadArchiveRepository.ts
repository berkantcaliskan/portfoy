import type { SupabaseClient } from '@supabase/supabase-js'

export interface ArchivedLead {
  id: string
  full_name: string
  phone: string
  archived_at: string
  archived_by: string
}
export class LeadArchiveError extends Error {
  constructor(message: string, public readonly definitive = false) { super(message) }
}
export function createLeadArchiveRepository(client: SupabaseClient) {
  async function invoke(name: string, args: Record<string, unknown>) {
    let result
    try { result = await client.rpc(name, args).abortSignal(AbortSignal.timeout(15000)) }
    catch { throw Error('Sunucudan onay alınamadı. Aynı işlemi yeniden deneyin.') }
    if (result.error) {
      if (result.error.code === 'PGRST202') throw new LeadArchiveError('Müşteri çöp kutusu sunucu güncellemesi henüz kurulmamış.', true)
      if (String(result.error.message).includes('crm_archive_conflict') || result.error.code === '40001') throw new LeadArchiveError('Müşteri kaydı değişmiş. Listeyi yenileyip tekrar deneyin.', true)
      if (result.error.code === '42501') throw new LeadArchiveError('Bu müşteri için işlem yetkiniz bulunmuyor.', true)
      throw Error('Çöp kutusu işlemi tamamlanamadı. Aynı işlemi yeniden deneyin.')
    }
    return result.data
  }
  return {
    async archive(requestId: string, records: { id: string; expected: string }[]) {
      const data = await invoke('crm_archive_leads', { p_request: requestId, p_records: records })
      if (data?.archived !== true || !Array.isArray(data.ids) || data.ids.length !== records.length
        || records.some(record => !data.ids.includes(record.id))) throw Error('Silme sonucu doğrulanamadı. Aynı işlemi yeniden deneyin.')
    },
    async list(): Promise<ArchivedLead[]> {
      const records: ArchivedLead[] = []
      let after = ''
      for (;;) {
        const data = await invoke('crm_lead_trash_list', { p_after: after })
        if (!data || !Array.isArray(data.records) || typeof data.has_more !== 'boolean') throw Error('Çöp kutusu listesi doğrulanamadı.')
        records.push(...data.records)
        if (!data.has_more) return records.sort((a, b) => b.archived_at.localeCompare(a.archived_at))
        const next = data.records.at(-1)?.id
        if (typeof next !== 'string' || next <= after) throw Error('Çöp kutusu sayfalaması doğrulanamadı.')
        after = next
      }
    },
    async restore(requestId: string, id: string) {
      const data = await invoke('crm_restore_lead', { p_request: requestId, p_id: id })
      if (data?.restored !== true || data.id !== id) throw Error('Geri yükleme sonucu doğrulanamadı. Aynı işlemi yeniden deneyin.')
    },
  }
}
