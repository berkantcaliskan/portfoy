import React, { useState, useEffect } from 'react'
import {
  Inbox,
  Send,
  FileText,
  Archive,
  AlertOctagon,
  Trash2,
  Star,
  Paperclip,
  Search,
  Plus,
  Reply,
  ReplyAll,
  Forward,
  MoreVertical,
  FolderInput,
  Shield,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  User,
  Building2,
  Calendar,
  Eye,
  EyeOff,
  Link as LinkIcon,
  Unlink,
  Settings,
  RefreshCw,
} from 'lucide-react'
import { AppUser } from '@/services/userStore'
import { mailService } from '@/services/mailService'
import { leadStore } from '@/services/leadStore'
import { Lead } from '@/types/lead'
import {
  MailAccount,
  MailFolder,
  MailFolderType,
  MailMessage,
  MailServerStatus,
} from '@/types/mail'
import { GlassModal } from '@/components/ui/GlassModal'
import { GlassButton } from '@/components/ui/GlassButton'
import { MailComposeModal } from './MailComposeModal'
import { MailAccountManagerModal } from './MailAccountManagerModal'

interface MailWorkspaceModalProps {
  isOpen: boolean
  onClose: () => void
  currentUser: AppUser | null
}

export const MailWorkspaceModal: React.FC<MailWorkspaceModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [accounts, setAccounts] = useState<MailAccount[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  const [selectedFolderId, setSelectedFolderId] = useState<string>('')
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'starred' | 'attachments'>('all')

  // Modals state
  const [isComposeOpen, setIsComposeOpen] = useState(false)
  const [isAccountManagerOpen, setIsAccountManagerOpen] = useState(false)
  const [composeReplyMsg, setComposeReplyMsg] = useState<MailMessage | null>(null)
  const [composeReplyAll, setComposeReplyAll] = useState(false)
  const [composeForwardMsg, setComposeForwardMsg] = useState<MailMessage | null>(null)

  // Remote images safety toggle per message
  const [showRemoteImages, setShowRemoteImages] = useState(false)

  // CRM link dropdown
  const [isLinkLeadOpen, setIsLinkLeadOpen] = useState(false)
  const [crmSearchQuery, setCrmSearchQuery] = useState('')
  const [allLeads, setAllLeads] = useState<Lead[]>([])

  // Mobile column view ('folders' | 'list' | 'detail')
  const [mobileView, setMobileView] = useState<'folders' | 'list' | 'detail'>('list')

  const serverStatus = mailService.getServerStatus()

  // Load accounts and synchronize
  useEffect(() => {
    if (!isOpen) return

    const updateData = () => {
      const userAccounts = mailService.getAccountsForUser(currentUser)
      setAccounts(userAccounts)

      if (userAccounts.length > 0) {
        const currentAcc = userAccounts.find((a) => a.id === selectedAccountId) || userAccounts[0]
        setSelectedAccountId(currentAcc.id)

        const folders = mailService.getFolders(currentAcc.id)
        if (!selectedFolderId || !folders.some((f) => f.id === selectedFolderId)) {
          const inbox = folders.find((f) => f.type === 'INBOX') || folders[0]
          setSelectedFolderId(inbox?.id || '')
        }
      }

      setAllLeads(leadStore.getAll())
    }

    updateData()
    const unsub = mailService.subscribe(updateData)
    return () => unsub()
  }, [isOpen, currentUser, selectedAccountId])

  if (!isOpen) return null

  const activeAccount = accounts.find((a) => a.id === selectedAccountId) || accounts[0]
  const folders = activeAccount ? mailService.getFolders(activeAccount.id) : []
  const activeFolder = folders.find((f) => f.id === selectedFolderId) || folders[0]

  const messages = activeAccount && activeFolder
    ? mailService.getMessages(activeAccount.id, activeFolder.id, {
        search: searchQuery,
        type: activeFilter,
      })
    : []

  const selectedMessage = selectedMessageId
    ? mailService.getMessageById(selectedMessageId)
    : messages[0] || null

  const canManageAccounts =
    currentUser?.role === 'ADMIN' || (currentUser?.isManager && currentUser?.department === 'Yönetim')

  const getFolderIcon = (type: MailFolderType) => {
    switch (type) {
      case 'INBOX':
        return <Inbox className="w-4 h-4" />
      case 'SENT':
        return <Send className="w-4 h-4" />
      case 'DRAFTS':
        return <FileText className="w-4 h-4" />
      case 'ARCHIVE':
        return <Archive className="w-4 h-4" />
      case 'SPAM':
        return <AlertOctagon className="w-4 h-4" />
      case 'TRASH':
        return <Trash2 className="w-4 h-4" />
      default:
        return <Inbox className="w-4 h-4" />
    }
  }

  const handleSelectMessage = (msg: MailMessage) => {
    setSelectedMessageId(msg.id)
    setShowRemoteImages(false)
    if (!msg.isRead) {
      mailService.markAsRead(msg.id, true)
    }
    setMobileView('detail')
  }

  const handleStartCompose = () => {
    setComposeReplyMsg(null)
    setComposeForwardMsg(null)
    setIsComposeOpen(true)
  }

  const handleReply = (all = false) => {
    if (!selectedMessage) return
    setComposeReplyMsg(selectedMessage)
    setComposeReplyAll(all)
    setComposeForwardMsg(null)
    setIsComposeOpen(true)
  }

  const handleForward = () => {
    if (!selectedMessage) return
    setComposeForwardMsg(selectedMessage)
    setComposeReplyMsg(null)
    setIsComposeOpen(true)
  }

  // CRM Müşteri Arama ve Eşleştirme Önerisi
  const suggestedLead = selectedMessage
    ? allLeads.find(
        (l) =>
          l.phone.includes(selectedMessage.from.email) ||
          selectedMessage.from.email.toLowerCase().includes(l.fullName.toLowerCase().replace(/\s+/g, ''))
      )
    : null

  const filteredCrmLeads = allLeads.filter((l) => {
    if (!crmSearchQuery) return true
    const q = crmSearchQuery.toLowerCase()
    return l.fullName.toLowerCase().includes(q) || l.phone.includes(q)
  })

  return (
    <GlassModal
      isOpen={isOpen}
      onClose={onClose}
      title="Kurumsal E-Posta Çalışma Alanı"
      description="Demirtürk İnşaat kurumsal mailcow ve IMAP/SMTP posta sunucusu yönetimi"
      maxWidth="7xl"
    >
      <div className="flex flex-col h-[65vh] min-h-[440px] max-h-[580px] text-sm font-sans select-none">
        
        {/* Üst Yönetim Çubuğu: Hesap Değiştirici, Arama ve Ana Eylemler */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#4a443f] px-2 shrink-0">
          
          {/* Sol: Hesap Seçici Açılır Menüsü */}
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <select
                value={selectedAccountId}
                onChange={(e) => {
                  setSelectedAccountId(e.target.value)
                  setSelectedMessageId(null)
                }}
                className="bg-[#282522] border border-[#b99881]/50 text-white font-bold text-xs rounded-full pl-3 pr-8 py-2 focus:outline-none focus:border-[#b99881] cursor-pointer appearance-none shadow-sm"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.displayName} ({acc.email})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#b99881] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <GlassButton
              variant="gold"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={handleStartCompose}
              className="rounded-full px-4 text-xs font-bold shadow-md"
            >
              Yeni E-Posta
            </GlassButton>
          </div>

          {/* Orta / Sağ: Arama ve Sunucu Durumu */}
          <div className="flex items-center gap-3">
            {/* Arama Kutusu */}
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-[#b99881] absolute left-3 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="E-postalarda ara..."
                className="w-44 sm:w-60 bg-[#282522] border border-[#4a443f] focus:border-[#b99881] rounded-full pl-8 pr-3 py-1.5 text-xs text-white placeholder-[#8c857f] focus:outline-none"
              />
            </div>

            {/* Sunucu Durum Rozeti */}
            <div
              className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
                serverStatus.isConfigured
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
              }`}
              title={serverStatus.statusMessage}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  serverStatus.isConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span>{serverStatus.isConfigured ? 'Mailcow: Bağlı' : 'Sunucu Yapılandırması Bekleniyor'}</span>
            </div>

            {/* Yönetici Menüsü (Kutu Ekleme) */}
            {canManageAccounts && (
              <button
                type="button"
                onClick={() => setIsAccountManagerOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#34302d] hover:bg-[#3d3733] border border-[#4a443f] text-xs text-[#d6beae] hover:text-white transition-colors cursor-pointer"
                title="Posta Kutularını Yönet"
              >
                <Settings className="w-3.5 h-3.5 text-[#b99881]" />
                <span className="hidden sm:inline">Kutuları Yönet</span>
              </button>
            )}
          </div>
        </div>

        {/* 3 Sütunlu Ana Gövde */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 min-h-0 pt-3 gap-3">
          
          {/* SÜTUN 1: KLASÖRLER & DEPOLAMA (3 Kolon) */}
          <div className="md:col-span-3 flex flex-col justify-between p-3 rounded-2xl bg-[#282522]/70 border border-[#4a443f] overflow-y-auto">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-[#8c857f] uppercase tracking-wider px-2 block mb-2">
                Klasörler
              </span>

              {folders.map((folder) => {
                const isActive = folder.id === selectedFolderId
                return (
                  <button
                    key={folder.id}
                    onClick={() => {
                      setSelectedFolderId(folder.id)
                      setSelectedMessageId(null)
                      setMobileView('list')
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#3d3733] text-white border border-[#b99881]/50 shadow-xs'
                        : 'text-[#a69f99] hover:text-[#f3efe9] hover:bg-[#34302d]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={isActive ? 'text-[#b99881]' : 'text-[#8c857f]'}>
                        {getFolderIcon(folder.type)}
                      </span>
                      <span>{folder.name}</span>
                    </div>

                    {folder.unreadCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-[#b99881] text-[#1c1a18] text-[10px] font-bold">
                        {folder.unreadCount}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Alt Kısım: Kota & Mailcow Bilgi Paneli */}
            <div className="pt-3 border-t border-[#4a443f]/60 space-y-3">
              {/* Kota Barı */}
              {activeAccount && (
                <div className="space-y-1 px-1">
                  <div className="flex items-center justify-between text-[11px] text-[#8c857f]">
                    <span>Depolama Kotası</span>
                    <span className="font-mono text-white">
                      {(activeAccount.usedMb / 1024).toFixed(1)} GB / {(activeAccount.quotaMb / 1024).toFixed(0)} GB
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-[#1c1a18] overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#b99881] to-[#d6beae] rounded-full"
                      style={{
                        width: `${Math.min(100, Math.round((activeAccount.usedMb / activeAccount.quotaMb) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Sunucu Uyarı Kartı */}
              {!serverStatus.isConfigured && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Canlı Sunucu Bekleniyor</span>
                  </div>
                  <p className="text-[10px] text-[#a69f99] leading-tight">
                    Mailcow API ve IMAP sunucu bilgileri henüz .env dosyasında yapılandırılmadı.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* SÜTUN 2: MESAJ LİSTESİ (4 Kolon) */}
          <div className="md:col-span-4 flex flex-col p-3 rounded-2xl bg-[#282522]/70 border border-[#4a443f] overflow-hidden">
            {/* Filtreleme Hapları */}
            <div className="flex items-center gap-1.5 pb-2.5 border-b border-[#4a443f]/60 shrink-0 overflow-x-auto">
              {(
                [
                  { id: 'all', label: 'Tümü' },
                  { id: 'unread', label: 'Okunmamış' },
                  { id: 'starred', label: 'Yıldızlı' },
                  { id: 'attachments', label: 'Ekli' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setActiveFilter(f.id)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                    activeFilter === f.id
                      ? 'bg-[#b99881] text-[#1c1a18]'
                      : 'bg-[#1c1a18] text-[#8c857f] hover:text-white border border-[#4a443f]/70'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Mesaj Kartları */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pt-2 pr-0.5">
              {messages.length === 0 ? (
                <div className="text-center py-14 text-xs text-[#8c857f]">
                  Bu klasörde e-posta bulunmuyor.
                </div>
              ) : (
                messages.map((msg) => {
                  const isSelected = selectedMessage?.id === msg.id
                  return (
                    <div
                      key={msg.id}
                      onClick={() => handleSelectMessage(msg)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer space-y-1.5 relative ${
                        isSelected
                          ? 'bg-[#3d3733] border-[#b99881] shadow-md ring-1 ring-[#b99881]/40'
                          : msg.isRead
                          ? 'bg-[#24211f]/60 border-[#4a443f]/50 hover:bg-[#282522] hover:border-[#b99881]/30'
                          : 'bg-[#2c2724] border-[#b99881]/40 shadow-xs'
                      }`}
                    >
                      {/* Üst Başlık: Gönderici & Tarih */}
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {!msg.isRead && (
                            <span className="w-2 h-2 rounded-full bg-[#b99881] shrink-0" />
                          )}
                          <span
                            className={`text-xs truncate ${
                              !msg.isRead ? 'font-bold text-white' : 'font-medium text-[#d6beae]'
                            }`}
                          >
                            {msg.from.name || msg.from.email}
                          </span>
                        </div>
                        <span className="text-[10px] text-[#8c857f] font-mono shrink-0">
                          {new Date(msg.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>

                      {/* Konu */}
                      <h5
                        className={`text-xs truncate ${
                          !msg.isRead ? 'font-bold text-white' : 'text-[#f3efe9]'
                        }`}
                      >
                        {msg.subject}
                      </h5>

                      {/* Önizleme Metni */}
                      <p className="text-[11px] text-[#8c857f] line-clamp-2 leading-relaxed">
                        {msg.snippet || msg.bodyText}
                      </p>

                      {/* Alt İkonlar: CRM Rozeti, Ekler, Yıldız */}
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-1.5">
                          {msg.hasAttachments && (
                            <Paperclip className="w-3 h-3 text-[#b99881]" />
                          )}
                          {msg.linkedLeadName && (
                            <span className="flex items-center gap-1 px-1.5 py-0.2 rounded-md bg-[#b99881]/20 text-[#b99881] text-[9px] font-semibold border border-[#b99881]/30">
                              <User className="w-2.5 h-2.5" />
                              {msg.linkedLeadName}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            mailService.toggleStar(msg.id)
                          }}
                          className={`p-0.5 hover:scale-110 transition-transform ${
                            msg.isStarred ? 'text-amber-400 fill-amber-400' : 'text-[#8c857f] hover:text-white'
                          }`}
                        >
                          <Star className={`w-3.5 h-3.5 ${msg.isStarred ? 'fill-amber-400' : ''}`} />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* SÜTUN 3: MESAJ DETAY VE OKUMA PANELİ (5 Kolon) */}
          <div className="md:col-span-5 flex flex-col p-4 rounded-2xl bg-[#282522]/90 border border-[#4a443f] overflow-hidden">
            {selectedMessage ? (
              <div className="flex flex-col h-full overflow-hidden space-y-4">
                
                {/* 1. Aksiyon Butonları (Yanıtla, İlet, Sil, CRM Bağlantısı) */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#4a443f]">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleReply(false)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#34302d] hover:bg-[#3d3733] border border-[#4a443f] text-xs text-[#f3efe9] transition-colors cursor-pointer"
                      title="Yanıtla"
                    >
                      <Reply className="w-3.5 h-3.5 text-[#b99881]" />
                      <span>Yanıtla</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReply(true)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#34302d] hover:bg-[#3d3733] border border-[#4a443f] text-xs text-[#f3efe9] transition-colors cursor-pointer"
                      title="Tümünü Yanıtla"
                    >
                      <ReplyAll className="w-3.5 h-3.5 text-[#b99881]" />
                      <span>Tümü</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleForward}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#34302d] hover:bg-[#3d3733] border border-[#4a443f] text-xs text-[#f3efe9] transition-colors cursor-pointer"
                      title="İlet"
                    >
                      <Forward className="w-3.5 h-3.5 text-[#b99881]" />
                      <span>İlet</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* CRM Bağlantı Butonu */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsLinkLeadOpen(!isLinkLeadOpen)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                          selectedMessage.linkedLeadName
                            ? 'bg-[#b99881]/20 border-[#b99881]/50 text-white'
                            : 'bg-[#34302d] border-[#4a443f] text-[#d6beae] hover:text-white'
                        }`}
                        title="CRM Müşteri Kaydına Bağla"
                      >
                        <LinkIcon className="w-3 h-3 text-[#b99881]" />
                        <span>{selectedMessage.linkedLeadName ? 'Müşteriye Bağlı' : 'Müşteriye Bağla'}</span>
                      </button>

                      {/* CRM Seçici Popover */}
                      {isLinkLeadOpen && (
                        <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-[#1c1a18] border border-[#b99881]/50 shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-2">
                          <span className="text-[10px] font-bold text-[#8c857f] uppercase block px-1">
                            CRM Müşterisi Seç
                          </span>
                          <input
                            type="text"
                            value={crmSearchQuery}
                            onChange={(e) => setCrmSearchQuery(e.target.value)}
                            placeholder="Müşteri adı veya telefon..."
                            className="w-full bg-[#282522] border border-[#4a443f] rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
                          />

                          {/* Öneri */}
                          {suggestedLead && !selectedMessage.linkedLeadName && (
                            <div
                              onClick={() => {
                                mailService.linkToLead(selectedMessage.id, suggestedLead.id, suggestedLead.fullName)
                                setIsLinkLeadOpen(false)
                              }}
                              className="p-2 rounded-lg bg-[#b99881]/15 border border-[#b99881]/40 text-xs text-white cursor-pointer hover:bg-[#b99881]/25"
                            >
                              <span className="text-[9px] text-[#b99881] block">Önerilen Eşleşme</span>
                              <span className="font-bold">{suggestedLead.fullName}</span>
                            </div>
                          )}

                          <div className="max-h-40 overflow-y-auto space-y-1">
                            {filteredCrmLeads.slice(0, 10).map((l) => (
                              <button
                                key={l.id}
                                type="button"
                                onClick={() => {
                                  mailService.linkToLead(selectedMessage.id, l.id, l.fullName)
                                  setIsLinkLeadOpen(false)
                                }}
                                className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-white/5 text-xs text-[#f3efe9] transition-colors truncate"
                              >
                                {l.fullName} ({l.phone})
                              </button>
                            ))}
                          </div>

                          {selectedMessage.linkedLeadName && (
                            <button
                              type="button"
                              onClick={() => {
                                mailService.unlinkLead(selectedMessage.id)
                                setIsLinkLeadOpen(false)
                              }}
                              className="w-full pt-1.5 border-t border-[#4a443f] text-center text-[10px] text-rose-400 hover:underline flex items-center justify-center gap-1"
                            >
                              <Unlink className="w-3 h-3" />
                              Bağlantıyı Kaldır
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => mailService.deleteMessage(selectedMessage.id)}
                      className="p-1.5 rounded-lg hover:bg-rose-500/10 text-[#8c857f] hover:text-rose-400 transition-colors"
                      title="Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 2. Başlık ve Gönderici Bilgileri */}
                <div className="space-y-2 pb-2">
                  <h3 className="text-base font-bold text-white tracking-tight">
                    {selectedMessage.subject}
                  </h3>

                  <div className="flex items-center justify-between text-xs text-[#a69f99]">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-[#34302d] border border-[#b99881]/40 flex items-center justify-center text-xs font-bold text-[#b99881]">
                        {selectedMessage.from.name ? selectedMessage.from.name[0].toUpperCase() : '@'}
                      </div>
                      <div>
                        <span className="font-bold text-white block">
                          {selectedMessage.from.name || selectedMessage.from.email}
                        </span>
                        <span className="text-[11px] text-[#8c857f] font-mono">
                          &lt;{selectedMessage.from.email}&gt;
                        </span>
                      </div>
                    </div>

                    <span className="text-xs text-[#8c857f] font-mono">
                      {new Date(selectedMessage.date).toLocaleString('tr-TR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div className="text-[11px] text-[#8c857f]">
                    <span>Kime: </span>
                    <span className="text-[#d6beae]">
                      {selectedMessage.to.map((t) => t.email).join(', ')}
                    </span>
                  </div>
                </div>

                {/* 3. Güvenlik Kalkanı: Uzak Görsel Engeli */}
                {selectedMessage.bodyHtml && selectedMessage.bodyHtml.includes('<img') && !showRemoteImages && (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#1c1a18] border border-[#4a443f] text-xs text-[#a69f99]">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-[#b99881]" />
                      <span>Gizlilik koruması: Harici görseller engellendi.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowRemoteImages(true)}
                      className="text-[#b99881] hover:underline font-semibold text-[11px]"
                    >
                      Görselleri Göster
                    </button>
                  </div>
                )}

                {/* 4. Mesaj Gövdesi */}
                <div className="flex-1 overflow-y-auto p-4 rounded-xl bg-[#1c1a18]/70 border border-[#4a443f]/60 text-sm text-[#f3efe9] leading-relaxed font-sans select-text">
                  {selectedMessage.bodyHtml ? (
                    <div
                      dangerouslySetInnerHTML={{
                        __html: showRemoteImages
                          ? selectedMessage.bodyHtml
                          : selectedMessage.bodyHtml.replace(/<img[^>]*>/gi, '[Görsel Engellendi]'),
                      }}
                      className="space-y-2 prose-invert"
                    />
                  ) : (
                    <div className="whitespace-pre-wrap">{selectedMessage.bodyText}</div>
                  )}
                </div>

                {/* 5. Ekler Paneli */}
                {selectedMessage.attachments && selectedMessage.attachments.length > 0 && (
                  <div className="pt-2 border-t border-[#4a443f] space-y-2">
                    <span className="text-xs font-bold text-[#b99881] flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5" />
                      Ekler ({selectedMessage.attachments.length})
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {selectedMessage.attachments.map((att) => (
                        <div
                          key={att.id}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#34302d] border border-[#4a443f] text-xs text-white"
                        >
                          <FileText className="w-3.5 h-3.5 text-[#b99881]" />
                          <span className="font-medium max-w-[140px] truncate">{att.name}</span>
                          <span className="text-[10px] text-[#8c857f]">({Math.round(att.size / 1024)} KB)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-xs text-[#8c857f] space-y-2">
                <Inbox className="w-8 h-8 text-[#4a443f]" />
                <p>İçeriğini görüntülemek için sol listeden bir e-posta seçin.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* E-Posta Yazma Modalı */}
      <MailComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        currentUser={currentUser}
        replyToMessage={composeReplyMsg}
        replyAll={composeReplyAll}
        forwardMessage={composeForwardMsg}
      />

      {/* Hesap Yönetim Modalı */}
      <MailAccountManagerModal
        isOpen={isAccountManagerOpen}
        onClose={() => setIsAccountManagerOpen(false)}
        currentUser={currentUser}
      />
    </GlassModal>
  )
}
