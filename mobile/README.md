# Demirtürk Portföy — Mobil (Flutter)

Masaüstü uygulamasıyla **aynı Supabase sunucusunu, aynı RPC'leri ve aynı iş kurallarını** kullanan mobil istemci.
Mobil için ayrı tablo veya sunucu fonksiyonu yoktur; mobil, masaüstünü etkileyecek bir şey yazmaz.

## Kapsam (sürüm 0.2)

Satış çalışma alanı:

- **Satış Hattı** — masaüstündeki kanban sütunları (Potansiyel müşteri, İletişim, Nitelikli, Teklif, Dönüşüm) aşama sekmeleri olarak; arama, arama/WhatsApp, müşteri detayı ve geçmişi.
- **Randevular** — durum süzgeci; kendi randevusunu Tamamlandı/İptal olarak işaretleme.
- **Başarı Tablosu** — haftalık/aylık; Yönetim tüm ekibi, satışçı yalnızca kendini görür.

Müşteri kaydına yazma (aşama, bilgi, not) sunucu kuralı gereği yalnızca admin, Yönetim ve kendi müşterisinde
Müşteri İlişkileri için açıktır; yalnızca Satış'taki kullanıcı masaüstünde olduğu gibi okuyabilir.

## Masaüstüyle eşleşme

| Mobil | Masaüstü karşılığı |
|---|---|
| `lib/data/models.dart` | `src/types/lead.ts`, `src/services/dbMapper.ts` (rowToLead), `appointmentStore.ts` |
| `lib/data/sales_rules.dart` | `SalesTeamView.tsx`, `permissionService.ts`, `leadStore.ts` (updateStage), `utils/salesPerformance.ts` |
| `lib/data/crm_repository.dart` | `crmAuthService.ts`, `leadStore.ts` (crm_update_lead_work, crm_add_lead_note), `crmBackendRepository.ts` |
| `lib/ui/format.dart` | `utils/formatters.ts` |

Bu dosyalardaki bir kural masaüstünde değişirse mobilde de aynı şekilde değiştirilmelidir. `test/sales_rules_test.dart`
masaüstündeki testlerle aynı durumları sınar.

## Derleme

Derleme ve testler GitHub Actions'ta çalışır (`.github/workflows/mobile.yml`), yalnızca `mobile/` değiştiğinde.
Android APK, iş akışının "Artifacts" bölümünden indirilir. iOS şimdilik imzasız derlenir; telefona kurmak için
Apple geliştirici hesabıyla imzalama gerekir.

Gerekli GitHub secret'ları: `MOBILE_SUPABASE_URL`, `MOBILE_SUPABASE_PUBLISHABLE_KEY` (masaüstündeki herkese açık
adres ve anahtar). Bunlar yoksa uygulama derlenir ama açılışta sunucu adresi istendiğini söyler.

Yerel çalıştırma (Flutter kurulu bir bilgisayarda):

```sh
flutter pub get
flutter analyze
flutter test
flutter run --dart-define=SUPABASE_URL=https://PROJE.supabase.co --dart-define=SUPABASE_PUBLISHABLE_KEY=ANAHTAR
```

## Oturum

Bu sürümde oturum bellektedir; uygulama tamamen kapanınca yeniden giriş gerekir. İlk girişteki zorunlu parola
değişikliği masaüstünden yapılır.
