import { leadStore } from './leadStore'
import { requestStore } from './requestStore'
import { userStore } from './userStore'
import { Lead, isLeadHandedOverToSales } from '@/types/lead'
import { NavPageId } from '@/types/department'
import { playNewLeadChime } from '@/utils/audioAlert'

const STORAGE_KEY_CALL_AGAIN_REMINDER_TS = 'demirturk_last_call_again_reminder_ts'

export interface AppNotification {
  id: string
  childIds?: string[]
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
const STORAGE_KEY_DELETED_NOTIFS = 'demirturk_deleted_notification_ids_v1'

type Listener = () => void
type IncomingListener = (notif: AppNotification) => void

class NotificationStore {
  private lastViewedTabs: Record<string, number> = {}
  private readNotifIds: Set<string> = new Set()
  private deletedNotifIds: Set<string> = new Set()
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
        if (Array.isArray(arr)) {
          this.readNotifIds = new Set(arr)
        }
      }

      const savedDeleted = localStorage.getItem(STORAGE_KEY_DELETED_NOTIFS)
      if (savedDeleted) {
        const arr = JSON.parse(savedDeleted)
        if (Array.isArray(arr)) {
          this.deletedNotifIds = new Set(arr)
        }
      }
    } catch {
      this.lastViewedTabs = {}
      this.readNotifIds = new Set()
      this.deletedNotifIds = new Set()
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY_LAST_VIEWED, JSON.stringify(this.lastViewedTabs))
      localStorage.setItem(
        STORAGE_KEY_READ_NOTIFS,
        JSON.stringify(Array.from(this.readNotifIds))
      )
      localStorage.setItem(
        STORAGE_KEY_DELETED_NOTIFS,
        JSON.stringify(Array.from(this.deletedNotifIds))
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
    this.deletedNotifIds.delete(id)
    const notif: AppNotification = {
      id,
      childIds: item.childIds,
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
    const currentUser = userStore.getCurrentUser()
    if (currentUser?.department === 'Satış' && notif.type === 'WEBSITE') {
      return notif
    }
    this.emitIncoming(notif)
    return notif
  }

  private initSubscriptions() {
    leadStore.subscribe(() => this.notify())
    requestStore.subscribe(() => this.notify())
    userStore.subscribe(() => this.notify())

    if (typeof window !== 'undefined') {
      window.addEventListener('demirturk:new-lead', () => {
        this.notify()
      })
      this.initHourlyCallAgainReminder()
    }
  }

  public getCallAgainLeads(): Lead[] {
    const currentUser = userStore.getCurrentUser()
    const all = leadStore.getAll(currentUser)
    return all.filter((l) => {
      if (currentUser?.department === 'Satış' && !isLeadHandedOverToSales(l)) {
        return false
      }
      if (
        l.stage === 'QUALIFIED' ||
        l.stage === 'OFFER' ||
        l.stage === 'APPOINTMENT' ||
        l.stage === 'PRESENTATION' ||
        l.stage === 'WON' ||
        l.stage === 'LOST' ||
        l.stage === 'NO_INTENT' ||
        l.callStatus === 'NO_INTENT'
      ) {
        return false
      }
      return l.callStatus === 'CALL_AGAIN' || l.callStatus === 'UNREACHABLE'
    })
  }

  public triggerCallAgainHourlyReminder(force = false): AppNotification | null {
    const callAgainLeads = this.getCallAgainLeads()
    if (callAgainLeads.length === 0) return null

    const now = Date.now()
    if (!force) {
      let lastTs = 0
      try {
        lastTs = Number(localStorage.getItem(STORAGE_KEY_CALL_AGAIN_REMINDER_TS) || '0')
      } catch {}
      // En az 1 saat (3600000 ms) geçmiş olmalı
      if (now - lastTs < 60 * 60 * 1000) return null
    }

    try {
      localStorage.setItem(STORAGE_KEY_CALL_AGAIN_REMINDER_TS, String(now))
    } catch {}

    const namesPreview = callAgainLeads
      .slice(0, 3)
      .map((l) => l.fullName)
      .join(', ')
    const extraCount = callAgainLeads.length > 3 ? ` +${callAgainLeads.length - 3} kişi` : ''
    const subtitle = `Tekrar aranacak: ${namesPreview}${extraCount}`
    const hourKey = Math.floor(now / (60 * 60 * 1000))

    playNewLeadChime()

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(`Tekrar Arama Hatırlatması (${callAgainLeads.length} Müşteri)`, {
          body: subtitle,
          icon: '/icon.png',
        })
      } catch {}
    }

    const currentUser = userStore.getCurrentUser()
    const targetTab: NavPageId = currentUser?.department === 'Satış' ? 'crm' : 'customers'

    return this.pushNotification({
      id: `notif-call-again-${force ? now : hourKey}`,
      type: 'LEAD',
      title: `Tekrar Arama Hatırlatması (${callAgainLeads.length} Müşteri)`,
      subtitle,
      targetTab,
      referenceId: 'CALL_AGAIN',
    })
  }

  private initHourlyCallAgainReminder() {
    // Her dakika kontrol et; son hatırlatmadan bu yana 1 saat geçtiyse ve Tekrar Ara havuzunda müşteri varsa bildirim gönder
    window.setInterval(() => {
      try {
        this.triggerCallAgainHourlyReminder(false)
      } catch {}
    }, 60 * 1000)
  }

  /**
   * Mark a tab as visited/viewed (e.g. user clicked "Talepler" or "Müşteriler")
   */
  public markTabAsViewed(tabId: string) {
    this.lastViewedTabs[tabId] = Date.now()

    const allNotifs = this.getAllNotifications()
    for (const n of allNotifs) {
      if (n.targetTab === tabId || (tabId === 'portfolio' && n.targetTab === 'customers')) {
        this.readNotifIds.add(n.id)
        if (n.childIds) {
          n.childIds.forEach((cid) => this.readNotifIds.add(cid))
        }
      }
    }

    this.saveToStorage()
  }

  /**
   * Mark a specific notification as read
   */
  public markNotificationAsRead(id: string) {
    const target = this.getAllNotifications().find((n) => n.id === id)
    this.readNotifIds.add(id)
    if (target?.childIds) {
      target.childIds.forEach((cid) => this.readNotifIds.add(cid))
    }
    this.saveToStorage()
  }

  /**
   * Delete a specific notification
   */
  public deleteNotification(id: string) {
    const target = this.getAllNotifications().find((n) => n.id === id)
    this.deletedNotifIds.add(id)
    this.readNotifIds.add(id)
    if (target?.childIds) {
      target.childIds.forEach((cid) => {
        this.deletedNotifIds.add(cid)
        this.readNotifIds.add(cid)
      })
    }
    this.customNotifications = this.customNotifications.filter((c) => c.id !== id)
    this.saveToStorage()
  }

  /**
   * Delete all notifications
   */
  public deleteAllNotifications() {
    const now = Date.now()
    this.lastViewedTabs['requests'] = now
    this.lastViewedTabs['customers'] = now
    this.lastViewedTabs['portfolio'] = now
    this.lastViewedTabs['crm'] = now
    this.lastViewedTabs['appointments'] = now
    this.lastViewedTabs['followups-appointments'] = now

    const allNotifs = this.getAllNotifications()
    for (const n of allNotifs) {
      this.deletedNotifIds.add(n.id)
      this.readNotifIds.add(n.id)
      if (n.childIds) {
        n.childIds.forEach((cid) => {
          this.deletedNotifIds.add(cid)
          this.readNotifIds.add(cid)
        })
      }
    }
    this.customNotifications = []
    this.saveToStorage()
  }

  /**
   * Mark all notifications as read & clear all tab badges
   */
  public markAllAsRead() {
    const now = Date.now()
    this.lastViewedTabs['requests'] = now
    this.lastViewedTabs['customers'] = now
    this.lastViewedTabs['portfolio'] = now
    this.lastViewedTabs['crm'] = now
    this.lastViewedTabs['appointments'] = now
    this.lastViewedTabs['followups-appointments'] = now

    const allNotifs = this.getAllNotifications()
    for (const n of allNotifs) {
      this.readNotifIds.add(n.id)
      if (n.childIds) {
        n.childIds.forEach((cid) => this.readNotifIds.add(cid))
      }
    }

    this.saveToStorage()
  }

  /**
   * Calculate unread / unviewed badge count for a specific navigation tab
   */
  public getUnreadCountForTab(tabId: string): number {
    const notifs = this.getAllNotifications()
    if (tabId === 'customers' || tabId === 'portfolio') {
      return notifs.filter((n) => !n.isRead && (n.targetTab === 'customers' || n.targetTab === 'portfolio')).length
    }
    return notifs.filter((n) => !n.isRead && n.targetTab === tabId).length
  }

  /**
   * Extracts the system addition timestamp (ms) of a lead so bulk imports are grouped together
   */
  private getLeadAddedTimeMs(lead: Lead): number {
    const idMatch = String(lead.id || '').match(/^lead-(?:web-)?(\d{12,14})-/)
    if (idMatch) {
      const ms = Number(idMatch[1])
      if (!isNaN(ms) && ms > 0) return ms
    }
    if (Array.isArray(lead.inquiries) && lead.inquiries.length > 0 && lead.inquiries[0]?.createdAt) {
      const ms = new Date(lead.inquiries[0].createdAt).getTime()
      if (!isNaN(ms) && ms > 0) return ms
    }
    const ms = new Date(lead.createdAt || lead.updatedAt || 0).getTime()
    return !isNaN(ms) ? ms : 0
  }

  /**
   * Returns all dynamic notifications sorted newest first.
   * Multiple leads added together (bulk/CSV import) are grouped into a single
   * "... yeni potansiyel müşteri eklendi" notification.
   */
  public getAllNotifications(): AppNotification[] {
    const currentUser = userStore.getCurrentUser()
    const isSalesDept = currentUser?.department === 'Satış'

    const list: AppNotification[] = this.customNotifications
      .filter((c) => {
        if (this.deletedNotifIds.has(c.id)) return false
        if (isSalesDept && c.type === 'WEBSITE') return false
        return true
      })
      .map((c) => ({
        ...c,
        isRead: this.readNotifIds.has(c.id),
      }))

    const allLeads = leadStore.getAllRaw()
    const allReqs = requestStore.getAll()

    const newPotentialLeads: { lead: Lead; addedMs: number }[] = []

    // 1. Separate Website submissions and New potential leads
    for (const lead of allLeads) {
      // Satış departmanında "Satışa İlet" denmemiş hiçbir müşteri (Websitesi, Meta, Google vb.) görünemez; devredilirse görünür!
      if (isSalesDept && !isLeadHandedOverToSales(lead)) {
        continue
      }

      const isWeb =
        lead.source === 'WEBSITE' ||
        lead.channel?.toLowerCase().includes('web') ||
        lead.tags?.some((t) => t.toLowerCase().includes('web'))

      if (isWeb && !isSalesDept) {
        const notifId = `notif-web-${lead.id}`
        if (this.deletedNotifIds.has(notifId)) continue
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
      } else if (lead.stage === 'NEW' || (isSalesDept && isLeadHandedOverToSales(lead))) {
        const singleId = `notif-lead-${lead.id}`
        if (this.deletedNotifIds.has(singleId)) continue
        newPotentialLeads.push({
          lead,
          addedMs: this.getLeadAddedTimeMs(lead),
        })
      }
    }

    // Group newPotentialLeads by addition time window (within 2 minutes = same bulk import/sync batch)
    newPotentialLeads.sort((a, b) => b.addedMs - a.addedMs)
    const batches: { lead: Lead; addedMs: number }[][] = []
    const BATCH_WINDOW_MS = 2 * 60 * 1000

    for (const item of newPotentialLeads) {
      const currentBatch = batches[batches.length - 1]
      if (!currentBatch) {
        batches.push([item])
      } else {
        const prevAddedMs = currentBatch[currentBatch.length - 1].addedMs
        if (Math.abs(prevAddedMs - item.addedMs) <= BATCH_WINDOW_MS) {
          currentBatch.push(item)
        } else {
          batches.push([item])
        }
      }
    }

    const defaultLeadTargetTab: NavPageId = isSalesDept ? 'crm' : 'customers'

    for (const batch of batches) {
      if (batch.length === 1) {
        const { lead, addedMs } = batch[0]
        const notifId = `notif-lead-${lead.id}`
        if (this.deletedNotifIds.has(notifId)) continue
        list.push({
          id: notifId,
          type: 'LEAD',
          title: isSalesDept ? `Satışa Devredilen Müşteri: ${lead.fullName}` : `Yeni Müşteri: ${lead.fullName}`,
          subtitle: `${lead.formName || 'Müşteri Kaydı'} • ${lead.phone || ''}`,
          targetTab: defaultLeadTargetTab,
          referenceId: lead.id,
          isRead: this.readNotifIds.has(notifId),
          createdAt: addedMs > 0 ? new Date(addedMs).toISOString() : lead.createdAt,
        })
      } else if (batch.length > 1) {
        const childIds = batch.map((b) => `notif-lead-${b.lead.id}`)
        const batchId = `notif-lead-batch-${batch[0].lead.id}`
        if (
          this.deletedNotifIds.has(batchId) ||
          childIds.every((cid) => this.deletedNotifIds.has(cid))
        ) {
          continue
        }
        const isRead =
          this.readNotifIds.has(batchId) ||
          childIds.every((cid) => this.readNotifIds.has(cid))
        const latestAddedMs = batch[0].addedMs
        const uniqueForms = Array.from(
          new Set(batch.map((b) => b.lead.formName || 'Meta Ads Formu').filter(Boolean))
        )
        const formText =
          uniqueForms.length <= 2
            ? uniqueForms.join(', ')
            : `${uniqueForms.slice(0, 2).join(', ')} ve +${uniqueForms.length - 2} form`

        list.push({
          id: batchId,
          childIds,
          type: 'LEAD',
          title: `${batch.length} yeni potansiyel müşteri eklendi`,
          subtitle: `${formText} • Toplu müşteri aktarımı`,
          targetTab: defaultLeadTargetTab,
          isRead,
          createdAt:
            latestAddedMs > 0
              ? new Date(latestAddedMs).toISOString()
              : batch[0].lead.createdAt,
        })
      }
    }

    // 2. Customer Requests
    for (const req of allReqs) {
      const isWeb =
        req.id.startsWith('req-web-') ||
        req.subject.toLowerCase().includes('web')

      if (isSalesDept) {
        const cleanReqPhone = String(req.customerPhone || '').replace(/\D/g, '').slice(-7)
        const matchedLead = allLeads.find((l) => {
          const cleanL = String(l.phone || '').replace(/\D/g, '')
          return Boolean(cleanReqPhone && cleanL && cleanL.endsWith(cleanReqPhone))
        })
        // Satış departmanında yalnızca Müşteri İlişkileri / Pazarlama / Yönetim tarafından "Satışa İlet" ile devredilmiş olanlar görünür
        if (!matchedLead || !isLeadHandedOverToSales(matchedLead)) {
          continue
        }
      }

      const notifId = `notif-req-${req.id}`
      if (this.deletedNotifIds.has(notifId)) continue

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
