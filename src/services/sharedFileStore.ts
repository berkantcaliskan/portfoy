import { userStore, type AppUser } from './userStore'
import { isCentralCrm } from './crmRuntime'
import { createCrmServerCollection } from './crmServerCollection'
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
  storagePath?: string
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
  private backend = createCrmServerCollection<SharedFile>('files', () => {
    const user = userStore.getCurrentUser(), client = userStore.getServerClient()
    return user && client ? { id: user.id, client } : null
  })
  private uploading = false
  private pendingUpload: { key: string; file: SharedFile; uploaded: boolean } | null = null
  private previews = new Map<string, string>()
  public setAccount(id: string | null) { this.backend.setAccount(id); this.pendingUpload = null; this.previews.clear() }
  public async refreshFromBackend() {
    await this.backend.refresh()
    const actor = userStore.getCurrentUser()?.id, client = userStore.getServerClient()
    const paths = this.backend.getAll().filter(file => file.type === 'image' || file.type === 'video')
      .map(file => file.storagePath).filter((path): path is string => Boolean(path))
    if (!client || !actor || !paths.length) return
    const { data } = await client.storage.from('crm-private').createSignedUrls(paths, 300)
    if (actor !== userStore.getCurrentUser()?.id) return
    this.previews = new Map((data || []).filter(item => item.signedUrl && item.path).map(item => [item.path!, item.signedUrl!]))
    this.notify()
  }
  public getReadError() { return this.backend.getError() }
  private files: SharedFile[] = []
  private listeners: Set<Listener> = new Set()
  private realtimeChannel: any = null

  constructor() {
    this.backend.subscribe(() => this.notify())
    if (isCentralCrm()) return
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
    if (isCentralCrm()) return
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
    if (isCentralCrm()) return this.backend.getAll().filter(file => permissionService.canAccessFile(user, file))
      .map(file => ({ ...file, fileDataUrl: file.storagePath ? this.previews.get(file.storagePath) : undefined }))
    return this.files.filter((file) => permissionService.canAccessFile(user, file))
  }

  public getById(id: string, user: AppUser | null): SharedFile | undefined {
    if (isCentralCrm()) return this.getFilesForUser(user).find(file => file.id === id)
    const file = this.files.find((f) => f.id === id)
    if (!file) return undefined
    if (!permissionService.canAccessFile(user, file)) return undefined
    return file
  }

  /**
   * Secure upload with explicit target configuration
   */
  public async uploadFile(
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
  ): Promise<SharedFile> {
    const cleanNotes = sanitizeFileNotes(data.notes, data.folder)
    const newFile: SharedFile = {
      id: isCentralCrm() ? 'f-' + crypto.randomUUID() : 'f-' + Date.now() + '-' + Math.floor(100 + Math.random() * 900),
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

    if (isCentralCrm()) {
      if (this.uploading) throw new Error('Önceki dosya yüklemesi sürüyor.')
      this.uploading = true
      try {
      const client = userStore.getServerClient()
      if (!client || user.id !== userStore.getCurrentUser()?.id || !data.fileDataUrl?.startsWith('data:')) throw new Error('Dosya ve sunucu oturumu gerekli.')
      const blob = await (await fetch(data.fileDataUrl)).blob()
      if (!blob.size || blob.size > 20 * 1024 * 1024) throw new Error('Dosya boyutu 20 MB sınırını aşmamalı.')
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())), byte => byte.toString(16).padStart(2, '0')).join('')
      const key = JSON.stringify([user.id, hash, data.name, data.notes, data.shareTarget, data.targetDepartments, data.targetMemberIds])
      if (this.pendingUpload && this.pendingUpload.key !== key) throw new Error('Önce önceki dosya yüklemesinin sonucunu kontrol edin.')
      if (!this.pendingUpload) {
        const { data: identity, error } = await client.auth.getUser()
        if (error || !identity.user) throw new Error('Sunucu oturumu doğrulanamadı.')
        delete newFile.fileDataUrl
        newFile.storagePath = `${identity.user.id}/${newFile.id}`
        this.pendingUpload = { key, file: newFile, uploaded: false }
      }
      const pending = this.pendingUpload
      if (!pending.uploaded) {
        const { error } = await client.storage.from('crm-private').upload(pending.file.storagePath!, blob, { contentType: data.mimeType || blob.type, upsert: false })
        if (error && error.statusCode !== '409') throw new Error('Dosya yüklenemedi. Aynı dosyayla tekrar deneyin.')
        pending.uploaded = true
      }
      const saved = await this.backend.save(key, pending.file)
      this.pendingUpload = null
      return saved
      } finally { this.uploading = false }
    }

    this.files = [newFile, ...this.files]
    this.saveToStorage()
    this.persistCloudFile(newFile)
    return newFile
  }

  public async updateFileNotes(
    fileId: string,
    notes: string,
    user: AppUser
  ): Promise<{ success: boolean; error?: string }> {
    if (isCentralCrm()) {
      const target = this.getById(fileId, user)
      if (!target) throw new Error('Dosya bulunamadı veya erişim izni yok.')
      delete target.fileDataUrl
      await this.backend.save(JSON.stringify(['notes', fileId, notes]), { ...target, notes: notes.trim(), folder: notes.trim() }, false, false, true)
      return { success: true }
    }
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
  public async downloadFile(
    fileId: string,
    user: AppUser
  ): Promise<{ success: boolean; error?: string; file?: SharedFile }> {
    if (isCentralCrm()) {
      const target = this.getById(fileId, user), client = userStore.getServerClient()
      if (!target?.storagePath || !client) throw new Error('Dosya sunucuda bulunamadı veya erişim izni yok.')
      const { data: blob, error } = await client.storage.from('crm-private').download(target.storagePath)
      if (error || !blob) throw new Error('Dosya indirilemedi. Erişim iznini ve bağlantıyı kontrol edin.')
      const { error: auditError } = await client.rpc('crm_log_file_download', { p_id: fileId, p_request: crypto.randomUUID() })
      if (auditError) throw new Error('İndirme kaydı sunucuda doğrulanamadı.')
      const url = URL.createObjectURL(blob)
      setTimeout(() => URL.revokeObjectURL(url), 120000)
      void this.refreshFromBackend()
      return { success: true, file: { ...target, fileDataUrl: url } }
    }
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

  public async deleteFile(
    fileId: string,
    user: AppUser
  ): Promise<{ success: boolean; error?: string }> {
    if (isCentralCrm()) {
      const target = this.getById(fileId, user)
      if (!target) throw new Error('Dosya bulunamadı veya erişim izni yok.')
      delete target.fileDataUrl
      await this.backend.save(JSON.stringify(['archive', fileId]), target, true)
      return { success: true }
    }
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
