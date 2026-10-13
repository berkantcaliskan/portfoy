import {
  Department,
  UserRole,
  AccessScope,
  UserPermissions,
  normalizeDepartmentName,
} from '@/types/department'
import { supabase, isSupabaseConfigured } from './supabaseClient'
import { syncService } from './syncService'
import { rowToUser } from './dbMapper'

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

  const firstName = normalizeTurkish(parts[0]).replace(/[^a-z0-9]/g, '')
  const lastName = parts.length > 1 ? normalizeTurkish(parts[parts.length - 1]).replace(/[^a-z0-9]/g, '') : ''
  const taken = new Set(existingUsers.map((u) => u.username.toLowerCase()))

  // 1. Aday: Sadece ilk ad
  if (firstName && !taken.has(firstName)) {
    return firstName
  }

  // 2. Aday: İlk ad + Soyadı
  if (firstName && lastName) {
    const candidate2 = `${firstName}${lastName}`
    if (!taken.has(candidate2)) {
      return candidate2
    }

    // 3. Aday: İlk ad + soyadı baş harfi
    const candidate3 = `${firstName}${lastName.charAt(0)}`
    if (!taken.has(candidate3)) {
      return candidate3
    }
  }

  // 4. Aday: Numara uzatması
  let counter = 1
  while (taken.has(`${firstName}${counter}`)) {
    counter++
  }
  return `${firstName}${counter}`
}

export function generateInitialPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  let password = ''
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

const STORAGE_KEY_USERS = 'demirturk_users_v2'
const STORAGE_KEY_CURRENT_USER = 'demirturk_active_user_v2'

export const PERMANENT_GOD_USER: AppUser = {
  id: 'usr-berkant',
  fullName: 'Berkant Demirtürk',
  username: 'berkant',
  password: 'Berkant26.',
  email: 'demirturkberkant@gmail.com',
  companyName: 'Demirtürk Portföy',
  department: 'Pazarlama',
  departments: ['Pazarlama', 'Satış', 'Müşteri İlişkileri', 'Muhasebe', 'Yönetim'],
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
  createdAt: '2026-01-01T00:00:00.000Z',
}

type Listener = () => void

class UserStore {
  private users: AppUser[] = [PERMANENT_GOD_USER]
  private currentUser: AppUser | null = PERMANENT_GOD_USER
  private listeners: Set<Listener> = new Set()
  private realtimeChannel: any = null

  constructor() {
    this.loadFromStorage()
    this.initRealtime()
  }

  public setLoadedUsers(users: AppUser[]) {
    if (users && users.length > 0) {
      const filtered = users.filter(
        (u) =>
          u.id !== 'usr-admin-1' &&
          u.email !== 'berkant@demirturkinsaat.com' &&
          u.fullName !== 'Berkant Çalışkan'
      )
      const hasGodUser = filtered.some(
        (u) => u.id === PERMANENT_GOD_USER.id || u.email === PERMANENT_GOD_USER.email
      )
      const finalList = hasGodUser ? filtered : [PERMANENT_GOD_USER, ...filtered]
      this.users = finalList.map((u) => {
        const normalized = this.normalizeUser(u)
        // Cloud sync guard: if incoming cloud record lacks avatarUrl but local/memory has it, retain it
        if (!normalized.avatarUrl) {
          const inMemoryUser = this.users.find((eu) => eu.id === normalized.id)
          if (inMemoryUser?.avatarUrl) {
            normalized.avatarUrl = inMemoryUser.avatarUrl
          }
        }
        return normalized
      })
      try {
        localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(this.users))
      } catch {}
      const isLoggedOut = typeof window !== 'undefined' && localStorage.getItem('demirturk_logged_out') === 'true'
      if (!isLoggedOut) {
        if (!this.currentUser || !this.users.some((u) => u.id === this.currentUser?.id)) {
          this.currentUser =
            this.users.find((u) => u.email === PERMANENT_GOD_USER.email) ||
            this.users[0] ||
            null
          if (this.currentUser) {
            try {
              localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(this.currentUser))
            } catch {}
          }
        } else {
          // Keep currentUser synchronized with the updated users list (preserving avatar, permissions, etc.)
          const syncedUser = this.users.find((u) => u.id === this.currentUser?.id)
          if (syncedUser) {
            this.currentUser = syncedUser
            try {
              localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(this.currentUser))
            } catch {}
          }
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
          this.saveToStorage()
        }
      })
      .subscribe()
  }

  private normalizeUser(user: any): AppUser {
    const isPermanent =
      user.id === PERMANENT_GOD_USER.id || user.email === PERMANENT_GOD_USER.email
    const normalizedDept = normalizeDepartmentName(user.department || (isPermanent ? 'Pazarlama' : 'Yönetim'))
    const rawDepts =
      Array.isArray(user.departments) && user.departments.length > 0
        ? user.departments
        : isPermanent
        ? PERMANENT_GOD_USER.departments
        : [normalizedDept]
    const departments: Department[] = Array.from(new Set(rawDepts.map(normalizeDepartmentName)))

    const isManager = Boolean(user.isManager || user.role === 'ADMIN' || user.role === 'MANAGER' || isPermanent)
    const role: UserRole = isPermanent ? 'ADMIN' : (user.role === 'ADMIN' ? 'ADMIN' : (user.role || (isManager ? 'MANAGER' : 'REPRESENTATIVE')))
    const scope: AccessScope = isPermanent ? 'ALL' : (user.scope || (role === 'ADMIN' ? 'ALL' : (isManager ? 'DEPARTMENT' : 'ASSIGNED_ONLY')))

    const defaultPermissions: UserPermissions = {
      canEditProjectPrice: isPermanent || role === 'ADMIN' || (role === 'MANAGER' && normalizedDept === 'Yönetim'),
      canChangeFlatStatus: isPermanent || role === 'ADMIN' || normalizedDept === 'Satış' || normalizedDept === 'Yönetim',
      canApproveDiscounts: isPermanent || role === 'ADMIN' || normalizedDept === 'Yönetim',
      canRefundDeposit: isPermanent || role === 'ADMIN' || normalizedDept === 'Muhasebe' || normalizedDept === 'Yönetim',
      canManageTeam: isPermanent || role === 'ADMIN' || normalizedDept === 'Yönetim',
      canReshareFiles: true,
      ...user.permissions,
    }

    const userId = user.id || 'usr-' + Date.now()
    let avatarUrl: string | undefined = undefined
    if (user.avatarUrl) {
      avatarUrl = user.avatarUrl
    } else if (user.avatar_url) {
      avatarUrl = user.avatar_url
    } else if (typeof window !== 'undefined') {
      avatarUrl = localStorage.getItem(`demirturk_avatar_${userId}`) || undefined
    }

    return {
      id: userId,
      fullName: user.fullName || (isPermanent ? PERMANENT_GOD_USER.fullName : 'Kullanıcı'),
      username: user.username || (isPermanent ? PERMANENT_GOD_USER.username : 'user'),
      password: isPermanent ? PERMANENT_GOD_USER.password : (user.password || '123456'),
      email: user.email || (isPermanent ? PERMANENT_GOD_USER.email : undefined),
      avatarUrl,
      companyName: user.companyName || 'Demirtürk Portföy',
      department: normalizedDept,
      departments: isPermanent ? ['Pazarlama', 'Satış', 'Müşteri İlişkileri', 'Muhasebe', 'Yönetim'] : departments,
      role,
      isManager,
      scope,
      permissions: defaultPermissions,
      mustChangePassword: isPermanent ? false : Boolean(user.mustChangePassword),
      createdAt: user.createdAt || new Date().toISOString(),
    }
  }

  private loadFromStorage() {
    try {
      const savedUsers = localStorage.getItem(STORAGE_KEY_USERS)
      if (savedUsers) {
        const raw = JSON.parse(savedUsers)
        this.users = Array.isArray(raw) ? raw.map((u) => this.normalizeUser(u)) : []
      } else {
        this.users = [PERMANENT_GOD_USER]
        this.currentUser = PERMANENT_GOD_USER
      }

      // Purge any accidental mock/fake/legacy users from storage
      const fakeUserIds = new Set(['usr-cc-1', 'usr-cc-2', 'usr-sales-1', 'usr-admin-1'])
      const fakeNames = new Set(['Selin Yılmaz', 'Can Özdemir', 'Mert Demir', 'Berkant Çalışkan'])
      const initialCount = this.users.length
      this.users = this.users.filter(
        (u) =>
          !fakeUserIds.has(u.id) &&
          !fakeNames.has(u.fullName) &&
          u.email !== 'berkant@demirturkinsaat.com'
      )

      // Ensure permanent god user is always included and updated with correct email
      const hasGodUser = this.users.some(
        (u) =>
          u.id === PERMANENT_GOD_USER.id ||
          u.email === PERMANENT_GOD_USER.email ||
          u.email === 'demirtukberkant@gmail.com' ||
          u.username === 'berkant'
      )
      if (!hasGodUser) {
        this.users = [PERMANENT_GOD_USER, ...this.users]
      } else {
        this.users = this.users.map((u) =>
          u.id === PERMANENT_GOD_USER.id ||
          u.email === PERMANENT_GOD_USER.email ||
          u.email === 'demirtukberkant@gmail.com' ||
          u.username === 'berkant'
            ? {
                ...PERMANENT_GOD_USER,
                ...u,
                id: PERMANENT_GOD_USER.id,
                email: PERMANENT_GOD_USER.email,
                username: PERMANENT_GOD_USER.username,
                password: PERMANENT_GOD_USER.password,
                role: 'ADMIN',
                isManager: true,
                scope: 'ALL',
                departments: PERMANENT_GOD_USER.departments,
                avatarUrl:
                  u.avatarUrl ||
                  (typeof window !== 'undefined'
                    ? localStorage.getItem(`demirturk_avatar_${PERMANENT_GOD_USER.id}`) || undefined
                    : undefined),
              }
            : u
        )
      }

      if (this.users.length !== initialCount || !savedUsers) {
        localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(this.users))
      }

      const isExplicitlyLoggedOut =
        typeof window !== 'undefined' && localStorage.getItem('demirturk_logged_out') === 'true'

      if (isExplicitlyLoggedOut) {
        this.currentUser = null
      } else {
        const savedCurrentUser = localStorage.getItem(STORAGE_KEY_CURRENT_USER)
        if (savedCurrentUser) {
          const parsed = JSON.parse(savedCurrentUser)
          if (
            fakeUserIds.has(parsed.id) ||
            parsed.email === 'berkant@demirturkinsaat.com' ||
            parsed.fullName === 'Berkant Çalışkan'
          ) {
            this.currentUser =
              this.users.find((u) => u.email === PERMANENT_GOD_USER.email) || PERMANENT_GOD_USER
          } else {
            const matched = this.users.find((u) => u.id === parsed.id || u.email === parsed.email)
            this.currentUser = matched ? this.normalizeUser(matched) : (this.users[0] || null)
          }
        } else {
          this.currentUser =
            this.users.find((u) => u.email === PERMANENT_GOD_USER.email) || this.users[0] || null
        }
      }

      if (this.currentUser) {
        localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(this.currentUser))
      }
    } catch (e) {
      console.error('Failed to load users from storage:', e)
      this.users = [PERMANENT_GOD_USER]
      this.currentUser = PERMANENT_GOD_USER
    }
  }

  private saveToStorage() {
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
    const username = generateUsername(data.fullName, this.users)
    const normalizedDept = normalizeDepartmentName(data.department || 'Yönetim')
    const depts = data.departments && data.departments.length > 0
      ? Array.from(new Set(data.departments.map(normalizeDepartmentName)))
      : ['Yönetim', 'Satış', 'Pazarlama', 'Müşteri İlişkileri', 'Muhasebe'] as Department[]

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
  addMember(data: {
    fullName: string
    department: Department
    departments?: Department[]
    role?: UserRole
    scope?: AccessScope
    initialPassword?: string
    email?: string
    permissions?: UserPermissions
  }): { user: AppUser; generatedPassword: string } {
    const username = generateUsername(data.fullName, this.users)
    const initialPassword = data.initialPassword || generateInitialPassword()
    const normalizedDept = normalizeDepartmentName(data.department)
    
    // Explicit accessible departments assigned by the creator (ensuring primary dept is always included)
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
      mustChangePassword: true,
      createdAt: new Date().toISOString(),
    }

    this.users.push(newMember)
    this.saveToStorage()
    syncService.saveUser(newMember)
    return { user: newMember, generatedPassword: initialPassword }
  }

  login(identifier: string, password: string): { success: boolean; error?: string; user?: AppUser } {
    const cleanIdentifier = identifier.trim().toLowerCase()
    const cleanPassword = password.trim()

    // Accept both demirturkberkant@gmail.com and demirtukberkant@gmail.com or username berkant for God User
    const isGodIdentifier =
      cleanIdentifier === 'demirturkberkant@gmail.com' ||
      cleanIdentifier === 'demirtukberkant@gmail.com' ||
      cleanIdentifier === 'berkant'

    let user: AppUser | undefined

    if (isGodIdentifier) {
      user = this.users.find(
        (u) =>
          u.id === PERMANENT_GOD_USER.id ||
          u.email?.toLowerCase() === 'demirturkberkant@gmail.com' ||
          u.email?.toLowerCase() === 'demirtukberkant@gmail.com' ||
          u.username.toLowerCase() === 'berkant'
      )
      if (!user) {
        user = PERMANENT_GOD_USER
        this.users = [PERMANENT_GOD_USER, ...this.users]
      }
    } else {
      user = this.users.find(
        (u) =>
          u.username.toLowerCase() === cleanIdentifier ||
          (u.email && u.email.toLowerCase() === cleanIdentifier)
      )
    }

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

    // Update in users list as well
    this.users = this.users.map((u) => (u.id === this.currentUser!.id ? this.currentUser! : u))
    this.saveToStorage()
    return { success: true }
  }

  /**
   * Update User:
   * Departman ve erişebileceği departmanlar kaydeden/yönetici tarafından sonradan serbestçe değiştirilebilir.
   */
  updateUser(
    userId: string,
    updates: Partial<Omit<AppUser, 'id' | 'createdAt'>>
  ): { success: boolean; error?: string } {
    const index = this.users.findIndex((u) => u.id === userId)
    if (index === -1) return { success: false, error: 'Kullanıcı bulunamadı.' }

    const oldUser = this.users[index]
    const isPermanent =
      oldUser.id === PERMANENT_GOD_USER.id || oldUser.email === PERMANENT_GOD_USER.email

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

    if (isPermanent) {
      updatedDepts = ['Pazarlama', 'Satış', 'Müşteri İlişkileri', 'Muhasebe', 'Yönetim']
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
      role: isPermanent ? 'ADMIN' : updates.role || oldUser.role,
      isManager:
        isPermanent ||
        (updates.isManager !== undefined ? updates.isManager : oldUser.isManager),
      scope: isPermanent ? 'ALL' : updates.scope || oldUser.scope,
      permissions: isPermanent
        ? {
            ...oldUser.permissions,
            ...updates.permissions,
            canEditProjectPrice: true,
            canChangeFlatStatus: true,
            canApproveDiscounts: true,
            canRefundDeposit: true,
            canManageTeam: true,
            canReshareFiles: true,
          }
        : {
            ...oldUser.permissions,
            ...updates.permissions,
          },
    }

    this.users[index] = updatedUser
    if (this.currentUser?.id === userId) {
      this.currentUser = updatedUser
    }

    this.saveToStorage()
    syncService.saveUser(updatedUser)
    return { success: true }
  }

  deleteUser(userId: string): { success: boolean; error?: string } {
    if (userId === PERMANENT_GOD_USER.id) {
      return { success: false, error: 'Bu daimi sistem hesabı silinemez.' }
    }
    const target = this.users.find((u) => u.id === userId)
    if (target?.email === PERMANENT_GOD_USER.email) {
      return { success: false, error: 'Bu daimi sistem hesabı silinemez.' }
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
