import { AppUser } from './userStore'
import { Department } from '@/types/department'
import { permissionService } from './permissionService'
import { supabase, isSupabaseConfigured } from './supabaseClient'
import { sharedFileToRow, rowToSharedFile } from './dbMapper'

export type ShareTarget = 'ALL_TEAM' | 'DEPARTMENTS' | 'MEMBERS' | 'MANAGEMENT'
export type FileCategory = string

const LEGACY_CATEGORIES = new Set([
  'Proje Katalogları',
  'Satış Sözleşmeleri',
  'Mimari Çizimler',
  'Lansman Videoları',
  'Finans & Muhasebe',
])

export function sanitizeFileNotes(notes?: string, folder?: string): string {
  const raw = (notes ?? folder ?? '').trim()
  if (!raw || LEGACY_CATEGORIES.has(raw)) return ''
  return raw
}

export interface SharedFileAudit {
  userId: string
  userName: string
  downloadedAt: string
}

export interface SharedFile {
  id: string
  name: string
  folder?: FileCategory
  notes?: string
  size: string
  type: 'pdf' | 'excel' | 'video' | 'image' | 'archive' | 'doc' | 'audio' | 'other'
  mimeType?: string
  fileDataUrl?: string
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

const INITIAL_FILES: SharedFile[] = []

type Listener = () => void

class SharedFileStore {
  private files: SharedFile[] = []
  private listeners: Set<Listener> = new Set()
  private realtimeChannel: any = null

  constructor() {
    this.loadFromStorage()
    this.initRealtime()
    if (typeof window !== 'undefined') {
      window.addEventListener('demirturk:cloud-db-synced', () => {
        this.loadFromStorage()
        this.notify()
      })
    }
  }

  public setLoadedFiles(files: SharedFile[]) {
    const byId = new Map<string, SharedFile>()
    for (const f of files || []) {
      const cleanNotes = sanitizeFileNotes(f.notes, f.folder)
      byId.set(f.id, { ...f, notes: cleanNotes, folder: cleanNotes })
    }
    for (const local of this.files) {
      if (!byId.has(local.id)) {
        const cleanNotes = sanitizeFileNotes(local.notes, local.folder)
        const normalized = { ...local, notes: cleanNotes, folder: cleanNotes }
        byId.set(local.id, normalized)
        this.persistCloudFile(normalized)
      }
    }
    this.files = Array.from(byId.values())
    try {
      localStorage.setItem(STORAGE_KEY_FILES, JSON.stringify(this.files))
    } catch {}
    this.notify()
  }

  private initRealtime() {
    if (!isSupabaseConfigured() || this.realtimeChannel) return
    this.realtimeChannel = supabase
      .channel('realtime:shared_files')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_files' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const incoming = rowToSharedFile(payload.new)
          if (!this.files.some((f) => f.id === incoming.id)) {
            this.files = [incoming, ...this.files]
            this.saveToStorage()
          }
        } else if (payload.eventType === 'UPDATE') {
          const incoming = rowToSharedFile(payload.new)
          const idx = this.files.findIndex((f) => f.id === incoming.id)
          if (idx !== -1) {
            this.files[idx] = incoming
            this.saveToStorage()
          }
        } else if (payload.eventType === 'DELETE') {
          const deletedId = (payload.old as any)?.id
          if (deletedId) {
            this.files = this.files.filter((f) => f.id !== deletedId)
            this.saveToStorage()
          }
        }
      })
      .subscribe()
  }

  private loadFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_FILES)
      if (saved) {
        const parsed = JSON.parse(saved)
        this.files = Array.isArray(parsed)
          ? parsed.map((f: any) => {
              const cleanNotes = sanitizeFileNotes(f?.notes, f?.folder)
              return { ...f, notes: cleanNotes, folder: cleanNotes }
            })
          : []
      } else {
        this.files = []
      }
    } catch {
      this.files = []
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
      folder?: FileCategory
      notes?: string
      size?: string
      type?: SharedFile['type']
      mimeType?: string
      fileDataUrl?: string
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
    const cleanNotes = sanitizeFileNotes(data.notes, data.folder)
    const newFile: SharedFile = {
      id: 'f-' + Date.now() + '-' + Math.floor(100 + Math.random() * 900),
      name: data.name.trim(),
      folder: cleanNotes,
      notes: cleanNotes,
      size: data.size || '1.0 MB',
      type: data.type || 'other',
      mimeType: data.mimeType,
      fileDataUrl: data.fileDataUrl,
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
    this.persistCloudFile(newFile)
    return newFile
  }

  public updateFileNotes(
    fileId: string,
    notes: string,
    user: AppUser
  ): { success: boolean; error?: string } {
    const file = this.files.find((f) => f.id === fileId)
    if (!file) return { success: false, error: 'Dosya bulunamadı.' }
    if (!permissionService.canAccessFile(user, file)) {
      return { success: false, error: 'Bu dosyaya erişim yetkiniz yok.' }
    }
    const clean = notes.trim()
    file.notes = clean
    file.folder = clean
    file.updatedAt = new Date().toISOString()
    this.saveToStorage()
    this.persistCloudFile(file)
    return { success: true }
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
    this.persistCloudFile(file)
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
    this.deleteCloudFile(fileId)
    return { success: true }
  }

  private async persistCloudFile(file: SharedFile) {
    if (!isSupabaseConfigured()) return
    try {
      await supabase.from('shared_files').upsert(sharedFileToRow(file))
    } catch {}
  }

  private async deleteCloudFile(fileId: string) {
    if (!isSupabaseConfigured()) return
    try {
      await supabase.from('shared_files').delete().eq('id', fileId)
    } catch {}
  }
}

export const sharedFileStore = new SharedFileStore()
