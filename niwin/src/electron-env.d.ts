export {}

declare global {
  interface Window {
    electronAPI?: {
      ping: () => Promise<string>
      closeWindow: () => Promise<void>
      setIgnoreMouseEvents?: (shouldIgnore: boolean) => Promise<void>
      getPassThroughEnabled?: () => Promise<boolean>
      toggleResize?: () => Promise<boolean>
      getWindowState?: () => Promise<{ isMaximized: boolean }>
      getWindowBounds?: () => Promise<{ x: number; y: number; width: number; height: number } | null>
      setWindowBounds?: (
        bounds: { width: number; height: number; x?: number; y?: number },
      ) => Promise<{ x: number; y: number; width: number; height: number } | null>
    }
    YT?: any
    onYouTubeIframeAPIReady?: () => void
  }
}
