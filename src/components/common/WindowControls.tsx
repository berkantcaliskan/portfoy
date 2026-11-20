import React, { useState } from 'react'
import { GlassModal } from '@/components/ui/GlassModal'
import { GlassButton } from '@/components/ui/GlassButton'

export function WindowControls({ className = 'fixed top-3 right-3', compact = false }: { className?: string; compact?: boolean }) {
  const [confirmClose, setConfirmClose] = useState(false)
  const api = () => (window as any).electronAPI
  const circle = `${compact ? 'size-1.5 lg:size-2' : 'size-2.5'} shrink-0 rounded-full border border-black/15 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-color)]`
  return <>
    <div className={`${className} z-[80] flex items-center ${compact ? 'gap-0.5 lg:gap-1' : 'gap-1'} select-none`} style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      <button type="button" aria-label="Pencereyi aşağı indir" title="Pencereyi aşağı indir" className={`${circle} bg-[#f5b427]`}
        onClick={() => { if (api()?.minimize) api().minimize(); else if (document.fullscreenElement) void document.exitFullscreen?.() }} />
      <button type="button" aria-label="Pencereyi tam ekran yap veya küçült" title="Tam ekran / Küçült" className={`${circle} bg-[#35c75a]`}
        onClick={() => { if (api()?.maximize) api().maximize(); else if (document.fullscreenElement) void document.exitFullscreen?.(); else void document.documentElement.requestFullscreen?.().catch(() => {}) }} />
      <button type="button" aria-label="Uygulamayı kapat" title="Uygulamayı kapat" className={`${circle} bg-[#ff5f57]`} onClick={() => setConfirmClose(true)} />
    </div>
    <GlassModal isOpen={confirmClose} onClose={() => setConfirmClose(false)} title="Uygulamayı kapatıyorsunuz" maxWidth="sm">
      <p className="text-sm text-[var(--tertiary-white)]">Uygulamayı kapatmak istiyor musunuz?</p>
      <div className="mt-5 flex justify-end gap-2">
        <GlassButton size="sm" variant="subtle" onClick={() => setConfirmClose(false)}>Hayır</GlassButton>
        <GlassButton size="sm" variant="gold" onClick={() => { setConfirmClose(false); if (api()?.close) api().close(); else window.close() }}>Evet</GlassButton>
      </div>
    </GlassModal>
  </>
}
