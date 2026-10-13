# DEMİRTÜRK PORTFÖY CRM - META REKLAMLARI (INSTAGRAM & FACEBOOK) CANLI VERİ ENTEGRASYON KILAVUZU

Bu kılavuz, Instagram ve Facebook Lead Ads (Potansiyel Müşteri Reklamları) üzerinden form dolduran müşterilerin **telefon numarası, form adı ve forma verdikleri tüm özel yanıtların (Bütçe, Konut Tipi, Yatırım Amacı vb.)** saniyeler içinde Demirtürk Portföy CRM ekranına anlık olarak nasıl düştüğünü ve bunu nasıl canlıya alacağınızı adım adım açıklar.

---

## 1. MANTIK VE VERİ AKIŞI (NEDEN VE NASIL ÇALIŞIR?)

### A. Meta'nın Güvenlik Protokolü (KVKK / GDPR)
Meta (Facebook & Instagram), reklam formunu dolduran kişinin telefon numarasını, adını veya form yanıtlarını **açık bir webhook bildirimiyle doğrudan fırlatmaz**. 
Meta güvenlik gereği sistemimize yalnızca şu şifreli sinyali gönderir:
> *"1092839218391 nolu sayfada, 184920492840 nolu form üzerinden 7892341238910 nolu `leadgen_id` ile yeni bir başvuru yapıldı."*

### B. Graph API ile Veriyi Çözme
Webhook servisimiz (`supabase/functions/meta-webhook/index.ts`) bu sinyali alır almaz Meta Graph API'ye güvenli bir bağlantı açar:
```http
GET https://graph.facebook.com/v19.0/7892341238910?access_token=EAAB...
```
Meta bu isteğe karşılık formun içeriğini çözerek teslim eder:
```json
{
  "id": "7892341238910",
  "created_time": "2026-10-03T13:45:00+0000",
  "field_data": [
    { "name": "full_name", "values": ["Ahmet Yılmaz"] },
    { "name": "phone_number", "values": ["+905321234567"] },
    { "name": "email", "values": ["ahmet@example.com"] },
    { "name": "ilgilendiginiz_konut_tipi", "values": ["2+1 Rezidans"] },
    { "name": "butce_araliginiz", "values": ["7.500.000 TL - 10.000.000 TL"] },
    { "name": "alim_amaci", "values": ["Yatırım & Kira Getirisi"] },
    { "name": "ne_zaman_tasinmayi_planliyorsunuz", "values": ["Hemen (1-3 Ay İçinde)"] }
  ]
}
```

### C. Ayrıştırma (Parser) ve CRM'e Yazma
Webhook servisimiz:
1. `full_name`, `phone_number` ve `email` alanlarını standart müşteri kimliğine dönüştürür.
2. Formda yer alan diğer tüm özel soruları (`ilgilendiginiz_konut_tipi`, `butce_araliginiz`, `alim_amaci` vb.) Türkçe ve okunaklı etiketlere çevirerek `meta_answers` listesine ekler.
3. Supabase veritabanındaki `public.leads` tablosuna `INSERT` veya `UPDATE` eder.

### D. Canlı WebSocket Yayını (Supabase Realtime)
Veritabanına satır eklendiği milisaniyede Supabase Realtime WebSocket kanalı aktif olur. 
Açık olan tüm **Demirtürk Portföy** uygulamaları sayfayı yenilemeye gerek kalmadan müşteriyi listesinin en tepesine koyar ve sesli/görsel uyarı verir.
Danışman müşteri kartına tıkladığında **"Meta Reklam Formu & Cevapları"** kartında müşterinin verdiği her cevabı tek tek görür.

---

## 2. CANLIYA ALMA ADIMLARI (META PANELİNDEN YAPILACAKLAR)

### Adım 1: Meta Developers Panelinde Webhook Kurulumu
1. [developers.facebook.com](https://developers.facebook.com) adresine gidin ve oturum açın.
2. **Uygulamalarım (My Apps) -> Uygulama Oluştur (Create App)** seçeneğine tıklayın.
3. Uygulama türü olarak **İşletme (Business)** seçin ve bir isim verin (Örn: *Demirturk CRM Entegrasyonu*).
4. Sol menüden **Webhooks** ürününü ekleyin.
5. Açılan ekranda nesne türü olarak **Page (Sayfa)** seçeneğini seçin.
6. **Bu nesneye abone ol (Subscribe to this object)** butonuna tıklayın:
   - **Geri Çağrılacak URL (Callback URL)**: `https://<PROJE-ID>.supabase.co/functions/v1/meta-webhook`
   - **Doğrulama Belirteci (Verify Token)**: `demirturk_secret_verify_token_2026` (veya belirlediğiniz şifre)
7. Açılan olaylar listesinde **`leadgen`** satırını bulun ve **Abone Ol (Subscribe)** butonuna tıklayın.

### Adım 2: Kalıcı Sayfa Erişim Belirteci (Permanent Page Access Token) Alma
Graph API'nin form verilerini şifresiz okuyabilmesi için Meta Business Suite'ten süresiz bir erişim anahtarı üretilmelidir:
1. **Meta Business Suite -> İşletme Ayarları (Business Settings) -> Sistem Kullanıcıları (System Users)** sayfasına gidin.
2. Bir sistem kullanıcısı oluşturun (Örn: *CRM Bot*) ve Yönetici rolü verin.
3. İlgili Facebook Sayfanızı ve Reklam Hesabınızı bu kullanıcıya bağlayın.
4. **Yeni Belirteç Oluştur (Generate New Token)** butonuna tıklayın.
5. İzinler listesinden şu iki izni mutlaka işaretleyin:
   - `leads_retrieval` (Müşteri form verilerini çekme izni)
   - `pages_manage_ads` (Reklam ve form ilişkilendirme izni)
6. Üretilen uzun token'ı kopyalayın.

### Adım 3: Supabase Ortam Değişkenlerini Tanımlama
Supabase panelinizde **Project Settings -> Edge Functions -> Secrets** bölümüne gidip şu değişkenleri ekleyin:
- `META_VERIFY_TOKEN`: `demirturk_secret_verify_token_2026`
- `META_PAGE_ACCESS_TOKEN`: *(Adım 2'de aldığınız kalıcı token)*
- `SUPABASE_URL`: Projenizin Supabase URL'si
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase Projenizin Service Role Gizli Anahtarı

Ardından Edge Function'ı deploy edin:
```bash
supabase functions deploy meta-webhook
```

---

## 3. NO-CODE ALTERNATİF: MAKE.COM VEYA N8N İLE 5 DAKİKADA BAĞLAMA

Eğer Edge Function derlemek istemiyorsanız, Make.com veya n8n ile sıfır kodla da aynı yapıyı bağlayabilirsiniz:
1. **Make.com**'da yeni bir senaryo oluşturun.
2. **Modül 1**: `Facebook Lead Ads` -> `New Lead` (Facebook hesabınızı bağlayıp sayfa ve formunuzu seçin).
3. **Modül 2**: `Supabase` -> `Create a Row` (Gelen `full_name`, `phone_number`, `form_name` ve form yanıtlarını `leads` tablosunun ilgili sütunlarına eşleyin).
4. Senaryoyu **Immediately (Anında)** olarak kaydedin ve başlatın.

---

## 4. TEST ETME (META RESMİ TEST ARACI)

Meta, gerçek reklam bütçesi harcamadan form akışını ve webhook'u test etmek için ücretsiz bir simülatör sunar:
1. [developers.facebook.com/tools/lead-ads-testing](https://developers.facebook.com/tools/lead-ads-testing) adresine gidin.
2. Sayfanızı ve test etmek istediğiniz formu seçin.
3. Form sorularını doldurun (Bütçe: 8.500.000 TL, Konut Tipi: 3+1 Villa, Alım Amacı: Yatırım).
4. **Lead Oluştur (Create Lead)** butonuna basın.
5. 1-2 saniye içinde Demirtürk Portföy uygulamanızda formun en üste düştüğünü görebilirsiniz.

---

## 5. UYGULAMA İÇİ TEST VE SİMÜLASYON

Demirtürk Portföy'ün kendi içinde de tam uyumlu bir simülasyon motoru yer almaktadır:
1. Uygulamada sol menüden **Pazarlama / Kampanyalar** sekmesine geçin.
2. Sağ üstteki **"Meta Webhook Simülasyonu"** butonuna tıklayın.
3. Ad, telefon, konut tipi, bütçe, alım amacı ve taşınma süresini belirleyip **"Webhook Gönder"** deyin.
4. Müşteriler sekmesine gittiğinizde müşterinin en tepeye düştüğünü, detayına girdiğinizde ise **"Meta Reklam Formu & Cevapları"** kartında tüm soruların ve cevapların hazır olduğunu göreceksiniz.
