import React, { useState, useEffect } from 'react'
import { Minus, Square, Copy, X } from 'lucide-react'

// Window Controls (Ultra-compact, frameless window control buttons)
export const WindowControls: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    const api = (window as any).electronAPI
    if (api) {
      api.isMaximized?.().then?.((max: boolean) => setIsMaximized(Boolean(max)))
      const cleanup = api.onMaximizeChange?.((max: boolean) => setIsMaximized(Boolean(max)))
      return () => {
        if (typeof cleanup === 'function') cleanup()
      }
    }
  }, [])

  const handleMinimize = () => {
    const api = (window as any).electronAPI
    if (api?.minimize) {
      api.minimize()
    }
  }

  const handleMaximize = () => {
    const api = (window as any).electronAPI
    if (api?.maximize) {
      api.maximize()
    } else {
      // Fallback for browser testing: Toggle fullscreen
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.()
        setIsMaximized(true)
      } else {
        document.exitFullscreen?.()
        setIsMaximized(false)
      }
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
      className="flex items-center select-none [app-region:no-drag] shrink-0 h-full"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      {/* 1. Soldaki: Küçült */}
      <button
        type="button"
        onClick={handleMinimize}
        title="Küçült"
        className="w-11 h-full flex items-center justify-center text-[#a69f99] hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors cursor-pointer"
      >
        <Minus className="w-3 h-3 stroke-[2]" />
      </button>

      {/* 2. Ortadaki: Büyüt / Önceki Boyut */}
      <button
        type="button"
        onClick={handleMaximize}
        title={isMaximized ? 'Önceki Boyut' : 'Tam Ekran'}
        className="w-11 h-full flex items-center justify-center text-[#a69f99] hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors cursor-pointer"
      >
        {isMaximized ? (
          <Copy className="w-3 h-3 stroke-[2]" />
        ) : (
          <Square className="w-3 h-3 stroke-[2]" />
        )}
      </button>

      {/* 3. Sağdaki: Kapat */}
      <button
        type="button"
        onClick={handleClose}
        title="Kapat"
        className="w-12 h-full flex items-center justify-center text-[#a69f99] hover:text-white hover:bg-[#e81123] active:bg-[#c4101e] transition-colors cursor-pointer"
      >
        <X className="w-3.5 h-3.5 stroke-[2]" />
      </button>
    </div>
  )
}
