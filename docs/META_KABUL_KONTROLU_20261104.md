# Meta test kabul kontrolü — 4 Kasım 2026

## Sonuç

9002 sürümünün **manuel Meta lead alma → CRM kaydı → kullanıcı tarafından aşama değiştirme → elle Test Events gönderimi** akışı doğrulandı. Genel uygulamanın üretim kabulü verilmedi. Otomatik Meta geri bildirimi ve üretim gönderimi kapalıdır. Kullanıcı kararıyla geliştirme bu sürüm üzerinden devam eder.

## Gerçek ortam kanıtı

Kontroller yalnızca `portfoy-meta-staging` Supabase projesinde yapıldı. Üretim projesine geçiş, main merge ve üretim gönderimi yapılmadı. Önceki kullanıcı onaylarıyla iki Edge Function staging'e kuruldu; mevcut uygulamanın webhook adresinin test ortamına yönlendirilmesi kullanıcı tarafından yapıldı.

| Kontrol | Sonuç |
|---|---|
| Meta kaynak kaydı ve müşteri | 1 kaynak, 1 müşteri, 1 başvuru aktivitesi; özgün form yanıtları korunmuş |
| Aşama geçmişi | 2 değişiklik; kullanıcı kimliği ve revision kayıtlı |
| QualifiedLead | Test modu; Meta API `events_received=1`; kalıcı teslim kaydı başarılı |
| Contact | Test modu; Meta API `events_received=1`; kalıcı teslim kaydı başarılı |
| Teslim denemeleri | 2 olay, 2 deneme; hata veya üretim olayı yok |
| Tekrar/kimlik | Olay kimliği payload ile, lead_id ve page_id doğrulanmış kaynak ile eşleşiyor |
| Gelir/browser verisi | Sahte Purchase, parasal değer, IP, user agent veya fbc/fbp yok |
| Sunucu erişimi | service_role müşteri okuyabiliyor; anon okuyamıyor |
| İstemci koruması | Aşama ve Meta kimliği doğrudan güncellenemiyor; anonim/istemci ingestion RPC erişimi kapalı |
| Güvenlik | CRM tablolarında RLS açık; otomatik ve üretim gönderimi kapalı; Secrets test kilidi `true` ile eşleşiyor |

Test başvurusu Meta aracının dummy verilerini içerir; gerçek ad/telefon eşleşmesini kanıtlamaz. Geçersiz örnek telefon ham yanıtta korunmuştur. İletişim eşleştirme hash'leri izole testlerde doğrulandı; gerçek kişiyle eşleşme/atıf/optimizasyon sonucu bu testten çıkarılamaz.

## Meta panelindeki zaman karışıklığı

QualifiedLead'in **iş kararı zamanı 3 Kasım 18:20:03**, gönderim zamanı **4 Kasım 11:44:15** (Türkiye saati). Paneldeki “Dün 18:20:03” bu olay zamanıyla eşleşir; tek başına eski/ilgisiz olay olduğunu göstermez. Panelde test lead, kaynak ve QualifiedLead/İşlendi bilgileri eşleşmektedir. Panel olay UUID'sini göstermediğinden bağımsız UUID karşılaştırması yapılamadı. Contact'ın API kabulü doğrulandı; panelde ayrıca görünmesi doğrulanmadı.

## Çalıştırılan kontroller

- 102 Node uygulama/handler testi: geçti.
- 43 SQL/PGlite kontrolü: geçti.
- 13 bütünleşik izole webhook→DB→CAPI kontrolü: geçti.
- 6 boş staging kurulum/yetki kontrolü: geçti. **Toplam 164 izole kontrol.**
- Staging'de salt okunur **23 veri bütünlüğü ve yetki kontrolü**: tamamı geçti; `verification/sql/staging-readonly.sql`.
- Staging'de **11 negatif HTTP/CORS kontrolü**: geçti; yetkisiz CAPI, imzasız/yanlış imzalı webhook, yanlış challenge ve anonim DB/RPC erişimi reddedildi. `scripts/verify-meta-staging.mjs` dönüşüm göndermez.
- Gerçek PostgreSQL'de iki bağımsız bağlantı üzerinden aynı mevcut test başvurusu eşzamanlı tekrar işlendi. İkisi de aynı müşteriye döndü; bütün yazımlar ROLLBACK ile geri alındı. Son sayımlar değişmedi: 1 müşteri, 1 kaynak, 1 aktivite, 2 dönüşüm olayı, 2 deneme. Bu, yeni iki farklı başvurunun aynı telefonla yarışması veya eşzamanlı outbox tüketiminin bütün varyasyonlarını kapsamaz.
- TypeScript ve production build: geçti. Deno iki Edge Function tip kontrolü: geçti. Kaynak sır taraması: geçti.
- Lint: 0 hata, **327 uyarı**. Build büyük chunk uyarısı devam ediyor.
- 9002 başlatıcısı port doluyken başka porta kaymak yerine duruyor; mevcut sunucu kapatılmadı.

## Düzeltilen gerçek sorunlar

1. Kullanılan 9001 kopyası eski frontend Graph/konfigürasyon yolundaydı; yeni sunucu akışı ayrı 9002 sürümünde çalıştırıldı ve kalıcı geliştirme başlangıcı tanımlandı.
2. Otomatik tablo erişimi kapalı Supabase projesinde kayıt RPC'si yazıyor, backend tabloyu okuyamıyordu. `202611030002_meta_backend_lead_read.sql` yalnızca `service_role` için `leads SELECT` ekler; staging'e uygulandı. Kurulum üreticisine ve regresyon kontrolüne eklendi.
3. OTP isteğinin gerçek hata kodu genel mesajla gizleniyordu. Kayıtlı Auth e-postasıyla giriş tamamlandı; hata ayrıntısı artık güvenli ve eyleme dönük gösterilir.
4. Detay ekranındaki “otomatik bildirilir” metni manuel davranışla uyumlu hâle getirildi.
5. Test kilidinin beklenen değere eşit olmadığı fark edilerek staging'de `META_TEST_ONLY=true` düzeltildi; iki gönderimin de zaten test modunda olduğu veritabanından doğrulandı.

## Kalan işler ve durum

**Tamamlandı ve doğrulandı:** manuel alım, kaynak/inquiry koruma, aşama audit'i, iki test olayının API kabulü, yukarıdaki erişim/bütünlük kontrolleri ve 9002 geliştirme başlangıcı.

**Canlı kabul bekliyor:** ayrı gerçek iletişim verisi içeren kontrollü başvuru, bağımsız Meta kişi eşleşmesi/atıf, gerçek formdan imzalı webhook teslimi, Contact panel görünümü ve tarayıcı/Electron genel regresyonu. Manuel alım kullanılırken webhook otomasyonu kabul edilmiş sayılmaz.

**Yönetici işlemi:** sohbette/önceki kodda açığa çıkan tokenların kontrollü yenilenmesi; kalıcı sunucu anahtarı/erişim süresi yönetimi. Otomatik iptal veya credential yenileme yapılmadı.

**Ayrı geliştirme işi:** 9001 gerçek kayıtlarını karşılaştırmalı aktarmak; tüm CRM modüllerinde merkezi Auth, eşzamanlı güvenli bulut senkronizasyonu ve yetki geçişini tamamlamak. Genel sync `false` kalmalıdır. Meta testinin geçmesi tüm CRM backend'inin tamamlandığı anlamına gelmez.

**Güvenlik için kapalı:** otomatik CAPI, geçmiş backfill, üretim gönderimi ve doğrulanmış satış modeli olmadan Purchase. Yeni Meta olayı sırf kontrol tamamlamak için gönderilmedi. Mevcut test müşteri/olayları silinmedi; temizlik ayrıca kapsam belirlenerek yapılmalı.

## Güncel dosyalar ve yeniden çalıştırma

`npm test`, `npm run build`, `npm run lint`, `npm run security:check`; SQL izole paketi için `verification/sql` içinde bağımlılık kurulumundan sonra `npm test`.

Staging HTTP kontrolleri: `node scripts/verify-meta-staging.mjs https://YOUR_STAGING_PROJECT.supabase.co`.

`staging-readonly.sql` veri yazmaz. `staging-concurrent-rollback.sql` yalnızca tek test başvurulu ayrı staging içindir; yazımları geri alır, üretimde çalıştırılmamalıdır.

Eski raporlar önceki kontrol anlarını anlatır; son durum için bu rapor esas alınmalıdır. Yeni migration, Auth hata iyileştirmesi, aktif geliştirme başlangıcı ve son kontrol betikleri güncel kaynak paketine dahildir. Geçiş/geri dönüş sınırları `META_GUVENLI_GECIS.md` içindedir.
