# Sistem kullanıcısı erişimi — 4 Kasım 2026

Mevcut Meta tamamlama talebi kapsamında kısa ömürlü Page tokenı bağımlılığını azaltan sunucu desteği eklendi. Önceki v1.2 korumalı snapshot saklandı.

- `META_SYSTEM_USER_TOKEN` varsa önce hedef `META_PAGE_ID` için `fields=id,access_token` sunucuda sorgulanır. Elde edilen Page tokenı form/lead okuma ve webhook ayrıntı sorgularında kullanılır. Token istemciye dönmez ve kalıcı saklanmaz. Sistem tokenı reddedilirse eski tokena sessiz dönüş yapılmaz.
- Bu sır yoksa mevcut `META_PAGE_ACCESS_TOKEN` yolu korunur. `META_CAPI_ACCESS_TOKEN` ayrı kalır; geri bildirim tokenı değiştirilmez.
- Sistem kullanıcısına uygulama, doğru sayfa ve gerekli lead izinleri Meta yönetiminden atanmalıdır. Sunucuya sır eklemek tek başına bu izinleri sağlamaz.
- Yönetici bağlantı testi sayfa/form/lead okumasını denetler. Token tanılama erişilebilirse bitiş bilgisini gösterir. `expires_at=0`, planlı bitiş bulunmadığını belirtir; iptal edilemezlik garantisi değildir. Tanılama okunamazsa süre doğrulanmış sayılmaz.
- Dataset metadata GET reddi events POST sonucundan ayrıdır. Bağlantı testi dönüşüm göndermez. Son test olaylarının API kabulü geçmişte ayrıca doğrulanmıştır; yeni erişim canlı testi ayrıca gereklidir.
- Staging dışında dağıtım yapılmaz. Otomatik gönderim, arka plan işleyicisi ve üretim olayları kapalı kalır. Test/gerçek kayıt silinmez.

Geri dönüş: önceki korumalı snapshot'taki iki Edge Function'ı yönetici onayıyla yeniden dağıtın. Önceki sayfa tokenı süresi dolmuş olabilir; sadece eski koda dönmek erişimi düzeltmez. Sırları otomatik silmeyin veya iptal etmeyin. Canlı veri/tablo değişikliği bu sürümde yoktur.

## 5 Kasım düzeltmesi

İlk sistem kullanıcısı uygulamasında form endpointine doğrudan sistem tokenı verilmişti. Canlı bağlantı testi sayfa sorgusundan sonra form okumasında Meta 190 döndürdü. Ham hata metni saklanmadığından bunun alt nedeni kesin doğrulanmış değildir. Page tokenı elde etme adımı eklendi; izole testlerde form/lead isteklerinin türetilen Page tokenını kullandığı doğrulandı. Canlı erişim yeniden test edilmeden tamamlandı sayılmaz. 139 birim test geçti. Meta resmi dokümanına erişim bu kontrolde 429 nedeniyle sağlanamadı.
