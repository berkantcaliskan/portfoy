export const CRM_STORAGE_MODULES={
 demirturk_projects_v2:'projects',demirturk_appointments_v2:'appointments',demirturk_requests_v2:'requests',
 demirturk_collections_v2:'collections',demirturk_payments_v2:'payments',demirturk_approvals_v2:'approvals',demirturk_shared_files_v2:'files',
} as const
export interface MigrationPreview {key:string;module:string;count:number;duplicateIds:number;missingIds:number;valid:boolean;fingerprint:string;error?:string}
/** Salt okunur: hiçbir store, Auth sırrı, yerel parola veya Meta kaydı aktarılmaz. */
export async function previewCrmMigration(storage:Pick<Storage,'getItem'>):Promise<MigrationPreview[]>{
 const result:MigrationPreview[]=[]
 for(const [key,module] of Object.entries(CRM_STORAGE_MODULES)){
  const raw=storage.getItem(key)||'[]'
  const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw))),b=>b.toString(16).padStart(2,'0')).join('')
  try {
   const records=JSON.parse(raw)
   if(!Array.isArray(records))throw Error('Kayıt listesi bekleniyor.')
   const ids=records.filter(r=>r&&typeof r.id==='string'&&r.id.trim()).map(r=>r.id)
   const duplicateIds=ids.length-new Set(ids).size,missingIds=records.length-ids.length
   result.push({key,module,count:records.length,duplicateIds,missingIds,valid:duplicateIds===0&&missingIds===0,fingerprint})
  }catch{result.push({key,module,count:0,duplicateIds:0,missingIds:0,valid:false,fingerprint,error:'Yerel kayıt biçimi okunamadı; aktarım yapılmadı.'})}
 }
 return result
}
