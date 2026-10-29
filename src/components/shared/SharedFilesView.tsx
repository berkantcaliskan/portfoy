import React, { useState, useEffect, useRef } from 'react'
import {
  Cloud,
  Download,
  Trash2,
  Search,
  Check,
  FileText,
  FileSpreadsheet,
  Film,
  Image as ImageIcon,
  Archive,
  AlertCircle,
  Folder,
  Upload,
  Music,
  File as FileGenericIcon,
  X,
  ArrowUpDown,
  List,
  LayoutGrid,
  Grid,
  Eye,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Play,
} from 'lucide-react'
import { GlassButton } from '@/components/ui/GlassButton'
import { GlassModal } from '@/components/ui/GlassModal'
import {
  sharedFileStore,
  SharedFile,
  ShareTarget,
  FileCategory,
} from '@/services/sharedFileStore'
import { userStore, AppUser } from '@/services/userStore'
import { Department, CANONICAL_DEPARTMENTS } from '@/types/department'
import { formatDateOnly } from '@/utils/formatters'
import {
  buildFilePreview,
  ParsedPreviewResult,
} from '@/utils/filePreviewParser'

type FileViewMode = 'LIST' | 'LARGE' | 'SMALL'
type FileSortOrder = 'NEWEST' | 'OLDEST' | 'NAME_ASC' | 'NAME_DESC' | 'SIZE_DESC' | 'SIZE_ASC'

interface PendingUploadItem {
  id: string
  file: File
  customName: string
  sizeText: string
  detectedType: SharedFile['type']
  mimeType: string
  dataUrl: string
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB'
  const kb = bytes / 1024
  if (kb < 1024) {
    return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`
  }
  const mb = kb / 1024
  if (mb < 1024) {
    return `${mb.toFixed(1)} MB`
  }
  const gb = mb / 1024
  return `${gb.toFixed(2)} GB`
}

function parseSizeToBytes(sizeStr?: string): number {
  if (!sizeStr) return 0
  const m = sizeStr.trim().match(/^([\d.,]+)\s*(KB|MB|GB|B)/i)
  if (!m) return 0
  const num = parseFloat(m[1].replace(',', '.')) || 0
  const unit = m[2].toUpperCase()
  if (unit === 'GB') return num * 1024 * 1024 * 1024
  if (unit === 'MB') return num * 1024 * 1024
  if (unit === 'KB') return num * 1024
  return num
}

function getColumnLetter(index: number): string {
  let letter = ''
  let temp = index
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter
    temp = Math.floor(temp / 26) - 1
  }
  return letter
}

function detectSharedFileType(file: File): SharedFile['type'] {
  const name = (file.name || '').toLowerCase()
  const mime = (file.type || '').toLowerCase()

  if (mime.includes('pdf') || name.endsWith('.pdf')) return 'pdf'
  if (
    mime.includes('spreadsheet') ||
    mime.includes('excel') ||
    mime.includes('csv') ||
    /\.(xlsx|xls|csv|tsv|numbers)$/i.test(name)
  ) {
    return 'excel'
  }
  if (
    mime.startsWith('video/') ||
    /\.(mp4|mov|avi|mkv|webm|m4v|wmv)$/i.test(name)
  ) {
    return 'video'
  }
  if (
    mime.startsWith('image/') ||
    /\.(png|jpg|jpeg|webp|gif|svg|bmp|heic|tiff|psd|ai|eps)$/i.test(name)
  ) {
    return 'image'
  }
  if (
    mime.startsWith('audio/') ||
    /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(name)
  ) {
    return 'audio'
  }
  if (
    mime.includes('zip') ||
    mime.includes('compressed') ||
    mime.includes('tar') ||
    /\.(zip|rar|7z|tar|gz|bz2|dwg|dxf)$/i.test(name)
  ) {
    return 'archive'
  }
  if (
    mime.includes('word') ||
    mime.includes('presentation') ||
    mime.includes('powerpoint') ||
    mime.includes('text') ||
    /\.(doc|docx|ppt|pptx|txt|rtf|odt|pages|key|md|json|xml|log)$/i.test(name)
  ) {
    return 'doc'
  }
  return 'other'
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Dosya okunamadı'))
    reader.readAsDataURL(file)
  })
}

export const SharedFilesView: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(userStore.getCurrentUser())
  const [files, setFiles] = useState<SharedFile[]>(() => sharedFileStore.getFilesForUser(currentUser))
  const [selectedFolder, setSelectedFolder] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<FileViewMode>('LARGE')
  const [sortOrder, setSortOrder] = useState<FileSortOrder>('NEWEST')

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [downloadSuccessMessage, setDownloadSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // In-App Preview Modal State
  const [previewFile, setPreviewFile] = useState<SharedFile | null>(null)
  const [parsedPreview, setParsedPreview] = useState<ParsedPreviewResult | null>(null)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [imageZoom, setImageZoom] = useState(1)
  const [activeSheetIndex, setActiveSheetIndex] = useState(0)
  const [sheetSearchQuery, setSheetSearchQuery] = useState('')

  // Real File Upload State
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingFiles, setPendingFiles] = useState<PendingUploadItem[]>([])
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [isReadingFiles, setIsReadingFiles] = useState(false)

  const [folder, setFolder] = useState<FileCategory>('Proje Katalogları')
  const [shareTarget, setShareTarget] = useState<ShareTarget>('DEPARTMENTS')
  const [selectedDepts, setSelectedDepts] = useState<Department[]>(() => {
    const d = userStore.getCurrentUser()?.department
    return d ? [d] : ['Pazarlama']
  })
  const [canEdit, setCanEdit] = useState(false)
  const [canReshare, setCanReshare] = useState(true)

  useEffect(() => {
    const unsubFiles = sharedFileStore.subscribe(() => {
      setFiles(sharedFileStore.getFilesForUser(userStore.getCurrentUser()))
    })
    const unsubUser = userStore.subscribe(() => {
      const u = userStore.getCurrentUser()
      setCurrentUser(u)
      setFiles(sharedFileStore.getFilesForUser(u))
    })
    return () => {
      unsubFiles()
      unsubUser()
    }
  }, [])

  // Build in-app preview whenever previewFile changes
  useEffect(() => {
    let createdBlobUrl: string | null = null
    let cancelled = false

    if (!previewFile) {
      setParsedPreview(null)
      setIsPreviewLoading(false)
      setImageZoom(1)
      setActiveSheetIndex(0)
      setSheetSearchQuery('')
      return
    }

    setIsPreviewLoading(true)
    setImageZoom(1)
    setActiveSheetIndex(0)
    setSheetSearchQuery('')

    buildFilePreview(previewFile)
      .then((res) => {
        if (cancelled) return
        if (
          (res.kind === 'pdf' || res.kind === 'video' || res.kind === 'audio') &&
          res.url.startsWith('blob:')
        ) {
          createdBlobUrl = res.url
        }
        setParsedPreview(res)
      })
      .catch(() => {
        if (cancelled) return
        setParsedPreview({
          kind: 'unsupported',
          reason: 'Dosya önizlemesi oluşturulurken bir hata meydana geldi.',
        })
      })
      .finally(() => {
        if (!cancelled) setIsPreviewLoading(false)
      })

    return () => {
      cancelled = true
      if (createdBlobUrl) {
        try {
          URL.revokeObjectURL(createdBlobUrl)
        } catch {}
      }
    }
  }, [previewFile])

  const categories: FileCategory[] = [
    'Proje Katalogları',
    'Satış Sözleşmeleri',
    'Mimari Çizimler',
    'Lansman Videoları',
    'Finans & Muhasebe',
  ]

  const filteredFiles = files.filter((f) => {
    if (selectedFolder !== 'ALL' && f.folder !== selectedFolder) return false
    if (searchQuery && !f.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  const sortedFiles = [...filteredFiles].sort((a, b) => {
    if (sortOrder === 'NAME_ASC') {
      return (a.name || '').localeCompare(b.name || '', 'tr-TR')
    }
    if (sortOrder === 'NAME_DESC') {
      return (b.name || '').localeCompare(a.name || '', 'tr-TR')
    }
    if (sortOrder === 'SIZE_DESC') {
      return parseSizeToBytes(b.size) - parseSizeToBytes(a.size)
    }
    if (sortOrder === 'SIZE_ASC') {
      return parseSizeToBytes(a.size) - parseSizeToBytes(b.size)
    }
    const tA = new Date(a.createdAt || 0).getTime()
    const tB = new Date(b.createdAt || 0).getTime()
    return sortOrder === 'OLDEST' ? tA - tB : tB - tA
  })

  const processSelectedFiles = async (fileList: FileList | File[]) => {
    const arr = Array.from(fileList || [])
    if (arr.length === 0) return
    setIsReadingFiles(true)
    try {
      const added: PendingUploadItem[] = []
      for (const f of arr) {
        const dataUrl = await readFileAsDataUrl(f)
        added.push({
          id: 'pf-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
          file: f,
          customName: f.name,
          sizeText: formatBytes(f.size),
          detectedType: detectSharedFileType(f),
          mimeType: f.type || 'application/octet-stream',
          dataUrl,
        })
      }
      setPendingFiles((prev) => [...prev, ...added])
    } catch {
      setErrorMessage('Dosya okunurken bir hata oluştu.')
      setTimeout(() => setErrorMessage(null), 3500)
    } finally {
      setIsReadingFiles(false)
    }
  }

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processSelectedFiles(e.target.files)
      e.target.value = ''
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processSelectedFiles(e.dataTransfer.files)
    }
  }

  const handleDownload = (file: SharedFile) => {
    if (!currentUser) return
    const res = sharedFileStore.downloadFile(file.id, currentUser)
    if (!res.success) {
      setErrorMessage(res.error || 'İndirme izniniz bulunmuyor.')
      setTimeout(() => setErrorMessage(null), 3500)
      return
    }

    try {
      const link = document.createElement('a')
      if (file.fileDataUrl) {
        link.href = file.fileDataUrl
      } else {
        const blob = new Blob([`Demirtürk Portföy Kurumsal Dosya: ${file.name}`], {
          type: file.mimeType || 'application/octet-stream',
        })
        link.href = URL.createObjectURL(blob)
      }
      link.download = file.name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch {}

    setDownloadSuccessMessage(`"${file.name}" bilgisayarınıza indirildi.`)
    setTimeout(() => setDownloadSuccessMessage(null), 3500)
  }

  const handleDelete = (file: SharedFile) => {
    if (!currentUser) return
    if (!window.confirm(`"${file.name}" dosyasını silmek istediğinize emin misiniz?`)) return

    const res = sharedFileStore.deleteFile(file.id, currentUser)
    if (!res.success) {
      alert(res.error)
    } else if (previewFile?.id === file.id) {
      setPreviewFile(null)
    }
  }

  const handleDeptToggle = (dept: Department) => {
    if (selectedDepts.includes(dept)) {
      setSelectedDepts(selectedDepts.filter((d) => d !== dept))
    } else {
      setSelectedDepts([...selectedDepts, dept])
    }
  }

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser) return

    if (pendingFiles.length === 0) {
      setErrorMessage('Lütfen bilgisayarınızdan yüklenecek en az bir dosya seçin veya sürükleyip bırakın.')
      setTimeout(() => setErrorMessage(null), 3500)
      return
    }

    if (shareTarget === 'DEPARTMENTS' && selectedDepts.length === 0) {
      setErrorMessage('Lütfen dosyanın paylaşılacağı en az bir departman seçin.')
      setTimeout(() => setErrorMessage(null), 3000)
      return
    }

    for (const item of pendingFiles) {
      sharedFileStore.uploadFile(
        {
          name: item.customName.trim() || item.file.name,
          folder,
          type: item.detectedType,
          size: item.sizeText,
          mimeType: item.mimeType,
          fileDataUrl: item.dataUrl,
          shareTarget,
          targetDepartments: shareTarget === 'DEPARTMENTS' ? selectedDepts : undefined,
          permissions: {
            canView: true,
            canEdit,
            canReshare,
          },
        },
        currentUser
      )
    }

    const uploadedCount = pendingFiles.length
    setIsUploadModalOpen(false)
    setPendingFiles([])
    setDownloadSuccessMessage(
      uploadedCount === 1
        ? 'Dosya başarıyla yüklendi ve seçilen hedef yetkileriyle paylaşıldı.'
        : `${uploadedCount} dosya başarıyla yüklendi ve paylaşıldı.`
    )
    setTimeout(() => setDownloadSuccessMessage(null), 3500)
  }

  const getFileIcon = (type: SharedFile['type'], sizeClass = 'w-5 h-5') => {
    switch (type) {
      case 'pdf':
        return <FileText className={`${sizeClass} text-rose-400 shrink-0`} />
      case 'excel':
        return <FileSpreadsheet className={`${sizeClass} text-emerald-400 shrink-0`} />
      case 'video':
        return <Film className={`${sizeClass} text-sky-400 shrink-0`} />
      case 'image':
        return <ImageIcon className={`${sizeClass} text-purple-400 shrink-0`} />
      case 'audio':
        return <Music className={`${sizeClass} text-pink-400 shrink-0`} />
      case 'archive':
        return <Archive className={`${sizeClass} text-amber-400 shrink-0`} />
      case 'doc':
        return <FileText className={`${sizeClass} text-blue-400 shrink-0`} />
      default:
        return <FileGenericIcon className={`${sizeClass} text-[#b99881] shrink-0`} />
    }
  }

  const getTargetBadge = (file: SharedFile) => {
    switch (file.shareTarget) {
      case 'ALL_TEAM':
        return <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#3d3733] text-[#d6beae]">Tüm Ekip</span>
      case 'DEPARTMENTS':
        return (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/20">
            {file.targetDepartments?.join(', ')}
          </span>
        )
      case 'MANAGEMENT':
        return <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">Yönetim Özel</span>
      case 'MEMBERS':
        return <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">Belirli Üyeler</span>
    }
  }

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Cloud className="w-5 h-5 text-[#b99881]" />
            <h2 className="text-2xl font-bold text-white tracking-wide">
              Paylaşılanlar
            </h2>
          </div>
          <p className="text-xs text-[#a69f99] mt-1">
            Her türlü belge, görsel, video, PDF, Word ve Excel tablosunu departman bazında yükleyin ve uygulama içinde önizleyin.
          </p>
        </div>

        <GlassButton
          variant="gold"
          size="sm"
          icon={<Upload className="w-3.5 h-3.5" />}
          onClick={() => setIsUploadModalOpen(true)}
          className="rounded-full px-4 text-xs font-semibold"
        >
          Dosya Yükle & Paylaş
        </GlassButton>
      </div>

      {/* Notifications */}
      {downloadSuccessMessage && (
        <div className="p-3 rounded-[16px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{downloadSuccessMessage}</span>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 rounded-[16px] bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Kategori, Arama, Sıralama ve Görünüm Çubuğu */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Sol: Klasör Sekmeleri */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setSelectedFolder('ALL')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer ${
              selectedFolder === 'ALL'
                ? 'bg-[#b99881] text-[#282522] font-bold shadow-sm'
                : 'bg-[#34302d] text-[#a69f99] hover:text-white border border-[#4a443f]'
            }`}
          >
            Tümü ({files.length})
          </button>
          {categories.map((cat) => {
            const count = files.filter((f) => f.folder === cat).length
            const isSelected = selectedFolder === cat
            return (
              <button
                key={cat}
                onClick={() => setSelectedFolder(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-[#b99881] text-[#282522] font-bold shadow-sm'
                    : 'bg-[#34302d] text-[#a69f99] hover:text-white border border-[#4a443f]'
                }`}
              >
                {cat} ({count})
              </button>
            )
          })}
        </div>

        {/* Sağ: Arama + Sıralama + Görünüm Modları */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Arama */}
          <div className="relative w-full sm:w-52">
            <Search className="w-3.5 h-3.5 text-[#b99881] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Dosyalarda ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-full bg-[#34302d] border border-[#4a443f] text-xs text-white placeholder-[#8c857f] focus:outline-none focus:border-[#b99881]"
            />
          </div>

          {/* Sıralama Seçici */}
          <div className="relative flex items-center">
            <ArrowUpDown className="w-3.5 h-3.5 text-[#b99881] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as FileSortOrder)}
              className="pl-8 pr-6 py-1.5 rounded-full bg-[#34302d] border border-[#4a443f] text-xs font-semibold text-white focus:outline-none focus:border-[#b99881] cursor-pointer transition-colors"
              title="Dosyaları sırala"
            >
              <option value="NEWEST">Sırala: Yeniden eskiye</option>
              <option value="OLDEST">Sırala: Eskiden yeniye</option>
              <option value="NAME_ASC">Sırala: İsim (A - Z)</option>
              <option value="NAME_DESC">Sırala: İsim (Z - A)</option>
              <option value="SIZE_DESC">Sırala: Boyut (Büyükten küçüğe)</option>
              <option value="SIZE_ASC">Sırala: Boyut (Küçükten büyüğe)</option>
            </select>
          </div>

          {/* Görünüm Seçici: Liste / Büyük / Küçük */}
          <div className="inline-flex items-center gap-1 p-1 rounded-full bg-[#282522] border border-[#4a443f]">
            <button
              type="button"
              onClick={() => setViewMode('LIST')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'LIST'
                  ? 'bg-[#b99881] text-white shadow-sm'
                  : 'no-layer-btn text-[#a69f99] hover:text-white'
              }`}
              title="Liste Görünümü"
            >
              <List className="w-3.5 h-3.5" />
              <span>Liste</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('LARGE')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'LARGE'
                  ? 'bg-[#b99881] text-white shadow-sm'
                  : 'no-layer-btn text-[#a69f99] hover:text-white'
              }`}
              title="Büyük Kart Görünümü"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Büyük</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('SMALL')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'SMALL'
                  ? 'bg-[#b99881] text-white shadow-sm'
                  : 'no-layer-btn text-[#a69f99] hover:text-white'
              }`}
              title="Küçük Kompakt Görünüm"
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Küçük</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dosya Listesi / Kartları */}
      {sortedFiles.length === 0 ? (
        <div className="py-20 text-center flex flex-col items-center justify-center">
          <Folder className="w-10 h-10 text-[#8c857f] mx-auto mb-3 opacity-40" />
          <h3 className="text-sm font-semibold text-white">Henüz paylaşılan dosya yok</h3>
          <p className="text-xs text-[#8c857f] mt-1 max-w-sm mx-auto">
            Sağ üstteki "Dosya Yükle & Paylaş" butonuna tıklayarak bilgisayarınızdan her türlü dosyayı yükleyebilirsiniz.
          </p>
        </div>
      ) : viewMode === 'LIST' ? (
        /* 1. LİSTE GÖRÜNÜMÜ */
        <div className="rounded-[24px] bg-[#282522]/80 border border-[#4a443f] overflow-hidden shadow-sm">
          <div className="w-full overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-white/[0.02] border-b border-[#4a443f]/60 text-[#8c857f] text-[11px]">
                  <th className="py-3 px-4">Dosya Adı</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4">Erişim Hedefi</th>
                  <th className="py-3 px-4">Boyut</th>
                  <th className="py-3 px-4">Yükleyen</th>
                  <th className="py-3 px-4">Tarih</th>
                  <th className="py-3 px-4 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#4a443f]/50">
                {sortedFiles.map((file) => {
                  const isOwner =
                    file.uploadedByUserId === currentUser?.id ||
                    currentUser?.role === 'ADMIN' ||
                    currentUser?.isManager
                  return (
                    <tr
                      key={file.id}
                      onClick={() => setPreviewFile(file)}
                      className="customer-table-row transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {getFileIcon(file.type, 'w-4 h-4')}
                          <span className="font-bold text-white hover:text-[#b99881] transition-colors truncate max-w-[260px]" title={file.name}>
                            {file.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[#d6beae] whitespace-nowrap">{file.folder}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {getTargetBadge(file)}
                          {file.permissions.canEdit && (
                            <span className="text-[10px] text-emerald-400 font-medium">Düzenlenebilir</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[#a69f99] whitespace-nowrap">{file.size}</td>
                      <td className="py-3 px-4 text-white whitespace-nowrap">{file.uploadedByUserName}</td>
                      <td className="py-3 px-4 text-[#8c857f] whitespace-nowrap">
                        {formatDateOnly(file.createdAt)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPreviewFile(file)}
                            className="p-1.5 rounded-full bg-[#34302d] hover:bg-[#b99881]/25 text-[#d6beae] hover:text-white transition-colors cursor-pointer"
                            title="Uygulama İçinde Önizle"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownload(file)}
                            className="p-1.5 rounded-full bg-[#34302d] hover:bg-[#b99881] text-[#b99881] hover:text-[#282522] transition-colors cursor-pointer"
                            title="Dosyayı İndir"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          {isOwner && (
                            <button
                              type="button"
                              onClick={() => handleDelete(file)}
                              className="p-1.5 rounded-full bg-[#34302d] hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
                              title="Dosyayı Sil"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : viewMode === 'LARGE' ? (
        /* 2. BÜYÜK GÖRÜNÜM (Geniş Kartlar & Canlı Görsel/Video/Belge Önizleme) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedFiles.map((file) => {
            const isOwner =
              file.uploadedByUserId === currentUser?.id ||
              currentUser?.role === 'ADMIN' ||
              currentUser?.isManager
            const isImagePreview =
              file.type === 'image' && file.fileDataUrl && file.fileDataUrl.startsWith('data:image/')
            const isVideoPreview =
              file.type === 'video' && file.fileDataUrl && file.fileDataUrl.startsWith('data:video/')

            return (
              <div
                key={file.id}
                onClick={() => setPreviewFile(file)}
                className="group p-5 rounded-[22px] bg-[#282522] border border-[#4a443f] hover:border-[#b99881]/70 transition-all duration-200 flex flex-col justify-between space-y-3.5 cursor-pointer"
              >
                <div className="space-y-3">
                  {/* Üst Önizleme Kutusu */}
                  <div className="h-32 rounded-[16px] bg-[#34302d] flex items-center justify-center overflow-hidden relative border border-[#4a443f]/50">
                    {isImagePreview ? (
                      <img
                        src={file.fileDataUrl}
                        alt={file.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : isVideoPreview ? (
                      <div className="relative w-full h-full flex items-center justify-center bg-black/50">
                        <video
                          src={file.fileDataUrl}
                          muted
                          preload="metadata"
                          className="w-full h-full object-cover opacity-85"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <div className="w-10 h-10 rounded-full bg-[#b99881]/90 text-[#282522] flex items-center justify-center shadow-lg">
                            <Play className="w-5 h-5 fill-current ml-0.5" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1.5">
                        {getFileIcon(file.type, 'w-9 h-9')}
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#8c857f]">
                          {file.type} • {file.size}
                        </span>
                      </div>
                    )}

                    {/* Hover Önizle Etiketi */}
                    <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#b99881] text-[#282522] text-xs font-bold shadow-md">
                        <Eye className="w-3.5 h-3.5" />
                        Önizle
                      </span>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-white group-hover:text-[#b99881] transition-colors truncate" title={file.name}>
                      {file.name}
                    </h4>
                    <div className="text-[11px] text-[#8c857f] mt-0.5">
                      {file.folder} • {formatDateOnly(file.createdAt)}
                    </div>
                  </div>

                  {/* Hedef ve Yetki Etiketleri */}
                  <div className="flex flex-wrap items-center gap-2">
                    {getTargetBadge(file)}
                    {file.permissions.canEdit && (
                      <span className="text-[10px] text-emerald-400 font-medium">Düzenlenebilir</span>
                    )}
                  </div>
                </div>

                <div
                  className="pt-2 flex items-center justify-between text-[11px] text-[#8c857f]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="truncate">Yükleyen: {file.uploadedByUserName}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setPreviewFile(file)}
                      className="p-2 rounded-full bg-[#34302d] hover:bg-[#b99881]/25 text-[#d6beae] hover:text-white transition-colors cursor-pointer"
                      title="Uygulama İçinde Önizle"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownload(file)}
                      className="p-2 rounded-full bg-[#34302d] hover:bg-[#b99881] text-[#b99881] hover:text-[#282522] transition-colors cursor-pointer"
                      title="Dosyayı İndir"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => handleDelete(file)}
                        className="p-2 rounded-full bg-[#34302d] hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
                        title="Dosyayı Sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* 3. KÜÇÜK GÖRÜNÜM (Kompakt Çoklu Izgara) */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {sortedFiles.map((file) => {
            const isOwner =
              file.uploadedByUserId === currentUser?.id ||
              currentUser?.role === 'ADMIN' ||
              currentUser?.isManager

            return (
              <div
                key={file.id}
                onClick={() => setPreviewFile(file)}
                className="p-3.5 rounded-[18px] bg-[#282522] border border-[#4a443f] hover:border-[#b99881]/70 transition-all duration-200 flex flex-col justify-between space-y-2.5 cursor-pointer"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    {getFileIcon(file.type, 'w-5 h-5')}
                    <span className="text-[10px] font-mono text-[#8c857f]">{file.size}</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white hover:text-[#b99881] transition-colors truncate" title={file.name}>
                      {file.name}
                    </h4>
                    <div className="text-[10px] text-[#8c857f] truncate mt-0.5">
                      {file.folder}
                    </div>
                  </div>
                </div>

                <div
                  className="pt-1 flex items-center justify-between gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="truncate">{getTargetBadge(file)}</div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setPreviewFile(file)}
                      className="p-1.5 rounded-full bg-[#34302d] hover:bg-[#b99881]/25 text-[#d6beae] hover:text-white transition-colors cursor-pointer"
                      title="Önizle"
                    >
                      <Eye className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownload(file)}
                      className="p-1.5 rounded-full bg-[#34302d] hover:bg-[#b99881] text-[#b99881] hover:text-[#282522] transition-colors cursor-pointer"
                      title="Dosyayı İndir"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => handleDelete(file)}
                        className="p-1.5 rounded-full bg-[#34302d] hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
                        title="Dosyayı Sil"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* UYGULAMA İÇİ DOSYA ÖNİZLEME MODALI */}
      <GlassModal
        isOpen={Boolean(previewFile)}
        onClose={() => setPreviewFile(null)}
        title={previewFile ? previewFile.name : 'Dosya Önizleme'}
        description={
          previewFile
            ? `${previewFile.folder} • ${previewFile.size} • Yükleyen: ${previewFile.uploadedByUserName} (${formatDateOnly(previewFile.createdAt)})`
            : undefined
        }
        maxWidth="5xl"
      >
        {previewFile && (
          <div className="space-y-3">
            {/* Üst Araç Çubuğu */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#4a443f]/60">
              <div className="flex items-center gap-2">
                {getFileIcon(previewFile.type, 'w-4 h-4')}
                {getTargetBadge(previewFile)}
                {parsedPreview?.kind === 'image' && (
                  <div className="flex items-center gap-1 ml-2 bg-[#24211f] px-2 py-1 rounded-full border border-[#4a443f]">
                    <button
                      type="button"
                      onClick={() => setImageZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
                      className="p-1 text-[#a69f99] hover:text-white cursor-pointer"
                      title="Küçült"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[11px] font-mono text-white px-1.5">
                      {Math.round(imageZoom * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setImageZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
                      className="p-1 text-[#a69f99] hover:text-white cursor-pointer"
                      title="Büyüt"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageZoom(1)}
                      className="p-1 text-[#a69f99] hover:text-white cursor-pointer"
                      title="Sıfırla"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {parsedPreview?.kind === 'excel' && parsedPreview.sheets.length > 0 && (
                  <div className="flex items-center gap-1.5 ml-2">
                    {parsedPreview.sheets.map((sheet, idx) => (
                      <button
                        key={sheet.name + idx}
                        type="button"
                        onClick={() => setActiveSheetIndex(idx)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                          activeSheetIndex === idx
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-[#24211f] text-[#a69f99] hover:text-white border border-[#4a443f]'
                        }`}
                      >
                        {sheet.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {parsedPreview?.kind === 'excel' && (
                  <div className="relative w-48">
                    <Search className="w-3.5 h-3.5 text-[#b99881] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Tablo içinde filtrele..."
                      value={sheetSearchQuery}
                      onChange={(e) => setSheetSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1 rounded-full bg-[#24211f] border border-[#4a443f] text-xs text-white placeholder-[#8c857f] focus:outline-none focus:border-[#b99881]"
                    />
                  </div>
                )}

                <GlassButton
                  type="button"
                  variant="gold"
                  size="sm"
                  icon={<Download className="w-3.5 h-3.5" />}
                  onClick={() => handleDownload(previewFile)}
                  className="rounded-full px-4 text-xs font-semibold"
                >
                  Bilgisayara İndir
                </GlassButton>
              </div>
            </div>

            {/* Önizleme İçerik Alanı */}
            {isPreviewLoading ? (
              <div className="h-[60vh] flex flex-col items-center justify-center text-xs text-[#a69f99] gap-2">
                <div className="w-7 h-7 rounded-full border-2 border-[#b99881] border-t-transparent animate-spin" />
                <span>Dosya içeriği çözümleniyor...</span>
              </div>
            ) : !parsedPreview ? null : parsedPreview.kind === 'image' ? (
              /* FOTOĞRAF ÖNİZLEME */
              <div className="h-[66vh] rounded-[18px] bg-[#1d1b19] border border-[#4a443f] overflow-auto flex items-center justify-center p-4">
                <img
                  src={parsedPreview.url}
                  alt={previewFile.name}
                  style={{
                    transform: `scale(${imageZoom})`,
                    transformOrigin: 'center center',
                  }}
                  className="max-w-full max-h-full object-contain rounded-lg transition-transform duration-150"
                />
              </div>
            ) : parsedPreview.kind === 'video' ? (
              /* VİDEO ÖNİZLEME */
              <div className="h-[66vh] rounded-[18px] bg-black border border-[#4a443f] overflow-hidden flex items-center justify-center">
                <video
                  src={parsedPreview.url}
                  controls
                  autoPlay
                  className="w-full h-full max-h-[66vh] object-contain"
                />
              </div>
            ) : parsedPreview.kind === 'audio' ? (
              /* SES ÖNİZLEME */
              <div className="h-56 rounded-[18px] bg-[#24211f] border border-[#4a443f] flex flex-col items-center justify-center gap-4 p-6">
                <Music className="w-12 h-12 text-pink-400" />
                <div className="text-sm font-bold text-white">{previewFile.name}</div>
                <audio src={parsedPreview.url} controls autoPlay className="w-full max-w-md" />
              </div>
            ) : parsedPreview.kind === 'pdf' ? (
              /* PDF ÖNİZLEME */
              <div className="h-[68vh] rounded-[18px] bg-[#1d1b19] border border-[#4a443f] overflow-hidden">
                <iframe
                  src={parsedPreview.url}
                  title={previewFile.name}
                  className="w-full h-full border-0 bg-white"
                />
              </div>
            ) : parsedPreview.kind === 'excel' ? (
              /* EXCEL / CSV TABLO ÖNİZLEME */
              (() => {
                const activeSheet =
                  parsedPreview.sheets[activeSheetIndex] || parsedPreview.sheets[0]
                const allRows = activeSheet?.rows || []
                const q = sheetSearchQuery.trim().toLowerCase()
                const filteredRows = q
                  ? allRows.filter(
                      (r, rIdx) =>
                        rIdx === 0 || r.some((cell) => cell.toLowerCase().includes(q))
                    )
                  : allRows
                const colCount = allRows[0]?.length || 0

                return (
                  <div className="h-[66vh] rounded-[18px] bg-[#1f1d1b] border border-[#4a443f] overflow-auto">
                    {filteredRows.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs text-[#8c857f]">
                        Bu çalışma sayfasında görüntülenecek veri bulunamadı.
                      </div>
                    ) : (
                      <table className="w-full border-collapse text-xs text-left">
                        <thead className="sticky top-0 z-10 bg-[#2d2926] text-[#b99881] border-b border-[#4a443f]">
                          <tr>
                            <th className="py-2 px-3 border-r border-[#4a443f]/60 w-10 text-center font-mono text-[10px] text-[#8c857f]">
                              #
                            </th>
                            {Array.from({ length: colCount }).map((_, cIdx) => (
                              <th
                                key={cIdx}
                                className="py-2 px-3 border-r border-[#4a443f]/60 font-mono text-[11px] font-bold"
                              >
                                {getColumnLetter(cIdx)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#4a443f]/40">
                          {filteredRows.map((row, rIdx) => {
                            const isHeaderRow = rIdx === 0
                            return (
                              <tr
                                key={rIdx}
                                className={
                                  isHeaderRow
                                    ? 'bg-[#b99881]/12 font-bold text-white'
                                    : 'hover:bg-white/[0.03] text-[#e6dfd9]'
                                }
                              >
                                <td className="py-2 px-2.5 border-r border-[#4a443f]/50 text-center font-mono text-[10px] text-[#8c857f] bg-[#24211f]">
                                  {rIdx + 1}
                                </td>
                                {row.map((cell, cIdx) => (
                                  <td
                                    key={cIdx}
                                    className="py-2 px-3 border-r border-[#4a443f]/30 whitespace-nowrap max-w-[320px] truncate"
                                    title={cell}
                                  >
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )
              })()
            ) : parsedPreview.kind === 'word' ? (
              /* WORD BELGESİ (.docx / .doc) ÖNİZLEME */
              <div className="h-[66vh] rounded-[18px] bg-[#1f1d1b] border border-[#4a443f] overflow-y-auto p-6 sm:p-8">
                <div className="max-w-3xl mx-auto bg-[#282522] border border-[#4a443f] rounded-[16px] p-6 sm:p-8 shadow-inner space-y-4">
                  {parsedPreview.blocks.map((block, bIdx) => {
                    if (block.type === 'heading') {
                      return (
                        <h4
                          key={bIdx}
                          className={`${
                            block.level === 1 ? 'text-lg' : 'text-base'
                          } font-bold text-[#b99881] pt-1 border-b border-[#4a443f]/50 pb-1.5`}
                        >
                          {block.text}
                        </h4>
                      )
                    }
                    if (block.type === 'table' && block.rows) {
                      return (
                        <div
                          key={bIdx}
                          className="overflow-x-auto rounded-xl border border-[#4a443f]"
                        >
                          <table className="w-full text-xs text-left border-collapse">
                            <tbody className="divide-y divide-[#4a443f]/60">
                              {block.rows.map((r, rIdx) => (
                                <tr
                                  key={rIdx}
                                  className={
                                    rIdx === 0
                                      ? 'bg-[#34302d] font-bold text-white'
                                      : 'bg-[#24211f]/70 text-[#e6dfd9]'
                                  }
                                >
                                  {r.map((cell, cIdx) => (
                                    <td
                                      key={cIdx}
                                      className="p-2.5 border-r border-[#4a443f]/50 last:border-r-0"
                                    >
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    }
                    return (
                      <p
                        key={bIdx}
                        className="text-xs sm:text-sm text-[#f3efe9] leading-relaxed whitespace-pre-wrap"
                      >
                        {block.text}
                      </p>
                    )
                  })}
                </div>
              </div>
            ) : parsedPreview.kind === 'text' ? (
              /* METİN BELGESİ (.txt, .md, .json, .xml, .rtf, .log) ÖNİZLEME */
              <div className="h-[66vh] rounded-[18px] bg-[#1d1b19] border border-[#4a443f] overflow-auto p-5">
                <pre className="text-xs sm:text-sm font-mono text-[#f3efe9] whitespace-pre-wrap break-words leading-relaxed">
                  {parsedPreview.content || '(Boş metin belgesi)'}
                </pre>
              </div>
            ) : (
              /* DESTEKLENMEYEN VEYA İKİLİ ARŞİV DOSYASI */
              <div className="h-64 rounded-[18px] bg-[#24211f] border border-[#4a443f] flex flex-col items-center justify-center text-center p-6 gap-3">
                {getFileIcon(previewFile.type, 'w-12 h-12')}
                <div className="text-sm font-bold text-white">{previewFile.name}</div>
                <p className="text-xs text-[#a69f99] max-w-md">
                  {parsedPreview.reason}
                </p>
                <GlassButton
                  type="button"
                  variant="gold"
                  size="sm"
                  icon={<Download className="w-3.5 h-3.5" />}
                  onClick={() => handleDownload(previewFile)}
                  className="rounded-full px-5 mt-1 font-semibold"
                >
                  Dosyayı İndir ({previewFile.size})
                </GlassButton>
              </div>
            )}
          </div>
        )}
      </GlassModal>

      {/* DOSYA YÜKLE & PAYLAŞ MODALI (Kompakt & Scrollsuz) */}
      <GlassModal
        isOpen={isUploadModalOpen}
        onClose={() => {
          setIsUploadModalOpen(false)
          setPendingFiles([])
        }}
        title="Dosya Yükle ve Paylaş"
        maxWidth="lg"
      >
        <form onSubmit={handleUploadSubmit} className="space-y-3">
          {/* Gizli File Input (Her türlü dosya kabul edilir) */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileInputChange}
            className="hidden"
          />

          {/* Sürükle-Bırak veya Bilgisayardan Seç Alanı (Kompakt) */}
          <div
            onDragOver={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIsDraggingOver(true)
            }}
            onDragLeave={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIsDraggingOver(false)
            }}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`py-3 px-4 rounded-[16px] border-2 border-dashed transition-all cursor-pointer flex items-center justify-center gap-3 ${
              isDraggingOver
                ? 'border-[#b99881] bg-[#b99881]/10'
                : 'border-[#4a443f] hover:border-[#b99881]/70 bg-[#24211f]/60'
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-[#b99881]/15 flex items-center justify-center shrink-0">
              <Upload className="w-4 h-4 text-[#b99881]" />
            </div>
            <div className="text-left">
              <div className="text-xs font-bold text-white">
                {isReadingFiles
                  ? 'Dosyalar okunuyor...'
                  : 'Dosyaları sürükleyip bırakın veya bilgisayarınızdan seçin'}
              </div>
              <div className="text-[10.5px] text-[#8c857f]">
                PDF, Excel, Word, Görsel, Video, Metin, ZIP/RAR, DWG dahil her türlü dosya yüklenebilir
              </div>
            </div>
          </div>

          {/* Seçilen Dosyalar Listesi */}
          {pendingFiles.length > 0 && (
            <div className="space-y-1.5 max-h-28 overflow-y-auto no-scrollbar">
              {pendingFiles.map((item) => (
                <div
                  key={item.id}
                  className="py-2 px-3 rounded-[12px] bg-[#24211f] border border-[#4a443f] flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {getFileIcon(item.detectedType)}
                    <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={item.customName}
                        onChange={(e) => {
                          const val = e.target.value
                          setPendingFiles((prev) =>
                            prev.map((p) => (p.id === item.id ? { ...p, customName: val } : p))
                          )
                        }}
                        className="w-full bg-transparent text-xs font-semibold text-white focus:outline-none border-b border-transparent focus:border-[#b99881] truncate"
                        title="Dosya adını düzenleyebilirsiniz"
                      />
                      <span className="text-[10px] text-[#8c857f] shrink-0">
                        {item.sizeText}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setPendingFiles((prev) => prev.filter((p) => p.id !== item.id))
                    }
                    className="p-1 rounded-full hover:bg-rose-500/15 text-[#8c857f] hover:text-rose-400 transition-colors cursor-pointer shrink-0"
                    title="Listeden Kaldır"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Kategori Seçimi */}
          <div>
            <label className="block text-[11px] font-semibold text-[#f3efe9] mb-1">
              Kategori / Klasör
            </label>
            <select
              value={folder}
              onChange={(e) => setFolder(e.target.value as FileCategory)}
              className="w-full px-3 py-1.5 rounded-[12px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Hedef Seçimi (Tüm Ekip, Çoklu Departman, Yönetim) */}
          <div>
            <label className="block text-[11px] font-semibold text-[#f3efe9] mb-1">
              Paylaşım Hedefi *
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setShareTarget('ALL_TEAM')}
                className={`py-2 px-2.5 rounded-[12px] text-xs font-medium border transition-colors cursor-pointer text-center ${
                  shareTarget === 'ALL_TEAM'
                    ? 'bg-[#b99881]/20 border-[#b99881] text-white font-bold'
                    : 'bg-[#24211f] border-[#4a443f] text-[#a69f99]'
                }`}
              >
                Tüm Ekip
              </button>
              <button
                type="button"
                onClick={() => setShareTarget('DEPARTMENTS')}
                className={`py-2 px-2.5 rounded-[12px] text-xs font-medium border transition-colors cursor-pointer text-center ${
                  shareTarget === 'DEPARTMENTS'
                    ? 'bg-[#b99881]/20 border-[#b99881] text-white font-bold'
                    : 'bg-[#24211f] border-[#4a443f] text-[#a69f99]'
                }`}
              >
                Departmanlar
              </button>
              <button
                type="button"
                onClick={() => setShareTarget('MANAGEMENT')}
                className={`py-2 px-2.5 rounded-[12px] text-xs font-medium border transition-colors cursor-pointer text-center ${
                  shareTarget === 'MANAGEMENT'
                    ? 'bg-[#b99881]/20 border-[#b99881] text-white font-bold'
                    : 'bg-[#24211f] border-[#4a443f] text-[#a69f99]'
                }`}
              >
                Yönetim Özel
              </button>
            </div>
          </div>

          {/* Çoklu Departman Seçici (3 sütunlu kompakt görünüm) */}
          {shareTarget === 'DEPARTMENTS' && (
            <div className="p-2.5 rounded-[14px] bg-[#24211f] border border-[#4a443f] space-y-1.5">
              <div className="text-[11px] font-semibold text-[#b99881]">
                Erişebilecek Departmanlar:
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {CANONICAL_DEPARTMENTS.map((dept) => {
                  const isChecked = selectedDepts.includes(dept)
                  return (
                    <label
                      key={dept}
                      className="flex items-center gap-1.5 text-xs text-[#f3efe9] cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleDeptToggle(dept)}
                        className="rounded border-[#4a443f] text-[#b99881] focus:ring-0"
                      />
                      <span className="truncate">{dept}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {/* Yetkiler (Tek satır kompakt) */}
          <div className="py-2 px-3 rounded-[14px] bg-[#24211f] border border-[#4a443f] flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-[#b99881]">
              İzinler:
            </span>
            <div className="flex items-center gap-3.5 text-xs text-[#f3efe9]">
              <label className="flex items-center gap-1.5 opacity-80">
                <input type="checkbox" checked disabled className="rounded text-[#b99881]" />
                <span>Görüntüleme</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={canEdit}
                  onChange={(e) => setCanEdit(e.target.checked)}
                  className="rounded text-[#b99881] focus:ring-0"
                />
                <span>Düzenleme</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={canReshare}
                  onChange={(e) => setCanReshare(e.target.checked)}
                  className="rounded text-[#b99881] focus:ring-0"
                />
                <span>Yeniden Paylaşma</span>
              </label>
            </div>
          </div>

          <div className="pt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsUploadModalOpen(false)
                setPendingFiles([])
              }}
              className="px-4 py-2 rounded-full text-xs text-[#a69f99] hover:text-white cursor-pointer"
            >
              Vazgeç
            </button>
            <GlassButton
              type="submit"
              variant="gold"
              size="sm"
              disabled={pendingFiles.length === 0 || isReadingFiles}
              className="rounded-full px-5 font-bold"
            >
              {pendingFiles.length > 1
                ? `${pendingFiles.length} Dosyayı Yükle ve Paylaş`
                : 'Dosyayı Yükle ve Paylaş'}
            </GlassButton>
          </div>
        </form>
      </GlassModal>
    </div>
  )
}
