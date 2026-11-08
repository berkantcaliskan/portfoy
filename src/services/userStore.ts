import {
  Department,
  UserRole,
  AccessScope,
  UserPermissions,
  CANONICAL_DEPARTMENTS,
  normalizeDepartmentName,
} from '@/types/department'
import { supabase, isSupabaseConfigured } from './supabaseClient'
import { syncService } from './syncService'
import { rowToUser } from './dbMapper'
import {isCentralCrm} from './crmRuntime'
import {createBackendPreviewClient} from './crmBackendClient'
import {createCrmAuthService,type CrmAuthProfile} from './crmAuthService'
import {createCrmMainSession} from './crmMainSession'

export type { Department, UserRole, AccessScope, UserPermissions }

export interface AppUser {
  id: string
  fullName: string
  username: string
  password: string // Stored representation
  email?: string
  avatarUrl?: string
  companyName: string
  department: Department // Aktif çalışma alanı
  departments: Department[] // Kaydeden tarafından atanan ve erişebileceği tüm departmanlar
  role: UserRole
  isManager: boolean
  scope: AccessScope // ALL | DEPARTMENT | ASSIGNED_ONLY
  permissions: UserPermissions
  mustChangePassword?: boolean
  createdAt: string
  updatedAt?: string
  serverRevision?: number
}

export function normalizeTurkish(text: string): string {
  return text
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/Ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/Ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/Ş/g, 's')
    .replace(/ü/g, 'u')
    .replace(/Ü/g, 'u')
    .toLowerCase()
    .trim()
}

export function generateUsername(fullName: string, existingUsers: { username: string }[]): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'kullanici'

  const firstName = (normalizeTurkish(parts[0]).replace(/[^a-z0-9]/g, '') || 'kullanici').padEnd(3, '1').slice(0, 35)
  const taken = new Set(existingUsers.map((u) => u.username.toLowerCase()))

  // İlk başta yalnızca ad (aynı ad varsa sonuna numara eklenir)
  if (!taken.has(firstName)) {
    return firstName
  }

  let counter = 2
  while (taken.has(`${firstName}${counter}`)) {
    counter++
  }
  return `${firstName}${counter}`
}

export function generateInitialPassword(): string {
  // Otomatik 6 haneli yalnızca sayı şifre (100000 - 999999)
  const firstDigit = Math.floor(1 + Math.random() * 9).toString()
  let rest = ''
  for (let i = 0; i < 5; i++) {
    rest += Math.floor(Math.random() * 10).toString()
  }
  return firstDigit + rest
}

const STORAGE_KEY_USERS = 'demirturk_users_v2'
const STORAGE_KEY_CURRENT_USER = 'demirturk_active_user_v2'

type Listener = () => void

class UserStore {
  readonly centralAuthEnabled=isCentralCrm()
  private serverSession:ReturnType<typeof createCrmMainSession>|null=null
  private serverClient: ReturnType<typeof createBackendPreviewClient> | null = null

  getServerClient() {
    return this.serverClient
  }
  private serverAuthStarted=false
  private serverLoginPending=false
  private pendingStaffCreation: { key: string; requestId: string; username: string } | null = null
  private users: AppUser[] = []
  private currentUser: AppUser | null = null
  private listeners: Set<Listener> = new Set()
  private realtimeChannel: any = null

  constructor() {
    if(this.centralAuthEnabled)return
    this.loadFromStorage()
    this.initRealtime()
    if (typeof window !== 'undefined') {
      window.addEventListener('demirturk:cloud-db-synced', () => {
        this.reloadUsersFromStorage()
      })
    }
  }

  public reloadUsersFromStorage() {
    if(this.centralAuthEnabled)return
    try {
      const savedUsers = localStorage.getItem(STORAGE_KEY_USERS)
      if (!savedUsers) return
      const raw = JSON.parse(savedUsers)
      if (!Array.isArray(raw)) return
      const incoming = raw.map((u) => this.normalizeUser(u))
      const mergedMap = new Map<string, AppUser>()
      for (const u of this.users) mergedMap.set(u.id, u)
      for (const inc of incoming) mergedMap.set(inc.id, inc)
      this.users = Array.from(mergedMap.values())
      if (this.currentUser) {
        const activeWorkspaceDept = this.currentUser.department
        const updatedCurrent = this.users.find((u) => u.id === this.currentUser?.id)
        if (updatedCurrent) {
          const canKeepWorkspace =
            updatedCurrent.role === 'ADMIN' ||
            updatedCurrent.departments.includes(activeWorkspaceDept)
          this.currentUser = {
            ...updatedCurrent,
            department: canKeepWorkspace ? activeWorkspaceDept : updatedCurrent.department,
          }
        }
      }
      this.notify()
    } catch {}
  }

  public setLoadedUsers(users: AppUser[]) {
    if(this.centralAuthEnabled)return
    if (Array.isArray(users)) {
      if (users.length === 0) {
        // Keep all local users if cloud is empty, and push local users up to cloud
        if (this.users.length > 0) {
          this.users.forEach((u) => syncService.saveUser(u))
        }
        return
      }

      const incomingNormalized = users.map((u) => {
        const normalized = this.normalizeUser(u)
        if (!normalized.avatarUrl) {
          const inMemoryUser = this.users.find((eu) => eu.id === normalized.id)
          if (inMemoryUser?.avatarUrl) {
            normalized.avatarUrl = inMemoryUser.avatarUrl
          }
        }
        return normalized
      })

      // Merge local users with incoming cloud users without losing any local users
      const mergedMap = new Map<string, AppUser>()
      for (const inc of incomingNormalized) {
        mergedMap.set(inc.id, inc)
      }
      for (const localUser of this.users) {
        if (!mergedMap.has(localUser.id)) {
          mergedMap.set(localUser.id, localUser)
          syncService.saveUser(localUser)
        } else {
          // Prefer local user fields if recently updated locally
          mergedMap.set(localUser.id, { ...mergedMap.get(localUser.id)!, ...localUser })
        }
      }

      this.users = Array.from(mergedMap.values())
      try {
        localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(this.users))
      } catch {}
      const isLoggedOut = typeof window !== 'undefined' && localStorage.getItem('demirturk_logged_out') === 'true'
      if (!isLoggedOut && this.currentUser) {
        const syncedUser = this.users.find((u) => u.id === this.currentUser?.id)
        if (syncedUser) {
          this.currentUser = syncedUser
          try {
            localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(this.currentUser))
          } catch {}
        }
      }
      this.notify()
    }
  }

  private initRealtime() {
    if (!isSupabaseConfigured() || this.realtimeChannel) return
    this.realtimeChannel = supabase
      .channel('realtime:app_users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_users' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const incoming = this.normalizeUser(rowToUser(payload.new))
          if (!this.users.some((u) => u.id === incoming.id)) {
            this.users = [...this.users, incoming]
            this.saveToStorage()
          }
        } else if (payload.eventType === 'UPDATE') {
          const incoming = this.normalizeUser(rowToUser(payload.new))
          const idx = this.users.findIndex((u) => u.id === incoming.id)
          if (idx !== -1) {
            this.users[idx] = incoming
            if (this.currentUser?.id === incoming.id) {
              this.currentUser = incoming
            }
            this.saveToStorage()
          }
        } else if (payload.eventType === 'DELETE') {
          this.users = this.users.filter((u) => u.id !== (payload.old as any).id)
          if (this.currentUser && !this.users.some((u) => u.id === this.currentUser?.id)) {
            this.currentUser = null
          }
          this.saveToStorage()
        }
      })
      .subscribe()
  }

  private normalizeUser(user: any): AppUser {
    const normalizedDept = normalizeDepartmentName(user.department || 'Yönetim')
    const isAdmin = user.role === 'ADMIN'
    const rawDepts =
      isAdmin
        ? CANONICAL_DEPARTMENTS
        : Array.isArray(user.departments) && user.departments.length > 0
        ? user.departments
        : [normalizedDept]
    const departments: Department[] = Array.from(new Set(rawDepts.map(normalizeDepartmentName)))

    const isManager = Boolean(user.isManager || user.role === 'ADMIN' || user.role === 'MANAGER')
    const role: UserRole = user.role === 'ADMIN' ? 'ADMIN' : (user.role || (isManager ? 'MANAGER' : 'REPRESENTATIVE'))
    const scope: AccessScope = user.scope || (role === 'ADMIN' ? 'ALL' : (isManager ? 'DEPARTMENT' : 'ASSIGNED_ONLY'))

    const defaultPermissions: UserPermissions = {
      canPullLeads:
        role === 'ADMIN' ||
        normalizedDept === 'Yönetim' ||
        (normalizedDept === 'Pazarlama' && isManager),
      canAddCustomer: true,
      canDeleteCustomer:
        role === 'ADMIN' ||
        normalizedDept === 'Yönetim' ||
        (normalizedDept === 'Pazarlama' && isManager),
      canAssignConsultant:
        role === 'ADMIN' ||
        normalizedDept === 'Yönetim' ||
        isManager ||
        normalizedDept === 'Müşteri İlişkileri',
      canChangeStage: true,
      canManageMetaConfig:
        role === 'ADMIN' ||
        normalizedDept === 'Yönetim' ||
        (normalizedDept === 'Pazarlama' && isManager),
      canEditProjectPrice: role === 'ADMIN' || (role === 'MANAGER' && normalizedDept === 'Yönetim'),
      canChangeFlatStatus: role === 'ADMIN' || normalizedDept === 'Satış' || normalizedDept === 'Yönetim',
      canApproveDiscounts: role === 'ADMIN' || normalizedDept === 'Yönetim',
      canRefundDeposit: role === 'ADMIN' || normalizedDept === 'Muhasebe' || normalizedDept === 'Yönetim',
      canManageTeam: role === 'ADMIN' || normalizedDept === 'Yönetim' || isManager,
      canReshareFiles: true,
      ...user.permissions,
    }

    const userId = user.id || 'usr-' + Date.now()
    let avatarUrl: string | undefined = undefined
    if (user.avatarUrl) {
      avatarUrl = user.avatarUrl
    } else if (user.avatar_url) {
      avatarUrl = user.avatar_url
    } else if (!this.centralAuthEnabled && typeof window !== 'undefined') {
      avatarUrl = localStorage.getItem(`demirturk_avatar_${userId}`) || undefined
    }

    return {
      id: userId,
      fullName: user.fullName || 'Kullanıcı',
      username: user.username || 'user',
      password: user.password || '123456',
      serverRevision: Number.isSafeInteger(user.serverRevision) ? user.serverRevision : undefined,
      email: user.email || undefined,
      avatarUrl,
      companyName: user.companyName || 'Demirtürk Portföy',
      department: normalizedDept,
      departments,
      role,
      isManager,
      scope,
      permissions: defaultPermissions,
      mustChangePassword: Boolean(user.mustChangePassword),
      createdAt: user.createdAt || new Date().toISOString(),
      updatedAt: user.updatedAt || undefined,
    }
  }

  private loadFromStorage() {
    try {
      const savedUsers = localStorage.getItem(STORAGE_KEY_USERS)
      if (savedUsers) {
        const raw = JSON.parse(savedUsers)
        this.users = Array.isArray(raw) ? raw.map((u) => this.normalizeUser(u)) : []
      } else {
        this.users = []
      }

      const isExplicitlyLoggedOut =
        typeof window !== 'undefined' && localStorage.getItem('demirturk_logged_out') === 'true'

      if (isExplicitlyLoggedOut || this.users.length === 0) {
        this.currentUser = null
      } else {
        const savedCurrentUser = localStorage.getItem(STORAGE_KEY_CURRENT_USER)
        if (savedCurrentUser) {
          const parsed = JSON.parse(savedCurrentUser)
          const matched = this.users.find(
            (u) => u.id === parsed.id || u.username.toLowerCase() === parsed.username?.toLowerCase()
          )
          if (matched) {
            const norm = this.normalizeUser(matched)
            const savedDept = parsed.department ? normalizeDepartmentName(parsed.department) : norm.department
            const canKeep = norm.role === 'ADMIN' || norm.departments.includes(savedDept)
            this.currentUser = { ...norm, department: canKeep ? savedDept : norm.department }
          } else {
            this.currentUser = null
          }
        } else {
          this.currentUser = null
        }
      }

      if (this.currentUser) {
        localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(this.currentUser))
      } else {
        localStorage.removeItem(STORAGE_KEY_CURRENT_USER)
      }
    } catch (e) {
      console.error('Failed to load users from storage:', e)
      this.users = []
      this.currentUser = null
    }
  }

  private saveToStorage() {
    if(this.centralAuthEnabled){this.notify();return}
    try {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(this.users))
      if (this.currentUser) {
        localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(this.currentUser))
      } else {
        localStorage.removeItem(STORAGE_KEY_CURRENT_USER)
      }
    } catch (e) {
      console.error('Failed to save users to storage:', e)
    }
    this.notify()
  }

  private notify() {
    this.listeners.forEach((listener) => listener())
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getAllUsers(): AppUser[] {
    return [...this.users]
  }

  getAll(): AppUser[] {
    return [...this.users]
  }

  getCurrentUser(): AppUser | null {
    return this.currentUser
  }

  private publishServerProfile(profile:CrmAuthProfile|null){
    if (this.currentUser?.id !== profile?.id) this.pendingStaffCreation = null
    // Parola, yerel kullanıcı listesi ve eski rol önbelleği bu oturumda kullanılmaz.
    const workspace=this.currentUser?.id===profile?.id?this.currentUser?.department:undefined
    const canKeepWorkspace=profile&&workspace&&(profile.role==='ADMIN'||profile.departments.includes(workspace))
    this.currentUser=profile?{...profile,department:canKeepWorkspace?workspace:profile.department,password:'',mustChangePassword:profile.mustChangePassword===true}:null
    this.users=this.currentUser?[this.currentUser]:[]
    this.notify()
    if (profile && this.serverClient) void this.refreshStaffDirectory().catch(() => {})
  }

  async refreshStaffDirectory() {
    const actor = this.currentUser?.id
    if (!actor || !this.serverClient) return
    const { data, error } = await this.serverClient.rpc('crm_staff_directory').abortSignal(AbortSignal.timeout(15000))
    if (error || !Array.isArray(data) || this.currentUser?.id !== actor) return
    this.users = data.map(row => ({ ...this.normalizeUser(row), password: '' }))
    this.notify()
  }

  async resetStaffPassword(userId: string) {
    if (!this.serverClient || this.currentUser?.role !== 'ADMIN') throw new Error('Yönetici girişi gerekli.')
    const { data, error } = await this.serverClient.functions.invoke('crm-staff', { body: {
      action: 'reset-password', requestId: crypto.randomUUID(), userId,
    } })
    if (error || typeof data?.generatedPassword !== 'string') throw new Error('Geçici parola oluşturulamadı. Hesabın durumunu kontrol edin.')
    return { username: data.user.username as string, password: data.generatedPassword as string }
  }

  startServerAuth(){
    if(!this.centralAuthEnabled||this.serverAuthStarted)return
    this.serverAuthStarted=true
    const client=createBackendPreviewClient()
    this.serverClient = client
    this.serverSession=createCrmMainSession(createCrmAuthService(client),p=>this.publishServerProfile(p))
    client.auth.onAuthStateChange(event=>{
      if(event==='SIGNED_OUT')this.serverSession?.invalidate()
      else if(event==='SIGNED_IN'&&!this.serverLoginPending){this.serverSession?.invalidate();setTimeout(()=>void this.serverSession?.restore(),0)}
      // SDK Auth kilidi dışında sunucuda profil kontrolü yap.
      else if(event==='TOKEN_REFRESHED'||event==='USER_UPDATED')setTimeout(()=>void this.serverSession?.restore(),0)
    })
    if(typeof window!=='undefined'){
      window.addEventListener('focus',()=>void this.serverSession?.restore())
      window.addEventListener('online',()=>void this.serverSession?.restore())
    }
    void this.serverSession.restore()
  }

  async loginWithServer(email:string,password:string):Promise<AppUser>{
    if(!this.centralAuthEnabled)throw Error('Merkezi giriş etkin değil.')
    this.startServerAuth()
    this.serverLoginPending=true
    try{await this.serverSession!.login(email,password)}finally{this.serverLoginPending=false}
    if(!this.currentUser)throw Error('Sunucu oturumu doğrulanamadı.')
    return this.currentUser
  }

  hasAdmin(): boolean {
    return this.users.some((u) => u.role === 'ADMIN' || u.isManager)
  }

  registerAdmin(data: {
    fullName: string
    password: string
    companyName: string
    department: Department
    departments?: Department[]
    email?: string
  }): AppUser {
    if(this.centralAuthEnabled)throw Error('Yönetici hesabı yalnızca yetkili sunucu kurulumu ile açılabilir.')
    const username = generateUsername(data.fullName, this.users)
    const normalizedDept = normalizeDepartmentName(data.department || 'Yönetim')
    const depts = data.departments && data.departments.length > 0
      ? Array.from(new Set(data.departments.map(normalizeDepartmentName)))
      : [...CANONICAL_DEPARTMENTS]

    const newAdmin: AppUser = {
      id: 'usr-' + Date.now(),
      fullName: data.fullName.trim(),
      username,
      password: data.password,
      email: data.email?.trim(),
      companyName: data.companyName.trim() || 'Demirtürk Portföy',
      department: normalizedDept,
      departments: depts,
      role: 'ADMIN',
      isManager: true,
      scope: 'ALL',
      permissions: {
        canEditProjectPrice: true,
        canChangeFlatStatus: true,
        canApproveDiscounts: true,
        canRefundDeposit: true,
        canManageTeam: true,
        canReshareFiles: true,
      },
      mustChangePassword: false,
      createdAt: new Date().toISOString(),
    }

    this.users.push(newAdmin)
    try {
      localStorage.removeItem('demirturk_logged_out')
    } catch {}
    this.currentUser = newAdmin
    this.saveToStorage()
    syncService.saveUser(newAdmin)
    return newAdmin
  }

  /**
   * Add Member:
   * Departman ve erişebileceği departmanlar kaydeden tarafından belirlenir ve atanır.
   */
  async addMember(data: {
    fullName: string
    department: Department
    departments?: Department[]
    role?: UserRole
    scope?: AccessScope
    initialPassword?: string
    email?: string
    permissions?: UserPermissions
  }): Promise<{ user: AppUser; generatedPassword: string }> {
    if (this.centralAuthEnabled) {
      if (!this.serverClient || this.currentUser?.role !== 'ADMIN') throw new Error('Personel oluşturmak için yönetici girişi gerekli.')
      const key = JSON.stringify([data.fullName, data.department, data.role, data.scope])
      if (this.pendingStaffCreation && this.pendingStaffCreation.key !== key) throw new Error('Önce önceki personel oluşturma işleminin sonucunu kontrol edin.')
      const requestId = this.pendingStaffCreation?.requestId ?? crypto.randomUUID()
      const username = this.pendingStaffCreation?.username ?? generateUsername(data.fullName, this.users)
      this.pendingStaffCreation = { key, requestId, username }
      const { data: result, error } = await this.serverClient.functions.invoke('crm-staff', { body: {
        requestId, username, fullName: data.fullName, department: data.department,
        role: data.role || 'MEMBER', scope: data.scope || 'ASSIGNED_ONLY',
      } })
      if (error || !result?.user?.id || typeof result.generatedPassword !== 'string') {
        let code = result?.error
        if (error?.context instanceof Response) code = (await error.context.json().catch(() => ({}))).error
        if (code === 'account_already_created') throw new Error('Hesap oluşturulmuş. Ekip ve Yetkiler ekranından geçici parolasını yenileyin.')
        throw new Error('Personel hesabı sonucu doğrulanamadı. Aynı bilgilerle tekrar deneyin veya yönetici hesabından durumu kontrol edin.')
      }
      this.pendingStaffCreation = null
      await this.refreshStaffDirectory()
      const user = this.users.find(row => row.id === result.user.id) ?? this.normalizeUser({
        ...data, id: result.user.id, username: result.user.username, password: '', companyName: this.currentUser.companyName,
      })
      return { user, generatedPassword: result.generatedPassword }
    }
    const username = generateUsername(data.fullName, this.users)
    const initialPassword = data.initialPassword || generateInitialPassword()
    const normalizedDept = normalizeDepartmentName(data.department)
    
    const rawDepts = data.departments && data.departments.length > 0
      ? data.departments
      : [normalizedDept]
    const departments = Array.from(new Set([normalizedDept, ...rawDepts.map(normalizeDepartmentName)]))

    const role: UserRole = data.role || 'REPRESENTATIVE'
    const isManager = role === 'MANAGER' || role === 'ADMIN'
    const scope: AccessScope = data.scope || (isManager ? 'DEPARTMENT' : 'ASSIGNED_ONLY')

    const newMember: AppUser = {
      id: 'usr-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      fullName: data.fullName.trim(),
      username,
      password: initialPassword,
      email: data.email?.trim(),
      companyName: this.currentUser?.companyName || 'Demirtürk Portföy',
      department: normalizedDept,
      departments,
      role,
      isManager,
      scope,
      permissions: {
        canEditProjectPrice: role === 'ADMIN' || (isManager && normalizedDept === 'Yönetim'),
        canChangeFlatStatus: role === 'ADMIN' || normalizedDept === 'Satış' || normalizedDept === 'Yönetim',
        canApproveDiscounts: role === 'ADMIN' || normalizedDept === 'Yönetim',
        canRefundDeposit: role === 'ADMIN' || normalizedDept === 'Muhasebe',
        canManageTeam: role === 'ADMIN' || (isManager && normalizedDept === 'Yönetim'),
        canReshareFiles: true,
        ...data.permissions,
      },
      mustChangePassword: false,
      createdAt: new Date().toISOString(),
    }

    this.users.push(newMember)
    this.saveToStorage()
    syncService.saveUser(newMember)
    return { user: newMember, generatedPassword: initialPassword }
  }

  login(identifier: string, password: string): { success: boolean; error?: string; user?: AppUser } {
    if(this.centralAuthEnabled)return {success:false,error:'E-posta ve parolanızla güvenli sunucu girişini kullanın.'}
    this.reloadUsersFromStorage()

    const rawTrimmed = identifier.trim().replace(/^@+/, '')
    const cleanIdentifier = rawTrimmed.toLowerCase()
    const normalizedIdentifier = normalizeTurkish(rawTrimmed)
    const cleanPassword = password.trim()

    const user = this.users.find((u) => {
      const uNameLower = u.username.toLowerCase()
      const uNameNorm = normalizeTurkish(u.username)
      const fullNameLower = u.fullName.toLowerCase()
      const fullNameNorm = normalizeTurkish(u.fullName)
      const firstNameNorm = normalizeTurkish(u.fullName.split(/\s+/)[0] || '')
      return (
        uNameLower === cleanIdentifier ||
        uNameNorm === normalizedIdentifier ||
        fullNameLower === cleanIdentifier ||
        fullNameNorm === normalizedIdentifier ||
        firstNameNorm === normalizedIdentifier ||
        Boolean(u.email && u.email.toLowerCase() === cleanIdentifier)
      )
    })

    if (!user) {
      return { success: false, error: 'Kullanıcı adı veya e-posta bulunamadı.' }
    }

    if (user.password.trim() !== cleanPassword) {
      return { success: false, error: 'Girdiğiniz şifre hatalı.' }
    }

    try {
      localStorage.removeItem('demirturk_logged_out')
    } catch {}

    this.currentUser = user
    this.saveToStorage()
    return { success: true, user }
  }

  logout() {
    if(this.centralAuthEnabled)void this.serverSession?.logout().catch(()=>{console.error('[CRM Auth] Sunucu çıkışı tamamlanamadı.')})
    // Paylaşılan bilgisayarda yerel kullanıcıdan çıkınca Meta yetkili oturumu diğer kullanıcıya kalmaz.
    void supabase.auth.signOut({ scope: 'local' }).then(({ error }) => {
      if (error) console.error('[Auth] Sunucu oturumu kapatılamadı; Meta panelinden oturumu kapatın.')
    }, () => { console.error('[Auth] Sunucu oturumu kapatılamadı; Meta panelinden oturumu kapatın.') })
    this.currentUser = null
    try {
      localStorage.setItem('demirturk_logged_out', 'true')
      localStorage.removeItem(STORAGE_KEY_CURRENT_USER)
    } catch {}
    this.saveToStorage()
  }

  switchDepartment(targetDept: Department): { success: boolean; error?: string } {
    if (!this.currentUser) return { success: false, error: 'Oturum açılmamış.' }

    const normalized = normalizeDepartmentName(targetDept)
    if (this.currentUser.department === normalized) {
      return { success: true }
    }

    const isAllowed =
      this.currentUser.role === 'ADMIN' ||
      this.currentUser.departments.includes(normalized)

    if (!isAllowed) {
      return {
        success: false,
        error: `Bu çalışma alanına (${targetDept}) erişim yetkiniz bulunmamaktadır.`,
      }
    }

    this.currentUser = {
      ...this.currentUser,
      department: normalized,
    }

    try {
      if(!this.centralAuthEnabled)localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(this.currentUser))
    } catch {}
    this.notify()
    return { success: true }
  }

  async updateUser(
    userId: string,
    updates: Partial<Omit<AppUser, 'id' | 'createdAt'>>
  ): Promise<{ success: boolean; error?: string }> {
    if (this.centralAuthEnabled) {
      if (!this.serverClient) return { success: false, error: 'Sunucu oturumu gerekli.' }
      const ownProfile = userId === this.currentUser?.id
      const { error } = ownProfile
        ? await this.serverClient.rpc('crm_update_own_profile', { p_updates: updates })
        : await this.serverClient.rpc('crm_manage_staff', { p_id: userId, p_updates: { ...updates, _revision: this.users.find(user => user.id === userId)?.serverRevision }, p_disable: false })
      if (error) return { success: false, error: 'Profil veya yetki değişikliği sunucuda reddedildi.' }
      await this.serverSession?.restore()
      await this.refreshStaffDirectory()
      return { success: true }
    }
    const index = this.users.findIndex((u) => u.id === userId)
    if (index === -1) return { success: false, error: 'Kullanıcı bulunamadı.' }

    const oldUser = this.users[index]

    const updatedDept = updates.department
      ? normalizeDepartmentName(updates.department)
      : oldUser.department

    let updatedDepts = oldUser.departments
    if (updates.departments && updates.departments.length > 0) {
      updatedDepts = Array.from(
        new Set([updatedDept, ...updates.departments.map(normalizeDepartmentName)])
      )
    } else if (updates.department) {
      updatedDepts = Array.from(new Set([updatedDept, ...(oldUser.departments || [])]))
    }

    if (updates.avatarUrl !== undefined && typeof window !== 'undefined') {
      if (updates.avatarUrl) {
        try {
          localStorage.setItem(`demirturk_avatar_${userId}`, updates.avatarUrl)
        } catch (e) {
          console.warn('Failed to save avatar to localStorage:', e)
        }
      } else {
        try {
          localStorage.removeItem(`demirturk_avatar_${userId}`)
        } catch {}
      }
    }

    const updatedUser: AppUser = {
      ...oldUser,
      ...updates,
      avatarUrl:
        updates.avatarUrl !== undefined
          ? (updates.avatarUrl || undefined)
          : oldUser.avatarUrl,
      department: updatedDept,
      departments: updatedDepts,
      role: updates.role || oldUser.role,
      isManager:
        updates.isManager !== undefined ? updates.isManager : oldUser.isManager,
      scope: updates.scope || oldUser.scope,
      permissions: {
        ...oldUser.permissions,
        ...updates.permissions,
      },
      updatedAt: new Date().toISOString(),
    }

    this.users[index] = updatedUser
    if (this.currentUser?.id === userId) {
      this.currentUser = updatedUser
    }

    this.saveToStorage()
    syncService.saveUser(updatedUser)
    return { success: true }
  }

  async deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
    if (this.centralAuthEnabled) {
      if (!this.serverClient) return { success: false, error: 'Sunucu oturumu gerekli.' }
      const { error } = await this.serverClient.rpc('crm_manage_staff', { p_id: userId, p_updates: { _revision: this.users.find(user => user.id === userId)?.serverRevision }, p_disable: true })
      if (error) return { success: false, error: 'Personel devre dışı bırakılamadı. Yönetici yetkisini kontrol edin.' }
      await this.refreshStaffDirectory()
      return { success: true }
    }
    if (this.currentUser?.id === userId) {
      return { success: false, error: 'Kendinizi silemezsiniz.' }
    }
    this.users = this.users.filter((u) => u.id !== userId)
    this.saveToStorage()
    syncService.deleteUser(userId)
    return { success: true }
  }

  updateUsername(userId: string, newUsername: string): { success: boolean; error?: string } {
    if(this.centralAuthEnabled)return {success:false,error:'Kullanıcı adı değişikliği sunucuda yapılmalı.'}
    const cleanUsername = normalizeTurkish(newUsername).replace(/[^a-z0-9]/g, '')
    if (!cleanUsername || cleanUsername.length < 3) {
      return { success: false, error: 'Kullanıcı adı en az 3 karakter olmalıdır.' }
    }

    const taken = this.users.some(
      (u) => u.id !== userId && u.username.toLowerCase() === cleanUsername
    )
    if (taken) {
      return { success: false, error: 'Bu kullanıcı adı zaten kullanımda.' }
    }

    this.users = this.users.map((u) => {
      if (u.id === userId) {
        return { ...u, username: cleanUsername }
      }
      return u
    })

    if (this.currentUser?.id === userId) {
      this.currentUser = { ...this.currentUser, username: cleanUsername }
    }

    this.saveToStorage()
    const target = this.users.find((u) => u.id === userId)
    if (target) syncService.saveUser(target)
    return { success: true }
  }

  changePassword(userId: string, newPassword: string): { success: boolean; error?: string } {
    if(this.centralAuthEnabled)return {success:false,error:'Parolanızı Hesap güvenliği ekranından Supabase Auth üzerinde değiştirin.'}
    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: 'Şifre en az 6 karakter olmalıdır.' }
    }

    this.users = this.users.map((u) => {
      if (u.id === userId) {
        return { ...u, password: newPassword, mustChangePassword: false }
      }
      return u
    })

    if (this.currentUser?.id === userId) {
      this.currentUser = { ...this.currentUser, password: newPassword, mustChangePassword: false }
    }

    this.saveToStorage()
    const target = this.users.find((u) => u.id === userId)
    if (target) syncService.saveUser(target)
    return { success: true }
  }
}

export const userStore = new UserStore()
export const getAllUsers = (): AppUser[] => userStore.getAllUsers()
