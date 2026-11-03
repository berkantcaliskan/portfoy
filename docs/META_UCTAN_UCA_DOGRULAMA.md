# Meta manuel akış doğrulaması — 3 Kasım 2026

## Sonuç ve sınır

99 uygulama/handler, 43 SQL ve 13 bütünleşik izole zincir kontrolü geçti: toplam 155. Gerçek webhook ve CAPI handler kodları ile migration/RPC kodları çalıştırıldı; Meta yanıtları ve kimlik doğrulama bağımlılıkları taklit edildi. Gerçek müşteri veya üretim veri setine istek gönderilmedi. PGlite kontrolü, ayrı PostgreSQL bağlantılarıyla eşzamanlı yarış testinin yerine geçmez.

TypeScript, production build, Deno Edge Function tip kontrolü ve kaynak sır taraması geçti. Lint 0 hata, 327 uyarı; build büyük chunk uyarısı veriyor. Tarayıcı/Electron etkileşim regresyonu bu doğrulamanın kapsamı değildir.

Canlı Meta veri alma izni, webhook teslimi, veri setinin olay kabulü, kişi eşleşmesi, atıf ve kampanya optimizasyonu henüz doğrulanmadı. API kabulü tek başına bunların kanıtı değildir. Test ortamı hazır olmadığı için kullanıcı isteğiyle izole kontroller tamamlandı.

## Gelen ve giden alanlar

| Alan | Davranış ve kanıt |
|---|---|
| Meta leadgen_id | Sayıya çevrilmeden tam metin olarak saklanır; 20 haneli kimlik testi var. CAPI lead_id, kullanıcının seçtiği doğrulanmış kaynaktan alınır. CRM ID yerine kullanılmaz. |
| Kişi ve iletişim | Ad, telefon, e-posta; Türkçe alan adları ve telefon biçimleri normalize edilir. Tam telefonla müşteri eşleşir. Desteklenmeyen telefon ham yanıtta korunur ve uyarı oluşturur. |
| Form ve reklam | Form ID/adı, sayfa, reklam/adset/kampanya ID ve adları, platform ve organic bilgisi mevcutsa saklanır. Bilinmeyen kampanya uydurulmaz. |
| Sorular ve zaman | Özgün alan yanıtları ve başvuru zamanı kaynak/inquiry geçmişinde korunur. Tek kişinin sonraki başvurusu önceki geçmişi silmez. |
| CAPI eşleştirme | Seçili lead_id ve bilinen page_id; normalize SHA-256 telefon, e-posta, ad/soyad, mevcutsa şehir/il/posta kodu/ülke ve CRM external_id. Ham iletişim bilgisi gönderilmez. |
| CAPI bağlam | Olay adı, CRM aşaması ve olay zamanı; bilinen form/reklam/adset/kampanya ID'leri özel bağlam olarak aktarılır. Bu özel alanların optimizasyon girdisi olması garanti edilmez. |
| Gönderilmeyenler | Serbest form yanıtları ve bütçe otomatik aktarılmaz. Gelir, IP, user agent, fbc/fbp veya sahte Meta kimliği üretilmez. |

## Düzeltilen sorunlar

- Aynı kişinin birden çok Meta başvurusu varsa son kaynağı kendiliğinden kullanma kaldırıldı. Kullanıcı form/kaynak seçer; sunucu sahipliği doğrular ve belirsiz seçimi reddeder. Arayüz seçilen başvurunun yanıtlarını gösterir.
- E-posta etrafındaki boşlukların geçerli eşleştirmeyi engellemesi düzeltildi; kaynak ve müşteri iletişim verileri hash öncesinde normalize edilip tekilleştirilir.
- Reklam atıf alanlarına izin eksikliği temel lead alımını gereksiz yere durdurmaz; yalnızca belirli Graph hata kodlarında temel alanlarla tekrar denenir ve eksiklik uyarılır. Geçersiz token başarılı sayılmaz.
- Form ve lead sayfaları cursor ile tamamlanır; döngüsel cursor durdurulur. Aynı müşteri sonraki form/sayfada tekrar gelince yeni inquiry anlık görüntüsü de uygulanır. Kısmi hatalar görünür kalır.
- Eksik form adı sonradan doğrulandığında kaynak zenginleştirilir; tekrar müşteri/inquiry/aktivite üretilmez. Formun ACTIVE olduğu doğrulanmadıysa bilinmiyor gösterilir.

## Aşama ve manuel gönderim

Contact, QualifiedLead, DisqualifiedLead ve Schedule eşlemeleri mevcut iş kurallarına göre kullanılır. Temas kurmak nitelikli lead değildir. NEW/UNDECIDED/OFFER/PRESENTATION/WON için bu sürümde dönüşüm gönderilmez; doğrulanmış satış modeli olmadan Purchase kapalıdır. Tüm aşamaların Meta'ya gönderildiği iddia edilmez.

Aşama değişimi kendi başına olay kuyruğu veya Meta isteği oluşturmaz. Kullanıcı Gönder/Test Events düğmesine basar. Aynı kaynak/aşama revizyonu tekrar tıklandığında ikinci olay oluşmaz. Farklı kaynak açıkça seçilerek ayrı değerlendirilir. Retry aynı olay kimliği ve payload ile sınırlı deneme/bekleme kuralları içinde elle yapılır. Otomatik gönderim ve geçmiş toplu aktarım kapalıdır.

## Yönetici için sonraki doğrulama

1. Ayrı staging Supabase/Auth üyeliği ve Meta Test Events hazırlayın; anahtarları yalnızca sunucu Secrets bölümüne koyun.
2. Önce `202610310001_meta_pipeline.sql`, ardından `202611030001_meta_source_context.sql` migration'larını staging'de uygulayın. Genel CRM RLS geçişi için `supabase/rollout/02_crm_rls_after_auth.sql` önkoşullarını ayrıca tamamlayın. Canlıya uygulanmadı.
3. İmzalı gerçek test lead gönderin; kişi, iki ayrı form başvurusu, leadgen_id, zaman ve özgün yanıtları CRM'de karşılaştırın. Tekrar teslimde kayıt sayısının artmadığını doğrulayın.
4. Aşamayı değiştirip hiçbir otomatik gönderim olmadığını kontrol edin. Kaynağı seçip yalnızca Test Events gönderin; olay kimliği, lead_id ve kabul yanıtını Events Manager'da karşılaştırın.
5. İzin/token/timeout hatası ve manuel retry provasını yapın. Veri seti, reklam hedefi ve hesap uygunluğunu ayrıca doğrulayın. Üretim gönderimi ve dağıtım ayrı onay gerektirir.

Yeni migration mevcut payload, olay zamanı veya geçmiş satış değerini değiştirmez. Geri dönüşte önce uygulama gönderimini durdurun; önceki kod sürümüne dönün. Yeni kolonları/kayıtları silerek geri dönüş yapmayın. Ayrıntılı geçiş ve geri dönüş: `META_GUVENLI_GECIS.md`, `META_MANUEL_DEMO_GECIS.md`.

## Birincil kaynaklar

Meta geliştirici kılavuzları bu kontrol sırasında 429 yanıtı verdi; güncel tüm hesap/API gereksinimleri doğrulanmış sayılmaz. Alan sözleşmesi resmi Meta SDK kaynaklarıyla karşılaştırıldı:

- [Lead alanları](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/lead.py)
- [Form ve lead edge](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/leadgenform.py)
- [Sunucu müşteri eşleştirme alanları](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/serverside/user_data.py)
- [Normalizasyon](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/serverside/normalize.py)

## Durum

- Tamamlandı ve izole doğrulandı: kaynak seçimi, alan koruma, hash, imza/idempotency, manuel olay yaşam döngüsü ve yukarıdaki 155 kontrol.
- Uygulandı, canlı doğrulama bekliyor: gerçek Meta/Supabase bağlantısı ve teslim akışı.
- Yönetici işlemi: staging, Secrets, erişim izinleri, Auth/RLS geçişi ve daha önce açığa çıkmış credential'ların yenilenmesi.
- Güvenlik için ertelendi: üretim dağıtımı, otomatik gönderim, geçmiş backfill, Purchase ve doğrulanmamış satış optimizasyonu.
- Eksik önkoşul: ayrı staging/Test Events; gerçek çok bağlantılı PostgreSQL yarış ve uygulama etkileşim testi.
