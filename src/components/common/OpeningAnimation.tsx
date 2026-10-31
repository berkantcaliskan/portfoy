import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { BookLogo } from './BookLogo'

interface OpeningAnimationProps {
  onComplete: () => void
}

const SMOOTH_SLIDE_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

/**
 * Uygulama Açılış Animasyonu (Splash Intro):
 * 1. Başta ekranın tam ortasında kapalı bir kitap yer alır.
 * 2. Kitap kapağı 45° yukarı doğru açılır ve iç sayfalar süzülerek havalanır.
 * 3. Açılan kitap pürüzsüzce sola doğru kayar (smooth slide).
 * 4. Kitap sola kayarken yanından "Portföy" yazısı kayarak (smooth slide) gelir ve merkezde dengelenir.
 */
export const OpeningAnimation: React.FC<OpeningAnimationProps> = ({ onComplete }) => {
  const [stage, setStage] = useState<'closed' | 'opening' | 'sliding'>('closed')
  const textMeasureRef = useRef<HTMLDivElement>(null)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const [centerOffset, setCenterOffset] = useState<number>(88)

  // "Portföy" metninin genişliğini ölçerek kitabın başlangıçta ekranın tam ortasında durmasını sağla
  useLayoutEffect(() => {
    const measure = () => {
      if (textMeasureRef.current) {
        const w = textMeasureRef.current.offsetWidth
        const gap = 20 // gap-5 = 20px
        if (w > 0) {
          setCenterOffset(Math.round((w + gap) / 2))
        }
      }
    }
    measure()
    if (document.fonts) {
      document.fonts.ready.then(measure)
    }
  }, [])

  useEffect(() => {
    // 1. Aşama: Kısa bir belirmeden sonra kitap açılmaya başlar
    const openTimer = setTimeout(() => {
      setStage('opening')
    }, 150)

    // 2. Aşama: Kitap açıldıktan sonra sola kayar ve "Portföy" yazısı kayarak gelir
    const slideTimer = setTimeout(() => {
      setStage('sliding')
    }, 650)

    // 3. Aşama: Animasyon tamamlanır ve ana ekrana pürüzsüz geçiş yapılır
    const doneTimer = setTimeout(() => {
      onCompleteRef.current()
    }, 1500)

    return () => {
      clearTimeout(openTimer)
      clearTimeout(slideTimer)
      clearTimeout(doneTimer)
    }
  }, [])

  const isBookOpen = stage === 'opening' || stage === 'sliding'
  const isSliding = stage === 'sliding'

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{
        opacity: 0,
        scale: 1.02,
        transition: { duration: 0.48, ease: SMOOTH_SLIDE_EASE },
      }}
      onClick={onComplete}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#f5f5f2] text-[#292d2b] select-none overflow-hidden cursor-pointer"
    >
      {/* Arka Plan Kurumsal Işıltı */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: isSliding ? 0.9 : 0.55, scale: isSliding ? 1.08 : 1 }}
        transition={{ duration: 1.2, ease: SMOOTH_SLIDE_EASE }}
        className="absolute w-[520px] h-[520px] rounded-full bg-[#657a72]/12 blur-[130px] pointer-events-none"
      />

      {/* Ana Animasyon Sahnesi: Kitap + Portföy Yazısı */}
      <div className="relative z-10 flex items-center gap-5 px-6">
        {/* Kitap Logosu: Başta kapalı ve tam ortada -> Açılır -> Sola kayar */}
        <motion.div
          initial={{ x: centerOffset, opacity: 0, scale: 0.88 }}
          animate={{
            x: isSliding ? 0 : centerOffset,
            opacity: 1,
            scale: 1,
          }}
          transition={{
            x: { duration: 0.82, ease: SMOOTH_SLIDE_EASE },
            opacity: { duration: 0.35, ease: SMOOTH_SLIDE_EASE },
            scale: { duration: 0.48, ease: SMOOTH_SLIDE_EASE },
          }}
          className="flex items-center justify-center text-[#657a72] relative z-20 shrink-0"
        >
          <BookLogo size={64} isOpen={isBookOpen} duration={0.68} />
        </motion.div>

        {/* "Portföy" Yazısı: Kitap sola kayarken pürüzsüzce kayarak (smooth slide) gelir */}
        <div
          ref={textMeasureRef}
          className="overflow-hidden flex flex-col justify-center py-2 relative z-10"
        >
          <motion.span
            initial={{ x: -42, opacity: 0 }}
            animate={{
              x: isSliding ? 0 : -42,
              opacity: isSliding ? 1 : 0,
            }}
            transition={{
              x: { duration: 0.82, delay: isSliding ? 0.04 : 0, ease: SMOOTH_SLIDE_EASE },
              opacity: { duration: 0.68, delay: isSliding ? 0.06 : 0, ease: SMOOTH_SLIDE_EASE },
            }}
            className="font-the-seasons text-4xl sm:text-5xl tracking-wide font-normal text-[#292d2b] whitespace-nowrap leading-none"
          >
            Portföy
          </motion.span>

          {/* Alt Vurgu Çizgisi: Yazı ile birlikte soldan sağa doğru zarifçe kayar */}
          <motion.div
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{
              scaleX: isSliding ? 1 : 0,
              opacity: isSliding ? 0.65 : 0,
            }}
            transition={{
              duration: 0.78,
              delay: isSliding ? 0.14 : 0,
              ease: SMOOTH_SLIDE_EASE,
            }}
            style={{ transformOrigin: 'left center' }}
            className="h-[1.5px] w-full bg-gradient-to-r from-[#657a72] via-[#657a72]/50 to-transparent mt-2 rounded-full"
          />
        </div>
      </div>
    </motion.div>
  )
}
