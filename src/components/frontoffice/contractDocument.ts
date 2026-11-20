import type { OfficePayload } from '@/types/frontOffice'

const escapeHtml = (value: string | undefined) => (value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
export function contractDocument(payload: OfficePayload) {
  const fields = [
    ...(payload.contractNumber ? [['Sözleşme No', payload.contractNumber]] : []),
    ['Lehdar / Firma', payload.beneficiary],
    ['Adı, Soyadı', payload.name],
    ['T.C. / Vergi No', payload.identityNo],
    ['Telefon', payload.phone],
    ['Adres', payload.address],
    ['Proje / Bağımsız Bölüm', payload.property],
    ['Sözleşme Bedeli (TL)', payload.amount],
  ]
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${escapeHtml(payload.title)}</title><style>@page{size:A4;margin:20mm}body{font:12pt Georgia,serif;color:#111;max-width:170mm;margin:20px auto}h1{text-align:center;font-size:18pt}dl{display:grid;grid-template-columns:55mm 1fr;gap:8px}dt{font-weight:bold}dd{margin:0;overflow-wrap:anywhere}.body{white-space:pre-wrap;line-height:1.6;overflow-wrap:anywhere;margin:24px 0}.sign{display:flex;justify-content:space-between;margin-top:50px;break-inside:avoid}</style></head><body><h1>${escapeHtml(payload.title)}</h1><dl>${fields.map(([label, value]) => `<dt>${label}</dt><dd>${escapeHtml(value)}</dd>`).join('')}</dl><div class="body">${escapeHtml(payload.body)}</div><div class="sign"><span>Firma / Yetkili İmza</span><span>Müşteri İmza</span></div></body></html>`
}
export function printContract(payload: OfficePayload) {
  const frame = document.createElement('iframe')
  frame.title = 'Sözleşme yazdırma'
  Object.assign(frame.style, { position: 'fixed', width: '1px', height: '1px', opacity: '0', pointerEvents: 'none' })
  frame.onload = () => {
    const target = frame.contentWindow
    if (!target) { frame.remove(); return }
    target.addEventListener('afterprint', () => frame.remove(), { once: true })
    target.focus(); target.print()
    window.setTimeout(() => frame.remove(), 120000)
  }
  frame.srcdoc = contractDocument(payload)
  document.body.append(frame)
}
