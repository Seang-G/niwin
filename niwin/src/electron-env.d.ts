export {}

declare global {
  type YouTubePlayerState = {
    BUFFERING: number
    ENDED: number
    PAUSED: number
    PLAYING: number
  }

  type YouTubeVideoData = {
    title?: string
  }

  type YouTubePlayer = {
    destroy?: () => void
    getCurrentTime?: () => number
    getVideoData?: () => YouTubeVideoData
    loadVideoById?: (options: { videoId: string; startSeconds?: number }) => void
    mute?: () => void
    pauseVideo?: () => void
    playVideo?: () => void
    setVolume?: (volume: number) => void
    stopVideo?: () => void
    unMute?: () => void
  }

  type YouTubePlayerEvent = {
    data: number
    target: YouTubePlayer
  }

  type YouTubePlayerOptions = {
    events?: {
      onError?: (event: YouTubePlayerEvent) => void
      onReady?: (event: YouTubePlayerEvent) => void
      onStateChange?: (event: YouTubePlayerEvent) => void
    }
    height: string
    playerVars?: Record<string, string | number>
    videoId?: string
    width: string
  }

  type YouTubeApi = {
    Player: new (element: HTMLElement, options: YouTubePlayerOptions) => YouTubePlayer
    PlayerState: YouTubePlayerState
  }

  interface Window {
    electronAPI?: {
      ping: () => Promise<string>
      closeWindow: () => Promise<void>
      setIgnoreMouseEvents?: (
        shouldIgnore: boolean,
        options?: { forward?: boolean },
      ) => Promise<void>
      getPassThroughEnabled?: () => Promise<boolean>
      toggleResize?: () => Promise<boolean>
      getWindowState?: () => Promise<{ isMaximized: boolean }>
      getWindowBounds?: () => Promise<{ x: number; y: number; width: number; height: number } | null>
      setWindowBounds?: (
        bounds: { width: number; height: number; x?: number; y?: number },
      ) => Promise<{ x: number; y: number; width: number; height: number } | null>
      onControlsVisibilityChange?: (
        callback: (hidden: boolean) => void,
      ) => (() => void) | undefined
    }
    YT?: YouTubeApi
    onYouTubeIframeAPIReady?: () => void
  }
}
