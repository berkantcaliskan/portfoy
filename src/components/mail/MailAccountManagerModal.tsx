import React, { useState } from 'react'
import {
  Shield,
  Plus,
  Building2,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  Power,
  Users,
} from 'lucide-react'
import { AppUser } from '@/services/userStore'
import { mailService } from '@/services/mailService'
import { MailAccount } from '@/types/mail'
import { Department, CANONICAL_DEPARTMENTS } from '@/types/department'
import { GlassModal } from '@/components/ui/GlassModal'
import { GlassButton } from '@/components/ui/GlassButton'

interface MailAccountManagerModalProps {
  isOpen: boolean
  onClose: () => void
  currentUser: AppUser | null
}

export const MailAccountManagerModal: React.FC<MailAccountManagerModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [accounts, setAccounts] = useState<MailAccount[]>(() => mailService.getAllAccounts())
  const [localPart, setLocalPart] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [department, setDepartment] = useState<Department>('Satış')
  const [quotaGb, setQuotaGb] = useState<number>(10)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setStatusMessage(null)

    const res = await mailService.createMailbox(
      {
        localPart,
        displayName: displayName.trim() || localPart,
        department,
        quotaMb: quotaGb * 1024,
      },
      currentUser
    )

    setIsSubmitting(false)
    if (res.success) {
      setStatusMessage({ type: 'success', text: `${res.account?.email} başarıyla oluşturuldu.` })
      setLocalPart('')
      setDisplayName('')
      setAccounts(mailService.getAllAccounts())
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Hesap oluşturulamadı.' })
    }
  }

  const handleToggleActive = async (accId: string) => {
    const res = await mailService.toggleAccountActive(accId, currentUser)
    if (res.success) {
      setAccounts(mailService.getAllAccounts())
    }
  }

  return (
    <GlassModal
      isOpen={isOpen}
      onClose={onClose}
      title="Kurumsal Posta Kutusu Yönetimi"
      description="Mailcow üzerinde @demirturkinsaat.com alan adına bağlı departman ve çalışan posta kutularını yönetin"
      maxWidth="3xl"
    >
      <div className="space-y-6 text-sm font-sans">
        {/* Yeni Kutu Oluşturma Formu */}
        <form onSubmit={handleCreate} className="p-5 rounded-[24px] bg-[#282522] border border-[#4a443f] space-y-4">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#b99881]" />
            Yeni Kurumsal Posta Kutusu Aç
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#a69f99] block mb-1">E-Posta Adresi</label>
              <div className="flex items-center rounded-xl bg-[#1c1a18] border border-[#4a443f] px-3 py-1.5 focus-within:border-[#b99881]">
                <input
                  type="text"
                  required
                  value={localPart}
                  onChange={(e) => setLocalPart(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                  placeholder="ornek"
                  className="w-full bg-transparent border-none text-xs text-white focus:outline-none"
                />
                <span className="text-xs font-mono text-[#b99881] shrink-0">@demirturkinsaat.com</span>
              </div>
            </div>

            <div>
              <label className="text-xs text-[#a69f99] block mb-1">Görünen İsim</label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Örn: Demirtürk Hukuk & Sözleşmeler"
                className="w-full rounded-xl bg-[#1c1a18] border border-[#4a443f] px-3 py-2 text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>

            <div>
              <label className="text-xs text-[#a69f99] block mb-1">Bağlı Departman</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value as Department)}
                className="w-full rounded-xl bg-[#1c1a18] border border-[#4a443f] px-3 py-2 text-xs text-white focus:outline-none focus:border-[#b99881] cursor-pointer"
              >
                {CANONICAL_DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept} Departmanı
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-[#a69f99] block mb-1">Depolama Kotası (GB)</label>
              <input
                type="number"
                min={2}
                max={100}
                value={quotaGb}
                onChange={(e) => setQuotaGb(Number(e.target.value))}
                className="w-full rounded-xl bg-[#1c1a18] border border-[#4a443f] px-3 py-2 text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>
          </div>

          {statusMessage && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <GlassButton
              variant="gold"
              size="sm"
              type="submit"
              disabled={isSubmitting}
              className="rounded-full px-5 text-xs font-bold"
            >
              Posta Kutusu Oluştur
            </GlassButton>
          </div>
        </form>

        {/* Mevcut Posta Kutuları Listesi */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-[#b99881] uppercase tracking-wider px-1">
            Aktif Kurumsal Posta Kutuları ({accounts.length})
          </h4>

          <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="p-4 rounded-2xl bg-[#282522]/80 border border-[#4a443f] flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                      acc.isActive
                        ? 'bg-[#34302d] text-[#b99881] border border-[#b99881]/40'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    @
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white truncate">{acc.displayName}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1c1a18] border border-[#4a443f] text-[#b99881] font-mono">
                        {acc.department}
                      </span>
                      {!acc.isActive && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-semibold">
                          Donduruldu
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-[#a69f99] font-mono block truncate">{acc.email}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-mono text-[#8c857f] hidden sm:inline">
                    {Math.round(acc.quotaMb / 1024)} GB Kota
                  </span>
                  <button
                    type="button"
                    onClick={() => handleToggleActive(acc.id)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                      acc.isActive
                        ? 'bg-rose-500/10 text-rose-300 border-rose-500/30 hover:bg-rose-500/20'
                        : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                    }`}
                    title={acc.isActive ? 'Erişimi Geçici Dondur' : 'Erişimi Yeniden Etkinleştir'}
                  >
                    {acc.isActive ? 'Dondur' : 'Etkinleştir'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </GlassModal>
  )
}
