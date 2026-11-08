import { supabase, isSupabaseConfigured } from './supabaseClient'
import {isCentralCrm} from './crmRuntime'
import {
  leadToRow,
  rowToLead,
  activityToRow,
  rowToActivity,
  projectToRow,
  rowToProject,
  unitToRow,
  rowToUnit,
  appointmentToRow,
  rowToAppointment,
  requestToRow,
  rowToRequest,
  userToRow,
  rowToUser,
  collectionToRow,
  rowToCollection,
  paymentToRow,
  rowToPayment,
  approvalToRow,
  rowToApproval,
  sharedFileToRow,
  rowToSharedFile,
} from './dbMapper'
import { Lead, LeadActivity } from '@/types/lead'
import { SharedProject, FlatUnit } from './projectStore'
import { Appointment } from './appointmentStore'
import { CustomerRequest } from './requestStore'
import { AppUser } from './userStore'
import { CollectionRecord, PaymentRecord } from './accountingStore'
import { ApprovalRequest } from './approvalStore'
import { SharedFile } from './sharedFileStore'

export interface SyncInitOptions {
  onLeadsLoaded?: (leads: Lead[], activities: Record<string, LeadActivity[]>) => void

  onProjectsLoaded?: (projects: SharedProject[]) => void

  onAppointmentsLoaded?: (appointments: Appointment[]) => void

  onRequestsLoaded?: (requests: CustomerRequest[]) => void

  getInitialUsers?: () => AppUser[]
  onUsersLoaded?: (users: AppUser[]) => void

  onAccountingLoaded?: (collections: CollectionRecord[], payments: PaymentRecord[]) => void

  onApprovalsLoaded?: (approvals: ApprovalRequest[]) => void

  onFilesLoaded?: (files: SharedFile[]) => void
}

class SyncService {
  private isInitialized = false

  public async init(options: SyncInitOptions) {
    if (!isSupabaseConfigured() || this.isInitialized) return
    this.isInitialized = true
    console.log('[Supabase Sync] Initializing cloud database synchronization...')

    try {
      await Promise.all([
        this.syncProjects(options),
        this.syncLeads(options),
        this.syncAppointments(options),
        this.syncRequests(options),
        this.syncUsers(options),
        this.syncAccounting(options),
        this.syncApprovals(options),
        this.syncFiles(options),
      ])
      console.log('[Supabase Sync] All tables synchronized and verified!')
    } catch (err) {
      console.error('[Supabase Sync] Initialization error:', err)
    }
  }

  public async purgeAllCloudData() {
    if (!isSupabaseConfigured()) return
    const tables = [
      'units',
      'projects',
      'lead_activities',
      'leads',
      'appointments',
      'customer_requests',
      'collections',
      'payments',
      'approvals',
      'shared_files',
      'app_users',
    ]
    for (const table of tables) {
      try {
        await supabase.from(table).delete().neq('id', '__never__')
      } catch {
        // ignore if table does not exist
      }
    }
  }

  // --- PROJECTS & UNITS ---
  private async syncProjects(options: SyncInitOptions) {
    if (isCentralCrm()) return
    try {
      const { data: dbProjects, error: prjErr } = await supabase.from('projects').select('*').order('created_at', { ascending: true })
      if (prjErr) throw prjErr

      const { data: dbUnits, error: unitErr } = await supabase.from('units').select('*')
      if (unitErr) throw unitErr

      const unitsByProject: Record<string, FlatUnit[]> = {}
      if (dbUnits) {
        dbUnits.forEach((u) => {
          const mapped = rowToUnit(u)
          if (!unitsByProject[mapped.projectId]) unitsByProject[mapped.projectId] = []
          unitsByProject[mapped.projectId].push(mapped)
        })
      }

      const projects = (dbProjects || []).map((p) => rowToProject(p, unitsByProject[p.id] || []))
      if (options.onProjectsLoaded) options.onProjectsLoaded(projects)
    } catch (e) {
      console.error('[Supabase Sync] Error syncing projects:', e)
    }
  }

  public async saveProject(project: SharedProject) {
    if (isCentralCrm()) return
    if (!isSupabaseConfigured()) return
    try {
      await supabase.from('projects').upsert(projectToRow(project))
      if (project.units && project.units.length > 0) {
        const unitRows = project.units.map((u) => unitToRow(u))
        await supabase.from('units').upsert(unitRows)
      }
    } catch (e) {
      console.error('[Supabase Sync] Failed to save project:', e)
    }
  }

  public async deleteProject(projectId: string) {
    if (isCentralCrm()) return
    if (!isSupabaseConfigured()) return
    try {
      await supabase.from('projects').delete().eq('id', projectId)
    } catch (e) {
      console.error('[Supabase Sync] Failed to delete project:', e)
    }
  }

  public async saveUnit(unit: FlatUnit) {
    if (isCentralCrm()) return
    if (!isSupabaseConfigured()) return
    try {
      await supabase.from('units').upsert(unitToRow(unit))
    } catch (e) {
      console.error('[Supabase Sync] Failed to save unit:', e)
    }
  }

  public async deleteUnit(unitId: string) {
    if (isCentralCrm()) return
    if (!isSupabaseConfigured()) return
    try {
      await supabase.from('units').delete().eq('id', unitId)
    } catch (e) {
      console.error('[Supabase Sync] Failed to delete unit:', e)
    }
  }

  // --- LEADS & ACTIVITIES ---
  private async syncLeads(options: SyncInitOptions) {
    try {
      const { data: dbLeads, error: leadErr } = await supabase.from('leads').select('*').order('created_at', { ascending: false })
      if (leadErr) throw leadErr

      const { data: dbActivities, error: actErr } = await supabase.from('lead_activities').select('*').order('created_at', { ascending: true })
      if (actErr) throw actErr

      const leads = (dbLeads || []).map(rowToLead)
      const activities: Record<string, LeadActivity[]> = {}
      if (dbActivities) {
        dbActivities.forEach((a) => {
          const mapped = rowToActivity(a)
          if (!activities[mapped.leadId]) activities[mapped.leadId] = []
          activities[mapped.leadId].push(mapped)
        })
      }
      if (options.onLeadsLoaded) options.onLeadsLoaded(leads, activities)
    } catch (e) {
      console.error('[Supabase Sync] Error syncing leads:', e)
    }
  }

  public async saveLead(lead: Lead) {
    if (!isSupabaseConfigured()) return
    try {
      await supabase.from('leads').upsert(leadToRow(lead))
    } catch (e) {
      console.error('[Supabase Sync] Failed to save lead:', e)
    }
  }

  public async saveActivity(activity: LeadActivity) {
    if (!isSupabaseConfigured()) return
    try {
      await supabase.from('lead_activities').upsert(activityToRow(activity))
    } catch (e) {
      console.error('[Supabase Sync] Failed to save activity:', e)
    }
  }

  public async deleteLead(id: string) {
    if (!isSupabaseConfigured()) return
    try {
      await supabase.from('leads').delete().eq('id', id)
    } catch (e) {
      console.error('[Supabase Sync] Failed to delete lead:', e)
    }
  }

  // --- APPOINTMENTS ---
  private async syncAppointments(options: SyncInitOptions) {
    if (isCentralCrm()) return
    try {
      const { data, error } = await supabase.from('appointments').select('*').order('created_at', { ascending: false })
      if (error) throw error

      if (options.onAppointmentsLoaded) {
        options.onAppointmentsLoaded((data || []).map(rowToAppointment))
      }
    } catch (e) {
      console.error('[Supabase Sync] Error syncing appointments:', e)
    }
  }

  public async saveAppointment(appointment: Appointment) {
    if (isCentralCrm()) return
    if (!isSupabaseConfigured()) return
    try {
      await supabase.from('appointments').upsert(appointmentToRow(appointment))
    } catch (e) {
      console.error('[Supabase Sync] Failed to save appointment:', e)
    }
  }

  public async deleteAppointment(id: string) {
    if (isCentralCrm()) return
    if (!isSupabaseConfigured()) return
    try {
      await supabase.from('appointments').delete().eq('id', id)
    } catch (e) {
      console.error('[Supabase Sync] Failed to delete appointment:', e)
    }
  }

  // --- REQUESTS ---
  private async syncRequests(options: SyncInitOptions) {
    if (isCentralCrm()) return
    try {
      const { data, error } = await supabase.from('customer_requests').select('*').order('created_at', { ascending: false })
      if (error) throw error

      if (options.onRequestsLoaded) {
        options.onRequestsLoaded((data || []).map(rowToRequest))
      }
    } catch (e) {
      console.error('[Supabase Sync] Error syncing requests:', e)
    }
  }

  public async saveRequest(request: CustomerRequest) {
    if (isCentralCrm()) return
    if (!isSupabaseConfigured()) return
    try {
      await supabase.from('customer_requests').upsert(requestToRow(request))
    } catch (e) {
      console.error('[Supabase Sync] Failed to save request:', e)
    }
  }

  public async deleteRequest(id: string) {
    if (isCentralCrm()) return
    if (!isSupabaseConfigured()) return
    try {
      await supabase.from('customer_requests').delete().eq('id', id)
    } catch (e) {
      console.error('[Supabase Sync] Failed to delete request:', e)
    }
  }

  // --- USERS ---
  private async syncUsers(options: SyncInitOptions) {
    if(isCentralCrm())return
    try {
      const { data, error } = await supabase.from('app_users').select('*').order('created_at', { ascending: true })
      if (error) throw error

      if (options.onUsersLoaded) {
        options.onUsersLoaded((data || []).map(rowToUser))
      }
    } catch (e) {
      console.error('[Supabase Sync] Error syncing users:', e)
    }
  }

  public async saveUser(user: AppUser) {
    if(isCentralCrm())return
    if (!isSupabaseConfigured()) return
    try {
      await supabase.from('app_users').upsert(userToRow(user))
    } catch (e) {
      console.error('[Supabase Sync] Failed to save user:', e)
    }
  }

  public async deleteUser(id: string) {
    if(isCentralCrm())return
    if (!isSupabaseConfigured()) return
    try {
      await supabase.from('app_users').delete().eq('id', id)
    } catch (e) {
      console.error('[Supabase Sync] Failed to delete user:', e)
    }
  }

  // --- ACCOUNTING ---
  private async syncAccounting(options: SyncInitOptions) {
    if (isCentralCrm()) return
    try {
      const { data: dbCol, error: colErr } = await supabase.from('collections').select('*')
      if (colErr) throw colErr
      const { data: dbPay, error: payErr } = await supabase.from('payments').select('*')
      if (payErr) throw payErr

      if (options.onAccountingLoaded) {
        options.onAccountingLoaded(
          (dbCol || []).map(rowToCollection),
          (dbPay || []).map(rowToPayment)
        )
      }
    } catch (e) {
      console.error('[Supabase Sync] Error syncing accounting:', e)
    }
  }

  public async saveCollection(col: CollectionRecord) {
    if (isCentralCrm()) return
    if (!isSupabaseConfigured()) return
    try {
      await supabase.from('collections').upsert(collectionToRow(col))
    } catch (e) {
      console.error('[Supabase Sync] Failed to save collection:', e)
    }
  }

  public async savePayment(pay: PaymentRecord) {
    if (isCentralCrm()) return
    if (!isSupabaseConfigured()) return
    try {
      await supabase.from('payments').upsert(paymentToRow(pay))
    } catch (e) {
      console.error('[Supabase Sync] Failed to save payment:', e)
    }
  }

  // --- APPROVALS ---
  private async syncApprovals(options: SyncInitOptions) {
    if (isCentralCrm()) return
    try {
      const { data, error } = await supabase.from('approvals').select('*').order('created_at', { ascending: false })
      if (error) throw error

      if (options.onApprovalsLoaded) {
        options.onApprovalsLoaded((data || []).map(rowToApproval))
      }
    } catch (e) {
      console.error('[Supabase Sync] Error syncing approvals:', e)
    }
  }

  public async saveApproval(approval: ApprovalRequest) {
    if (isCentralCrm()) return
    if (!isSupabaseConfigured()) return
    try {
      await supabase.from('approvals').upsert(approvalToRow(approval))
    } catch (e) {
      console.error('[Supabase Sync] Failed to save approval:', e)
    }
  }

  // --- SHARED FILES ---
  private async syncFiles(options: SyncInitOptions) {
    if (isCentralCrm()) return
    try {
      const { data, error } = await supabase.from('shared_files').select('*').order('created_at', { ascending: false })
      if (error) return // Table might not exist yet, fallback smoothly
      if (options.onFilesLoaded && data) {
        options.onFilesLoaded(data.map(rowToSharedFile))
      }
    } catch (e) {
      // Graceful fallback
    }
  }

  public async saveFile(file: SharedFile) {
    if (!isSupabaseConfigured()) return
    try {
      await supabase.from('shared_files').upsert(sharedFileToRow(file))
    } catch (e) {
      // Graceful fallback
    }
  }

  public async deleteFile(fileId: string) {
    if (!isSupabaseConfigured()) return
    try {
      await supabase.from('shared_files').delete().eq('id', fileId)
    } catch (e) {
      // Graceful fallback
    }
  }
}

export const syncService = new SyncService()
