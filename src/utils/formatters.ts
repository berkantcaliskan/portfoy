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

export function formatDate(dateString: string, forceIncludeYear = false): string {
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return dateString
    const currentYear = new Date().getFullYear()
    const isCurrentYear = date.getFullYear() === currentYear
    return new Intl.DateTimeFormat('tr-TR', {
      day: 'numeric',
      month: 'short',
      ...((forceIncludeYear || !isCurrentYear) ? { year: 'numeric' } : {}),
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  } catch {
    return dateString
  }
}

export function formatDateOnly(dateString: string, forceIncludeYear = false): string {
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return dateString
    const currentYear = new Date().getFullYear()
    const isCurrentYear = date.getFullYear() === currentYear
    return new Intl.DateTimeFormat('tr-TR', {
      day: 'numeric',
      month: 'short',
      ...((forceIncludeYear || !isCurrentYear) ? { year: 'numeric' } : {}),
    }).format(date)
  } catch {
    return dateString
  }
}

export function formatTimeOnly(dateString: string): string {
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return ''
    return new Intl.DateTimeFormat('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  } catch {
    return ''
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

/**
 * Formats Turkish mobile numbers uniformly as: 05xx xxx xx xx (exactly 14 characters)
 * Handles raw digits (05448491124), 10-digit (5448491124), 90-prefixed (905448491124), and existing spaced numbers.
 */
export function formatPhoneDisplay(phone?: string | null): string {
  if (!phone) return '-'
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.startsWith('90') && cleaned.length === 12) {
    return `0${cleaned.slice(2, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8, 10)} ${cleaned.slice(10, 12)}`
  }
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7, 9)} ${cleaned.slice(9, 11)}`
  }
  if (cleaned.length === 10) {
    return `0${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 8)} ${cleaned.slice(8, 10)}`
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

export function toTitleCase(str: string): string {
  if (!str) return ''
  return str.replace(/(?:^|\s)\S/g, (char) => char.toLocaleUpperCase('tr-TR'))
}

/**
 * Formats customer explanations / notes so that even if the user types starting with lowercase
 * and without ending punctuation, it is saved starting with an uppercase letter and ending with a period.
 */
export function formatSentenceNote(raw?: string | null): string {
  if (!raw) return ''
  const trimmed = raw.trim()
  if (!trimmed) return ''
  return trimmed
    .split(/\r?\n/)
    .map((line) => {
      const l = line.trim()
      if (!l) return ''
      const capitalized = (l.charAt(0).toLocaleUpperCase('tr-TR') + l.slice(1)).replace(
        /([.!?…]\s+)([a-zçğıöşü])/g,
        (_m, p1, p2) => p1 + p2.toLocaleUpperCase('tr-TR')
      )
      return /[.!?…:;]$/.test(capitalized) ? capitalized : `${capitalized}.`
    })
    .filter(Boolean)
    .join('\n')
}

export function formatAppointmentDate(dateStr: string, timeStr?: string): string {
  if (!dateStr) return ''
  try {
    const parts = dateStr.split('-')
    if (parts.length === 3) {
      const yearNum = parseInt(parts[0], 10)
      const currentYear = new Date().getFullYear()
      const monthIndex = parseInt(parts[1], 10) - 1
      const day = parseInt(parts[2], 10)
      const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
      const monthName = months[monthIndex] || parts[1]
      const formatted = yearNum === currentYear ? `${day} ${monthName}` : `${day} ${monthName} ${yearNum}`
      return timeStr ? `${formatted}, ${timeStr}` : formatted
    }
  } catch {}
  return timeStr ? `${dateStr}, ${timeStr}` : dateStr
}
