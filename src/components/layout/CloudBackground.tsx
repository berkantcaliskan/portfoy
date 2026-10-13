import React from 'react'

export const CloudBackground: React.FC = () => {
  return (
    <div
      className="absolute inset-0 w-full min-h-full pointer-events-none z-0 overflow-hidden select-none"
      aria-hidden="true"
      style={{
        backgroundColor: '#1e1915',
      }}
    >
      {/* 
        1. BİRİNCİ EKRAN: DİNGİN ÜST ALAN & ALT BÖLGEDE ZARİF iCLOUD/ONEDRIVE BULUTLARI
        Yapay fırça lekesi veya çirkin kil yumrusu olmadan, pürüzsüz ve hacimli modern bulutlar.
      */}
      <div className="absolute top-0 left-0 right-0 w-full h-[1080px] overflow-hidden">
        <img
          src="/backgrounds/icloud-clouds.jpg"
          alt=""
          className="w-full h-full object-cover object-center"
        />
        {/* Alt kısımda yumuşakça koyu sıcak tona bağlanan geçiş (kesintisiz tek parça hissi) */}
        <div 
          className="absolute bottom-0 left-0 right-0 h-56 bg-gradient-to-b from-transparent via-[#1e1915]/70 to-[#1e1915]"
        />
      </div>

      {/* 
        2. AŞAĞI KAYDIRMA (SCROLL) UZANTISI:
        Sayfa aşağı kaydırıldığında 16:9 tekrarı olmadan, organik olarak yeni bulut formasyonları
        ile tek bir derin gökyüzü gibi kesintisiz devam eder.
      */}
      <div className="absolute top-[980px] left-0 right-0 w-full h-[1100px] overflow-hidden opacity-60">
        <img
          src="/backgrounds/icloud-clouds.jpg"
          alt=""
          className="w-full h-full object-cover object-bottom transform -scale-x-100"
        />
        <div 
          className="absolute top-0 left-0 right-0 h-48 bg-gradient-to-b from-[#1e1915] to-transparent"
        />
        <div 
          className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-b from-transparent to-[#1e1915]"
        />
      </div>

      {/* 3. SONSUZ DERİN SICAK TABAN */}
      <div
        className="w-full absolute top-[2080px] bottom-0"
        style={{
          background: 'linear-gradient(180deg, #1e1915 0%, #191512 50%, #14110f 100%)',
        }}
      />
    </div>
  )
}
