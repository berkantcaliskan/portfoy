# Meta güvenli geçiş ve geri dönüş planı

Durum: demo yalnızca elle Meta geri bildirimi modundadır. Otomatik aşama gönderimi ve arka plan worker kilitlidir; canlıya dağıtım yapılmadı. Bu dosya bir uygulama planıdır. Aşağıdaki üretim işlemleri ayrıca yönetici onayı gerektirir. Yerel CRM parolası, Supabase Auth oturumu değildir.

## 1. Ön koşullar ve durdurma sınırları

1. Çalışan uygulama, Supabase şeması/politikaları, Edge Function sürümleri ve kullanıcıya ait yerel veritabanları için erişimi sınırlı yedek alın. Yedekleri GitHub'a koymayın.
2. Bu sürüm GitHub main `02cfd9943f8f9504aeef03c042c6a744b6cd8ac5` temel alınarak hazırlanmıştır. Güncel CRM özellikleri üç yönlü karşılaştırmayla korunmuştur. Değişiklikleri ayrı feature dalında inceleyin; otomatik main merge, üretim yayını veya canlı migration çalıştırmayın.
3. Önce ayrı Supabase staging projesi ve Meta Test Events kullanın. Gerçek müşteri kopyalarını geliştirme ortamına taşımayın; izole testlerde yapay veriler kullanın.
4. Mevcut tam CRM kimlik doğrulaması hâlâ yerel parola mekanizmasıdır. `meta_members` ile doğrulanmış Auth kimliği eşlenmeden Meta sunucu işlemleri çalışmaz. `VITE_ENABLE_SUPABASE_SYNC=false` varsayılanını koruyun. Genel CRM sync, eski upsert ve departman yetkileri ayrıca kabul testinden geçmeden açılmamalıdır.
5. Meta olay adları ve API sürümü güncel resmî belgeyle doğrulanmalıdır. İnceleme sırasında Meta dokümantasyonu HTTP 429 verdi. Kod bu yüzden bir Graph sürümü uydurmaz; `META_GRAPH_VERSION` açıkça gereklidir.

## 2. Sunucu sırları ve frontend yapılandırması

Edge Function ortamına Supabase Dashboard > Edge Functions > Secrets üzerinden girilecek değerler:

| Değişken | Amaç |
|---|---|
| `SUPABASE_URL` | Projenin sunucu adresi; Supabase ortamı sağlar |
| `SUPABASE_SERVICE_ROLE_KEY` | Sunucu ayrıcalıklı veritabanı anahtarı; tarayıcıya verilmez |
| `META_APP_SECRET` | POST imzasını doğrulayan uygulama sırrı |
| `META_VERIFY_TOKEN` | GET challenge sırasında karşılaştırılan, yönetici tarafından belirlenen ayrı doğrulama değeri |
| `META_PAGE_ACCESS_TOKEN` | İlgili sayfanın Lead Ads okuma yetkili anahtarı |
| `META_PAGE_ID` | Bildirim kabul edilecek gerçek sayfa kimliği |
| `META_GRAPH_VERSION` | Meta hesabında desteklendiği doğrulanmış `vNN.0` sürümü |
| `META_DATASET_ID` | Gerçek CRM veri seti kimliği |
| `META_CAPI_ACCESS_TOKEN` | Yalnızca ilgili veri setine olay gönderme yetkili sunucu anahtarı |
| `META_TEST_EVENT_CODE` | Events Manager Test Events kodu; yalnızca test gönderiminde kullanılır |
| `META_WORKER_SECRET` | Demo sürümünde kullanılmaz; worker çağrısı gönderim yapamaz |
| `META_ALLOWED_ORIGINS` | Virgülle ayrılmış gerçek CRM origin adresleri; wildcard kullanılmaz |

Bu değerlerin hiçbirine `VITE_` öneki vermeyin. Frontend yalnızca `VITE_SUPABASE_URL` ve herkese açık `VITE_SUPABASE_ANON_KEY`/publishable key alır. Örnek dosyada gerçek anahtar bulunmaz. Electron için `null` origin gerekiyorsa bunu ayrıca risk değerlendirmesiyle izin listesine alın; CORS kimlik doğrulamanın yerine geçmez.

Kaynakta daha önce Meta CAPI ve kodlanmış GitHub erişim bilgileri bulundu. Yönetici bunları sağlayıcı panellerinden tespit edip kullanım kayıtlarını incelemeli ve kontrollü olarak yenilemelidir. Değerler bu raporda verilmez. Koddan kaldırmak Git geçmişinden silmez. Geçmiş temizliği ve anahtar iptali otomatik yapılmadı. Eski istemci paketleri, OTA dosyaları ve tarayıcı/disk aynalarındaki kopyalar ayrıca ele alınmalıdır.

## 3. Veritabanı ve Auth geçişi

Staging'de şu sırayı izleyin:

1. `supabase/migrations/202610310001_meta_pipeline.sql`: yeni Meta tablolarını ve yalnızca `service_role` tarafından çağrılabilen RPC'leri kurar. Entegrasyon ve otomatik gönderim kapalı başlar. Mevcut CRM erişim politikalarını bu migration değiştirmez.
2. Supabase Auth üzerinden gerçek yönetici hesabını oluşturun/davet edin. E-posta kodu ekranı için e-posta şablonunda OTP kodu bulunmalıdır; SMTP/OTP ayarlarını staging'de doğrulayın. E-posta kodu isteme işlemi yalnızca kullanıcının butona basmasıyla başlar.
3. Yönetici Auth UUID'sini ve mevcut `app_users.id` personel kimliğini `meta_members` tablosunda eşleyin. Yetkileri elle atayın. Frontend rolünü veya kullanıcı tarafından değiştirilebilen metadata'yı yetki kaynağı yapmayın. İlk yöneticiye `is_admin=true`; gerekli personele `can_send=true` verin. Her personele tüm kayıt erişimi vermeyin.
4. `supabase/rollout/02_crm_rls_after_auth.sql` normal otomatik migration değildir. Mevcut politikaları yedekleyip etkilerini inceleyin. Auth/personel eşlemesi tamamlandıktan sonra ayrı onayla uygulayın. `app_users`, `leads`, `lead_activities` için RLS'yi açar, mevcut politikaları kaldırır ve açık kapsam kuralları getirir. Eski yerel parola istemcilerinin anonim bulut erişimi kesilecektir. Personel parola sütununu Auth kullanıcılarına açmaz.
5. Sadece Meta kapsamdaki yeni politikalar hazırdır. Diğer CRM tablolarındaki canlı politikalar ayrıca incelenmelidir. Şema şablonundaki herkese açık politikalar kaldırıldı; bu dosyayı eski üretim şemasına gelişigüzel tekrar uygulamayın.
6. Anonim, yetkisiz, yalnızca atanmış müşteri erişimi olan ve yönetici kullanıcılarla negatif/pozitif staging testleri yapın. Tabloların gerçek `relrowsecurity`, grants ve `pg_policies` durumunu kontrol edin. Bu denetim tamamlanmadan `security_ready=true` yapmayın.

Meta atıf kimliği yalnızca imzalı webhook veya yönetici sunucu aktarımıyla doğrulanan `meta_lead_events` tablosundan seçilir. İstemcinin leads.meta_lead_id veya inquiry alanına yazdığı bir değer CAPI otoritesi olamaz. RLS geçişi bu sütunlara ve aşama/revision alanlarına doğrudan istemci yazımını kapatır. Manual gönderim beklenen revision ve olay adıyla karşılaştırılır.

Mevcut telefon tekrarları otomatik birleştirilmez. İki veya daha çok müşteri aynı normalize telefona sahipse webhook yeni ayrı kayıt oluşturur ve `matching_state='ambiguous'` kaydeder. Bu, yanlış kişileri birleştirmekten kaçınır; yönetici incelemesi gerekir. İki ayrı gerçek başvuru aynı müşteri altında ayrı inquiry olarak korunur.

## 4. Webhook dağıtımı

Önce tüm sırların mevcut olduğunu doğrulayın. `META_VERIFY_TOKEN` ve `META_APP_SECRET` farklı görevlerdedir. HMAC değişikliğini gerekli sırlar girilmeden canlıya taşımayın.

Onaylanan dağıtımda `meta-webhook` fonksiyonunu deploy edin. `supabase/config.toml` bu fonksiyonda JWT platform kontrolünü kapatır; Meta Supabase JWT göndermez. POST handler ham request gövdesinin `X-Hub-Signature-256` imzasını HMAC-SHA256 ile doğrular. Eksik veya yanlış imza reddedilir. GET challenge ayrı doğrulanır.

Meta Developers > uygulama Webhooks > Page bölümünde callback adresini `https://YOUR_PROJECT.supabase.co/functions/v1/meta-webhook` olarak ayarlayın. Doğrulama değerini sunucu sırrıyla aynı girin; ekrana veya repoya yazmayın. Gerçek sayfayı ve `leadgen` aboneliğini doğrulayın. `leads_retrieval` ve ilgili sayfa/uygulama yetkileri, app review ve işletme atamaları Meta hesabında ayrıca kontrol edilmelidir.

Staging'de Meta Lead Ads test aracıyla bir test başvurusu oluşturun. İmzalı webhook → Graph okuma → tek müşteri/inquiry/aktivite → `meta_lead_events` zincirini doğrulayın. Aynı bildirimi seri ve gerçek çok oturumlu paralel teslim edin. Başarısız DB/Graph işleminin 2xx dönmediğini doğrulayın. İlgisiz sayfa ve eksik imza testini canlı müşterilerle yapmayın.

## 5. CAPI test ve üretim aktivasyonu

`meta-capi` fonksiyonunda JWT platform kontrolü, worker çağrısı ve kullanıcı çağrısını aynı endpoint üzerinde ayırmak için kapalıdır. Handler kullanıcıları `supabase.auth.getUser(token)` ile doğrular, `meta_members` yetkisini sunucudan okur. Demo sürümünde `action='process'` gönderim yapamaz; arka plan işleyici kapalıdır. Publishable key tek başına kullanıcı yetkisi sağlamaz.

1. Önce `meta_settings.security_ready=true` yapın; `enabled=false` ve `auto_sync=false` kalsın. Bu yönetici beyanı canlı RLS incelemesinin yerine geçmez.
2. Meta panelinde Supabase Auth oturumu açın, durum sorgusunu ve yönetici dataset okuma testini yapın. Dataset okunması CAPI teslim yetkisini veya webhook aboneliğini kanıtlamaz.
3. Gerçek Meta test başvurusunu sunucudan içeri alın. Test için uygun aşama değişikliğini yapın. Sunucuya kaydedilmiş `meta_revision` olmayan eski yerel kayıtlar otomatik yazılmaz. Sunucu aşama güncellemesi compare-and-set ile yapılır; eski revision güncel aşamayı ezemez. Aktör `meta_stage_audit` içinde sunucuda tutulur.
4. Açıkça seçilen müşteri kimliğiyle yalnızca Test Events gönderimini kullanın. Sunucuda test kodu yoksa istek reddedilir. Sistem sentetik lead kimliği/müşteri üretmez. Meta panelinde payload, olay adı, zaman, müşteri eşleşmesi ve test kodunu kontrol edin.
5. `Contact` iletişimdir, `QualifiedLead` açık nitelik kararıdır, olumsuz aşamalar `DisqualifiedLead` olarak ayrılır. `APPOINTMENT` için `Schedule` kullanılır. `NEW`, `UNDECIDED`, `OFFER`, `PRESENTATION`, `WON` otomatik optimizasyon olayı üretmez. Bu isimlerin CRM dataset sözleşmesine uygunluğunu güncel Meta belgesi ve Test Events ile doğrulayın.
6. Doğrulanmış satış tutarı ve ayrı satış işlemi modeli olmadığı için `Purchase` güvenli biçimde engellendi. `1 TRY` gönderilmez. Bu sürüm doğrulanmış gerçek satış gelirinin Meta'ya aktarılmasını henüz uygulamaz. Bunu desteklemek ayrı veri modeli/iş kuralı gerektirir.
7. Gerçek dataset'e elle gönderim ancak test kabulünden sonra ayrı onayla `enabled=true`, `enabled_at=now()` yapılarak açılır. Bu bayrak otomatik gönderimi açmaz. `auto_sync=false` veritabanı constraint'iyle sabittir; arayüzde açma seçeneği yoktur ve API açma isteğini reddeder. Aşama değişikliği yalnızca CRM'e kaydedilir. Meta sonucu yalnızca açıkça seçilen müşteri için Gönder butonuyla iletilir. Geçmiş toplu aktarımı kapalıdır.

Test ve canlı olaylar ayrı tekilleştirme anahtarına sahiptir. Test olayının API kabulü, canlı olay gönderildi anlamına gelmez. API `events_received=1` bildirmedikçe kabul edilmiş gösterilmez. Kabul, müşteri eşleşmesi/atıf/optimizasyon kanıtı değildir.

## 6. Kuyruk, gözlem ve kurtarma

**Demo için cron/worker kurmayın.** `action=process` endpoint tarafından reddedilir. SQL claim fonksiyonu da belirli olay kimliği verilmeden kayıt alamaz. Meta'dan yeni formların webhook ile CRM'e gelişi devam eder; CRM sonucunun Meta'ya geri gönderilmesi manuel işlemdir. Başarısız gönderim arka planda kendiliğinden tekrar edilmez. Kullanıcı aynı müşteride yeniden Gönder dediğinde aynı event ID ile, deneme sınırı ve bekleme süresi korunarak tekrar denenir. Kalıcı ret için yönetici gerekir.

Durumlar: `pending`, `processing`, `sent`, `retry`, `rejected`. Olay ve sadeleştirilmiş müşteri snapshot'ı gönderimden önce kaydedilir. İlk olay kimliği, zamanı ve payload'ı retry boyunca korunur. Beş denemeyi aşmaz. Ağ/429/geçici sunucu hataları 30/60/120/240 saniye geri çekilir. Kalıcı validation/token hataları reddedilir. Süresi dolmuş son lease kalıcı reddedilir. Ağ cevabı kaybolursa Meta'nın aynı `event_id` için tekilleştirmesine dayanılır; uçtan uca mutlak exactly-once teslim garantisi verilmez.

Teslim hız sınırı `meta_claim` içinde tüm worker'lar için dakikada en fazla 30 denemedir. Olay oluşturma ve CRM aşama kararı hız sınırı nedeniyle geri alınmaz; olay pending kalır. Üretim gönderimi açık olsa da arka plan worker gönderim yapamaz. Test Events gönderimi de açık kullanıcı tıklaması ister.

`meta_outbox`, `meta_attempts`, `meta_stage_audit`, `meta_lead_events` üzerinde hata sayısı, en eski pending yaşı ve API kabul/ret oranlarını izleyin. Ham Meta hata metinleri sır/kişisel veri taşıyabileceğinden yalnızca kod, subcode, trace ve sonuç alanları saklanır. Başarısız olayın sebebi düzeltildikten sonra kontrollü yönetici tekrar işlemi için aynı olay kimliği korunmalıdır; kalıcı reddedilmiş olayları otomatik sonsuz döngüye sokmayın. Aynı kayıt üzerinde Gönder / yeniden deneme işlemi olay kimliğini veya geçmiş deneme sayısını sıfırlamaz. Beşinci deneme sonrası kayıt manuel yönetici incelemesi ister.

Form ham yanıtları ve kuyruk snapshot'ları kişisel veri içerir. Erişim, saklama süresi, veri işleme hukuki temeli ve silme taleplerini yönetici belirlemelidir. Otomatik kişisel veri silme veya eski kayıt değiştirme yapılmadı.

## 7. Geri dönüş

Önce `enabled=false`, `auto_sync=false` yapın, worker zamanlamasını durdurun. Bu, açık HTTP isteğini geri çağıramaz; devam eden işlemlerin bitmesini izleyin. Meta kayıt tablolarını ve olay kimliklerini koruyun. Sorunlu frontend sürümünü geri alın; eski anahtarlı, imzasız ve `1 TRY` gönderen sürüme geri dönmeyin. RLS politikalarını anonim genel erişime açarak sorunu çözmeyin. Gerekirse yazımları durdurup planlanmış erişim yedeğinden yönetici gözetiminde dönün.

Migration geri alma sırasında yeni tabloları drop etmeyin; geçmiş ve retry kimlikleri kaybolur. Trigger/RPC devre dışı bırakılması staging'de denenmeli ve onaylanmalıdır. Yalnızca kod değişikliğini geri almak canlı veritabanı şemasını otomatik geri almaz.

## 8. Tekrarlanabilir kontroller

Node 24 ortamında: `npm ci --ignore-scripts`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run security:check`.

SQL kontrolleri: `verification/sql` dizininde `npm install --ignore-scripts --no-audit --no-fund`, ardından `npm test`. PGlite yalnızca izole doğrulama aracıdır, üretim bağımlılığı değildir. Testler tek oturumlu PostgreSQL motorundadır; gerçek iki bağlantılı lock/lease yarış testi yerine geçmez.

Edge kontrolü için ayrıca Deno ile iki Edge Function'a `deno check` uygulayın. Deno 2.9.6 ile her iki Edge Function için tip kontrolü geçti. Handler yetkilendirme ve teslim akışları da izole testlerle sınandı; bu sonuç gerçek Meta teslim/atıf doğrulaması değildir. Gerçek Meta/Supabase staging uçtan uca testleri ve tarayıcı/Electron regresyonu ayrıca gereklidir.

## Resmî kaynaklar

- Supabase Auth doğrulaması: https://supabase.com/docs/reference/javascript/auth-getuser
- Edge Function güvenliği: https://supabase.com/docs/guides/functions/auth
- RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Meta imzalı webhook: https://developers.facebook.com/docs/graph-api/webhooks/getting-started/
- Meta CRM CAPI: https://developers.facebook.com/docs/marketing-api/conversions-api/conversion-leads-integration/
- Meta olay parametreleri: https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/server-event/

Supabase Auth belgelerine erişildi. Meta sayfaları inceleme sırasında 429 verdi; bunlar doğrulama için başvurulması gereken kaynaklardır, bu çalışmada doğrulanmış güncel Meta sözleşmesi iddiası değildir.
