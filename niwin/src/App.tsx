import './App.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import ClockDisplay from './components/ClockDisplay'

const parseYouTubeVideoId = (value: string): string | null => {
  const trimmed = value.trim()
  if (trimmed.length === 0) return null

  const urlMatch = trimmed.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/i,
  )
  if (urlMatch?.[1]) {
    return urlMatch[1]
  }

  const directId = trimmed.match(/^[\w-]{11}$/)
  if (directId?.[0]) {
    return directId[0]
  }

  const searchParamsMatch = trimmed.match(/v=([\w-]{11})/)
  if (searchParamsMatch?.[1]) {
    return searchParamsMatch[1]
  }

  return null
}

declare global {
  interface Window {
    YT?: any
    onYouTubeIframeAPIReady?: () => void
  }
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [panelHover, setPanelHover] = useState(false)
  const [appHover, setAppHover] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null)
  const [currentTitle, setCurrentTitle] = useState('')
  const backdropVideoRef = useRef<HTMLVideoElement | null>(null)
  const youtubeContainerRef = useRef<HTMLDivElement | null>(null)
  const playerRef = useRef<any>(null)
  const lastPlaybackRef = useRef<{ videoId: string | null; time: number }>({
    videoId: null,
    time: 0,
  })
  const [youTubeReady, setYouTubeReady] = useState(false)
  const resizeSessionRef = useRef<
    | {
        pointerId: number
        originX: number
        bottomEdge: number
        ready: boolean
      }
    | null
  >(null)
  const pendingResizeRef = useRef<{
    x: number
    y: number
    width: number
    height: number
  } | null>(null)
  const resizeRafRef = useRef<number | null>(null)

  const MIN_WINDOW_WIDTH = 200
  const MIN_WINDOW_HEIGHT = 130

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

  const flushPendingResize = useCallback(() => {
    const payload = pendingResizeRef.current
    if (!payload) return
    pendingResizeRef.current = null
    void window.electronAPI?.setWindowBounds?.(payload)
  }, [])

  const scheduleResizeFlush = useCallback(() => {
    if (typeof window === 'undefined') return
    if (resizeRafRef.current !== null) return
    resizeRafRef.current = window.requestAnimationFrame(() => {
      resizeRafRef.current = null
      flushPendingResize()
    })
  }, [flushPendingResize])

  useEffect(() => {
    return () => {
      if (typeof window === 'undefined') return
      if (resizeRafRef.current !== null) {
        window.cancelAnimationFrame(resizeRafRef.current)
        resizeRafRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (window.YT && window.YT.Player) {
      setYouTubeReady(true)
      return
    }

    const previousHandler = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previousHandler?.()
      setYouTubeReady(true)
    }

    if (!document.querySelector('script[data-youtube-api]')) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      tag.async = true
      tag.dataset.youtubeApi = 'true'
      document.head.appendChild(tag)
    } else if (window.YT && window.YT.Player) {
      setYouTubeReady(true)
    }

    return () => {
      window.onYouTubeIframeAPIReady = previousHandler
    }
  }, [])

  useEffect(() => {
    if (!youTubeReady) return
    if (playerRef.current) return
    if (!youtubeContainerRef.current) return
    if (!(window.YT && window.YT.Player)) return

    playerRef.current = new window.YT.Player(youtubeContainerRef.current, {
      height: '1',
      width: '1',
      videoId: activeVideoId ?? 'M7lc1UVf-VE',
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        rel: 0,
        playsinline: 1,
        modestbranding: 1,
        loop: 1,
        origin: window.location.origin,
      },
      events: {
        onReady: () => {
          if (!activeVideoId) {
            playerRef.current?.stopVideo?.()
          } else {
            const { videoId, time } = lastPlaybackRef.current
            const startSeconds = videoId === activeVideoId ? time : 0
            playerRef.current?.loadVideoById?.({ videoId: activeVideoId, startSeconds })
            playerRef.current?.playVideo?.()
          }
        },
        onStateChange: (event: any) => {
          const player = playerRef.current
          if (!player || !(window.YT && window.YT.PlayerState)) {
            return
          }
          const currentId = activeVideoId ?? lastPlaybackRef.current.videoId
          const state = event.data

          if (
            state === window.YT.PlayerState.PAUSED ||
            state === window.YT.PlayerState.BUFFERING
          ) {
            if (currentId && typeof player.getCurrentTime === 'function') {
              lastPlaybackRef.current = {
                videoId: currentId,
                time: player.getCurrentTime() ?? lastPlaybackRef.current.time ?? 0,
              }
            }
          }

          if (state === window.YT.PlayerState.PLAYING) {
            const data = player.getVideoData?.()
            if (data?.title) {
              setCurrentTitle(data.title)
            }
          }

          if (state === window.YT.PlayerState.ENDED) {
            if (currentId) {
              lastPlaybackRef.current = { videoId: currentId, time: 0 }
            }
            setActiveVideoId(null)
            setCurrentTitle('')
          }
        },
      },
    })

    return () => {
      playerRef.current?.destroy?.()
      playerRef.current = null
    }
  }, [youTubeReady])

  useEffect(() => {
    const player = playerRef.current
    if (!youTubeReady || !player) return

    if (activeVideoId) {
      const { videoId: lastId, time } = lastPlaybackRef.current
      const startSeconds = lastId === activeVideoId ? time : 0
      lastPlaybackRef.current = { videoId: activeVideoId, time: startSeconds }
      player.unMute?.()
      if (lastId !== activeVideoId) {
        setCurrentTitle('')
      }
      player.loadVideoById?.({ videoId: activeVideoId, startSeconds })
      player.playVideo?.()
    } else {
      if (typeof player.getCurrentTime === 'function') {
        const currentTime = player.getCurrentTime() ?? lastPlaybackRef.current.time ?? 0
        if (lastPlaybackRef.current.videoId) {
          lastPlaybackRef.current = {
            videoId: lastPlaybackRef.current.videoId,
            time: currentTime,
          }
        }
      }
      player.pauseVideo?.()
      setCurrentTitle('')
    }
  }, [activeVideoId, youTubeReady])

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

  const handleToggleAudio = useCallback(() => {
    const player = playerRef.current

    if (activeVideoId) {
      if (player && typeof player.getCurrentTime === 'function') {
        const currentTime = player.getCurrentTime() ?? 0
        lastPlaybackRef.current = { videoId: activeVideoId, time: currentTime }
        player.pauseVideo?.()
      }
      setActiveVideoId(null)
      setCurrentTitle('')
      return
    }

    const nextVideoId = parseYouTubeVideoId(searchQuery)
    if (!nextVideoId) {
      lastPlaybackRef.current = { videoId: null, time: 0 }
      setActiveVideoId(null)
      setCurrentTitle('')
      return
    }

    if (lastPlaybackRef.current.videoId !== nextVideoId) {
      lastPlaybackRef.current = { videoId: nextVideoId, time: 0 }
      setCurrentTitle('')
    }

    setActiveVideoId(nextVideoId)
  }, [activeVideoId, searchQuery])

  const handleResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return
      if (!window.electronAPI?.getWindowBounds || !window.electronAPI?.setWindowBounds) {
        return
      }

      event.preventDefault()
      const button = event.currentTarget
      const pointerId = event.pointerId
      button.setPointerCapture(pointerId)
      pendingResizeRef.current = null
      resizeSessionRef.current = {
        pointerId,
        originX: 0,
        bottomEdge: 0,
        ready: false,
      }

      window.electronAPI
        .getWindowBounds?.()
        .then((bounds) => {
          if (!bounds) {
            if (button.hasPointerCapture(pointerId)) {
              button.releasePointerCapture(pointerId)
            }
            if (resizeSessionRef.current?.pointerId === pointerId) {
              resizeSessionRef.current = null
            }
            return
          }

          if (resizeSessionRef.current?.pointerId !== pointerId) {
            return
          }

          resizeSessionRef.current = {
            pointerId,
            originX: bounds.x,
            bottomEdge: bounds.y + bounds.height,
            ready: true,
          }
        })
        .catch(() => {
          if (button.hasPointerCapture(pointerId)) {
            button.releasePointerCapture(pointerId)
          }
          if (resizeSessionRef.current?.pointerId === pointerId) {
            resizeSessionRef.current = null
          }
        })
    },
    [],
  )

  const handleResizePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const session = resizeSessionRef.current
      if (!session || !session.ready || session.pointerId !== event.pointerId) {
        return
      }

      event.preventDefault()

      const rawWidth = event.screenX - session.originX
      const rawHeight = session.bottomEdge - event.screenY
      const nextWidth = Math.max(MIN_WINDOW_WIDTH, rawWidth)
      const nextHeight = Math.max(MIN_WINDOW_HEIGHT, rawHeight)
      const nextY = session.bottomEdge - nextHeight

      pendingResizeRef.current = {
        x: session.originX,
        y: nextY,
        width: nextWidth,
        height: nextHeight,
      }
      scheduleResizeFlush()
    },
    [MIN_WINDOW_HEIGHT, MIN_WINDOW_WIDTH, scheduleResizeFlush],
  )

  const clearResizeSession = useCallback(
    (pointerId: number, button: HTMLButtonElement | null) => {
      if (button && button.hasPointerCapture(pointerId)) {
        button.releasePointerCapture(pointerId)
      }
      if (resizeSessionRef.current?.pointerId === pointerId) {
        resizeSessionRef.current = null
      }
      if (pendingResizeRef.current) {
        flushPendingResize()
      }
      pendingResizeRef.current = null
    },
    [flushPendingResize],
  )

  const handleResizePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      clearResizeSession(event.pointerId, event.currentTarget)
    },
    [clearResizeSession],
  )

  const handleResizePointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      clearResizeSession(event.pointerId, event.currentTarget)
    },
    [clearResizeSession],
  )

  const handleResizePointerCaptureLost = useCallback(
    (_event: ReactPointerEvent<HTMLButtonElement>) => {
      resizeSessionRef.current = null
      if (pendingResizeRef.current) {
        flushPendingResize()
      }
      pendingResizeRef.current = null
    },
    [flushPendingResize],
  )

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
        <div className="top-panel-wrapper" aria-hidden="false">
          <div
            className={`top-panel ${menuOpen ? 'is-open' : ''}`}
            data-open={menuOpen ? 'true' : 'false'}
            onMouseEnter={() => setPanelHover(true)}
            onMouseLeave={() => setPanelHover(false)}
          >
          <div className="top-panel-input-group">
            <input
              className="top-panel-input"
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  handleToggleAudio()
                }
              }}
            />
            <button className="top-panel-button action-button" type="button" onClick={handleToggleAudio}>
              {activeVideoId ? 'Stop' : 'Go'}
            </button>
            {currentTitle ? (
              <span className="top-panel-track-title" title={currentTitle}>
                {currentTitle}
              </span>
            ) : null}
          </div>
          <button
            className="top-panel-button close-button"
            type="button"
            onClick={handleClose}
            aria-label="Close window"
          >
            X
          </button>
          </div>
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
        <div className="resize-toggle">
          <button
            className="top-panel-button resize-button"
            type="button"
            aria-label="Resize window"
            onPointerDown={handleResizePointerDown}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            onPointerCancel={handleResizePointerCancel}
            onLostPointerCapture={handleResizePointerCaptureLost}
          >
            <span className="material-symbols-rounded" aria-hidden="true">
              open_in_full
            </span>
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
          <div ref={youtubeContainerRef} className="youtube-audio-container" aria-hidden="true" />
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
