import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import './IdleScreenSaver.css'

const idleDelayMs = 10 * 60 * 1000

export function IdleScreenSaver() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let lastActivity = Date.now()
    let sleeping = false
    let swallowClick = false
    let timer: number

    function checkIdle() {
      const remaining = idleDelayMs - (Date.now() - lastActivity)
      if (remaining > 0) {
        timer = window.setTimeout(checkIdle, remaining)
        return
      }
      sleeping = true
      setVisible(true)
    }

    function onActivity(event: Event) {
      lastActivity = Date.now()
      if (event.type === 'pointerdown') swallowClick = sleeping
      if (!sleeping) return

      if (event.type !== 'pointermove') {
        event.preventDefault()
        event.stopImmediatePropagation()
      }
      sleeping = false
      setVisible(false)
      timer = window.setTimeout(checkIdle, idleDelayMs)
    }

    function onClick(event: MouseEvent) {
      if (!swallowClick) return
      swallowClick = false
      event.preventDefault()
      event.stopImmediatePropagation()
    }

    const events = ['pointermove', 'pointerdown', 'keydown', 'wheel'] as const
    for (const event of events) window.addEventListener(event, onActivity, { capture: true, passive: false })
    window.addEventListener('click', onClick, true)
    timer = window.setTimeout(checkIdle, idleDelayMs)

    return () => {
      window.clearTimeout(timer)
      for (const event of events) window.removeEventListener(event, onActivity, true)
      window.removeEventListener('click', onClick, true)
    }
  }, [])

  if (!visible) return null

  return createPortal(
    <div className="idle-screensaver" role="status" aria-label="Ekran koruyucu etkin">
      <div className="idle-screensaver-expression" aria-hidden="true">
        <div className="idle-screensaver-eyes">
          <span className="idle-screensaver-eye"><span className="idle-screensaver-pupil" /></span>
          <span className="idle-screensaver-eye"><span className="idle-screensaver-pupil" /></span>
        </div>
        <span className="idle-screensaver-mouth" />
        <div className="idle-screensaver-dream">
          <span>z</span><span>z</span><span>z</span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
