import { AppUser } from './userStore'
import { Department } from '@/types/department'
import { permissionService } from './permissionService'

export type ShareTarget = 'ALL_TEAM' | 'DEPARTMENTS' | 'MEMBERS' | 'MANAGEMENT'
export type FileCategory = 'Proje Katalogları' | 'Satış Sözleşmeleri' | 'Mimari Çizimler' | 'Lansman Videoları' | 'Finans & Muhasebe'

export interface SharedFileAudit {
  userId: string
  userName: string
  downloadedAt: string
}

export interface SharedFile {
  id: string
  name: string
  folder: FileCategory
  size: string
  type: 'pdf' | 'excel' | 'video' | 'image' | 'archive' | 'doc'
  uploadedByUserId: string
  uploadedByUserName: string
  createdAt: string
  updatedAt: string
  shareTarget: ShareTarget
  targetDepartments?: Department[]
  targetMemberIds?: string[]
  permissions: {
    canView: boolean
    canEdit: boolean
    canReshare: boolean
  }
  downloadCount: number
  downloadsAudit: SharedFileAudit[]
}

const STORAGE_KEY_FILES = 'demirturk_shared_files_v2'

const INITIAL_FILES: SharedFile[] = [
  {
    id: 'f-1',
    name: 'Demirturk_Panorama_Satis_Katalogu_2026.pdf',
    folder: 'Proje Katalogları',
    size: '18.4 MB',
    type: 'pdf',
    uploadedByUserId: 'usr-admin',
    uploadedByUserName: 'Sistem Yöneticisi',
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    shareTarget: 'ALL_TEAM',
    permissions: {
      canView: true,
      canEdit: false,
      canReshare: true,
    },
    downloadCount: 14,
    downloadsAudit: [],
  },
  {
    id: 'f-2',
    name: 'Standart_Gayrimenkul_Satis_Vaadi_Sozlesmesi_v3.docx',
    folder: 'Satış Sözleşmeleri',
    size: '2.1 MB',
    type: 'doc',
    uploadedByUserId: 'usr-admin',
    uploadedByUserName: 'Hukuk & Yönetim',
    createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    shareTarget: 'DEPARTMENTS',
    targetDepartments: ['Satış', 'Müşteri İlişkileri', 'Yönetim'],
    permissions: {
      canView: true,
      canEdit: true,
      canReshare: false,
    },
    downloadCount: 9,
    downloadsAudit: [],
  },
  {
    id: 'f-3',
    name: 'Ege_Vadi_Mimari_Kat_Planlari_DWG_Detay.zip',
    folder: 'Mimari Çizimler',
    size: '45.2 MB',
    type: 'archive',
    uploadedByUserId: 'usr-admin',
    uploadedByUserName: 'Proje Koordinatörü',
    createdAt: new Date(Date.now() - 86400000 * 15).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 15).toISOString(),
    shareTarget: 'DEPARTMENTS',
    targetDepartments: ['Satış', 'Pazarlama'],
    permissions: {
      canView: true,
      canEdit: false,
      canReshare: true,
    },
    downloadCount: 6,
    downloadsAudit: [],
  },
  {
    id: 'f-4',
    name: '2026_Q3_Yonetim_Kurulu_Finansal_Ciro_Raporu.xlsx',
    folder: 'Finans & Muhasebe',
    size: '4.8 MB',
    type: 'excel',
    uploadedByUserId: 'usr-admin',
    uploadedByUserName: 'Finans Direktörü',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    shareTarget: 'MANAGEMENT',
    permissions: {
      canView: true,
      canEdit: true,
      canReshare: false,
    },
    downloadCount: 3,
    downloadsAudit: [],
  },
]

type Listener = () => void

class SharedFileStore {
  private files: SharedFile[] = []
  private listeners: Set<Listener> = new Set()

  constructor() {
    this.loadFromStorage()
  }

  private loadFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_FILES)
      if (saved) {
        const parsed = JSON.parse(saved)
        this.files = Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_FILES
      } else {
        this.files = INITIAL_FILES
      }
    } catch {
      this.files = INITIAL_FILES
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY_FILES, JSON.stringify(this.files))
    } catch (e) {
      console.error('SharedFileStore save error:', e)
    }
    this.notify()
  }

  private notify() {
    this.listeners.forEach((cb) => cb())
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Filter files authoritatively by user permissions
   */
  public getFilesForUser(user: AppUser | null): SharedFile[] {
    if (!user) return []
    return this.files.filter((file) => permissionService.canAccessFile(user, file))
  }

  public getById(id: string, user: AppUser | null): SharedFile | undefined {
    const file = this.files.find((f) => f.id === id)
    if (!file) return undefined
    if (!permissionService.canAccessFile(user, file)) return undefined
    return file
  }

  /**
   * Secure upload with explicit target configuration
   */
  public uploadFile(
    data: {
      name: string
      folder: FileCategory
      size?: string
      type?: SharedFile['type']
      shareTarget: ShareTarget
      targetDepartments?: Department[]
      targetMemberIds?: string[]
      permissions?: {
        canView: boolean
        canEdit: boolean
        canReshare: boolean
      }
    },
    user: AppUser
  ): SharedFile {
    const newFile: SharedFile = {
      id: 'f-' + Date.now(),
      name: data.name.trim(),
      folder: data.folder,
      size: data.size || '4.2 MB',
      type: data.type || 'pdf',
      uploadedByUserId: user.id,
      uploadedByUserName: user.fullName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      shareTarget: data.shareTarget,
      targetDepartments: data.targetDepartments,
      targetMemberIds: data.targetMemberIds,
      permissions: {
        canView: true,
        canEdit: data.permissions?.canEdit ?? false,
        canReshare: data.permissions?.canReshare ?? true,
      },
      downloadCount: 0,
      downloadsAudit: [],
    }

    this.files = [newFile, ...this.files]
    this.saveToStorage()
    return newFile
  }

  /**
   * Secure Download - Verifies permission and logs download audit trail
   */
  public downloadFile(
    fileId: string,
    user: AppUser
  ): { success: boolean; error?: string; file?: SharedFile } {
    const file = this.files.find((f) => f.id === fileId)
    if (!file) {
      return { success: false, error: 'Dosya bulunamadı.' }
    }

    if (!permissionService.canDownloadFile(user, file)) {
      return {
        success: false,
        error: 'Bu dosyayı görüntüleme veya indirme yetkiniz bulunmamaktadır.',
      }
    }

    file.downloadCount += 1
    file.downloadsAudit.unshift({
      userId: user.id,
      userName: user.fullName,
      downloadedAt: new Date().toISOString(),
    })

    this.saveToStorage()
    return { success: true, file }
  }

  public deleteFile(
    fileId: string,
    user: AppUser
  ): { success: boolean; error?: string } {
    const file = this.files.find((f) => f.id === fileId)
    if (!file) return { success: false, error: 'Dosya bulunamadı.' }

    const isOwner = file.uploadedByUserId === user.id
    const isAuthorized = isOwner || user.role === 'ADMIN' || user.isManager
    if (!isAuthorized) {
      return { success: false, error: 'Dosyayı yalnızca yükleyen kişi veya yönetici silebilir.' }
    }

    this.files = this.files.filter((f) => f.id !== fileId)
    this.saveToStorage()
    return { success: true }
  }
}

export const sharedFileStore = new SharedFileStore()
