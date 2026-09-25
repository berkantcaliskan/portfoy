import React, { useState } from 'react'
import { Calculator, DollarSign, Percent, Check, Copy, Sparkles, X } from 'lucide-react'
import { GlassModal } from '@/components/ui/GlassModal'
import { GlassButton } from '@/components/ui/GlassButton'
import { formatCurrency } from '@/utils/formatters'

interface CommissionCalculatorModalProps {
  isOpen: boolean
  onClose: () => void
  initialAmount?: number
}

export const CommissionCalculatorModal: React.FC<CommissionCalculatorModalProps> = ({
  isOpen,
  onClose,
  initialAmount = 5000000,
}) => {
  const [salePrice, setSalePrice] = useState<number>(initialAmount)
  const [commissionRate, setCommissionRate] = useState<number>(2) // 2%
  const [agencyRate, setAgencyRate] = useState<number>(4) // 4% Total Service Fee
  const [copied, setCopied] = useState(false)

  const totalAgencyFee = Math.round((salePrice * agencyRate) / 100)
  const salesRepCommission = Math.round((salePrice * commissionRate) / 100)
  const companyNet = totalAgencyFee - salesRepCommission

  const handleCopySummary = () => {
    const summary = `DEMİRTÜRK PORTFÖY | SATIŞ PRİM VE KOMİSYON RAPORU\n` +
      `Satış Bedeli: ${formatCurrency(salePrice)}\n` +
      `Hizmet Bedeli (%${agencyRate}): ${formatCurrency(totalAgencyFee)}\n` +
      `Satış Danışmanı Primi (%${commissionRate}): ${formatCurrency(salesRepCommission)}\n` +
      `Şirket Net Payı: ${formatCurrency(companyNet)}`
    navigator.clipboard.writeText(summary)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <GlassModal
      isOpen={isOpen}
      onClose={onClose}
      title="Satışçı Prim ve Komisyon Hesaplayıcı"
      maxWidth="md"
    >
      <div className="space-y-6">
        <p className="text-xs text-[#a69f99]">
          Satışını gerçekleştireceğiniz gayrimenkulün bedelini girerek hak edeceğiniz prim ve danışmanlık hizmet bedelini anında hesaplayın.
        </p>

        {/* Input Controls */}
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[#f3efe9] block mb-1.5">
              Satış / Anlaşma Bedeli (₺)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-[#b99881]">
                ₺
              </span>
              <input
                type="number"
                step="50000"
                value={salePrice || ''}
                onChange={(e) => setSalePrice(Number(e.target.value) || 0)}
                className="w-full bg-[#24211f] border border-[#4a443f] focus:border-[#b99881] rounded-full pl-10 pr-5 py-2.5 text-sm text-white focus:outline-none transition-colors"
                placeholder="Örn: 7.500.000"
              />
            </div>
            {/* Quick Presets */}
            <div className="flex items-center gap-2 mt-2">
              {[3500000, 6000000, 10000000, 18500000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setSalePrice(preset)}
                  className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-[11px] text-[#d6beae] border border-white/5 transition-colors cursor-pointer"
                >
                  {formatCurrency(preset)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[#f3efe9] block mb-1.5">
                Danışman Prim Oranı (%)
              </label>
              <div className="relative">
                <Percent className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#b99881]" />
                <select
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(Number(e.target.value))}
                  className="w-full bg-[#24211f] border border-[#4a443f] focus:border-[#b99881] rounded-full pl-9 pr-4 py-2 text-xs text-white focus:outline-none transition-colors"
                >
                  <option value={1}>%1.0 Standart</option>
                  <option value={1.5}>%1.5 Kademeli</option>
                  <option value={2}>%2.0 Üst Danışman</option>
                  <option value={2.5}>%2.5 Kıdemli Uzman</option>
                  <option value={3}>%3.0 Partner</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#f3efe9] block mb-1.5">
                Toplam Hizmet Bedeli (%)
              </label>
              <div className="relative">
                <Percent className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a69f99]" />
                <select
                  value={agencyRate}
                  onChange={(e) => setAgencyRate(Number(e.target.value))}
                  className="w-full bg-[#24211f] border border-[#4a443f] focus:border-[#b99881] rounded-full pl-9 pr-4 py-2 text-xs text-white focus:outline-none transition-colors"
                >
                  <option value={2}>%2 (Tek Taraflı)</option>
                  <option value={3}>%3 (Özel Anlaşma)</option>
                  <option value={4}>%4 (Çift Taraflı Standart)</option>
                  <option value={5}>%5 (Proje Lansman)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Results Banner (Pill Curved) */}
        <div className="p-5 rounded-[28px] bg-[#282522] border border-[#b99881]/30 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#d6beae]">
              Hak Edeceğiniz Satışçı Primi
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#b99881]/20 text-[#b99881] font-bold">
              %{commissionRate} Prim
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#b99881] tracking-tight">
            {formatCurrency(salesRepCommission)}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#4a443f] text-xs">
            <div>
              <span className="text-[#a69f99] block">Toplam Hizmet Bedeli:</span>
              <span className="font-semibold text-white">{formatCurrency(totalAgencyFee)}</span>
            </div>
            <div>
              <span className="text-[#a69f99] block">Şirket Net Payı:</span>
              <span className="font-semibold text-[#d6beae]">{formatCurrency(companyNet)}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <GlassButton
            variant="subtle"
            size="sm"
            onClick={handleCopySummary}
            icon={copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            className="rounded-full"
          >
            {copied ? 'Rapor Kopyalandı' : 'Hesaplamayı Kopyala'}
          </GlassButton>

          <GlassButton
            variant="gold"
            size="sm"
            onClick={onClose}
            className="rounded-full px-5"
          >
            Tamam
          </GlassButton>
        </div>
      </div>
    </GlassModal>
  )
}
