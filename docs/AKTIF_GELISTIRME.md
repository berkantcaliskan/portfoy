# Aktif geliştirme tabanı — 4 Kasım 2026

Kullanıcı kararıyla geliştirmeye 9002'deki güvenli Meta/CRM sürümü üzerinden devam edilir. Kod klasörü: `C:\Users\Berkant\Documents\Codex\2026-10-31\gith\work\portfoy`.

Başlatma: bağımlılıklar yoksa `npm ci`, ardından `npm run dev`. Adres `http://127.0.0.1:9002/`. Port doluysa sunucu başka porta geçmez. Mevcut 9002 sunucusu açıksa yeniden başlatmaya gerek yoktur.

Disk aynası kardeş `meta-staging-profile` klasöründedir. Tarayıcı origin'i değişmediği sürece mevcut 9002 yerel kayıtları ve oturumu korunur. Eski 9001 uygulamasının disk profili kullanılmaz; gerçek müşteri verileri otomatik taşınmaz.

`.env.local` test Supabase projesi URL'si, public key ve `VITE_ENABLE_SUPABASE_SYNC=false` içerir. Git'e eklenmez. Meta ayrıcalıklı anahtarları Supabase Secrets'ta kalır. `META_TEST_ONLY=true` ve otomatik geri bildirim kapalı kalır.

Meta manuel lead alımı, aşama kaydı ve test modunda CAPI kabulü bu ortamda doğrulandı. Genel CRM Auth/senkronizasyon geçişi, gerçek kayıtların karşılaştırmalı aktarımı, kalıcı credential yönetimi ve üretime geçiş ayrıca tamamlanmalıdır. Test ortamının kullanılması tek başına üretim kabulü değildir.

Kontroller: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run security:check`. Build yayın yapmaz. Ayrıntılı geçiş: `META_GUVENLI_GECIS.md`.
