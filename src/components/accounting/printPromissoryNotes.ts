import documentStyles from './PromissoryNoteDocument.css?inline'

const printStyles = `
  @page { size: A4 portrait; margin: 0; }
  html, body { margin: 0; padding: 0; background: white; }
  .note-document { width: auto; margin: 0; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  .note-page { break-inside: avoid; }
  .note-page + .note-page { margin-top: 0; break-before: page; }
`

export function printPromissoryNotes(documentContent: HTMLElement, onError: () => void) {
  const frame = document.createElement('iframe')
  frame.title = 'Senet yazdırma'
  frame.setAttribute('sandbox', 'allow-same-origin allow-modals')
  frame.style.cssText = 'position:fixed;width:1px;height:1px;right:0;bottom:0;border:0;pointer-events:none;opacity:0'
  frame.addEventListener('load', () => {
    const printWindow = frame.contentWindow
    if (!printWindow) {
      frame.remove()
      onError()
      return
    }
    printWindow.addEventListener('afterprint', () => frame.remove(), { once: true })
    try {
      printWindow.focus()
      printWindow.print()
    } catch {
      frame.remove()
      onError()
    }
  }, { once: true })
  const printable = documentContent.cloneNode(true) as HTMLElement
  printable.querySelectorAll('.note-page[hidden]').forEach(page => page.removeAttribute('hidden'))
  frame.srcdoc = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Senetler</title><style>${documentStyles}${printStyles}</style></head><body>${printable.outerHTML}</body></html>`
  document.body.append(frame)
  return () => frame.remove()
}
