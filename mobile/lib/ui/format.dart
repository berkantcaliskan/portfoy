// Masaüstündeki formatters.ts ile aynı görünüm: Türkçe tarih, TL tutar, WhatsApp bağlantısı.

const _months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

/// '2026-11-23' veya ISO zaman → '23 Kas'
String shortDate(String value) {
  final date = DateTime.tryParse(value);
  if (date == null) return value;
  final local = date.isUtc ? date.toLocal() : date;
  return '${local.day} ${_months[local.month - 1]}';
}

/// ISO zaman → '23 Kas 14:05'
String shortDateTime(String value) {
  final date = DateTime.tryParse(value)?.toLocal();
  if (date == null) return value;
  return '${date.day} ${_months[date.month - 1]} ${_two(date.hour)}:${_two(date.minute)}';
}

String _two(int n) => n.toString().padLeft(2, '0');

/// 1250000 → '₺1.250.000'
String formatLira(double value) {
  final digits = value.round().abs().toString();
  final buffer = StringBuffer(value < 0 ? '-₺' : '₺');
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) buffer.write('.');
    buffer.write(digits[i]);
  }
  return buffer.toString();
}

/// Masaüstündeki cleanPhoneForWhatsApp ile aynı (0532... → 90532...).
String internationalDigits(String phone) {
  var digits = phone.replaceAll(RegExp(r'\D'), '');
  if (digits.startsWith('0')) {
    digits = '90${digits.substring(1)}';
  } else if (!digits.startsWith('90') && digits.length == 10) {
    digits = '90$digits';
  }
  return digits;
}

/// Masaüstündeki generateWhatsAppUrl ile aynı varsayılan mesaj.
Uri whatsappUri(String phone, String name) {
  final message = 'Merhaba Sayın $name, Demirtürk Portföy\'den ulaşıyorum. Konut ve yatırım projelerimiz hakkındaki '
      'talebiniz için iletişime geçmek istedim. Size nasıl yardımcı olabilirim?';
  return Uri.parse('https://wa.me/${internationalDigits(phone)}?text=${Uri.encodeComponent(message)}');
}

Uri telUri(String phone) => Uri(scheme: 'tel', path: phone.replaceAll(RegExp(r'[^\d+]'), ''));
