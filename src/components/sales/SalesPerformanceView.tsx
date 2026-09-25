import React from 'react'
import {
  Trophy,
  TrendingUp,
  Target,
  DollarSign,
  Award,
  Users,
  CheckCircle2,
  Clock,
  ArrowUpRight,
} from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlassBadge } from '@/components/ui/GlassBadge'
import { Lead } from '@/types/lead'
import { formatCurrency } from '@/utils/formatters'
import { userStore, AppUser } from '@/services/userStore'
import { projectStore } from '@/services/projectStore'

interface SalesPerformanceViewProps {
  leads: Lead[]
}

export const SalesPerformanceView: React.FC<SalesPerformanceViewProps> = ({ leads }) => {
  const allUsers = userStore.getAllUsers()
  const salesUsers = allUsers.filter(
    (u) => u.department === 'Satış' || u.department === 'Yönetim' || u.isManager
  )
  const allUnits = projectStore.getAll().flatMap((p) => p.units || [])
  const soldUnits = allUnits.filter((u) => u.status === 'SATILDI')
  const totalVolume = soldUnits.reduce((acc, u) => acc + (u.sale?.salePrice || u.price), 0)

  const quota = 40000000 // 40M TL Monthly Quota
  const achievementRate = quota > 0 ? Math.min(100, Math.round((totalVolume / quota) * 100)) : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Trophy className="w-5 h-5 text-[#b99881]" />
            <h2 className="text-xl font-bold tracking-tight text-white">
              Satış Performansı
            </h2>
          </div>
          <p className="text-xs text-[#a69f99] mt-1">
            Ekip kotaları, gerçekleşen satış hacmi, komisyon hakedişleri ve danışman skor tablosu.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
          <div className="text-xs text-[#a69f99]">Aylık Gerçekleşen Ciro</div>
          <div className="text-xl font-bold text-white mt-1">{formatCurrency(totalVolume)}</div>
          <div className="text-[11px] text-[#8c857f] mt-1">{soldUnits.length} daire sözleşmesi</div>
        </GlassCard>

        <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
          <div className="text-xs text-[#a69f99]">Hedef Kota Gerçekleşmesi</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">%{achievementRate}</div>
          <div className="text-[11px] text-[#8c857f] mt-1">Hedef: {formatCurrency(quota)}</div>
        </GlassCard>

        <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
          <div className="text-xs text-[#a69f99]">Tahakkuk Eden Komisyon</div>
          <div className="text-xl font-bold text-[#b99881] mt-1">
            {formatCurrency(Math.round(totalVolume * 0.02))}
          </div>
          <div className="text-[11px] text-[#8c857f] mt-1">%2 Standart danışman primi</div>
        </GlassCard>

        <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
          <div className="text-xs text-[#a69f99]">Aktif Danışman Sayısı</div>
          <div className="text-2xl font-bold text-sky-400 mt-1">{salesUsers.length}</div>
          <div className="text-[11px] text-[#8c857f] mt-1">Satış kadrosu</div>
        </GlassCard>
      </div>

      {/* Danışman Skor Tablosu */}
      <GlassCard className="p-5 bg-[#282522] border-[#4a443f]">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Award className="w-4 h-4 text-[#b99881]" />
          <span>Danışman Satış Sıralaması (Leaderboard)</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-[#4a443f] text-[#8c857f] text-[11px]">
                <th className="py-2.5 px-3">Danışman</th>
                <th className="py-2.5 px-3">Rol</th>
                <th className="py-2.5 px-3">Satılan Ünite</th>
                <th className="py-2.5 px-3">Toplam Hacim</th>
                <th className="py-2.5 px-3">Hakedilen Prim</th>
                <th className="py-2.5 px-3">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#4a443f]/60 text-[#f3efe9]">
              {salesUsers.map((user, idx) => {
                const userSold = soldUnits.filter((u) => u.sale?.soldByUserId === user.id || u.sale?.soldByUserName === user.fullName)
                const volume = userSold.reduce((acc, u) => acc + (u.sale?.salePrice || u.price), 0)
                const comm = Math.round(volume * 0.02)

                return (
                  <tr key={user.id} className="hover:bg-[#34302d] transition-colors">
                    <td className="py-3 px-3 font-semibold text-white flex items-center gap-2">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        idx === 0 ? 'bg-[#b99881] text-[#282522]' : 'bg-[#34302d] text-[#8c857f]'
                      }`}>
                        {idx + 1}
                      </span>
                      <span>{user.fullName}</span>
                    </td>
                    <td className="py-3 px-3 text-[#a69f99]">{user.role}</td>
                    <td className="py-3 px-3 font-bold text-white">{userSold.length} Daire</td>
                    <td className="py-3 px-3 font-bold text-white">{formatCurrency(volume)}</td>
                    <td className="py-3 px-3 text-emerald-400 font-semibold">{formatCurrency(comm)}</td>
                    <td className="py-3 px-3">
                      <GlassBadge size="sm" variant={userSold.length > 0 ? 'success' : 'default'}>
                        {userSold.length > 0 ? 'Kotada' : 'Geliştirilmeli'}
                      </GlassBadge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  )
}
