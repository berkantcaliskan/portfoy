# Genel CRM backend geçişi

Meta alanı `meta-manual-v1` snapshot'ı ile korunur. Genel geçişte bu sözleşme değiştirilmez; gerektiğinde Meta'ya özgü açık kullanıcı onayı alınır.

## Hazırlanan temel

`202611040001_crm_identity_foundation.sql` Supabase Auth kullanıcısını personelle eşleyen ayrı `crm_identities` tablosu ve `crm_get_my_profile()` RPC'sini ekler. Yalnızca mevcut doğrulanmış Meta/personel eşlemelerini devralır; Meta üyeliği, rolü, politikaları veya olayları değiştirmez. Profilde parola yoktur. İstemci kendi yetkisini/eşlemesini değiştiremez. Devre dışı eşleme migration tekrarıyla yeniden açılmaz.

`crmAuthService.ts` Auth sunucusunu doğrular ve canonical personel profilini RPC'den alır; localStorage veya Auth metadata rolünü yetki kabul etmez. Parola girişi/çıkışı için adaptör sağlar; parola loglanmaz veya yerel personel kaydına yazılmaz. Bu adaptör henüz mevcut giriş ekranının yerine etkinleştirilmedi. Migration üretime veya staging'e uygulanmadı; önce izole SQL testleri yapıldı.

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

`npm test` merkezi Auth adaptörünün negatif/pozitif kontrollerini de çalıştırır. SQL: önce `verification/sql` bağımlılıklarını kurun, ardından kökten `node verification/crm/auth.mjs` çalıştırın; aynı test-only PGlite bağımlılığı kullanılır.

Her backend adımında `npm run meta:verify` geçmelidir. Meta baseline farkı genel backend işi gerekçesiyle otomatik kabul edilmez.
