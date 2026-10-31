import React, { useState } from 'react'
import { CustomSelect } from '@/components/ui/CustomSelect'
import {
  Zap,
  Radio,
  Copy,
  Check,
  ShieldCheck,
  Code2,
  Send,
  AlertCircle,
  Clock,
  Sparkles,
  RefreshCw,
} from 'lucide-react'
import { metaStore } from '@/services/metaStore'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlassButton } from '@/components/ui/GlassButton'
import { GlassBadge } from '@/components/ui/GlassBadge'
import { formatDate } from '@/utils/formatters'

export const MetaIntegrationView: React.FC = () => {
  const forms = metaStore.getForms()
  const logs = metaStore.getWebhookLogs()

  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [testFormName, setTestFormName] = useState(forms[0]?.name || '')
  const [testLeadName, setTestLeadName] = useState('Efe Candemir')
  const [testPhone, setTestPhone] = useState('05329998877')
  const [testType, setTestType] = useState('2+1')
  const [testSent, setTestSent] = useState(false)

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(fieldId)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const handleSimulateLead = (e: React.FormEvent) => {
    e.preventDefault()
    if (!testLeadName || !testPhone) return

    metaStore.simulateIncomingLead({
      fullName: testLeadName,
      phone: testPhone,
      formName: testFormName,
      preferredHousingType: testType,
      budget: testType === '1+1' ? 4200000 : testType === '2+1' ? 6800000 : 15000000,
    })

    setTestSent(true)
    setTimeout(() => setTestSent(false), 3000)
  }

  const webhookUrl = 'http://localhost:9001/api/v1/meta/webhook'
  const verifyToken = 'demirturk_meta_token_secure_2026'

  return (
    <div className="space-y-6">
      {/* Top Banner: Status */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-900/30 via-indigo-900/20 to-purple-900/30 border border-blue-500/20 backdrop-blur-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              Meta Lead Ads Webhook Altyapısı
              <GlassBadge variant="emerald" dot size="sm">
                Canlı Dinleyici Aktif
              </GlassBadge>
            </h4>
            <p className="text-xs text-slate-300">
              Facebook ve Instagram reklamlarınızdan gelen müşteri başvuruları gerçek zamanlı işlenir.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Entegrasyon Durumu:</span>
          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            Sağlıklı (Ready)
          </span>
        </div>
      </div>

      {/* Two Column Layout: Webhook Credentials & Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Webhook Configuration Details */}
        <GlassCard variant="default" className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-white/10">
            <ShieldCheck className="w-4 h-4 text-brand-gold" />
            <h5 className="text-sm font-bold text-white">
              Meta Developer Webhook Bilgileri
            </h5>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Meta for Developers panelinde <b>Lead Ads / Webhooks</b> aboneliği oluştururken aşağıdaki bağlantı bilgilerini kullanabilirsiniz:
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Callback URL (Geri Çağırma Adresi)
              </label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={webhookUrl}
                  className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-slate-200"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(webhookUrl, 'url')}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
                  title="Kopyala"
                >
                  {copiedField === 'url' ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Doğrulama Anahtarı (Verify Token)
              </label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={verifyToken}
                  className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-amber-300"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(verifyToken, 'token')}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
                  title="Kopyala"
                >
                  {copiedField === 'token' ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              Şu an test aşamasında olduğumuz için gerçek dosya aktarımı kapalıdır. Canlı simülatör ile güvenle test yapabilirsiniz.
            </span>
          </div>
        </GlassCard>

        {/* Live Webhook Simulator */}
        <GlassCard variant="gold" className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-gold" />
              <h5 className="text-sm font-bold text-white">
                Canlı Meta Lead Simülatörü
              </h5>
            </div>
            <GlassBadge variant="amber" size="sm">
              Anlık Tetikleyici
            </GlassBadge>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Meta reklam formundan yeni bir potansiyel alıcı başvurusu geldiğinde sistemin nasıl anında tepki verdiğini test edin:
          </p>

          <form onSubmit={handleSimulateLead} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Hedef Meta Formu
              </label>
              <CustomSelect
                value={testFormName}
                onChange={(e) => setTestFormName(e.target.value)}
                className="w-full rounded-xl bg-navy-950 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-gold"
              >
                {forms.map((f) => (
                  <option key={f.id} value={f.name}>
                    {f.name}
                  </option>
                ))}
              </CustomSelect>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Müşteri Adı
                </label>
                <input
                  type="text"
                  value={testLeadName}
                  onChange={(e) => setTestLeadName(e.target.value)}
                  className="w-full rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-gold"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Telefon
                </label>
                <input
                  type="text"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="w-full rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-gold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                İlgilendiği Konut Tipi
              </label>
              <CustomSelect
                value={testType}
                onChange={(e) => setTestType(e.target.value)}
                className="w-full rounded-xl bg-navy-950 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-gold"
              >
                <option value="1+1">1+1 Rezidans</option>
                <option value="2+1">2+1 Konut</option>
                <option value="Villa">Müstakil Villa</option>
              </CustomSelect>
            </div>

            <GlassButton
              variant="gold"
              size="md"
              type="submit"
              icon={<Send className="w-4 h-4" />}
              className="w-full mt-2"
            >
              {testSent ? '✓ Başvuru CRM’e İletildi!' : 'Meta Lead Webhook Gönder'}
            </GlassButton>
          </form>
        </GlassCard>
      </div>

      {/* Meta Forms Performance Cards */}
      <div className="space-y-3">
        <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wide">
          Aktif Meta Reklam Formları
        </h5>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {forms.map((f) => (
            <div
              key={f.id}
              className="p-4 rounded-2xl bg-navy-900/40 backdrop-blur-xl border border-white/8 space-y-2 hover:border-brand-gold/30 transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-bold text-white font-mono line-clamp-1" title={f.name}>
                  {f.name}
                </span>
                <GlassBadge variant="emerald" size="sm" dot>
                  Aktif
                </GlassBadge>
              </div>

              <p className="text-[11px] text-slate-400 truncate">
                {f.campaignName}
              </p>

              <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">Toplam Başvuru</span>
                  <span className="font-bold text-white">{f.leadCount} Lead</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px]">Dönüşüm</span>
                  <span className="font-bold text-brand-gold">%{f.conversionRate}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Webhook Events Stream */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wide flex items-center gap-2">
            <Code2 className="w-4 h-4 text-brand-gold" />
            Son Gelen Webhook Olayları (Event Stream)
          </h5>
          <span className="text-[11px] text-slate-400">
            Son {logs.length} olay kaydedildi
          </span>
        </div>

        <div className="rounded-2xl bg-navy-900/50 backdrop-blur-xl border border-white/10 divide-y divide-white/5 overflow-hidden">
          {logs.map((log) => (
            <div
              key={log.id}
              className="p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
                  ✓
                </div>
                <div>
                  <div className="font-semibold text-white">
                    {log.leadName}{' '}
                    <span className="text-slate-400 font-mono text-[11px]">
                      ({log.phone})
                    </span>
                  </div>
                  <div className="text-[11px] text-amber-300/80 font-mono">
                    {log.formName}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[11px] text-slate-400 font-mono">
                  {formatDate(log.receivedAt)}
                </span>
                <GlassBadge variant="emerald" size="sm">
                  {log.status}
                </GlassBadge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
