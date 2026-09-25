import {
  Department,
  UserRole,
  AccessScope,
  UserPermissions,
  normalizeDepartmentName,
} from '@/types/department'

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

type Listener = () => void

class UserStore {
  private users: AppUser[] = []
  private currentUser: AppUser | null = null
  private listeners: Set<Listener> = new Set()

  constructor() {
    this.loadFromStorage()
  }

  private normalizeUser(user: any): AppUser {
    const normalizedDept = normalizeDepartmentName(user.department || 'Yönetim')
    const rawDepts = Array.isArray(user.departments) && user.departments.length > 0
      ? user.departments
      : [normalizedDept]
    const departments: Department[] = Array.from(new Set(rawDepts.map(normalizeDepartmentName)))

    const isManager = Boolean(user.isManager || user.role === 'ADMIN' || user.role === 'MANAGER')
    const role: UserRole = user.role === 'ADMIN' ? 'ADMIN' : (user.role || (isManager ? 'MANAGER' : 'REPRESENTATIVE'))
    const scope: AccessScope = user.scope || (role === 'ADMIN' ? 'ALL' : (isManager ? 'DEPARTMENT' : 'ASSIGNED_ONLY'))

    const defaultPermissions: UserPermissions = {
      canEditProjectPrice: role === 'ADMIN' || (role === 'MANAGER' && normalizedDept === 'Yönetim'),
      canChangeFlatStatus: role === 'ADMIN' || normalizedDept === 'Satış' || normalizedDept === 'Yönetim',
      canApproveDiscounts: role === 'ADMIN' || normalizedDept === 'Yönetim',
      canRefundDeposit: role === 'ADMIN' || normalizedDept === 'Muhasebe' || normalizedDept === 'Yönetim',
      canManageTeam: role === 'ADMIN' || normalizedDept === 'Yönetim',
      canReshareFiles: true,
      ...user.permissions,
    }

    return {
      id: user.id || 'usr-' + Date.now(),
      fullName: user.fullName || 'Kullanıcı',
      username: user.username || 'user',
      password: user.password || '123456',
      email: user.email,
      companyName: user.companyName || 'Demirtürk Portföy',
      department: normalizedDept,
      departments,
      role,
      isManager,
      scope,
      permissions: defaultPermissions,
      mustChangePassword: Boolean(user.mustChangePassword),
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
        this.users = []
      }

      const savedCurrentUser = localStorage.getItem(STORAGE_KEY_CURRENT_USER)
      if (savedCurrentUser) {
        const parsed = JSON.parse(savedCurrentUser)
        const matched = this.users.find((u) => u.id === parsed.id)
        this.currentUser = matched ? this.normalizeUser(matched) : this.normalizeUser(parsed)
      } else {
        this.currentUser = null
      }
    } catch (e) {
      console.error('Failed to load users from storage:', e)
      this.users = []
      this.currentUser = null
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
    this.currentUser = newAdmin
    this.saveToStorage()
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
    return { user: newMember, generatedPassword: initialPassword }
  }

  login(identifier: string, password: string): { success: boolean; error?: string; user?: AppUser } {
    const cleanIdentifier = identifier.trim().toLowerCase()
    const user = this.users.find(
      (u) =>
        u.username.toLowerCase() === cleanIdentifier ||
        (u.email && u.email.toLowerCase() === cleanIdentifier)
    )

    if (!user) {
      return { success: false, error: 'Kullanıcı adı veya e-posta bulunamadı.' }
    }

    if (user.password !== password) {
      return { success: false, error: 'Girdiğiniz şifre hatalı.' }
    }

    this.currentUser = user
    this.saveToStorage()
    return { success: true, user }
  }

  logout() {
    this.currentUser = null
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
    const updatedDept = updates.department ? normalizeDepartmentName(updates.department) : oldUser.department
    
    let updatedDepts = oldUser.departments
    if (updates.departments && updates.departments.length > 0) {
      updatedDepts = Array.from(new Set([updatedDept, ...updates.departments.map(normalizeDepartmentName)]))
    } else if (updates.department) {
      updatedDepts = Array.from(new Set([updatedDept, ...(oldUser.departments || [])]))
    }

    const updatedUser: AppUser = {
      ...oldUser,
      ...updates,
      department: updatedDept,
      departments: updatedDepts,
    }

    this.users[index] = updatedUser
    if (this.currentUser?.id === userId) {
      this.currentUser = updatedUser
    }

    this.saveToStorage()
    return { success: true }
  }

  deleteUser(userId: string): { success: boolean; error?: string } {
    if (this.currentUser?.id === userId) {
      return { success: false, error: 'Kendinizi silemezsiniz.' }
    }
    this.users = this.users.filter((u) => u.id !== userId)
    this.saveToStorage()
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
    return { success: true }
  }
}

export const userStore = new UserStore()
export const getAllUsers = (): AppUser[] => userStore.getAllUsers()
