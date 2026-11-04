# Son Meta erişim kontrolü — 4 Kasım 2026

Bu not, önceki Meta 190 blokajından sonraki son durumu belirtir.

- Kullanıcının yenilediği sayfa tokenı Meta'da `PAGE`, `is_valid=true` ve beklenen uygulama ile eşleşiyor. Supabase'teki tokenın aynı olduğu yalnızca SHA-256 eşleştirmesiyle kontrol edildi; gizli değer rapora/Git'e yazılmadı.
- Ancak Meta Debug Token sonucu `expires_at=1793804400`: **4 Kasım 2026 18:00 Türkiye saati**. Bu nedenle kalıcı erişim kabulü verilmedi. Kullanıcının 2 Ocak 2027'de biteceğini gördüğü uzun ömürlü User Token'dan Page Token yeniden türetilmeli ve süresi ayrıca doğrulanmalıdır. Graph API Explorer'da tekrar Generate Access Token'a basmak bu adımın yerine geçmez.
- Sayfa/form/lead okuma kontrolü geçti. CAPI dataset metadata GET çağrısında Meta 100 alındı; bu işlem olay POST tesliminden ayrıldı. Okuma reddi gönderim hatası sayılmaz ve gönderim doğrulandı iddiası da oluşturmaz. Gerçek Meta 190 token hataları hâlâ reddedilir.
- Yeni QualifiedLead olayı (revision 3) 4 Kasım **16:35:31 Türkiye saati** Meta API tarafından test modunda `events_received=1` ile kabul edildi. Önceki olaya basılmış gibi yorumlanmadı. Toplam 3 test olayı/3 deneme var; üretim olayı yok.
- Son kod snapshot'ı `meta-manual-v1.2`. Önceki snapshot'lar saklandı. Veri seti metadata reddi ve olay kabulünü ayıran 3 regresyon kontrolü eklendi. Toplam Node 129, izole kontrol 198 (129+43+13+6+7). Build/tip/Deno ve koruma kontrolü geçti.

**Kalan engel:** Supabase'teki kısa süreli sayfa tokenının daha kalıcı erişimle değiştirilmesi ve süre/izin kontrolünün tekrar yapılması. Kaynak kodunu dondurmak token süresini uzatmaz. Üretim gönderimi, Meta uygulaması izin/yayın kabulü ve gerçek iletişim bilgili başvuru kabulü ayrıca tamamlanmalıdır.
