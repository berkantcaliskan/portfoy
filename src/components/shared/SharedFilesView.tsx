import React, { useState, useEffect } from 'react'
import {
  Share2,
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
  Layers,
  Users,
  Shield,
  Lock,
  Eye,
  AlertCircle,
  Folder,
} from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlassButton } from '@/components/ui/GlassButton'
import { GlassBadge } from '@/components/ui/GlassBadge'
import { GlassModal } from '@/components/ui/GlassModal'
import {
  sharedFileStore,
  SharedFile,
  ShareTarget,
  FileCategory,
} from '@/services/sharedFileStore'
import { userStore, AppUser } from '@/services/userStore'
import { Department, CANONICAL_DEPARTMENTS } from '@/types/department'
import { permissionService } from '@/services/permissionService'

export const SharedFilesView: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(userStore.getCurrentUser())
  const [files, setFiles] = useState<SharedFile[]>(() => sharedFileStore.getFilesForUser(currentUser))
  const [selectedFolder, setSelectedFolder] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [downloadSuccessMessage, setDownloadSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Upload Form State
  const [fileName, setFileName] = useState('')
  const [folder, setFolder] = useState<FileCategory>('Proje Katalogları')
  const [fileType, setFileType] = useState<SharedFile['type']>('pdf')
  const [shareTarget, setShareTarget] = useState<ShareTarget>('DEPARTMENTS')
  const [selectedDepts, setSelectedDepts] = useState<Department[]>(() => {
    const d = userStore.getCurrentUser()?.department
    return d ? [d] : ['Pazarlama']
  })
  const [canEdit, setCanEdit] = useState(false)
  const [canReshare, setCanReshare] = useState(true)

  const allUsers = userStore.getAllUsers()

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

  const handleDownload = (file: SharedFile) => {
    if (!currentUser) return
    const res = sharedFileStore.downloadFile(file.id, currentUser)
    if (!res.success) {
      setErrorMessage(res.error || 'İndirme izniniz bulunmuyor.')
      setTimeout(() => setErrorMessage(null), 3500)
      return
    }

    setDownloadSuccessMessage(`"${file.name}" güvenli olarak indirildi. (İndirme günlüğüne kaydedildi)`)
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
    if (!currentUser || !fileName.trim()) return

    if (shareTarget === 'DEPARTMENTS' && selectedDepts.length === 0) {
      setErrorMessage('Lütfen dosyanın paylaşılacağı en az bir departman seçin.')
      setTimeout(() => setErrorMessage(null), 3000)
      return
    }

    sharedFileStore.uploadFile(
      {
        name: fileName.trim(),
        folder,
        type: fileType,
        size: '12.4 MB',
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

    setIsUploadModalOpen(false)
    setFileName('')
    setDownloadSuccessMessage('Yeni dosya seçilen hedef yetkileriyle paylaşıldı.')
    setTimeout(() => setDownloadSuccessMessage(null), 3000)
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
      case 'archive':
        return <Archive className="w-5 h-5 text-amber-400" />
      default:
        return <FileText className="w-5 h-5 text-[#b99881]" />
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
      {/* Title Header (Katmansız, Çizgisiz, İkonlu) */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Cloud className="w-5 h-5 text-[#b99881]" />
            <h2 className="text-2xl font-bold text-white tracking-wide">
              Paylaşılanlar
            </h2>
          </div>
          <p className="text-xs text-[#a69f99] mt-1">
            Hedef departman ve üyeler bazında yetkilendirilmiş, güvenli kurumsal dosya ve katalog paylaşımı.
          </p>
        </div>

        <GlassButton
          variant="gold"
          size="sm"
          icon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => setIsUploadModalOpen(true)}
          className="rounded-full px-4 text-xs font-semibold"
        >
          Hedefli Dosya Paylaş
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

      {/* Kategori ve Filtre Çubuğu (Katmansız, Pill Shape) */}
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
          <h3 className="text-sm font-semibold text-white">Erişilebilir dosya bulunamadı</h3>
          <p className="text-xs text-[#8c857f] mt-1 max-w-sm mx-auto">
            Çalışma alanınız ve yetkilerinize uygun tanımlanmış bir paylaşılan dosya bulunmuyor.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFiles.map((file) => {
            const isOwner = file.uploadedByUserId === currentUser?.id
            const canReshare = permissionService.canReshareFile(currentUser, file)

            return (
              <div
                key={file.id}
                className="p-4 rounded-[20px] bg-[#282522] border border-[#4a443f] hover:border-[#b99881]/70 transition-all duration-200 flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      {getFileIcon(file.type)}
                      <div>
                        <h4 className="text-xs font-bold text-white line-clamp-1" title={file.name}>
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
                      onClick={() => handleDownload(file)}
                      className="p-2 rounded-full bg-[#34302d] hover:bg-[#b99881] text-[#b99881] hover:text-[#282522] transition-colors cursor-pointer"
                      title="Güvenli İndir (Audit Trail)"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    {isOwner && (
                      <button
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

      {/* HEDEFLİ DOSYA PAYLAŞ MODALI */}
      <GlassModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Hedefli ve Güvenli Dosya Paylaş"
      >
        <form onSubmit={handleUploadSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
              Dosya Adı *
            </label>
            <input
              type="text"
              required
              placeholder="Örn: 2026_Q3_Satis_Sunumu.pdf"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Kategori
              </label>
              <select
                value={folder}
                onChange={(e) => setFolder(e.target.value as FileCategory)}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Dosya Türü
              </label>
              <select
                value={fileType}
                onChange={(e) => setFileType(e.target.value as any)}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              >
                <option value="pdf">PDF Belgesi</option>
                <option value="excel">Excel Tablosu</option>
                <option value="doc">Word / Sözleşme</option>
                <option value="archive">ZIP / Arşiv</option>
                <option value="video">Tanıtım Videosu</option>
              </select>
            </div>
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
                    <label key={dept} className="flex items-center gap-2 text-xs text-[#f3efe9] cursor-pointer">
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
                  <strong className="text-white font-medium">Departman İzolasyonu:</strong> Bu dosya yalnızca yukarıda işaretlediğiniz departman(lar)ın panellerinde görünür. Diğer departman personelleri dosyayı göremez, arayamaz veya indiremez.
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
              onClick={() => setIsUploadModalOpen(false)}
              className="px-4 py-2 rounded-full text-xs text-[#a69f99] hover:text-white cursor-pointer"
            >
              Vazgeç
            </button>
            <GlassButton type="submit" variant="gold" size="sm" className="rounded-full px-5 font-bold">
              Paylaşımı Başlat
            </GlassButton>
          </div>
        </form>
      </GlassModal>
    </div>
  )
}
