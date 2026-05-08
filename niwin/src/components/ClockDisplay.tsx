import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

const TICK_INTERVAL = 1000

const formatDateFallback = (date: Date) => {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase()
  return `${year}.${month}.${day}. ${weekday}`
}

type ClockDisplayProps = {
  trackTitle?: string
}

type TrackTitleStyle = CSSProperties & {
  '--scroll-distance'?: string
  '--scroll-duration'?: string
}

const ClockDisplay = ({ trackTitle }: ClockDisplayProps) => {
  const hasTitle = Boolean(trackTitle && trackTitle.trim().length > 0)
  const [now, setNow] = useState(() => new Date())
  const [secondsPosition, setSecondsPosition] = useState<'tight' | 'wide'>('tight')
  const [titleOverflowing, setTitleOverflowing] = useState(false)
  const [titleScrollDistance, setTitleScrollDistance] = useState(0)
  const titleContainerRef = useRef<HTMLParagraphElement | null>(null)
  const titleContentRef = useRef<HTMLSpanElement | null>(null)

  const dateFormatter = useMemo(() => {
    try {
      const weekdayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short' })
      return (date: Date) => {
        const year = date.getFullYear()
        const month = (date.getMonth() + 1).toString().padStart(2, '0')
        const day = date.getDate().toString().padStart(2, '0')
        const weekday = weekdayFormatter.format(date).toLowerCase()
        return `${year}.${month}.${day}. ${weekday}`
      }
    } catch (error) {
      console.warn('[ClockDisplay] Intl weekday formatter failed, using fallback.', error)
      return formatDateFallback
    }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date())
    }, TICK_INTERVAL)

    const handleResize = () => {
      const vw = Math.max(window.innerWidth, 1)
      const vh = Math.max(window.innerHeight, 1)
      const minDimension = Math.min(vw, vh)
      setSecondsPosition(minDimension < 480 ? 'tight' : 'wide')
    }

    handleResize()

    window.addEventListener('resize', handleResize)

    return () => {
      clearInterval(timer)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  const hours = now.getHours().toString().padStart(2, '0')
  const minutes = now.getMinutes().toString().padStart(2, '0')
  const seconds = now.getSeconds().toString().padStart(2, '0')
  const dateLabel = dateFormatter(now)
  const updateTitleOverflow = useCallback(() => {
    const container = titleContainerRef.current
    const content = titleContentRef.current
    if (!container || !content || !hasTitle) {
      setTitleOverflowing(false)
      setTitleScrollDistance(0)
      return
    }
    const overflow = Math.max(content.scrollWidth - container.clientWidth, 0)
    setTitleOverflowing(overflow > 0)
    setTitleScrollDistance(overflow)
  }, [hasTitle])

  useEffect(() => {
    updateTitleOverflow()
  }, [trackTitle, updateTitleOverflow])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const handleResize = () => {
      updateTitleOverflow()
    }
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [updateTitleOverflow])

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(() => {
      updateTitleOverflow()
    })
    const container = titleContainerRef.current
    if (container) {
      observer.observe(container)
    }
    return () => {
      observer.disconnect()
    }
  }, [updateTitleOverflow])

  const trackTitleStyle: TrackTitleStyle | undefined =
    hasTitle && titleOverflowing
      ? {
          '--scroll-distance': `${titleScrollDistance}px`,
          '--scroll-duration': `${Math.max(6, 6 + titleScrollDistance / 40)}s`,
        }
      : undefined

  return (
    <div className="clock-container" role="group" aria-label="현재 시계 정보" data-seconds-position={secondsPosition}>
      <div className="clock-time-group" aria-label={`현재 시각 ${hours}시 ${minutes}분`}>
        <div className="clock-time-core">
          <span className="clock-hours">{hours}</span>
          <span className="clock-divider">:</span>
          <span className="clock-minutes">{minutes}</span>
          <span className="clock-seconds" aria-label={`현재 초 ${seconds}초`}>
            {seconds}
          </span>
        </div>

      </div>
      <div className="clock-meta">
        <p className="clock-date" aria-label="현재 날짜">
          {dateLabel}
        </p>
        <p
          className="clock-track-title"
          title={hasTitle ? trackTitle : undefined}
          data-overflow={titleOverflowing ? 'true' : 'false'}
          data-visible={hasTitle ? 'true' : 'false'}
          ref={titleContainerRef}
          style={trackTitleStyle}
          aria-label={hasTitle ? `현재 재생 중: ${trackTitle}` : undefined}
        >
          <span className="clock-track-title__content" ref={titleContentRef}>
            {hasTitle ? trackTitle : '\u00a0'}
          </span>
        </p>
      </div>
    </div>
  )
}

export default ClockDisplay
