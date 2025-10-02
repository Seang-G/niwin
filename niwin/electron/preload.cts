import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  ping: () => ipcRenderer.invoke('ping'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  setIgnoreMouseEvents: (shouldIgnore: boolean) =>
    ipcRenderer.invoke('window:set-ignore-mouse-events', shouldIgnore),
  getPassThroughEnabled: () => ipcRenderer.invoke('window:get-pass-through-enabled'),
  toggleResize: () => ipcRenderer.invoke('window:resize-toggle'),
  getWindowState: () => ipcRenderer.invoke('window:get-state'),
  getWindowBounds: () => ipcRenderer.invoke('window:get-bounds'),
  setWindowBounds: (bounds: { width: number; height: number; x?: number; y?: number }) =>
    ipcRenderer.invoke('window:set-bounds', bounds),
})
