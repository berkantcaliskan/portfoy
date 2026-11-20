export function messageDayKey(value: string): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

export function messageDayLabel(value: string, now = new Date()): string {
  const key = messageDayKey(value)
  if (!key) return ''
  const currentYear = messageDayKey(now.toISOString()).slice(0, 4)
  return new Date(value).toLocaleDateString('tr-TR', {
    timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long',
    ...(key.slice(0, 4) !== currentYear ? { year: 'numeric' as const } : {}),
  }).replace(/(^|\s)(\p{L})/gu, (_match, space, letter) => space + letter.toLocaleUpperCase('tr-TR'))
}
