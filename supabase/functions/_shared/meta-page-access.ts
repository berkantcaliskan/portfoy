import {MetaError, graphGet} from './meta-core.ts'

/** Sırlar yalnızca sunucuda kullanılır. */
export function getMetaPageAccess(env:(name:string)=>string){
 const pageId=env('META_PAGE_ID').trim()
 if(!/^\d{1,32}$/.test(pageId)) throw new MetaError(503,'Sunucuda geçerli Meta sayfa kimliği gerekli.')
 const systemToken=env('META_SYSTEM_USER_TOKEN').trim()
 if(systemToken) return {pageId,token:systemToken,mode:'SYSTEM_USER' as const}
 const pageToken=env('META_PAGE_ACCESS_TOKEN').trim()
 if(!pageToken) throw new MetaError(503,'Sunucuda Meta sistem kullanıcısı veya sayfa erişim tokenı gerekli.')
 return {pageId,token:pageToken,mode:'PAGE' as const}
}

/** Form API'si Page tokenı ister. Sistem kullanıcısı sırrından hedef sayfanın
 * tokenı sunucuda okunur; istemciye veya kalıcı loglara döndürülmez. */
export async function resolveMetaPageAccess(env:(name:string)=>string,version:string,fetcher:typeof fetch=fetch){
 const access=getMetaPageAccess(env)
 if(access.mode==='PAGE') return access
 const page=await graphGet(`${access.pageId}?fields=id,access_token`,access.token,version,fetcher)
 if(String(page.id)!==access.pageId || typeof page.access_token!=='string' || !page.access_token.trim()) {
  throw new MetaError(503,'Sistem kullanıcısından hedef sayfa erişimi alınamadı; sayfa atamasını ve izinlerini kontrol edin.')
 }
 return {...access,token:page.access_token.trim()}
}
