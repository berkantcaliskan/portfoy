# Meta demo kontrol listesi — yalnızca elle geri bildirim

Bu sürümde Meta'dan form alma webhook ile devam eder. CRM'den Meta'ya sonuç geri bildirimi yalnızca kullanıcı seçili müşteri için Gönder veya Test Events butonuna bastığında yapılır.

## Demo öncesi

1. Ayrı Supabase staging projesine migration ve onaylı Auth/RLS geçişini uygulayın. Üretimdeki müşteri kayıtlarını demo verisi olarak kopyalamayın. Ayrıntılar: META_GUVENLI_GECIS.md.
2. Gerekli Meta sayfa/App Secret/CAPI sırlarını yalnızca server Secrets bölümüne girin. Dataset, Graph sürümü ve Meta yetkilerini resmî hesapta doğrulayın. Test Events kodunu sunucuda ayarlayın; gerçek üretim gönderimi için enabled=false kalsın.
3. Demo personelinin Supabase Auth kimliğini meta_members ile eşleyin. Yönetici ve gönderim yetkili personeli ayrı doğrulayın. Panelden oturum açıp Durumu yenile ve yönetici bağlantı testini çalıştırın. Dataset okunması olay teslimi veya reklam optimizasyonu kanıtı değildir.
4. Cron/worker kurmayın. Demo sürümü process çağrısını engeller; auto_sync açma isteğini API ve DB reddeder. Eski dağıtımlarda kalan cron/worker varsa yönetici kontrollü olarak durdurun.

## Gösterilecek akış

1. Meta'nın test form aracıyla staging'e gelen, orijinal Meta kimliği bulunan bir başvuruyu kullanın. Aynı bildirimin tekrarının tek müşteri/başvuru/aktivite kaldığını kontrol edin.
2. Müşterinin aşamasını Nitelikli yapın. Bu yalnızca CRM'e kaydedilir: yeni bir CAPI outbox olayı ve Meta gönderimi oluşmamalıdır.
3. Meta panelindeki Test Events bölümünden müşteriyi adıyla seçin. Test Events'e gönder butonuna basın. Gönderilen olayın test_event_code içerdiğini ve üretim raporlamasına normal olay olarak gitmediğini Meta Events Manager'da doğrulayın.
4. API kabul sonucu ve trace bilgisini kontrol edin. Kabul ile Meta müşteri eşleşmesi/atıf/optimizasyonunun ayrı kavramlar olduğunu belirtin.
5. Başarısız girişimde UI hata veya bekliyor göstermeli; SENT göstermemelidir. Otomatik tekrar olmamalıdır. Sorunu staging'de düzelttikten ve bekleme süresi dolduktan sonra aynı müşteri için butona yeniden basın. Olay kimliği değişmez; toplam deneme sınırı beştir. Kalıcı ret için yönetici gerekir.
6. Üretim dataset'ine normal Gönder akışını demo provası olarak kullanmayın. Bunun aktivasyonu ayrı yönetici onayı ve gerçek Meta test kabulü gerektirir. enabled=true yapılması bile otomatik gönderimi açmaz; bu sürüm manuel kilitlidir.

## Sunumdan önce geçmesi gerekenler

- Webhook GET challenge ve POST imzası staging'de doğrulandı.
- Geçerli başvuru CRM'e eksiksiz geldi; duplicate ikinci müşteri oluşturmadı.
- Aşama değişiminden sonra otomatik geri bildirim oluşmadı.
- Açık kullanıcı tıklamasıyla Test Events olayı kabul edildi.
- Yanlış token/ağ hatası başarı gösterilmeden raporlandı; düzeltilince elle tekrar çalıştı.
- Kullanıcı çıkışında yetkili Meta oturumu diğer personele kalmadı.
- Demo sunucusunda ve Electron/tarayıcıda temel CRM akışı kontrol edildi.

Yerel otomatik testler bu canlı/staging kontrollerinin yerine geçmez. Bu çalışma gerçek Meta veya Supabase üretim isteği göndermedi ve demo sunucusuna dağıtım yapmadı.
