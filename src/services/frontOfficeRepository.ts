import type { OfficeContext, OfficeKind, OfficePayload, OfficeRecord } from '../types/frontOffice'

type RpcClient = { rpc: (name: string, args?: any) => any }
export interface OfficeCommand { requestId: string; id: string; kind: OfficeKind; revision: number; payload: OfficePayload }
export function createFrontOfficeRepository(client: RpcClient) {
  async function call(name: string, args?: Record<string, unknown>) {
    let result
    try { result = await client.rpc(name, args).abortSignal(AbortSignal.timeout(15000)) }
    catch { throw Error('Sunucuya ulaşılamadı. Aynı işlemi yeniden deneyebilirsiniz.') }
    if (result.error) {
      const message = String(result.error.message || '')
      if (result.error.code === 'PGRST202' || message.includes('does not exist')) throw Error('Ön Ofis sunucu kurulumu henüz uygulanmamış. Yönetici kurulumu tamamlamalı.')
      if (message.includes('office_conflict')) throw Error('Kayıt başka bir oturumda değişti. Listeyi yenileyip güncel kaydı açın; yazdıklarınız bu pencerede korunuyor.')
      if (message.includes('office_deleted')) throw Error('Bu girdi başka bir oturumda silinmiş. Listeyi yenileyin.')
      if (message.includes('office_contract_number_exhausted')) throw Error('Bu yıl için sözleşme numarası sınırına ulaşıldı.')
      if (message.includes('office_forbidden') || message.includes('crm_identity')) throw Error('Ön Ofis erişiminiz yok veya oturumunuz sona erdi.')
      if (message.includes('office_invalid')) throw Error('Bilgileri kontrol edin. Ad, tarih ve gerekli sözleşme alanlarını doldurun.')
      throw Error('Sunucu işlemi tamamlanamadı. Aynı işlemi yeniden deneyebilirsiniz.')
    }
    return result.data
  }
  return {
    async context(): Promise<OfficeContext> {
      const data = await call('crm_office_context')
      if (!data || typeof data.canAccess !== 'boolean' || typeof data.isAdmin !== 'boolean' || !Array.isArray(data.assignments) || !Array.isArray(data.consultants) || !Array.isArray(data.representatives)) throw Error('Ön Ofis erişimi doğrulanamadı.')
      return data
    },
    async assign(userId: string, enabled: boolean) {
      await call('crm_office_assign', { p_user_id: userId, p_enabled: enabled })
    },
    async deleteVisitor(id: string, revision: number, requestId: string) {
      const result = await call('crm_office_delete_visitor', { p_id: id, p_revision: revision, p_request: requestId })
      if (result?.id !== id || result.deleted !== true) throw Error('Silme işlemi doğrulanamadı. Aynı işlemi yeniden deneyin.')
    },
    async list(kind: OfficeKind): Promise<OfficeRecord[]> {
      const records: OfficeRecord[] = []
      let after = ''
      for (;;) {
        const page = await call('crm_office_list', { p_kind: kind, p_after: after })
        if (!page || !Array.isArray(page.records) || typeof page.hasMore !== 'boolean') throw Error('Ön Ofis kayıtları doğrulanamadı.')
        for (const row of page.records) {
          if (!row || row.kind !== kind || typeof row.id !== 'string' || !Number.isSafeInteger(row.revision) || row.revision < 1 || !row.payload || typeof row.payload.name !== 'string') throw Error('Ön Ofis kaydı doğrulanamadı.')
        }
        records.push(...page.records)
        if (!page.hasMore) return records
        const next = page.records.at(-1)?.id
        if (!next || next <= after) throw Error('Kayıt sayfalaması doğrulanamadı.')
        after = next
      }
    },
    async save(command: OfficeCommand): Promise<OfficeRecord> {
      const payload = { ...command.payload }
      delete payload.contractNumber
      if (payload.staffIds) payload.staffId = payload.staffIds[0] || ''
      if (payload.representativeIds) payload.representativeId = payload.representativeIds[0] || ''
      const data = await call('crm_office_save', { p_request: command.requestId, p_id: command.id, p_kind: command.kind, p_revision: command.revision, p_payload: payload })
      if (!data || data.id !== command.id || data.kind !== command.kind || data.revision !== command.revision + 1 || !data.payload) throw Error('Kayıt sonucu doğrulanamadı. Aynı işlemi yeniden deneyin.')
      return data
    },
  }
}
