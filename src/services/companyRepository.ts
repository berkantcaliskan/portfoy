export type CompanyDocumentKind = 'department_settings' | 'google_config' | 'google_campaigns' | 'google_logs'
export interface CompanyDocument { kind: CompanyDocumentKind; revision: number; payload: Record<string, any> }
export function createCompanyRepository(client: { rpc: (name: string, args?: any) => any }) {
  async function call(name: string, args: Record<string, unknown>) {
    let result
    try { result = await client.rpc(name, args).abortSignal(AbortSignal.timeout(15000)) }
    catch { throw Error('Şirket ayarları sunucusuna ulaşılamadı. Aynı bilgilerle tekrar deneyin.') }
    if (result.error) {
      const message = String(result.error.message || '')
      if (result.error.code === 'PGRST202') throw Error('Şirket ayarlarının sunucu güncellemesi henüz uygulanmamış.')
      if (message.includes('company_conflict')) throw Error('Bu kayıt başka bir oturumda değişti. Güncel sunucu kaydını yükleyip tekrar düzenleyin.')
      if (message.includes('company_forbidden')) throw Error('Bu şirket ayarını değiştirme yetkiniz yok.')
      if (message.includes('company_invalid')) throw Error('Ayar bilgileri geçersiz. Alanları kontrol edin.')
      throw Error('Şirket kaydı sunucuda doğrulanamadı. Aynı bilgilerle tekrar deneyin.')
    }
    const row = result.data
    if (!row || row.kind !== args.p_kind || !Number.isSafeInteger(row.revision) || row.revision < 0 || !row.payload || typeof row.payload !== 'object' || Array.isArray(row.payload)) throw Error('Şirket ayarları cevabı doğrulanamadı.')
    return row as CompanyDocument
  }
  return {
    get: (kind: CompanyDocumentKind) => call('crm_company_get', { p_kind: kind }),
    async save(kind: CompanyDocumentKind, revision: number, payload: Record<string, unknown>, requestId: string) {
      const row = await call('crm_company_save', { p_kind: kind, p_revision: revision, p_payload: payload, p_request: requestId })
      if (row.revision !== revision + 1) throw Error('Şirket kaydı sürümü doğrulanamadı. Aynı bilgilerle yeniden deneyin.')
      return row
    },
  }
}
