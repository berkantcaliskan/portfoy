import React, { useState, useEffect } from 'react'
import {
  FileCheck2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Building,
  User,
  TurkishLira,
  Filter,
} from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlassButton } from '@/components/ui/GlassButton'
import { GlassBadge } from '@/components/ui/GlassBadge'
import { GlassModal } from '@/components/ui/GlassModal'
import { OverflowTabs } from '@/components/ui/OverflowTabs'
import {
  approvalStore,
  ApprovalRequest,
  ApprovalStatus,
} from '@/services/approvalStore'
import { userStore, AppUser } from '@/services/userStore'
import { formatCurrency } from '@/utils/formatters'
import { permissionService } from '@/services/permissionService'

export const ApprovalsView: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(userStore.getCurrentUser())
  const [approvals, setApprovals] = useState<ApprovalRequest[]>(() => approvalStore.getAll())
  const [filterStatus, setFilterStatus] = useState<string>('ALL')

  // Decision Modal
  const [selectedReq, setSelectedReq] = useState<ApprovalRequest | null>(null)
  const [decision, setDecision] = useState<'ONAYLANDI' | 'REDDEDILDI'>('ONAYLANDI')
  const [reviewNotes, setReviewNotes] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    const unsub = approvalStore.subscribe(() => {
      setApprovals(approvalStore.getAll())
    })
    return () => unsub()
  }, [])

  const filtered = approvals.filter((a) => {
    if (filterStatus !== 'ALL' && a.status !== filterStatus) return false
    return true
  })

  const pendingCount = approvals.filter((a) => a.status === 'BEKLEMEDE').length

  const handleOpenDecision = (req: ApprovalRequest, targetDecision: 'ONAYLANDI' | 'REDDEDILDI') => {
    setSelectedReq(req)
    setDecision(targetDecision)
    setReviewNotes('')
    setErrorMsg(null)
  }

  const handleExecuteDecision = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedReq || !currentUser) return

    const res = approvalStore.decideApproval(selectedReq.id, decision, currentUser, reviewNotes)
    if (!res.success) {
      setErrorMsg(res.error || 'Onay yetkisi doğrulanamadı.')
      return
    }

    setSelectedReq(null)
    setSuccessMsg(`Talep başarıyla ${decision === 'ONAYLANDI' ? 'onaylandı' : 'reddedildi'}.`)
    setTimeout(() => setSuccessMsg(null), 3500)
  }

  const canApprove = permissionService.canApproveDiscounts(currentUser)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <FileCheck2 className="w-5 h-5 text-[#b99881]" />
            <h2 className="text-2xl font-bold text-white tracking-wide">
              Yönetici Onayları
            </h2>
          </div>
          <p className="text-xs text-[#a69f99] mt-1">
            Satış iskonto yetkileri, kapora iade onayları ve rezervasyon opsiyon uzatma kararları.
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 rounded-[16px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex items-center justify-between gap-4 min-w-0">
        <OverflowTabs
          prefixLabel="Filtre:"
          activeId={filterStatus}
          onSelect={(id) => setFilterStatus(id)}
          tabs={[
            { id: 'ALL', label: 'Tümü' },
            { id: 'BEKLEMEDE', label: `Bekleyenler (${pendingCount})` },
            { id: 'ONAYLANDI', label: 'Onaylananlar' },
            { id: 'REDDEDILDI', label: 'Reddedilenler' },
          ]}
        />
      </div>

      {/* Talep Listesi */}
      {filtered.length === 0 ? (
        <div className="py-20 text-center flex flex-col items-center justify-center">
          <FileCheck2 className="w-10 h-10 text-[#8c857f] mx-auto mb-3 opacity-40" />
          <h3 className="text-sm font-semibold text-white">Onay talebi bulunamadı</h3>
          <p className="text-xs text-[#8c857f] mt-1 max-w-sm mx-auto">
            Seçili kriterde onay bekleyen işlem bulunmuyor.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((req) => {
            const isPending = req.status === 'BEKLEMEDE'
            const isApproved = req.status === 'ONAYLANDI'

            return (
              <div
                key={req.id}
                className={`responsive-card p-5 rounded-[20px] border transition-all flex flex-col justify-between space-y-3 ${
                  isPending
                    ? 'bg-[#282522] border-[#4a443f] hover:border-[#b99881]'
                    : isApproved
                    ? 'bg-[#24211f] border-emerald-500/20'
                    : 'bg-[#24211f] border-rose-500/20 opacity-70'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <span className="text-sm font-bold text-white truncate">{req.title}</span>
                    <GlassBadge
                      size="sm"
                      variant={isPending ? 'warning' : isApproved ? 'success' : 'danger'}
                    >
                      {req.status}
                    </GlassBadge>
                  </div>

                  <div className="space-y-1.5 text-xs text-[#a69f99] mt-3 min-w-0">
                    <div className="flex items-center gap-1.5 text-white min-w-0">
                      <User className="w-3.5 h-3.5 text-[#b99881] shrink-0" />
                      <span className="truncate">{req.customerName} ({req.projectName} - {req.unitNumber || 'Genel'})</span>
                    </div>

                    {req.amount && (
                      <div className="flex items-center gap-1.5 text-emerald-400 font-semibold min-w-0">
                        <TurkishLira className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">Talep Edilen Tutar: {formatCurrency(req.amount)}</span>
                      </div>
                    )}

                    <div className="text-[11px] text-[#8c857f] truncate">
                      Talep Eden: {req.requestedByUserName} ({req.requestedDepartment}) • {new Date(req.createdAt).toLocaleDateString('tr-TR')}
                    </div>

                    <p className="text-[11px] text-[#d6beae] mt-2 line-clamp-2">
                      Gerekçe: {req.reason}
                    </p>

                    {req.reviewNotes && (
                      <p className="text-[11px] text-white mt-1 font-medium line-clamp-2">
                        Yönetici Notu: {req.reviewNotes} ({req.reviewedByUserName})
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between gap-2 text-xs min-w-0">
                  <span className="text-[10px] text-[#8c857f] truncate">{req.type}</span>

                  {isPending && canApprove && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleOpenDecision(req, 'ONAYLANDI')}
                        title="Onayla"
                        className="card-action-btn px-3 py-1 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 font-semibold cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span className="btn-label">Onayla</span>
                      </button>
                      <button
                        onClick={() => handleOpenDecision(req, 'REDDEDILDI')}
                        title="Reddet"
                        className="card-action-btn px-3 py-1 rounded-full bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 font-semibold cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5 shrink-0" />
                        <span className="btn-label">Reddet</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* KARAR MODALI */}
      <GlassModal
        isOpen={selectedReq !== null}
        onClose={() => setSelectedReq(null)}
        title={`Yönetici Kararı - ${selectedReq?.title}`}
      >
        <form onSubmit={handleExecuteDecision} className="space-y-4">
          <div className="text-xs text-[#a69f99]">
            <div className="text-white font-bold">{selectedReq?.customerName}</div>
            <div className="mt-1">Gerekçe: {selectedReq?.reason}</div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-[12px] bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
              Yönetici Karar Notu
            </label>
            <textarea
              rows={3}
              placeholder="Karar gerekçesi, onaylanan şartlar vb."
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white placeholder-[#8c857f] focus:outline-none focus:border-[#b99881]"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setSelectedReq(null)}
              className="px-4 py-2 rounded-full text-xs text-[#a69f99] hover:text-white cursor-pointer"
            >
              Vazgeç
            </button>
            <GlassButton
              type="submit"
              variant={decision === 'ONAYLANDI' ? 'gold' : 'subtle'}
              size="sm"
              className="rounded-full px-5 font-bold"
            >
              Kararı Kaydet ({decision})
            </GlassButton>
          </div>
        </form>
      </GlassModal>
    </div>
  )
}
