import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, screen } from 'electron'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
const __dirname = dirname(fileURLToPath(import.meta.url))

const resolvePassThroughEnabled = () => process.env.NIWIN_ENABLE_PASSTHROUGH !== 'false'

const passThroughEnabled = resolvePassThroughEnabled()

app.disableHardwareAcceleration()

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let lastIgnoreState: boolean | null = null
let passThroughInterval: NodeJS.Timeout | null = null
let windowIsMaximized = false
let controlsHidden = false

const resolveAssetPath = (...paths: string[]) => {
  if (app.isPackaged) {
    return join(process.resourcesPath, ...paths)
  }
  return join(__dirname, '..', ...paths)
}

const MIN_WINDOW_WIDTH = 200
const MIN_WINDOW_HEIGHT = 130

const updateIgnoreState = (shouldIgnore: boolean) => {
  if (!mainWindow || lastIgnoreState === shouldIgnore) {
    return
  }

  lastIgnoreState = shouldIgnore
  if (shouldIgnore) {
    mainWindow.setIgnoreMouseEvents(true, { forward: true })
  } else {
    mainWindow.setIgnoreMouseEvents(false)
  }
}

const evaluateCursorPosition = () => {
  if (!mainWindow) {
    return
  }

  if (!shouldUsePassThrough()) {
    updateIgnoreState(false)
    stopPassThroughMonitor()
    return
  }

  const cursor = screen.getCursorScreenPoint()
  const bounds = mainWindow.getBounds()

  const insideHorizontal = cursor.x >= bounds.x && cursor.x <= bounds.x + bounds.width
  const insideVertical = cursor.y >= bounds.y && cursor.y <= bounds.y + bounds.height
  const isInsideWindow = insideHorizontal && insideVertical

  updateIgnoreState(!isInsideWindow)
}

const shouldUsePassThrough = () => {
  if (!passThroughEnabled || !mainWindow) {
    return false
  }

  if (windowIsMaximized || mainWindow.isMaximized()) {
    return false
  }

  const bounds = mainWindow.getBounds()

  const PASS_THROUGH_MIN_WIDTH = 640
  const PASS_THROUGH_MIN_HEIGHT = 360
  if (bounds.width <= PASS_THROUGH_MIN_WIDTH || bounds.height <= PASS_THROUGH_MIN_HEIGHT) {
    return false
  }

  const display = screen.getDisplayMatching(bounds)
  const { width, height } = display.workAreaSize

  return bounds.width < width || bounds.height < height
}

const startPassThroughMonitor = () => {
  if (passThroughInterval || !mainWindow) {
    return
  }

  if (!shouldUsePassThrough()) {
    updateIgnoreState(false)
    return
  }

  evaluateCursorPosition()
  passThroughInterval = setInterval(evaluateCursorPosition, 80)
}

const stopPassThroughMonitor = () => {
  if (passThroughInterval) {
    clearInterval(passThroughInterval)
    passThroughInterval = null
  }
}

const refreshPassThroughState = () => {
  if (!mainWindow) {
    return
  }

  if (shouldUsePassThrough()) {
    startPassThroughMonitor()
  } else {
    stopPassThroughMonitor()
    updateIgnoreState(false)
  }
}

const updateTrayMenu = () => {
  if (!tray) {
    return
  }

  const isVisible = mainWindow?.isVisible() ?? false
  const contextMenu = Menu.buildFromTemplate([
    {
      label: isVisible ? 'Hide Window' : 'Show Window',
      click: () => {
        void toggleWindowVisibility()
      },
    },
    {
      label: controlsHidden ? 'Show Controls' : 'Hide Controls',
      enabled: Boolean(mainWindow?.webContents),
      click: () => {
        controlsHidden = !controlsHidden
        if (mainWindow) {
          mainWindow.webContents.send('tray:controls-visibility', controlsHidden)
        }
        updateTrayMenu()
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      role: 'quit',
    },
  ])

  tray.setContextMenu(contextMenu)
  tray.setToolTip('Niwin')
}

const showWindow = async () => {
  if (!mainWindow) {
    await createWindow()
  } else {
    mainWindow.show()
    mainWindow.focus()
    mainWindow.setAlwaysOnTop(true, 'screen-saver')
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  }

  updateTrayMenu()
}

const hideWindow = () => {
  if (!mainWindow) {
    return
  }

  mainWindow.hide()
  updateTrayMenu()
}

const toggleWindowVisibility = async () => {
  if (!mainWindow) {
    await showWindow()
    return
  }

  if (mainWindow.isVisible()) {
    hideWindow()
  } else {
    await showWindow()
  }
}

const createTray = () => {
  if (tray) {
    return
  }

  const iconFile = process.platform === 'win32' ? 'installerIcon.ico' : 'icon.png'
  const iconPath = resolveAssetPath('buildResources', iconFile)
  let image = nativeImage.createFromPath(iconPath)
  if (process.platform === 'darwin') {
    image = image.resize({ width: 18, height: 18 })
    image.setTemplateImage(true)
  }

  tray = new Tray(image)
  tray.on('click', () => {
    void toggleWindowVisibility()
  })

  updateTrayMenu()
}

const createWindow = async () => {
  const {
    bounds: { width: primaryWidth, height: primaryHeight, x: originX, y: originY },
  } = screen.getPrimaryDisplay()
  const windowWidth = Math.max(primaryWidth, MIN_WINDOW_WIDTH)
  const windowHeight = Math.max(primaryHeight, MIN_WINDOW_HEIGHT)

  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: originX,
    y: originY,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    resizable: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    autoHideMenuBar: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
    },
  })

  updateIgnoreState(false)
  refreshPassThroughState()
  mainWindow.setAlwaysOnTop(true, 'screen-saver')
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  mainWindow.on('blur', () => {
    if (!mainWindow) return
    mainWindow.setAlwaysOnTop(true, 'screen-saver')
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  })
  mainWindow.on('focus', () => {
    if (!mainWindow) return
    mainWindow.setAlwaysOnTop(true, 'screen-saver')
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  })
  mainWindow.on('show', updateTrayMenu)
  mainWindow.on('hide', updateTrayMenu)
  mainWindow.on('closed', () => {
    mainWindow = null
    lastIgnoreState = null
    stopPassThroughMonitor()
    updateTrayMenu()
  })
  mainWindow.on('maximize', () => {
    windowIsMaximized = true
    refreshPassThroughState()
  })
  mainWindow.on('unmaximize', () => {
    windowIsMaximized = false
    refreshPassThroughState()
  })

  mainWindow.webContents.once('did-finish-load', () => {
    if (!mainWindow) return
    mainWindow.webContents.send('tray:controls-visibility', controlsHidden)
  })

  if (VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    await mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  updateTrayMenu()
}

app.whenReady().then(async () => {
  ipcMain.handle('ping', () => 'pong')
  ipcMain.handle('window:get-state', () => {
    const isMaximized = mainWindow?.isMaximized?.() ?? windowIsMaximized
    return {
      isMaximized,
    }
  })
  ipcMain.handle('window:resize-toggle', () => {
    if (!mainWindow) return windowIsMaximized

    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
      windowIsMaximized = false
    } else {
      mainWindow.maximize()
      windowIsMaximized = true
    }

    refreshPassThroughState()
    return windowIsMaximized
  })
  ipcMain.handle('window:close', () => {
    mainWindow?.close()
  })
  ipcMain.handle('window:set-ignore-mouse-events', (_event, shouldIgnore: boolean) => {
    if (!passThroughEnabled) {
      updateIgnoreState(false)
      return
    }
    updateIgnoreState(shouldIgnore)
  })
  ipcMain.handle('window:get-pass-through-enabled', () => passThroughEnabled)
  ipcMain.handle('window:get-bounds', () => {
    if (!mainWindow) return null
    const { x, y, width, height } = mainWindow.getBounds()
    return { x, y, width, height }
  })
  ipcMain.handle(
    'window:set-bounds',
    (
      _event,
      bounds: { width: number; height: number; x?: number; y?: number },
    ) => {
      if (!mainWindow) return null

      const current = mainWindow.getBounds()
      const nextWidth = Math.max(
        MIN_WINDOW_WIDTH,
        Number.isFinite(bounds.width) ? Math.round(bounds.width) : current.width,
      )
      const nextHeight = Math.max(
        MIN_WINDOW_HEIGHT,
        Number.isFinite(bounds.height) ? Math.round(bounds.height) : current.height,
      )
      const nextX =
        typeof bounds.x === 'number' && Number.isFinite(bounds.x)
          ? Math.round(bounds.x)
          : current.x
      const nextY =
        typeof bounds.y === 'number' && Number.isFinite(bounds.y)
          ? Math.round(bounds.y)
          : current.y

      mainWindow.setBounds({ x: nextX, y: nextY, width: nextWidth, height: nextHeight })
      windowIsMaximized = false
      refreshPassThroughState()

      return { x: nextX, y: nextY, width: nextWidth, height: nextHeight }
    },
  )

  await createWindow()
  createTray()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (tray) {
    tray.destroy()
    tray = null
  }
})
