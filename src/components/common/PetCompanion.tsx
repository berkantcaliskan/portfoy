import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Droplets, PawPrint, Settings2, UtensilsCrossed, X } from 'lucide-react'
import { userStore } from '@/services/userStore'

/*
 * Sağ altta yaşayan kedi/köpek. Her saat acıkır ve susar; tokken oyun oynar,
 * açken sinirlenir, arada en az 5 dakika uyur. Tıklayınca uyanır, basılı tutup
 * sürükleyince sevilir. Durum tarayıcıda, hesaba özel saklanır.
 */

type PetKind = 'cat' | 'dog'
interface PetState {
  kind: PetKind | null
  hidden: boolean
  lastFed: number
  lastWatered: number
  sleepUntil: number
  nextSleepAt: number
}

const HOUR = 60 * 60 * 1000
const MIN = 60 * 1000
const randomBetween = (min: number, max: number) => min + Math.random() * (max - min)
const nextSleep = (now: number) => now + randomBetween(25 * MIN, 50 * MIN)
const sleepLength = () => randomBetween(5 * MIN, 9 * MIN)

const storageKey = () => `portfoy_pet_v1_${userStore.getCurrentUser()?.id || 'guest'}`

function loadState(): PetState {
  const now = Date.now()
  // Varsayılan kapalı: yalnızca küçük pati düğmesi görünür, açan kullanıcı hayvanını seçer
  const fallback: PetState = { kind: null, hidden: true, lastFed: now, lastWatered: now, sleepUntil: 0, nextSleepAt: nextSleep(now) }
  try {
    const raw = localStorage.getItem(storageKey())
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<PetState>
    return { ...fallback, ...parsed }
  } catch { return fallback }
}

function saveState(state: PetState) {
  try { localStorage.setItem(storageKey(), JSON.stringify(state)) } catch { /* depolama yoksa yalnızca bu oturumda yaşar */ }
}

type Mood = 'sleeping' | 'angry' | 'eating' | 'drinking' | 'petting' | 'playing'

const PET_KEYFRAMES = `
  @keyframes petBreath { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(1.04); } }
  @keyframes petShake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-2px); } 40% { transform: translateX(2px); } 60% { transform: translateX(-1.5px); } 80% { transform: translateX(1.5px); } }
  @keyframes petTail { 0%,100% { transform: rotate(-10deg); } 50% { transform: rotate(16deg); } }
  @keyframes petTailFast { 0%,100% { transform: rotate(-18deg); } 50% { transform: rotate(22deg); } }
  @keyframes petPaw { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(-28deg); } }
  @keyframes petToyRoll { 0%,100% { transform: translateX(0) rotate(0deg); } 50% { transform: translateX(14px) rotate(220deg); } }
  @keyframes petZzz { 0% { transform: translate(0,0) scale(.6); opacity: 0; } 20% { opacity: .9; } 100% { transform: translate(14px,-26px) scale(1.1); opacity: 0; } }
  @keyframes petHeart { 0% { transform: translate(0,0) scale(.5); opacity: 0; } 20% { opacity: 1; } 100% { transform: translate(var(--hx), -34px) scale(1.15); opacity: 0; } }
  @keyframes petEat { 0%,100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(3px) rotate(8deg); } }
  @keyframes petBubbleIn { 0% { transform: translateY(4px) scale(.9); opacity: 0; } 100% { transform: none; opacity: 1; } }
`

/* Yan profilden yatan/oturan hayvan; tek SVG, duruma göre yüz ve hareket değişir */
function PetFigure({ kind, mood }: { kind: PetKind; mood: Mood }) {
  const cat = kind === 'cat'
  const fur = cat ? '#e0a15c' : '#d9b98a'
  const furDark = cat ? '#b8743a' : '#a8875a'
  const belly = cat ? '#f4d2a8' : '#f1e2c8'
  const lying = mood === 'sleeping' || mood === 'playing'
  const headDown = mood === 'eating' || mood === 'drinking'
  const tailAnim = mood === 'petting' ? 'petTailFast .35s ease-in-out infinite'
    : mood === 'angry' ? 'petTailFast .2s ease-in-out infinite'
    : mood === 'sleeping' ? 'none' : 'petTail 1.6s ease-in-out infinite'

  // Gözler: uyurken kapalı, sevilirken mutlu, sinirliyken çatık
  const eyes = mood === 'sleeping'
    ? <path d="M52 30 q3 2 6 0" stroke="#3a2a1f" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    : mood === 'petting'
      ? <path d="M52 31 q3 -3 6 0" stroke="#3a2a1f" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      : mood === 'angry'
        ? <><circle cx="55" cy="31" r="1.7" fill="#3a2a1f" /><path d="M51 27 l7 2" stroke="#3a2a1f" strokeWidth="1.6" strokeLinecap="round" /></>
        : <><circle cx="55" cy="30.5" r="2" fill="#3a2a1f" /><circle cx="55.6" cy="29.9" r=".6" fill="#fff" /></>

  return (
    <svg width="96" height="64" viewBox="0 0 96 64" fill="none" overflow="visible"
      style={{ animation: mood === 'angry' ? 'petShake .45s ease-in-out infinite' : undefined }}>
      {/* Kuyruk */}
      <g style={{ transformOrigin: '20px 44px', animation: tailAnim }}>
        {cat
          ? <path d="M20 44 Q4 40 8 24 Q10 18 14 20" stroke={furDark} strokeWidth="5" strokeLinecap="round" fill="none" />
          : <path d="M20 42 Q8 34 10 24" stroke={fur} strokeWidth="5.5" strokeLinecap="round" fill="none" />}
      </g>
      {/* Gövde (yatarken uzun ve alçak, otururken dik) */}
      <g style={{ transformOrigin: '40px 58px', animation: mood === 'sleeping' ? 'petBreath 3.2s ease-in-out infinite' : undefined }}>
        {lying
          ? <ellipse cx="40" cy="50" rx="24" ry="11" fill={fur} />
          : <ellipse cx="38" cy="45" rx="19" ry="14" fill={fur} />}
        <ellipse cx={lying ? 42 : 40} cy={lying ? 55 : 51} rx={lying ? 15 : 11} ry="5" fill={belly} />
        {cat && <path d={lying ? 'M30 41 q3 4 0 8 M38 40 q3 4 0 8 M46 41 q3 4 0 8' : 'M30 34 q3 4 0 8 M37 33 q3 4 0 8'} stroke={furDark} strokeWidth="1.6" fill="none" />}
        {/* Bacaklar */}
        <rect x={lying ? 52 : 46} y={lying ? 55 : 52} width="12" height="6" rx="3" fill={fur} />
        <g style={{ transformOrigin: '60px 56px', animation: mood === 'playing' && cat ? 'petPaw .9s ease-in-out infinite' : undefined }}>
          <rect x={lying ? 60 : 50} y={lying ? 53 : 54} width="12" height="6" rx="3" fill={furDark} />
        </g>
        {!lying && <rect x="26" y="52" width="10" height="7" rx="3.5" fill={furDark} />}
      </g>
      {/* Kafa */}
      <g style={{ transformOrigin: '56px 40px', animation: headDown ? 'petEat .6s ease-in-out infinite' : undefined }}
        transform={headDown ? 'translate(4 10)' : lying ? 'translate(4 8)' : undefined}>
        {cat ? (
          <>
            <polygon points="46,20 49,10 54,19" fill={furDark} />
            <polygon points="58,19 63,10 66,20" fill={furDark} />
            <circle cx="56" cy="30" r="12" fill={fur} />
            <ellipse cx="62" cy="34" rx="4" ry="3" fill={belly} />
            <path d="M63 32.5 l-1.4 1.4 l-1.4 -1.4 z" fill="#d36b6b" />
            <path d="M66 35 l7 -1 M66 36.5 l7 1" stroke="#7a5a4a" strokeWidth=".7" />
          </>
        ) : (
          <>
            <circle cx="55" cy="29" r="12" fill={fur} />
            <ellipse cx="64" cy="33" rx="7" ry="5" fill={belly} />
            <circle cx="70" cy="31.5" r="2.2" fill="#3a2a1f" />
            <path d="M46 20 Q40 26 44 38 Q48 34 49 24 Z" fill={furDark} />
            {mood === 'petting' || mood === 'playing'
              ? <path d="M64 37 q2 6 5 1" fill="#e07a8a" />
              : null}
            <path d="M48 40 h14" stroke="#c0504d" strokeWidth="2.4" strokeLinecap="round" />
          </>
        )}
        {eyes}
        {mood === 'angry' && cat && <path d="M66 38 q-3 -2 -6 0" stroke="#3a2a1f" strokeWidth="1.2" fill="none" />}
      </g>
    </svg>
  )
}

export function PetCompanion() {
  const [pet, setPet] = useState<PetState>(loadState)
  const [now, setNow] = useState(() => Date.now())
  const [action, setAction] = useState<null | { type: 'eating' | 'drinking'; until: number }>(null)
  const [petting, setPetting] = useState(false)
  const [bubble, setBubble] = useState<string | null>(null)
  const [menu, setMenu] = useState(false)
  const pointer = useRef<{ x: number; y: number; moved: boolean } | null>(null)

  const update = useCallback((change: Partial<PetState>) => {
    setPet(previous => { const next = { ...previous, ...change }; saveState(next); return next })
  }, [])

  // Hesap değişince o hesabın hayvanını yükle
  useEffect(() => userStore.subscribe(() => setPet(loadState())), [])
  // Zamanı ilerlet (açlık/uyku durumu için)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    if (!action) return
    const timer = window.setTimeout(() => setAction(null), Math.max(0, action.until - Date.now()))
    return () => window.clearTimeout(timer)
  }, [action])
  useEffect(() => {
    if (!bubble) return
    const timer = window.setTimeout(() => setBubble(null), 2600)
    return () => window.clearTimeout(timer)
  }, [bubble])

  const hungry = now - pet.lastFed > HOUR
  const thirsty = now - pet.lastWatered > HOUR
  // Uyku zamanı geldiyse ve aç/susuz değilse 5-9 dakika uyur
  useEffect(() => {
    if (!pet.kind || pet.hidden) return
    if (pet.sleepUntil === 0 && now >= pet.nextSleepAt && !hungry && !thirsty && !petting && !action) {
      update({ sleepUntil: now + sleepLength() })
    } else if (pet.sleepUntil !== 0 && now >= pet.sleepUntil) {
      update({ sleepUntil: 0, nextSleepAt: nextSleep(now) })
    }
  }, [now, pet, hungry, thirsty, petting, action, update])

  if (pet.hidden) {
    return (
      <button type="button" onClick={() => update({ hidden: false })} title="Evcil hayvanı göster"
        className="fixed bottom-4 right-4 z-[36] p-2 rounded-full bg-[#282522]/80 border border-[#4a443f] text-[#b99881] hover:text-white">
        <PawPrint className="w-4 h-4" />
      </button>
    )
  }

  if (!pet.kind) {
    return (
      <div className="fixed bottom-4 right-4 z-[36] w-[230px] rounded-[20px] border border-[#4a443f] bg-[#282522]/95 p-3.5 shadow-xl backdrop-blur-md">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-white">Bir dost sahiplen</span>
          <button type="button" onClick={() => update({ hidden: true })} className="p-0.5 text-[#8c857f] hover:text-white" aria-label="Gizle"><X className="w-3.5 h-3.5" /></button>
        </div>
        <p className="text-[11px] text-[#a69f99] mb-3">Saatlik acıkır, susar, oynar ve uyur. Besle, sev, mutlu et.</p>
        <div className="grid grid-cols-2 gap-2">
          {([['cat', 'Kedi'], ['dog', 'Köpek']] as const).map(([kind, label]) => (
            <button key={kind} type="button" onClick={() => { const t = Date.now(); update({ kind, lastFed: t, lastWatered: t, sleepUntil: 0, nextSleepAt: nextSleep(t) }) }}
              className="flex flex-col items-center gap-1 rounded-2xl border border-[#4a443f] bg-[#34302d] py-2 text-xs font-semibold text-[#d6beae] hover:border-[var(--accent-color,#b99881)] hover:text-white">
              <span className="scale-[0.6] -my-3"><PetFigure kind={kind} mood="playing" /></span>
              {label}
            </button>
          ))}
        </div>
      </div>
    )
  }

  const sleeping = pet.sleepUntil !== 0 && now < pet.sleepUntil
  const mood: Mood = sleeping ? 'sleeping'
    : action ? action.type
    : petting ? 'petting'
    : hungry || thirsty ? 'angry'
    : 'playing'
  const name = pet.kind === 'cat' ? 'Kedi' : 'Köpek'
  const status = sleeping ? 'Uyuyor' : hungry && thirsty ? 'Aç ve susuz!' : hungry ? 'Acıktı!' : thirsty ? 'Susadı!' : petting ? 'Çok mutlu' : 'Oyun oynuyor'

  const onPointerDown = (event: ReactPointerEvent) => {
    if (sleeping) {
      update({ sleepUntil: 0, nextSleepAt: nextSleep(Date.now()) })
      setBubble(pet.kind === 'cat' ? 'Mırr… uyandım' : 'Hav? Uyandım!')
      return
    }
    pointer.current = { x: event.clientX, y: event.clientY, moved: false }
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: ReactPointerEvent) => {
    const start = pointer.current
    if (!start || !(event.buttons & 1)) return
    if (!start.moved && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4) {
      start.moved = true
      if (hungry || thirsty) { setBubble(pet.kind === 'cat' ? 'Hıhh! Önce mama!' : 'Hav! Önce mama!'); return }
      setPetting(true)
    }
  }
  const onPointerUp = () => {
    pointer.current = null
    if (petting) setBubble(pet.kind === 'cat' ? 'Mırrr ♥' : 'Hav hav ♥')
    setPetting(false)
  }

  const feed = (type: 'eating' | 'drinking') => {
    const t = Date.now()
    // Yedikten/içtikten sonra 5 dakika tok: kap tıklanır ama hayvan reddeder
    const last = type === 'eating' ? pet.lastFed : pet.lastWatered
    if (t - last < 5 * MIN) {
      const cat = pet.kind === 'cat'
      setBubble(type === 'eating'
        ? (cat ? 'Tokum, istemem! 😼' : 'Doydum, hav!')
        : (cat ? 'Su istemiyorum, mırr.' : 'Susamadım ki!'))
      return
    }
    update(type === 'eating' ? { lastFed: t, sleepUntil: 0 } : { lastWatered: t, sleepUntil: 0 })
    setAction({ type, until: t + 3500 })
    setBubble(type === 'eating' ? 'Nam nam!' : 'Şap şap!')
  }

  return (
    <div className="fixed bottom-3 z-[36] select-none" style={{ width: 170, right: 'calc(12px + var(--messages-sidebar-offset, 0px))', transition: 'right .25s cubic-bezier(0.16, 1, 0.3, 1)' }}>
      <style>{PET_KEYFRAMES}</style>

      {bubble && (
        <div className="absolute -top-7 right-6 rounded-full bg-[#f4efe6] px-2.5 py-1 text-[11px] font-semibold text-[#3a2a1f] shadow"
          style={{ animation: 'petBubbleIn .18s ease-out' }}>{bubble}</div>
      )}

      {/* Hayvan: tıklayınca uyanır, basılı tutup sürükleyince sevilir */}
      <div className="relative ml-auto w-[96px] cursor-grab active:cursor-grabbing touch-none"
        title={`${name} · ${status}`}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        <PetFigure kind={pet.kind} mood={mood} />
        {mood === 'playing' && (
          <span className="absolute bottom-0 -left-3" style={{ animation: 'petToyRoll 2.4s ease-in-out infinite' }}>
            {pet.kind === 'cat'
              ? <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill="#b5523f" /><path d="M2 6 q5 -3 10 2 M3 10 q4 -5 9 -2 M5 2 q2 6 7 9" stroke="#e3907e" strokeWidth="1" fill="none" /></svg>
              : <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill="#4a9a5a" /><path d="M1.5 7 q5.5 -4 11 0 M1.5 7 q5.5 4 11 0" stroke="#e8f4e8" strokeWidth="1" fill="none" /></svg>}
          </span>
        )}
        {mood === 'sleeping' && [0, 1, 2].map(i => (
          <span key={i} className="absolute top-2 right-6 text-[11px] font-bold text-[#a8b8d8]"
            style={{ animation: `petZzz 2.4s ease-out ${i * 0.8}s infinite` }}>z</span>
        ))}
        {mood === 'petting' && [0, 1, 2, 3].map(i => (
          <span key={i} className="absolute top-3 right-8 text-[13px] text-rose-400"
            style={{ ['--hx' as string]: `${(i % 2 ? 1 : -1) * (6 + i * 3)}px`, animation: `petHeart 1.2s ease-out ${i * 0.3}s infinite` }}>♥</span>
        ))}
      </div>

      {/* Mama ve su kapları + durum */}
      <div className="mt-0.5 flex items-center justify-end gap-1.5">
        <span className={`mr-auto whitespace-nowrap text-[10px] font-semibold ${hungry || thirsty ? 'text-rose-300' : 'text-[#a69f99]'}`}>{status}</span>
        <button type="button" onClick={() => feed('eating')} disabled={!!action}
          title={hungry ? 'Mama ver (acıktı)' : 'Mama ver'}
          className={`p-1.5 rounded-full border transition-colors ${hungry ? 'border-rose-400/60 bg-rose-500/15 text-rose-300' : 'border-[#4a443f] bg-[#282522]/80 text-[#b99881]'} hover:text-white disabled:opacity-50`}>
          <UtensilsCrossed className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={() => feed('drinking')} disabled={!!action}
          title={thirsty ? 'Su ver (susadı)' : 'Su ver'}
          className={`p-1.5 rounded-full border transition-colors ${thirsty ? 'border-sky-400/60 bg-sky-500/15 text-sky-300' : 'border-[#4a443f] bg-[#282522]/80 text-[#b99881]'} hover:text-white disabled:opacity-50`}>
          <Droplets className="w-3.5 h-3.5" />
        </button>
        <div className="relative">
          <button type="button" onClick={() => setMenu(open => !open)} title="Ayarlar"
            className="p-1.5 rounded-full border border-[#4a443f] bg-[#282522]/80 text-[#8c857f] hover:text-white">
            <Settings2 className="w-3.5 h-3.5" />
          </button>
          {menu && (
            <div className="absolute bottom-full right-0 mb-1.5 w-36 rounded-2xl border border-[#4a443f] bg-[#282522] p-1 text-xs shadow-xl">
              <button type="button" className="w-full rounded-xl px-2.5 py-1.5 text-left text-[#d6beae] hover:bg-white/10"
                onClick={() => { setMenu(false); update({ kind: pet.kind === 'cat' ? 'dog' : 'cat' }) }}>
                {pet.kind === 'cat' ? 'Köpeğe geç' : 'Kediye geç'}
              </button>
              <button type="button" className="w-full rounded-xl px-2.5 py-1.5 text-left text-[#d6beae] hover:bg-white/10"
                onClick={() => { setMenu(false); update({ hidden: true }) }}>Gizle</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
