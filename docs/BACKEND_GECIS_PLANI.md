# Genel CRM backend geçişi

> Bu belge başlangıç planıdır. 8 Kasım uygulaması ve doğrulama sınırları için [güncel backend durumu](BACKEND_DURUMU_20261108.md) esas alınmalıdır.

Meta alanı `meta-manual-v1.4-demo` snapshot'ı ile korunur. Genel geçişte bu sözleşme değiştirilmez; gerektiğinde Meta'ya özgü açık kullanıcı onayı alınır.

## Hazırlanan temel

`202611040001_crm_identity_foundation.sql` Supabase Auth kullanıcısını personelle eşleyen ayrı `crm_identities` tablosu ve `crm_get_my_profile()` RPC'sini ekler. Yalnızca mevcut doğrulanmış Meta/personel eşlemelerini devralır; Meta üyeliği, rolü, politikaları veya olayları değiştirmez. Profilde parola yoktur. İstemci kendi yetkisini/eşlemesini değiştiremez. Devre dışı eşleme migration tekrarıyla yeniden açılmaz.

`crmAuthService.ts` Auth sunucusunu doğrular ve canonical personel profilini RPC'den alır; localStorage veya Auth metadata rolünü yetki kabul etmez. Parola ve e-posta bağlantısı/kod girişi adaptörleri sağlar. Parola loglanmaz veya yerel personel kaydına yazılmaz. Bu adaptör mevcut giriş ekranının yerine etkinleştirilmedi; ayrı geçiş alanında kullanılır.

5 Kasım 2026: kimlik temeli ve `202611050001_crm_record_backend.sql` yalnızca `portfoy-meta-staging` projesine uygulandı. Yeni `crm_backend` şeması mevcut Meta/müşteri tablolarından ayrıdır. Yedi modül için kayıt başına sürüm, idempotent işlem kimliği, actor audit, şirket/rol/sahip kapsamı ve fiziksel silme yerine arşivleme sağlar. Projenin nested daire/çizim bilgileri JSON kayıt içinde kaybolmadan korunur. Bu temel, her modülün bütün iş kurallarının tamamlandığı anlamına gelmez; onay kararı genel kayıt endpointinden verilemez.

Tüm modül yazımları **sunucuda kapalıdır**. Eski `syncService` bu depoya bağlanmadı. Böylece yerel tam kayıt upsert'i, eski önbellek veya geçmiş veriler otomatik yüklenmez. Yeni merkezi kayıtlara henüz veri aktarılmadı. Mevcut CRM ve korumalı Meta oturumu çalışmaya devam eder.

Geçiş ekranı: `http://127.0.0.1:9002/?workspace=backend`. Varsayılan uygulama 9002'de aynı kalır. Bu ekran eski yerel store/senkronizasyon motorunu başlatmaz; ayrı sessionStorage Auth istemcisi kullanır. Sunucu profilini doğrular, yerel aktarım sayımını salt okunur gösterir ve yetkili sunucu listelerini kontrol eder. Gizli anahtar veya yerel personel parolası aktarmaz. İlk uygulamada yalnızca kod bekleniyordu; mevcut Supabase şablonu Sign in bağlantısı gönderdiği için SPA callback desteği eklendi. Sonra izin listesi boş olduğu doğrulandı; yalnızca bu ekranın 127.0.0.1 ve localhost 9002 dönüş adresleri eklendi. `site_url`, e-posta şablonu ve diğer ayarlar değiştirilmedi.

## Sonraki uygulama sırası

1. Eski 9001 kayıtlarının ve yerel kullanıcıların sayım/kimlik bazlı salt okunur envanteri; erişimi sınırlı yedek. Ham müşteri verisi GitHub'a taşınmaz. Otomatik birleştirme ve silme yok.
2. Auth adaptörünü ayrı geçiş bayrağıyla giriş ekranına bağlamak; yönetici/personel eşlemelerini doğrulamak. Yerel parola ve istemci rolüyle sunucu yetkisi verilmez.
3. CRM müşteri/aktivite kaydı için sunucu yetkisi, kayıt kapsamı ve revision ile çakışma koruması. Meta kaynak/inquiry/revision alanlarına genel upsert yapılmaz.
4. Proje/daire, randevu/talep, muhasebe, onay ve dosya modülleri için ayrı şema/yetki matrisi. Her modül pozitif/negatif yetki ve eşzamanlı güncelleme kontrolü geçmeden sync'e dahil edilmez.
5. Diğer yerel modüllerin (mesaj, kreatif, takvim vb.) kalıcılık ve paylaşım kapsamını açıkça belirlemek. Hepsinin zaten bulutta olduğu iddia edilmez.
6. İki ayrı kullanıcı ve iki tarayıcı/bilgisayarda oturum, yetki, çakışma, tekrar giriş ve veri sürekliliği kabulü.
7. Kapsam önizlemeli veri aktarımı, kayıt sayısı/kimlik doğrulaması ve geri dönüş provası. Üretim ortamı/credential/yayın ayrı son onay gerektirir.

`VITE_ENABLE_SUPABASE_SYNC=false` kalır. Eski sync kodunun tam kayıt upsert, hata yutma, profil parolası ve toplu silme yolları genel geçiş tamamlanmış sayılmaz. Tek bayrağı açarak “tam backend” etkinleştirilmez.

## Doğrulama

`npm test` merkezi Auth adaptörünün negatif/pozitif kontrollerini de çalıştırır. SQL: önce `npm ci --ignore-scripts --prefix verification/crm`, ardından kökten `npm test --prefix verification/crm` çalıştırın. Meta test paketini değiştirmeden aynı test-only PGlite sürümü ayrı, kilit dosyalı paket olarak kullanılır.

Kayıt temeli testleri: `node verification/crm/records.mjs`. Salt okunur staging kontrolleri `verification/crm/staging-readonly.sql` ve `staging-profile-readonly.sql` içindedir. İkinci dosya DB bağlantısında `BEGIN READ ONLY` ve geçici rol bağlamı kurar; tarayıcıdan gerçek Auth kabulünün yerine geçmez.

Her backend adımında `npm run meta:verify` geçmelidir. Meta baseline farkı genel backend işi gerekçesiyle otomatik kabul edilmez.
