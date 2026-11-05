# Genel backend temelinin durumu — 5 Kasım 2026

## Uygulanan kapsam

Bu çalışma mevcut uygulamayı topluca sunucuya geçirmek değildir. Önce ayrı kimlik ve kalıcılık katmanı kurulmuştur. Ana ekranların yerel çalışma yolları henüz kesilmemiştir. Yeni merkezi modüllere aktarım veya yazım yapılmamıştır. Meta'nın 40 korumalı dosyası ve manifesti aynıdır.

### Mimari ve dosyalar

- `crm_identity_foundation` migration: mevcut doğrulanmış personel eşlemesini kullanır; profil RPC'si parola döndürmez. Sabit/boş search_path ile tanımlanır. Kullanıcı kendi rolünü veya eşlemesini değiştiremez.
- `crm_record_backend` migration: `crm_backend.records`, özel audit ve modül yazım kilitleri. Modül+kimlik başına JSON belge mevcut zengin proje/daire yapısını korur. Tüm dizi veya tüm veritabanı tek blob olarak ezilmez. Bu temel normalleştirilmiş iş alanı ilişkilerinin ve modül iş kurallarının yerine geçmez.
- `crmBackendRepository.ts`: kimlik/sürüm doğrulayan, zaman aşımı olan RPC istemcisi. Ağ hatasında başarı varsaymaz veya kör otomatik tekrar yapmaz. Aynı işlem tekrarında requestId korunmalıdır.
- `crmMigrationPreview.ts`: yedi yerel modülün sayımı, eksik/tekrarlı kimlik kontrolü ve SHA-256 parmak izi. Salt okunur; Meta, Auth ve yerel parola anahtarları kapsam dışında.
- `BackendTransitionView.tsx` ve `main.tsx`: ayrı `?workspace=backend` ekranı. Normal CRM eski başlangıç sırasıyla açılır; geçiş ekranı eski store/senkronizasyon motorunu başlatmaz. Bu geçiş alanı kendi sessionStorage oturumunu kullanır. Oturum yeni sekmede e-posta linkinden alınabilir; SDK callback fragmentini temizler. `getUser()` ve canonical profil doğrulanmadan yerel rol kabul edilmez.
- `verification/crm/records.mjs`: gerçek PostgreSQL söz dizimi/işlemleriyle izole PGlite testleri. Gerçek çok oturumlu yarış testi değildir.

### İlk yetki sınırları

Yalnızca sunucuda doğrulanmış etkin personel ve aynı şirket kapsamı kabul edilir. Yönetici genel erişir. Proje okuması şirketteki doğrulanmış personele açık; yazımı yönetici veya Satış/Yönetim yöneticisine sınırlıdır. Randevu/talep sahibi ve departman yöneticisi kapsamı uygulanır. Muhasebe kayıtları yönetici veya Muhasebe departmanına sınırlıdır. Dosya kaydı şimdilik yalnızca sahibine açıktır; paylaşım ve binary Storage politikaları tamamlanmadan aktarılmaz. Genel kayıt RPC'si onay kararını kabul etmez. Bu dar başlangıç matrisi mevcut UI'daki geniş istemci yetkileriyle eşdeğer ilan edilmez.

## Staging doğrulaması

- Kimlik ve kayıt temeli migration'ları `portfoy-meta-staging` üzerinde eklemeli uygulandı. Mevcut müşteri/Meta tabloları veya politikaları değiştirilmedi.
- Uygulama öncesi ve sonrası 50 müşteri, 50 kaynak ve 7 test CAPI olayı vardı. 23 Meta DB bütünlük kontrolü yeniden geçti. Otomatik/üretim gönderimi kapalı kaldı.
- Genel backend yapısal kontrolleri: RLS, özel şema erişimi, anonim RPC reddi, kimlik eşlemesi ve tüm modül yazım kilitleri doğrulandı. Merkezi kayıt ve audit sayısı sıfırdı.
- Geçici READ ONLY yönetici bağlamında beş profil/liste kontrolü geçti. Bu SQL kontrolü gerçek tarayıcı girişi sayılmaz.
- Üç anonim HTTP çağrısı (profil, liste, yazım) 401 ile reddedildi; kayıt yaratılmadı.
- 156 birim test, 7 kimlik SQL ve 20 kayıt SQL testi geçti. Tip kontrolü ve derleme başarılı. Lint mevcut uyarılarla; genel kod tabanındaki eski uyarılar bastırılmadı.
- Kullanıcının ekranında sunucu profili “Staging Meta Yöneticisi · ADMIN · Yönetim” olarak doğrulandı. Bu, mevcut Supabase oturumuyla tek kullanıcı kabulüdür; iki farklı kullanıcı veya e-posta teslim kabulü değildir.

## Yedek ve veriler

Mevcut eski masaüstü disk profilinin özel yerel kopyası ve 50 staging müşteri/kaynak kaydının özel JSON yedeği çalışma klasörü dışında Git kapsamına alınmadan saklandı. Rapora, Git'e veya kaynak zip'ine ham müşteri/parola verisi eklenmedi. 9002'nin disk endpointi etkin olmadığı için bu endpointten yedek alınabildiği iddia edilmiyor; tarayıcıya özgü diğer kayıtlar aktarım öncesi ayrıca yedeklenmelidir. Sunucudaki yedek rol/şema kurtarma veya tam PITR yedeği değildir.

## Auth dönüş ayarı

Mevcut şablon sayısal kod yerine giriş bağlantısı gönderiyordu. Supabase dönüş izin listesi boş, site_url `http://localhost:3000` bulundu. Sadece `http://127.0.0.1:9002/?workspace=backend` ve `http://localhost:9002/?workspace=backend` izin listesine eklendi. CLI diff/push yalnızca `auth.additional_redirect_urls` alanını değiştirdiğini ve 10 bildirilmemiş özelliği koruduğunu doğruladı. Meta sırrı, Auth rolü veya e-posta şablonu değiştirilmedi. Yeni e-posta eski linkten farklı dönüş adresi taşımalıdır.

Ardından gerçek UI hatası `over_email_send_rate_limit`, HTTP 429 olarak doğrulandı. E-posta istemleri tekrarlanmadı; kota yükseltilmedi veya Auth zayıflatılmadı. Kullanıcının açık düğme seçimiyle aynı projenin mevcut erişim JWT'sini yalnızca bellekte kullanan istemci eklendi. Refresh tokenı okunup başka istemciye aktarılmaz, eski storage yazılmaz, Meta istemcisi başlatılmaz ve mevcut oturum refresh/revoke edilmez. `getUser()` ve canonical profil RPC'si yine zorunludur. Gerçek SDK'lı izole test yalnızca iki doğrulama endpointinin çağrıldığını ve refresh/logout çağrısı olmadığını doğruladı. Mevcut JWT süresi dolarsa tekrar doğrulama gerekir. Bu geçici geçiş kolaylığı kalıcı genel Auth cutover değildir; üretim için SMTP/hesap yönetimi tamamlanmalıdır.

## Henüz tamamlanmayanlar

E-posta teslimi ve iki farklı kullanıcıyla kabul; gerçek çok oturumlu revision/tekrar denemesi; mevcut modül ekranlarının server-first adaptörlere bağlanması; binary dosyalar/Storage ve paylaşım; finans ve onay iş kuralları; mesaj/kreatif/takvim kapsamı; personel daveti/devre dışı bırakma yönetimi; sahiplik eşlemeleriyle önizlemeli aktarım, sayısal mutabakat ve genel Auth cutover. Bunlar tamamlanmadan tüm backend geçişi bitti denmez. `VITE_ENABLE_SUPABASE_SYNC=false` korunur.

## Geri dönüş

Ana CRM etkilenirse yeni `main.tsx` başlangıç seçimini önceki committeki sürüme döndürmek mevcut normal ekranı geri getirir. Yeni yazım kilitleri kapalı olduğu sürece tablolar boş bırakılabilir; DROP/TRUNCATE gerekmez. Kimlik eşlemeleri veya Meta üyelikleri otomatik silinmez. Üretim açılmaz. Auth izin listesi geri alınacaksa yalnızca bu çalışmada eklenen iki adres çıkarılır; o sırada eklenmiş başka adresler korunur. Veritabanı geri yükleme ve gerçek kayıt değişikliği ayrı yönetici onayı gerektirir.

Resmi başvurular: [Supabase Auth getUser](https://supabase.com/docs/reference/javascript/auth-getuser), [database functions](https://supabase.com/docs/guides/database/functions), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [passwordless e-posta](https://supabase.com/docs/guides/auth/auth-email-passwordless).
