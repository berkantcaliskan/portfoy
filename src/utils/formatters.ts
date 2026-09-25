/**
 * Demirtürk Portföy Formatters & Link Utilities
 */

export function formatCurrency(amount: number, currency: 'TRY' | 'USD' | 'EUR' = 'TRY'): string {
  const symbols = {
    TRY: '₺',
    USD: '$',
    EUR: '€',
  }
  return `${symbols[currency]} ${amount.toLocaleString('tr-TR')}`
}

export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('tr-TR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  } catch {
    return dateString
  }
}

export function formatPhoneNumber(phone: string): string {
  if (!phone) return '-'
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.startsWith('90') && cleaned.length === 12) {
    return `+90 (${cleaned.slice(2, 5)}) ${cleaned.slice(5, 8)} ${cleaned.slice(8, 10)} ${cleaned.slice(10, 12)}`
  }
  if (cleaned.length === 10) {
    return `+90 (${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)} ${cleaned.slice(6, 8)} ${cleaned.slice(8, 10)}`
  }
  return phone
}

export function cleanPhoneForWhatsApp(phone: string): string {
  let cleaned = phone.replace(/\D/g, '')
  if (cleaned.startsWith('0')) {
    cleaned = '90' + cleaned.slice(1)
  } else if (!cleaned.startsWith('90') && cleaned.length === 10) {
    cleaned = '90' + cleaned
  }
  return cleaned
}

export function generateWhatsAppUrl(phone: string, fullName: string, customMessage?: string): string {
  const cleanPhone = cleanPhoneForWhatsApp(phone)
  const defaultMsg = `Merhaba Sayın ${fullName}, Demirtürk Portföy'den ulaşıyorum. Konut ve yatırım projelerimiz hakkındaki talebiniz için iletişime geçmek istedim. Size nasıl yardımcı olabilirim?`
  const text = encodeURIComponent(customMessage || defaultMsg)
  return `https://wa.me/${cleanPhone}?text=${text}`
}
