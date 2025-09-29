import './App.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import ClockDisplay from './components/ClockDisplay'

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [panelHover, setPanelHover] = useState(false)
  const [appHover, setAppHover] = useState(false)
  const backdropVideoRef = useRef<HTMLVideoElement | null>(null)

  const handleClose = useCallback(() => {
    window.electronAPI?.closeWindow()
  }, [])

  const handleMenuFocus = useCallback(() => {
    window.electronAPI?.setIgnoreMouseEvents?.(false).catch(() => {})
  }, [])

  const toggleMenu = useCallback(() => {
    setMenuOpen((prev) => {
      const next = !prev
      const apiSetter = window.electronAPI?.setIgnoreMouseEvents
      if (apiSetter) {
        void apiSetter(!next).catch(() => {})
      }
      if (!next) {
        setPanelHover(false)
      }
      return next
    })
  }, [])

  useEffect(() => {
    const api = window.electronAPI
    if (!api?.setIgnoreMouseEvents || !api?.getPassThroughEnabled) {
      return
    }

    const { setIgnoreMouseEvents, getPassThroughEnabled } = api

    if (!setIgnoreMouseEvents || !getPassThroughEnabled) {
      return
    }
    let disposed = false

    getPassThroughEnabled()
      .then((enabled) => {
        if (disposed) return
        if (!enabled) {
          void setIgnoreMouseEvents(false).catch(() => {})
        }
      })
      .catch(() => {
        void setIgnoreMouseEvents(false).catch(() => {})
      })

    return () => {
      disposed = true
      void setIgnoreMouseEvents(false).catch(() => {})
    }
  }, [])

  useEffect(() => {
    const video = backdropVideoRef.current
    if (video) {
      video.playbackRate = 1
    }
  }, [])

  useEffect(() => {
    const handlePointerOut = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.relatedTarget === null) {
        setAppHover(false)
      }
    }

    window.addEventListener('pointerout', handlePointerOut)

    return () => {
      window.removeEventListener('pointerout', handlePointerOut)
    }
  }, [])

  return (
    <div className="hover-shell">
      <div
        className="app-root"
        data-panel-hover={panelHover ? 'true' : 'false'}
        data-app-hover={appHover ? 'true' : 'false'}
        data-menu-open={menuOpen ? 'true' : 'false'}
        onPointerEnter={() => setAppHover(true)}
        onPointerLeave={() => setAppHover(false)}
      >
      <div className="chrome-layer" data-area="chrome">
        <div
          className={`top-panel ${menuOpen ? 'is-open' : ''}`}
          data-open={menuOpen ? 'true' : 'false'}
          onMouseEnter={() => setPanelHover(true)}
          onMouseLeave={() => setPanelHover(false)}
        >
          <button className="top-panel-button drag-button" type="button" aria-label="Drag window">
            <span className="material-symbols-rounded" aria-hidden="true">
              arrows_output
            </span>
          </button>
          <button
            className="top-panel-button close-button"
            type="button"
            onClick={handleClose}
            aria-label="Close window"
          >
            X
          </button>
        </div>
        <div className="menu-toggle">
          <button
            className="menu-button"
            type="button"
            onClick={toggleMenu}
            onMouseEnter={handleMenuFocus}
            onFocus={handleMenuFocus}
            aria-label="Toggle menu"
          >
            ≡
          </button>
        </div>
      </div>
      <div className="app-shell" data-area="main">
        <div className="app-backdrop" aria-hidden="true">
          <video
            className="backdrop-video"
            src="media/stars.mp4"
            autoPlay
            muted
            loop
            playsInline
            ref={backdropVideoRef}
          />
          <div className="backdrop-overlay" />
        </div>
        <div className="app-content">
          <ClockDisplay />
        </div>
      </div>
    </div>
    </div>
  )
}

export default App
