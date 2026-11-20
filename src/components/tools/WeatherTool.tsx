import { useCallback, useEffect, useState } from 'react'
import {
  Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudSnow, CloudSun,
  Droplets, Moon, Plus, RefreshCw, Sun, Umbrella, Wind, X, type LucideIcon,
} from 'lucide-react'
import { CustomSelect } from '@/components/ui/CustomSelect'

// İl merkezleri (yaklaşık). Hava durumu için il merkezi koordinatı yeterlidir.
export const PROVINCES: Record<string, [number, number]> = {
  Adana: [37.0, 35.32], Adıyaman: [37.76, 38.28], Afyonkarahisar: [38.76, 30.54], Ağrı: [39.72, 43.05],
  Aksaray: [38.37, 34.03], Amasya: [40.65, 35.83], Ankara: [39.93, 32.86], Antalya: [36.9, 30.71],
  Ardahan: [41.11, 42.7], Artvin: [41.18, 41.82], Aydın: [37.84, 27.85], Balıkesir: [39.65, 27.88],
  Bartın: [41.64, 32.34], Batman: [37.89, 41.13], Bayburt: [40.26, 40.23], Bilecik: [40.14, 29.98],
  Bingöl: [38.88, 40.5], Bitlis: [38.4, 42.11], Bolu: [40.74, 31.61], Burdur: [37.72, 30.29],
  Bursa: [40.19, 29.06], Çanakkale: [40.15, 26.41], Çankırı: [40.6, 33.62], Çorum: [40.55, 34.95],
  Denizli: [37.78, 29.09], Diyarbakır: [37.91, 40.24], Düzce: [40.84, 31.16], Edirne: [41.68, 26.56],
  Elazığ: [38.67, 39.22], Erzincan: [39.75, 39.49], Erzurum: [39.9, 41.27], Eskişehir: [39.78, 30.52],
  Gaziantep: [37.07, 37.38], Giresun: [40.91, 38.39], Gümüşhane: [40.46, 39.48], Hakkari: [37.57, 43.74],
  Hatay: [36.2, 36.16], Iğdır: [39.92, 44.04], Isparta: [37.76, 30.55], İstanbul: [41.01, 28.98],
  İzmir: [38.42, 27.14], Kahramanmaraş: [37.58, 36.94], Karabük: [41.2, 32.63], Karaman: [37.18, 33.22],
  Kars: [40.6, 43.1], Kastamonu: [41.38, 33.78], Kayseri: [38.73, 35.48], Kilis: [36.72, 37.12],
  Kırıkkale: [39.85, 33.51], Kırklareli: [41.73, 27.22], Kırşehir: [39.15, 34.16], Kocaeli: [40.77, 29.92],
  Konya: [37.87, 32.48], Kütahya: [39.42, 29.98], Malatya: [38.35, 38.31], Manisa: [38.61, 27.43],
  Mardin: [37.31, 40.74], Mersin: [36.81, 34.64], Muğla: [37.22, 28.36], Muş: [38.75, 41.51],
  Nevşehir: [38.62, 34.71], Niğde: [37.97, 34.68], Ordu: [40.98, 37.88], Osmaniye: [37.07, 36.25],
  Rize: [41.03, 40.52], Sakarya: [40.78, 30.4], Samsun: [41.29, 36.33], Siirt: [37.93, 41.94],
  Sinop: [42.03, 35.15], Sivas: [39.75, 37.02], Şanlıurfa: [37.16, 38.79], Şırnak: [37.52, 42.46],
  Tekirdağ: [40.98, 27.51], Tokat: [40.31, 36.55], Trabzon: [41.0, 39.72], Tunceli: [39.11, 39.55],
  Uşak: [38.68, 29.41], Van: [38.5, 43.38], Yalova: [40.66, 29.27], Yozgat: [39.82, 34.81],
  Zonguldak: [41.45, 31.79],
}
export const DEFAULT_WEATHER_CITIES = ['Sakarya', 'Kocaeli', 'İstanbul']
const REFRESH_MS = 15 * 60 * 1000

interface CityWeather {
  temp: number; min: number; max: number; wind: number; humidity: number
  rain: number; symbol: string; updatedAt: string; fetchedAt: number
}
const cache = new Map<string, CityWeather>()

type Step = { time: string; data: {
  instant: { details: { air_temperature: number; wind_speed: number; relative_humidity: number } }
  next_1_hours?: { summary: { symbol_code: string }; details?: { precipitation_amount?: number } }
  next_6_hours?: { summary: { symbol_code: string } }
} }

async function fetchCity(name: string): Promise<CityWeather> {
  const hit = cache.get(name)
  if (hit && Date.now() - hit.fetchedAt < REFRESH_MS) return hit
  const [lat, lon] = PROVINCES[name]
  const res = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`,
    { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw Error('Hava durumu servisi yanıt vermedi.')
  const body = await res.json() as { properties: { meta: { updated_at: string }; timeseries: Step[] } }
  const series = body.properties.timeseries
  const now = Date.now()
  const current = series.find(s => new Date(s.time).getTime() + 3600_000 > now) ?? series[0]
  const day = series.filter(s => { const t = new Date(s.time).getTime(); return t >= now - 3600_000 && t <= now + 24 * 3600_000 })
  const temps = (day.length ? day : [current]).map(s => s.data.instant.details.air_temperature)
  const d = current.data
  const result: CityWeather = {
    temp: d.instant.details.air_temperature,
    min: Math.min(...temps), max: Math.max(...temps),
    wind: d.instant.details.wind_speed * 3.6,
    humidity: d.instant.details.relative_humidity,
    rain: d.next_1_hours?.details?.precipitation_amount ?? 0,
    symbol: d.next_1_hours?.summary.symbol_code ?? d.next_6_hours?.summary.symbol_code ?? 'cloudy',
    updatedAt: body.properties.meta.updated_at,
    fetchedAt: Date.now(),
  }
  cache.set(name, result)
  return result
}

function describe(symbol: string): { label: string; icon: LucideIcon; tone: string } {
  const night = symbol.endsWith('_night')
  const s = symbol.replace(/_(day|night|polartwilight)$/, '')
  if (s.includes('thunder')) return { label: 'Gök gürültülü', icon: CloudLightning, tone: 'text-violet-300' }
  if (s.includes('sleet')) return { label: 'Karla karışık yağmur', icon: CloudSnow, tone: 'text-sky-200' }
  if (s.includes('snow')) return { label: s.startsWith('heavy') ? 'Yoğun kar' : 'Kar', icon: CloudSnow, tone: 'text-sky-100' }
  if (s.includes('rain')) {
    if (s.startsWith('heavy')) return { label: 'Kuvvetli yağmur', icon: CloudRain, tone: 'text-sky-400' }
    if (s.startsWith('light')) return { label: 'Hafif yağmur', icon: CloudDrizzle, tone: 'text-sky-300' }
    return { label: s.includes('showers') ? 'Sağanak' : 'Yağmur', icon: CloudRain, tone: 'text-sky-400' }
  }
  if (s === 'fog') return { label: 'Sisli', icon: CloudFog, tone: 'text-[#c4bcb5]' }
  if (s === 'cloudy') return { label: 'Bulutlu', icon: Cloud, tone: 'text-[#c4bcb5]' }
  if (s === 'partlycloudy') return { label: 'Parçalı bulutlu', icon: night ? CloudMoon : CloudSun, tone: 'text-amber-300' }
  if (s === 'fair') return { label: 'Az bulutlu', icon: night ? CloudMoon : CloudSun, tone: 'text-amber-300' }
  return { label: 'Açık', icon: night ? Moon : Sun, tone: night ? 'text-indigo-200' : 'text-amber-400' }
}

const formatTemp = (t: number) => `${Math.round(t)}°`

export function WeatherTool({ cities, onChange }: { cities: string[]; onChange: (cities: string[]) => void }) {
  const list = cities.filter(c => c in PROVINCES)
  const [data, setData] = useState<Record<string, CityWeather>>(() =>
    Object.fromEntries(list.flatMap(c => cache.has(c) ? [[c, cache.get(c)!]] : [])))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState('')
  const key = list.join('|')

  const load = useCallback(async (force = false) => {
    const names = key ? key.split('|') : []
    if (force) names.forEach(n => cache.delete(n))
    setLoading(true)
    const results = await Promise.allSettled(names.map(fetchCity))
    const nextData: Record<string, CityWeather> = {}, nextErrors: Record<string, string> = {}
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') nextData[names[i]] = r.value
      else nextErrors[names[i]] = 'Veri alınamadı'
    })
    setData(prev => ({ ...prev, ...nextData }))
    setErrors(nextErrors)
    setLoading(false)
  }, [key])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [load])

  const available = Object.keys(PROVINCES).filter(c => !list.includes(c)).sort((a, b) => a.localeCompare(b, 'tr'))
  const lastUpdate = Object.values(data).map(d => d.fetchedAt).sort().at(-1)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[180px]">
          <CustomSelect
            value={adding}
            onChange={e => setAdding(e.target.value)}
            className="w-full bg-[#282522] border border-[#4a443f] rounded-full px-3.5 py-1.5 text-xs font-semibold text-white"
            title="Eklenecek şehir"
          >
            <option value="">Şehir seçin…</option>
            {available.map(c => <option key={c} value={c}>{c}</option>)}
          </CustomSelect>
        </div>
        <button
          type="button"
          disabled={!adding}
          onClick={() => { if (adding) { onChange([...list, adding]); setAdding('') } }}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#b99881] text-[#1c1a18] text-xs font-bold disabled:opacity-40"
        >
          <Plus className="w-3.5 h-3.5" />Şehir ekle
        </button>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={loading}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#282522] border border-[#4a443f] text-xs font-semibold text-[#d6beae] hover:text-white disabled:opacity-50"
          title="Hava durumunu yenile"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />Yenile
        </button>
      </div>

      {list.length === 0 ? (
        <p className="py-8 text-center text-sm text-[#a69f99]">Listede şehir yok. Yukarıdan şehir ekleyin.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {list.map(city => {
            const w = data[city]
            const info = w ? describe(w.symbol) : null
            const Icon = info?.icon ?? Cloud
            return (
              <div key={city} className="relative p-4 rounded-2xl bg-[#282522] border border-[#4a443f]">
                <button
                  type="button"
                  onClick={() => onChange(list.filter(c => c !== city))}
                  className="absolute top-2.5 right-2.5 p-1 rounded-full text-[#8c857f] hover:text-white hover:bg-white/10"
                  aria-label={`${city} şehrini kaldır`}
                  title="Listeden kaldır"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <span className="text-sm font-bold text-white">{city}</span>
                {w && info ? (
                  <>
                    <div className="mt-2 flex items-center gap-3">
                      <Icon className={`w-10 h-10 shrink-0 ${info.tone}`} />
                      <div>
                        <p className="text-3xl font-bold text-white leading-none">{formatTemp(w.temp)}</p>
                        <p className="text-xs text-[#d6beae] mt-1">{info.label}</p>
                      </div>
                      <div className="ml-auto text-right text-xs text-[#a69f99] leading-5">
                        <div>En yüksek <span className="text-white font-semibold">{formatTemp(w.max)}</span></div>
                        <div>En düşük <span className="text-white font-semibold">{formatTemp(w.min)}</span></div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#a69f99]">
                      <span className="flex items-center gap-1" title="Rüzgâr hızı"><Wind className="w-3.5 h-3.5" />{Math.round(w.wind)} km/s</span>
                      <span className="flex items-center gap-1" title="Nem"><Droplets className="w-3.5 h-3.5" />%{Math.round(w.humidity)}</span>
                      <span className="flex items-center gap-1" title="Önümüzdeki 1 saatte beklenen yağış"><Umbrella className="w-3.5 h-3.5" />{w.rain.toLocaleString('tr-TR')} mm</span>
                    </div>
                  </>
                ) : (
                  <p className="mt-3 text-xs text-[#a69f99]">{errors[city] ?? 'Yükleniyor…'}</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      <p className="text-[11px] text-[#8c857f]">
        Veri: MET Norway (api.met.no) · 15 dakikada bir yenilenir
        {lastUpdate ? ` · Son alınma ${new Date(lastUpdate).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}` : ''}
      </p>
    </div>
  )
}
