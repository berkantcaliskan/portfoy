# Demirtürk Portföy - Web Sitesi Form Entegrasyon Kılavuzu

Bu kılavuz, `demirturkinsaat.com` veya şirketinizin herhangi bir web sitesindeki:
- **"Bize Ulaşın" / İletişim Formları**
- **"Ücretsiz Tanıtım Turu" Başvuruları**
- **Proje Bilgi / Fiyat Teklif Formları**
- **Sizi Arayalım / WhatsApp Başvuruları**

gibi formların doldurulduğu anda **milisaniyeler içinde** Portföy masaüstü ve web uygulamamıza canlı sesli bildirimle düşmesini sağlar.

---

## 🚀 Canlı Webhook API Adresi

Sitenizdeki formların göndereceği webhook uç noktası:

```
POST https://unjfqfservizfmbgofhq.supabase.co/functions/v1/website-webhook
```

- **Method**: `POST`
- **İçerik Türü**: `application/json` veya `multipart/form-data` / `application/x-www-form-urlencoded`
- **CORS**: Tüm alan adlarına açıktır (`*`). Doğrudan tarayıcıdan (JavaScript) veya sunucudan (PHP/WordPress) çağrılabilir.

---

## 📋 Kabul Edilen Alanlar (Esnek Parametreler)

Webhook hem Türkçe hem İngilizce alan isimlerini otomatik tanır:

| Parametre | Alternatif İsimler | Açıklama | Örnek Değer |
| :--- | :--- | :--- | :--- |
| **`fullName`** *(Zorunlu)* | `full_name`, `name`, `ad_soyad`, `your_name` | Müşterinin Adı Soyadı | `"Ahmet Yılmaz"` |
| **`phone`** *(Zorunlu)* | `phone_number`, `tel`, `telefon`, `your_phone` | Telefon Numarası | `"0532 123 45 67"` |
| `email` | `eposta`, `your_email` | E-Posta Adresi | `"ahmet@gmail.com"` |
| `formName` | `formType`, `subject`, `konu` | Formun Türü / Başlığı | `"Ücretsiz Tanıtım Turu"` |
| `preferredHousingType` | `konut_tipi`, `proje` | İlgilendiği Konut Tipi | `"2+1 Rezidans"`, `"Villa"` |
| `budget` | `butce` | Bütçe Aralığı | `"5.500.000 TL"` |
| `message` | `mesaj`, `notes`, `your_message` | Müşterinin Notu / Mesajı | `"Hafta sonu yerinde görmek istiyoruz."` |
| `preferredDate` | `tur_tarihi`, `tarih` | Tanıtım Turu Tarih Tercihi | `"12 Ekim Cumartesi 14:00"` |

---

## 🛠️ Entegrasyon Seçenekleri

### Seçenek 1: JavaScript (HTML Formu veya Özel Frontend)

Sitenizin iletişim veya tanıtım turu formunun `submit` olayında:

```javascript
// Örnek Form Gönderim Fonksiyonu
async function sendToPortfoy(formData) {
  try {
    const response = await fetch("https://unjfqfservizfmbgofhq.supabase.co/functions/v1/website-webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fullName: formData.name,              // Örn: "Mehmet Demir"
        phone: formData.phone,                // Örn: "0533 111 22 33"
        email: formData.email,                // Örn: "mehmet@gmail.com"
        formName: "Ücretsiz Tanıtım Turu",    // Form başlığı
        preferredHousingType: formData.type,  // Örn: "2+1"
        message: formData.message,            // Örn: "Karasu projeniz için arayın"
        preferredDate: formData.date,         // Örn: "Cumartesi 15:00"
      }),
    });

    const result = await response.json();
    console.log("Portföy'e iletildi:", result);
  } catch (error) {
    console.error("Hata:", error);
  }
}
```

---

### Seçenek 2: WordPress + Contact Form 7 (PHP Kodu)

Eğer web siteniz WordPress ise, temanızın `functions.php` dosyasına şu kısa kodu eklemeniz yeterlidir:

```php
add_action('wpcf7_mail_sent', 'demirturk_cf7_to_portfoy');

function demirturk_cf7_to_portfoy($contact_form) {
    $submission = WPCF7_Submission::get_instance();
    if (!$submission) return;

    $data = $submission->get_posted_data();

    // Portföy Webhook Payload Hazırlığı
    $payload = array(
        'fullName'             => isset($data['your-name']) ? $data['your-name'] : $data['ad-soyad'],
        'phone'                => isset($data['your-phone']) ? $data['your-phone'] : $data['telefon'],
        'email'                => isset($data['your-email']) ? $data['your-email'] : '',
        'formName'             => $contact_form->title(), // Form Başlığı (Örn: Ücretsiz Tanıtım Turu)
        'preferredHousingType' => isset($data['konut-tipi']) ? $data['konut-tipi'] : '',
        'message'              => isset($data['your-message']) ? $data['your-message'] : '',
        'preferredDate'        => isset($data['tur-tarihi']) ? $data['tur-tarihi'] : '',
    );

    // Webhook'a POST Gönder
    wp_remote_post('https://unjfqfservizfmbgofhq.supabase.co/functions/v1/website-webhook', array(
        'method'    => 'POST',
        'headers'   => array('Content-Type' => 'application/json; charset=utf-8'),
        'body'      => json_encode($payload),
        'timeout'   => 5,
        'blocking'  => false, // Ziyaretçiyi bekletmeden arka planda anında iletir
    ));
}
```

---

### Seçenek 3: Elementor Formları (Eklentisiz)

Elementor Pro kullanıyorsanız:
1. Form elementine tıklayın.
2. Sol panelden **Actions After Submit** bölümünü açın.
3. Listeden **Webhook** seçeneğini ekleyin.
4. Açılan **Webhook** sekmesine URL olarak:
   `https://unjfqfservizfmbgofhq.supabase.co/functions/v1/website-webhook` yapıştırın.
5. Sayfayı güncelleyin. Artık tüm başvurular doğrudan Portföy'e akar!

---

### Seçenek 4: Klasik PHP / cURL

```php
<?php
$data = [
    'fullName'             => $_POST['ad_soyad'],
    'phone'                => $_POST['telefon'],
    'email'                => $_POST['eposta'],
    'formName'             => 'Ücretsiz Tanıtım Turu',
    'preferredHousingType' => $_POST['konut_tipi'],
    'message'              => $_POST['mesaj'],
];

$ch = curl_init('https://unjfqfservizfmbgofhq.supabase.co/functions/v1/website-webhook');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_TIMEOUT, 5);
$response = curl_exec($ch);
curl_close($ch);
?>
```

---

## ✨ Portföy Uygulamasında Ne Olur?

Bir ziyaretçi sitenizden formu doldurup "Gönder" butonuna bastığı an:
1. **Canlı Düşüş**: Portföy masaüstü veya web uygulamasını kullanan tüm ekip üyelerinin ekranında sayfa yenilenmeden en üste yeni satır eklenir.
2. **Sesli Melodi**: Zarif "dank" bildirim melodisi çalar.
3. **Masaüstü Bildirimi**: Sağ üstte *"Yeni Müşteri Düştü • Canlı"* kartı ve Windows masaüstü bildirimi belirir.
4. **Mükerrer (Duplicate) Koruması**: Eğer müşteri daha önce Meta reklamlarından yazmışsa veya eski bir müşteriyse, yeni bir müşteri oluşturup kirlilik yaratmaz; mevcut kartın geçmişine *"Web Sitesinden Yeni Form Dolduruldu (Ücretsiz Tanıtım Turu)"* olarak iliştirir.
