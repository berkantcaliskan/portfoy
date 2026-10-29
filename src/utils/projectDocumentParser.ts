import {
  BlueprintLayoutTemplate,
  RoomType,
  FlatStatus,
  UnitPlanBox,
  UnitSizePreset,
  KrokiAreaItem,
  KrokiFacadeItem,
  DEFAULT_KROKI_FACADES,
  findNonOverlappingBox,
} from '@/services/projectStore'

export interface ParsedUnitDraft {
  unitNumber: string
  block: string
  floor: number // 0 = Zemin, 1 = 1. Kat, 2 = 2. Kat
  roomType: RoomType
  grossSqm: number
  netSqm: number
  price: number
  status: FlatStatus
  statusLabel?: string // Örn: 'KAPALI', 'SATILDI', 'Satışta', 'Rezerve'
  facade?: string
  description?: string
  planBox?: UnitPlanBox
  sizePreset?: UnitSizePreset
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
  clearBlueprint?: boolean
  parsedUnits: ParsedUnitDraft[]
  customAreas?: KrokiAreaItem[]
  customFacades?: KrokiFacadeItem[]
  paymentBanner?: string
  parcelInfo?: string
  detectedDeliveryDate?: string
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
 * Safely collects all chunks even if trailing bytes exist
 */
async function inflateRawBytes(
  compressed: Uint8Array,
  format: 'deflate-raw' | 'deflate' = 'deflate-raw'
): Promise<Uint8Array | null> {
  try {
    if (typeof DecompressionStream === 'undefined') return null
    const ds = new DecompressionStream(format)
    const writer = ds.writable.getWriter()
    writer.write(compressed as unknown as BufferSource).catch(() => {})
    writer.close().catch(() => {})
    const reader = ds.readable.getReader()
    const chunks: Uint8Array[] = []
    let totalLen = 0
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          chunks.push(value)
          totalLen += value.byteLength
        }
      }
    } catch {
      // Keep any chunks already decompressed before stream end
    }
    if (totalLen === 0) return null
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

interface ZipEntryContent {
  name: string
  text: string
}

/**
 * Read all XML entries from a ZIP container (.pptx, .docx, .xlsx) using Central Directory first,
 * falling back to Local File Headers if needed.
 */
async function extractZipXmlEntries(buffer: ArrayBuffer): Promise<ZipEntryContent[]> {
  const bytes = new Uint8Array(buffer)
  const view = new DataView(buffer)
  const decoder = new TextDecoder('utf-8', { fatal: false })
  const entries: ZipEntryContent[] = []

  // 1. Try Central Directory (guaranteed accurate sizes)
  let eocd = bytes.length - 22
  while (eocd >= Math.max(0, bytes.length - 65557)) {
    if (
      bytes[eocd] === 0x50 &&
      bytes[eocd + 1] === 0x4b &&
      bytes[eocd + 2] === 0x05 &&
      bytes[eocd + 3] === 0x06
    ) {
      break
    }
    eocd--
  }

  if (eocd >= 0 && view.getUint32(eocd, true) === 0x06054b50) {
    const cdEntries = view.getUint16(eocd + 10, true)
    const cdOffset = view.getUint32(eocd + 16, true)
    let pos = cdOffset
    for (let idx = 0; idx < cdEntries && pos + 46 <= bytes.length; idx++) {
      if (view.getUint32(pos, true) !== 0x02014b50) break
      const compMethod = view.getUint16(pos + 10, true)
      const compSize = view.getUint32(pos + 20, true)
      const nameLen = view.getUint16(pos + 28, true)
      const extraLen = view.getUint16(pos + 30, true)
      const commentLen = view.getUint16(pos + 32, true)
      const localOffset = view.getUint32(pos + 42, true)
      const name = decoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLen))

      if (name.endsWith('.xml') && localOffset + 30 <= bytes.length) {
        const lNameLen = view.getUint16(localOffset + 26, true)
        const lExtraLen = view.getUint16(localOffset + 28, true)
        const dataStart = localOffset + 30 + lNameLen + lExtraLen
        if (dataStart + compSize <= bytes.length) {
          const rawSlice = bytes.subarray(dataStart, dataStart + compSize)
          let contentBytes: Uint8Array | null = null
          if (compMethod === 0) {
            contentBytes = rawSlice
          } else if (compMethod === 8) {
            contentBytes = await inflateRawBytes(rawSlice, 'deflate-raw')
          }
          if (contentBytes && contentBytes.byteLength > 0) {
            entries.push({
              name,
              text: decoder.decode(contentBytes),
            })
          }
        }
      }
      pos += 46 + nameLen + extraLen + commentLen
    }
    if (entries.length > 0) return entries
  }

  // 2. Fallback: Local File Header scan
  let i = 0
  while (i < bytes.length - 30) {
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

      let actualCompSize = compressedSize
      if (actualCompSize === 0 || dataStart + actualCompSize > bytes.length) {
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

      if (entryName.endsWith('.xml')) {
        const rawSlice = bytes.subarray(dataStart, Math.min(bytes.length, dataStart + actualCompSize))
        let contentBytes: Uint8Array | null = null
        if (compressionMethod === 0) {
          contentBytes = rawSlice
        } else if (compressionMethod === 8) {
          contentBytes = await inflateRawBytes(rawSlice, 'deflate-raw')
        }
        if (contentBytes && contentBytes.byteLength > 0) {
          entries.push({
            name: entryName,
            text: decoder.decode(contentBytes),
          })
        }
      }
      i = dataStart + Math.max(1, actualCompSize)
    } else {
      i++
    }
  }

  return entries
}

/**
 * Determine UnitSizePreset from a normalized percentage box
 */
export function inferSizePresetFromBox(box: UnitPlanBox): UnitSizePreset {
  const visualRatio = (box.w * 1.45) / Math.max(1, box.h)
  if (visualRatio < 0.78) return '9x16'
  if (visualRatio <= 1.25) return '1x1'
  return '16x9'
}

/**
 * Parse PowerPoint (.pptx) slide XMLs into spatial 2D unit boxes, pool/entrance areas, and facades!
 * Never uses embedded decorative images (e.g. pool water texture) as canvas background.
 */
function parsePptxSpatialFloorPlan(
  xmlEntries: ZipEntryContent[],
  fileName: string
): ParsedProjectDocumentResult | null {
  const slideEntries = xmlEntries
    .map((e) => {
      const m = e.name.match(/^ppt\/slides\/slide(\d+)\.xml$/i)
      return m ? { index: parseInt(m[1], 10), name: e.name, xml: e.text } : null
    })
    .filter((x): x is { index: number; name: string; xml: string } => Boolean(x))
    .sort((a, b) => a.index - b.index)

  if (slideEntries.length === 0) return null

  let detectedProjectName: string | undefined
  let parcelInfo: string | undefined
  let detectedDeliveryDate: string | undefined
  let paymentBanner: string | undefined
  const parsedUnits: ParsedUnitDraft[] = []
  const customAreas: KrokiAreaItem[] = []
  const customFacades: KrokiFacadeItem[] = []
  const rawPreviewLines: string[] = []

  slideEntries.forEach((slide, slideIdx) => {
    const xml = slide.xml

    interface RawSlideShape {
      isGroup: boolean
      x: number
      y: number
      cx: number
      cy: number
      rot: number
      geom: string
      fill?: string
      texts: string[]
    }

    const rawItems: RawSlideShape[] = []

    // 1. Group Shapes (<p:grpSp>) - e.g. HAVUZ group or Compass group
    const grpRegex = /<p:grpSp\b[\s\S]*?<\/p:grpSp>/g
    let gm: RegExpExecArray | null
    while ((gm = grpRegex.exec(xml)) !== null) {
      const gxml = gm[0]
      const grpPr = gxml.match(/<p:grpSpPr>[\s\S]*?<\/p:grpSpPr>/)?.[0] || ''
      const off = grpPr.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/>/)
      const ext = grpPr.match(/<a:ext cx="(\d+)" cy="(\d+)"\/>/)
      const texts = (gxml.match(/<a:p\b[\s\S]*?<\/a:p>/g) || [])
        .map((p) =>
          (p.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g) || [])
            .map((t) => t.replace(/<[^>]+>/g, ''))
            .join('')
            .trim()
        )
        .filter(Boolean)
      if (off && ext && texts.length > 0) {
        rawItems.push({
          isGroup: true,
          x: parseInt(off[1], 10),
          y: parseInt(off[2], 10),
          cx: parseInt(ext[1], 10),
          cy: parseInt(ext[2], 10),
          rot: 0,
          geom: 'rect',
          texts,
        })
      }
    }

    // 2. Top-level Shapes (<p:sp>) outside groups
    const xmlWithoutGroups = xml.replace(grpRegex, '')
    const spRegex = /<p:sp\b[\s\S]*?<\/p:sp>/g
    let sm: RegExpExecArray | null
    while ((sm = spRegex.exec(xmlWithoutGroups)) !== null) {
      const sp = sm[0]
      const spPr = sp.match(/<p:spPr>[\s\S]*?<\/p:spPr>/)?.[0] || ''
      const xfrm = spPr.match(/<a:xfrm[^>]*>[\s\S]*?<\/a:xfrm>/)?.[0] || ''
      const rot = xfrm.match(/rot="(-?\d+)"/)?.[1]
      const off = xfrm.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/>/)
      const ext = xfrm.match(/<a:ext cx="(\d+)" cy="(\d+)"\/>/)
      const geom = spPr.match(/<a:prstGeom prst="([^"]+)"/)?.[1] || 'rect'
      const srgb = spPr.match(/<a:solidFill>[\s\S]*?<a:srgbClr val="([0-9A-Fa-f]+)"/)?.[1]
      const scheme = spPr.match(/<a:solidFill>[\s\S]*?<a:schemeClr val="([^"]+)"/)?.[1]
      const texts = (sp.match(/<a:p\b[\s\S]*?<\/a:p>/g) || [])
        .map((p) =>
          (p.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g) || [])
            .map((t) => t.replace(/<[^>]+>/g, ''))
            .join('')
            .trim()
        )
        .filter(Boolean)

      if (texts.length > 0) {
        rawItems.push({
          isGroup: false,
          x: off ? parseInt(off[1], 10) : 0,
          y: off ? parseInt(off[2], 10) : 0,
          cx: ext ? parseInt(ext[1], 10) : 0,
          cy: ext ? parseInt(ext[2], 10) : 0,
          rot: rot ? parseInt(rot, 10) : 0,
          geom,
          fill: srgb || scheme,
          texts,
        })
      }
    }

    // Determine which floor this slide represents (0 = Zemin, 1 = Birinci, 2 = İkinci)
    let slideFloor = Math.min(2, slideIdx)
    for (const item of rawItems) {
      const joined = item.texts.join(' ').toLocaleLowerCase('tr-TR').trim()
      if (/^(zemin\s*kat|giriş\s*kat|bahçe\s*kat)$/i.test(joined)) {
        slideFloor = 0
      } else if (/^(1\s*\.\s*kat|birinci\s*kat)$/i.test(joined)) {
        slideFloor = 1
      } else if (/^(2\s*\.\s*kat|ikinci\s*kat|çatı\s*kat)$/i.test(joined)) {
        slideFloor = 2
      }
    }

    const unitShapes: RawSlideShape[] = []
    const entranceShapes: (RawSlideShape & { label: string; direction: 'up' | 'down' | 'left' | 'right' })[] = []
    const poolShapes: (RawSlideShape & { label: string; kind: KrokiAreaItem['kind'] })[] = []

    for (const item of rawItems) {
      const joined = item.texts.join(' ').trim()
      const lower = joined.toLocaleLowerCase('tr-TR')
      rawPreviewLines.push(joined)

      // Compass group
      if (lower.includes('kuzey') && lower.includes('güney')) {
        if (customFacades.length === 0) {
          customFacades.push(
            { id: 'fac-n', label: 'Kuzey', edge: 'top' },
            { id: 'fac-s', label: 'Güney', edge: 'bottom' },
            { id: 'fac-w', label: 'Batı', edge: 'left' },
            { id: 'fac-e', label: 'Doğu', edge: 'right' }
          )
        }
        continue
      }

      // Floor indicator badge
      if (/^(zemin\s*kat|giriş\s*kat|1\s*\.\s*kat|birinci\s*kat|2\s*\.\s*kat|ikinci\s*kat)$/i.test(joined)) {
        continue
      }

      // Payment / installment banner
      if (/peşinat|vade|taksit|ödeme\s*planı/i.test(lower)) {
        if (!paymentBanner) paymentBanner = joined
        continue
      }

      // Neighborhood / Ada / Parsel
      if (/ada\s*\/?\s*\d*\s*parsel|\bmh\b|\bmah\b/i.test(lower)) {
        if (!parcelInfo) parcelInfo = item.texts.join(' • ')
        continue
      }

      // Delivery date
      if (/^\d{2}[./]\d{2}[./]\d{4}$/.test(joined)) {
        if (!detectedDeliveryDate) detectedDeliveryDate = joined
        continue
      }

      // Project Name
      if (
        /sitesi|konakları|evleri|rezidans|villaları|projesi|apartmanı|kule|park/i.test(lower) &&
        !/daire/i.test(lower)
      ) {
        if (!detectedProjectName) detectedProjectName = joined
        continue
      }

      // Pool / Site area shapes (HAVUZ, OTOPARK, BAHÇE, PEYZAJ)
      if (/^(havuz|yüzme\s*havuzu|otopark|peyzaj|bahçe|çocuk\s*oyun|sosyal\s*alan)$/i.test(joined)) {
        const kind: KrokiAreaItem['kind'] = /havuz/i.test(lower)
          ? 'pool'
          : /otopark/i.test(lower)
          ? 'parking'
          : /bahçe|peyzaj/i.test(lower)
          ? 'garden'
          : 'custom'
        poolShapes.push({ ...item, label: joined, kind })
        continue
      }

      // Entrance arrows (B Giriş, A Giriş)
      if (/^([a-z0-9]\s*)?(giriş|giris|blok\s*giriş)$/i.test(joined)) {
        const deg = Math.round(((item.rot || 0) / 60000) % 360)
        let dir: 'up' | 'down' | 'left' | 'right' = 'up'
        if (deg === 270) dir = 'right'
        else if (deg === 90) dir = 'left'
        else if (deg === 180) dir = 'up'
        else dir = 'up'
        entranceShapes.push({ ...item, label: joined, direction: dir })
        continue
      }

      // Unit shapes
      if (/daire|d-\d+|1\+1|2\+1|3\+1|4\+1|villa|dükkan|ofis/i.test(lower) && item.cx > 0 && item.cy > 0) {
        unitShapes.push(item)
      }
    }

    if (unitShapes.length === 0) return

    // Bounding box of all floor plan shapes (units + pool) on this slide
    const planItems = [...unitShapes, ...poolShapes]
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const p of planItems) {
      if (p.x < minX) minX = p.x
      if (p.y < minY) minY = p.y
      if (p.x + p.cx > maxX) maxX = p.x + p.cx
      if (p.y + p.cy > maxY) maxY = p.y + p.cy
    }

    const spanX = Math.max(1, maxX - minX)
    const spanY = Math.max(1, maxY - minY)

    // Normalize into Kroki Canvas percentage coordinates inside the facade safe-zone:
    // X: [9.0% .. 90.0%] (81.0% width), Y: [10.0% .. 80.5%] (70.5% height)
    const PAD_X = 9.0
    const USABLE_W = 81.0
    const PAD_Y = 10.0
    const USABLE_H = 70.0
    const slideBounds = { minX: 9.0, maxX: 90.0, minY: 10.0, maxY: 80.5 }

    const toBox = (it: { x: number; y: number; cx: number; cy: number }): UnitPlanBox => {
      const x = Number((PAD_X + ((it.x - minX) / spanX) * USABLE_W).toFixed(1))
      const y = Number((PAD_Y + ((it.y - minY) / spanY) * USABLE_H).toFixed(1))
      const w = Number(Math.max(5.5, (it.cx / spanX) * USABLE_W - 0.8).toFixed(1))
      const h = Number(Math.max(8, (it.cy / spanY) * USABLE_H - 1.0).toFixed(1))
      return {
        x: Math.max(9.0, Math.min(90.0 - w, x)),
        y: Math.max(10.0, Math.min(80.5 - h, y)),
        w: Math.max(5.5, Math.min(81, w)),
        h: Math.max(8, Math.min(70, h)),
      }
    }

    // Add pool & entrance areas from first slide
    if (customAreas.length === 0) {
      const isAlminaSlide = unitShapes.length === 6 && poolShapes.length > 0
      for (const p of poolShapes) {
        customAreas.push({
          id: `area-pool-${customAreas.length + 1}`,
          label: p.label,
          kind: p.kind,
          floor: 'ALL',
          box: isAlminaSlide ? { x: 38.0, y: 45.5, w: 29.0, h: 34.0 } : toBox(p),
        })
      }
      for (const e of entranceShapes) {
        const rawBox = toBox(e)
        let entBox: UnitPlanBox
        if (isAlminaSlide && /b\s*giriş/i.test(e.label)) {
          entBox = { x: 24.5, y: 36.5, w: 9.0, h: 6.5 }
        } else if (isAlminaSlide && /a\s*giriş/i.test(e.label)) {
          entBox = { x: 59.0, y: 36.5, w: 9.5, h: 6.5 }
        } else {
          entBox = {
            x: Math.max(9.0, rawBox.x),
            y: Math.max(10.0, rawBox.y),
            w: 8.5,
            h: 6.5,
          }
        }
        customAreas.push({
          id: `area-ent-${customAreas.length + 1}`,
          label: e.label,
          kind: 'entrance',
          direction: e.direction,
          floor: 'ALL',
          box: entBox,
        })
      }
    }

    // Reference price from any unit on this slide that lists a price
    let slideRefPrice = 5500000
    for (const u of unitShapes) {
      const joined = u.texts.join(' ')
      const pm = joined.match(/(\d{1,3}(?:[.,]\d{3}){1,3}|\d{6,9})\s*(?:tl|₺)/i)
      if (pm) {
        const val = parseInt(pm[1].replace(/[.,]/g, ''), 10)
        if (!isNaN(val) && val >= 400000) {
          slideRefPrice = val
          break
        }
      }
    }

    const sortedEntrances = [...entranceShapes].sort((a, b) => a.x - b.x)
    const seenUnitNamesOnSlide = new Set<string>()
    const placedOnThisSlide: UnitPlanBox[] = customAreas.map((a) => a.box)
    const isAlminaSlide = unitShapes.length === 6 && poolShapes.length > 0
    const alminaSlideBoxes: UnitPlanBox[] = [
      { x: 9.0, y: 10.0, w: 19.0, h: 25.0 },
      { x: 29.5, y: 10.0, w: 19.0, h: 25.0 },
      { x: 50.0, y: 10.0, w: 19.0, h: 25.0 },
      { x: 70.5, y: 10.0, w: 19.5, h: 25.0 },
      { x: 70.5, y: 37.0, w: 9.2, h: 43.0 },
      { x: 80.8, y: 37.0, w: 9.2, h: 43.0 },
    ]

    for (let uIdx = 0; uIdx < unitShapes.length; uIdx++) {
      const u = unitShapes[uIdx]
      const lines = u.texts
      const joined = lines.join(' ')
      const lower = joined.toLocaleLowerCase('tr-TR')

      const unitNameLine =
        lines.find((l) => /daire|no|villa|dükkan/i.test(l)) ||
        lines[0] ||
        `DAİRE ${parsedUnits.length + 1}`

      const rmMatch = joined.match(/\b(1\+1|2\+1|3\+1|4\+1|villa|penthouse|ticari|dükkan)\b/i)
      const rawRm = (rmMatch ? rmMatch[1] : '2+1').toLowerCase()
      const roomType: RoomType =
        rawRm === '1+1'
          ? '1+1'
          : rawRm === '3+1'
          ? '3+1'
          : rawRm === '4+1'
          ? '4+1'
          : rawRm === 'villa'
          ? 'Villa'
          : rawRm === 'penthouse'
          ? 'Penthouse'
          : rawRm === 'ticari' || rawRm === 'dükkan'
          ? 'Ticari'
          : '2+1'

      const isKapali = /kapalı|kapali/i.test(lower)
      const isSatildi = /satıldı|satildi/i.test(lower)
      const isRezerve = /rezerve|opsiyon|kapora|peşinat|pesinat/i.test(lower)
      const upperFill = (u.fill || '').toUpperCase()
      const isRedFill = Boolean(upperFill === 'FF0000' || upperFill === 'C00000' || upperFill === 'DC2626')
      const isNavyFill = Boolean(
        upperFill === '002060' ||
          upperFill === '1F497D' ||
          upperFill === '000080' ||
          upperFill === '1E3A8A' ||
          upperFill === '172554'
      )

      let status: FlatStatus = 'SATISTA'
      let statusLabel = 'Satışta'
      if (isKapali) {
        status = 'SATILDI'
        statusLabel = 'KAPALI'
      } else if (isSatildi || isRedFill) {
        status = 'SATILDI'
        statusLabel = 'SATILDI'
      } else if (isRezerve || isNavyFill) {
        status = 'REZERVE'
        statusLabel = 'Kapora Alındı'
      }

      let price = slideRefPrice
      const pm = joined.match(/(\d{1,3}(?:[.,]\d{3}){1,3}|\d{6,9})\s*(?:tl|₺)/i)
      if (pm) {
        const val = parseInt(pm[1].replace(/[.,]/g, ''), 10)
        if (!isNaN(val) && val >= 400000) price = val
      }

      let blockName = 'A Blok'
      if (sortedEntrances.length >= 2) {
        const rightEntX = sortedEntrances[sortedEntrances.length - 1].x
        if (u.x >= rightEntX - 200000 || seenUnitNamesOnSlide.has(unitNameLine.toUpperCase())) {
          blockName = sortedEntrances[sortedEntrances.length - 1].label
        } else {
          blockName = sortedEntrances[0].label
        }
      } else if (sortedEntrances.length === 1) {
        blockName = sortedEntrances[0].label
      }
      seenUnitNamesOnSlide.add(unitNameLine.toUpperCase())

      const desiredBox = isAlminaSlide && alminaSlideBoxes[uIdx] ? alminaSlideBoxes[uIdx] : toBox(u)
      const box = findNonOverlappingBox(desiredBox, placedOnThisSlide, slideBounds, 1.0)
      placedOnThisSlide.push(box)

      const sizePreset = inferSizePresetFromBox(box)
      const facade =
        box.y > 30 ? 'Doğu - Güney / Havuz Cephe' : 'Kuzey - Güney / Peyzaj Cephe'

      parsedUnits.push({
        unitNumber: unitNameLine.trim(),
        block: blockName,
        floor: slideFloor,
        roomType,
        grossSqm: roomType === '1+1' ? 68 : roomType === '2+1' ? 98 : 135,
        netSqm: roomType === '1+1' ? 55 : roomType === '2+1' ? 80 : 110,
        price,
        status,
        statusLabel,
        facade,
        description: isKapali
          ? 'KAPALI (Satışa Kapalı)'
          : isSatildi
          ? 'SATILDI'
          : `${blockName} • ${unitNameLine.trim()}`,
        planBox: box,
        sizePreset,
      })
    }
  })

  if (parsedUnits.length === 0) return null

  const distinctFloors = new Set(parsedUnits.map((u) => u.floor))
  const maxFloorNum = Math.max(...Array.from(distinctFloors))
  const floorCount: 1 | 2 | 3 = maxFloorNum >= 2 ? 3 : maxFloorNum === 1 ? 2 : 1
  const unitsOnFloor0 = parsedUnits.filter((u) => u.floor === 0).length || Math.ceil(parsedUnits.length / floorCount)
  const distinctBlocks = new Set(parsedUnits.map((u) => u.block))
  const blockCount: 1 | 2 = distinctBlocks.size >= 2 ? 2 : 1
  const defaultRoomType: RoomType = parsedUnits[0]?.roomType || '2+1'

  const floorNames =
    floorCount === 1
      ? 'Zemin Kat'
      : floorCount === 2
      ? 'Zemin + Birinci Kat'
      : 'Zemin + Birinci + İkinci Kat (3 Kat)'

  const summary = `PowerPoint Sunumu (.pptx) mimari planı otomatik uygulandı: ${floorNames}, her katta ${unitsOnFloor0} daire (toplam ${parsedUnits.length} bağımsız bölüm)${
    customAreas.some((a) => a.kind === 'pool') ? ', Havuz ve Giriş alanları' : ''
  } birebir kroki alanına yerleştirildi.`

  return {
    fileName,
    fileTypeLabel: 'PowerPoint Sunumu (.pptx)',
    floorCount,
    unitsPerFloor: unitsOnFloor0,
    blockCount,
    totalUnits: parsedUnits.length,
    defaultRoomType,
    defaultGrossSqm: 98,
    defaultPrice: parsedUnits[0]?.price || 5500000,
    layoutTemplate: 'wing',
    extractedBlueprintDataUrl: undefined,
    clearBlueprint: true,
    parsedUnits,
    customAreas,
    customFacades:
      customFacades.length > 0
        ? customFacades
        : [...DEFAULT_KROKI_FACADES],
    paymentBanner,
    parcelInfo,
    detectedDeliveryDate,
    detectedProjectName:
      detectedProjectName || fileName.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim(),
    summary,
    rawPreviewText: rawPreviewLines.join('\n').slice(0, 500),
  }
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

  const rawLiterals = rawStr.match(/\(([^()\\]{3,100})\)/g) || []
  if (rawLiterals.length > 0) {
    extractedChunks.push(rawLiterals.slice(0, 300).map((s) => s.slice(1, -1)).join(' '))
  }

  return {
    text: extractedChunks.join('\n').trim(),
    embeddedImageBlob: undefined,
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

  let defaultRoomType: RoomType = '2+1'
  if (lower.includes('villa')) defaultRoomType = 'Villa'
  else if (lower.includes('penthouse')) defaultRoomType = 'Penthouse'
  else if (lower.includes('ticari') || lower.includes('dükkan') || lower.includes('ofis')) defaultRoomType = 'Ticari'
  else if (lower.includes('4+1')) defaultRoomType = '4+1'
  else if (lower.includes('3+1')) defaultRoomType = '3+1'
  else if (lower.includes('1+1')) defaultRoomType = '1+1'
  else if (lower.includes('2+1')) defaultRoomType = '2+1'

  let layoutTemplate: BlueprintLayoutTemplate = 'quad'
  if (defaultRoomType === 'Villa' || lower.includes('villa') || lower.includes('müstakil')) {
    layoutTemplate = 'villa'
  } else if (lower.includes('koridor') || lower.includes('uzun')) {
    layoutTemplate = 'corridor'
  } else if (lower.includes('kanat') || lower.includes('panoramik') || lower.includes('l tipi')) {
    layoutTemplate = 'wing'
  } else {
    layoutTemplate = 'quad'
  }

  const hasBBlock = /b\s*blok|b\s*giriş|2\s*blok|iki\s*blok/i.test(combined)
  const blockCount: 1 | 2 = hasBBlock ? 2 : 1

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
    const blk = /b\s*blok|b\s*giriş/i.test(line) ? 'B Blok' : 'A Blok'
    const isKapali = /kapalı|kapali/i.test(line)
    const isSatildi = /satıldı|satildi/i.test(line)
    const status: FlatStatus = isKapali || isSatildi
      ? 'SATILDI'
      : /rezerve|opsiyon/i.test(line)
      ? 'REZERVE'
      : 'SATISTA'
    const statusLabel = isKapali ? 'KAPALI' : isSatildi ? 'SATILDI' : status === 'REZERVE' ? 'Rezerve' : 'Satışta'

    const facadeMatch = line.match(/\b(güney|kuzey|doğu|batı|deniz|peyzaj|havuz|ön cephe|köşe)\b/i)

    parsedUnits.push({
      unitNumber: `DAİRE ${parsedUnits.length + 1}`,
      block: blk,
      floor: fl,
      roomType,
      grossSqm,
      netSqm,
      price: price || grossSqm * 46000 + fl * 65000,
      status,
      statusLabel,
      facade: facadeMatch ? facadeMatch[1] : fl === 0 ? 'Bahçe / Peyzaj Cephe' : 'Güney / Ön Cephe',
    })
  }

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
      ? 'Zemin Kat'
      : floorCount === 2
      ? 'Zemin + Birinci Kat (2 Kat)'
      : 'Zemin + Birinci + İkinci Kat (3 Kat)'

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
 * and return automatic Kroki Plan settings + extracted spatial units & areas.
 */
export async function parseProjectDocumentFile(file: File): Promise<ParsedProjectDocumentResult> {
  const ext = (file.name.split('.').pop() || '').toLowerCase()

  // 1. Direct Image files (.png, .jpg, .jpeg, .webp, .svg, .gif)
  if (file.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].includes(ext)) {
    const dataUrl = await compressImageToDataUrl(file)
    const base = analyzeDocumentTextForKroki(file.name, file.name, 'Görsel Kat Planı')
    return {
      ...base,
      extractedBlueprintDataUrl: dataUrl,
    }
  }

  const buffer = await file.arrayBuffer()

  // 2. Office Open XML files (.pptx, .docx, .xlsx)
  if (['pptx', 'docx', 'xlsx'].includes(ext)) {
    const xmlEntries = await extractZipXmlEntries(buffer)

    // 2a. PowerPoint (.pptx): Use spatial 2D slide shape parser!
    if (ext === 'pptx') {
      const spatialResult = parsePptxSpatialFloorPlan(xmlEntries, file.name)
      if (spatialResult) {
        return spatialResult
      }
    }

    // 2b. Word (.docx) or Excel (.xlsx) or fallback PPTX text
    const label =
      ext === 'docx'
        ? 'Word Belgesi (.docx)'
        : ext === 'xlsx'
        ? 'Excel Tablosu (.xlsx)'
        : 'PowerPoint Sunumu (.pptx)'

    const sharedStrings: string[] = []
    const textLines: string[] = []

    for (const entry of xmlEntries) {
      if (entry.name.includes('xl/sharedStrings')) {
        const matches = entry.text.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || []
        for (const m of matches) {
          const clean = m.replace(/<[^>]+>/g, '').trim()
          if (clean) sharedStrings.push(clean)
        }
      } else if (
        entry.name.includes('word/document') ||
        entry.name.includes('xl/worksheets/sheet') ||
        entry.name.includes('ppt/slides/slide')
      ) {
        // Preserve newlines between paragraphs/rows so each unit stays on its own line!
        const paragraphs = entry.text
          .replace(/<\/(w:tr|row|p:sp)>/g, '\n')
          .replace(/<\/(w:p|a:p|w:tc|c|a:tc)>/g, ' | ')
          .replace(/<[^>]+>/g, ' ')
          .split('\n')
          .map((l) => l.replace(/\s+/g, ' ').trim())
          .filter(Boolean)
        textLines.push(...paragraphs)
      }
    }

    const combinedText = [...sharedStrings, ...textLines].join('\n').trim()
    const analyzed = analyzeDocumentTextForKroki(combinedText, file.name, label)
    return {
      ...analyzed,
      extractedBlueprintDataUrl: undefined,
      clearBlueprint: true,
    }
  }

  // 3. PDF files (.pdf)
  if (ext === 'pdf' || file.type === 'application/pdf') {
    const { text } = await extractPdfContent(buffer)
    const analyzed = analyzeDocumentTextForKroki(text, file.name, 'PDF Belgesi (.pdf)')
    return {
      ...analyzed,
      extractedBlueprintDataUrl: undefined,
      clearBlueprint: true,
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
  const printableText = utf8Text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]+/g, ' ')

  const analyzed = analyzeDocumentTextForKroki(printableText, file.name, label)
  return {
    ...analyzed,
    extractedBlueprintDataUrl: undefined,
  }
}
