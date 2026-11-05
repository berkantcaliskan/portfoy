# Eksik form yanıtı düzeltmesi — 5 Kasım 2026

Canlı alım tanısı, bir başvurunun beşinci `field_data` öğesinde `values` özelliğinin bulunmadığını gösterdi. Önceki katı kontrol bu nedenle tüm başvuruyu reddediyordu. Mevcut Meta hata giderme talebi kapsamında düzeltildi; önceki v1.3.2 kaynak snapshot'ı saklandı.

Artık yalnızca bulunmayan `values` normalizasyon sırasında boş yanıt olarak işlenir. Ham `fields` içinde eksik özellik olduğu gibi korunur; `FORM_ANSWER_MISSING:5` benzeri alan sırasını belirten uyarı kaynak bağlamına eklenir. İsim, telefon ve diğer mevcut yanıtlar korunur. `null`, nesne, sayı veya string dışı liste elemanları otomatik dönüştürülmez; açıklayıcı hatayla reddedilir. Eksik yanıtın neden gelmediğine ilişkin tahmin yapılmaz.

141 birim test geçti; eksik beşinci yanıt, ham veri korunması, diğer alanların alınması ve bozuk veri reddi test edildi. Canlı alımın tamamlanması kullanıcı tarafından aynı kapsamda tekrar denenerek doğrulanmalıdır. Otomatik veya üretim CAPI gönderimi açılmaz; bu düzeltme gerçek kayıt silmez veya geçmiş satış değeri değiştirmez.
