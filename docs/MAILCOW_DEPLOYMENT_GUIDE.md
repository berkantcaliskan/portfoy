# Demirtürk Portföy - Mailcow E-Posta Sunucusu Kurulum & Canlı Dağıtım Rehberi

Bu belge, **Demirtürk İnşaat & Gayrimenkul Portföy Platformu** için şirket sunucusunda Mailcow: dockerized posta sunucusunun kurulması, DNS kayıtlarının yapılandırılması, güvenlik sertifikaları ve Turhost WordPress web sitesi ile çakışmasız çalışmasını sağlamak için hazırlanmıştır.

---

## 1. Mimari Genel Bakış ve Ayrım
- **Kurumsal Web Sitesi**: Turhost paylaşımlı sunucusunda barınmaya devam eder (`demirturkinsaat.com`, port 80/443).
- **Portföy Platformu & API**: Şirket sunucusunda veya VPS üzerinde çalışır (`app.demirturkinsaat.com` veya `portfoy.demirturkinsaat.com`).
- **Kurumsal Posta Sunucusu**: Mailcow Docker konteynerleri olarak şirket sunucusunda barınır (`mail.demirturkinsaat.com`).

---

## 2. DNS Kayıtları (Turhost cPanel / Cloudflare DNS)

Aşağıdaki DNS kayıtlarını alan adı yöneticinizde (Turhost DNS Yönetimi veya Cloudflare) eksiksiz tanımlayın:

| Kayıt Tipi | Ad / Host | Değer / Hedef | TTL | Açıklama |
|---|---|---|---|---|
| **A** | `mail` | `SUNUCU_SABIT_IP` (Örn: `185.x.x.x`) | 3600 | Mailcow sunucusunun statik IP adresi |
| **MX** | `@` | `mail.demirturkinsaat.com` (Öncelik: 10) | 3600 | Gelen postaları Mailcow sunucusuna yönlendirir |
| **TXT (SPF)** | `@` | `v=spf1 mx a:mail.demirturkinsaat.com ~all` | 3600 | Yalnızca Mailcow sunucusunun e-posta göndermesine izin verir |
| **TXT (DKIM)** | `dkim._domainkey` | Mailcow panelinden üretilen RSA 2048 public key | 3600 | Gönderilen postaların kriptografik imzası |
| **TXT (DMARC)** | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:postmaster@demirturkinsaat.com` | 3600 | Sahte göndericilere karşı koruma politikası |
| **CNAME** | `autodiscover` | `mail.demirturkinsaat.com` | 3600 | Outlook & Thunderbird otomatik kurulumu |
| **CNAME** | `autoconfig` | `mail.demirturkinsaat.com` | 3600 | Mozilla Thunderbird otomatik yapılandırma |

> [!IMPORTANT]
> **Ters DNS (rDNS / PTR Kaydı)**:
> Sunucunuzun internet servis sağlayıcısından (ISP / Datacenter) sunucu statik IP'si için PTR kaydını `mail.demirturkinsaat.com` olarak tanımlatmalısınız. PTR kaydı olmayan sunuculardan giden e-postalar Gmail, Hotmail ve kurumsal sunucular tarafından doğrudan SPAM olarak reddedilir.

---

## 3. Güvenlik Duvarı & Port Gereksinimleri

Mailcow'un sorunsuz çalışması için sunucunuzda aşağıdaki portların açık olması gerekir:

| Port | Protokol | Servis | Açıklama |
|---|---|---|---|
| **25** | TCP | SMTP | Sunucular arası e-posta aktarımı (ISP tarafından bloklanmamış olmalı) |
| **465** | TCP | SMTPS | Güvenli e-posta gönderimi (TLS/SSL) |
| **587** | TCP | SMTP Submission | İstemci gönderim portu (STARTTLS) |
| **993** | TCP | IMAPS | Güvenli e-posta okuma (SSL/TLS) |
| **80** | TCP | HTTP | Let's Encrypt SSL doğrulaması için |
| **443** | TCP | HTTPS | Mailcow Web UI & REST API |

---

## 4. Mailcow Docker Kurulum Adımları

### 1. Docker & Docker Compose Kurulumu (Ubuntu / Debian)
```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg lsb-release
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

### 2. Mailcow Dosyalarını İndirme
```bash
cd /opt
sudo git clone https://github.com/mailcow/mailcow-dockerized
cd mailcow-dockerized
sudo ./generate_config.sh
```
*Soru sorulduğunda FQDN olarak: `mail.demirturkinsaat.com` girin.*

### 3. Konfigürasyonu Başlatma
```bash
sudo docker compose pull
sudo docker compose up -d
```

### 4. Yönetim Paneline Erişim
Tarayıcıdan `https://mail.demirturkinsaat.com` adresine gidin.
- Varsayılan Kullanıcı Adı: `admin`
- Varsayılan Şifre: `moohoo`
*(İlk girişte bu şifreyi derhal güçlü bir şifre ile değiştirin).*

---

## 5. Mailcow API Anahtarı Alma (Portföy Entegrasyonu İçin)

1. Mailcow paneline `admin` olarak giriş yapın.
2. Üst menüden **Configuration** -> **Access** -> **API** sekmesine gidin.
3. **API Read/Write Access** seçeneğini etkinleştirin.
4. Sunucunuzun / Portföy platformunuzun IP adresini izin verilenler (Allow list) listesine ekleyin.
5. Oluşturulan **API Token**'ı kopyalayın.
6. Portföy Platformu `.env` dosyanıza ekleyin:
   ```env
   VITE_MAILCOW_API_HOST=https://mail.demirturkinsaat.com
   VITE_MAILCOW_API_KEY=KOPYALANAN_API_ANAHTARI
   VITE_SMTP_HOST=mail.demirturkinsaat.com
   VITE_SMTP_PORT=465
   VITE_IMAP_HOST=mail.demirturkinsaat.com
   VITE_IMAP_PORT=993
   ```

---

## 6. Portföy Platformundaki E-Posta Hesapları

Sistemde tanımlı kurumsal hesaplar ve kullanım amaçları:

1. **`berkant@demirturkinsaat.com`**
   - *Yönetici / Kişisel Posta Kutusu*: Yalnızca Berkant Demirtürk yetkisindedir.
   - Kotası: 10 GB.
2. **`satis@demirturkinsaat.com`**
   - *Satış Departmanı Ortak Posta Kutusu*: Satış ekibi ve yöneticiler görebilir. Müşteri teklifleri, sözleşme taslakları.
   - Kotası: 25 GB.
3. **`pazarlama@demirturkinsaat.com`**
   - *Pazarlama Departmanı Ortak Posta Kutusu*: Pazarlama ekibi ve yöneticiler görebilir. Reklam ajansları, medya yazışmaları.
   - Kotası: 15 GB.

---

## 7. Müşteriye E-Posta Bağlama ve Gizlilik Koruması

- Portföy platformunda gelen ve giden e-postalar doğrudan **Müşteri İlişkileri (CRM)** kayıtlarına bağlanabilir.
- CRM'e bağlanan e-postalar için **erişim yetkisi korunur**; satış temsilcisi yalnızca kendi yetkili olduğu müşterinin veya ortak hesapların yazışmalarını inceleyebilir.
- Dış sunuculardan gelen HTML e-postalardaki uzaktan izleme pikselleri (tracking pixels) ve görseller **Gizlilik Kalkanı** tarafından otomatik olarak engellenir; kullanıcı dilerse tek tıkla görselleri yükleyebilir.
