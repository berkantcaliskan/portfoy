/*
 * Ekran altı doğa sahneleri: çam ormanı, boydan boya nehir ve köy.
 * Hepsi yalnızca CSS animasyonu kullanır; tıklamayı engellemez (üst katman pointer-events:none).
 */

const NATURE_KEYFRAMES = `
  @keyframes pineSway { 0%,100% { transform: rotate(-1.4deg); } 50% { transform: rotate(1.4deg); } }
  @keyframes birdGlide {
    0% { transform: translate3d(-80px, 0, 0); }
    50% { transform: translate3d(50vw, -14px, 0); }
    100% { transform: translate3d(calc(100vw + 80px), 4px, 0); }
  }
  @keyframes birdFlap { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(-0.55); } }
  @keyframes fogDrift { 0% { transform: translateX(-30%); } 100% { transform: translateX(130%); } }
  @keyframes riverFlow { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
  @keyframes riverFlowSlow { 0% { transform: translateX(-50%); } 100% { transform: translateX(0); } }
  @keyframes sparkle { 0%,100% { opacity: 0; transform: scale(0.4); } 50% { opacity: 0.9; transform: scale(1); } }
  @keyframes floatAcross {
    0% { transform: translate3d(-60px, 0, 0) rotate(-4deg); }
    25% { transform: translate3d(25vw, -2px, 0) rotate(3deg); }
    50% { transform: translate3d(50vw, 1px, 0) rotate(-3deg); }
    75% { transform: translate3d(75vw, -2px, 0) rotate(4deg); }
    100% { transform: translate3d(calc(100vw + 60px), 0, 0) rotate(-2deg); }
  }
  @keyframes reedSway { 0%,100% { transform: rotate(-5deg); } 50% { transform: rotate(5deg); } }
  @keyframes smokeRise {
    0% { transform: translate(0, 0) scale(0.5); opacity: 0; }
    15% { opacity: 0.55; }
    100% { transform: translate(10px, -34px) scale(1.5); opacity: 0; }
  }
  @keyframes villagerStep { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-1.5px); } }
  @keyframes villagerLegA { 0%,100% { transform: rotate(-22deg); } 50% { transform: rotate(22deg); } }
  @keyframes villagerLegB { 0%,100% { transform: rotate(22deg); } 50% { transform: rotate(-22deg); } }
  @keyframes villagerArm { 0%,100% { transform: rotate(18deg); } 50% { transform: rotate(-18deg); } }

  /* Evden çıkıp başka eve giren, sonra geri dönen köylüler (kapıda görünür/kaybolur) */
  @keyframes villagerA {
    0% { left: 11%; opacity: 0; transform: scaleX(1); }
    3% { opacity: 1; }
    40% { left: 33%; opacity: 1; transform: scaleX(1); }
    44% { left: 33%; opacity: 0; transform: scaleX(1); }
    56% { left: 33%; opacity: 0; transform: scaleX(-1); }
    59% { opacity: 1; }
    96% { left: 11%; opacity: 1; transform: scaleX(-1); }
    100% { left: 11%; opacity: 0; transform: scaleX(-1); }
  }
  @keyframes villagerB {
    0% { left: 61%; opacity: 0; transform: scaleX(1); }
    4% { opacity: 1; }
    30% { left: 74%; transform: scaleX(1); }
    36% { left: 74%; transform: scaleX(1); }
    38% { left: 74%; transform: scaleX(-1); }
    62% { left: 52%; transform: scaleX(-1); }
    66% { left: 52%; transform: scaleX(-1); }
    68% { left: 52%; transform: scaleX(1); }
    96% { left: 61%; opacity: 1; transform: scaleX(1); }
    100% { left: 61%; opacity: 0; transform: scaleX(1); }
  }
  @keyframes villagerC {
    0% { left: 83%; opacity: 0; transform: scaleX(-1); }
    4% { opacity: 1; }
    45% { left: 63%; opacity: 1; transform: scaleX(-1); }
    48% { left: 61%; opacity: 0; transform: scaleX(-1); }
    60% { left: 61%; opacity: 0; transform: scaleX(1); }
    63% { opacity: 1; }
    96% { left: 83%; opacity: 1; transform: scaleX(1); }
    100% { left: 83%; opacity: 0; transform: scaleX(1); }
  }
  @keyframes villagerD {
    0% { left: 18%; transform: scaleX(1); }
    22% { left: 26%; transform: scaleX(1); }
    27% { left: 26%; transform: scaleX(1); }
    29% { left: 26%; transform: scaleX(-1); }
    55% { left: 15%; transform: scaleX(-1); }
    60% { left: 15%; transform: scaleX(-1); }
    62% { left: 15%; transform: scaleX(1); }
    100% { left: 18%; transform: scaleX(1); }
  }
  @keyframes villagerE {
    0% { left: 38%; transform: scaleX(1); }
    45% { left: 50%; transform: scaleX(1); }
    50% { left: 50%; transform: scaleX(-1); }
    95% { left: 38%; transform: scaleX(-1); }
    100% { left: 38%; transform: scaleX(1); }
  }
`

/* ---------------------------------------------------------------- ORMAN */

function Pine({ height, color, shade, trunk, delay }: { height: number; color: string; shade: string; trunk: string; delay: number }) {
  const width = height * 0.62
  return (
    <svg width={width} height={height} viewBox="0 0 62 100" fill="none"
      style={{ transformOrigin: '50% 100%', animation: `pineSway ${5 + (delay % 3)}s ease-in-out ${-delay}s infinite`, display: 'block' }}>
      <rect x="28" y="84" width="6" height="16" rx="1.5" fill={trunk} />
      <polygon points="31,4 46,34 38,34 52,58 42,58 58,86 4,86 20,58 10,58 24,34 16,34" fill={color} />
      <polygon points="31,4 46,34 38,34 52,58 42,58 58,86 31,86" fill={shade} opacity="0.35" />
    </svg>
  )
}

function Bird({ color, duration, delay, bottom }: { color: string; duration: number; delay: number; bottom: number }) {
  return (
    <div className="absolute left-0" style={{ bottom, animation: `birdGlide ${duration}s linear ${delay}s infinite` }}>
      <svg width="18" height="8" viewBox="0 0 18 8" style={{ animation: 'birdFlap 0.5s ease-in-out infinite', transformOrigin: '50% 60%' }}>
        <path d="M1 5 Q5 0 9 5 Q13 0 17 5" stroke={color} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </svg>
    </div>
  )
}

export function PineForestScene({ isNight }: { isNight: boolean }) {
  const back = isNight ? '#1f3127' : '#8fb39a'
  const backShade = isNight ? '#132019' : '#6f977c'
  const front = isNight ? '#27402f' : '#4f7a5a'
  const frontShade = isNight ? '#16251b' : '#2f5239'
  const trunk = isNight ? '#3a2a1f' : '#6b4a32'
  // Arka sıra küçük, ön sıra büyük ağaçlar; konumlar ekran genişliğinin yüzdesi
  const backRow = [2, 9, 15, 23, 31, 38, 47, 55, 63, 70, 78, 86, 93]
  const frontRow = [-1, 6, 19, 27, 42, 59, 67, 74, 82, 90, 97]
  return (
    <div className="absolute inset-x-0 bottom-0 h-[150px] overflow-hidden">
      <div className="absolute inset-x-0 bottom-0 h-[10px]" style={{ background: isNight ? '#1a2a20' : '#9dbf8f' }} />
      {backRow.map((left, i) => (
        <div key={'b' + left} className="absolute bottom-[6px]" style={{ left: `${left}%`, opacity: isNight ? 0.85 : 0.7 }}>
          <Pine height={58 + (i % 3) * 10} color={back} shade={backShade} trunk={trunk} delay={i * 0.7} />
        </div>
      ))}
      <div className="absolute inset-x-0 bottom-[22px] h-[26px] overflow-hidden" style={{ opacity: isNight ? 0.18 : 0.35 }}>
        <div className="absolute top-0 h-full w-[45%] rounded-full blur-md" style={{ background: isNight ? '#9fb3a6' : '#ffffff', animation: 'fogDrift 38s linear infinite' }} />
        <div className="absolute top-1 h-[80%] w-[35%] rounded-full blur-md" style={{ background: isNight ? '#9fb3a6' : '#ffffff', animation: 'fogDrift 52s linear -20s infinite' }} />
      </div>
      {frontRow.map((left, i) => (
        <div key={'f' + left} className="absolute bottom-0" style={{ left: `${left}%` }}>
          <Pine height={82 + (i % 4) * 12} color={front} shade={frontShade} trunk={trunk} delay={i * 0.9 + 0.3} />
        </div>
      ))}
      <Bird color={isNight ? '#cfd8d2' : '#3d4a42'} duration={26} delay={0} bottom={118} />
      <Bird color={isNight ? '#cfd8d2' : '#3d4a42'} duration={26} delay={1.2} bottom={128} />
      <Bird color={isNight ? '#cfd8d2' : '#3d4a42'} duration={31} delay={12} bottom={112} />
    </div>
  )
}

/* ---------------------------------------------------------------- NEHİR */

function WaveStrip({ color, opacity, top, height, animation, amplitude }: { color: string; opacity: number; top: number; height: number; animation: string; amplitude: number }) {
  // Aynı dalga iki kez çizilir; %50 kaydırınca kesintisiz döngü olur
  const segment = (offset: number) => Array.from({ length: 8 }, (_, i) => {
    const x = offset + i * 50
    return `Q ${x + 12.5} ${10 - amplitude} ${x + 25} 10 T ${x + 50} 10`
  }).join(' ')
  const d = `M 0 10 ${segment(0)} ${segment(400)} L 800 30 L 0 30 Z`
  return (
    <div className="absolute left-0 w-[200%]" style={{ top, height, opacity, animation }}>
      <svg width="100%" height="100%" viewBox="0 0 800 30" preserveAspectRatio="none">
        <path d={d} fill={color} />
      </svg>
    </div>
  )
}

export function RiverScene({ isNight }: { isNight: boolean }) {
  const deep = isNight ? '#1f3a4a' : '#6fa8c7'
  const mid = isNight ? '#2b4d60' : '#8cc0db'
  const light = isNight ? '#3d6478' : '#b5d9ea'
  const bank = isNight ? '#22322a' : '#a9c79a'
  const reed = isNight ? '#3c5a45' : '#5f8f5e'
  const reeds = [3, 7, 14, 22, 35, 48, 61, 69, 77, 88, 95]
  return (
    <div className="absolute inset-x-0 bottom-0 h-[150px] overflow-hidden">
      {/* Karşı kıyı */}
      <div className="absolute inset-x-0 bottom-[56px] h-[10px] rounded-t-[50%]" style={{ background: bank, opacity: 0.8 }} />
      {/* Boydan boya akan su */}
      <div className="absolute inset-x-0 bottom-0 h-[60px] overflow-hidden" style={{ background: `linear-gradient(${mid}, ${deep})` }}>
        <WaveStrip color={light} opacity={0.55} top={0} height={14} amplitude={4} animation="riverFlow 14s linear infinite" />
        <WaveStrip color={mid} opacity={0.7} top={14} height={16} amplitude={3} animation="riverFlowSlow 19s linear infinite" />
        <WaveStrip color={light} opacity={0.35} top={32} height={14} amplitude={3} animation="riverFlow 11s linear infinite" />
        {[8, 19, 31, 44, 57, 66, 79, 91].map((left, i) => (
          <span key={left} className="absolute w-1 h-1 rounded-full"
            style={{ left: `${left}%`, top: 10 + (i % 3) * 14, background: isNight ? '#dbeaf2' : '#ffffff', animation: `sparkle ${2.4 + (i % 3) * 0.7}s ease-in-out ${i * 0.45}s infinite` }} />
        ))}
        {/* Akıntıyla süzülen yaprak ve küçük kayık */}
        <div className="absolute left-0 top-[16px]" style={{ animation: 'floatAcross 34s linear infinite' }}>
          <svg width="16" height="8" viewBox="0 0 16 8"><path d="M1 4 Q8 -2 15 4 Q8 10 1 4 Z" fill={isNight ? '#a8742e' : '#d9902f'} /><path d="M1 4 L15 4" stroke={isNight ? '#6b4a1f' : '#9a5f1a'} strokeWidth="0.8" /></svg>
        </div>
        <div className="absolute left-0 top-[24px]" style={{ animation: 'floatAcross 48s linear -18s infinite' }}>
          <svg width="40" height="22" viewBox="0 0 40 22">
            <path d="M2 14 L38 14 L32 21 L8 21 Z" fill={isNight ? '#5b4030' : '#8a5a3b'} />
            <rect x="19" y="1" width="1.6" height="13" fill={isNight ? '#3a2a1f' : '#5a3b26'} />
            <path d="M20.6 2 L31 12 L20.6 12 Z" fill={isNight ? '#cfc6b8' : '#f4efe6'} />
          </svg>
        </div>
      </div>
      {/* Ön kıyıdaki sazlar */}
      {reeds.map((left, i) => (
        <svg key={left} className="absolute bottom-[40px]" width="14" height="34" viewBox="0 0 14 34"
          style={{ left: `${left}%`, transformOrigin: '50% 100%', animation: `reedSway ${3 + (i % 3)}s ease-in-out ${-i * 0.6}s infinite` }}>
          <path d="M7 34 Q6 18 4 4" stroke={reed} strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <path d="M7 34 Q8 20 11 9" stroke={reed} strokeWidth="1.4" fill="none" strokeLinecap="round" />
          <rect x="2.6" y="2" width="2.8" height="8" rx="1.4" fill={isNight ? '#5b4030' : '#7a5236'} />
        </svg>
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------- KÖY */

// Görev çubuğu çizgisinin (dock-breathing-line) ortası ekranın altından ~14px yukarıda; evler bu hizaya oturur
const VILLAGE_BASELINE = 14

function House({ left, wall, roof, door, window: win, chimney, scale, smoke }: {
  left: string; wall: string; roof: string; door: string; window: string; chimney: string; scale: number; smoke: string
}) {
  return (
    <div className="absolute" style={{ left, bottom: VILLAGE_BASELINE, width: 78 * scale, height: 74 * scale }}>
      {/* Bacadan tüten duman */}
      {[0, 1.3, 2.6].map(delay => (
        <span key={delay} className="absolute rounded-full" style={{
          left: 54 * scale, top: 2 * scale, width: 9 * scale, height: 9 * scale, background: smoke,
          animation: `smokeRise 3.9s ease-out ${delay}s infinite`,
        }} />
      ))}
      <svg width={78 * scale} height={74 * scale} viewBox="0 0 78 74" fill="none">
        <rect x="52" y="10" width="8" height="18" fill={chimney} />
        <polygon points="4,36 39,8 74,36" fill={roof} />
        <rect x="10" y="34" width="58" height="40" fill={wall} />
        <rect x="31" y="50" width="14" height="24" rx="2" fill={door} />
        <circle cx="42" cy="62" r="1.1" fill={wall} />
        <rect x="15" y="44" width="11" height="10" rx="1.5" fill={win} />
        <rect x="52" y="44" width="11" height="10" rx="1.5" fill={win} />
        <path d="M20.5 44 V54 M15 49 H26 M57.5 44 V54 M52 49 H63" stroke={wall} strokeWidth="1" />
      </svg>
    </div>
  )
}

function Villager({ shirt, pants, skin, hair, animation, scale = 1, child = false }: {
  shirt: string; pants: string; skin: string; hair: string; animation: string; scale?: number; child?: boolean
}) {
  const s = child ? 0.75 * scale : scale
  return (
    <div className="absolute" style={{ animation, bottom: VILLAGE_BASELINE, marginLeft: -7 * s }}>
      <div style={{ animation: 'villagerStep 0.5s ease-in-out infinite' }}>
        <svg width={14 * s} height={30 * s} viewBox="0 0 14 30" fill="none" overflow="visible">
          <g style={{ transformOrigin: '6px 19px', animation: 'villagerLegA 0.5s ease-in-out infinite' }}>
            <rect x="5" y="19" width="2.4" height="10" rx="1.2" fill={pants} />
          </g>
          <g style={{ transformOrigin: '8px 19px', animation: 'villagerLegB 0.5s ease-in-out infinite' }}>
            <rect x="6.8" y="19" width="2.4" height="10" rx="1.2" fill={pants} />
          </g>
          <rect x="3.5" y="9" width="7" height="11.5" rx="3" fill={shirt} />
          <g style={{ transformOrigin: '7px 10px', animation: 'villagerArm 0.5s ease-in-out infinite' }}>
            <rect x="6" y="10" width="2.2" height="8.5" rx="1.1" fill={skin} />
          </g>
          <circle cx="7" cy="5" r="3.6" fill={skin} />
          <path d="M3.4 4.6 Q7 0 10.6 4.6 Q9 2.6 7 2.6 Q5 2.6 3.4 4.6 Z" fill={hair} />
        </svg>
      </div>
    </div>
  )
}

export function VillageScene({ isNight }: { isNight: boolean }) {
  const ground = isNight ? '#2a2620' : '#c8b48c'
  const grass = isNight ? '#23331f' : '#9fbf86'
  const win = isNight ? '#f3c96b' : '#cfe3ec'
  const smoke = isNight ? 'rgba(200,200,200,0.35)' : 'rgba(120,120,120,0.35)'
  const skin = isNight ? '#c9a184' : '#e8bf9f'
  return (
    <div className="absolute inset-x-0 bottom-0 h-[150px] overflow-hidden">
      <div className="absolute inset-x-0 bottom-0" style={{ height: VILLAGE_BASELINE, background: grass }} />
      <div className="absolute inset-x-0 h-[5px] rounded-full" style={{ bottom: VILLAGE_BASELINE - 4, background: ground, opacity: 0.85 }} />
      <House left="calc(11% - 39px)" scale={1} wall={isNight ? '#5a4a3c' : '#efe2cc'} roof={isNight ? '#6b2f2a' : '#b5523f'} door={isNight ? '#3a2a1f' : '#7a4f33'} window={win} chimney={isNight ? '#3d3530' : '#8b7c6f'} smoke={smoke} />
      <House left="calc(33% - 35px)" scale={0.9} wall={isNight ? '#4f4a43' : '#e6dccb'} roof={isNight ? '#3d4a5a' : '#5b7a99'} door={isNight ? '#2f2a24' : '#6a4a35'} window={win} chimney={isNight ? '#3d3530' : '#8b7c6f'} smoke={smoke} />
      <House left="calc(61% - 41px)" scale={1.05} wall={isNight ? '#57503f' : '#f2e6c6'} roof={isNight ? '#4a3a26' : '#a0703f'} door={isNight ? '#33281d' : '#6e4a2c'} window={win} chimney={isNight ? '#3d3530' : '#8b7c6f'} smoke={smoke} />
      <House left="calc(83% - 37px)" scale={0.95} wall={isNight ? '#544640' : '#ead7cf'} roof={isNight ? '#5a2f3a' : '#9a4a5a'} door={isNight ? '#30241f' : '#71473a'} window={win} chimney={isNight ? '#3d3530' : '#8b7c6f'} smoke={smoke} />
      {/* Evlere girip çıkan ve etrafta dolaşan köylüler */}
      <Villager shirt={isNight ? '#5b7a99' : '#3f7cac'} pants={isNight ? '#2c2f36' : '#3b3f4a'} skin={skin} hair={isNight ? '#2b201a' : '#4a3326'} animation="villagerA 24s linear infinite" />
      <Villager shirt={isNight ? '#8a4a4a' : '#c0504d'} pants={isNight ? '#3a3326' : '#5a4a36'} skin={skin} hair={isNight ? '#5a4a30' : '#b08a4a'} animation="villagerB 30s linear -6s infinite" />
      <Villager shirt={isNight ? '#5f7a52' : '#6aa05a'} pants={isNight ? '#2c2f36' : '#334155'} skin={skin} hair={isNight ? '#1c1a18' : '#2a2420'} animation="villagerC 27s linear -14s infinite" />
      <Villager shirt={isNight ? '#a08a4a' : '#e0b84a'} pants={isNight ? '#3a3326' : '#4b5563'} skin={skin} hair={isNight ? '#4a3326' : '#7a4a2a'} animation="villagerD 21s linear infinite" child />
      <Villager shirt={isNight ? '#6a5a7a' : '#8a6aa8'} pants={isNight ? '#2c2f36' : '#3b3f4a'} skin={skin} hair={isNight ? '#2b201a' : '#3a2a1f'} animation="villagerE 25s linear -9s infinite" />
    </div>
  )
}

export function NatureSceneStyles() {
  return <style>{NATURE_KEYFRAMES}</style>
}
