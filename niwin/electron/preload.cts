import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  ping: () => ipcRenderer.invoke('ping'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  setIgnoreMouseEvents: (shouldIgnore: boolean) =>
    ipcRenderer.invoke('window:set-ignore-mouse-events', shouldIgnore),
  getPassThroughEnabled: () => ipcRenderer.invoke('window:get-pass-through-enabled'),
})
