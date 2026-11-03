# Meta/CRM düzeltmeleri — güncel main temelli sürüm

Temel commit: 02cfd9943f8f9504aeef03c042c6a744b6cd8ac5.

## Düzeltilen sorunlar

- CAPI credential'ı ve Graph erişimi frontend'den çıkarıldı. Yetkili kullanıcı JWT'si ve sunucu üyelik/scope kontrolü gerekir.
- Webhook ham gövde HMAC-SHA256 ile doğrulanır. Eksik/geçersiz imza reddedilir; GET challenge ayrı korunur.
- Lead ID transaction ve DB anahtarıyla tekilleştirilir; tam normalize telefonla eşleştirme yapılır. İlk 10 kayıt ve son 7 hane yaklaşımı kaldırıldı.
- DB başarısızlığında webhook 2xx teslim onayı vermez. Inquiry ve aktivite yazımı aynı transaction'dadır.
- Sahte Meta ID ve sembolik satın alma geliri kaldırıldı. Doğrulanmış satış modeli olmadan Purchase kapalıdır.
- Demo otomatik gönderimi açamaz. Aşama değişikliği outbox oluşturmaz; yalnızca seçilen müşteri için kullanıcı tıklamasıyla manuel olay oluşur.
- Ağ hatası bağlantı başarısı olmaz; events_received=0 sent değildir.
- Teslim hız sınırı worker'a taşındı; müşteri aşamasını geri alamaz.
- Meta atfı server-only event tablosundan gelir; personel kaynak kimliğini/inquiry atfını değiştiremez.
- Başarısız stage Promise'ı yeni denemeleri kilitlemez; aynı müşterinin yazımları sıralı kalır.
- Arka plan worker demo sürümünde kilitlidir. Test ve canlı gönderimler yalnızca açıkça seçilen kayıt için elle yapılır; test başarısı canlı teslim durumuna dönüşmez.
- Manual gönderim için güncel revision ve olay adı sunucuda kontrol edilir. Worker sonucu UI'ye revision ile yansıtılır.
- Tek bir metadata güncellemesi CRM iş verisinin updatedAt alanını veya bütün bulut satırını yeniden yazmaz.
- Yerel çıkışta Meta yetkili oturumu da kapatılır. Gönderim yetkili personel yönetici olmadan Auth koduyla oturum açabilir; yönetici işlemleri backend'de korunur.
- Eski veri paketleyen OTA script'i, başlangıçtaki otomatik veri sıfırlamaları ve gömülü GitHub bilgisi kaldırıldı. Normal build yayın yapmaz.

## Doğrulama

Manuel demo kilidi, izinler, tekilleştirme, teslim sonuçları ve yeniden deneme testleri eklendi. Güncel sayılar teslim raporundadır. Deno 2.9.6 tip kontrolü iki Edge Function için geçti. Son typecheck, lint, build ve sır taraması sonuçları teslim doğrulama raporundadır.

Testler gerçek Meta/Supabase üretim isteği yapmaz. Gerçek iki bağlantılı PostgreSQL yarış testi, Supabase staging/Auth/Realtime, tarayıcı/Electron regresyonu ve Meta Test Events/atıf kabulü ayrıca gerekir. Meta belgeleri HTTP 429 verdi; güncel event sözleşmesi/Graph sürümü yönetici tarafından doğrulanmalıdır.

## Canlıya geçiş sınırı

Bu değişiklikler üretime dağıtılmadı; migration ve credential yenilemesi yapılmadı. Tüm CRM'in yerel parola/legacy sync altyapısı bir anda Auth'a çevrilmedi. Genel bulut sync bayrağı kapalı kalmalıdır. RLS geçişi eski anonim istemcileri etkiler; önce staging ve Auth/personel eşlemesi gerekir. Açığa çıkmış eski credential'lar sağlayıcı tarafından kontrollü yenilenmelidir; Git geçmişinden otomatik silinmedi.

Ayrıntı: [Güvenli geçiş ve geri dönüş planı](META_GUVENLI_GECIS.md).
