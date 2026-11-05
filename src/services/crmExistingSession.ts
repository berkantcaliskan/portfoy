import {createClient} from '@supabase/supabase-js'

/** Yalnızca aynı Supabase projesinin mevcut oturum erişim JWT'sini okur.
 * Refresh tokenı kopyalanmaz, storage değişmez. Bu veri yetki kanıtı değildir:
 * kullanım öncesi Auth getUser ve canonical personel RPC'si zorunludur. */
export function readExistingCrmAccessToken(storage:Pick<Storage,'getItem'>,supabaseUrl:string):string{
 const host=new URL(supabaseUrl).hostname,project=host.split('.')[0]
 if(!project)throw Error('Sunucu adresi geçersiz.')
 let data:any
 try{data=JSON.parse(storage.getItem(`sb-${project}-auth-token`)||'null')}catch{throw Error('Mevcut Supabase oturumu okunamadı.')}
 if(typeof data?.access_token!=='string'||!data.access_token)throw Error('Bu tarayıcıda mevcut Supabase oturumu bulunamadı. Yerel CRM girişi sunucu oturumu değildir.')
 return data.access_token
}

export function createExistingSessionCrmClient(options:{url:string;publicKey:string;storage:Pick<Storage,'getItem'>;fetcher?:typeof fetch}){
 const token=readExistingCrmAccessToken(options.storage,options.url)
 return createClient(options.url,options.publicKey,{global:{headers:{Authorization:`Bearer ${token}`},...(options.fetcher?{fetch:options.fetcher}:{})},auth:{storageKey:'crm-backend-memory-'+crypto.randomUUID(),persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
}
