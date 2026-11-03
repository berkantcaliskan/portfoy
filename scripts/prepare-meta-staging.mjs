// Yalnızca yerel dosya üretir; ağ, deploy veya veritabanı bağlantısı yoktur.
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const out=process.argv[2]
if(!out) throw Error('Kullanım: node scripts/prepare-meta-staging.mjs <yeni-boş-çıktı-klasörü>')
fs.mkdirSync(out,{recursive:true})
if(fs.readdirSync(out).length) throw Error('Çıktı klasörü boş olmalı; mevcut dosyalar değiştirilmedi.')
const read=p=>fs.readFileSync(path.join(root,p),'utf8')
const schema=read('docs/supabase_schema.sql')
const start=schema.indexOf('CREATE TABLE IF NOT EXISTS public.app_users')
const end=schema.indexOf('-- 4. PROJELER')
if(start<0||end<start) throw Error('Temel şema sınırı bulunamadı.')
const guard=`-- YALNIZCA YENİ VE BOŞ STAGING PROJESİ. Üretimde çalıştırmayın.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.app_users') IS NOT NULL OR to_regclass('public.leads') IS NOT NULL OR to_regclass('public.lead_activities') IS NOT NULL THEN
  RAISE EXCEPTION 'Boş olmayan proje: kurulum durduruldu. Üretimde çalıştırmayın.';
 END IF;
END $$;
`
fs.writeFileSync(path.join(out,'01_BOS_STAGING_KUR.sql'),guard+schema.slice(start,end)+`
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_users,public.leads,public.lead_activities FROM anon,authenticated;
COMMIT;
`+read('supabase/migrations/202610310001_meta_pipeline.sql')+'\n'+read('supabase/migrations/202611030001_meta_source_context.sql'))
fs.writeFileSync(path.join(out,'02_YONETICI_VE_RLS.sql'),`-- Önce Supabase Authentication bölümünde test kullanıcısı oluşturun.
-- Aşağıdaki UUID yer tutucusunu o hesabın User UID değeriyle değiştirin.
BEGIN;
DO $$ DECLARE uid uuid := '00000000-0000-0000-0000-000000000000'; BEGIN
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=uid) THEN RAISE EXCEPTION 'Geçerli Auth kullanıcı UUID değeri gerekli.'; END IF;
 INSERT INTO public.app_users(id,full_name,username,password,department,role,scope)
 VALUES('staging-meta-admin','Staging Meta Yöneticisi','staging-meta-admin',gen_random_uuid()::text,'Yönetim','ADMIN','ALL')
 ON CONFLICT(id) DO NOTHING;
 INSERT INTO public.meta_members(auth_user_id,app_user_id,can_send,is_admin)
 VALUES(uid,'staging-meta-admin',true,true)
 ON CONFLICT(auth_user_id) DO UPDATE SET app_user_id=excluded.app_user_id,can_send=true,is_admin=true;
END $$;
COMMIT;
`+read('supabase/rollout/02_crm_rls_after_auth.sql')+`
-- Bu ayar yalnızca yukarıdaki korumalı geçiş başarılıysa uygulanmalıdır.
UPDATE public.meta_settings SET security_ready=true,enabled=false,auto_sync=false WHERE id=true;
SELECT enabled,auto_sync,security_ready FROM public.meta_settings;
`)
fs.writeFileSync(path.join(out,'03_SUNUCU_SECRETS.env.example'),`# Dashboard > Edge Functions > Secrets. VITE_ öneki kullanmayın.
META_TEST_ONLY=true
META_APP_SECRET=
META_VERIFY_TOKEN=
META_PAGE_ACCESS_TOKEN=
META_PAGE_ID=
META_GRAPH_VERSION=
META_DATASET_ID=
META_CAPI_ACCESS_TOKEN=
META_TEST_EVENT_CODE=
META_ALLOWED_ORIGINS=http://localhost:5173
`)
fs.writeFileSync(path.join(out,'04_TARAYICI.env.example'),`VITE_SUPABASE_URL=https://YOUR_STAGING_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_STAGING_PUBLIC_KEY
VITE_ENABLE_SUPABASE_SYNC=false
`)
fs.copyFileSync(path.join(root,'docs/META_TEST_KURULUMU.md'),path.join(out,'BASLA_BURADAN.md'))
console.log('Staging hazırlık dosyaları üretildi. Hiçbir servise bağlanılmadı.')
