export {}

declare global {
  interface Window {
    electronAPI?: {
      ping: () => Promise<string>
      closeWindow: () => Promise<void>
      setIgnoreMouseEvents?: (shouldIgnore: boolean) => Promise<void>
      getPassThroughEnabled?: () => Promise<boolean>
    }
  }
}
