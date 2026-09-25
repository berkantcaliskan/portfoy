import React from 'react'
import {
  Users,
  Target,
  Clock,
  Sparkles,
  Home,
  CheckCircle2,
  AlertCircle,
  Share2,
  PhoneCall,
  MessageSquare,
  TrendingUp,
  DollarSign,
  Briefcase,
  FileCheck2,
  CalendarCheck,
  Building2,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react'
import { Lead, STAGE_CONFIGS } from '@/types/lead'
import { PortfolioItem } from '@/types/portfolio'
import { AppUser } from '@/services/userStore'
import { Department } from '@/types/department'
import { formatCurrency, formatDate, generateWhatsAppUrl } from '@/utils/formatters'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlassBadge } from '@/components/ui/GlassBadge'
import { appointmentStore } from '@/services/appointmentStore'
import { accountingStore } from '@/services/accountingStore'
import { projectStore } from '@/services/projectStore'
import { approvalStore } from '@/services/approvalStore'
import { requestStore } from '@/services/requestStore'
import { metaStore } from '@/services/metaStore'

interface DashboardViewProps {
  leads: Lead[]
  properties: PortfolioItem[]
  onSelectLead: (lead: Lead) => void
  onNavigateToTab?: (tab: any) => void
  currentUser?: AppUser | null
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  leads,
  properties,
  onSelectLead,
  onNavigateToTab,
  currentUser,
}) => {
  const department: Department = currentUser?.department || 'Pazarlama'

  // Sub-store states for department-specific widgets
  const appointments = appointmentStore.getAll(currentUser)
  const collections = accountingStore.getCollections()
  const payments = accountingStore.getPayments()
  const projects = projectStore.getAll()
  const approvals = approvalStore.getAll()
  const requests = requestStore.getAll()
  const metaForms = metaStore.getForms()

  // Common title header adhering to strict guidelines:
  // "Başlık her zaman Başlangıç'tır. Asla katman içinde değildir. Yanında bir ikon olabilir. Altındaki çizgi kaldırıldı."
  const renderHeader = () => (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <Home className="w-5 h-5 text-[#b99881]" />
        <h1 className="text-2xl font-bold text-white tracking-wide">
          Başlangıç
        </h1>
        <span className="text-sm font-semibold px-3 py-1 rounded-full bg-[#3d3733] text-[#b99881] border border-[#4a443f]">
          {department}
        </span>
      </div>
      <div className="text-sm font-medium text-[#c4bcb5]">
        {new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </div>
    </div>
  )

  // 1. DİJİTAL PAZARLAMA BAŞLANGIÇ
  const renderMarketingDashboard = () => {
    const metaLeads = leads.filter((l) => l.source === 'META_ADS')
    const qualifiedCount = leads.filter((l) => l.stage === 'QUALIFIED' || l.stage === 'WON').length
    const qualifiedRate = leads.length > 0 ? Math.round((qualifiedCount / leads.length) * 100) : 0

    return (
      <div className="space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between text-[#d6beae] text-sm font-medium">
              <span>Toplam Aday Havuzu</span>
              <Users className="w-5 h-5 text-[#b99881]" />
            </div>
            <div className="text-3xl font-bold text-white mt-2 font-mono tracking-tight">{leads.length}</div>
            <div className="text-xs sm:text-sm text-[#a69f99] mt-1.5">Aktif veri tabanı</div>
          </GlassCard>

          <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between text-[#d6beae] text-sm font-medium">
              <span>Meta Ads Leadleri</span>
              <Share2 className="w-5 h-5 text-[#38bdf8]" />
            </div>
            <div className="text-3xl font-bold text-white mt-2 font-mono tracking-tight">{metaLeads.length}</div>
            <div className="text-xs sm:text-sm text-[#a69f99] mt-1.5">Instagram & Facebook</div>
          </GlassCard>

          <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between text-[#d6beae] text-sm font-medium">
              <span>Nitelikli Aday Oranı</span>
              <Target className="w-5 h-5 text-[#34d399]" />
            </div>
            <div className="text-3xl font-bold text-white mt-2 font-mono tracking-tight">%{qualifiedRate}</div>
            <div className="text-xs sm:text-sm text-[#a69f99] mt-1.5">{qualifiedCount} nitelikli aday</div>
          </GlassCard>

          <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between text-[#d6beae] text-sm font-medium">
              <span>Meta Entegrasyon</span>
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-base font-bold text-emerald-400 mt-2 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              Webhook Canlı
            </div>
            <div className="text-xs sm:text-sm text-[#a69f99] mt-1.5">Graph API v19.0 Hazır</div>
          </GlassCard>
        </div>

        {/* Son Gelen Meta Başvuruları & Kampanya Performansı */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlassCard className="p-5 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">Son Müşteri Başvuruları</h3>
              <span className="text-sm font-semibold text-[#b99881]">{leads.length} Kayıt</span>
            </div>
            {leads.length === 0 ? (
              <div className="text-center py-8 text-sm text-[#a69f99]">
                Henüz kayıtlı müşteri adayı bulunmuyor.
              </div>
            ) : (
              <div className="space-y-2.5">
                {leads.slice(0, 5).map((l) => (
                  <div
                    key={l.id}
                    onClick={() => onSelectLead(l)}
                    className="p-3 rounded-[16px] bg-[#34302d] hover:bg-[#3d3733] border border-[#4a443f] cursor-pointer transition-colors flex items-center justify-between"
                  >
                    <div>
                      <div className="text-sm font-bold text-white">{l.fullName}</div>
                      <div className="text-xs sm:text-sm text-[#a69f99] mt-0.5">{l.formName}</div>
                    </div>
                    <div className="text-right">
                      <GlassBadge size="sm" variant={l.stage === 'NEW' ? 'warning' : 'primary'}>
                        {STAGE_CONFIGS[l.stage]?.label || l.stage}
                      </GlassBadge>
                      <div className="text-xs text-[#8c857f] mt-1">{formatDate(l.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          <GlassCard className="p-5 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">Aktif Meta Formları</h3>
              <span className="text-sm font-medium text-[#8c857f]">{metaForms.length} Form</span>
            </div>
            <div className="space-y-2.5">
              {metaForms.map((f) => (
                <div key={f.id} className="p-3 rounded-[16px] bg-[#34302d] border border-[#4a443f]">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white truncate max-w-[340px] sm:max-w-[420px]">{f.name}</span>
                    <span className="text-sm font-bold font-mono text-[#b99881]">{f.leadCount} Lead</span>
                  </div>
                  <div className="flex items-center justify-between text-xs sm:text-sm text-[#8c857f] mt-1.5">
                    <span>{f.campaignName}</span>
                    <span className="text-emerald-400 font-semibold font-mono text-xs sm:text-sm">%{f.conversionRate} Dönüşüm</span>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    )
  }

  // 2. SATIŞ BAŞLANGIÇ
  const renderSalesDashboard = () => {
    // Leads assigned to current sales rep (or all if scope ALL)
    const myLeads = currentUser?.scope === 'ASSIGNED_ONLY'
      ? leads.filter((l) => l.assignedToUserId === currentUser.id || l.owner === currentUser.fullName)
      : leads

    const todayStr = new Date().toISOString().split('T')[0]
    const todayAppointments = appointments.filter((a) => a.date === todayStr)
    const hotOffers = myLeads.filter((l) => l.stage === 'OFFER' || l.stage === 'PRESENTATION')
    const allUnits = projects.flatMap((p) => p.units || [])
    const reservedUnits = allUnits.filter((u) => u.status === 'REZERVE')

    return (
      <div className="space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between text-[#d6beae] text-sm font-medium">
              <span>Portföyümdeki Müşteriler</span>
              <Users className="w-5 h-5 text-[#b99881]" />
            </div>
            <div className="text-3xl font-bold text-white mt-2 font-mono tracking-tight">{myLeads.length}</div>
            <div className="text-xs sm:text-sm text-[#a69f99] mt-1.5">Atanan aktif portföy</div>
          </GlassCard>

          <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between text-[#d6beae] text-sm font-medium">
              <span>Bugünkü Randevular</span>
              <CalendarCheck className="w-5 h-5 text-sky-400" />
            </div>
            <div className="text-3xl font-bold text-white mt-2 font-mono tracking-tight">{todayAppointments.length}</div>
            <div className="text-xs sm:text-sm text-[#a69f99] mt-1.5">Görüşme ve sunumlar</div>
          </GlassCard>

          <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between text-[#d6beae] text-sm font-medium">
              <span>Sıcak Teklifler</span>
              <TrendingUp className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-3xl font-bold text-white mt-2 font-mono tracking-tight">{hotOffers.length}</div>
            <div className="text-xs sm:text-sm text-[#a69f99] mt-1.5">Sunum & Teklif aşamasında</div>
          </GlassCard>

          <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between text-[#d6beae] text-sm font-medium">
              <span>Rezerve Daireler</span>
              <Building2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-3xl font-bold text-white mt-2 font-mono tracking-tight">{reservedUnits.length}</div>
            <div className="text-xs sm:text-sm text-[#a69f99] mt-1.5">Opsiyonlu ünite</div>
          </GlassCard>
        </div>

        {/* Randevular & Müşteri Listesi */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlassCard className="p-5 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">Bugünkü ve Yaklaşan Randevular</h3>
              <span className="text-sm font-semibold text-[#b99881]">{appointments.length} Randevu</span>
            </div>
            {appointments.length === 0 ? (
              <div className="text-center py-8 text-sm text-[#a69f99]">
                Planlanmış aktif randevunuz bulunmuyor.
              </div>
            ) : (
              <div className="space-y-2.5">
                {appointments.slice(0, 4).map((a) => (
                  <div key={a.id} className="p-3 rounded-[16px] bg-[#34302d] border border-[#4a443f] flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-white">{a.customerName}</div>
                      <div className="text-xs sm:text-sm text-[#a69f99] mt-0.5">{a.location} • {a.date} {a.time}</div>
                    </div>
                    <GlassBadge size="sm" variant={a.type === 'ON_SITE' ? 'success' : 'info'}>
                      {a.type === 'ON_SITE' ? 'Ofis / Şantiye' : 'Online'}
                    </GlassBadge>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          <GlassCard className="p-5 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">İletişim Bekleyen Sıcak Adaylar</h3>
              <span className="text-sm font-medium text-[#8c857f]">{myLeads.length} Aday</span>
            </div>
            {myLeads.length === 0 ? (
              <div className="text-center py-8 text-sm text-[#a69f99]">
                Size atanmış yeni müşteri adayı bulunmuyor.
              </div>
            ) : (
              <div className="space-y-2.5">
                {myLeads.slice(0, 4).map((l) => (
                  <div
                    key={l.id}
                    onClick={() => onSelectLead(l)}
                    className="p-3 rounded-[16px] bg-[#34302d] hover:bg-[#3d3733] border border-[#4a443f] cursor-pointer transition-colors flex items-center justify-between"
                  >
                    <div>
                      <div className="text-sm font-bold text-white">{l.fullName}</div>
                      <div className="text-xs sm:text-sm text-[#a69f99] mt-0.5">{l.phone}</div>
                    </div>
                    <GlassBadge size="sm" variant={l.stage === 'WON' ? 'success' : 'primary'}>
                      {STAGE_CONFIGS[l.stage]?.label || l.stage}
                    </GlassBadge>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    )
  }

  // 3. MÜŞTERİ İLİŞKİLERİ BAŞLANGIÇ
  const renderCustomerRelationsDashboard = () => {
    const uncontactedLeads = leads.filter((l) => l.stage === 'NEW')
    const qualifiedLeads = leads.filter((l) => l.stage === 'QUALIFIED')
    const openRequests = requests.filter((r) => r.status === 'Açık' || r.status === 'İşlemde')

    return (
      <div className="space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between text-[#d6beae] text-sm font-medium">
              <span>İletişim Bekleyen Başvurular</span>
              <PhoneCall className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-3xl font-bold text-white mt-2 font-mono tracking-tight">{uncontactedLeads.length}</div>
            <div className="text-xs sm:text-sm text-[#a69f99] mt-1.5">İlk arama bekleyen</div>
          </GlassCard>

          <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between text-[#d6beae] text-sm font-medium">
              <span>Nitelikli Belirlenenler</span>
              <CheckCircle2 className="w-5 h-5 text-teal-400" />
            </div>
            <div className="text-3xl font-bold text-white mt-2 font-mono tracking-tight">{qualifiedLeads.length}</div>
            <div className="text-xs sm:text-sm text-[#a69f99] mt-1.5">Satışa devredilmeye hazır</div>
          </GlassCard>

          <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between text-[#d6beae] text-sm font-medium">
              <span>Açık Talepler</span>
              <AlertCircle className="w-5 h-5 text-rose-400" />
            </div>
            <div className="text-3xl font-bold text-white mt-2 font-mono tracking-tight">{openRequests.length}</div>
            <div className="text-xs sm:text-sm text-[#a69f99] mt-1.5">Müşteri destek & bilgi talebi</div>
          </GlassCard>

          <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between text-[#d6beae] text-sm font-medium">
              <span>Organize Edilen Randevular</span>
              <CalendarCheck className="w-5 h-5 text-[#b99881]" />
            </div>
            <div className="text-3xl font-bold text-white mt-2 font-mono tracking-tight">{appointments.length}</div>
            <div className="text-xs sm:text-sm text-[#a69f99] mt-1.5">Satış ekibine yönlendirilen</div>
          </GlassCard>
        </div>

        {/* İletişim Bekleyen Adaylar & Talepler */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlassCard className="p-5 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">İlk Arama Bekleyen Başvurular</h3>
              <span className="text-sm font-semibold text-amber-400">{uncontactedLeads.length} Aday</span>
            </div>
            {uncontactedLeads.length === 0 ? (
              <div className="text-center py-8 text-sm text-[#a69f99]">
                Tüm başvurularla iletişime geçildi.
              </div>
            ) : (
              <div className="space-y-2.5">
                {uncontactedLeads.slice(0, 4).map((l) => (
                  <div
                    key={l.id}
                    onClick={() => onSelectLead(l)}
                    className="p-3 rounded-[16px] bg-[#34302d] hover:bg-[#3d3733] border border-[#4a443f] cursor-pointer transition-colors flex items-center justify-between"
                  >
                    <div>
                      <div className="text-sm font-bold text-white">{l.fullName}</div>
                      <div className="text-xs sm:text-sm text-[#a69f99] mt-0.5">{l.phone} • {l.formName}</div>
                    </div>
                    <GlassBadge size="sm" variant="warning">
                      Giriş (Yeni)
                    </GlassBadge>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          <GlassCard className="p-5 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">Müşteri Destek & Bilgi Talepleri</h3>
              <span className="text-sm font-medium text-[#8c857f]">{requests.length} Talep</span>
            </div>
            {requests.length === 0 ? (
              <div className="text-center py-8 text-sm text-[#a69f99]">
                Açık müşteri talebi bulunmuyor.
              </div>
            ) : (
              <div className="space-y-2.5">
                {requests.slice(0, 4).map((r) => (
                  <div key={r.id} className="p-3 rounded-[16px] bg-[#34302d] border border-[#4a443f] flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-white">{r.subject}</div>
                      <div className="text-xs sm:text-sm text-[#a69f99] mt-0.5">{r.customerName} • {r.category}</div>
                    </div>
                    <GlassBadge size="sm" variant={r.priority === 'Yüksek' ? 'danger' : 'default'}>
                      {r.status}
                    </GlassBadge>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    )
  }

  // 4. MUHASEBE BAŞLANGIÇ
  const renderAccountingDashboard = () => {
    const collectedTotal = collections
      .filter((c) => c.status === 'COLLECTED')
      .reduce((acc, c) => acc + c.amount, 0)
    const pendingCollections = collections.filter((c) => c.status === 'PENDING')
    const pendingTotal = pendingCollections.reduce((acc, c) => acc + c.amount, 0)
    const overdueCollections = collections.filter((c) => c.status === 'OVERDUE')
    const pendingPayments = payments.filter((p) => p.status === 'PENDING')
    const pendingPaymentsTotal = pendingPayments.reduce((acc, p) => acc + p.amount, 0)

    return (
      <div className="space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between text-[#d6beae] text-sm font-medium">
              <span>Tahsil Edilen Tutar</span>
              <DollarSign className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-3xl font-bold text-white mt-2 font-mono tracking-tight">{formatCurrency(collectedTotal)}</div>
            <div className="text-xs sm:text-sm text-emerald-400 font-medium mt-1.5">Kasaya giren nakit</div>
          </GlassCard>

          <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between text-[#d6beae] text-sm font-medium">
              <span>Bekleyen Tahsilatlar</span>
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-3xl font-bold text-white mt-2 font-mono tracking-tight">{formatCurrency(pendingTotal)}</div>
            <div className="text-xs sm:text-sm text-[#a69f99] mt-1.5">{pendingCollections.length} adet vadesi gelen</div>
          </GlassCard>

          <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between text-[#d6beae] text-sm font-medium">
              <span>Geciken Tahsilat</span>
              <AlertCircle className="w-5 h-5 text-rose-400" />
            </div>
            <div className="text-3xl font-bold text-rose-400 mt-2 font-mono tracking-tight">{overdueCollections.length} Adet</div>
            <div className="text-xs sm:text-sm text-[#a69f99] mt-1.5">Takip gerektiren</div>
          </GlassCard>

          <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between text-[#d6beae] text-sm font-medium">
              <span>Planlanan Ödemeler</span>
              <Briefcase className="w-5 h-5 text-sky-400" />
            </div>
            <div className="text-3xl font-bold text-white mt-2 font-mono tracking-tight">{formatCurrency(pendingPaymentsTotal)}</div>
            <div className="text-xs sm:text-sm text-[#a69f99] mt-1.5">Komisyon & Şantiye</div>
          </GlassCard>
        </div>

        {/* Tahsilatlar & Ödemeler Tablosu */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlassCard className="p-5 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">Bekleyen & Vadesi Gelen Tahsilatlar</h3>
              <span className="text-sm font-semibold text-[#b99881]">{collections.length} İşlem</span>
            </div>
            <div className="space-y-2.5">
              {collections.slice(0, 4).map((c) => (
                <div key={c.id} className="p-3 rounded-[16px] bg-[#34302d] border border-[#4a443f] flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-white">{c.customerName} ({c.unitNumber})</div>
                    <div className="text-xs sm:text-sm text-[#a69f99] mt-0.5">{c.projectName} • Vade: {c.dueDate}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-white">{formatCurrency(c.amount)}</div>
                    <GlassBadge size="sm" variant={c.status === 'COLLECTED' ? 'success' : c.status === 'OVERDUE' ? 'danger' : 'warning'}>
                      {c.status === 'COLLECTED' ? 'Tahsil Edildi' : c.status === 'OVERDUE' ? 'Gecikmede' : 'Bekliyor'}
                    </GlassBadge>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="p-5 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">Planlanan Şantiye & Komisyon Ödemeleri</h3>
              <span className="text-sm font-medium text-[#8c857f]">{payments.length} Ödeme</span>
            </div>
            <div className="space-y-2.5">
              {payments.slice(0, 4).map((p) => (
                <div key={p.id} className="p-3 rounded-[16px] bg-[#34302d] border border-[#4a443f] flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-white">{p.title}</div>
                    <div className="text-xs sm:text-sm text-[#a69f99] mt-0.5">{p.payee} • {p.dueDate}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-white">{formatCurrency(p.amount)}</div>
                    <GlassBadge size="sm" variant={p.status === 'PAID' ? 'success' : 'default'}>
                      {p.status === 'PAID' ? 'Ödendi' : 'Bekliyor'}
                    </GlassBadge>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    )
  }

  // 5. YÖNETİM BAŞLANGIÇ
  const renderExecutiveDashboard = () => {
    const pendingApprovals = approvals.filter((a) => a.status === 'BEKLEMEDE')
    const allUnits = projects.flatMap((p) => p.units || [])
    const soldUnits = allUnits.filter((u) => u.status === 'SATILDI')
    const totalSalesVolume = soldUnits.reduce((acc, u) => acc + (u.sale?.salePrice || u.price), 0)

    return (
      <div className="space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between text-[#d6beae] text-sm font-medium">
              <span>Toplam Satış Hacmi</span>
              <DollarSign className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-3xl font-bold text-white mt-2 font-mono tracking-tight">{formatCurrency(totalSalesVolume)}</div>
            <div className="text-xs sm:text-sm text-[#a69f99] mt-1.5">{soldUnits.length} daire sözleşmesi</div>
          </GlassCard>

          <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between text-[#d6beae] text-sm font-medium">
              <span>Bekleyen Yönetici Onayları</span>
              <FileCheck2 className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-3xl font-bold text-white mt-2 font-mono tracking-tight">{pendingApprovals.length}</div>
            <div className="text-xs sm:text-sm text-amber-400 font-medium mt-1.5">İskonto & Rezervasyon onayı</div>
          </GlassCard>

          <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between text-[#d6beae] text-sm font-medium">
              <span>Aktif Proje Envanteri</span>
              <Building2 className="w-5 h-5 text-sky-400" />
            </div>
            <div className="text-3xl font-bold text-white mt-2 font-mono tracking-tight">{projects.length} Proje</div>
            <div className="text-xs sm:text-sm text-[#a69f99] mt-1.5">{allUnits.length} toplam bağımsız bölüm</div>
          </GlassCard>

          <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between text-[#d6beae] text-sm font-medium">
              <span>Sistem & Yetki Durumu</span>
              <ShieldCheck className="w-5 h-5 text-teal-400" />
            </div>
            <div className="text-sm font-semibold text-white mt-2">5 Departman Aktif</div>
            <div className="text-xs sm:text-sm text-[#a69f99] mt-1.5">Kurumsal yetki modeli devrede</div>
          </GlassCard>
        </div>

        {/* Onay Bekleyen Talepler & Uçtan Uca Huni */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlassCard className="p-5 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">Yönetici Onayı Bekleyen Talepler</h3>
              <span className="text-sm font-semibold text-amber-400">{pendingApprovals.length} Bekleyen</span>
            </div>
            {pendingApprovals.length === 0 ? (
              <div className="text-center py-8 text-sm text-[#a69f99]">
                Onay bekleyen talep bulunmuyor.
              </div>
            ) : (
              <div className="space-y-2.5">
                {pendingApprovals.slice(0, 4).map((app) => (
                  <div key={app.id} className="p-3 rounded-[16px] bg-[#34302d] border border-[#4a443f] flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-white">{app.title}</div>
                      <div className="text-xs sm:text-sm text-[#a69f99] mt-0.5">{app.customerName} • {app.requestedByUserName} ({app.requestedDepartment})</div>
                    </div>
                    <GlassBadge size="sm" variant="warning">
                      {app.type}
                    </GlassBadge>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          <GlassCard className="p-5 bg-[#282522] border-[#4a443f]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">Uçtan Uca Departman Akış Özeti</h3>
              <span className="text-sm font-medium text-[#8c857f]">Canlı Huni</span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2.5 rounded-[12px] bg-[#34302d] border border-[#4a443f]/60">
                <span className="text-sm font-medium text-[#d6beae]">1. Pazarlama (Toplam Lead)</span>
                <span className="text-sm font-bold font-mono text-white">{leads.length}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-[12px] bg-[#34302d] border border-[#4a443f]/60">
                <span className="text-sm font-medium text-[#d6beae]">2. Müşteri İlişkileri (Nitelikli Aday)</span>
                <span className="text-sm font-bold font-mono text-white">{leads.filter((l) => l.stage === 'QUALIFIED' || l.stage === 'WON').length}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-[12px] bg-[#34302d] border border-[#4a443f]/60">
                <span className="text-sm font-medium text-[#d6beae]">3. Satış (Teklif & Rezervasyon)</span>
                <span className="text-sm font-bold font-mono text-white">{leads.filter((l) => ['APPOINTMENT', 'PRESENTATION', 'OFFER'].includes(l.stage)).length}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-[12px] bg-[#34302d] border border-[#4a443f]/60">
                <span className="text-sm font-medium text-[#d6beae]">4. Muhasebe (Tamamlanan Satış)</span>
                <span className="text-sm font-bold font-mono text-emerald-400">{soldUnits.length} Daire</span>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      {renderHeader()}

      {department === 'Pazarlama' && renderMarketingDashboard()}
      {department === 'Satış' && renderSalesDashboard()}
      {department === 'Müşteri İlişkileri' && renderCustomerRelationsDashboard()}
      {department === 'Muhasebe' && renderAccountingDashboard()}
      {department === 'Yönetim' && renderExecutiveDashboard()}
    </div>
  )
}
