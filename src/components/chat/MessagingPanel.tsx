import React, { useState, useEffect, useRef } from 'react'
import {
  ChevronLeft,
  ArrowRight,
  ArrowLeft,
  Smile,
  Mic,
  Paperclip,
  Send,
  Plus,
  Search,
  X,
  User,
  Check,
  CheckCheck,
  FileText,
  Volume2,
  Trash2,
} from 'lucide-react'
import { messageStore, ChatConversation, ChatMessage } from '@/services/messageStore'
import { userStore, AppUser } from '@/services/userStore'

export const IosChatBubbleIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
  </svg>
)

interface MessagingPanelProps {
  currentUser?: AppUser | null
  isOpen: boolean
  onClose: () => void
}

const QUICK_EMOJIS = ['👍', '👋', '🏢', '🔑', '📄', '📞', '🤝', '✨', '🙏', '💼']

export const MessagingPanel: React.FC<MessagingPanelProps> = ({
  currentUser,
  isOpen,
  onClose,
}) => {
  const [mode, setMode] = useState<'popup' | 'sidebar'>(() => messageStore.getDisplayMode())
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => messageStore.getSidebarWidth())
  const [view, setView] = useState<'list' | 'contacts' | 'chat'>('list')
  const [activeConversation, setActiveConversation] = useState<ChatConversation | null>(null)
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [contactSearch, setContactSearch] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [isRecordingVoice, setIsRecordingVoice] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)

  // Track collapsed sidebar state to dynamically position popup
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('demirturk_sidebar_collapsed') === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    const handleCollapseChange = (e: any) => {
      if (e?.detail !== undefined) {
        setIsSidebarCollapsed(Boolean(e.detail))
      } else {
        try {
          setIsSidebarCollapsed(localStorage.getItem('demirturk_sidebar_collapsed') === 'true')
        } catch {}
      }
    }
    window.addEventListener('demirturk_sidebar_collapsed_changed', handleCollapseChange)
    return () => window.removeEventListener('demirturk_sidebar_collapsed_changed', handleCollapseChange)
  }, [])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isDraggingRef = useRef(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)

  // Subscribe to store updates
  useEffect(() => {
    const update = () => {
      setMode(messageStore.getDisplayMode())
      setSidebarWidth(messageStore.getSidebarWidth())
      if (currentUser) {
        setConversations(messageStore.getConversations(currentUser.id))
      }
      if (activeConversation) {
        setMessages(messageStore.getMessages(activeConversation.id))
      }
    }
    update()
    const unsub = messageStore.subscribe(update)
    return unsub
  }, [currentUser, activeConversation])

  // Scroll to bottom of chat when new message arrives
  useEffect(() => {
    if (view === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, view])

  // Voice recording timer
  useEffect(() => {
    let interval: any
    if (isRecordingVoice) {
      interval = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1)
      }, 1000)
    } else {
      setRecordingSeconds(0)
    }
    return () => clearInterval(interval)
  }, [isRecordingVoice])

  // Handle sidebar resize drag
  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingRef.current = true
    startXRef.current = e.clientX
    startWidthRef.current = sidebarWidth

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return
      // Moving left increases width
      const deltaX = startXRef.current - moveEvent.clientX
      const newWidth = Math.max(360, Math.min(800, startWidthRef.current + deltaX))
      setSidebarWidth(newWidth)
      messageStore.setSidebarWidth(newWidth)
    }

    const handleMouseUp = () => {
      isDraggingRef.current = false
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const handleToggleMode = (targetMode: 'popup' | 'sidebar') => {
    setMode(targetMode)
    messageStore.setDisplayMode(targetMode)
  }

  const handleSelectContact = (targetUser: AppUser) => {
    if (!currentUser) return
    const conv = messageStore.getOrCreateConversation(currentUser, targetUser)
    setActiveConversation(conv)
    setMessages(messageStore.getMessages(conv.id))
    setView('chat')
  }

  const handleOpenConversation = (conv: ChatConversation) => {
    setActiveConversation(conv)
    setMessages(messageStore.getMessages(conv.id))
    setView('chat')
  }

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!inputText.trim() || !activeConversation || !currentUser) return

    messageStore.sendMessage(
      activeConversation.id,
      currentUser,
      activeConversation.recipientId,
      inputText.trim()
    )
    setInputText('')
    setShowEmojiPicker(false)
  }

  const handleSendVoiceMessage = () => {
    if (!activeConversation || !currentUser) return
    setIsRecordingVoice(false)
    const secs = recordingSeconds || 3
    messageStore.sendMessage(
      activeConversation.id,
      currentUser,
      activeConversation.recipientId,
      '',
      'voice',
      `Ses Kaydı (00:${secs < 10 ? '0' : ''}${secs})`
    )
  }

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeConversation || !currentUser) return

    const isImage = file.type.startsWith('image/')
    const fileName = file.name
    const previewUrl = isImage ? URL.createObjectURL(file) : undefined

    messageStore.sendMessage(
      activeConversation.id,
      currentUser,
      activeConversation.recipientId,
      file.name,
      isImage ? 'image' : 'file',
      fileName,
      previewUrl
    )

    e.target.value = ''
  }

  const handleSendAttachment = () => {
    fileInputRef.current?.click()
  }

  const allUsers = userStore.getAllUsers()
  const availableUsers = allUsers.filter((u) => u.id !== currentUser?.id)
  const filteredUsers = availableUsers.filter((u) => {
    if (!contactSearch.trim()) return true
    const q = contactSearch.toLowerCase()
    return (
      u.fullName.toLowerCase().includes(q) ||
      u.department.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q)
    )
  })

  if (!isOpen) return null

  // ----------------------------------------------------
  // SUB-VIEWS
  // ----------------------------------------------------

  // 1. Contact Picker (Kullanıcı Listesi)
  const renderContactsView = () => (
    <div className="flex flex-col h-full bg-transparent animate-in fade-in duration-200">
      <div className="flex items-center justify-between pb-3 px-4 pt-3 bg-transparent">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setView('list')}
            className="p-1.5 rounded-full hover:bg-white/10 text-[#a69f99] hover:text-white transition-colors cursor-pointer"
            title="Geri Dön"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-bold text-white">Yeni Konuşma</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-full hover:bg-white/10 text-[#a69f99] hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Arama Barı */}
      <div className="p-3 bg-transparent">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#34302d] border border-[#4a443f] text-xs text-white">
          <Search className="w-3.5 h-3.5 text-[#b99881]" />
          <input
            type="text"
            placeholder="Ekip üyesi veya departman ara..."
            value={contactSearch}
            onChange={(e) => setContactSearch(e.target.value)}
            className="bg-transparent border-none text-xs text-white placeholder-[#8c857f] focus:outline-none w-full"
            autoFocus
          />
        </div>
      </div>

      {/* Kullanıcılar Listesi */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-transparent">
        {filteredUsers.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#8c857f]">
            Aramaya uygun kullanıcı bulunamadı.
          </div>
        ) : (
          filteredUsers.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between p-2.5 rounded-2xl bg-[#2e2a27]/80 hover:bg-[#38332f] border border-[#4a443f]/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-[#3e3834] border border-[#b99881]/40 flex items-center justify-center font-bold text-xs text-white shrink-0 overflow-hidden">
                  {u.avatarUrl ? (
                    <img src={u.avatarUrl} alt={u.fullName} className="w-full h-full object-cover" />
                  ) : (
                    u.fullName.charAt(0)
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">{u.fullName}</div>
                  <div className="text-[10px] text-[#b99881] truncate">{u.department}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleSelectContact(u)}
                className="px-3 py-1 rounded-full bg-[#b99881] hover:bg-[#a68670] text-white text-[11px] font-semibold transition-colors cursor-pointer shrink-0 shadow-xs"
              >
                Mesaj Gönder
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )

  // 2. Chat View (Birebir Konuşma Ekranı)
  const renderChatView = () => {
    if (!activeConversation) return null
    return (
      <div className="flex flex-col h-full bg-transparent animate-in fade-in duration-200">
        {/* Chat Header */}
        <div className="flex items-center justify-between p-3 bg-transparent">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Çubuksuz Sol Ok */}
            <button
              type="button"
              onClick={() => setView('list')}
              className="p-1 rounded-full hover:bg-white/10 text-[#d6beae] hover:text-white transition-colors cursor-pointer shrink-0"
              title="Geri Dön"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {/* Avatar & İsim */}
            <div className="w-8 h-8 rounded-full bg-[#3e3834] border border-[#b99881]/50 flex items-center justify-center font-bold text-xs text-white shrink-0 overflow-hidden">
              {activeConversation.recipientAvatar ? (
                <img
                  src={activeConversation.recipientAvatar}
                  alt={activeConversation.recipientName}
                  className="w-full h-full object-cover"
                />
              ) : (
                activeConversation.recipientName.charAt(0)
              )}
            </div>

            <div className="min-w-0">
              <span className="text-xs font-bold text-white block truncate">
                {activeConversation.recipientName}
              </span>
              <span className="text-[10px] text-[#b99881] block truncate">
                {activeConversation.recipientDepartment || 'Ekip Üyesi'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-full hover:bg-white/10 text-[#a69f99] hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mesaj Akışı (Scrollable Messages Area) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-transparent">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#8c857f] space-y-2">
              <IosChatBubbleIcon className="w-8 h-8 text-[#b99881]/60" />
              <p className="text-xs">Henüz mesaj yazılmadı.</p>
              <p className="text-[11px] text-[#a69f99]">Aşağıdaki alandan ilk mesajınızı gönderin.</p>
            </div>
          ) : (
            messages.map((m) => {
              const isMe = m.senderId === currentUser?.id
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={
                      isMe
                        ? 'max-w-[85%] pr-3 py-0.5 border-r-2 border-[#b99881] text-xs text-white leading-relaxed break-words text-right'
                        : 'max-w-[85%] px-3.5 py-2 rounded-2xl text-xs leading-relaxed bg-[#34302d] text-[#f3efe9] rounded-bl-xs border border-[#4a443f] break-words'
                    }
                  >
                    {/* Attachments */}
                    {m.attachmentType === 'image' && m.attachmentUrl && (
                      <div className={`py-1 mb-1 ${isMe ? 'flex justify-end' : ''}`}>
                        <img
                          src={m.attachmentUrl}
                          alt={m.attachmentName || 'Görsel'}
                          className="max-h-48 max-w-full rounded-xl object-cover border border-white/10 shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => window.open(m.attachmentUrl, '_blank')}
                        />
                      </div>
                    )}
                    {m.attachmentType === 'voice' && (
                      <div className={`flex items-center gap-2 py-1 font-medium ${isMe ? 'justify-end' : ''}`}>
                        <Volume2 className="w-4 h-4 shrink-0 text-white" />
                        <span>{m.attachmentName || 'Ses Kaydı'}</span>
                      </div>
                    )}
                    {m.attachmentType === 'file' && (
                      <div className="flex items-center gap-2 py-1.5 px-2 rounded-xl bg-black/20 border border-white/10 my-1 font-medium text-left">
                        <FileText className="w-4 h-4 shrink-0 text-[#b99881]" />
                        <span className="truncate text-xs font-mono">{m.attachmentName || 'Belge'}</span>
                      </div>
                    )}
                    {m.text && m.attachmentType !== 'image' && m.attachmentType !== 'file' && (
                      <div className="whitespace-pre-wrap">{m.text}</div>
                    )}
                  </div>

                  <span className={`text-[9px] text-[#8c857f] mt-1 ${isMe ? 'pr-3 text-right' : 'px-1'}`}>
                    {new Date(m.createdAt).toLocaleTimeString('tr-TR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Emoji Quick Picker Popup */}
        {showEmojiPicker && (
          <div className="p-2 bg-transparent flex flex-wrap gap-2">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setInputText((prev) => prev + emoji)}
                className="w-8 h-8 rounded-full hover:bg-white/10 text-base flex items-center justify-center transition-colors cursor-pointer"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Ses Kayıt Durumu */}
        {isRecordingVoice && (
          <div className="px-4 py-2 bg-rose-500/15 flex items-center justify-between text-xs text-rose-300">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
              <span>Ses Kaydediliyor... (00:{recordingSeconds < 10 ? '0' : ''}{recordingSeconds})</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsRecordingVoice(false)}
                className="text-xs text-[#a69f99] hover:text-white"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleSendVoiceMessage}
                className="px-2.5 py-0.5 rounded-full bg-rose-600 text-white text-xs font-bold"
              >
                Gönder
              </button>
            </div>
          </div>
        )}

        {/* Mesaj Yazma Alanı (Pill Design, İçi Şeffaf Input) */}
        <div className="p-3 bg-transparent space-y-2">
          {/* Gizli Dosya Seçici Input */}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelected}
          />

          <form
            onSubmit={handleSendMessage}
            className="flex items-center gap-2 rounded-full border border-[#4a443f] bg-transparent px-3 py-1.5 focus-within:border-[#b99881] transition-colors"
          >
            {/* Şeffaf Metin Girişi */}
            <input
              type="text"
              placeholder="Bir mesaj yazın..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 bg-transparent border-none text-xs text-white placeholder-[#8c857f] focus:outline-none"
            />

            {/* İkonlar Sırasıyla: 1. Emoji -> 2. Ses -> 3. Dosya/Görsel -> 4. Gönder */}
            <div className="flex items-center gap-1 text-[#a69f99]">
              {/* 1. Emoji Ekleme */}
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-1 rounded-full hover:text-[#b99881] hover:bg-white/10 transition-colors cursor-pointer"
                title="Emoji Ekle"
              >
                <Smile className="w-4 h-4" />
              </button>

              {/* 2. Ses Gönder */}
              <button
                type="button"
                onClick={() => setIsRecordingVoice(!isRecordingVoice)}
                className={`p-1 rounded-full hover:text-[#b99881] hover:bg-white/10 transition-colors cursor-pointer ${
                  isRecordingVoice ? 'text-rose-400' : ''
                }`}
                title="Ses Gönder"
              >
                <Mic className="w-4 h-4" />
              </button>

              {/* 3. Dosya / Görsel Gönder */}
              <button
                type="button"
                onClick={handleSendAttachment}
                className="p-1 rounded-full hover:text-[#b99881] hover:bg-white/10 transition-colors cursor-pointer"
                title="Dosya / Görsel Gönder"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              {/* Gönder Butonu */}
              <button
                type="submit"
                disabled={!inputText.trim()}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                  inputText.trim()
                    ? 'bg-[#b99881] text-white hover:bg-[#a68670]'
                    : 'text-[#8c857f] cursor-not-allowed opacity-40'
                }`}
                title="Gönder"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>

          {/* Alt Kontrol: Popup Modunda Sağa Bakan Ok (Tam Ekran Sağ Sidebar'a Geçiş) */}
          {mode === 'popup' && (
            <div className="flex items-center justify-end px-1 pt-1">
              <button
                type="button"
                onClick={() => handleToggleMode('sidebar')}
                className="p-1 rounded-full text-[#b99881] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Genişlet"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // 3. Conversation List View (Yazışmalar Ana Ekranı)
  const renderListView = () => (
    <div className="flex flex-col h-full flex-1 min-h-0 bg-transparent">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 px-4 pt-3.5 bg-transparent shrink-0">
        <div className="flex items-center gap-2">
          <IosChatBubbleIcon className="w-4 h-4 text-[#b99881]" />
          <span className="text-sm font-bold text-white tracking-wide">Yazışmalar</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setView('contacts')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#34302d] hover:bg-[#3d3733] border border-[#4a443f] text-[#d6beae] hover:text-white text-[11px] font-semibold transition-colors cursor-pointer"
            title="Yeni Konuşma Başlat"
          >
            <Plus className="w-3 h-3 text-[#b99881]" />
            <span>Yeni</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/10 text-[#a69f99] hover:text-white transition-colors cursor-pointer"
            title="Kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Conversations List or Empty State */}
      <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-2 bg-transparent">
        {conversations.length === 0 ? (
          <div className="py-12 px-4 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#34302d] border border-[#4a443f] flex items-center justify-center text-[#b99881]">
              <IosChatBubbleIcon className="w-6 h-6" />
            </div>
            <div className="text-xs font-semibold text-white">Yeni mesaj yok.</div>
            <p className="text-[11px] text-[#8c857f] max-w-[200px]">
              Ekip arkadaşlarınızla veya müşteri temsilcileriyle anlık yazışmaya başlayın.
            </p>
            <button
              type="button"
              onClick={() => setView('contacts')}
              className="mt-2 px-4 py-1.5 rounded-full bg-[#b99881] hover:bg-[#a68670] text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              Konuşma Başlat
            </button>
          </div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => handleOpenConversation(conv)}
              className="flex items-center gap-3 p-3 rounded-2xl bg-[#34302d]/70 hover:bg-[#3d3733] border border-[#4a443f]/50 transition-colors cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-[#3e3834] border border-[#b99881]/40 flex items-center justify-center font-bold text-xs text-white shrink-0 overflow-hidden">
                {conv.recipientAvatar ? (
                  <img src={conv.recipientAvatar} alt={conv.recipientName} className="w-full h-full object-cover" />
                ) : (
                  conv.recipientName.charAt(0)
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white truncate">{conv.recipientName}</span>
                  <span className="text-[10px] text-[#8c857f]">
                    {new Date(conv.lastMessageTime).toLocaleTimeString('tr-TR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[11px] text-[#a69f99] truncate">
                    {conv.lastMessageText || 'Yeni konuşma'}
                  </span>
                  {conv.unreadCount > 0 && (
                    <span className="w-4 h-4 rounded-full bg-[#b99881] text-[#1c1a18] text-[9px] font-bold flex items-center justify-center shrink-0 ml-1">
                      {conv.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Alt Footer: Popup modunda sağa geçiş oku (Yazısız, Sabit En Altta) */}
      {mode === 'popup' && (
        <div className="mt-auto shrink-0 p-2.5 bg-transparent flex items-center justify-end">
          <button
            type="button"
            onClick={() => handleToggleMode('sidebar')}
            className="p-1.5 rounded-full hover:bg-white/10 text-[#b99881] hover:text-white transition-colors cursor-pointer"
            title="Genişlet"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )

  // ----------------------------------------------------
  // CONTAINER RENDERING BASED ON MODE
  // ----------------------------------------------------

  // SIDEBAR MODE: Tam ekran sağa yaslanan, alt menü hariç sayfanın altına uzayan, sol kenarından sürüklenebilir panel
  if (mode === 'sidebar') {
    return (
      <div
        style={{
          width: typeof window !== 'undefined' && window.innerWidth < 768 ? '100%' : `${sidebarWidth}px`,
        }}
        className="dropdown-panel fixed top-0 right-0 bottom-0 z-50 md:z-40 bg-[#383830] border-l border-[#4a443f] flex flex-col w-full md:w-auto animate-in slide-in-from-right duration-250 select-none !rounded-none"
      >
        {/* Sürüklenebilir Sol Kenarlık (Draggable Resize Handle - Masaüstünde aktif) */}
        <div
          onMouseDown={handleMouseDownResize}
          className="hidden md:flex absolute -left-1.5 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-[#b99881]/40 active:bg-[#b99881] transition-colors z-40 items-center justify-center group"
          title="Genişliği ayarlamak için sürükleyin"
        >
          <div className="w-0.5 h-12 rounded-full bg-[#4a443f] group-hover:bg-[#b99881]" />
        </div>

        {/* İçerik */}
        <div className="flex-1 flex flex-col min-h-0 bg-transparent">
          {view === 'contacts' && renderContactsView()}
          {view === 'chat' && renderChatView()}
          {view === 'list' && renderListView()}
        </div>

        {/* Sol altta sola bakan ok ile tekrar açılır menü moduna geri dönüş (Katmansız, Tam ekrana geçiş okunun tam tersi: ArrowLeft) */}
        <div className="p-3 bg-transparent flex items-center justify-start shrink-0">
          <button
            type="button"
            onClick={() => handleToggleMode('popup')}
            className="p-1.5 rounded-full text-[#b99881] hover:text-white hover:bg-white/10 transition-colors cursor-pointer group"
            title="Küçük Ekrana Geri Dön"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          </button>
        </div>
      </div>
    )
  }

  // POPUP MODE: Sol alttaki mesaj ikonunun hemen yanında açılır
  return (
    <div
      className={`dropdown-panel fixed inset-x-0 md:inset-x-auto bottom-0 md:bottom-3 top-16 md:top-auto ${
        isSidebarCollapsed ? 'md:left-[74px]' : 'md:left-[222px]'
      } w-full md:w-[370px] h-[calc(100vh-64px)] md:h-[520px] rounded-t-[28px] md:rounded-[26px] shadow-2xl z-[60] animate-in slide-in-from-bottom md:zoom-in-95 duration-150 backdrop-blur-2xl flex flex-col overflow-hidden border border-[#4a443f]`}
    >
      {view === 'contacts' && renderContactsView()}
      {view === 'chat' && renderChatView()}
      {view === 'list' && renderListView()}
    </div>
  )
}
