import React, { useState, useEffect, useRef } from 'react'
import {
  Cloud,
  Download,
  Trash2,
  Search,
  Check,
  Plus,
  FileText,
  FileSpreadsheet,
  Film,
  Image as ImageIcon,
  Archive,
  Lock,
  AlertCircle,
  Folder,
  Upload,
  Music,
  File as FileGenericIcon,
  X,
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
    /\.(doc|docx|ppt|pptx|txt|rtf|odt|pages|key)$/i.test(name)
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
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [downloadSuccessMessage, setDownloadSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

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

    // Trigger real browser/desktop download
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

  const getFileIcon = (type: SharedFile['type']) => {
    switch (type) {
      case 'pdf':
        return <FileText className="w-5 h-5 text-rose-400" />
      case 'excel':
        return <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
      case 'video':
        return <Film className="w-5 h-5 text-sky-400" />
      case 'image':
        return <ImageIcon className="w-5 h-5 text-purple-400" />
      case 'audio':
        return <Music className="w-5 h-5 text-pink-400" />
      case 'archive':
        return <Archive className="w-5 h-5 text-amber-400" />
      case 'doc':
        return <FileText className="w-5 h-5 text-blue-400" />
      default:
        return <FileGenericIcon className="w-5 h-5 text-[#b99881]" />
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
            Her türlü belge, görsel, video, mimari çizim ve arşivi departman bazında yükleyin ve paylaşın.
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

      {/* Kategori ve Filtre Çubuğu */}
      <div className="flex flex-wrap items-center justify-between gap-4">
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

        {/* Yerel Arama */}
        <div className="relative w-full sm:w-60">
          <Search className="w-3.5 h-3.5 text-[#b99881] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Dosyalarda ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-full bg-[#34302d] border border-[#4a443f] text-xs text-white placeholder-[#8c857f] focus:outline-none focus:border-[#b99881]"
          />
        </div>
      </div>

      {/* Dosya Listesi */}
      {filteredFiles.length === 0 ? (
        <div className="py-20 text-center flex flex-col items-center justify-center">
          <Folder className="w-10 h-10 text-[#8c857f] mx-auto mb-3 opacity-40" />
          <h3 className="text-sm font-semibold text-white">Henüz paylaşılan dosya yok</h3>
          <p className="text-xs text-[#8c857f] mt-1 max-w-sm mx-auto">
            Sağ üstteki "Dosya Yükle & Paylaş" butonuna tıklayarak bilgisayarınızdan her türlü dosyayı yükleyebilirsiniz.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFiles.map((file) => {
            const isOwner =
              file.uploadedByUserId === currentUser?.id ||
              currentUser?.role === 'ADMIN' ||
              currentUser?.isManager

            return (
              <div
                key={file.id}
                className="p-4 rounded-[20px] bg-[#282522] border border-[#4a443f] hover:border-[#b99881]/70 transition-all duration-200 flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {getFileIcon(file.type)}
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-white truncate" title={file.name}>
                          {file.name}
                        </h4>
                        <div className="text-[10px] text-[#8c857f] mt-0.5">
                          {file.size} • {file.folder}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Hedef ve Yetki Etiketleri */}
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    {getTargetBadge(file)}
                    {file.permissions.canEdit && (
                      <span className="text-[10px] text-emerald-400 font-medium">Düzenlenebilir</span>
                    )}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between text-[11px] text-[#8c857f]">
                  <span>Yükleyen: {file.uploadedByUserName}</span>
                  <div className="flex items-center gap-1.5">
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
      )}

      {/* DOSYA YÜKLE & PAYLAŞ MODALI */}
      <GlassModal
        isOpen={isUploadModalOpen}
        onClose={() => {
          setIsUploadModalOpen(false)
          setPendingFiles([])
        }}
        title="Dosya Yükle ve Paylaş"
      >
        <form onSubmit={handleUploadSubmit} className="space-y-4">
          {/* Gizli File Input (Her türlü dosya kabul edilir) */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileInputChange}
            className="hidden"
          />

          {/* Sürükle-Bırak veya Bilgisayardan Seç Alanı */}
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
            className={`p-6 rounded-[18px] border-2 border-dashed transition-all cursor-pointer text-center flex flex-col items-center justify-center gap-2 ${
              isDraggingOver
                ? 'border-[#b99881] bg-[#b99881]/10'
                : 'border-[#4a443f] hover:border-[#b99881]/70 bg-[#24211f]/60'
            }`}
          >
            <div className="w-10 h-10 rounded-full bg-[#b99881]/15 flex items-center justify-center">
              <Upload className="w-5 h-5 text-[#b99881]" />
            </div>
            <div className="text-xs font-bold text-white">
              {isReadingFiles
                ? 'Dosyalar okunuyor...'
                : 'Dosyaları buraya sürükleyip bırakın veya bilgisayarınızdan seçin'}
            </div>
            <div className="text-[11px] text-[#8c857f]">
              PDF, Excel, Word, Görsel, Video, ZIP/RAR, DWG, PSD dahil her türlü dosya yüklenebilir
            </div>
          </div>

          {/* Seçilen Dosyalar Listesi */}
          {pendingFiles.length > 0 && (
            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              <div className="text-[11px] font-semibold text-[#d6beae]">
                Yüklenecek Dosyalar ({pendingFiles.length}):
              </div>
              {pendingFiles.map((item) => (
                <div
                  key={item.id}
                  className="p-2.5 rounded-[14px] bg-[#24211f] border border-[#4a443f] flex items-center justify-between gap-2.5"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {getFileIcon(item.detectedType)}
                    <div className="min-w-0 flex-1">
                      <input
                        type="text"
                        value={item.customName}
                        onChange={(e) => {
                          const val = e.target.value
                          setPendingFiles((prev) =>
                            prev.map((p) => (p.id === item.id ? { ...p, customName: val } : p))
                          )
                        }}
                        className="w-full bg-transparent text-xs font-semibold text-white focus:outline-none border-b border-transparent focus:border-[#b99881]"
                        title="Dosya adını düzenleyebilirsiniz"
                      />
                      <div className="text-[10px] text-[#8c857f] mt-0.5">
                        {item.sizeText}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setPendingFiles((prev) => prev.filter((p) => p.id !== item.id))
                    }
                    className="p-1.5 rounded-full hover:bg-rose-500/15 text-[#8c857f] hover:text-rose-400 transition-colors cursor-pointer shrink-0"
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
            <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
              Kategori / Klasör
            </label>
            <select
              value={folder}
              onChange={(e) => setFolder(e.target.value as FileCategory)}
              className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
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
            <label className="block text-xs font-semibold text-[#f3efe9] mb-2">
              Paylaşım Hedefi *
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setShareTarget('ALL_TEAM')}
                className={`p-2.5 rounded-[12px] text-xs font-medium border transition-colors cursor-pointer text-center ${
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
                className={`p-2.5 rounded-[12px] text-xs font-medium border transition-colors cursor-pointer text-center ${
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
                className={`p-2.5 rounded-[12px] text-xs font-medium border transition-colors cursor-pointer text-center ${
                  shareTarget === 'MANAGEMENT'
                    ? 'bg-[#b99881]/20 border-[#b99881] text-white font-bold'
                    : 'bg-[#24211f] border-[#4a443f] text-[#a69f99]'
                }`}
              >
                Yönetim Özel
              </button>
            </div>
          </div>

          {/* Çoklu Departman Seçici (Eğer DEPARTMENTS seçildiyse) */}
          {shareTarget === 'DEPARTMENTS' && (
            <div className="p-3 rounded-[14px] bg-[#24211f] border border-[#4a443f] space-y-2">
              <div className="text-[11px] font-semibold text-[#b99881]">
                Erişebilecek Departmanları Seçin (Birden Fazla):
              </div>
              <div className="grid grid-cols-2 gap-2">
                {CANONICAL_DEPARTMENTS.map((dept) => {
                  const isChecked = selectedDepts.includes(dept)
                  return (
                    <label
                      key={dept}
                      className="flex items-center gap-2 text-xs text-[#f3efe9] cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleDeptToggle(dept)}
                        className="rounded border-[#4a443f] text-[#b99881] focus:ring-0"
                      />
                      <span>{dept}</span>
                    </label>
                  )
                })}
              </div>
              <div className="p-2.5 rounded-[10px] bg-[#34302d] border border-[#4a443f] text-[11px] text-[#a69f99] flex items-start gap-2">
                <Lock className="w-3.5 h-3.5 text-[#b99881] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white font-medium">Departman İzolasyonu:</strong> Bu dosya yalnızca yukarıda işaretlediğiniz departman(lar)ın panellerinde görünür.
                </span>
              </div>
            </div>
          )}

          {/* Yetkiler (Görüntüleme, Düzenleme, Yeniden Paylaşma) */}
          <div className="p-3 rounded-[14px] bg-[#24211f] border border-[#4a443f] space-y-2">
            <div className="text-[11px] font-semibold text-[#b99881]">
              Ayrıştırılmış İzinler:
            </div>
            <div className="flex items-center gap-4 text-xs text-[#f3efe9]">
              <label className="flex items-center gap-1.5 opacity-80">
                <input type="checkbox" checked disabled className="rounded text-[#b99881]" />
                <span>Görüntüleme (Zorunlu)</span>
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

          <div className="pt-2 flex justify-end gap-2">
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
