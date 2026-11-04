# Meta sabitleme ve backend başlangıcı — 4 Kasım 2026

Kullanıcının Meta'yı önce tamamlayıp koruma ve ardından backend geçişini başlatma talebi kapsamında koruma ve backend temeli hazırlandı. Son teknik snapshot `meta-manual-v1.1`; ilk snapshot ayrıca saklandı. **Üretim kabulü verilmiş değildir: güncel bağlantı kontrolü Meta 190 döndürdü, sayfa tokenının yenilenip doğrulanması gerekiyor.**

## Uygulanan korumalar

- `AGENTS.md`: Meta alanının değişmesi için bu oturumda Meta'ya özgü açık kullanıcı onayı şarttır. Genel backend/refactor/lint isteği onay yerine geçmez.
- `meta-protection.json`: 35 dosyanın SHA-256 parmak izi. `npm run meta:verify` değişiklik ve korumalı klasöre yeni dosya eklenmesini yakalar. Build bu kontrolü çalıştırır.
- `.github/CODEOWNERS`: Meta alanının sahibi belirtilir.
- `.github/workflows/meta-protection.yml`: koruma kontrolü, PR taban snapshot kontrolü, testler, tip kontrolü ve sır taraması. GitHub'da çalışması ayrıca kontrol edilmelidir.
- Zorunlu code owner review, required status check ve doğrudan push engeli GitHub yönetici ayarlarıdır; otomatik etkinleştirilmedi. Plan desteği ayrıca kontrol edilmelidir. Bu ayarlar olmadan “GitHub birleştirmeyi kesin engelliyor” iddiası yoktur.
- Kaynak ve koruma manifesti içeren geri dönüş arşivi hazırlanır; gerçek env, token, müşteri kayıtları ve bağımlılık klasörleri dahil edilmez.

## Son Meta sağlamlaştırmaları

- Test kilidinin yalnızca açık `false` değeri üretime aday olabilir. Boş, eksik, `TRUE`, `0` veya kenar boşluklu değerler test modunda kalır; üretimi açmaz.
- Yönetici bağlantı testi artık yalnızca dataset okumaz: Page tokenının beklenen sayfaya ait olması, form okuma ve mümkünse lead okuma yetkisi ile CAPI dataset erişimini kontrol eder. Hiçbir olay göndermez; anahtar/iletişim bilgisi döndürmez. Form yoksa lead yetkisi doğrulandı demez. Yeni endpoint ayrı staging'e kuruldu.
- Süresi biten token ve izin sorunları güvenli Meta hata koduyla açıklanır.
- Geçmişte olay/aşama zamanı, gerçek gönderim zamanı ve olay kimliği ayrı gösterilir.

## Doğrulama

- Meta ve koruma için **181 izole kontrol**: 119 Node +43 SQL +13 bütünleşik zincir +6 kurulum/yetki kontrolü geçti.
- Staging'de 23 salt okunur bütünlük/yetki kontrolü ve 11 negatif HTTP/CORS kontrolü geçti.
- Önceki gerçek PostgreSQL çift bağlantı tekrar işleme kontrolü ve 2 gerçek Test Events API kabulü kanıtı korunuyor; yeni dönüşüm gönderilmedi.
- TypeScript, build, Deno kontrolü, koruma doğrulaması ve kaynak sır taraması geçti. Lint 0 hata/327 uyarı; build büyük chunk uyarısı sürüyor.
- Koruma testleri: değişiklik, silme, yeni korumalı dosya, hatalı/boş/yinelenen manifest reddedilir; CRLF/LF farkı aynı sürüm kabul edilir.
- Yeni bağlantı testi gerçek kullanıcı oturumunda çalıştırıldı: sayfa tokenı için Meta 190 sonucu alındı. Bu, önceki başarılı testin güncel credential uygunluğunu garanti etmediğini gösterir. Token yenileme ve tekrar bağlantı kontrolü tamamlanmadan operasyonel uygunluk verilmez.

## Backend geçişi başladı

Meta dosyaları değiştirilmeden ayrı `crm_identities` eşlemesi, parola döndürmeyen `crm_get_my_profile()` ve sunucu Auth adaptörü hazırlandı. 7 istemci/Auth ve 7 SQL kontrolü geçti; toplam 14 ek kontrol. Böylece son çalıştırmada **126 Node testi**, ayrı SQL paketleriyle toplam **195 izole kontrol** geçti.

Bu temel migration henüz uzak veritabanına uygulanmadı ve mevcut giriş ekranı değiştirilmedi. Ortak bulut sync kapalı. Yerel parolaların merkezi Auth'a geçişi, modül bazlı yetkiler, çakışmasız veri yazımı ve 9001 kayıtlarının kontrollü aktarımı devam edecek işlerdir. Plan: `BACKEND_GECIS_PLANI.md`.

## Yönetici kabulü gerektirenler

1. Meta 190 hatalı sayfa tokenını yönetici tarafından yenileyip Yönetici bağlantı testinde yeniden doğrulamak. Süre/iptal nedeni Meta Access Token Debugger'da kontrol edilmeli; kısa süreli test tokenı kalıcı çözüm sayılmaz.
2. Daha önce açığa çıkan tokenların kontrollü yenilenmesi ve kalıcı erişim süresi/izin yönetimi.
3. Gerçek iletişim bilgili kontrollü form başvurusu ve Meta tarafında eşleşme/atıf doğrulaması. Test aracının dummy alanları bunun kanıtı değildir.
4. GitHub onay/branch koruma kurallarının desteklendiği planda etkinleştirilmesi.
5. Üretime geçiş ve gerçek veri aktarımı için kapsam, yedek, geri dönüş ve son onay.
6. Meta uygulamasının yayımlanma durumu, ilgili izin seviyeleri ve gerçek lead erişimi hesabın kendi varlıklarında doğrulanmalı. Test API kabulü, üretim izinlerinin tamamlandığı anlamına gelmez. Uygulama otomatik yayımlanmadı.

Bu işler tamamlanmadan test projesi adı veya tek bir env bayrağı değiştirilerek üretime geçilmez. Meta API/izin/token değişiklikleri gelecekte açık onayla bakım gerektirebilir; sınırsız bozulmazlık garantisi verilmez. Test kayıtları veya gerçek kayıtlar silinmedi.
