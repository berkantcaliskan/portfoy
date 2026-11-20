# Windows masaüstü ve güncellemeler

`node scripts/build-portable.mjs` komutu tek dosyalık Windows x64 çıktısını `dist-electron/Demirturk-Portfoy-Portable-x64.exe` olarak oluşturur. Uygulama mevcut Windows kullanıcı profilindeki Portföy veri dizinini kullanır ve açılışta önce GitHub güncelleme kanalını kontrol eder.

Arayüz değişikliklerini doğruladıktan sonra GitHub CLI’da `berkantcaliskan/portfoy` deposuna yazabilen hesapla `npm run ota:publish` çalıştırın. Komut uygulamayı derler ve `portfoy-desktop` sürümüne yalnızca doğrulanan arayüz dosyalarını yükler. Paket, müşteri veritabanı, personel dosyaları ve ortam dosyalarını kabul etmez. Bir önceki pakete dokunmadan yeni bir güncelleme dosyası oluşturur.

Uygulama GitHub’dan dosyanın SHA-256 değerini okur. İndirme ve doğrulama başarılıysa açılışta yeni arayüzü kullanır. Ağ kesintisinde veya geçersiz pakette elindeki son arayüzle açılır. Bu kanal Electron başlatıcısını içermez. Electron, Windows paketi veya ön yükleme köprüsü değişirse yeni bir taşınabilir çıktı gerekir.
