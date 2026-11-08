export function csvCell(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  let text = value == null ? '' : String(value)
  if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text
  return '"' + text.replaceAll('"', '""') + '"'
}

export function csvText(rows: unknown[][]): string {
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(';')).join('\r\n')
}

export function downloadCsv(filename: string, rows: unknown[][]) {
  const url = URL.createObjectURL(new Blob([csvText(rows)], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url; link.download = filename; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
