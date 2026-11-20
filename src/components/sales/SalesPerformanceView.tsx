import { useState } from 'react'
import { Trophy } from 'lucide-react'
import { useStoreUpdates } from '@/components/common/useStoreUpdates'
import { DateRangePicker, type DateRange } from '@/components/ui/DateRangePicker'
import { GlassCard } from '@/components/ui/GlassCard'
import { projectStore } from '@/services/projectStore'
import { userStore } from '@/services/userStore'
import { buildSalesRanking } from '@/utils/salesPerformance'
import type { Lead } from '@/types/lead'

export function SalesPerformanceView(_props: { leads: Lead[] }) {
  useStoreUpdates(userStore)
  useStoreUpdates(projectStore)
  const [range, setRange] = useState<DateRange>({ startDate: null, endDate: null, presetKey: 'ALL', presetLabel: 'Tümü' })
  const start = range.startDate ? new Date(range.startDate).setHours(0, 0, 0, 0) : -Infinity
  const end = range.endDate ? new Date(range.endDate).setHours(23, 59, 59, 999) : Infinity
  const sold = projectStore.getAll().flatMap(project => project.units || []).filter(unit => {
    if (unit.status !== 'SATILDI') return false
    if (!range.startDate && !range.endDate) return true
    const date = Date.parse(unit.sale?.soldAt || '')
    return date >= start && date <= end
  })
  const ranking = buildSalesRanking(sold, userStore.getAllUsers())
  return <section className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-2.5 text-2xl font-bold"><Trophy size={21} className="text-[var(--accent-color)]" />Satış Performansı</h2>
        <p className="mt-1 text-xs text-[#a69f99]">Gerçekleşen satış adedine göre danışmanların toplam satıştaki payı.</p>
      </div>
      <DateRangePicker value={range} onChange={setRange} align="right" />
    </div>
    <div className="flex items-baseline gap-2"><strong className="text-3xl font-semibold tabular-nums">{sold.length}</strong><span className="text-sm text-[#a69f99]">tamamlanmış satış</span></div>
    {sold.length === 0 ? <div className="py-20 text-center text-sm text-[#a69f99]">Bu dönem için tamamlanmış satış bulunamadı.</div> :
      <GlassCard className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead><tr className="border-b border-[#4a443f]/50 text-xs text-[#a69f99]"><th className="px-5 py-4">Danışman</th><th className="px-5 py-4">Satış adedi</th><th className="w-2/5 px-5 py-4">Satış payı</th></tr></thead>
            <tbody>{ranking.map((row, index) => <tr key={row.id} className="border-b border-[#4a443f]/30 last:border-0" data-sales-rank={row.id}>
              <td className="px-5 py-5 font-medium"><span className="mr-3 text-xs text-[#a69f99]">{index + 1}</span>{row.name}</td>
              <td className="px-5 py-5 tabular-nums">{row.count}</td>
              <td className="px-5 py-5">
                <div className="mb-2 font-semibold text-[var(--accent-color)] tabular-nums">%{row.percentage.toLocaleString('tr', { maximumFractionDigits: 1 })}</div>
                <div role="progressbar" aria-label={row.name + ' satış payı'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={row.percentage}
                  className="h-1.5 overflow-hidden rounded-full bg-[#8c857f]/15"><div className="h-full rounded-full bg-[var(--accent-color)]" style={{ width: row.percentage + '%' }} /></div>
              </td>
            </tr>)}</tbody>
          </table>
        </div>
      </GlassCard>}
  </section>
}
