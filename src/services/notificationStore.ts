import { leadStore } from './leadStore'
import { requestStore, CustomerRequest } from './requestStore'
import { userStore } from './userStore'
import { Lead } from '@/types/lead'
import { NavPageId } from '@/types/department'

export interface AppNotification {
  id: string
  type: 'WEBSITE' | 'LEAD' | 'REQUEST' | 'APPOINTMENT' | 'SYSTEM'
  title: string
  subtitle: string
  targetTab: NavPageId
  referenceId?: string
  isRead: boolean
  createdAt: string
}

const STORAGE_KEY_LAST_VIEWED = 'demirturk_tabs_last_viewed_v1'
const STORAGE_KEY_READ_NOTIFS = 'demirturk_read_notification_ids_v1'

type Listener = () => void
type IncomingListener = (notif: AppNotification) => void

class NotificationStore {
  private lastViewedTabs: Record<string, number> = {}
  private readNotifIds: Set<string> = new Set()
  private listeners: Set<Listener> = new Set()
  private incomingListeners: Set<IncomingListener> = new Set()
  private customNotifications: AppNotification[] = []
  private knownNotifIds: Set<string> = new Set()
  private initializedKnown = false

  constructor() {
    this.loadFromStorage()
    this.initSubscriptions()
  }

  private loadFromStorage() {
    try {
      const savedTabs = localStorage.getItem(STORAGE_KEY_LAST_VIEWED)
      if (savedTabs) {
        this.lastViewedTabs = JSON.parse(savedTabs)
      } else {
        // Default to yesterday so existing open/new items have notification badges initially
        const yesterday = Date.now() - 24 * 60 * 60 * 1000
        this.lastViewedTabs = {
          requests: yesterday,
          customers: yesterday,
          crm: yesterday,
          appointments: yesterday,
        }
      }

      const savedReads = localStorage.getItem(STORAGE_KEY_READ_NOTIFS)
      if (savedReads) {
        const arr = JSON.parse(savedReads)
        this.readNotifIds = new Set(arr)
      }
    } catch {
      this.lastViewedTabs = {}
      this.readNotifIds = new Set()
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY_LAST_VIEWED, JSON.stringify(this.lastViewedTabs))
      localStorage.setItem(
        STORAGE_KEY_READ_NOTIFS,
        JSON.stringify(Array.from(this.readNotifIds))
      )
    } catch (e) {
      console.error('NotificationStore save error:', e)
    }
    this.notify()
  }

  private notify() {
    this.checkAndEmitNewNotifications()
    this.listeners.forEach((cb) => cb())
  }

  private checkAndEmitNewNotifications() {
    const all = this.getAllNotifications()
    if (!this.initializedKnown) {
      all.forEach((n) => this.knownNotifIds.add(n.id))
      this.initializedKnown = true
      return
    }
    for (const n of all) {
      if (!this.knownNotifIds.has(n.id)) {
        this.knownNotifIds.add(n.id)
        if (!n.isRead) {
          this.emitIncoming(n)
        }
      }
    }
  }

  private emitIncoming(notif: AppNotification) {
    this.incomingListeners.forEach((cb) => cb(notif))
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  public subscribeIncoming(listener: IncomingListener): () => void {
    this.incomingListeners.add(listener)
    return () => this.incomingListeners.delete(listener)
  }

  public pushNotification(
    item: Omit<AppNotification, 'id' | 'isRead' | 'createdAt'> & { id?: string }
  ): AppNotification {
    const id = item.id || `notif-sys-${Date.now()}`
    const notif: AppNotification = {
      id,
      type: item.type,
      title: item.title,
      subtitle: item.subtitle,
      targetTab: item.targetTab,
      referenceId: item.referenceId,
      isRead: this.readNotifIds.has(id),
      createdAt: new Date().toISOString(),
    }
    this.customNotifications = [
      notif,
      ...this.customNotifications.filter((c) => c.id !== id),
    ]
    this.knownNotifIds.add(id)
    this.notify()
    this.emitIncoming(notif)
    return notif
  }

  private initSubscriptions() {
    // Re-evaluate whenever leads or requests update
    leadStore.subscribe(() => this.notify())
    requestStore.subscribe(() => this.notify())

    if (typeof window !== 'undefined') {
      window.addEventListener('demirturk:new-lead', () => {
        this.notify()
      })
    }
  }

  /**
   * Mark a tab as visited/viewed (e.g. user clicked "Talepler" or "Müşteriler")
   */
  public markTabAsViewed(tabId: string) {
    this.lastViewedTabs[tabId] = Date.now()

    // Also mark notifications belonging to this tab as read
    const allNotifs = this.getAllNotifications()
    for (const n of allNotifs) {
      if (n.targetTab === tabId) {
        this.readNotifIds.add(n.id)
      }
    }

    this.saveToStorage()
  }

  /**
   * Mark a specific notification as read
   */
  public markNotificationAsRead(id: string) {
    this.readNotifIds.add(id)
    this.saveToStorage()
  }

  /**
   * Mark all notifications as read & clear all tab badges
   */
  public markAllAsRead() {
    const now = Date.now()
    this.lastViewedTabs['requests'] = now
    this.lastViewedTabs['customers'] = now
    this.lastViewedTabs['crm'] = now
    this.lastViewedTabs['appointments'] = now
    this.lastViewedTabs['followups-appointments'] = now

    const allNotifs = this.getAllNotifications()
    for (const n of allNotifs) {
      this.readNotifIds.add(n.id)
    }

    this.saveToStorage()
  }

  /**
   * Calculate unread / unviewed badge count for a specific navigation tab
   */
  public getUnreadCountForTab(tabId: string): number {
    const lastViewed = this.lastViewedTabs[tabId] || 0

    if (tabId === 'requests') {
      // 1. Unviewed website leads
      const allLeads = leadStore.getAllRaw()
      let unreadWebLeads = 0
      for (const l of allLeads) {
        const isWeb =
          l.source === 'WEBSITE' ||
          l.channel?.toLowerCase().includes('web') ||
          l.tags?.some((t) => t.toLowerCase().includes('web'))
        if (isWeb) {
          const t = new Date(l.createdAt).getTime()
          if (t > lastViewed && l.stage === 'NEW') {
            unreadWebLeads++
          }
        }
      }

      // 2. Unviewed customer requests
      const allReqs = requestStore.getAll()
      let unreadReqs = 0
      for (const r of allReqs) {
        const t = new Date(r.createdAt).getTime()
        if (t > lastViewed && r.status === 'Açık') {
          unreadReqs++
        }
      }

      return unreadWebLeads + unreadReqs
    }

    if (tabId === 'customers' || tabId === 'portfolio') {
      // Unviewed leads (stage === 'NEW' created after lastViewed)
      const allLeads = leadStore.getAllRaw()
      let count = 0
      for (const l of allLeads) {
        if (l.stage === 'NEW') {
          const t = new Date(l.createdAt).getTime()
          if (t > lastViewed) {
            count++
          }
        }
      }
      return count
    }

    if (tabId === 'crm') {
      // In Satış CRM: unviewed website submissions or qualified leads assigned
      const allLeads = leadStore.getAllRaw()
      let count = 0
      for (const l of allLeads) {
        const isWeb = l.source === 'WEBSITE'
        if (isWeb && l.stage === 'NEW') {
          const t = new Date(l.createdAt).getTime()
          if (t > lastViewed) count++
        }
      }
      return count
    }

    return 0
  }

  /**
   * Returns all dynamic notifications sorted newest first
   */
  public getAllNotifications(): AppNotification[] {
    const list: AppNotification[] = this.customNotifications.map((c) => ({
      ...c,
      isRead: this.readNotifIds.has(c.id),
    }))
    const allLeads = leadStore.getAllRaw()
    const allReqs = requestStore.getAll()

    // 1. Website submissions from leads
    for (const lead of allLeads) {
      const isWeb =
        lead.source === 'WEBSITE' ||
        lead.channel?.toLowerCase().includes('web') ||
        lead.tags?.some((t) => t.toLowerCase().includes('web'))

      if (isWeb) {
        const notifId = `notif-web-${lead.id}`
        list.push({
          id: notifId,
          type: 'WEBSITE',
          title: `Web Başvurusu: ${lead.formName || 'İletişim'}`,
          subtitle: `${lead.fullName} • ${lead.phone || ''} ${
            lead.preferredHousingType ? `(${lead.preferredHousingType})` : ''
          }`,
          targetTab: 'requests',
          referenceId: lead.id,
          isRead: this.readNotifIds.has(notifId),
          createdAt: lead.createdAt,
        })
      } else if (lead.stage === 'NEW') {
        const notifId = `notif-lead-${lead.id}`
        list.push({
          id: notifId,
          type: 'LEAD',
          title: `Yeni Müşteri: ${lead.fullName}`,
          subtitle: `${lead.formName || 'Meta Ads Formu'} • ${lead.phone || ''}`,
          targetTab: 'customers',
          referenceId: lead.id,
          isRead: this.readNotifIds.has(notifId),
          createdAt: lead.createdAt,
        })
      }
    }

    // 2. Customer Requests
    for (const req of allReqs) {
      const isWeb =
        req.id.startsWith('req-web-') ||
        req.subject.toLowerCase().includes('web')
      const notifId = `notif-req-${req.id}`

      list.push({
        id: notifId,
        type: isWeb ? 'WEBSITE' : 'REQUEST',
        title: req.subject,
        subtitle: `${req.customerName} (${req.customerPhone}) • ${req.category}`,
        targetTab: 'requests',
        referenceId: req.id,
        isRead: this.readNotifIds.has(notifId),
        createdAt: req.createdAt,
      })
    }

    // Sort newest first
    return list.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime() || 0
      const timeB = new Date(b.createdAt).getTime() || 0
      return timeB - timeA
    })
  }

  /**
   * Total unread notifications count for the Bell icon
   */
  public getTotalUnreadCount(): number {
    const notifs = this.getAllNotifications()
    return notifs.filter((n) => !n.isRead).length
  }
}

export const notificationStore = new NotificationStore()
