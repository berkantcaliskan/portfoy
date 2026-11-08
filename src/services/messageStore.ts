import { AppUser, userStore } from './userStore'
import { isCentralCrm } from './crmRuntime'
import { createCrmServerCollection } from './crmServerCollection'

export interface ChatMessage {
  id: string
  conversationId: string
  senderId: string
  senderName: string
  recipientId: string
  text: string
  attachmentType?: 'emoji' | 'voice' | 'file' | 'image'
  attachmentName?: string
  attachmentUrl?: string
  duration?: string // for voice
  createdAt: string
  isRead: boolean
}

export interface ChatConversation {
  id: string
  participantIds: string[]
  recipientId: string
  recipientName: string
  recipientAvatar?: string
  recipientDepartment?: string
  lastMessageText: string
  lastMessageTime: string
  unreadCount: number
}

const STORAGE_KEY_CONVERSATIONS = 'demirturk_chat_conversations_v1'
const STORAGE_KEY_MESSAGES = 'demirturk_chat_messages_v1'
const STORAGE_KEY_MODE = 'demirturk_messages_mode'
const STORAGE_KEY_WIDTH = 'demirturk_messages_width'

type Listener = () => void

class MessageStore {
 private backend=createCrmServerCollection<ChatMessage>('messages',()=>{const user=userStore.getCurrentUser(),client=userStore.getServerClient();return user&&client?{id:user.id,client}:null})
 public setAccount(id:string|null) { this.backend.setAccount(id);this.messages={};this.conversations=[];this.notify() }
 public async refreshFromBackend() { await this.backend.refresh() }
 public getReadError() { return this.backend.getError() }
 private rebuildServerMessages() {
  const user=userStore.getCurrentUser();this.messages={};this.conversations=[];if(!user)return;
  const rows=this.backend.getAll().sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
  for(const row of rows) {
   (this.messages[row.conversationId]??=[]).push(row)
   const peer=row.senderId===user.id?row.recipientId:row.senderId;
   let conv=this.conversations.find(c=>c.id===row.conversationId)
   if(!conv){const person=userStore.getAllUsers().find(u=>u.id===peer);conv={id:row.conversationId,participantIds:[user.id,peer],recipientId:peer,recipientName:person?.fullName||row.senderName,recipientDepartment:person?.department,lastMessageText:'',lastMessageTime:row.createdAt,unreadCount:0};this.conversations.push(conv)}
   conv.lastMessageText=row.text||row.attachmentName||'';conv.lastMessageTime=row.createdAt;
   if(row.recipientId===user.id&&!row.isRead)conv.unreadCount++;
  }
  this.conversations.sort((a,b)=>b.lastMessageTime.localeCompare(a.lastMessageTime));this.notify()
 }
 public async markRead(peer:string) { const client=userStore.getServerClient();if(!isCentralCrm()||!client)return;const {error}=await client.rpc('crm_mark_messages_read',{p_peer:peer}).abortSignal(AbortSignal.timeout(15000));if(error)throw Error('Mesaj okundu bilgisi kaydedilemedi.');await this.refreshFromBackend() }

  private conversations: ChatConversation[] = []
  private messages: Record<string, ChatMessage[]> = {}
  private listeners: Set<Listener> = new Set()
  private isOpen: boolean = false
  private displayMode: 'popup' | 'sidebar' = 'popup'

  constructor() {
    this.backend.subscribe(()=>{if(isCentralCrm())this.rebuildServerMessages()})
    this.loadFromStorage()
    try {
      localStorage.setItem(STORAGE_KEY_MODE, 'popup')
    } catch {}
  }

  private loadFromStorage() {
    if(isCentralCrm())return
    try {
      const savedConv = localStorage.getItem(STORAGE_KEY_CONVERSATIONS)
      const savedMsg = localStorage.getItem(STORAGE_KEY_MESSAGES)
      this.conversations = savedConv ? JSON.parse(savedConv) : []
      this.messages = savedMsg ? JSON.parse(savedMsg) : {}
    } catch {
      this.conversations = []
      this.messages = {}
    }
  }

  private saveToStorage() {
    if(isCentralCrm()){this.notify();return}
    try {
      localStorage.setItem(STORAGE_KEY_CONVERSATIONS, JSON.stringify(this.conversations))
      localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(this.messages))
    } catch (e) {
      console.error('MessageStore save error:', e)
    }
    this.notify()
  }

  private notify() {
    this.listeners.forEach((l) => l())
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  public isPanelOpen(): boolean {
    return this.isOpen
  }

  public setPanelOpen(open: boolean) {
    this.isOpen = open
    if (open) {
      this.displayMode = 'popup'
      try {
        localStorage.setItem(STORAGE_KEY_MODE, 'popup')
      } catch {}
    }
    this.notify()
  }

  public togglePanel() {
    this.isOpen = !this.isOpen
    if (this.isOpen) {
      this.displayMode = 'popup'
      try {
        localStorage.setItem(STORAGE_KEY_MODE, 'popup')
      } catch {}
    }
    this.notify()
  }

  public getDisplayMode(): 'popup' | 'sidebar' {
    return this.displayMode
  }

  public setDisplayMode(mode: 'popup' | 'sidebar') {
    this.displayMode = mode
    try {
      localStorage.setItem(STORAGE_KEY_MODE, mode)
    } catch {}
    this.notify()
  }

  public getSidebarWidth(): number {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_WIDTH)
      if (saved) {
        const parsed = parseInt(saved, 10)
        if (!isNaN(parsed) && parsed >= 340 && parsed <= 800) return parsed
      }
    } catch {}
    return 420
  }

  public setSidebarWidth(width: number) {
    try {
      localStorage.setItem(STORAGE_KEY_WIDTH, width.toString())
    } catch {}
    this.notify()
  }

  public getConversations(currentUserId: string): ChatConversation[] {
    return this.conversations.filter((c) => c.participantIds.includes(currentUserId))
  }

  public getMessages(conversationId: string): ChatMessage[] {
    return this.messages[conversationId] || []
  }

  public getOrCreateConversation(currentUser: AppUser, recipientUser: AppUser): ChatConversation {
    const existing = this.conversations.find(
      (c) =>
        c.participantIds.includes(currentUser.id) &&
        c.participantIds.includes(recipientUser.id)
    )

    if (existing) {
      return existing
    }

    const newId = isCentralCrm() ? [currentUser.id,recipientUser.id].sort().join("::") : `conv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    const newConv: ChatConversation = {
      id: newId,
      participantIds: [currentUser.id, recipientUser.id],
      recipientId: recipientUser.id,
      recipientName: recipientUser.fullName,
      recipientAvatar: recipientUser.avatarUrl,
      recipientDepartment: recipientUser.department,
      lastMessageText: '',
      lastMessageTime: new Date().toISOString(),
      unreadCount: 0,
    }

    this.conversations = [newConv, ...this.conversations]
    this.messages[newId] = []
    this.saveToStorage()
    return newConv
  }

  public async sendMessage(
    conversationId: string,
    sender: AppUser,
    recipientId: string,
    text: string,
    attachmentType?: 'emoji' | 'voice' | 'file' | 'image',
    attachmentName?: string,
    attachmentUrl?: string
  ): Promise<ChatMessage> {
    const newMsg: ChatMessage = {
      id: isCentralCrm()?crypto.randomUUID():`msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      conversationId,
      senderId: sender.id,
      senderName: sender.fullName,
      recipientId,
      text: text.trim(),
      attachmentType,
      attachmentName,
      attachmentUrl,
      createdAt: new Date().toISOString(),
      isRead: false,
    }

    if(isCentralCrm())return this.backend.save(JSON.stringify(newMsg),newMsg)
    const currentList = this.messages[conversationId] || []
    this.messages[conversationId] = [...currentList, newMsg]

    // Update conversation last message
    this.conversations = this.conversations.map((c) => {
      if (c.id === conversationId) {
        let snippet = text.trim()
        if (!snippet && attachmentType === 'voice') snippet = '🎤 Ses kaydı'
        else if (!snippet && attachmentType === 'image') snippet = '📷 Fotoğraf'
        else if (!snippet && attachmentType === 'file') snippet = '📎 Dosya'

        return {
          ...c,
          lastMessageText: snippet,
          lastMessageTime: newMsg.createdAt,
        }
      }
      return c
    })

    this.saveToStorage()
    return newMsg
  }

  public getTotalUnreadCount(currentUserId: string): number {
    const userConvs = this.getConversations(currentUserId)
    return userConvs.reduce((acc, c) => acc + (c.unreadCount || 0), 0)
  }
}

export const messageStore = new MessageStore()
