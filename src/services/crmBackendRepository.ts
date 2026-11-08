import type {SupabaseClient} from '@supabase/supabase-js'

export const CRM_BACKEND_MODULES=['projects','appointments','requests','collections','payments','approvals','files','contacts','properties','creative_schedule','creative_assets','creative_comments','creative_briefs','calendar','calendar_overrides','brand_kit','messages','team_presence','team_assets','team_leaves'] as const
export type CrmBackendModule=typeof CRM_BACKEND_MODULES[number]
export interface CrmBackendRecord {id:string;payload:Record<string,unknown>;revision:number;owner_id:string;department:string;created_at:string;updated_at:string}
export interface CrmWriteCommand {requestId:string;module:CrmBackendModule;id:string;revision:number;payload:Record<string,unknown>;archive?:boolean}
export class CrmBackendError extends Error {
 code:string
 constructor(code:string,message:string){super(message);this.code=code}
}
const messages:Record<string,string>={
 crm_financial_record_locked:'Kesinleşmiş finans kaydı değiştirilemez. Yetkili düzeltme işlemi gerekli.',
 crm_invalid_refund:'İade için tahsil edilmiş kapora ve en az üç karakterlik gerekçe gerekli.',
 crm_revision_conflict:'Kayıt başka bir oturumda değişmiş. Güncel kaydı okuyup değişikliği yeniden değerlendirin.',
 crm_request_conflict:'İşlem kimliği farklı bir değişiklik için kullanılmış; kayıt gönderilmedi.',
 crm_forbidden:'Bu kayıt için sunucu yetkiniz yok.',
 crm_module_not_activated:'Bu modülün merkezi yazımı henüz yönetici tarafından etkinleştirilmedi.',
 crm_approval_workflow_required:'Onay kararı ayrı yetkili iş akışı gerektirir.',
 crm_rate_limited:'İşlem sınırına ulaşıldı. Daha sonra yeniden deneyin.',
 crm_invalid_input:'Kayıt isteği geçersiz.',
 crm_identity_not_assigned:'Etkin sunucu personeli eşlemesi gerekli.',
 authentication_required:'Supabase oturumu gerekli.',
}
function errorFor(error:any):CrmBackendError {
 const code=Object.keys(messages).find(key=>String(error?.message||'').includes(key))
  || (['22007','22008','22P02','22023','23514'].includes(error?.code)?'crm_invalid_input':undefined)
  || (['PGRST301','PGRST302'].includes(error?.code)?'authentication_required':undefined)
  || (error?.code==='42501'?'crm_forbidden':undefined)
 return new CrmBackendError(code||'request_failed',code?messages[code]:'Sunucu sonucu alınamadı. Yazım gerçekleşmiş olabilir; aynı işlem kimliğini koruyun ve durumu kontrol edin.')
}
export function createCrmBackendRepository(client:SupabaseClient){
 const invoke=async(name:string,args:Record<string,unknown>)=>{
  let result
  try{result=await client.rpc(name,args).abortSignal(AbortSignal.timeout(15000))}catch(error){throw errorFor(error)}
  if(result.error)throw errorFor(result.error)
  return result.data
 }
 return {
  async list(module:CrmBackendModule,after='',limit=50):Promise<{records:CrmBackendRecord[];next:string|null}>{
   const data=module==='files'
    ? await invoke('crm_file_list',{p_after:after,p_limit:limit})
    : await invoke('crm_backend_list',{p_module:module,p_after:after,p_limit:limit})
   if(!data||!Array.isArray(data.records)||typeof data.has_more!=='boolean')throw new CrmBackendError('invalid_response','Sunucu kayıt listesi doğrulanamadı.')
   const records=data.records.slice(0,limit)
   if(data.has_more&&!records.length)throw new CrmBackendError('invalid_response','Sunucu sayfalaması eksik döndü.')
   if(records.some((r:any)=>!r||typeof r.id!=='string'||!Number.isSafeInteger(r.revision)||r.revision<1||!r.payload||typeof r.payload!=='object'||Array.isArray(r.payload)))throw new CrmBackendError('invalid_response','Sunucu kayıt sürümü doğrulanamadı.')
   return {records,next:data.has_more&&records.length?records.at(-1).id:null}
  },
  // Ağ hatasında otomatik tekrar veya tam kayıt upsert yoktur. Tekrar için aynı command/requestId kullanılır.
  async write(command:CrmWriteCommand, approvalDecision = false, fileNotes = false):Promise<{id:string;revision:number;updatedAt:string;replayed:boolean;payload?:Record<string,unknown>}>{
   if(!CRM_BACKEND_MODULES.includes(command.module)||!command.id||!Number.isSafeInteger(command.revision)||command.revision<0||!command.requestId)throw new CrmBackendError('invalid_input','Geçerli kayıt sürümü ve işlem kimliği gerekli.')
   const result=approvalDecision
    ? await invoke('crm_decide_approval',{p_request:command.requestId,p_id:command.id,p_revision:command.revision,p_decision:command.payload.status,p_notes:command.payload.reviewNotes||''})
    : await invoke(fileNotes ? 'crm_file_notes_write' : 'crm_backend_write',{p_request:command.requestId,p_module:command.module,p_id:command.id,p_revision:command.revision,p_payload:command.payload,p_archive:command.archive===true})
   if(!result||result.id!==command.id||!Number.isSafeInteger(result.revision)||result.revision<1||typeof result.updated_at!=='string'||typeof result.replayed!=='boolean')throw new CrmBackendError('invalid_response','Yazım sonucu doğrulanamadı; aynı işlem kimliğini koruyun.')
   if(result.payload&&result.payload.id!==command.id)throw new CrmBackendError('invalid_response','Sunucu kayıt kimliği doğrulanamadı.')
   return {id:result.id,revision:result.revision,updatedAt:result.updated_at,replayed:result.replayed,
    payload:result.payload&&typeof result.payload==='object'&&!Array.isArray(result.payload)?result.payload:undefined}
  },
 }
}
