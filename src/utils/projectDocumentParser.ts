import { BlueprintLayoutTemplate, RoomType, FlatStatus } from '@/services/projectStore'

export interface ParsedUnitDraft {
  unitNumber: string
  block: string
  floor: number // 0 = Zemin, 1 = 1. Kat, 2 = 2. Kat (Maks 3 kat)
  roomType: RoomType
  grossSqm: number
  netSqm: number
  price: number
  status: FlatStatus
  facade?: string
  description?: string
}

export interface ParsedProjectDocumentResult {
  fileName: string
  fileTypeLabel: string
  floorCount: 1 | 2 | 3 // 1: Zemin, 2: Zemin + 1. Kat, 3: Zemin + 1. Kat + 2. Kat
  unitsPerFloor: number
  blockCount: 1 | 2
  totalUnits: number
  defaultRoomType: RoomType
  defaultGrossSqm: number
  defaultPrice: number
  layoutTemplate: BlueprintLayoutTemplate
  extractedBlueprintDataUrl?: string
  parsedUnits: ParsedUnitDraft[]
  detectedProjectName?: string
  summary: string
  rawPreviewText: string
}

/**
 * Compress an image file or dataUrl into a lightweight JPEG data URL
 */
export function compressImageToDataUrl(source: File | Blob | string, maxDim = 1400): Promise<string> {
  return new Promise((resolve, reject) => {
    const loadImg = (url: string) => {
      const img = new Image()
      img.onerror = () => reject(new Error('Görsel okunamadı'))
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          let w = img.width || 1000
          let h = img.height || 700
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w)
              w = maxDim
            } else {
              w = Math.round((w * maxDim) / h)
              h = maxDim
            }
          }
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            resolve(url)
            return
          }
          ctx.drawImage(img, 0, 0, w, h)
          resolve(canvas.toDataURL('image/jpeg', 0.84))
        } catch {
          resolve(url)
        }
      }
      img.src = url
    }

    if (typeof source === 'string') {
      loadImg(source)
    } else {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error('Dosya okunamadı'))
      reader.onload = (ev) => loadImg(ev.target?.result as string)
      reader.readAsDataURL(source)
    }
  })
}

/**
 * Decompress raw DEFLATE bytes using browser's native DecompressionStream
 */
async function inflateRawBytes(compressed: Uint8Array, format: 'deflate-raw' | 'deflate' = 'deflate-raw'): Promise<Uint8Array | null> {
  try {
    if (typeof DecompressionStream === 'undefined') return null
    const ds = new DecompressionStream(format)
    const writer = ds.writable.getWriter()
    writer.write(compressed as unknown as BufferSource)
    writer.close()
    const reader = ds.readable.getReader()
    const chunks: Uint8Array[] = []
    let totalLen = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        chunks.push(value)
        totalLen += value.byteLength
      }
    }
    const out = new Uint8Array(totalLen)
    let offset = 0
    for (const c of chunks) {
      out.set(c, offset)
      offset += c.byteLength
    }
    return out
  } catch {
    return null
  }
}

/**
 * Extract XML text and embedded images from ZIP-based Office Open XML files (.docx, .xlsx, .pptx)
 */
async function extractZipOfficeContent(buffer: ArrayBuffer): Promise<{
  text: string
  embeddedImageBlob?: Blob
}> {
  const bytes = new Uint8Array(buffer)
  const view = new DataView(buffer)
  const decoder = new TextDecoder('utf-8', { fatal: false })
  const xmlParts: string[] = []
  const sharedStrings: string[] = []
  let bestImageBytes: Uint8Array | null = null
  let bestImageMime = 'image/jpeg'

  let i = 0
  while (i < bytes.length - 30) {
    // ZIP Local File Header signature: 0x04034b50 (PK\x03\x04)
    if (
      bytes[i] === 0x50 &&
      bytes[i + 1] === 0x4b &&
      bytes[i + 2] === 0x03 &&
      bytes[i + 3] === 0x04
    ) {
      const compressionMethod = view.getUint16(i + 8, true)
      const compressedSize = view.getUint32(i + 18, true)
      const fileNameLength = view.getUint16(i + 26, true)
      const extraFieldLength = view.getUint16(i + 28, true)
      const nameStart = i + 30
      const dataStart = nameStart + fileNameLength + extraFieldLength

      if (dataStart > bytes.length) break
      const entryName = decoder.decode(bytes.subarray(nameStart, nameStart + fileNameLength))

      // Determine actual end of compressed data (handle data descriptor if compressedSize === 0)
      let actualCompSize = compressedSize
      if (actualCompSize === 0 || dataStart + actualCompSize > bytes.length) {
        // Search for next PK signature
        let nextPk = dataStart
        while (nextPk < bytes.length - 4) {
          if (
            bytes[nextPk] === 0x50 &&
            bytes[nextPk + 1] === 0x4b &&
            (bytes[nextPk + 2] === 0x03 || bytes[nextPk + 2] === 0x01 || bytes[nextPk + 2] === 0x07)
          ) {
            break
          }
          nextPk++
        }
        actualCompSize = Math.max(0, nextPk - dataStart)
      }

      const rawSlice = bytes.subarray(dataStart, Math.min(bytes.length, dataStart + actualCompSize))

      const isXmlDoc =
        entryName.endsWith('.xml') &&
        (entryName.includes('word/document') ||
          entryName.includes('xl/sharedStrings') ||
          entryName.includes('xl/worksheets/sheet') ||
          entryName.includes('ppt/slides/slide') ||
          entryName.includes('ppt/notesSlides'))

      const isMediaImage =
        /\.(png|jpg|jpeg|webp)$/i.test(entryName) &&
        (entryName.includes('media/') || entryName.includes('Pictures/'))

      if (isXmlDoc || isMediaImage) {
        let contentBytes: Uint8Array | null = null
        if (compressionMethod === 0) {
          contentBytes = rawSlice
        } else if (compressionMethod === 8) {
          contentBytes = await inflateRawBytes(rawSlice, 'deflate-raw')
        }

        if (contentBytes && contentBytes.byteLength > 0) {
          if (isMediaImage) {
            // Keep the largest embedded image as potential floor plan visual
            if (!bestImageBytes || contentBytes.byteLength > bestImageBytes.byteLength) {
              bestImageBytes = contentBytes
              bestImageMime = entryName.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
            }
          } else if (isXmlDoc) {
            const xmlStr = decoder.decode(contentBytes)
            if (entryName.includes('xl/sharedStrings')) {
              const matches = xmlStr.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || []
              for (const m of matches) {
                const clean = m.replace(/<[^>]+>/g, '').trim()
                if (clean) sharedStrings.push(clean)
              }
            } else {
              // Convert row/paragraph tags to newlines and strip XML tags
              const readable = xmlStr
                .replace(/<\/(w:p|w:tr|row|a:p)>/g, '\n')
                .replace(/<\/(w:tc|c|a:tc)>/g, ' | ')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
              xmlParts.push(readable)
            }
          }
        }
      }

      i = dataStart + Math.max(1, actualCompSize)
    } else {
      i++
    }
  }

  const combinedText = [...sharedStrings, ...xmlParts].join('\n').trim()
  const embeddedImageBlob =
    bestImageBytes && bestImageBytes.byteLength > 2048
      ? new Blob([bestImageBytes as unknown as BlobPart], { type: bestImageMime })
      : undefined

  return { text: combinedText, embeddedImageBlob }
}

/**
 * Extract text & embedded JPEG image from a PDF ArrayBuffer
 */
async function extractPdfContent(buffer: ArrayBuffer): Promise<{
  text: string
  embeddedImageBlob?: Blob
}> {
  const bytes = new Uint8Array(buffer)
  const latinDecoder = new TextDecoder('iso-8859-9', { fatal: false })
  const utf8Decoder = new TextDecoder('utf-8', { fatal: false })
  const rawStr = latinDecoder.decode(bytes)

  const extractedChunks: string[] = []

  // 1. Decompress FlateDecode streams if possible
  const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g
  let match: RegExpExecArray | null
  let streamCount = 0
  while ((match = streamRegex.exec(rawStr)) !== null && streamCount < 60) {
    streamCount++
    const startOffset = match.index + match[0].indexOf(match[1])
    const len = match[1].length
    if (len > 10 && len < 500000) {
      const slice = bytes.subarray(startOffset, startOffset + len)
      const inflated =
        (await inflateRawBytes(slice, 'deflate')) ||
        (await inflateRawBytes(slice, 'deflate-raw'))
      if (inflated && inflated.byteLength > 0) {
        const decoded = utf8Decoder.decode(inflated)
        // Extract PDF text literals (...) inside BT..ET or general text
        const literals = decoded.match(/\(([^()]{2,120})\)/g) || []
        if (literals.length > 0) {
          extractedChunks.push(
            literals
              .map((l) => l.slice(1, -1).replace(/\\[nrt]/g, ' '))
              .join(' ')
          )
        }
      }
    }
  }

  // 2. Also collect readable parenthesized literals and plain lines from raw PDF
  const rawLiterals = rawStr.match(/\(([^()\\]{3,100})\)/g) || []
  if (rawLiterals.length > 0) {
    extractedChunks.push(rawLiterals.slice(0, 300).map((s) => s.slice(1, -1)).join(' '))
  }

  // 3. Look for embedded JPEG (0xFF 0xD8 0xFF ... 0xFF 0xD9) inside PDF for floor plan preview
  let bestJpeg: Uint8Array | null = null
  for (let idx = 0; idx < bytes.length - 4; idx++) {
    if (bytes[idx] === 0xff && bytes[idx + 1] === 0xd8 && bytes[idx + 2] === 0xff) {
      // Find JPEG EOI (0xFF 0xD9)
      for (let end = idx + 2048; end < Math.min(bytes.length - 1, idx + 2500000); end++) {
        if (bytes[end] === 0xff && bytes[end + 1] === 0xd9) {
          const candidate = bytes.subarray(idx, end + 2)
          if (!bestJpeg || candidate.byteLength > bestJpeg.byteLength) {
            bestJpeg = candidate
          }
          idx = end + 1
          break
        }
      }
    }
  }

  return {
    text: extractedChunks.join('\n').trim(),
    embeddedImageBlob:
      bestJpeg && bestJpeg.byteLength > 4096
        ? new Blob([bestJpeg as unknown as BlobPart], { type: 'image/jpeg' })
        : undefined,
  }
}

/**
 * Normalize any floor value or label to strictly 0 (Zemin), 1 (1. Kat), or 2 (2. Kat)
 */
export function clampFloorToMaxThree(rawFloor: number | string | undefined, fallbackIndex = 0): 0 | 1 | 2 {
  if (typeof rawFloor === 'string') {
    const lower = rawFloor.toLowerCase().trim()
    if (lower.includes('zemin') || lower.includes('giriş') || lower.includes('bahçe') || lower === '0' || lower === 'z') {
      return 0
    }
    if (lower.includes('1') || lower.includes('birinci')) return 1
    if (lower.includes('2') || lower.includes('ikinci') || lower.includes('çatı') || lower.includes('teras')) return 2
    const parsed = parseInt(lower.replace(/[^\d-]/g, ''), 10)
    if (!isNaN(parsed)) {
      if (parsed <= 0) return 0
      if (parsed === 1) return 1
      return 2
    }
  }
  if (typeof rawFloor === 'number' && !isNaN(rawFloor)) {
    if (rawFloor <= 0) return 0
    if (rawFloor === 1) return 1
    return 2
  }
  return (fallbackIndex % 3) as 0 | 1 | 2
}

/**
 * Parse extracted text & filename to auto-detect floorCount (max 3), unitsPerFloor, room types, and unit list
 */
export function analyzeDocumentTextForKroki(
  rawText: string,
  fileName: string,
  fileTypeLabel: string
): Omit<ParsedProjectDocumentResult, 'extractedBlueprintDataUrl'> {
  const cleanFileName = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim()
  const combined = `${cleanFileName}\n${rawText}`
  const lower = combined.toLowerCase()

  // 1. Detect Floor Count (Strictly max 3: 1 = Zemin, 2 = Zemin + 1. Kat, 3 = Zemin + 1. + 2. Kat)
  let floorCount: 1 | 2 | 3 = 3
  const hasSecondFloor =
    /2\s*\.\s*kat|ikinci\s*kat|3\s*kat|üç\s*kat|dubleks|çatı|penthouse/i.test(combined)
  const hasFirstFloor =
    /1\s*\.\s*kat|birinci\s*kat|2\s*kat|iki\s*kat/i.test(combined)
  const onlyGroundFloor =
    /tek\s*kat|sadece\s*zemin|müstakil\s*tek/i.test(combined)

  if (onlyGroundFloor) {
    floorCount = 1
  } else if (hasSecondFloor) {
    floorCount = 3
  } else if (hasFirstFloor && !hasSecondFloor) {
    floorCount = 2
  } else {
    floorCount = 3
  }

  // 2. Detect Room Type
  let defaultRoomType: RoomType = '2+1'
  if (lower.includes('villa')) defaultRoomType = 'Villa'
  else if (lower.includes('penthouse')) defaultRoomType = 'Penthouse'
  else if (lower.includes('ticari') || lower.includes('dükkan') || lower.includes('ofis')) defaultRoomType = 'Ticari'
  else if (lower.includes('4+1')) defaultRoomType = '4+1'
  else if (lower.includes('3+1')) defaultRoomType = '3+1'
  else if (lower.includes('1+1')) defaultRoomType = '1+1'
  else if (lower.includes('2+1')) defaultRoomType = '2+1'

  // 3. Detect Layout Template
  let layoutTemplate: BlueprintLayoutTemplate = 'quad'
  if (defaultRoomType === 'Villa' || lower.includes('villa') || lower.includes('parsel') || lower.includes('müstakil')) {
    layoutTemplate = 'villa'
  } else if (lower.includes('koridor') || lower.includes('uzun')) {
    layoutTemplate = 'corridor'
  } else if (lower.includes('kanat') || lower.includes('panoramik') || lower.includes('l tipi')) {
    layoutTemplate = 'wing'
  } else {
    layoutTemplate = 'quad'
  }

  // 4. Detect Block Count (1 or 2)
  const hasBBlock = /b\s*blok|2\s*blok|iki\s*blok/i.test(combined)
  const blockCount: 1 | 2 = hasBBlock ? 2 : 1

  // 5. Try to parse explicit unit rows from tables/lines (Excel, Word tables, CSV, PDF lists)
  const lines = rawText
    .split(/[\r\n]+/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 4)

  const parsedUnits: ParsedUnitDraft[] = []
  const roomRegex = /\b(1\+1|2\+1|3\+1|4\+1|villa|penthouse|ticari|dükkan)\b/i
  const sqmRegex = /\b(\d{2,3})\s*(?:m2|m²|brüt|net)\b/i
  const priceRegex = /\b(\d{1,3}(?:[.,]\d{3}){1,3}|\d{6,9})\s*(?:tl|₺|lira)?\b/i

  for (let idx = 0; idx < lines.length && parsedUnits.length < 36; idx++) {
    const line = lines[idx]
    const rmMatch = line.match(roomRegex)
    if (!rmMatch) continue

    const rawRoom = rmMatch[1].toLowerCase()
    const roomType: RoomType =
      rawRoom === '1+1'
        ? '1+1'
        : rawRoom === '2+1'
        ? '2+1'
        : rawRoom === '3+1'
        ? '3+1'
        : rawRoom === '4+1'
        ? '4+1'
        : rawRoom === 'villa'
        ? 'Villa'
        : rawRoom === 'penthouse'
        ? 'Penthouse'
        : 'Ticari'

    const sqmMatch = line.match(sqmRegex)
    const defaultSqmForRoom =
      roomType === '1+1' ? 68 : roomType === '2+1' ? 98 : roomType === '3+1' ? 138 : roomType === '4+1' ? 185 : 220
    const grossSqm = sqmMatch ? Math.max(40, Math.min(500, parseInt(sqmMatch[1], 10))) : defaultSqmForRoom
    const netSqm = Math.round(grossSqm * 0.8)

    let price = 0
    const prMatch = line.match(priceRegex)
    if (prMatch) {
      const numeric = parseInt(prMatch[1].replace(/[.,]/g, ''), 10)
      if (!isNaN(numeric) && numeric >= 250000) {
        price = numeric
      }
    }

    const fl = clampFloorToMaxThree(line, parsedUnits.length % floorCount)
    const blk = /b\s*blok/i.test(line) ? 'B Blok' : 'A Blok'
    const status: FlatStatus = /satıldı|satildi/i.test(line)
      ? 'SATILDI'
      : /rezerve|opsiyon/i.test(line)
      ? 'REZERVE'
      : 'SATISTA'

    const facadeMatch = line.match(/\b(güney|kuzey|doğu|batı|deniz|peyzaj|havuz|ön cephe|köşe)\b/i)

    parsedUnits.push({
      unitNumber: `D-${(parsedUnits.length + 1).toString().padStart(2, '0')}`,
      block: blk,
      floor: fl,
      roomType,
      grossSqm,
      netSqm,
      price: price || grossSqm * 46000 + fl * 65000,
      status,
      facade: facadeMatch ? facadeMatch[1] : fl === 0 ? 'Bahçe / Peyzaj Cephe' : 'Güney / Ön Cephe',
    })
  }

  // 6. Determine unitsPerFloor and totalUnits
  let unitsPerFloor = 4
  if (parsedUnits.length > 0) {
    unitsPerFloor = Math.max(1, Math.min(8, Math.ceil(parsedUnits.length / (floorCount * blockCount))))
  } else {
    const unitCountMatch = combined.match(/(\d{1,2})\s*(?:daire|bağımsız|ünite|konut|villa)/i)
    if (unitCountMatch) {
      const total = Math.max(2, Math.min(24, parseInt(unitCountMatch[1], 10)))
      unitsPerFloor = Math.max(1, Math.min(8, Math.ceil(total / (floorCount * blockCount))))
    } else if (layoutTemplate === 'villa') {
      unitsPerFloor = 2
    } else {
      unitsPerFloor = 4
    }
  }

  const totalUnits =
    parsedUnits.length > 0 ? parsedUnits.length : floorCount * unitsPerFloor * blockCount

  const defaultGrossSqm =
    defaultRoomType === '1+1'
      ? 68
      : defaultRoomType === '2+1'
      ? 100
      : defaultRoomType === '3+1'
      ? 142
      : defaultRoomType === '4+1'
      ? 185
      : 225

  const defaultPrice = defaultGrossSqm * 46000

  const floorNames =
    floorCount === 1
      ? 'Sadece Zemin Kat'
      : floorCount === 2
      ? 'Zemin + 1. Kat (2 Kat)'
      : 'Zemin + 1. Kat + 2. Kat (3 Kat)'

  const summary = `${fileTypeLabel} analiz edildi: ${floorNames}, kat başına ${unitsPerFloor} daire (${totalUnits} bağımsız bölüm), ağırlıklı ${defaultRoomType} mimari kroki otomatik oluşturuldu.`

  return {
    fileName,
    fileTypeLabel,
    floorCount,
    unitsPerFloor,
    blockCount,
    totalUnits,
    defaultRoomType,
    defaultGrossSqm,
    defaultPrice,
    layoutTemplate,
    parsedUnits,
    detectedProjectName: cleanFileName.length >= 3 ? cleanFileName : undefined,
    summary,
    rawPreviewText: rawText.slice(0, 400),
  }
}

/**
 * Main entry point: Read any uploaded file (Word, PDF, PPTX, Excel, CSV, TXT, or Image)
 * and return automatic Kroki Plan settings + extracted units.
 */
export async function parseProjectDocumentFile(file: File): Promise<ParsedProjectDocumentResult> {
  const ext = (file.name.split('.').pop() || '').toLowerCase()

  // 1. Image files (.png, .jpg, .jpeg, .webp, .svg, .gif)
  if (file.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].includes(ext)) {
    const dataUrl = await compressImageToDataUrl(file)
    const base = analyzeDocumentTextForKroki(file.name, file.name, 'Görsel Kat Planı')
    return {
      ...base,
      extractedBlueprintDataUrl: dataUrl,
    }
  }

  const buffer = await file.arrayBuffer()
  let extractedText = ''
  let embeddedImageUrl: string | undefined

  // 2. Office Open XML files (.docx, .xlsx, .pptx)
  if (['docx', 'xlsx', 'pptx'].includes(ext)) {
    const label =
      ext === 'docx'
        ? 'Word Belgesi (.docx)'
        : ext === 'xlsx'
        ? 'Excel Tablosu (.xlsx)'
        : 'PowerPoint Sunumu (.pptx)'

    const { text, embeddedImageBlob } = await extractZipOfficeContent(buffer)
    extractedText = text
    if (embeddedImageBlob) {
      try {
        embeddedImageUrl = await compressImageToDataUrl(embeddedImageBlob)
      } catch {}
    }

    const analyzed = analyzeDocumentTextForKroki(extractedText, file.name, label)
    return {
      ...analyzed,
      extractedBlueprintDataUrl: embeddedImageUrl,
    }
  }

  // 3. PDF files (.pdf)
  if (ext === 'pdf' || file.type === 'application/pdf') {
    const { text, embeddedImageBlob } = await extractPdfContent(buffer)
    extractedText = text
    if (embeddedImageBlob) {
      try {
        embeddedImageUrl = await compressImageToDataUrl(embeddedImageBlob)
      } catch {}
    }
    const analyzed = analyzeDocumentTextForKroki(extractedText, file.name, 'PDF Belgesi (.pdf)')
    return {
      ...analyzed,
      extractedBlueprintDataUrl: embeddedImageUrl,
    }
  }

  // 4. Legacy Office / CSV / Text files (.doc, .xls, .ppt, .csv, .txt)
  const label =
    ext === 'doc'
      ? 'Word Belgesi (.doc)'
      : ext === 'xls' || ext === 'csv'
      ? `Excel / Tablo (.${ext})`
      : ext === 'ppt'
      ? 'PowerPoint Sunumu (.ppt)'
      : `Belge (.${ext || 'txt'})`

  const utf8Text = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(buffer))
  // Filter printable characters for legacy binary .doc/.xls/.ppt
  const printableText = utf8Text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]+/g, ' ')
    .replace(/\s+/g, ' ')

  const analyzed = analyzeDocumentTextForKroki(printableText, file.name, label)
  return {
    ...analyzed,
    extractedBlueprintDataUrl: undefined,
  }
}
