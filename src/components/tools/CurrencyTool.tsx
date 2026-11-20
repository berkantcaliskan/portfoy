import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { CustomSelect } from '@/components/ui/CustomSelect'

// Gösterilen 20 döviz (TRY taban para birimidir)
export const CURRENCIES: { code: string; name: string }[] = [
  { code: 'USD', name: 'Amerikan Doları' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'İngiliz Sterlini' },
  { code: 'CHF', name: 'İsviçre Frangı' },
  { code: 'JPY', name: 'Japon Yeni' },
  { code: 'CNY', name: 'Çin Yuanı' },
  { code: 'RUB', name: 'Rus Rublesi' },
  { code: 'AZN', name: 'Azerbaycan Manatı' },
  { code: 'SAR', name: 'Suudi Arabistan Riyali' },
  { code: 'AED', name: 'BAE Dirhemi' },
  { code: 'QAR', name: 'Katar Riyali' },
  { code: 'KWD', name: 'Kuveyt Dinarı' },
  { code: 'CAD', name: 'Kanada Doları' },
  { code: 'AUD', name: 'Avustralya Doları' },
  { code: 'SEK', name: 'İsveç Kronu' },
  { code: 'NOK', name: 'Norveç Kronu' },
  { code: 'DKK', name: 'Danimarka Kronu' },
  { code: 'KZT', name: 'Kazakistan Tengesi' },
  { code: 'GEL', name: 'Gürcistan Larisi' },
  { code: 'UAH', name: 'Ukrayna Grivnası' },
]

interface RateData { tryPer: Record<string, number>; updatedAt: number; nextUpdateAt: number }
const CACHE_KEY = 'portfoy_fx_rates_v1'

function readCache(): RateData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as RateData
    return data && data.tryPer && typeof data.updatedAt === 'number' ? data : null
  } catch { return null }
}

async function fetchRates(): Promise<RateData> {
  const res = await fetch('https://open.er-api.com/v6/latest/TRY', { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw Error('Kur servisi yanıt vermedi.')
  const body = await res.json() as {
    result: string; rates: Record<string, number>; time_last_update_unix: number; time_next_update_unix: number
  }
  if (body.result !== 'success') throw Error('Kur verisi alınamadı.')
  const tryPer: Record<string, number> = { TRY: 1 }
  for (const { code } of CURRENCIES) {
    const perTry = body.rates[code]
    if (perTry > 0) tryPer[code] = 1 / perTry
  }
  const data = { tryPer, updatedAt: body.time_last_update_unix * 1000, nextUpdateAt: body.time_next_update_unix * 1000 }
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)) } catch { /* depolama yoksa önbelleksiz devam */ }
  return data
}

const formatRate = (value: number) =>
  value.toLocaleString('tr-TR', { minimumFractionDigits: value < 1 ? 4 : 2, maximumFractionDigits: value < 1 ? 4 : 2 })
const formatAmount = (value: number) =>
  value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function CurrencyTool({ amount, onAmountChange, base, onBaseChange }: {
  amount: number; onAmountChange: (v: number) => void; base: string; onBaseChange: (v: string) => void
}) {
  const [rates, setRates] = useState<RateData | null>(readCache)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (force = false) => {
    const cached = readCache()
    // Kaynak günde bir güncellenir; sonraki güncelleme zamanı gelmeden tekrar indirme yapılmaz
    if (!force && cached && Date.now() < cached.nextUpdateAt) { setRates(cached); return }
    setLoading(true); setError('')
    try { setRates(await fetchRates()) }
    catch { setError(cached ? 'Kurlar yenilenemedi, son alınan kurlar gösteriliyor.' : 'Kurlar alınamadı. İnternet bağlantısını kontrol edip yenileyin.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 60 * 60 * 1000)
    return () => window.clearInterval(timer)
  }, [load])

  const baseCode = base === 'TRY' || CURRENCIES.some(c => c.code === base) ? base : 'USD'
  const amountInTry = rates?.tryPer[baseCode] ? amount * rates.tryPer[baseCode] : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="text-sm font-medium text-[#d6beae] block mb-1.5">Dönüştürülecek Tutar</label>
          <input
            type="number"
            value={amount}
            onChange={e => onAmountChange(parseFloat(e.target.value) || 0)}
            className="w-full bg-[#282522] border border-[#4a443f] rounded-xl px-3.5 py-2 text-base font-bold text-white focus:outline-none focus:border-[#b99881]"
          />
        </div>
        <div className="w-60">
          <label className="text-sm font-medium text-[#d6beae] block mb-1.5">Para Birimi</label>
          <CustomSelect
            value={baseCode}
            onChange={e => onBaseChange(e.target.value)}
            className="w-full bg-[#282522] border border-[#4a443f] rounded-xl px-3.5 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-[#b99881]"
          >
            <option value="TRY">TRY · Türk Lirası</option>
            {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
          </CustomSelect>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#282522] border border-[#4a443f] text-xs font-semibold text-[#d6beae] hover:text-white disabled:opacity-50"
          title="Kurları yenile"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />Yenile
        </button>
      </div>

      {error && <p role="alert" className="text-xs text-amber-300">{error}</p>}

      {baseCode !== 'TRY' && amountInTry !== null && (
        <div className="p-3.5 rounded-2xl bg-[#282522] border border-[#b99881]/50">
          <span className="text-sm font-medium text-[#d6beae] block">Türk Lirası (TRY)</span>
          <p className="text-2xl font-bold text-[#b99881] mt-1">{formatAmount(amountInTry)} ₺</p>
        </div>
      )}

      {rates ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {CURRENCIES.filter(c => c.code !== baseCode && rates.tryPer[c.code]).map(c => {
            const rate = rates.tryPer[c.code]
            return (
              <div key={c.code} className="p-3 rounded-2xl bg-[#282522] border border-[#4a443f]">
                <span className="text-xs font-medium text-[#d6beae] block truncate" title={c.name}>{c.name}</span>
                <p className="text-lg font-bold text-white mt-0.5">
                  {amountInTry !== null ? formatAmount(amountInTry / rate) : '—'} <span className="text-xs text-[#a69f99]">{c.code}</span>
                </p>
                <span className="text-[11px] text-[#8c857f]">1 {c.code} = {formatRate(rate)} ₺</span>
              </div>
            )
          })}
        </div>
      ) : (
        !error && <p className="py-6 text-center text-sm text-[#a69f99]">Kurlar yükleniyor…</p>
      )}

      {rates && (
        <p className="text-[11px] text-[#8c857f]">
          Kurlar: ExchangeRate-API (günlük) · Son güncelleme{' '}
          {new Date(rates.updatedAt).toLocaleString('tr-TR', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}
          {' '}· Bilgi amaçlıdır; banka alış/satış kurlarından farklı olabilir.
        </p>
      )}
    </div>
  )
}
