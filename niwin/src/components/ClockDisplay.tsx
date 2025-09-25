import { useEffect, useMemo, useState } from 'react'

const TICK_INTERVAL = 1000

const getLocale = () => {
  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language
  }
  return 'en-US'
}

const buildFormatter = (
  options: Intl.DateTimeFormatOptions,
  fallback: (date: Date) => string,
) => {
  try {
    const locale = getLocale()
    const formatter = new Intl.DateTimeFormat(locale, options)
    return (date: Date) => formatter.format(date)
  } catch (error) {
    console.warn('[ClockDisplay] Intl formatter failed, using fallback.', error)
    return fallback
  }
}

const formatDateFallback = (date: Date) => {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  const weekday = date
    .toLocaleDateString(undefined, { weekday: 'long' })
    .replace(/\b\w/g, (char) => char.toUpperCase())
  return `${weekday}, ${year}.${month}.${day}`
}

const formatTimeZoneFallback = (date: Date) => {
  return date.toTimeString().split(' ')[1] ?? 'UTC'
}

const ClockDisplay = () => {
  const [now, setNow] = useState(() => new Date())

  const dateFormatter = useMemo(
    () =>
      buildFormatter(
        {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        },
        formatDateFallback,
      ),
    [],
  )

  const timeZoneLabel = useMemo(() => {
    try {
      const formatter = new Intl.DateTimeFormat(getLocale(), { timeZoneName: 'short' })
      // formatToParts may not exist in some polyfills
      const parts = (formatter as Intl.DateTimeFormat & { formatToParts?: (date: Date) => Intl.DateTimeFormatPart[] }).formatToParts?.(now)
      if (parts) {
        const zone = parts.find((part) => part.type === 'timeZoneName')?.value
        if (zone) {
          return zone
        }
      }
      const formatted = formatter.format(now)
      const zone = formatted.split(' ').find((chunk) => chunk.match(/[A-Z]+/))
      return zone ?? formatted
    } catch (error) {
      console.warn('[ClockDisplay] Unable to resolve timezone label.', error)
      return formatTimeZoneFallback(now)
    }
  }, [now])

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date())
    }, TICK_INTERVAL)

    return () => {
      clearInterval(timer)
    }
  }, [])

  const hours = now.getHours().toString().padStart(2, '0')
  const minutes = now.getMinutes().toString().padStart(2, '0')
  const seconds = now.getSeconds().toString().padStart(2, '0')
  const dateLabel = dateFormatter(now)

  return (
    <div className="clock-container" role="group" aria-label="현재 시계 정보">
      <div className="clock-time-group" aria-label={`현재 시각 ${hours}시 ${minutes}분`}>
        <span className="clock-hours">{hours}</span>
        <span className="clock-divider">:</span>
        <span className="clock-minutes">{minutes}</span>
        <span className="clock-seconds" aria-label={`현재 초 ${seconds}초`}>
          {seconds}
        </span>
      </div>
      <div className="clock-meta">
        <p className="clock-date" aria-label="현재 날짜">
          {dateLabel}
        </p>
        <p className="clock-timezone" aria-label="현재 시간대">
          {timeZoneLabel}
        </p>
      </div>
    </div>
  )
}

export default ClockDisplay
