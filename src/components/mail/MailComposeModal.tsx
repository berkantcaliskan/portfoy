import React, { useState } from 'react'
import { CustomSelect } from '@/components/ui/CustomSelect'
import {
  X,
  Send,
  Paperclip,
  Trash2,
  AlertCircle,
  CheckCircle2,
  FileText,
  Building2,
  ChevronDown,
} from 'lucide-react'
import { AppUser } from '@/services/userStore'
import { mailService } from '@/services/mailService'
import { MailAccount, MailAttachment, MailMessage } from '@/types/mail'
import { GlassModal } from '@/components/ui/GlassModal'
import { GlassButton } from '@/components/ui/GlassButton'

interface MailComposeModalProps {
  isOpen: boolean
  onClose: () => void
  currentUser: AppUser | null
  replyToMessage?: MailMessage | null
  replyAll?: boolean
  forwardMessage?: MailMessage | null
  initialTo?: string
  initialSubject?: string
  initialLinkedLeadId?: string
}

export const MailComposeModal: React.FC<MailComposeModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  replyToMessage,
  replyAll = false,
  forwardMessage,
  initialTo = '',
  initialSubject = '',
  initialLinkedLeadId,
}) => {
  const allowedAccounts = mailService.getAccountsForUser(currentUser)
  const defaultAccount = allowedAccounts[0] || null

  const [selectedAccountId, setSelectedAccountId] = useState<string>(() => {
    if (replyToMessage) return replyToMessage.accountId
    if (forwardMessage) return forwardMessage.accountId
    return defaultAccount?.id || ''
  })

  // To, CC, BCC
  const [toInput, setToInput] = useState<string>(() => {
    if (replyToMessage) {
      if (replyAll) {
        const recipients = [
          replyToMessage.from.email,
          ...(replyToMessage.to?.map((t) => t.email) || []),
        ].filter((email) => email !== defaultAccount?.email)
        return Array.from(new Set(recipients)).join(', ')
      }
      return replyToMessage.from.email
    }
    return initialTo
  })

  const [ccInput, setCcInput] = useState<string>(() => {
    if (replyAll && replyToMessage?.cc) {
      return replyToMessage.cc.map((c) => c.email).join(', ')
    }
    return ''
  })

  const [bccInput, setBccInput] = useState<string>('')
  const [showCc, setShowCc] = useState(Boolean(ccInput))
  const [showBcc, setShowBcc] = useState(false)

  // Subject
  const [subject, setSubject] = useState<string>(() => {
    if (replyToMessage) {
      return replyToMessage.subject.startsWith('Re:')
        ? replyToMessage.subject
        : `Re: ${replyToMessage.subject}`
    }
    if (forwardMessage) {
      return forwardMessage.subject.startsWith('Fwd:')
        ? forwardMessage.subject
        : `Fwd: ${forwardMessage.subject}`
    }
    return initialSubject
  })

  // Body
  const [bodyText, setBodyText] = useState<string>(() => {
    if (replyToMessage) {
      return `\n\n--- ${replyToMessage.from.name} (${replyToMessage.date}) yazdı ---\n${replyToMessage.bodyText}`
    }
    if (forwardMessage) {
      return `\n\n--- İletilen Mesaj (${forwardMessage.from.name}) ---\n${forwardMessage.bodyText}`
    }
    return ''
  })

  const [includeSignature, setIncludeSignature] = useState(true)
  const [attachments, setAttachments] = useState<MailAttachment[]>([])
  const [isSending, setIsSending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successToast, setSuccessToast] = useState(false)

  // Idempotency key per compose session
  const [idempotencyKey] = useState<string>(() => `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`)

  if (!isOpen) return null

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const newAttachments: MailAttachment[] = []
    let totalSize = attachments.reduce((sum, a) => sum + a.size, 0)

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (totalSize + file.size > 25 * 1024 * 1024) {
        setErrorMessage('Toplam ek boyutu 25 MB sunucu sınırını aşamaz.')
        return
      }
      totalSize += file.size
      newAttachments.push({
        id: `att-${Date.now()}-${i}`,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
      })
    }

    setAttachments((prev) => [...prev, ...newAttachments])
    setErrorMessage(null)
  }

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSending) return // Çift tıklama engeli

    const toList = toInput
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.includes('@'))

    if (toList.length === 0) {
      setErrorMessage('Geçerli en az bir alıcı (Kime) adresi giriniz.')
      return
    }

    const ccList = ccInput
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.includes('@'))

    const bccList = bccInput
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.includes('@'))

    setIsSending(true)
    setErrorMessage(null)

    const account = allowedAccounts.find((a) => a.id === selectedAccountId) || allowedAccounts[0]
    if (!account) {
      setErrorMessage('Gönderici hesabı seçilmedi.')
      setIsSending(false)
      return
    }

    let finalBody = bodyText
    if (includeSignature) {
      finalBody += `\n\n--\n${currentUser?.fullName || account.displayName}\nDemirtürk İnşaat & Gayrimenkul\n${account.email} | www.demirturkinsaat.com`
    }

    const res = await mailService.sendMessage(
      {
        accountId: account.id,
        from: account.email,
        to: toList,
        cc: ccList.length > 0 ? ccList : undefined,
        bcc: bccList.length > 0 ? bccList : undefined,
        subject: subject.trim() || '(Konusuz)',
        bodyText: finalBody,
        bodyHtml: `<div style="font-family: sans-serif; white-space: pre-wrap; line-height: 1.6;">${finalBody}</div>`,
        attachments: attachments.length > 0 ? attachments : undefined,
        idempotencyKey,
        inReplyTo: replyToMessage?.messageId || forwardMessage?.messageId,
        linkedLeadId: initialLinkedLeadId,
      },
      currentUser
    )

    if (res.success) {
      setSuccessToast(true)
      setTimeout(() => {
        setIsSending(false)
        onClose()
      }, 700)
    } else {
      setIsSending(false)
      setErrorMessage(res.error || 'Gönderim sırasında hata oluştu.')
    }
  }

  return (
    <GlassModal
      isOpen={isOpen}
      onClose={onClose}
      title="Yeni E-Posta Gönder"
      description="Demirtürk kurumsal posta altyapısı üzerinden şifreli ve doğrulanmış ileti oluşturun"
      maxWidth="3xl"
    >
      <form onSubmit={handleSend} className="space-y-4 text-sm font-sans">
        {/* Gönderici Seçici */}
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#282522] border border-[#4a443f]">
          <span className="text-xs text-[#a69f99] w-14 shrink-0 font-medium">Kimden:</span>
          <div className="relative flex-1">
            <CustomSelect
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full bg-[#34302d] border border-[#4a443f] text-[#f3efe9] text-xs font-semibold rounded-xl px-3 py-1.5 focus:outline-none focus:border-[#b99881] cursor-pointer"
            >
              {allowedAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.displayName} &lt;{acc.email}&gt; ({acc.department})
                </option>
              ))}
            </CustomSelect>
          </div>
        </div>

        {/* Alıcılar (Kime) */}
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#282522] border border-[#4a443f]">
          <span className="text-xs text-[#a69f99] w-14 shrink-0 font-medium">Kime:</span>
          <input
            type="text"
            required
            value={toInput}
            onChange={(e) => setToInput(e.target.value)}
            placeholder="alici@ornek.com (virgülle ayırın)"
            className="w-full bg-transparent border-none text-xs text-white placeholder-[#8c857f] focus:outline-none"
          />
          <div className="flex items-center gap-2 text-[11px] text-[#8c857f] shrink-0">
            {!showCc && (
              <button
                type="button"
                onClick={() => setShowCc(true)}
                className="hover:text-[#b99881] transition-colors cursor-pointer"
              >
                CC
              </button>
            )}
            {!showBcc && (
              <button
                type="button"
                onClick={() => setShowBcc(true)}
                className="hover:text-[#b99881] transition-colors cursor-pointer"
              >
                BCC
              </button>
            )}
          </div>
        </div>

        {/* CC */}
        {showCc && (
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#282522] border border-[#4a443f] animate-in fade-in duration-150">
            <span className="text-xs text-[#a69f99] w-14 shrink-0 font-medium">Bilgi (CC):</span>
            <input
              type="text"
              value={ccInput}
              onChange={(e) => setCcInput(e.target.value)}
              placeholder="bilgi@ornek.com"
              className="w-full bg-transparent border-none text-xs text-white placeholder-[#8c857f] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                setShowCc(false)
                setCcInput('')
              }}
              className="text-[#8c857f] hover:text-white p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* BCC */}
        {showBcc && (
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#282522] border border-[#4a443f] animate-in fade-in duration-150">
            <span className="text-xs text-[#a69f99] w-14 shrink-0 font-medium">Gizli (BCC):</span>
            <input
              type="text"
              value={bccInput}
              onChange={(e) => setBccInput(e.target.value)}
              placeholder="gizli@ornek.com"
              className="w-full bg-transparent border-none text-xs text-white placeholder-[#8c857f] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                setShowBcc(false)
                setBccInput('')
              }}
              className="text-[#8c857f] hover:text-white p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Konu */}
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#282522] border border-[#4a443f]">
          <span className="text-xs text-[#a69f99] w-14 shrink-0 font-medium">Konu:</span>
          <input
            type="text"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="E-posta konusu..."
            className="w-full bg-transparent border-none text-xs font-semibold text-white placeholder-[#8c857f] focus:outline-none"
          />
        </div>

        {/* Ekler Listesi */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 p-3 rounded-2xl bg-[#24211f] border border-[#4a443f]">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#34302d] border border-[#4a443f] text-xs text-[#f3efe9]"
              >
                <Paperclip className="w-3 h-3 text-[#b99881]" />
                <span className="max-w-[160px] truncate font-medium">{att.name}</span>
                <span className="text-[10px] text-[#8c857f]">({Math.round(att.size / 1024)} KB)</span>
                <button
                  type="button"
                  onClick={() => handleRemoveAttachment(att.id)}
                  className="text-[#8c857f] hover:text-rose-400 ml-1 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Mesaj Gövdesi */}
        <div className="rounded-2xl bg-[#282522] border border-[#4a443f] p-3 space-y-2">
          <textarea
            required
            rows={8}
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            placeholder="Mesajınızı buraya yazınız..."
            className="w-full bg-transparent border-none text-sm text-[#f3efe9] placeholder-[#8c857f] focus:outline-none resize-none leading-relaxed font-sans"
          />

          {/* İmza Onay Kutusu */}
          <div className="pt-2 border-t border-[#4a443f]/60 flex items-center justify-between text-xs text-[#8c857f]">
            <label className="flex items-center gap-2 cursor-pointer select-none text-[#a69f99] hover:text-white">
              <input
                type="checkbox"
                checked={includeSignature}
                onChange={(e) => setIncludeSignature(e.target.checked)}
                className="rounded accent-[#b99881]"
              />
              <span>Kurumsal e-posta imzasını ekle</span>
            </label>
            <span className="text-[11px] font-mono">{bodyText.length} karakter</span>
          </div>
        </div>

        {/* Hata Bildirimi */}
        {errorMessage && (
          <div className="flex items-center gap-2 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Alt Eylemler */}
        <div className="flex items-center justify-between pt-2 border-t border-[#4a443f]">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#34302d] hover:bg-[#3d3733] border border-[#4a443f] text-xs text-[#d6beae] hover:text-white transition-colors cursor-pointer">
              <Paperclip className="w-3.5 h-3.5 text-[#b99881]" />
              <span>Dosya Ekle</span>
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            <span className="text-[10px] text-[#8c857f]">Maks: 25 MB</span>
          </div>

          <div className="flex items-center gap-3">
            <GlassButton
              variant="subtle"
              size="sm"
              type="button"
              onClick={onClose}
              className="rounded-full px-4 text-xs"
            >
              Vazgeç
            </GlassButton>
            <GlassButton
              variant="gold"
              size="sm"
              type="submit"
              disabled={isSending}
              icon={<Send className="w-3.5 h-3.5" />}
              className="rounded-full px-6 text-xs font-bold"
            >
              {isSending ? 'Gönderiliyor...' : 'Gönder'}
            </GlassButton>
          </div>
        </div>
      </form>
    </GlassModal>
  )
}
