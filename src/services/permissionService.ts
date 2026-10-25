import { AppUser } from './userStore'
import { Lead } from '@/types/lead'
import { Department } from '@/types/department'

export interface SharedFilePermissionTarget {
  uploadedByUserId: string
  shareTarget: 'ALL_TEAM' | 'DEPARTMENTS' | 'MEMBERS' | 'MANAGEMENT'
  targetDepartments?: Department[]
  targetMemberIds?: string[]
  permissions?: {
    canView: boolean
    canEdit: boolean
    canReshare: boolean
  }
}

export class PermissionService {
  /**
   * Authoritative check for lead access based on scope and role
   */
  public canAccessLead(user: AppUser | null, lead: Lead): boolean {
    if (!user) return true // Anonymous or initial setup view

    // Admin has unrestricted access
    if (user.role === 'ADMIN') return true

    // Scope: ALL
    if (user.scope === 'ALL') return true

    // Scope: ASSIGNED_ONLY -> user must be explicitly assigned (or unassigned manual leads in Müşteri İlişkileri)
    if (user.scope === 'ASSIGNED_ONLY') {
      if (user.department === 'Müşteri İlişkileri' && !lead.assignedToUserId) {
        return true
      }
      return (
        lead.assignedToUserId === user.id ||
        lead.owner === user.fullName ||
        lead.owner === user.username
      )
    }

    // Scope: DEPARTMENT
    if (user.scope === 'DEPARTMENT') {
      // Pazarlama sees all new/marketing leads
      if (user.department === 'Pazarlama') {
        return lead.source === 'META_ADS' || lead.channel.includes('Facebook') || lead.channel.includes('Instagram') || lead.stage === 'NEW'
      }
      // Müşteri İlişkileri manages all customer records, inquiries, and sales handover tracking
      if (user.department === 'Müşteri İlişkileri') {
        return true
      }
      // Satış sees leads assigned to sales or in sales stages, plus all website leads
      if (user.department === 'Satış') {
        return (
          lead.source === 'WEBSITE' ||
          lead.channel?.toLowerCase().includes('web') ||
          lead.tags?.some((t) => t.toLowerCase().includes('web')) ||
          lead.assignedToUserId === user.id ||
          ['QUALIFIED', 'APPOINTMENT', 'PRESENTATION', 'OFFER', 'WON', 'LOST'].includes(lead.stage)
        )
      }
      // Muhasebe sees converted/won leads with transactions or deposit
      if (user.department === 'Muhasebe') {
        return lead.stage === 'WON' || Boolean(lead.budget)
      }
      // Yönetim sees all
      if (user.department === 'Yönetim') return true
    }

    return true
  }

  /**
   * Filter leads array according to user's permissions and scope
   */
  public filterLeads(user: AppUser | null, leads: Lead[]): Lead[] {
    if (!user) return leads
    if (user.role === 'ADMIN' || user.scope === 'ALL') return leads
    return leads.filter((lead) => this.canAccessLead(user, lead))
  }

  /**
   * Authoritative check for file access
   */
  public canAccessFile(user: AppUser | null, file: SharedFilePermissionTarget): boolean {
    if (!user) return false
    if (user.role === 'ADMIN') return true
    if (file.uploadedByUserId === user.id) return true

    switch (file.shareTarget) {
      case 'ALL_TEAM':
        return true
      case 'DEPARTMENTS': {
        const allowed = file.targetDepartments || []
        if (allowed.length === 0) return false
        if (allowed.includes(user.department)) return true
        if (Array.isArray(user.departments) && user.departments.some((d) => allowed.includes(d))) {
          return true
        }
        return false
      }
      case 'MEMBERS':
        return Boolean(file.targetMemberIds?.includes(user.id))
      case 'MANAGEMENT':
        return user.department === 'Yönetim' || user.isManager
      default:
        return false
    }
  }

  public canDownloadFile(user: AppUser | null, file: SharedFilePermissionTarget): boolean {
    if (!this.canAccessFile(user, file)) return false
    if (user?.role === 'ADMIN' || file.uploadedByUserId === user?.id) return true
    return file.permissions?.canView !== false
  }

  public canEditFile(user: AppUser | null, file: SharedFilePermissionTarget): boolean {
    if (!user) return false
    if (user.role === 'ADMIN' || file.uploadedByUserId === user.id) return true
    return Boolean(file.permissions?.canEdit)
  }

  public canReshareFile(user: AppUser | null, file: SharedFilePermissionTarget): boolean {
    if (!user) return false
    if (user.role === 'ADMIN' || file.uploadedByUserId === user.id) return true
    return Boolean(user.permissions.canReshareFiles && file.permissions?.canReshare)
  }

  /**
   * Project & flat permissions
   */
  public canEditProjectPrice(user: AppUser | null): boolean {
    if (!user) return false
    return Boolean(user.role === 'ADMIN' || user.permissions.canEditProjectPrice)
  }

  public canChangeFlatStatus(user: AppUser | null): boolean {
    if (!user) return false
    return Boolean(user.role === 'ADMIN' || user.permissions.canChangeFlatStatus)
  }

  public canApproveDiscounts(user: AppUser | null): boolean {
    if (!user) return false
    return Boolean(user.role === 'ADMIN' || user.permissions.canApproveDiscounts || (user.isManager && user.department === 'Yönetim'))
  }

  public canRefundDeposit(user: AppUser | null): boolean {
    if (!user) return false
    return Boolean(user.role === 'ADMIN' || user.permissions.canRefundDeposit || user.department === 'Muhasebe')
  }

  public canManageTeam(user: AppUser | null): boolean {
    if (!user) return false
    return Boolean(user.role === 'ADMIN' || user.permissions.canManageTeam || (user.isManager && user.department === 'Yönetim'))
  }
}

export const permissionService = new PermissionService()
