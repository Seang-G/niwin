import './App.css'
import { useCallback, useEffect, useState } from 'react'
import ClockDisplay from './components/ClockDisplay'

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [mainHover, setMainHover] = useState(false)
  const [panelHover, setPanelHover] = useState(false)

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

  return (
    <div
      className="app-root"
      data-main-hover={mainHover ? 'true' : 'false'}
      data-panel-hover={panelHover ? 'true' : 'false'}
      data-menu-open={menuOpen ? 'true' : 'false'}
    >
      <div className="chrome-layer" data-area="chrome">
        <div
          className={`top-panel ${menuOpen ? 'is-open' : ''}`}
          data-open={menuOpen ? 'true' : 'false'}
          onMouseEnter={() => setPanelHover(true)}
          onMouseLeave={() => setPanelHover(false)}
        >
          <button className="top-panel-button drag-button" type="button" aria-label="Drag window">
            ⇕
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
      <div
        className="app-shell"
        data-area="main"
        onMouseEnter={() => setMainHover(true)}
        onMouseLeave={() => setMainHover(false)}
      >
        <div className="app-backdrop" aria-hidden="true" />
        <div className="app-content">
          <ClockDisplay />
        </div>
      </div>
    </div>
  )
}

export default App
