import './App.css'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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

type DragSession = {
  pointerId: number
  offsetX: number
  offsetY: number
  startX: number
  startY: number
  dragging: boolean
}

type ResizeSession = {
  pointerId: number
  startX: number
  startY: number
  startWidth: number
  startHeight: number
  startLeft: number
  startBottom: number
}

const DEFAULT_WIDTH = 400
const DEFAULT_HEIGHT = 200
const MIN_WIDTH = 200
const MIN_HEIGHT = 160

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null)
  const [currentTitle, setCurrentTitle] = useState('')
  const [youTubeReady, setYouTubeReady] = useState(false)
  const [volume, setVolume] = useState(70)
  const [muted, setMuted] = useState(false)
  const [playerError, setPlayerError] = useState<string | null>(null)
  const [appHover, setAppHover] = useState(false)
  const [chromeHover, setChromeHover] = useState(false)
  const [controlsHidden, setControlsHidden] = useState(false)
  const [chromeHeight, setChromeHeight] = useState(0)

  const backdropVideoRef = useRef<HTMLVideoElement | null>(null)
  const youtubeContainerRef = useRef<HTMLDivElement | null>(null)
  const playerRef = useRef<YouTubePlayer | null>(null)
  const lastPlaybackRef = useRef<{ videoId: string | null; time: number }>({ videoId: null, time: 0 })
  const appRootRef = useRef<HTMLDivElement | null>(null)
  const appChromeRef = useRef<HTMLDivElement | null>(null)
  const hoverShellRef = useRef<HTMLDivElement | null>(null)
  const dragSessionRef = useRef<DragSession | null>(null)
  const resizeSessionRef = useRef<ResizeSession | null>(null)
  const volumeRef = useRef(volume)
  const mutedRef = useRef(muted)
  const initialPositionSetRef = useRef(false)

  const [appPosition, setAppPosition] = useState({ x: 0, y: 0 })

  const [appSize, setAppSize] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT })

  useEffect(() => {
    volumeRef.current = volume
  }, [volume])

  useEffect(() => {
    mutedRef.current = muted
  }, [muted])

  const applyIgnoreMouseEvents = useCallback((shouldIgnore: boolean) => {
    if (shouldIgnore) {
      setAppHover(false)
      setChromeHover(false)
    }
    const setter = window.electronAPI?.setIgnoreMouseEvents
    if (typeof setter === 'function') {
      try {
        const result = setter(shouldIgnore, { forward: true })
        if (result && typeof (result as Promise<void>).catch === 'function') {
          ;(result as Promise<void>).catch(() => {})
        }
      } catch {
        // ignore
      }
    }
  }, [])

  const syncPassThroughForPoint = useCallback(() => {
    applyIgnoreMouseEvents(false)
  }, [applyIgnoreMouseEvents])

  const handleMenuFocus = useCallback(() => {
    applyIgnoreMouseEvents(false)
  }, [applyIgnoreMouseEvents])

  const toggleMenu = useCallback(() => {
    setMenuOpen((prev) => !prev)
  }, [])

  const handleMenuPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      applyIgnoreMouseEvents(false)
    },
    [applyIgnoreMouseEvents],
  )

  const clampPosition = useCallback(
    (x: number, y: number) => {
      if (typeof window === 'undefined') {
        return { x, y }
      }
      const root = appRootRef.current
      const width = root?.offsetWidth ?? appSize.width
      const height = root?.offsetHeight ?? appSize.height
      const maxX = Math.max(window.innerWidth - width, 0)
      const maxY = Math.max(window.innerHeight - height, 0)
      const minY = Math.min(0, window.innerHeight - height)
      return {
        x: Math.min(Math.max(x, 0), maxX),
        y: Math.min(Math.max(y, minY), maxY),
      }
    },
    [appSize.height, appSize.width],
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleResize = () => {
      setAppPosition((prev) => clampPosition(prev.x, prev.y))
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [clampPosition])

  useEffect(() => {
    setAppPosition((prev) => clampPosition(prev.x, prev.y))
  }, [appSize.height, appSize.width, clampPosition])

  useLayoutEffect(() => {
    if (initialPositionSetRef.current) return
    if (typeof window === 'undefined') return
    const rafId = window.requestAnimationFrame(() => {
      const root = appRootRef.current
      const height = root?.offsetHeight ?? appSize.height
      const bottomY = Math.max(window.innerHeight - height, 0)
      setAppPosition({ x: 0, y: bottomY })
      window.electronAPI?.setWindowBounds?.({
        x: 0,
        y: Math.round(bottomY),
        width: Math.round(appSize.width),
        height: Math.round(appSize.height),
      })
      initialPositionSetRef.current = true
    })
    return () => {
      window.cancelAnimationFrame(rafId)
    }
  }, [appSize.height, appSize.width])

  const updateChromeHeight = useCallback(() => {
    const chrome = appChromeRef.current
    setChromeHeight(chrome?.offsetHeight ?? 0)
  }, [])

  useEffect(() => {
    updateChromeHeight()
  }, [updateChromeHeight, appSize.height, appSize.width, menuOpen])

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') {
      return
    }
    const chrome = appChromeRef.current
    if (!chrome) return
    const observer = new ResizeObserver(() => {
      updateChromeHeight()
    })
    observer.observe(chrome)
    return () => {
      observer.disconnect()
    }
  }, [updateChromeHeight])

  useEffect(() => {
    if (!window.electronAPI?.getPassThroughEnabled) {
      return
    }
    let disposed = false
    void window.electronAPI
      .getPassThroughEnabled?.()
      ?.then((enabled) => {
        if (disposed) return
        if (!enabled) {
          void window.electronAPI?.setIgnoreMouseEvents?.(false)
        }
      })
      .catch(() => {
        void window.electronAPI?.setIgnoreMouseEvents?.(false)
      })

    return () => {
      disposed = true
      void window.electronAPI?.setIgnoreMouseEvents?.(false)
    }
  }, [])

  const isTargetWithinUi = useCallback((target: EventTarget | null) => {
    if (!(target instanceof Node)) return false
    return (
      (appRootRef.current?.contains(target) ?? false) ||
      (appChromeRef.current?.contains(target) ?? false)
    )
  }, [])

  const handleAppPointerEnter = useCallback(() => {
    setAppHover(true)
    applyIgnoreMouseEvents(false)
  }, [applyIgnoreMouseEvents])

  const handleAppPointerLeave = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (dragSessionRef.current || resizeSessionRef.current) {
        return
      }
      if (isTargetWithinUi(event.relatedTarget)) {
        return
      }
      setAppHover(false)
      setChromeHover(false)
      syncPassThroughForPoint()
    },
    [isTargetWithinUi, syncPassThroughForPoint],
  )

  const handleAppPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return
      const current = event.currentTarget as HTMLElement
      const isDragHandle = current.dataset.dragHandle === 'true'
      const target = event.target as HTMLElement | null
      if (
        !isDragHandle &&
        target?.closest('button, input, textarea, select, [data-no-drag="true"]')
      ) {
        return
      }
      const root = appRootRef.current
      if (!root) return
      const rect = root.getBoundingClientRect()
      dragSessionRef.current = {
        pointerId: event.pointerId,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        startX: event.clientX,
        startY: event.clientY,
        dragging: false,
      }
      applyIgnoreMouseEvents(false)
    },
    [applyIgnoreMouseEvents],
  )

  const handleAppPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const session = dragSessionRef.current
      if (!session || session.pointerId !== event.pointerId) {
        return
      }
      const deltaX = event.clientX - session.startX
      const deltaY = event.clientY - session.startY
      if (!session.dragging) {
        const threshold = 2
        if (Math.abs(deltaX) < threshold && Math.abs(deltaY) < threshold) {
          return
        }
        event.currentTarget.setPointerCapture(event.pointerId)
        dragSessionRef.current = {
          ...session,
          dragging: true,
        }
      }
      event.preventDefault()
      const next = clampPosition(event.clientX - session.offsetX, event.clientY - session.offsetY)
      setAppPosition(next)
      window.electronAPI?.setWindowBounds?.({
        x: Math.round(next.x),
        y: Math.round(next.y),
        width: Math.round(appSize.width),
        height: Math.round(appSize.height),
      })
    },
    [appSize.height, appSize.width, clampPosition],
  )

  const clearDragSession = useCallback(() => {
    dragSessionRef.current = null
  }, [])

  const handleAppPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const session = dragSessionRef.current
      if (!session || session.pointerId !== event.pointerId) {
        return
      }
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      const didDrag = dragSessionRef.current?.dragging ?? false
      clearDragSession()
      if (!resizeSessionRef.current && didDrag) {
        syncPassThroughForPoint()
      }
    },
    [clearDragSession, syncPassThroughForPoint],
  )

  const handleAppPointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      clearDragSession()
      if (!resizeSessionRef.current) {
        syncPassThroughForPoint()
      }
    },
    [clearDragSession, syncPassThroughForPoint],
  )

  const handleAppPointerCaptureLost = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      clearDragSession()
      if (!resizeSessionRef.current) {
        if (Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
          syncPassThroughForPoint()
        } else {
          applyIgnoreMouseEvents(false)
        }
      }
    },
    [applyIgnoreMouseEvents, clearDragSession, syncPassThroughForPoint],
  )

  useEffect(() => {
    const disposer = window.electronAPI?.onControlsVisibilityChange?.((hidden) => {
      setControlsHidden(hidden)
      if (hidden) {
        setAppHover(false)
        setChromeHover(false)
        applyIgnoreMouseEvents(true)
      }
    })
    return () => {
      disposer?.()
    }
  }, [applyIgnoreMouseEvents])

  useEffect(() => {
    applyIgnoreMouseEvents(false)
  }, [applyIgnoreMouseEvents])

  useEffect(() => {
    const video = backdropVideoRef.current
    if (video) {
      video.playbackRate = 1
    }
  }, [])

  const ensureYouTubeApi = useCallback(() => {
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
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      script.async = true
      script.dataset.youtubeApi = 'true'
      document.head.appendChild(script)
    }
    return () => {
      window.onYouTubeIframeAPIReady = previousHandler
    }
  }, [])

  useEffect(() => ensureYouTubeApi(), [ensureYouTubeApi])

  useEffect(() => {
    if (!youTubeReady) return
    if (playerRef.current) return
    if (!youtubeContainerRef.current) return
    if (!(window.YT && window.YT.Player)) return

    const playerOptions: YouTubePlayerOptions = {
      height: '1',
      width: '1',
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        rel: 0,
        playsinline: 1,
        modestbranding: 1,
        origin: window.location.origin,
      },
      events: {
        onReady: (event) => {
          event.target.setVolume?.(muted ? 0 : volume)
          if (!activeVideoId) {
            event.target.stopVideo?.()
          }
        },
        onStateChange: (event) => {
          const player = playerRef.current
          if (!player || !(window.YT && window.YT.PlayerState)) return
          const state = event.data
          const currentId = activeVideoId ?? lastPlaybackRef.current.videoId

          if (
            (state === window.YT.PlayerState.PAUSED ||
              state === window.YT.PlayerState.BUFFERING) &&
            currentId &&
            typeof player.getCurrentTime === 'function'
          ) {
            lastPlaybackRef.current = {
              videoId: currentId,
              time: player.getCurrentTime() ?? lastPlaybackRef.current.time ?? 0,
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
        onError: (event) => {
          console.warn('[YouTube] player error', event?.data)
          const player = playerRef.current
          player?.stopVideo?.()
          setPlayerError('영상을 재생하는 중 문제가 발생했습니다. 다른 주소를 시도해 주세요.')
          setActiveVideoId(null)
          setCurrentTitle('')
        },
      },
    }

    if (activeVideoId) {
      playerOptions.videoId = activeVideoId
    }

    playerRef.current = new window.YT.Player(youtubeContainerRef.current, playerOptions)

    return () => {
      playerRef.current?.destroy?.()
      playerRef.current = null
    }
  }, [activeVideoId, muted, volume, youTubeReady])

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
      const targetVolume = mutedRef.current ? 0 : volumeRef.current
      player.setVolume?.(targetVolume)
      if (mutedRef.current) {
        player.mute?.()
      } else {
        player.unMute?.()
      }
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

  const handleToggleAudio = useCallback(() => {
    const player = playerRef.current
    if (activeVideoId) {
      if (player && typeof player.getCurrentTime === 'function') {
        lastPlaybackRef.current = {
          videoId: activeVideoId,
          time: player.getCurrentTime() ?? 0,
        }
        player.pauseVideo?.()
      }
      setActiveVideoId(null)
      setCurrentTitle('')
      setPlayerError(null)
      return
    }

    const nextVideoId = parseYouTubeVideoId(searchQuery)
    if (!nextVideoId) {
      lastPlaybackRef.current = { videoId: null, time: 0 }
      setActiveVideoId(null)
      setCurrentTitle('')
      setPlayerError('유효한 유튜브 주소나 영상 ID를 입력해 주세요.')
      return
    }

    if (lastPlaybackRef.current.videoId !== nextVideoId) {
      lastPlaybackRef.current = { videoId: nextVideoId, time: 0 }
      setCurrentTitle('')
    }

    setPlayerError(null)
    setActiveVideoId(nextVideoId)
  }, [activeVideoId, searchQuery])

  useEffect(() => {
    const player = playerRef.current
    if (!youTubeReady || !player) return
    player.setVolume?.(muted ? 0 : volume)
    if (muted) {
      player.mute?.()
    } else {
      player.unMute?.()
    }
  }, [muted, volume, youTubeReady])

  const handleVolumeChange = useCallback((value: number) => {
    const clamped = Math.min(Math.max(Math.round(value), 0), 100)
    setVolume(clamped)
    if (clamped > 0) {
      setMuted(false)
    }
  }, [])

  const handleResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return
      const root = appRootRef.current
      if (!root) return
      const rect = root.getBoundingClientRect()
      resizeSessionRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startWidth: rect.width,
        startHeight: rect.height,
        startLeft: appPosition.x,
        startBottom: appPosition.y + rect.height,
      }
      event.currentTarget.setPointerCapture(event.pointerId)
      applyIgnoreMouseEvents(false)
      event.preventDefault()
    },
    [appPosition.x, appPosition.y, applyIgnoreMouseEvents],
  )

  const handleResizePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const session = resizeSessionRef.current
      if (!session || session.pointerId !== event.pointerId) {
        return
      }
      event.preventDefault()

      const deltaX = event.clientX - session.startX
      const deltaY = event.clientY - session.startY

      const windowWidth = typeof window !== 'undefined' ? window.innerWidth : Number.POSITIVE_INFINITY
      const windowHeight = typeof window !== 'undefined' ? window.innerHeight : Number.POSITIVE_INFINITY

      const nextWidth = Math.min(
        Math.max(session.startWidth + deltaX, MIN_WIDTH),
        Math.max(windowWidth - session.startLeft, MIN_WIDTH),
      )

      const nextHeightRaw = session.startHeight - deltaY
      const maxHeight = Math.max(MIN_HEIGHT, Math.min(session.startBottom, windowHeight))
      const nextHeight = Math.min(Math.max(nextHeightRaw, MIN_HEIGHT), maxHeight)

      const nextTop = Math.max(session.startBottom - nextHeight, 0)

      setAppSize({
        width: Math.round(nextWidth),
        height: Math.round(nextHeight),
      })

      const clampedPosition = clampPosition(session.startLeft, nextTop)
      setAppPosition(clampedPosition)

      window.electronAPI?.setWindowBounds?.({
        x: Math.round(clampedPosition.x),
        y: Math.round(clampedPosition.y),
        width: Math.round(nextWidth),
        height: Math.round(nextHeight),
      })
    },
    [clampPosition],
  )

  const clearResizeSession = useCallback(
    (pointerId: number, target: HTMLButtonElement) => {
      if (resizeSessionRef.current?.pointerId === pointerId) {
        resizeSessionRef.current = null
      }
      if (target.hasPointerCapture(pointerId)) {
        target.releasePointerCapture(pointerId)
      }
      syncPassThroughForPoint()
    },
    [syncPassThroughForPoint],
  )

  const handleResizePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      clearResizeSession(event.pointerId, event.currentTarget)
      syncPassThroughForPoint()
    },
    [clearResizeSession, syncPassThroughForPoint],
  )

  const handleResizePointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      clearResizeSession(event.pointerId, event.currentTarget)
      syncPassThroughForPoint()
    },
    [clearResizeSession, syncPassThroughForPoint],
  )

  const handleResizePointerCaptureLost = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      clearResizeSession(event.pointerId, event.currentTarget)
      syncPassThroughForPoint()
    },
    [clearResizeSession, syncPassThroughForPoint],
  )

  const chromeTop = Math.max(appPosition.y - chromeHeight, 0)
  const chromeStyle = useMemo(
    () => ({
      left: `${appPosition.x}px`,
      top: `${chromeTop}px`,
      width: `${appSize.width}px`,
    }),
    [appPosition.x, appSize.width, chromeTop],
  )

  const rootStyle = useMemo(
    () => ({
      left: `${appPosition.x}px`,
      top: `${appPosition.y}px`,
      width: `${appSize.width}px`,
      height: `${appSize.height}px`,
    }),
    [appPosition.x, appPosition.y, appSize.height, appSize.width],
  )

  const muteIcon = useMemo(() => {
    if (muted || volume === 0) return 'volume_off'
    if (volume < 50) return 'volume_down'
    return 'volume_up'
  }, [muted, volume])

  return (
    <div className="hover-shell" ref={hoverShellRef}>
      <div className="app-positioner">
        <div
          className="app-chrome"
          ref={appChromeRef}
          data-menu-open={menuOpen ? 'true' : 'false'}
          data-app-hover={appHover ? 'true' : 'false'}
          data-controls-hidden={controlsHidden ? 'true' : 'false'}
          data-chrome-hover={chromeHover ? 'true' : 'false'}
          style={chromeStyle}
          onPointerEnter={() => {
            setChromeHover(true)
            handleAppPointerEnter()
          }}
          onPointerLeave={(event) => {
            setChromeHover(false)
            handleAppPointerLeave(event)
          }}
        >
          <div className="chrome-layer" data-area="chrome">
            <div className="top-panel-wrapper" aria-hidden="false">
              <div
                className={`top-panel ${menuOpen ? 'is-open' : ''}`}
                data-open={menuOpen ? 'true' : 'false'}
              >
                <div className="top-panel-input-group">
                  <div className="top-panel-control-row">
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
                    <button
                      className="control-button top-panel-button action-button"
                      type="button"
                      onClick={handleToggleAudio}
                      aria-label={activeVideoId ? 'Stop playback' : 'Start playback'}
                    >
                      <span className="material-symbols-rounded" aria-hidden="true">
                        {activeVideoId ? 'stop' : 'play_arrow'}
                      </span>
                    </button>
                  </div>
                  <div className="top-panel-volume">
                    <div className="volume-control">
                      <button
                        type="button"
                        className="volume-toggle"
                        aria-label={muted ? 'Unmute audio' : 'Mute audio'}
                        onClick={() => setMuted((prev) => !prev)}
                      >
                        <span className="material-symbols-rounded" aria-hidden="true">
                          {muteIcon}
                        </span>
                      </button>
                      <input
                        id="volume-slider"
                        className="volume-slider"
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={volume}
                        onChange={(event) => handleVolumeChange(Number(event.target.value))}
                        aria-valuenow={volume}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="Playback volume"
                      />
                      <span className="volume-value" aria-hidden="true">
                        {volume}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div
          className="app-root"
          ref={appRootRef}
          data-menu-open={menuOpen ? 'true' : 'false'}
          data-app-hover={appHover ? 'true' : 'false'}
          data-chrome-hover={chromeHover ? 'true' : 'false'}
          data-controls-hidden={controlsHidden ? 'true' : 'false'}
          style={rootStyle}
          onPointerDown={handleAppPointerDown}
          onPointerMove={handleAppPointerMove}
          onPointerUp={handleAppPointerUp}
          onPointerCancel={handleAppPointerCancel}
          onLostPointerCapture={handleAppPointerCaptureLost}
          onPointerEnter={() => {
            setChromeHover(false)
            handleAppPointerEnter()
          }}
          onPointerLeave={handleAppPointerLeave}
        >
          <div
            className="inline-controls"
            onPointerEnter={() => {
              setChromeHover(true)
              handleAppPointerEnter()
            }}
            onPointerLeave={(event) => {
              setChromeHover(false)
              handleAppPointerLeave(event)
            }}
          >
            <button
              className="control-button menu-button"
              type="button"
              onClick={toggleMenu}
              onPointerDown={handleMenuPointerDown}
              onMouseEnter={handleMenuFocus}
              onFocus={handleMenuFocus}
              aria-label="Toggle menu"
              data-no-drag="true"
            >
              ≡
            </button>
            <button
              className="control-button resize-button"
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
              <ClockDisplay trackTitle={currentTitle} />
              {playerError ? (
                <p className="app-error" role="alert">
                  {playerError}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
