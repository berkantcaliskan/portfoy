import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const REQUIRED_SERVER_VERSION = 20261116211611
export const REQUIRED_META_INTAKE_VERSION = 20261118102018
export function assertMetaIntakeReady(data) {
  const required = ['assignment', 'persistent_cursor', 'stage_updates', 'lead_trash', 'personal_visibility', 'archive_visibility', 'realtime']
  if (!data || !Number.isSafeInteger(data.version) || data.version < REQUIRED_META_INTAKE_VERSION || required.some(field => data[field] !== true)) {
    throw Error('Yayın durduruldu: Meta dağıtımı ve müşteri çöp kutusu sunucu kurulumu doğrulanamadı.')
  }
}
export function assertServerReady(data) {
  if (!data || !Number.isSafeInteger(data.version) || data.version < REQUIRED_SERVER_VERSION || data.ready !== true || !Array.isArray(data.missing) || data.missing.length) {
    throw Error('Yayın durduruldu: sunucu kurulumu bu sürümü karşılamıyor. Önce eksik sunucu kurulumunu uygulayın ve doğrulayın.')
  }
}
export async function checkServerReady(root) {
  // Use exactly the project embedded in the built app, including Vite's environment precedence.
  const { loadEnv } = await import('vite')
  const env = loadEnv('production', root, 'VITE_')
  const url = env.VITE_SUPABASE_URL, key = env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) throw Error('Yayın durduruldu: uygulamanın sunucu bağlantısı tanımlanmamış.')
  let response
  try {
    response = await fetch(new URL('/rest/v1/rpc/crm_server_readiness', url), {
      method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: '{}', signal: AbortSignal.timeout(15000),
    })
  } catch { throw Error('Yayın durduruldu: uygulamanın sunucusuna ulaşılamadı.') }
  if (!response.ok) throw Error('Yayın durduruldu: sunucu hazırlık kontrolü bulunamadı veya erişim reddedildi.')
  const data = await response.json()
  assertServerReady(data)
  let intake
  try {
    const result = await fetch(new URL('/rest/v1/rpc/crm_meta_intake_readiness', url), {
      method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: '{}', signal: AbortSignal.timeout(15000),
    })
    if (result.ok) intake = await result.json()
  } catch { /* Fail closed when the new schema cannot be verified. */ }
  assertMetaIntakeReady(intake)
  return { project: new URL(url).hostname, version: data.version }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await checkServerReady(fileURLToPath(new URL('../', import.meta.url)))
    console.log(`Sunucu hazırlığı doğrulandı: ${result.project} · ${result.version}`)
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
