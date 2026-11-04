# Ajan çalışma kuralları

## Meta alanı kullanıcı onayı gerektirir

Kullanıcı 4 Kasım 2026'da Meta akışının tamamlanıp korunmasını ve sonraki ajanların açık onay almadan bu alana dokunmamasını istedi.

- `meta-protection.json` içindeki dosyalar korumalı Meta sürümüdür. Bu dosyaları kullanıcı bu oturumda **özellikle Meta değişikliğini** açıkça onaylamadan düzenlemeyin, taşımayın, silmeyin, yeniden biçimlendirmeyin veya yeniden üretmeyin.
- Genel backend geçişi, refactor, bağımlılık güncellemesi, lint düzeltmesi, derleme hatası veya “testleri geçir” talebi Meta alanını değiştirme izni değildir. İlgisiz değişikliği düzeltin; korumayı güncelleyerek hatayı gizlemeyin.
- Koruma manifestini, doğrulayıcıyı, CODEOWNERS/CI kontrolünü veya bu talimatı onaysız değiştirmeyin. Onay yoksa korumalı değişikliği yapmadan durun; hangi dosya ve davranışın değişmesi gerektiğini somut olarak açıklayın.
- Salt okunur inceleme ve testler serbesttir. Otomatik CAPI, arka plan gönderimi ve geçmiş toplu aktarım kapalı kalır. Üretim olayını sırf test etmek için göndermeyin.
- `leadStore.ts`, `dbMapper.ts`, `types/lead.ts`, `supabaseClient.ts`, müşteri ekranları ve genel Auth/sync ortak dosyalardır. Backend işi için diğer kısımları değiştirebilirsiniz; Meta'nın kaynak ID, inquiry geçmişi, revision, aşama kuyruğu, Auth kapsamı ve elle gönderim sözleşmesini onaysız değiştirmeyin. Meta çağrılarını kaldırmayın veya başka yoldan üretim gönderimi eklemeyin.
- Sunucu Secrets'ını, veri setini, sayfayı, API sürümünü, Meta olay eşlemesini veya `META_TEST_ONLY` değerini değiştirmek de Meta değişikliğidir. Özellikle otomatik geri bildirimi hiçbir zaman genel yayın izninden çıkarım yaparak açmayın.
- Şifre/token istemciye, loga, Git'e veya rapora yazılmaz. Gerçek kayıtlar test amacıyla silinmez. Test/üretim ayrımı korunur.

Onaylı değişiklikte önce eski korumalı snapshot'ı saklayın, küçük bir diff hazırlayın, Meta testlerini ve tip kontrolünü çalıştırın, yeni kabul raporu hazırlayın; ancak bu adımlardan sonra yeni koruma manifesti oluşturun. Manifest güncellemek tek başına kullanıcı onayı kanıtı değildir.

Bu talimat ve SHA kontrolü yanlışlıkla yapılan değişikliği engellemeye yardımcı olur; dış API'nin değişmeyeceği veya dosyaların yönetici tarafından değiştirilemeyeceği garantisi değildir. GitHub'da zorunlu inceleme ayrıca yönetici tarafından etkinleştirilmelidir.
