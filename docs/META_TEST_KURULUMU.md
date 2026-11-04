# Meta test kurulumu — kullanıcı ve geliştirici görevleri

Bu paket yerel olarak hazırlanmıştır; hiçbir sunucuya kurulmadı. Üretim projesinde, mevcut müşteri verisinde veya mevcut webhook aboneliğinde değişiklik yapmayın. Ayrı test sayfası/formu/uygulaması kullanın; mevcut uygulamanın callback adresini değiştirmeniz gerçek lead akışını yönlendirebilir.

## Hazırlananlar

İmzalı webhook ve kalıcı CRM kaydı, manuel CAPI/Test Events yolu, kaynak seçimi, hata ve tekrar deneme kayıtları hazır. `META_TEST_ONLY=true` sunucu kilidi, veritabanında yanlışlıkla canlı gönderim açılsa bile normal enqueue işlemini reddeder; yalnızca test kodlu olay gönderilebilir. Genel CRM bulut senkronizasyonu kapalı kalır. Bu paket tam CRM backend geçişi değildir.

## Senin yapacağın işlemler

1. Supabase hesabında **yeni ve boş** bir proje oluştur; adını `portfoy-meta-staging` gibi ayırt edilebilir koy. Ücretli plan satın alma gereğini varsayma; hesap limitlerini panelde kontrol et.
2. SQL Editor'de `01_BOS_STAGING_KUR.sql` çalıştır. Bu dosya mevcut CRM tabloları varsa durur. Tablo bulunması hatasını aşmaya çalışma; bana hata metnini anahtarsız ilet.
3. Authentication > Users bölümünde kendi e-posta adresinle test kullanıcısı oluştur/davet et. Email şablonunda kodla giriş için `{{ .Token }}` bulunsun. SMTP ve gönderim limitlerini panelde kontrol et. User UID değerini `02_YONETICI_VE_RLS.sql` içindeki sıfırlı UUID yerine yaz ve dosyayı staging SQL Editor'de çalıştır. Son satırda enabled=false, auto_sync=false, security_ready=true beklenir. Hata varsa devam etme.
4. Meta tarafında ayrı test sayfası ve Instant Form oluştur veya mevcut güvenli test varlıklarını seç. Uygulama/sayfa ve lead erişim yetkilerini kendi hesabından ver. Gerçek reklam yayını veya bütçe gerekmez; test varlıklarının hesapta kullanılabilirliği ayrıca doğrulanmalıdır.
5. `03_SUNUCU_SECRETS.env.example` listesindeki değerleri **Supabase Edge Functions > Secrets** bölümüne gir. App Secret, webhook doğrulama değeri, Page Access Token, CAPI token ayrı değerlerdir. Test Events kodunu Events Manager'dan al. Graph sürümünü Meta hesabında desteklenen sürüme göre seç; bir örnek sürümü körlemesine kullanma. `META_TEST_ONLY=true` kalmalı. Supabase'in dahili URL/service-role değişkenlerini elle kopyalama; tarayıcıya koyma.
6. Kod paketinin kökünde güncel Supabase CLI ile oturum aç ve **yalnızca staging proje referansını** kullan:

```powershell
supabase login
supabase functions deploy meta-webhook --project-ref YOUR_STAGING_PROJECT_REF
supabase functions deploy meta-capi --project-ref YOUR_STAGING_PROJECT_REF
```

Repo config dosyasında iki fonksiyonun platform JWT kontrolü kapalıdır: webhook HMAC doğrular; CAPI kendi handler'ında Supabase Auth JWT ve üyelik doğrular. Yetkilendirmeyi devre dışı bırakan kod değişikliği yapma. CLI yoksa resmi Supabase CLI kurulum yolunu kullan. Bu komutlar dağıtım yapar; ben çalıştırmadım. `supabase db push` çalıştırma; SQL paketi zaten açık sırayla hazırlanmıştır.

7. Meta test uygulamasında webhook callback: `https://YOUR_STAGING_PROJECT_REF.supabase.co/functions/v1/meta-webhook`. Verify Token, Secrets'a yazdığın değerle aynı olsun. Page/leadgen aboneliğini ve ilgili test sayfasının uygulamaya bağlandığını doğrula. Lead okuma izinleri, işletme atamaları ve gerekiyorsa uygulama incelemesi hesabında tamamlanmalı.
8. Kod paketinin kökünde `.env.local` dosyasına yalnızca `04_TARAYICI.env.example` içeriğini gerçek **staging** URL ve public key ile yaz. Yeni/ayrı tarayıcı profili kullan; mevcut uygulama verilerini temizleme. `npm ci`, ardından `npm run dev` çalıştır. `http://127.0.0.1:9002` adresini kullan; güncel başlatıcı portu ve ayrı disk profilini tanımlar. Başka origin kullanırsan sunucudaki izin listesiyle eşleştir. Frontend'e service-role, Page/CAPI token veya App Secret yazma.
9. Uygulamanın normal yerel girişini tamamla; Meta panelindeki Supabase e-posta kodu girişi **ayrı** adımdır. İlk yerel kullanıcı/yönetici oluşturma ekranı erişilemiyorsa dur; yerel depolamayı elle düzenleyerek yetki aşma. Meta panelinden kod iste, kodu doğrula ve durumu yenile. Yerel hesap ile sunucu üyeliğinin aynı şey olmadığını unutma.

## Birlikte yapacağımız gerçek test

- Meta [Lead Ads test aracı](https://developers.facebook.com/tools/lead-ads-testing/) ile yalnızca test sayfası/formunda başvuru üret. Webhook sunucu kayıtlarında 2xx ve staging SQL Editor'de aşağıdaki sorguyla kalıcı kaydı kontrol et:

```sql
SELECT leadgen_id,lead_id,submitted_at FROM public.meta_lead_events ORDER BY submitted_at DESC LIMIT 10;
SELECT id,stage,meta_revision FROM public.leads ORDER BY created_at DESC LIMIT 10;
SELECT id,event_name,state,test_mode,events_received,fbtrace_id,error_code FROM public.meta_outbox ORDER BY occurred_at DESC LIMIT 10;
```

- Webhook kaydı DB'de varsa ancak CRM ekranında yoksa bunu başarı sayma. Genel legacy sync kapalı olduğundan Meta panelindeki tarihli manuel lead alma yoluyla sunucu kaydını arayüze getir. Aktarımın gerçek zamanlı ekranda belirmesi bu modda garanti edilmez; DB kaydı ile UI görünümünü ayrı kontrol et. Tarih aralığını test başvurusunu kapsayacak şekilde seç.
- Ad/telefon/e-posta, form yanıtları, kaynak ID ve zamanı karşılaştır. Test aracının sağladığı alanlarla yetin; test kaydında reklam/kampanya bilgisi yoksa bunu uydurma.
- CRM aşamasını nitelikli yap; sunucu revision kaydını doğrula. Hiçbir CAPI olayı kendiliğinden oluşmamalı.
- Meta panelinden uygun müşteri ve başvuruyu seçip **Test Events** gönder. Normal Gönder staging kilidinde hata vermeli. Events Manager'da aynı event ID ve türü görünmeli. Payload lead_id'sinin doğru başvuruya ait olduğu doğrulanmalı.
- Aynı başvuru/aşama yeniden gönderildiğinde ikinci olay oluşmamasını, ikinci form başvurusunun ayrı inquiry olmasını kontrol et. İki ayrı PostgreSQL bağlantısıyla eşzamanlı test ve tarayıcı/Electron regresyonu ayrıca yapılmalı.

## Bana ileteceğin bilgiler

Proje referansı/URL (gizli anahtar değil), test sayfası/form ID'leri, Auth test kullanıcısının oluşturulup oluşturulmadığı ve yukarıdaki hangi adımın tamamlandığı yeterli. Hata ekranında token, e-posta, telefon, OTP, JWT, App Secret veya service-role key varsa paylaşmadan önce kapat. Anahtarları sohbete gönderme.

## Durdurma ve geri dönüş

Bir adım hata verirse sonraki adıma geçme. Üretim webhook adresini değiştirme, entegrasyonu enabled=true yapma, genel sync veya otomatik gönderimi açma. Testi durdurmak için yalnızca test uygulamasının aboneliğini durdur; Supabase test ayarlarında enabled=false ve auto_sync=false kalsın. Mevcut müşteri tablolarını silme. Sırlar değiştirilirse erişim kayıtlarını ve test kilidini yeniden kontrol et.

Supabase komut ve Secrets akışı [resmi deploy belgesi](https://supabase.com/docs/guides/functions/deploy) ve [Secrets belgesi](https://supabase.com/docs/guides/functions/secrets) ile karşılaştırıldı. Meta arayüz/hesap izinleri canlı hesapta ayrıca doğrulanmalıdır. Test Events kabulü kişi eşleşmesi, atıf veya reklam optimizasyonu garantisi değildir.
