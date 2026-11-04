# Meta korumalı sürüm — meta-manual-v1

Kullanıcı kararı: Meta geliştirmesi önceliklidir. Bu sürümden sonra ajanlar açık ve Meta'ya özgü kullanıcı onayı olmadan ilgili davranışı değiştirmemelidir. Genel backend geçişi Meta'yı yeniden yazma izni değildir. Kapsam `AGENTS.md` ve `meta-protection.json` içinde tanımlıdır.

## Korunan davranış

- Meta'dan veri alma kullanıcı tarafından elle başlatılır; özgün lead/form/sayfa kimliği ve inquiry geçmişi korunur.
- Aşama değişikliği sunucuya actor/revision ile kaydedilir; tek başına Meta'ya olay göndermez.
- Geri bildirim yalnızca açık kullanıcı seçimiyle gönderilir. Otomatik gönderim, worker ve geçmiş backfill kapalıdır.
- Eksik/hatalı `META_TEST_ONLY` değeri üretimi açmaz. Yalnızca açıkça `false` değeri ve DB'de ayrıca etkinleştirme üretim gönderimine aday olabilir; bunlar yönetici onayı gerektirir.
- Sahte satış geliri, sahte Meta kimliği ve istemcide ayrıcalıklı token yoktur. Purchase doğrulanmış satış modeli olmadan kapalıdır.
- İmza, Auth, yetki, kaynak seçimi, idempotency ve sınırlı manuel retry korunur.
- Olay zamanı ve teslim zamanı ayrı gösterilir; API kabulü, kişi eşleşmesi/atıf/optimizasyon başarısı sayılmaz.

## Teknik koruma

`npm run meta:verify` kayıtlı dosyaların SHA-256 parmak izini denetler. Windows CRLF/Git LF farkı normalize edilir. Build bu kontrolü çalıştırır; fark varsa durur. Manifesti güncellemek bir onay mekanizması değildir ve onaysız yapılamaz.

GitHub workflow aynı kontrolü, testleri, tip kontrolünü ve sır taramasını çalıştırır. PR'da eski taban manifesti varsa onu da denetler; yalnızca yeni manifest yazarak değişiklik gizlenemez. Onaylı yeni Meta sürümü için yönetici incelemesi ve kontrollü yeni baseline gerekir; başarısız kontrolü sessizce kaldırmayın.

CODEOWNERS dosyası `@berkantcaliskan` sorumluluğunu belirtir. **Zorunlu onay/merge engeli kendiliğinden etkin değildir.** GitHub yönetici ayarlarında, plan destekliyorsa hedef dala required PR review, code owner review ve `Meta koruması / meta-protection` status check eklenmelidir. Doğrudan push ve bypass hakları ayrıca sınırlandırılmalıdır. Bu ayarlar otomatik değiştirilmedi. GitHub resmi CODEOWNERS belgesi: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners

Talimat, snapshot ve CI kasıtlı yönetici müdahalesine karşı bir güvenlik sınırı değildir; yanlışlıkla/izinsiz ajan değişikliğini tespit etmek ve geri almak için katmanlardır. Meta API sürümü, izinler, token süresi ve dış servis davranışı ileride onaylı bakım gerektirebilir. “Bir daha bozulmaz” garantisi verilmez.

## Son doğrulama ve geçiş sınırı

4 Kasım kabul kanıtları `META_KABUL_KONTROLU_20261104.md` içindedir. Sonraki sağlamlaştırma: hatalı test kilidinde güvenli kapanma; yönetici bağlantı testinde sayfa tokenının hedef sayfayla eşleşmesi, form ve lead okuma, dataset erişimi doğrulaması; olay/teslim zamanının ayrılması.

Yönetici bağlantı testi yalnızca okuma yapar, dönüşüm göndermez. Form yoksa lead yetkisinin doğrulandığı iddia edilmez; token/izin hataları güvenli sayısal kodla gösterilir. Kalıcı erişim tokenı yönetimi ve kontrollü gerçek iletişim bilgili form testi yöneticiyle tamamlanmalıdır. Tokenı frontend'e veya sohbete taşımayın.

Mevcut çalışma ortamı staging ve Test Events olarak kalır. Üretim olay gönderimi bu koruma kurulurken açılmaz. Üretime geçiş, gerçek veri aktarımı ve genel backend/Auth tamamlanması ayrı kabul adımlarıdır. Bu koruma tamamlanan test sürümünü sabitler; eksik operasyonel kabulü tamamlandı olarak işaretlemez.

## Backend geliştirmesinde korunacak arayüz

`metaStore` girişleri, `MetaStageQueue`, `meta_*` RPC'leri, source_context ve `meta_revision` sözleşmesi kullanılır. Müşteri kaydıyla Meta bildirimini aynı işlem saymayın. Backend değişikliği sırasında immutable olay snapshot'ı, kaynak leadgen_id, event_id ve retry payload'ı değiştirilmemelidir.

Önce `npm run meta:verify`, ardından `npm test` ve `npm run typecheck` çalıştırın. Gerekli korumalı değişiklik varsa kullanıcıya dosya, gerekçe, beklenen etki ve test kapsamını sunun; onay gelmeden uygulamayın.
