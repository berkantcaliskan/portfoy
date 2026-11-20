import { sharedFileStore, type SharedFile } from './sharedFileStore'
import { userStore } from './userStore'
import type { ChatMessage } from './messageStore'

export async function readMessageAttachment(message: ChatMessage): Promise<{ blob: Blob; name: string }> {
  const user = userStore.getCurrentUser()
  if (!user || (message.senderId !== user.id && message.recipientId !== user.id)) throw Error('Bu mesaja erişim izniniz yok.')
  const url = message.attachmentUrl
  if (!url || !/^data:[\w.+/-]+(?:;[\w-]+=[\w.+-]+)*;base64,[A-Za-z0-9+/=\r\n]+$/.test(url) || url.length > 1500000) throw Error('Mesaj dosyası bulunamadı veya biçimi geçersiz.')
  const blob = await (await fetch(url)).blob()
  if (!blob.size || blob.size > 1024 * 1024) throw Error('Mesaj dosyasının boyutu geçersiz.')
  if (user.id !== userStore.getCurrentUser()?.id) throw Error('Oturum değişti. Yeniden deneyin.')
  let name = (message.attachmentName || 'Mesaj eki').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_')
  if (message.attachmentType === 'voice' && !/\.[a-z0-9]{2,5}$/i.test(name)) name += blob.type.includes('ogg') ? '.ogg' : '.webm'
  return { blob, name }
}

export async function saveMessageAttachment(message: ChatMessage): Promise<void> {
  const user = userStore.getCurrentUser()
  const { blob, name } = await readMessageAttachment(message)
  if (!user || user.id !== userStore.getCurrentUser()?.id) throw Error('Oturum değişti. Yeniden deneyin.')
  let type: SharedFile['type'] = 'other'
  if (blob.type.startsWith('image/')) type = 'image'
  else if (blob.type.startsWith('audio/')) type = 'audio'
  else if (/\.pdf$/i.test(name)) type = 'pdf'
  else if (/\.(xlsx?|csv|tsv)$/i.test(name)) type = 'excel'
  else if (/\.(docx?|txt|rtf|pptx?|odt)$/i.test(name)) type = 'doc'
  else if (/\.(zip|rar|7z)$/i.test(name)) type = 'archive'
  await sharedFileStore.uploadFile({
    name, type, mimeType: blob.type, fileDataUrl: message.attachmentUrl,
    size: `${(blob.size / 1024).toFixed(1)} KB`, notes: 'Mesajlardan kaydedildi',
    shareTarget: 'MEMBERS', targetMemberIds: [user.id],
    permissions: { canView: true, canEdit: false, canReshare: false },
  }, user)
}

export async function downloadMessageAttachment(message: ChatMessage): Promise<void> {
  const { blob, name } = await readMessageAttachment(message)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60000)
}
