import type { NoteDocumentDetails } from '../components/accounting/PromissoryNoteDocument'
import type { NoteInstallment } from '../utils/promissoryNotes'

export interface SavedNotePayload {
  details: NoteDocumentDetails
  notes: (NoteInstallment & { cents: number })[]
  financing: { totalAmount: string; downPayments: { id: number; amount: string; date: string }[]; deposit: string; hasDeposit: boolean }
}
export interface SavedNote { id: string; revision: number; payload: SavedNotePayload; updated_at: string }
export function createPromissoryRepository(client: { rpc: (name: string, args?: any) => any }) {
  async function call(name: string, args?: Record<string, unknown>) {
    let result
    try { result = await client.rpc(name, args).abortSignal(AbortSignal.timeout(15000)) }
    catch { throw Error('Senet sunucusuna ulaşılamadı. Kaydı aynı bilgilerle yeniden deneyin.') }
    if (result.error) {
      const message = String(result.error.message || '')
      if (result.error.code === 'PGRST202') throw Error('Senet arşivinin sunucu kurulumu uygulanmamış.')
      if (message.includes('note_forbidden')) throw Error('Senet arşivi için Muhasebe veya ADMIN erişimi gerekiyor.')
      if (message.includes('note_conflict')) throw Error('Senet kaydı başka bir oturumda değişti. Kayıtlı senetlerden güncel kaydı kontrol edin.')
      if (message.includes('note_invalid')) throw Error('Senet bilgileri sunucuda doğrulanamadı. Tutar ve tarihleri kontrol edin.')
      throw Error('Senet kaydı doğrulanamadı. Aynı bilgilerle yeniden deneyin.')
    }
    return result.data
  }
  const valid = (row: any): row is SavedNote => Boolean(row && typeof row.id === 'string' && Number.isSafeInteger(row.revision) && row.revision > 0 && row.payload?.details && Array.isArray(row.payload?.notes) && row.payload.notes.length)
  return {
    async list(): Promise<SavedNote[]> {
      const records: SavedNote[] = []
      let after = ''
      for (;;) {
        const result = await call('crm_note_list', { p_after: after })
        if (!result || !Array.isArray(result.records) || typeof result.hasMore !== 'boolean' || !result.records.every(valid)) throw Error('Senet listesi doğrulanamadı.')
        records.push(...result.records)
        if (!result.hasMore) return records.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        const next = result.records.at(-1)?.id
        if (!next || next <= after) throw Error('Senet sayfalaması doğrulanamadı.')
        after = next
      }
    },
    async save(requestId: string, id: string, revision: number, payload: SavedNotePayload): Promise<SavedNote> {
      const result = await call('crm_note_save', { p_request: requestId, p_id: id, p_revision: revision, p_payload: payload })
      if (!valid(result) || result.id !== id || result.revision !== revision + 1) throw Error('Senet kayıt sonucu doğrulanamadı. Aynı bilgilerle yeniden deneyin.')
      return result
    },
  }
}
