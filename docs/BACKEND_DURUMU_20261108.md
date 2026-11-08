# Merkezi backend — 8 Kasım 2026

Bu belge önceki 5 Kasım temel raporunun güncel devamıdır. Kod ve staging kontrolü tamamlanan alanlar ile gerçek kullanıcı kabulü bekleyen işler aşağıda ayrılır. Üretim yayını yapılmadı.

## Uygulanan yapı

9002 ana uygulaması Supabase Auth ve sunucudaki etkin `crm_identities` eşlemesiyle giriş yapar. Tarayıcıdaki parola, rol, eski kullanıcı listesi veya Auth kullanıcı metadata'sı yetki vermez. E-posta/bağlantı ve parola güvenliği ayrı backend çalışma alanında kalır. Yönetici doğrulanmış e-postayla; personel yöneticinin açtığı kullanıcı adı ve geçici parolayla girer. Personelden gerçek e-posta istenmez. Teknik Auth adresi kullanıcı adı eşlemesidir; posta kutusu değildir.

Personel oluşturma ve parola sıfırlama `crm-staff` Edge Function üzerinden yapılır. Function JWT'yi `getUser` ile ve yönetici rolünü canonical profil RPC'siyle doğrular. Hizmet anahtarı yalnızca sunucudadır. İşlem kimliği, süreli işlem kilidi, deneme sınırı ve sunucu personel eşlemesi kullanılır. Geçici parola sadece yöneticiye cevapta gösterilir; CRM kaydına, localStorage'a veya loga yazılmaz. İlk girişte parola değişmeden iş kayıtlarına erişilemez. Rol düzenleme eski sürümle başka yöneticinin değişikliğini ezemez. Devre dışı personelin mevcut JWT'si iş kayıtlarına yetki sağlamaz.

`crm_backend.records` özel şemasında 20 modül sunucuya bağlandı:

- Projeler/daireler ve ayrıca portföy envanteri.
- Randevular, müşteri talepleri, tahsilatlar, ödemeler ve onaylar.
- Özel dosyalar ve rehber.
- Kreatif takvim, tasarımlar, yorumlar ve briefler.
- Manuel takvim, kişisel takvim düzeltmeleri ve marka kiti.
- Personel mesajları, ekip durumları, zimmet ve izin talepleri.

Kayıt yazımı kullanıcı/şirket/yetki kontrolünden sonra revision ile yapılır. Başarısız veya sonucu belirsiz yazım başarı sayılmaz; tekrar aynı işlem kimliğini kullanır. Aynı anda eski sürüm yazımı reddedilir. Fiziksel kayıt silinmez; arşivlenir. İşlem denetimi sunucuda tutulur. Yetkisi kaldırılan kişinin eski kayıt görünümü temizlenir. Sayfalama yarıda kesilirse eksik liste başarılı tam liste gibi gösterilmez.

Proje krokisindeki sürükleme ve marka kiti yazımı kısa gecikmeyle sıraya alınır. Sunucu onayı gelmeyen taslak ekranda görünür; tekrar kaydetme veya sunucudaki sürümü yükleme seçeneği vardır. Sayfadan ayrılırken kaydedilmemiş taslak uyarılır. Başarı mesajı veren proje işlemleri sunucu cevabını bekler. Satış kaydı otomatik muhasebe tahsilatı oluşturduğu iddiasında bulunmaz; tahsilat muhasebede ayrıca kaydedilir.

Tahsil/ödeme kesinleşince tutar ve kapanma durumu genel düzenlemeyle değiştirilemez. Kapora iadesi tahsil edilmiş kapora ve gerekçe ister. Onay kararı ayrı yetkili RPC üzerinden alınır. Zimmette aynı eşyanın iki kişiye verilmesi revision/sahiplik denetiminden geçemez; teslim geçmişi sunucu aktörüyle tutulur. Personel kendi iznini onaylayamaz. İzin/zimmetin ilişkili ekip durumu aynı sunucu işlemi içinde güncellenir.

## Dosya ve mesaj gizliliği

`crm-private` bucket'ı özeldir. Nesne okuma/yükleme RLS politikasıyla sınırlandırılır. Kişilere özel dosyalar listede olmayan yöneticiye otomatik açılmaz. Dosya notu düzenleme izni paylaşım listesini değiştirme izni sağlamaz. Medya önizlemesi beş dakikalık imzalı bağlantı kullanır. Önceden üretilmiş bağlantı sona erene kadar geçerli olabilir. Dosya boyutu 20 MB'dır. Arşivleme fiziksel nesneyi silmez; bu sürüm otomatik nesne temizliği yapmaz. Başarısız yüklemeden kalabilecek sahipsiz nesneler özel depoda kalır.

Mesajları yalnızca gönderen/alıcı okuyabilir; yönetici rolü tüm özel konuşmaları açmaz. Aktör/zaman sunucudan gelir. Mesaj eki en fazla 1 MB'dır; daha büyük dosya özel Dosyalar alanından paylaşılır. Ses gönderimi gerçek `MediaRecorder` içeriğini kullanır; yalnızca sayaçtan ses kaydı üretmez. Mikrofon izni, cihaz ve tarayıcı uyumluluğu kullanıcı kabulünde denenmelidir. Mesaj listesi açık/görünür uygulamada 15 saniyede ve pencereye dönüşte yenilenir; anlık teslim garantisi verilmez.

## Doğrulama sonucu

- `npm test`: 189 test geçti.
- İzole PostgreSQL/PGlite: Auth 7, kayıt/yetki/iş akışları 34, onboarding/kalıcılık 21 test geçti.
- TypeScript ve üretim derlemesi geçti. Vite büyük parça uyarısı sürüyor.
- Lint: hata yok; mevcut kod tabanında uyarılar var. Uyarılar bastırılmadı.
- Kaynak sır taraması geçti. Git geçmişinin temizlendiği anlamına gelmez.
- Meta koruması: 40 dosya doğrulandı; manifest ve korunan kod değiştirilmedi.
- Staging üzerinde gerçek `authenticated` rolüyle proje oluşturma/tekrar/eski revision reddi, talep, tahsilat, onay kararı, rehber, takvim ve zimmet oluşturma denendi. İşlem sonunda `ROLLBACK` çalıştı; test kaydı kalmadı. Bu, tarayıcı/JWT uçtan uca testi değildir.
- Yerel 9002 giriş ekranı tarayıcıda açıldı; açılış console hatası görülmedi.
- `crm-staff` anonim/yabancı origin reddi kontrol edildi. Gerçek personel hesabı açma/sıfırlama ve iki kullanıcıyla dosya/mesaj akışı henüz tarayıcıda kabul edilmedi.

Staging'de 20 modül yazıma açıldı. Genel kayıt sayısı sıfırdır; eski test proje/dosyaları taşınmadı. Mevcut 50 Meta müşterisi ve 50 kaynak kaydı korundu. Meta `enabled=false`, `auto_sync=false` değerleri değişmedi; yeni Meta olayı gönderilmedi.

Rapor ekranları asenkron sunucu kayıtlarını dinler. Satış tutarı olmayan kayıtta ilan fiyatı gerçekleşmiş satış geliri sayılmaz. Finans indirme düğmesi gerçek CSV üretir; formül olarak yorumlanabilecek müşteri metinleri kaçırılır. Yönetici raporu tarayıcının yazdır/PDF kaydet akışını açar; arka planda PDF üretildiği iddia edilmez.

## Yayın ve geri dönüş

Yeni kurulumda migration'lar tarih sırasıyla uygulanır. Yeni modüller varsayılan olarak yazıma kapalıdır. Hedef ortamda rol testleri ve kabul tamamlandıktan sonra `crm_backend.module_settings.write_enabled` yalnızca onaylanan modüller için açılır. Staging için yapılan açılış başka ortama otomatik taşınmaz.

`crm-staff` yalnızca bu function için `--no-verify-jwt` ile deploy edilir; kendi handler'ı her isteği Auth ve canonical yönetici profiliyle doğrular. Diğer function'ların JWT ayarı değiştirilmez. Supabase'in sunucu ortam değişkenleri `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` gereklidir. İsteğe bağlı `CRM_ALLOWED_ORIGINS` varsayılanı sadece `http://127.0.0.1:9002,http://localhost:9002` adresleridir. Üretim HTTPS origin'i açıkça tanımlanmadan internet yayını yapılmamalıdır. Hizmet anahtarı frontend `.env` dosyasına konmaz.

Geri dönüşte etkilenen modülün yazımı kapatılır ve kayıtlar korunur. Tablolar veya özel Storage nesneleri silinmez. Önceki **güvenli merkezi Auth kullanan** uygulama sürümüne dönülür; eski tarayıcı parolası modeline dönülmez. Şema düşürme migration'ı uygulanmaz. Yedekleme/geri yükleme tatbikatı yapılmadan üretim veri dayanıklılığı doğrulanmış sayılmaz.

## Üretim öncesi açık kalan kabul

1. Yönetici ana 9002 ekranından kendi parolasıyla giriş yapar; bir personeli Ekip ve Yetkiler ekranından açar. Personel ayrı tarayıcıda geçici parolasını değiştirir. Yönetici rolü taklit edilerek yetki kazanılamadığı kontrol edilir.
2. Bir proje/randevu kaydı iki bilgisayarda okunur; yenileme ve yeniden giriş sonrası korunur. Aynı kayıt iki oturumda değiştirilince eski revision açık hata vermelidir.
3. Bir özel dosya yüklenir; izin verilen personel indirir, üçüncü kişi okuyamaz. Personeller mesaj gönderip yeniden girişte konuşmayı görür. Mikrofonla gerçek kısa ses kaydı ayrıca denenir.
4. SMTP/Resend son aşamaya bırakılmıştır. Alan adı/DNS doğrulaması, SMTP ayarı, yönetici kurtarma e-postası ve kota kontrolü ayrıca tamamlanır. Sohbette paylaşılmış anahtarların yönetici tarafından yenilenmesi gerekir; bu çalışma anahtar yenilemedi.
5. Üretim hedefi, HTTPS, yedekleme, izleme ve yayın onayı ayrı gerekliliktir. Otomatik üretim deploy/merge yapılmadı.

Mailcow posta kutusu ve Google Ads canlı entegrasyonu bu backend geçişiyle kurulmuş sayılmaz. Yerel görünüm tercihleri ve hesaplama araçlarının taslakları sunucu iş kaydı değildir. Meta üyeliği ayrı yetki alanıdır; yeni CRM personeli veya yöneticiye otomatik Meta gönderim yetkisi eklenmez. Meta otomatik geri bildirim kapalı kalır.

Resmî dayanaklar: [Supabase Auth kullanıcıları](https://supabase.com/docs/guides/auth/users), [Storage erişim kontrolü](https://supabase.com/docs/guides/storage/security/access-control), [özel dosya sunumu](https://supabase.com/docs/guides/storage/serving/downloads).

## Personel oluşturma kabulünde bulunan ve düzeltilen durum

Gerçek denemede personel Auth hesabı ve CRM eşlemesi oluşmuşken arayüz sonucu doğrulayamadı; geçici parola gösterilemedi. Kesin ağ hatasının türü belirlenmedi. Yeni akışta aynı oluşturma işlemi tekrarlandığında yalnızca ilk parolası hâlâ kullanılmamış/değiştirilmemiş hesap dar kapsamlı RPC ile kurtarılabilir. Kullanıcının seçtiği parola bu yoldan sıfırlanamaz; yeni Auth hesabı açılmaz. Normal yönetici parola sıfırlaması ayrı ve açık kullanıcı işlemidir.

İstemci tek oluşturma isteği gönderir, işlem süresince düğme devre dışıdır ve durum görünürdür. Parola sonucu liste yenilenmesini beklemez. Yeni personeli otomatik “Ofiste” işaretleyen, parola gösterimini ikinci yazımın sonucuna bağlayan adım kaldırıldı. Ekip kartında mevcut personel için açık “Geçici parola oluştur” düğmesi bulunur. Parola yalnızca ekranda gösterilir; kaynakta, kalıcı tarayıcı depolamasında veya logda saklanmaz. Eski altı haneli sayısal parola açıklamaları düzeltildi.

Kurtarma SQL'i izolasyonda, oluşturma/kurtarma endpointi mock servislerle ve çift tıklama/yavaş liste cevabı birim testleriyle doğrulandı. Staging migration/function güncellendi. Yeni geçici parolanın gerçek arayüzde gösterimi kullanıcı kabulü bekler.
