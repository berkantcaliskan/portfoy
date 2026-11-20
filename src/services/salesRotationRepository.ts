export interface RotationMember { id: string; name: string }
export interface SalesRotation {
  revision: number
  lastId: string | null
  updatedAt: string | null
  updatedBy: string | null
  canMark: boolean
  members: RotationMember[]
}

type RpcClient = { rpc: (name: string, args?: any) => any }

function parse(data: any): SalesRotation {
  if (!data || typeof data !== 'object' || !Array.isArray(data.members) || !Number.isSafeInteger(data.revision)) {
    throw Error('Çıkış sırası cevabı doğrulanamadı.')
  }
  return {
    revision: data.revision,
    lastId: typeof data.lastId === 'string' ? data.lastId : null,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null,
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : null,
    canMark: data.canMark === true,
    members: data.members.filter((m: any) => m && typeof m.id === 'string' && typeof m.name === 'string'),
  }
}

async function call(client: RpcClient, name: string, args?: Record<string, unknown>) {
  let result
  try { result = await client.rpc(name, args).abortSignal(AbortSignal.timeout(15000)) }
  catch { throw Error('Çıkış sırası sunucusuna ulaşılamadı.') }
  if (result.error) {
    const message = String(result.error.message || '')
    if (result.error.code === 'PGRST202') throw Error('Çıkış sırasının sunucu güncellemesi henüz uygulanmamış.')
    if (message.includes('rotation_conflict')) throw Error('Sıra başka bir oturumda güncellendi. Güncel sıra yüklendi, tekrar deneyin.')
    if (message.includes('rotation_forbidden')) throw Error('Sırayı yalnızca Ön Ofis güncelleyebilir.')
    throw Error('Çıkış sırası sunucuda doğrulanamadı.')
  }
  return parse(result.data)
}

export function createSalesRotationRepository(client: RpcClient) {
  return {
    get: () => call(client, 'crm_rotation_get'),
    mark: (lastId: string, revision: number) => call(client, 'crm_rotation_mark', { p_last: lastId, p_revision: revision }),
  }
}

/** En son çıkandan sonraki kişiden başlayarak sıralanmış liste (ilk eleman sıradaki kişidir). */
export function orderFromNext(members: RotationMember[], lastId: string | null): RotationMember[] {
  if (!members.length) return []
  const last = lastId ? members.findIndex(m => m.id === lastId) : -1
  const start = (last + 1) % members.length
  return [...members.slice(start), ...members.slice(0, start)]
}
