import React from 'react'

// Window Controls (Sağ alt köşede dikey konumlanan minimal sarı & kırmızı daire pencere kontrolleri)
export const WindowControls: React.FC = () => {
  const handleMinimize = () => {
    const api = (window as any).electronAPI
    if (api?.minimize) {
      api.minimize()
    } else if (document.fullscreenElement) {
      document.exitFullscreen?.()
    }
  }

  const handleClose = () => {
    const api = (window as any).electronAPI
    if (api?.close) {
      api.close()
    } else {
      // Browser fallback
      if (window.confirm('Uygulamayı kapatmak istediğinize emin misiniz?')) {
        window.close()
      }
    }
  }

  return (
    <div
      className="fixed bottom-2.5 right-1.5 z-50 flex flex-col items-center gap-1.5 p-1 rounded-full bg-[#e3e5e1]/90 border border-[#292d2b]/12 shadow-sm select-none [app-region:no-drag]"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      {/* 1. Üstteki: Sarı Daire — Pencereyi Aşağı İndir (Küçült) */}
      <button
        type="button"
        onClick={handleMinimize}
        title="Pencereyi Aşağı İndir"
        className="w-3 h-3 rounded-full bg-[#f5b427] hover:bg-[#e09f15] border border-black/10 transition-transform hover:scale-110 active:scale-95 cursor-pointer"
      />

      {/* 2. Alttaki: Kırmızı Daire — Kapat */}
      <button
        type="button"
        onClick={handleClose}
        title="Kapat"
        className="w-3 h-3 rounded-full bg-[#ff5f57] hover:bg-[#e04840] border border-black/10 transition-transform hover:scale-110 active:scale-95 cursor-pointer"
      />
    </div>
  )
}

