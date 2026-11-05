import {createClient} from '@supabase/supabase-js'
import {createExistingSessionCrmClient} from './crmExistingSession'

export function createBackendPreviewClient(){
 const url=import.meta.env.VITE_SUPABASE_URL,key=import.meta.env.VITE_SUPABASE_ANON_KEY
 if(!url||!key)throw Error('Sunucu adresi ve herkese açık istemci anahtarı yapılandırılmalı.')
 // Geçiş alanının Auth oturumu mevcut Meta istemcisinden ve eski disk aynasından ayrıdır.
 // Tarayıcı SPA implicit callback'i yeni sekmede de çalışır; SDK callback hash'ini temizler.
 return createClient(url,key,{auth:{storageKey:'demirturk-crm-backend-preview-auth',storage:sessionStorage,persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'implicit'}})
}

/** Kullanıcının açık seçimiyle, mevcut JWT'yi yalnızca bellekte kullanır.
 * Meta Auth istemcisi oluşturulmaz; refresh/revoke veya storage yazımı yapılmaz. */
export function createBackendClientFromExistingSession(){
 const url=import.meta.env.VITE_SUPABASE_URL,key=import.meta.env.VITE_SUPABASE_ANON_KEY
 if(!url||!key)throw Error('Sunucu yapılandırması eksik.')
 return createExistingSessionCrmClient({url,publicKey:key,storage:localStorage})
}
