import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

export interface BookLogoProps {
  className?: string
  size?: number
  /** Whether the book should animate from closed to open on mount (default: true) */
  animated?: boolean
  /** Optional controlled open state (overrides internal mount timer when provided) */
  isOpen?: boolean
  /** Delay in seconds before the book begins opening in uncontrolled mode (default: 0.12) */
  openDelay?: number
  /** Duration in seconds for the book opening motion (default: 0.72) */
  duration?: number
}

// 3. Üst Kapak: Kapalı yatay defter/kitap kapağı -> Tam 45° yukarı-sağa açık kapak
const COVER_CLOSED =
  'M 5.5 15.8 L 20.5 15.8 C 21.6 15.8, 22.5 16.5, 22.5 17.4 L 22.5 18.4 C 22.5 19.3, 21.6 20.0, 20.5 20.0 L 5.5 20.0 Z'
const COVER_MID =
  'M 5.5 16.8 L 19.2 10.8 C 20.2 10.4, 21.2 10.9, 21.4 11.9 L 21.7 14.0 C 21.8 15.0, 21.0 15.9, 20.0 16.3 L 6.5 21.4 Z'
const COVER_OPEN =
  'M 5.5 17.5 L 16.5 6.5 C 17.3 5.7, 18.5 6.0, 18.8 7.0 L 19.5 9.5 C 19.8 10.5, 19.1 11.5, 18.2 11.8 L 7.5 22.5 Z'

// 4. Üst Kapak İç Astar Çizgisi
const LINING_CLOSED = 'M 8.5 17.8 L 19.5 17.8'
const LINING_MID = 'M 8.5 17.2 L 18.4 12.2'
const LINING_OPEN = 'M 8.5 16.5 L 16.5 8.5'

// 5. Havalanan İç Sayfalar (Kapalıyken sayfa bloğu içinde düz, açılırken 20° ve 32° süzülür)
const PAGE1_CLOSED = 'M 6.5 18.0 C 11.5 18.0, 16.5 18.0, 20.5 18.0'
const PAGE1_OPEN = 'M 6.5 17.5 C 11.5 15.8, 16.5 13.8, 21.0 12.0'

const PAGE2_CLOSED = 'M 6.5 18.0 C 11.0 18.0, 15.5 18.0, 20.0 18.0'
const PAGE2_OPEN = 'M 6.5 17.5 C 11.0 14.5, 15.5 11.0, 19.0 8.5'

// 6. Şerit Ayraç
const RIBBON_CLOSED = 'M 5.5 17.5 C 5.5 18.4, 6.1 19.0, 6.6 19.8'
const RIBBON_OPEN = 'M 5.5 17.5 C 5.5 20.0, 7.5 21.0, 8.5 23.5'

const SMOOTH_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

export const BookLogo: React.FC<BookLogoProps> = ({
  className = 'w-6 h-6',
  size,
  animated = true,
  isOpen: controlledIsOpen,
  openDelay = 0.12,
  duration = 0.72,
}) => {
  const [internalOpen, setInternalOpen] = useState(!animated)

  useEffect(() => {
    if (controlledIsOpen !== undefined) return
    if (!animated) {
      setInternalOpen(true)
      return
    }
    setInternalOpen(false)
    const timer = setTimeout(() => {
      setInternalOpen(true)
    }, Math.max(20, openDelay * 1000))
    return () => clearTimeout(timer)
  }, [animated, controlledIsOpen, openDelay])

  const open = controlledIsOpen !== undefined ? controlledIsOpen : internalOpen

  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={size ? { width: size, height: size } : undefined}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* 1. Alt Kısım / Taban Bloğu (Opak dolgu, gerçek defter tabanı) */}
      <path
        d="M 5.5 17.5 H 20.5 C 21.6 17.5, 22.5 18.4, 22.5 19.5 V 20 C 22.5 21.1, 21.6 22, 20.5 22 H 5.5 Z"
        fill="var(--primary-anthracite, #24211e)"
        stroke="var(--accent-color, #b99881)"
        strokeWidth="1.5"
      />

      {/* 2. Sayfa Bloğu Doku Çizgisi */}
      <path d="M 7.5 19.8 H 20" stroke="var(--accent-light, #d6beae)" strokeWidth="0.9" strokeOpacity="0.5" />

      {/* 3. Üst Kapak (Kapalı yatay durumdan 45° yukarıya dairesel yay ile açılır) */}
      <motion.path
        initial={{ d: animated ? COVER_CLOSED : COVER_OPEN }}
        animate={{
          d: open ? [COVER_CLOSED, COVER_MID, COVER_OPEN] : COVER_CLOSED,
        }}
        transition={{
          duration,
          ease: SMOOTH_EASE,
          times: open ? [0, 0.45, 1] : undefined,
        }}
        fill="var(--bg-base, #413f3d)"
        stroke="var(--accent-color, #b99881)"
        strokeWidth="1.5"
      />

      {/* 4. Üst Kapak İç Astar Çizgisi */}
      <motion.path
        initial={{ d: animated ? LINING_CLOSED : LINING_OPEN, strokeOpacity: animated ? 0.15 : 0.45 }}
        animate={{
          d: open ? [LINING_CLOSED, LINING_MID, LINING_OPEN] : LINING_CLOSED,
          strokeOpacity: open ? 0.45 : 0.15,
        }}
        transition={{
          duration,
          ease: SMOOTH_EASE,
          times: open ? [0, 0.45, 1] : undefined,
        }}
        stroke="var(--accent-color, #b99881)"
        strokeWidth="1"
      />

      {/* 5. Havalanan İç Sayfalar (Kapak açılırken kademeli olarak yukarı süzülür) */}
      <motion.path
        initial={{ d: animated ? PAGE1_CLOSED : PAGE1_OPEN, opacity: animated ? 0 : 1 }}
        animate={{
          d: open ? PAGE1_OPEN : PAGE1_CLOSED,
          opacity: open ? 1 : 0,
        }}
        transition={{
          duration: duration * 0.88,
          delay: open ? duration * 0.12 : 0,
          ease: SMOOTH_EASE,
        }}
        stroke="var(--accent-light, #d6beae)"
        strokeWidth="1.3"
      />
      <motion.path
        initial={{ d: animated ? PAGE2_CLOSED : PAGE2_OPEN, opacity: animated ? 0 : 0.65 }}
        animate={{
          d: open ? PAGE2_OPEN : PAGE2_CLOSED,
          opacity: open ? 0.65 : 0,
        }}
        transition={{
          duration: duration * 0.92,
          delay: open ? duration * 0.18 : 0,
          ease: SMOOTH_EASE,
        }}
        stroke="var(--accent-light, #d6beae)"
        strokeWidth="1"
      />

      {/* 6. Sol Cilt Sırtı & Şerit Ayraç */}
      <path d="M 5.5 16.5 V 22.5" stroke="var(--accent-color, #b99881)" strokeWidth="2.2" />
      <motion.path
        initial={{ d: animated ? RIBBON_CLOSED : RIBBON_OPEN, opacity: animated ? 0.4 : 1 }}
        animate={{
          d: open ? RIBBON_OPEN : RIBBON_CLOSED,
          opacity: open ? 1 : 0.4,
        }}
        transition={{
          duration: duration * 0.9,
          delay: open ? duration * 0.1 : 0,
          ease: SMOOTH_EASE,
        }}
        stroke="var(--accent-light, #d6beae)"
        strokeWidth="1.2"
      />
    </svg>
  )
}

export interface BrandLogoLockupProps {
  /** Size of the BookLogo in pixels (default: 24) */
  logoSize?: number
  /** Tailwind classes for the "Portföy" text */
  textClassName?: string
  /** Gap class between logo and text (default: 'gap-2') */
  gapClassName?: string
  /** Click handler (e.g., navigate to dashboard) */
  onClick?: () => void
  /** Initial delay before starting the sequence in seconds (default: 0.08) */
  initialDelay?: number
  /** Distance in px that the book starts shifted to the right before sliding left (default: 28) */
  slideDistance?: number
  /** Whether the sidebar is collapsed (slides "Portföy" text smoothly to the left and hides it) */
  collapsed?: boolean
}

/**
 * Koordineli Marka Logosu + "Portföy" Başlık Animasyonu:
 * 1. Kitap başta kapalıdır ve hafif sağda (merkezde) durur.
 * 2. Kitap kapağı ve sayfaları pürüzsüzce açılır.
 * 3. Kitap sola doğru kayarken, "Portföy" yazısı da kayarak yanına yerleşir.
 * 4. Sol bar daraltıldığında ("collapsed"), "Portföy" yazısı yumuşakça sola kayarak kaybolur.
 */
export const BrandLogoLockup: React.FC<BrandLogoLockupProps> = ({
  logoSize = 24,
  textClassName = 'font-the-seasons text-xl tracking-wide font-normal text-white group-hover:text-[#d6beae] transition-colors',
  gapClassName = 'gap-2.5',
  onClick,
  initialDelay = 0.08,
  slideDistance = 28,
  collapsed = false,
}) => {
  const [stage, setStage] = useState<'closed' | 'opening' | 'slid'>('closed')
  const [replayKey, setReplayKey] = useState(0)

  useEffect(() => {
    setStage('closed')
    const openTimer = setTimeout(() => {
      setStage('opening')
    }, initialDelay * 1000)

    const slideTimer = setTimeout(() => {
      setStage('slid')
    }, (initialDelay + 0.58) * 1000)

    return () => {
      clearTimeout(openTimer)
      clearTimeout(slideTimer)
    }
  }, [initialDelay, replayKey])

  const handleClick = () => {
    if (onClick) onClick()
  }

  const isBookOpen = stage === 'opening' || stage === 'slid'
  const hasSlid = stage === 'slid'
  const showText = hasSlid && !collapsed

  return (
    <div
      onClick={handleClick}
      onDoubleClick={() => setReplayKey((k) => k + 1)}
      className={`inline-flex items-center ${
        collapsed ? 'gap-0 justify-center w-full' : gapClassName
      } shrink-0 cursor-pointer select-none group transition-all duration-300`}
    >
      {/* Kitap Logosu: Önce kapalı -> açılır -> sola kayar */}
      <motion.div
        initial={{ x: slideDistance, opacity: 0, scale: 0.94 }}
        animate={{
          x: collapsed ? 0 : (hasSlid ? 0 : slideDistance),
          opacity: 1,
          scale: 1,
        }}
        transition={{
          x: { duration: 0.68, ease: SMOOTH_EASE },
          opacity: { duration: 0.32, ease: SMOOTH_EASE },
          scale: { duration: 0.42, ease: SMOOTH_EASE },
        }}
        className="flex items-center justify-center text-[#b99881] transition-transform group-hover:scale-105 relative z-10"
      >
        <BookLogo size={logoSize} isOpen={isBookOpen} duration={0.62} />
      </motion.div>

      {/* "Portföy" Yazısı: Kitap sola kayarken pürüzsüzce kayarak belirir, daraltıldığında sola kayarak gizlenir */}
      <motion.div
        initial={false}
        animate={{
          maxWidth: showText ? 120 : 0,
          opacity: showText ? 1 : 0,
        }}
        transition={{
          duration: 0.38,
          ease: SMOOTH_EASE,
        }}
        className="overflow-hidden flex items-center py-0.5"
      >
        <motion.span
          initial={{ x: -24, opacity: 0, filter: 'blur(0px)' }}
          animate={{
            x: showText ? 0 : -28,
            opacity: showText ? 1 : 0,
          }}
          transition={{
            duration: 0.38,
            ease: SMOOTH_EASE,
          }}
          className={`${textClassName} inline-block whitespace-nowrap`}
        >
          Portföy
        </motion.span>
      </motion.div>
    </div>
  )
}
