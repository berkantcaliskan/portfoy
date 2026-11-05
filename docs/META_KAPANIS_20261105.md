# Meta demo kabulü — 5 Kasım 2026

## Sonuç ve kapsam

9002 tabanındaki elle alım ve elle test geri bildirimi çalışıyor. Bu kabul staging/demo içindir; üretim gönderimi açılmadı. Otomatik senkronizasyon ve geçmiş toplu gönderim kapalıdır. Genel CRM backend geçişi bu raporla tamamlanmış sayılmaz.

## Doğrulananlar

- Kullanıcının canlı bağlantı testi sayfa, form ve lead okumayı doğruladı. Sistem kullanıcısının planlı bitişi görünmüyor; iptal edilebilirlik devam eder. Sayfa tokenı sistem kullanıcısından yalnızca sunucuda alınır.
- Gerçek başvurunun form adı, kaynak kimliği, telefon ve özel yanıtları CRM ekranında görüldü. Salt okunur son kontrolde 50 müşteri ve 50 kaynak kayıtlıydı. Tüm Meta hesabıyla sayısal mutabakat yapılmadığından bu sayı hesabın tüm başvurularının alındığını kanıtlamaz.
- `values` özelliği gelmeyen sorular boş normalize edilir; ham alan ve eksiklik uyarısı korunur. Bozuk tipler reddedilir. Alım sırasında tamamlanan form/sayfa ve müşteri sayısı gösterilir; müşteri ekranı kayıt geldikçe güncellenir.
- 5 Kasım Contact testleri 11:49:54 ve 12:14:39; QualifiedLead testleri 11:50:45 ve 12:19:15 Türkiye saatinde API tarafından birer olay kabulüyle kaydedildi. Son QualifiedLead olay kimliği `6084f737-f783-4503-abfa-4f8027b20d1d`; kaynak formu `4548675502011959`. Payload lead kimliği kayıtlı kaynakla eşleşiyor.
- Kullanıcının Meta panel görüntüsünde QualifiedLead “İşlendi” göründü. O panelde farklı form filtresi ve farklı doğrulama lead'i bulunduğundan ekran görüntüsü ile yukarıdaki olay UUID'si birebir eşleştirilemedi. API teslimi ayrı olarak doğrulandı; filtrede görünen her kaydı bizim son olayımız saymıyoruz.
- Panel test koduyla sunucu test kodu arasındaki fark saptandı; staging kodu kullanıcının verdiği `TEST53272` ile eşleştirildi. Token değiştirilmedi.
- 23 canlı veritabanı kontrolü geçti: kaynak-payload eşleşmesi, her kaynağın tek inquiry kaydı, tüm olayların test olması, actor kaydı, teslim denemesi tutarlılığı, SHA-256 dış kimlikler, RLS, anonim erişim engeli ve üretim/otomatik kilitleri.
- 142/142 birim test, 43/43 SQL, 13/13 izole uçtan uca, 6/6 staging kurulum ve 7/7 CRM Auth SQL kontrolü geçti. Toplam 211 izole kontrol. Ayrıca 11/11 staging HTTP güvenlik kontrolü geçti. TypeScript/Deno tip kontrolleri, build, sır taraması başarılı. Lint hata vermedi; mevcut uyarılar ve büyük bundle uyarısı devam ediyor.

## Sınırlar ve yönetici işleri

- Meta API kabulü eşleşme, reklam atfı veya optimizasyon başarısı değildir. Üretim satış değeri ve Purchase akışı etkin değildir.
- Dataset metadata GET Meta 100 döndürebiliyor; bu olay POST yetkisinin başarısızlığı olarak yorumlanmıyor. Kabul edilen POST sonuçları yukarıdadır.
- Canlı/otomatik gönderim, geçmiş backfill, gerçek kayıt silme, credential iptali/rotasyonu, Git geçmişi temizliği ve production merge/deploy yapılmadı. Önceden paylaşılmış sırların rotasyonu yöneticiye aittir.
- Staging gerçek müşteri başvuruları içeriyor: artık yalnızca sentetik veri ortamı değildir. Bu veriler rapor ve kaynak arşivlerine eklenmedi; ayrı saklama/erişim politikası gerekir.
- GitHub zorunlu owner review/ruleset ayarı yönetici tarafından açılmalıdır. AGENTS ve hash manifesti yanlışlıkla değişikliğe karşı korumadır; değişmezlik garantisi değildir.
- Üretime geçiş için kullanıcı onayı, hedef ortam/kimlik eşlemesi, veri mutabakatı, kontrollü gerçek teslim kabulü ve işletme izleme sorumlusu gereklidir. Test kaynakları otomatik silinmez.

## Koruma ve geri dönüş

Önceki snapshot'lar saklandı. Yeni korumalı Meta sürümü manifest ile doğrulanır; bundan sonraki Meta değişiklikleri açık kullanıcı onayı gerektirir. Normal backend işi bu onayı içermez. Geri dönüş ilgili snapshot'taki iki fonksiyonu ve istemciyi staging'e kontrollü yeniden dağıtmaktır. DB verileri silinmez. Eski kısa ömürlü Page tokenına dönmek erişimi düzelteceği anlamına gelmez.
