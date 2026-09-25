import React from 'react'

interface BookLogoProps {
  className?: string
  size?: number
}

export const BookLogo: React.FC<BookLogoProps> = ({ className = 'w-6 h-6', size }) => {
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
      {/* 
        Sağa Açılan, Tam 45 Derece Açılı Lüks Defter Logosu:
        - 180° tam açık kitap değil; kapakları arasında tam 45° açı bulunan lüks defter formundadır.
        - Alt tarafta kalan kısım (alt kapak ve zemin) opak gövdeyle temizdir; altından veya arkasından hiçbir gereksiz çizgi sarkmaz.
        - Köşeler yumuşak ve yuvarlatılmıştır (rounded).
        - Sol tarafta cilt omurgası ve zarif altın ayraç, sağa doğru 45° açılan üst kapak ve süzülen iç sayfalar.
      */}

      {/* 1. Alt Kısım / Taban Bloğu (Opak dolgu, altından çizgi sarkmaz, gerçek defter tabanı) */}
      <path 
        d="M 5.5 17.5 H 20.5 C 21.6 17.5, 22.5 18.4, 22.5 19.5 V 20 C 22.5 21.1, 21.6 22, 20.5 22 H 5.5 Z" 
        fill="#24211e" 
        stroke="#b99881" 
        strokeWidth="1.5" 
      />
      
      {/* 2. Sayfa Bloğu Doku Çizgisi */}
      <path d="M 7.5 19.8 H 20" stroke="#d6beae" strokeWidth="0.9" strokeOpacity="0.5" />

      {/* 3. Üst Kapak (Spine Hinge'den Tam 45 Derece Yukarı Açık, Yuvarlatılmış Köşeler) */}
      <path 
        d="M 5.5 17.5 L 16.5 6.5 C 17.3 5.7, 18.5 6, 18.8 7 L 19.5 9.5 C 19.8 10.5, 19.1 11.5, 18.2 11.8 L 7.5 22.5 Z" 
        fill="#34302d" 
        stroke="#b99881" 
        strokeWidth="1.5" 
      />
      
      {/* 4. Üst Kapak İç Astar Çizgisi */}
      <path d="M 8.5 16.5 L 16.5 8.5" stroke="#b99881" strokeWidth="1" strokeOpacity="0.45" />

      {/* 5. Havalanan İç Sayfalar (45° Açıklık İçinde Süzülen 20° ve 32° Sayfalar) */}
      <path d="M 6.5 17.5 C 11.5 15.8, 16.5 13.8, 21 12" stroke="#d6beae" strokeWidth="1.3" />
      <path d="M 6.5 17.5 C 11 14.5, 15.5 11, 19 8.5" stroke="#d6beae" strokeWidth="1" strokeOpacity="0.65" />

      {/* 6. Sol Cilt Sırtı & Şerit Ayraç */}
      <path d="M 5.5 16.5 V 22.5" stroke="#b99881" strokeWidth="2.2" />
      <path d="M 5.5 17.5 C 5.5 20, 7.5 21, 8.5 23.5" stroke="#d6beae" strokeWidth="1.2" />
    </svg>
  )
}
