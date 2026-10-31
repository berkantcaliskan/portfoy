import React, { useEffect, useState } from 'react'

export type AmbientSceneId = 'cat-dog' | 'knight-campfire' | 'rose-garden' | 'lighthouse' | 'none'

export const AMBIENT_SCENE_OPTIONS: {
  id: AmbientSceneId
  name: string
}[] = [
  { id: 'none', name: 'Kapalı' },
  { id: 'cat-dog', name: 'Kedi & Köpek' },
  { id: 'knight-campfire', name: 'Şövalye & Kamp Ateşi' },
  { id: 'rose-garden', name: 'Gül & Çiçek Bahçesi' },
  { id: 'lighthouse', name: 'Deniz Feneri' },
]

export function getSavedAmbientScene(): AmbientSceneId {
  try {
    const saved = localStorage.getItem('demirturk_ambient_scene_v2') as AmbientSceneId | null
    if (saved && AMBIENT_SCENE_OPTIONS.some((o) => o.id === saved)) {
      return saved
    }
  } catch {}
  return 'none'
}

export function setSavedAmbientScene(scene: AmbientSceneId) {
  try {
    localStorage.setItem('demirturk_ambient_scene_v2', scene)
    window.dispatchEvent(new CustomEvent('demirturk_ambient_scene_changed', { detail: scene }))
  } catch {}
}

export const AmbientSceneOverlay: React.FC<{ sidebarCollapsed?: boolean }> = ({
  sidebarCollapsed = false,
}) => {
  const [scene, setScene] = useState<AmbientSceneId>(() => getSavedAmbientScene())
  const [isNight, setIsNight] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false
    return document.documentElement.getAttribute('data-theme-accent') === 'night'
  })

  useEffect(() => {
    const handleSceneChange = () => {
      setScene(getSavedAmbientScene())
    }
    window.addEventListener('demirturk_ambient_scene_changed', handleSceneChange)

    const observer = new MutationObserver(() => {
      setIsNight(document.documentElement.getAttribute('data-theme-accent') === 'night')
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme-accent'],
    })

    return () => {
      window.removeEventListener('demirturk_ambient_scene_changed', handleSceneChange)
      observer.disconnect()
    }
  }, [])

  if (scene === 'none') return null

  const leftOffsetClass = sidebarCollapsed ? 'md:left-[64px]' : 'md:left-[212px]'

  return (
    <div
      className={`fixed inset-y-0 right-0 left-0 ${leftOffsetClass} pointer-events-none overflow-hidden select-none z-[35] transition-[left] duration-300`}
      aria-hidden="true"
    >
      <style>{`
        /* ============================================================
           1. KEDİ & KÖPEK KOŞTURMACASI (DOCK ÜSTÜNDEN ATLAYAN SÜREKLİ ANİMASYON)
           ============================================================ */
        @keyframes petRunAcrossRight {
          0% {
            transform: translate3d(-160px, 0px, 0) scaleX(1);
          }
          34% {
            transform: translate3d(calc(40vw - 80px), 0px, 0) scaleX(1) rotate(0deg);
          }
          39% {
            transform: translate3d(calc(45vw - 60px), -68px, 0) scaleX(1) rotate(-14deg);
          }
          45% {
            transform: translate3d(calc(50vw - 40px), -92px, 0) scaleX(1) rotate(2deg);
          }
          51% {
            transform: translate3d(calc(55vw - 20px), -64px, 0) scaleX(1) rotate(14deg);
          }
          56% {
            transform: translate3d(calc(60vw), 0px, 0) scaleX(1) rotate(0deg);
          }
          76% {
            transform: translate3d(calc(80vw), 0px, 0) scaleX(1) rotate(0deg);
          }
          80% {
            transform: translate3d(calc(84vw), -26px, 0) scaleX(1) rotate(-8deg);
          }
          84% {
            transform: translate3d(calc(88vw), 0px, 0) scaleX(1) rotate(0deg);
          }
          100% {
            transform: translate3d(calc(100vw + 180px), 0px, 0) scaleX(1);
          }
        }

        @keyframes petRunAcrossLeft {
          0% {
            transform: translate3d(calc(100vw + 180px), 0px, 0) scaleX(-1);
          }
          34% {
            transform: translate3d(calc(60vw), 0px, 0) scaleX(-1) rotate(0deg);
          }
          39% {
            transform: translate3d(calc(55vw - 20px), -68px, 0) scaleX(-1) rotate(-14deg);
          }
          45% {
            transform: translate3d(calc(50vw - 40px), -94px, 0) scaleX(-1) rotate(2deg);
          }
          51% {
            transform: translate3d(calc(45vw - 60px), -64px, 0) scaleX(-1) rotate(14deg);
          }
          56% {
            transform: translate3d(calc(40vw - 80px), 0px, 0) scaleX(-1) rotate(0deg);
          }
          100% {
            transform: translate3d(-180px, 0px, 0) scaleX(-1);
          }
        }

        @keyframes petGallopBounce {
          0%, 100% {
            transform: translateY(0px) rotate(-2deg);
          }
          50% {
            transform: translateY(-6px) rotate(3deg);
          }
        }

        @keyframes legSwingFront {
          0%, 100% { transform: rotate(-28deg); }
          50% { transform: rotate(28deg); }
        }

        @keyframes legSwingBack {
          0%, 100% { transform: rotate(28deg); }
          50% { transform: rotate(-28deg); }
        }

        @keyframes tailWagFast {
          0%, 100% { transform: rotate(-14deg); }
          50% { transform: rotate(18deg); }
        }

        @keyframes butterflyFloat {
          0%, 100% { transform: translate(0, 0) rotate(-6deg); }
          25% { transform: translate(12px, -14px) rotate(8deg); }
          50% { transform: translate(24px, -4px) rotate(-4deg); }
          75% { transform: translate(10px, -18px) rotate(6deg); }
        }

        /* ============================================================
           2. ŞÖVALYE & KAMP ATEŞİ (MAĞARA KEMERİ & MİSTİK NÖBETÇİ)
           ============================================================ */
        @keyframes campfireFlicker {
          0%, 100% { transform: scale(1, 1) rotate(-1deg); opacity: 0.95; }
          25% { transform: scale(1.06, 1.12) rotate(2deg); opacity: 1; }
          50% { transform: scale(0.95, 1.04) rotate(-2deg); opacity: 0.9; }
          75% { transform: scale(1.04, 1.15) rotate(1deg); opacity: 1; }
        }

        @keyframes emberRise {
          0% { transform: translateY(0) translateX(0) scale(1); opacity: 0.9; }
          50% { transform: translateY(-38px) translateX(-8px) scale(0.8); opacity: 0.7; }
          100% { transform: translateY(-78px) translateX(6px) scale(0.3); opacity: 0; }
        }

        @keyframes knightBreathe {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-2.5px); }
        }

        @keyframes lanternSwing {
          0%, 100% { transform: rotate(-5deg); }
          50% { transform: rotate(5deg); }
        }

        /* ============================================================
           3. GÜL & ÇİÇEK BAHÇESİ (SALLANAN GÜLLER & UÇUŞAN YAPRAKLAR)
           ============================================================ */
        @keyframes roseSway {
          0%, 100% { transform: rotate(-3.5deg); }
          50% { transform: rotate(3.5deg); }
        }

        @keyframes petalDrift {
          0% {
            transform: translate3d(0, 0, 0) rotate(0deg);
            opacity: 0;
          }
          15% {
            opacity: 0.85;
          }
          85% {
            opacity: 0.75;
          }
          100% {
            transform: translate3d(-180px, -140px, 0) rotate(260deg);
            opacity: 0;
          }
        }

        /* ============================================================
           4. DENİZ FENERİ & KAYAN YILDIZLAR
           ============================================================ */
        @keyframes lighthouseBeam {
          0%, 100% { opacity: 0.22; transform: rotate(-8deg) scaleX(1); }
          50% { opacity: 0.65; transform: rotate(4deg) scaleX(1.08); }
        }

        @keyframes waveGentle {
          0%, 100% { transform: translateX(0px); }
          50% { transform: translateX(-14px); }
        }

        @keyframes shootingStarSlide {
          0%, 70% { transform: translate3d(0, 0, 0) scale(0.4); opacity: 0; }
          75% { opacity: 0.95; transform: translate3d(-30px, 15px, 0) scale(1); }
          90% { opacity: 0; transform: translate3d(-190px, 95px, 0) scale(0.6); }
          100% { opacity: 0; transform: translate3d(-190px, 95px, 0) scale(0.2); }
        }
      `}</style>

      {/* ====================================================================
          SAHNE 1: KEDİ & KÖPEK KOŞTURMACASI (DOCK ÜSTÜNDEN ZIPLAR)
         ==================================================================== */}
      {scene === 'cat-dog' && (
        <div className="absolute inset-x-0 bottom-0 h-[150px] overflow-hidden">
          {/* Sol ve Sağ Köşe Çimen & Küçük Papatya Kümesi */}
          <svg
            className="absolute bottom-0 left-4 w-28 h-12 opacity-75"
            viewBox="0 0 120 48"
            fill="none"
          >
            <path
              d="M8 48 C10 32, 4 22, 2 14 C8 22, 14 32, 14 48 Z"
              fill={isNight ? '#3d5a4c' : '#68a691'}
            />
            <path
              d="M18 48 C22 28, 28 18, 34 10 C30 24, 26 34, 24 48 Z"
              fill={isNight ? '#4f7363' : '#528c78'}
            />
            <circle cx="34" cy="10" r="3.5" fill={isNight ? '#f4f1ea' : '#ffffff'} />
            <circle cx="34" cy="10" r="1.5" fill="#eab308" />
          </svg>

          <svg
            className="absolute bottom-0 right-6 w-28 h-12 opacity-75"
            viewBox="0 0 120 48"
            fill="none"
          >
            <path
              d="M90 48 C88 30, 82 20, 76 12 C84 20, 92 32, 96 48 Z"
              fill={isNight ? '#4f7363' : '#528c78'}
            />
            <path
              d="M104 48 C106 32, 112 22, 116 14 C112 26, 108 36, 108 48 Z"
              fill={isNight ? '#3d5a4c' : '#68a691'}
            />
            <circle cx="76" cy="12" r="3.5" fill={isNight ? '#f4f1ea' : '#ffffff'} />
            <circle cx="76" cy="12" r="1.5" fill="#f59e0b" />
          </svg>

          {/* Soldan Sağa Koşan ve Dock Üstünden Atlayan Kedi + Köpek İkilisi */}
          <div
            className="absolute bottom-[4px] left-0 flex items-end gap-5"
            style={{
              animation: 'petRunAcrossRight 15s linear infinite',
            }}
          >
            {/* Önde Koşan Turuncu Tekir Kedi */}
            <div style={{ animation: 'petGallopBounce 0.32s ease-in-out infinite' }}>
              <svg width="54" height="40" viewBox="0 0 54 40" fill="none">
                {/* Kuyruk */}
                <path
                  d="M10 22 Q2 12 6 5"
                  stroke={isNight ? '#e09f5a' : '#d97706'}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  style={{
                    transformOrigin: '10px 22px',
                    animation: 'tailWagFast 0.35s ease-in-out infinite',
                  }}
                />
                {/* Arka Bacaklar */}
                <g
                  style={{
                    transformOrigin: '15px 26px',
                    animation: 'legSwingBack 0.28s ease-in-out infinite',
                  }}
                >
                  <line
                    x1="15"
                    y1="25"
                    x2="10"
                    y2="36"
                    stroke={isNight ? '#c98642' : '#b45309'}
                    strokeWidth="3.2"
                    strokeLinecap="round"
                  />
                  <line
                    x1="18"
                    y1="25"
                    x2="15"
                    y2="37"
                    stroke={isNight ? '#e09f5a' : '#d97706'}
                    strokeWidth="3.2"
                    strokeLinecap="round"
                  />
                </g>
                {/* Ön Bacaklar */}
                <g
                  style={{
                    transformOrigin: '33px 26px',
                    animation: 'legSwingFront 0.28s ease-in-out infinite',
                  }}
                >
                  <line
                    x1="31"
                    y1="25"
                    x2="35"
                    y2="37"
                    stroke={isNight ? '#c98642' : '#b45309'}
                    strokeWidth="3.2"
                    strokeLinecap="round"
                  />
                  <line
                    x1="34"
                    y1="25"
                    x2="40"
                    y2="36"
                    stroke={isNight ? '#e09f5a' : '#d97706'}
                    strokeWidth="3.2"
                    strokeLinecap="round"
                  />
                </g>
                {/* Gövde */}
                <ellipse
                  cx="24"
                  cy="22"
                  rx="13"
                  ry="7.5"
                  fill={isNight ? '#e09f5a' : '#f59e0b'}
                />
                {/* Sırt Çizgileri */}
                <path
                  d="M20 15 L19 19 M25 14.5 L24 19 M29 15.5 L28 19"
                  stroke={isNight ? '#9c5c21' : '#b45309'}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                {/* Kafa */}
                <circle cx="38" cy="16" r="7.5" fill={isNight ? '#e09f5a' : '#f59e0b'} />
                {/* Kulaklar */}
                <polygon points="33,11 35,4 39,10" fill={isNight ? '#c98642' : '#d97706'} />
                <polygon points="39,10 43,4 44,12" fill={isNight ? '#c98642' : '#d97706'} />
                {/* Göz ve Burun */}
                <circle cx="41.5" cy="15" r="1.4" fill="#181918" />
                <circle cx="42" cy="14.6" r="0.5" fill="#ffffff" />
                <circle cx="45" cy="17.2" r="1.1" fill="#fb7185" />
              </svg>
            </div>

            {/* Arkadan Koşan Neşeli Golden/Krem Köpek */}
            <div
              style={{
                animation: 'petGallopBounce 0.34s ease-in-out infinite 0.12s',
              }}
            >
              <svg width="68" height="46" viewBox="0 0 68 46" fill="none">
                {/* Kuyruk */}
                <path
                  d="M12 24 Q3 14 7 7"
                  stroke={isNight ? '#d6beae' : '#b99881'}
                  strokeWidth="4.2"
                  strokeLinecap="round"
                  style={{
                    transformOrigin: '12px 24px',
                    animation: 'tailWagFast 0.26s ease-in-out infinite',
                  }}
                />
                {/* Arka Bacaklar */}
                <g
                  style={{
                    transformOrigin: '18px 29px',
                    animation: 'legSwingBack 0.3s ease-in-out infinite',
                  }}
                >
                  <line
                    x1="17"
                    y1="28"
                    x2="11"
                    y2="42"
                    stroke={isNight ? '#b59b88' : '#8c6d58'}
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                  <line
                    x1="21"
                    y1="28"
                    x2="17"
                    y2="43"
                    stroke={isNight ? '#e6dfd9' : '#c4a690'}
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                </g>
                {/* Ön Bacaklar */}
                <g
                  style={{
                    transformOrigin: '41px 29px',
                    animation: 'legSwingFront 0.3s ease-in-out infinite',
                  }}
                >
                  <line
                    x1="39"
                    y1="28"
                    x2="44"
                    y2="43"
                    stroke={isNight ? '#b59b88' : '#8c6d58'}
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                  <line
                    x1="43"
                    y1="28"
                    x2="50"
                    y2="41"
                    stroke={isNight ? '#e6dfd9' : '#c4a690'}
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                </g>
                {/* Gövde */}
                <ellipse
                  cx="30"
                  cy="25"
                  rx="16"
                  ry="9.5"
                  fill={isNight ? '#e6dfd9' : '#d2b49c'}
                />
                {/* Tasma (Vurgu Renginde) */}
                <path
                  d="M41 18 L45 27"
                  stroke="var(--accent-color, #5c6ac4)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                {/* Kafa */}
                <circle cx="47" cy="17" r="8.5" fill={isNight ? '#e6dfd9' : '#d2b49c'} />
                {/* Burun Çıkıntısı */}
                <ellipse cx="55" cy="18.5" rx="5" ry="3.8" fill={isNight ? '#e6dfd9' : '#d2b49c'} />
                {/* Dışarı Çıkan Mutlu Pembe Dil */}
                <path
                  d="M54 21 Q56 25 53 25.5"
                  stroke="#fb7185"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                />
                {/* Sarkık Kulak */}
                <ellipse
                  cx="43"
                  cy="18"
                  rx="3.5"
                  ry="6.5"
                  transform="rotate(16 43 18)"
                  fill={isNight ? '#b59b88' : '#9c7b65'}
                />
                {/* Göz & Siyah Burun */}
                <circle cx="50.5" cy="15" r="1.5" fill="#181918" />
                <circle cx="51" cy="14.5" r="0.5" fill="#ffffff" />
                <circle cx="59" cy="17" r="1.8" fill="#181918" />
              </svg>
            </div>

            {/* Önlerinde Uçuşan Kelebek */}
            <div
              className="mb-6 ml-1"
              style={{ animation: 'butterflyFloat 2.4s ease-in-out infinite' }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M10 10 C5 3, 1 6, 6 11 C2 14, 6 17, 10 12 Z"
                  fill="var(--accent-color, #5c6ac4)"
                  opacity="0.85"
                />
                <path
                  d="M10 10 C15 3, 19 6, 14 11 C18 14, 14 17, 10 12 Z"
                  fill="var(--accent-color, #5c6ac4)"
                  opacity="0.65"
                />
              </svg>
            </div>
          </div>

          {/* Sağdan Sola Ters Yönde Koşan Lacivert/Gri Kedi (Bacakları ve Kuyruk Animasyonuyla) */}
          <div
            className="absolute bottom-[4px] left-0 flex items-end gap-4"
            style={{
              animation: 'petRunAcrossLeft 19s linear infinite 7.5s',
            }}
          >
            <div style={{ animation: 'petGallopBounce 0.3s ease-in-out infinite' }}>
              <svg width="54" height="40" viewBox="0 0 54 40" fill="none">
                {/* Kuyruk */}
                <path
                  d="M10 22 Q2 12 6 5"
                  stroke={isNight ? '#94a3b8' : '#334155'}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  style={{
                    transformOrigin: '10px 22px',
                    animation: 'tailWagFast 0.34s ease-in-out infinite',
                  }}
                />
                {/* Arka Bacaklar */}
                <g
                  style={{
                    transformOrigin: '15px 26px',
                    animation: 'legSwingBack 0.28s ease-in-out infinite',
                  }}
                >
                  <line
                    x1="15"
                    y1="25"
                    x2="10"
                    y2="36"
                    stroke={isNight ? '#64748b' : '#1e293b'}
                    strokeWidth="3.2"
                    strokeLinecap="round"
                  />
                  <line
                    x1="18"
                    y1="25"
                    x2="15"
                    y2="37"
                    stroke={isNight ? '#94a3b8' : '#475569'}
                    strokeWidth="3.2"
                    strokeLinecap="round"
                  />
                </g>
                {/* Ön Bacaklar */}
                <g
                  style={{
                    transformOrigin: '33px 26px',
                    animation: 'legSwingFront 0.28s ease-in-out infinite',
                  }}
                >
                  <line
                    x1="31"
                    y1="25"
                    x2="35"
                    y2="37"
                    stroke={isNight ? '#64748b' : '#1e293b'}
                    strokeWidth="3.2"
                    strokeLinecap="round"
                  />
                  <line
                    x1="34"
                    y1="25"
                    x2="40"
                    y2="36"
                    stroke={isNight ? '#94a3b8' : '#475569'}
                    strokeWidth="3.2"
                    strokeLinecap="round"
                  />
                </g>
                {/* Gövde */}
                <ellipse
                  cx="24"
                  cy="22"
                  rx="13"
                  ry="7.5"
                  fill={isNight ? '#cbd5e1' : '#475569'}
                />
                {/* Sırt Çizgileri */}
                <path
                  d="M20 15 L19 19 M25 14.5 L24 19 M29 15.5 L28 19"
                  stroke={isNight ? '#64748b' : '#1e293b'}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                {/* Kafa */}
                <circle cx="38" cy="16" r="7.5" fill={isNight ? '#cbd5e1' : '#475569'} />
                {/* Kulaklar */}
                <polygon points="33,11 35,4 39,10" fill={isNight ? '#94a3b8' : '#334155'} />
                <polygon points="39,10 43,4 44,12" fill={isNight ? '#94a3b8' : '#334155'} />
                {/* Göz ve Burun */}
                <circle cx="41.5" cy="15" r="1.4" fill="#181918" />
                <circle cx="42" cy="14.6" r="0.5" fill="#ffffff" />
                <circle cx="45" cy="17.2" r="1.1" fill="#fb7185" />
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          SAHNE 2: ŞÖVALYE & KAMP ATEŞİ (SAĞDA MAĞARA VE KAMP ATEŞİ, SOLDA MİSTİK FENER)
         ==================================================================== */}
      {scene === 'knight-campfire' && (
        <>
          {/* SAĞ ALT KÖŞE: Mağara Kemeri, Kamp Ateşi, Kılıç ve Isınan Şövalye */}
          <div className="absolute bottom-0 right-2 w-[270px] h-[175px]">
            <svg width="270" height="175" viewBox="0 0 270 175" fill="none">
              {/* Mağara Kaya Kemeri Silüeti */}
              <path
                d="M95 175 C98 115, 130 58, 188 38 C222 26, 250 32, 270 45 L270 175 Z"
                fill={isNight ? '#212422' : '#d9dbd6'}
                opacity={isNight ? '0.92' : '0.78'}
              />
              <path
                d="M118 175 C122 125, 148 76, 198 58 C228 48, 252 54, 270 66 L270 175 Z"
                fill={isNight ? '#151716' : '#c8cbc4'}
                opacity="0.9"
              />

              {/* Kamp Ateşi Sıcak Işık Halesi */}
              <circle
                cx="166"
                cy="148"
                r="46"
                fill="url(#campfireGlow)"
                style={{ animation: 'campfireFlicker 2.2s ease-in-out infinite' }}
              />
              <defs>
                <radialGradient id="campfireGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#f97316" stopOpacity={isNight ? '0.42' : '0.26'} />
                  <stop offset="60%" stopColor="#f59e0b" stopOpacity={isNight ? '0.16' : '0.1'} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Toprağa Saplı Şövalye Kılıcı */}
              <g transform="translate(128, 108) rotate(-8)">
                <rect x="6" y="14" width="3.2" height="44" rx="1.5" fill="#94a3b8" />
                <rect x="0" y="12" width="15" height="3.5" rx="1.5" fill="#d97706" />
                <rect x="5.8" y="3" width="3.6" height="9" rx="1.5" fill="#78350f" />
                <circle cx="7.6" cy="2.5" r="2.8" fill="#f59e0b" />
              </g>

              {/* Oturan ve Ellerini Ateşe Uzatan Şövalye */}
              <g
                style={{
                  transformOrigin: '214px 135px',
                  animation: 'knightBreathe 3.2s ease-in-out infinite',
                }}
              >
                {/* Pelerin */}
                <path
                  d="M210 112 C228 116, 242 138, 246 168 L202 168 Z"
                  fill="var(--accent-color, #657a72)"
                  opacity="0.9"
                />
                {/* Gövde Zırhı */}
                <rect x="200" y="114" width="22" height="34" rx="8" fill="#64748b" />
                <rect x="203" y="118" width="16" height="24" rx="5" fill="#94a3b8" />
                {/* Miğfer (Başlık) */}
                <rect x="199" y="92" width="22" height="22" rx="7" fill="#94a3b8" />
                {/* Miğfer Göz Yarığı (Ateş Parıltısı Yansıması) */}
                <rect x="201" y="101" width="11" height="3" rx="1.5" fill="#1e293b" />
                <rect x="202" y="101.5" width="5" height="2" rx="1" fill="#fbbf24" />
                {/* Miğfer Sorgucu */}
                <path
                  d="M212 92 Q224 82 230 94"
                  stroke="var(--accent-color, #657a72)"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                {/* Ateşe Uzanan Kol ve Eldiven */}
                <path
                  d="M204 124 L182 134"
                  stroke="#94a3b8"
                  strokeWidth="6"
                  strokeLinecap="round"
                />
                <circle cx="180" cy="135" r="3.5" fill="#475569" />
              </g>

              {/* Kamp Ateşi Odunları ve Çıtırdayan Alevler */}
              <g transform="translate(150, 134)">
                <rect
                  x="2"
                  y="24"
                  width="30"
                  height="6"
                  rx="3"
                  transform="rotate(14 2 24)"
                  fill="#78350f"
                />
                <rect
                  x="2"
                  y="30"
                  width="30"
                  height="6"
                  rx="3"
                  transform="rotate(-14 2 30)"
                  fill="#92400e"
                />
                {/* Dış Turuncu Alev */}
                <path
                  d="M17 2 C25 12, 29 20, 25 28 C21 33, 13 33, 9 28 C5 20, 9 12, 17 2 Z"
                  fill="#f97316"
                  style={{
                    transformOrigin: '17px 26px',
                    animation: 'campfireFlicker 1.3s ease-in-out infinite',
                  }}
                />
                {/* İç Sarı Alev */}
                <path
                  d="M17 10 C22 16, 24 22, 21 28 C19 31, 15 31, 13 28 C10 22, 12 16, 17 10 Z"
                  fill="#fde047"
                  style={{
                    transformOrigin: '17px 27px',
                    animation: 'campfireFlicker 0.95s ease-in-out infinite reverse',
                  }}
                />
                {/* Yükselen Kıvılcımlar (Embers) */}
                <circle
                  cx="14"
                  cy="6"
                  r="1.8"
                  fill="#fbbf24"
                  style={{ animation: 'emberRise 2.6s ease-out infinite' }}
                />
                <circle
                  cx="21"
                  cy="4"
                  r="1.4"
                  fill="#f97316"
                  style={{ animation: 'emberRise 3.1s ease-out infinite 0.9s' }}
                />
                <circle
                  cx="17"
                  cy="2"
                  r="1.5"
                  fill="#fde047"
                  style={{ animation: 'emberRise 2.3s ease-out infinite 1.6s' }}
                />
              </g>
            </svg>
          </div>

          {/* SOL ALT KÖŞE: Mistik Fenerli Gezgin / Muhafız ve Uçuşan Ateşböcekleri */}
          <div className="absolute bottom-0 left-3 w-[160px] h-[140px]">
            <svg width="160" height="140" viewBox="0 0 160 140" fill="none">
              {/* Kayalık Zemin */}
              <path
                d="M0 140 L0 105 C28 102, 54 114, 78 140 Z"
                fill={isNight ? '#212422' : '#d5d8d2'}
                opacity="0.82"
              />
              {/* Asaya Asılı Sallanan Mistik Fener */}
              <line
                x1="54"
                y1="66"
                x2="44"
                y2="136"
                stroke={isNight ? '#9c7b65' : '#78350f'}
                strokeWidth="3.2"
                strokeLinecap="round"
              />
              <g
                style={{
                  transformOrigin: '54px 66px',
                  animation: 'lanternSwing 3.4s ease-in-out infinite',
                }}
              >
                <line x1="54" y1="66" x2="62" y2="76" stroke="#94a3b8" strokeWidth="1.8" />
                <circle
                  cx="62"
                  cy="83"
                  r="14"
                  fill="#34d399"
                  opacity={isNight ? '0.28' : '0.18'}
                />
                <rect
                  x="57"
                  y="76"
                  width="10"
                  height="13"
                  rx="3"
                  fill="#10b981"
                  stroke="#f4f1ea"
                  strokeWidth="1.3"
                />
                <circle cx="62" cy="82.5" r="2.5" fill="#ecfdf5" />
              </g>
              {/* Ateşböcekleri */}
              <circle
                cx="82"
                cy="74"
                r="2"
                fill="#34d399"
                style={{ animation: 'emberRise 4s ease-in-out infinite' }}
              />
              <circle
                cx="98"
                cy="88"
                r="1.6"
                fill="#a7f3d0"
                style={{ animation: 'emberRise 3.5s ease-in-out infinite 1.2s' }}
              />
            </svg>
          </div>
        </>
      )}

      {/* ====================================================================
          SAHNE 3: GÜL & ÇİÇEK BAHÇESİ (SALLANAN GÜLLER, SARMAŞIKLAR VE UÇUŞAN TAÇ YAPRAKLAR)
         ==================================================================== */}
      {scene === 'rose-garden' && (
        <>
          {/* Sağ Alt Gül & Çiçek Köşesi */}
          <div className="absolute bottom-0 right-4 w-[240px] h-[165px]">
            <svg width="240" height="165" viewBox="0 0 240 165" fill="none">
              {/* Sallanan Gül Dalı 1 */}
              <g
                style={{
                  transformOrigin: '190px 165px',
                  animation: 'roseSway 4.2s ease-in-out infinite',
                }}
              >
                <path
                  d="M190 165 C186 128, 172 96, 158 66"
                  stroke={isNight ? '#4d7c6a' : '#3f7a63'}
                  strokeWidth="3.2"
                  strokeLinecap="round"
                />
                {/* Yapraklar */}
                <ellipse
                  cx="168"
                  cy="112"
                  rx="9"
                  ry="4.5"
                  transform="rotate(-28 168 112)"
                  fill={isNight ? '#4d7c6a' : '#52947b'}
                />
                <ellipse
                  cx="182"
                  cy="94"
                  rx="9"
                  ry="4.5"
                  transform="rotate(24 182 94)"
                  fill={isNight ? '#4d7c6a' : '#52947b'}
                />
                {/* Açmış Katmerli Gül */}
                <circle cx="158" cy="64" r="13" fill="#e11d48" />
                <circle cx="155" cy="61" r="9.5" fill="#fb7185" />
                <path
                  d="M152 60 C155 56, 161 57, 160 63 C159 67, 153 66, 154 61"
                  stroke="#ffe4e6"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </g>

              {/* Sallanan Gül Dalı 2 */}
              <g
                style={{
                  transformOrigin: '216px 165px',
                  animation: 'roseSway 3.6s ease-in-out infinite 0.8s',
                }}
              >
                <path
                  d="M216 165 C218 132, 208 104, 198 82"
                  stroke={isNight ? '#3d6656' : '#356954'}
                  strokeWidth="2.8"
                  strokeLinecap="round"
                />
                <circle cx="198" cy="80" r="10.5" fill="#be123c" />
                <circle cx="196" cy="78" r="7" fill="#f43f5e" />
                <circle cx="195" cy="77" r="3" fill="#fecdd3" />
              </g>

              {/* Rüzgarda Uçuşan Gül Yaprakları */}
              <ellipse
                cx="145"
                cy="88"
                rx="4.5"
                ry="2.6"
                fill="#fb7185"
                style={{ animation: 'petalDrift 7s ease-in-out infinite' }}
              />
              <ellipse
                cx="175"
                cy="72"
                rx="4"
                ry="2.2"
                fill="#f43f5e"
                style={{ animation: 'petalDrift 8.5s ease-in-out infinite 2.2s' }}
              />
              <ellipse
                cx="160"
                cy="105"
                rx="3.5"
                ry="2"
                fill="#fda4af"
                style={{ animation: 'petalDrift 6.5s ease-in-out infinite 4.1s' }}
              />
            </svg>
          </div>

          {/* Sol Alt Bahar Çiçekleri & Kelebek */}
          <div className="absolute bottom-0 left-4 w-[180px] h-[140px]">
            <svg width="180" height="140" viewBox="0 0 180 140" fill="none">
              <g
                style={{
                  transformOrigin: '42px 140px',
                  animation: 'roseSway 4.6s ease-in-out infinite',
                }}
              >
                <path
                  d="M42 140 C44 112, 54 90, 62 72"
                  stroke={isNight ? '#4d7c6a' : '#3f7a63'}
                  strokeWidth="2.8"
                  strokeLinecap="round"
                />
                <circle cx="62" cy="70" r="9.5" fill="#fb7185" />
                <circle cx="62" cy="70" r="4" fill="#fde047" />
              </g>
              <g
                style={{
                  transformOrigin: '24px 140px',
                  animation: 'roseSway 3.8s ease-in-out infinite 1.1s',
                }}
              >
                <path
                  d="M24 140 C22 118, 28 98, 34 86"
                  stroke={isNight ? '#4d7c6a' : '#3f7a63'}
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
                <circle cx="34" cy="84" r="7.5" fill="var(--accent-color, #5c6ac4)" />
                <circle cx="34" cy="84" r="2.8" fill="#ffffff" />
              </g>
            </svg>
          </div>
        </>
      )}

      {/* ====================================================================
          SAHNE 4: DENİZ FENERİ & KAYAN YILDIZLAR
         ==================================================================== */}
      {scene === 'lighthouse' && (
        <>
          {/* Sağ Alt: Işık Hüzmesi Dönerek Parlayan Deniz Feneri ve Dalgalar */}
          <div className="absolute bottom-0 right-0 w-[320px] h-[200px]">
            <svg width="320" height="200" viewBox="0 0 320 200" fill="none">
              {/* Fener Işık Hüzmesi */}
              <polygon
                points="256,74 30,22 30,104"
                fill="url(#beamGrad)"
                style={{
                  transformOrigin: '256px 74px',
                  animation: 'lighthouseBeam 5s ease-in-out infinite',
                }}
              />
              <defs>
                <linearGradient id="beamGrad" x1="256" y1="74" x2="30" y2="64" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#fde047" stopOpacity={isNight ? '0.5' : '0.32'} />
                  <stop offset="100%" stopColor="#fde047" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Kayalık Ada */}
              <path
                d="M195 200 C205 168, 228 152, 262 150 C288 148, 308 164, 320 200 Z"
                fill={isNight ? '#252826' : '#c9ccc6'}
              />

              {/* Deniz Feneri Gövdesi */}
              <polygon points="246,154 266,154 262,80 250,80" fill="#f4f1ea" />
              <polygon points="248,128 264,128 263,110 249,110" fill="#e11d48" />
              <polygon points="250,96 262,96 261,84 251,84" fill="#e11d48" />
              {/* Fener Cam Odası */}
              <rect x="249" y="68" width="14" height="12" rx="2" fill="#fde047" />
              {/* Fener Çatısı */}
              <polygon points="246,68 266,68 256,56" fill="#be123c" />

              {/* Hafif Hareketli Dalgalar */}
              <path
                d="M160 194 Q180 188 200 194 T240 194 T280 194 T320 194"
                stroke="var(--accent-color, #657a72)"
                strokeWidth="2.5"
                strokeLinecap="round"
                opacity="0.55"
                style={{ animation: 'waveGentle 3.6s ease-in-out infinite' }}
              />
            </svg>
          </div>

          {/* Üst Sağ Boşlukta Kayan Yıldız */}
          <div
            className="absolute top-16 right-48"
            style={{ animation: 'shootingStarSlide 9s ease-in-out infinite' }}
          >
            <svg width="70" height="36" viewBox="0 0 70 36" fill="none">
              <line
                x1="8"
                y1="28"
                x2="64"
                y2="4"
                stroke={isNight ? '#fde047' : 'var(--accent-color, #5c6ac4)'}
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.65"
              />
              <circle
                cx="8"
                cy="28"
                r="2.8"
                fill={isNight ? '#fde047' : 'var(--accent-color, #5c6ac4)'}
              />
            </svg>
          </div>
        </>
      )}
    </div>
  )
}
