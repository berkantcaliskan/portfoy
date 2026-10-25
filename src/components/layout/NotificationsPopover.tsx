import React from 'react'
import {
  Bell,
  Globe,
  User,
  AlertCircle,
  Calendar,
  CheckCheck,
  ExternalLink,
  X,
  ChevronRight,
} from 'lucide-react'
import {
  notificationStore,
  AppNotification,
} from '@/services/notificationStore'
import { NavPageId } from '@/types/department'

interface NotificationsPopoverProps {
  isOpen: boolean
  onClose: () => void
  onNavigate: (tab: NavPageId) => void
}

function formatTimeAgo(isoString: string): string {
  if (!isoString) return ''
  try {
    const diff = Date.now() - new Date(isoString).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'Az önce'
    if (minutes < 60) return `${minutes} dk önce`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} saat önce`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days} gün önce`
    return new Date(isoString).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
    })
  } catch {
    return ''
  }
}

export const NotificationsPopover: React.FC<NotificationsPopoverProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  if (!isOpen) return null

  const notifications = notificationStore.getAllNotifications()
  const unreadCount = notifications.filter((n) => !n.isRead).length

  const handleItemClick = (n: AppNotification) => {
    notificationStore.markNotificationAsRead(n.id)
    onNavigate(n.targetTab)
    onClose()
  }

  const handleMarkAllRead = (e: React.MouseEvent) => {
    e.stopPropagation()
    notificationStore.markAllAsRead()
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="dropdown-panel dropdown-panel-down fixed md:absolute right-3.5 md:right-0 top-16 md:top-full md:mt-2.5 w-[calc(100vw-28px)] md:w-96 max-w-sm rounded-[26px] bg-[#282522] border border-[#4a443f] shadow-2xl p-4 z-[70] backdrop-blur-2xl space-y-3"
      style={{
        boxShadow:
          '0 20px 50px -10px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(185, 152, 129, 0.35)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-[#b99881]/20 border border-[#b99881]/40 flex items-center justify-center text-[#dfb76c]">
            <Bell className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-white">Bildirimler</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#b99881] text-[#282522]">
                  {unreadCount}
                </span>
              )}
            </div>
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#34302d] hover:bg-[#3d3733] border border-[#4a443f] text-[11px] font-semibold text-[#d6beae] hover:text-white transition-colors cursor-pointer"
            title="Tümünü Okundu İşaretle"
          >
            <CheckCheck className="w-3 h-3 text-[#b99881]" />
            <span>Tümünü Okundu Say</span>
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        {notifications.length === 0 ? (
          <div className="py-10 text-center text-[#8c857f] space-y-2">
            <Bell className="w-8 h-8 mx-auto opacity-30 text-[#b99881]" />
            <p className="text-xs font-medium text-white/70">Bildirim bulunmuyor</p>
            <p className="text-[11px] text-[#8c857f]">Tüm yeni talepler ve müşteriler güncel.</p>
          </div>
        ) : (
          notifications.map((n) => {
            const timeAgo = formatTimeAgo(n.createdAt)
            return (
              <div
                key={n.id}
                onClick={() => handleItemClick(n)}
                className={`p-3 rounded-[18px] transition-all cursor-pointer flex items-start gap-3 border ${
                  !n.isRead
                    ? 'bg-[#34302d]/80 border-[#b99881]/40 hover:border-[#b99881]'
                    : 'bg-[#282522] border-[#4a443f]/50 hover:bg-[#34302d]/50 hover:border-[#4a443f]'
                }`}
              >
                {/* Icon */}
                <div
                  className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center mt-0.5 ${
                    n.type === 'WEBSITE'
                      ? 'bg-[#b99881]/20 border border-[#b99881]/40 text-[#dfb76c]'
                      : n.type === 'LEAD'
                      ? 'bg-sky-500/15 border border-sky-500/30 text-sky-400'
                      : 'bg-amber-500/15 border border-amber-500/30 text-amber-400'
                  }`}
                >
                  {n.type === 'WEBSITE' ? (
                    <Globe className="w-4 h-4" />
                  ) : n.type === 'LEAD' ? (
                    <User className="w-4 h-4" />
                  ) : (
                    <AlertCircle className="w-4 h-4" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-white truncate block">
                      {n.title}
                    </span>
                    <span className="text-[10px] text-[#8c857f] shrink-0 font-medium">
                      {timeAgo}
                    </span>
                  </div>

                  <p className="text-[11px] text-[#a69f99] truncate mt-0.5 leading-snug">
                    {n.subtitle}
                  </p>

                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-[#dfb76c] font-semibold flex items-center gap-0.5">
                      {n.targetTab === 'requests' ? 'Talepleri Aç' : 'Müşterileri Aç'}
                      <ChevronRight className="w-3 h-3" />
                    </span>

                    {!n.isRead && (
                      <span className="w-2 h-2 rounded-full bg-[#dfb76c] shadow-[0_0_8px_rgba(223,183,108,0.8)]" />
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
