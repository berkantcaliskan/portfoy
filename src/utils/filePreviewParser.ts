import { SharedFile } from '@/services/sharedFileStore'

export interface DocxBlock {
  type: 'heading' | 'paragraph' | 'table'
  text?: string
  level?: number
  rows?: string[][]
}

export interface SpreadsheetSheet {
  name: string
  rows: string[][]
}

export type ParsedPreviewResult =
  | { kind: 'image'; url: string }
  | { kind: 'video'; url: string; mimeType: string }
  | { kind: 'audio'; url: string; mimeType: string }
  | { kind: 'pdf'; url: string; isFallback?: boolean }
  | { kind: 'text'; content: string; language: string }
  | { kind: 'word'; blocks: DocxBlock[] }
  | { kind: 'excel'; sheets: SpreadsheetSheet[] }
  | { kind: 'unsupported'; reason: string }

/**
 * Converts a Base64 Data URL into raw Uint8Array bytes and MIME type.
 */
export function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mimeType: string } {
  const commaIdx = dataUrl.indexOf(',')
  if (commaIdx === -1) {
    throw new Error('Geçersiz veri formatı')
  }
  const header = dataUrl.slice(0, commaIdx)
  const base64 = dataUrl.slice(commaIdx + 1)
  const mimeMatch = header.match(/^data:([^;]+)/i)
  const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream'

  const binaryStr = window.atob(base64)
  const len = binaryStr.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i)
  }
  return { bytes, mimeType }
}

/**
 * Converts a Data URL into a Blob Object URL for smooth iframe/video/audio rendering.
 */
export function dataUrlToBlobUrl(dataUrl: string, overrideMimeType?: string): string {
  const { bytes, mimeType } = dataUrlToBytes(dataUrl)
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: overrideMimeType || mimeType,
  })
  return URL.createObjectURL(blob)
}

/**
 * Minimal PKZIP extractor in pure browser JS using native DecompressionStream('deflate-raw').
 * Used to inspect .docx and .xlsx archives without external dependencies.
 */
async function extractZipEntries(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
  const entries = new Map<string, Uint8Array>()
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

  // Locate End of Central Directory (EOCD) signature 0x06054b50
  let eocdOffset = -1
  const minEocdSearch = Math.max(0, bytes.length - 65557)
  for (let i = bytes.length - 22; i >= minEocdSearch; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i
      break
    }
  }

  if (eocdOffset === -1) {
    throw new Error('ZIP merkezi dizini bulunamadı')
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true)
  const cdOffset = view.getUint32(eocdOffset + 16, true)

  let ptr = cdOffset
  const decoder = new TextDecoder('utf-8')

  for (let i = 0; i < totalEntries; i++) {
    if (ptr + 46 > bytes.length) break
    const sig = view.getUint32(ptr, true)
    if (sig !== 0x02014b50) break

    const compressionMethod = view.getUint16(ptr + 10, true)
    const compressedSize = view.getUint32(ptr + 20, true)
    const fileNameLen = view.getUint16(ptr + 28, true)
    const extraLen = view.getUint16(ptr + 30, true)
    const commentLen = view.getUint16(ptr + 32, true)
    const localHeaderOffset = view.getUint32(ptr + 42, true)

    const fileName = decoder.decode(bytes.subarray(ptr + 46, ptr + 46 + fileNameLen))
    ptr += 46 + fileNameLen + extraLen + commentLen

    if (fileName.endsWith('/')) continue
    if (localHeaderOffset + 30 > bytes.length) continue
    if (view.getUint32(localHeaderOffset, true) !== 0x04034b50) continue

    const localNameLen = view.getUint16(localHeaderOffset + 26, true)
    const localExtraLen = view.getUint16(localHeaderOffset + 28, true)
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen
    const compressedData = bytes.subarray(dataStart, dataStart + compressedSize)

    if (compressionMethod === 0) {
      entries.set(fileName, compressedData)
    } else if (compressionMethod === 8 && typeof DecompressionStream !== 'undefined') {
      try {
        const ds = new DecompressionStream('deflate-raw')
        const writer = ds.writable.getWriter()
        writer.write(new Uint8Array(compressedData))
        writer.close()
        const response = new Response(ds.readable)
        const ab = await response.arrayBuffer()
        entries.set(fileName, new Uint8Array(ab))
      } catch {
        // Skip unreadable entry
      }
    }
  }

  return entries
}

/**
 * Parses a .docx file's word/document.xml into structured paragraphs & tables.
 */
async function parseDocxBytes(bytes: Uint8Array): Promise<DocxBlock[]> {
  const zip = await extractZipEntries(bytes)
  const docXmlBytes = zip.get('word/document.xml')
  if (!docXmlBytes) {
    throw new Error('Word belgesi içeriği (word/document.xml) okunamadı')
  }

  const xmlText = new TextDecoder('utf-8').decode(docXmlBytes)
  const dom = new DOMParser().parseFromString(xmlText, 'application/xml')
  const blocks: DocxBlock[] = []

  const body = dom.getElementsByTagName('w:body')[0] || dom.documentElement
  const children = Array.from(body.childNodes)

  for (const node of children) {
    if (node.nodeType !== 1) continue
    const el = node as Element
    const tag = el.tagName || el.localName

    if (tag === 'w:p' || tag === 'p') {
      const styleEl = el.getElementsByTagName('w:pStyle')[0]
      const styleVal = styleEl?.getAttribute('w:val') || ''
      let paragraphText = ''

      const runs = Array.from(el.getElementsByTagName('w:r'))
      if (runs.length > 0) {
        for (const r of runs) {
          const rChildren = Array.from(r.childNodes)
          for (const rc of rChildren) {
            if (rc.nodeType !== 1) continue
            const rTag = (rc as Element).tagName
            if (rTag === 'w:t') {
              paragraphText += rc.textContent || ''
            } else if (rTag === 'w:tab') {
              paragraphText += '\t'
            } else if (rTag === 'w:br' || rTag === 'w:cr') {
              paragraphText += '\n'
            }
          }
        }
      } else {
        const texts = Array.from(el.getElementsByTagName('w:t'))
        paragraphText = texts.map((t) => t.textContent || '').join('')
      }

      if (paragraphText.trim().length > 0) {
        if (/Heading|Baslik|Title/i.test(styleVal)) {
          blocks.push({
            type: 'heading',
            level: styleVal.includes('1') ? 1 : 2,
            text: paragraphText,
          })
        } else {
          blocks.push({
            type: 'paragraph',
            text: paragraphText,
          })
        }
      }
    } else if (tag === 'w:tbl' || tag === 'tbl') {
      const trList = Array.from(el.getElementsByTagName('w:tr'))
      const rows: string[][] = []
      for (const tr of trList) {
        const tcList = Array.from(tr.getElementsByTagName('w:tc'))
        const rowCells: string[] = []
        for (const tc of tcList) {
          const tNodes = Array.from(tc.getElementsByTagName('w:t'))
          rowCells.push(tNodes.map((t) => t.textContent || '').join(' ').trim())
        }
        if (rowCells.length > 0) {
          rows.push(rowCells)
        }
      }
      if (rows.length > 0) {
        blocks.push({ type: 'table', rows })
      }
    }
  }

  return blocks
}

function colLettersToIndex(letters: string): number {
  let col = 0
  for (let i = 0; i < letters.length; i++) {
    col = col * 26 + (letters.charCodeAt(i) - 64)
  }
  return Math.max(0, col - 1)
}

/**
 * Parses an .xlsx file's worksheets and sharedStrings into 2D grids.
 */
async function parseXlsxBytes(bytes: Uint8Array): Promise<SpreadsheetSheet[]> {
  const zip = await extractZipEntries(bytes)
  const decoder = new TextDecoder('utf-8')

  // 1. Parse sharedStrings.xml if available
  const sharedStrings: string[] = []
  const ssBytes = zip.get('xl/sharedStrings.xml')
  if (ssBytes) {
    const ssDom = new DOMParser().parseFromString(decoder.decode(ssBytes), 'application/xml')
    const siNodes = Array.from(ssDom.getElementsByTagName('si'))
    for (const si of siNodes) {
      const tNodes = Array.from(si.getElementsByTagName('t'))
      sharedStrings.push(tNodes.map((t) => t.textContent || '').join(''))
    }
  }

  // 2. Parse workbook.xml for sheet names
  const sheetNames: string[] = []
  const wbBytes = zip.get('xl/workbook.xml')
  if (wbBytes) {
    const wbDom = new DOMParser().parseFromString(decoder.decode(wbBytes), 'application/xml')
    const sheetNodes = Array.from(wbDom.getElementsByTagName('sheet'))
    for (const s of sheetNodes) {
      const nameAttr = s.getAttribute('name')
      if (nameAttr) sheetNames.push(nameAttr)
    }
  }

  // 3. Find all worksheet XMLs
  const worksheetKeys = Array.from(zip.keys())
    .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(k))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

  const sheets: SpreadsheetSheet[] = []

  for (let idx = 0; idx < worksheetKeys.length; idx++) {
    const key = worksheetKeys[idx]
    const wsBytes = zip.get(key)
    if (!wsBytes) continue

    const wsDom = new DOMParser().parseFromString(decoder.decode(wsBytes), 'application/xml')
    const rowNodes = Array.from(wsDom.getElementsByTagName('row'))
    const rows: string[][] = []
    let maxCols = 0

    for (const rowNode of rowNodes) {
      const cNodes = Array.from(rowNode.getElementsByTagName('c'))
      const rowData: string[] = []

      for (const c of cNodes) {
        const ref = c.getAttribute('r') || ''
        const colMatch = ref.match(/^[A-Z]+/i)
        const colIdx = colMatch ? colLettersToIndex(colMatch[0].toUpperCase()) : rowData.length
        const cellType = c.getAttribute('t') || ''

        let val = ''
        if (cellType === 'inlineStr') {
          const tNodes = Array.from(c.getElementsByTagName('t'))
          val = tNodes.map((t) => t.textContent || '').join('')
        } else {
          const vNode = c.getElementsByTagName('v')[0]
          const rawVal = vNode?.textContent || ''
          if (cellType === 's') {
            const ssIdx = parseInt(rawVal, 10)
            val = !isNaN(ssIdx) && sharedStrings[ssIdx] !== undefined ? sharedStrings[ssIdx] : rawVal
          } else if (cellType === 'b') {
            val = rawVal === '1' ? 'DOĞRU' : 'YANLIŞ'
          } else {
            val = rawVal
          }
        }

        while (rowData.length < colIdx) {
          rowData.push('')
        }
        rowData[colIdx] = val
      }

      if (rowData.length > maxCols) maxCols = rowData.length
      if (rowData.some((cell) => cell.trim() !== '')) {
        rows.push(rowData)
      }
    }

    // Normalize column count
    const normalizedRows = rows.map((r) => {
      const copy = [...r]
      while (copy.length < maxCols) copy.push('')
      return copy
    })

    if (normalizedRows.length > 0) {
      sheets.push({
        name: sheetNames[idx] || `Sayfa ${idx + 1}`,
        rows: normalizedRows,
      })
    }
  }

  return sheets
}

/**
 * Parses CSV / TSV text into 2D grid rows.
 */
export function parseDelimitedText(text: string, sheetName = 'Tablo 1'): SpreadsheetSheet[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim().length > 0)
  if (lines.length === 0) return [{ name: sheetName, rows: [] }]

  const firstLine = lines[0]
  const tabCount = (firstLine.match(/\t/g) || []).length
  const semiCount = (firstLine.match(/;/g) || []).length
  const commaCount = (firstLine.match(/,/g) || []).length

  let delimiter = ','
  if (tabCount > semiCount && tabCount > commaCount) delimiter = '\t'
  else if (semiCount >= commaCount && semiCount > 0) delimiter = ';'

  let maxCols = 0
  const rows: string[][] = lines.map((line) => {
    const cells: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        inQuotes = !inQuotes
      } else if (ch === delimiter && !inQuotes) {
        cells.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    cells.push(current.trim())
    if (cells.length > maxCols) maxCols = cells.length
    return cells
  })

  const normalized = rows.map((r) => {
    const copy = [...r]
    while (copy.length < maxCols) copy.push('')
    return copy
  })

  return [{ name: sheetName, rows: normalized }]
}

/**
 * Strips basic RTF formatting for clean text preview.
 */
function stripRtf(rtf: string): string {
  return rtf
    .replace(/\\par[d]?/g, '\n')
    .replace(/\{\*?\\[^{}]+}|[{}]|\\\n?[A-Za-z]+\n?(?:-?\d+)?[ ]?/g, '')
    .replace(/\\'[0-9a-fA-F]{2}/g, '')
    .trim()
}

/**
 * Main entry point to parse any SharedFile for in-app preview.
 */
export async function buildFilePreview(file: SharedFile): Promise<ParsedPreviewResult> {
  const lowerName = (file.name || '').toLowerCase()
  const mime = (file.mimeType || '').toLowerCase()

  // Handle seed/demo files that were created before real binary upload existed
  if (!file.fileDataUrl) {
    if (file.type === 'excel') {
      return {
        kind: 'excel',
        sheets: [
          {
            name: 'Özet Tablo',
            rows: [
              ['Kalem / Birim', 'Not / Açıklama', 'Durum', 'Bütçe / Tutar', 'Tarih'],
              [file.name, file.notes || file.folder || 'Belge', 'Onaylandı', '₺4.850.000', file.createdAt.slice(0, 10)],
              ['A Blok 1. Kat Daire 4', 'Konut Satış', 'Aktif', '₺6.200.000', file.createdAt.slice(0, 10)],
              ['B Blok Ticari Ünite 1', 'Ticari', 'Rezerve', '₺12.500.000', file.createdAt.slice(0, 10)],
            ],
          },
        ],
      }
    }
    if (file.type === 'doc') {
      return {
        kind: 'word',
        blocks: [
          { type: 'heading', level: 1, text: file.name },
          {
            type: 'paragraph',
            text: `Bu belge ${file.uploadedByUserName} tarafından paylaşılmıştır.${file.notes ? ` Not: ${file.notes}` : ''}`,
          },
          {
            type: 'paragraph',
            text: 'Belge içeriği kurumsal standartlara uygun olarak hazırlanmış olup yetkili departmanların erişimine açıktır.',
          },
        ],
      }
    }
    if (file.type === 'pdf') {
      return {
        kind: 'word',
        blocks: [
          { type: 'heading', level: 1, text: `${file.name} (PDF Belgesi Önizlemesi)` },
          {
            type: 'paragraph',
            text: `Kategori: ${file.folder} • Boyut: ${file.size} • Yükleyen: ${file.uploadedByUserName}`,
          },
          {
            type: 'paragraph',
            text: 'Not: Bu kayıt örnek veri olarak oluşturulmuştur. Bilgisayarınızdan yüklediğiniz tüm gerçek PDF dosyaları tam sayfa etkileşimli PDF görüntüleyici ile açılır.',
          },
        ],
      }
    }
    return {
      kind: 'unsupported',
      reason: 'Bu dosya örnek bir kayıt olduğu için ikili (binary) önizleme verisi içermiyor. Bilgisayarınızdan yüklediğiniz dosyalar doğrudan önizlenir.',
    }
  }

  // 1. IMAGE
  if (
    file.type === 'image' ||
    mime.startsWith('image/') ||
    /\.(png|jpg|jpeg|webp|gif|svg|bmp)$/i.test(lowerName)
  ) {
    return { kind: 'image', url: file.fileDataUrl }
  }

  // 2. VIDEO
  if (
    file.type === 'video' ||
    mime.startsWith('video/') ||
    /\.(mp4|webm|ogg|mov|m4v)$/i.test(lowerName)
  ) {
    const blobUrl = dataUrlToBlobUrl(file.fileDataUrl, file.mimeType || 'video/mp4')
    return { kind: 'video', url: blobUrl, mimeType: file.mimeType || 'video/mp4' }
  }

  // 3. AUDIO
  if (
    file.type === 'audio' ||
    mime.startsWith('audio/') ||
    /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(lowerName)
  ) {
    const blobUrl = dataUrlToBlobUrl(file.fileDataUrl, file.mimeType || 'audio/mpeg')
    return { kind: 'audio', url: blobUrl, mimeType: file.mimeType || 'audio/mpeg' }
  }

  // 4. PDF
  if (file.type === 'pdf' || mime.includes('pdf') || lowerName.endsWith('.pdf')) {
    const blobUrl = dataUrlToBlobUrl(file.fileDataUrl, 'application/pdf')
    return { kind: 'pdf', url: blobUrl }
  }

  const { bytes } = dataUrlToBytes(file.fileDataUrl)

  // 5. EXCEL (.xlsx, .csv, .tsv, .xls)
  if (
    file.type === 'excel' ||
    /\.(xlsx|xls|csv|tsv)$/i.test(lowerName) ||
    mime.includes('spreadsheet') ||
    mime.includes('excel') ||
    mime.includes('csv')
  ) {
    if (lowerName.endsWith('.csv') || lowerName.endsWith('.tsv') || mime.includes('csv')) {
      const text = new TextDecoder('utf-8').decode(bytes)
      return { kind: 'excel', sheets: parseDelimitedText(text, file.name) }
    }

    // Check if it's a PKZIP (.xlsx)
    if (bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b) {
      try {
        const sheets = await parseXlsxBytes(bytes)
        if (sheets.length > 0) {
          return { kind: 'excel', sheets }
        }
      } catch {
        // Fall through to text attempt
      }
    }

    // Fallback for plain/HTML/XML-based .xls exports
    const rawText = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
    if (rawText.includes('\t') || rawText.includes(';')) {
      return { kind: 'excel', sheets: parseDelimitedText(rawText, file.name) }
    }
    return {
      kind: 'unsupported',
      reason: 'Bu eski nesil ikili (.xls) tablo formatı doğrudan çözümlenemedi. Lütfen .xlsx veya .csv olarak yükleyin ya da indirerek görüntüleyin.',
    }
  }

  // 6. WORD (.docx, .doc, .rtf) & TEXT (.txt, .md, .json, .xml, .log)
  if (lowerName.endsWith('.docx') || (bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && file.type === 'doc')) {
    try {
      const blocks = await parseDocxBytes(bytes)
      if (blocks.length > 0) {
        return { kind: 'word', blocks }
      }
    } catch {
      // Fall through
    }
  }

  if (lowerName.endsWith('.rtf') || mime.includes('rtf')) {
    const raw = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
    return { kind: 'text', content: stripRtf(raw), language: 'rtf' }
  }

  if (
    /\.(txt|md|json|xml|log|ini|yaml|yml|html|css|js|ts|sql)$/i.test(lowerName) ||
    mime.startsWith('text/') ||
    mime.includes('json') ||
    mime.includes('xml')
  ) {
    const content = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
    return { kind: 'text', content, language: lowerName.split('.').pop() || 'txt' }
  }

  // Legacy .doc binary fallback: extract printable UTF-8/ASCII lines if possible
  if (lowerName.endsWith('.doc') || file.type === 'doc') {
    const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
    const printableChunks = decoded.match(/[A-Za-z0-9ÇĞİÖŞÜçğıöşü.,:;!?()\-/\s]{12,}/g)
    if (printableChunks && printableChunks.length > 0) {
      return {
        kind: 'word',
        blocks: printableChunks
          .map((c) => c.trim())
          .filter((c) => c.length > 10)
          .slice(0, 80)
          .map((text) => ({ type: 'paragraph', text })),
      }
    }
  }

  return {
    kind: 'unsupported',
    reason: 'Bu dosya formatı için uygulama içi canlı önizleme desteklenmiyor. Dosyayı sağ üstteki "İndir" butonuyla bilgisayarınıza indirebilirsiniz.',
  }
}
