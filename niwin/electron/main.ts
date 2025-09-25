import { app, BrowserWindow, ipcMain, screen } from 'electron'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
const __dirname = dirname(fileURLToPath(import.meta.url))

const resolvePassThroughEnabled = () => process.env.NIWIN_ENABLE_PASSTHROUGH !== 'false'

const passThroughEnabled = resolvePassThroughEnabled()

app.disableHardwareAcceleration()

let mainWindow: BrowserWindow | null = null
let lastIgnoreState: boolean | null = null
let passThroughInterval: NodeJS.Timeout | null = null

const MENU_ZONE_WIDTH = 200
const MENU_ZONE_HEIGHT = 160
const MENU_ZONE_PADDING = 16

const TOP_PANEL_WIDTH = 240
const TOP_PANEL_OVERHANG = 40
const TOP_PANEL_DROP = 140
const TOP_PANEL_RIGHT_OFFSET = 120
const RESIZE_MARGIN = 24

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

  const cursor = screen.getCursorScreenPoint()
  const bounds = mainWindow.getBounds()

  const leftEdge = bounds.x
  const rightEdge = bounds.x + bounds.width
  const topEdge = bounds.y
  const bottomEdge = bounds.y + bounds.height
  const menuZoneLeft = rightEdge - MENU_ZONE_WIDTH - MENU_ZONE_PADDING
  const menuZoneRight = rightEdge + MENU_ZONE_PADDING
  const menuZoneTop = topEdge - MENU_ZONE_PADDING
  const menuZoneBottom = topEdge + MENU_ZONE_HEIGHT + MENU_ZONE_PADDING

  const panelZoneRight = rightEdge - TOP_PANEL_RIGHT_OFFSET
  const panelZoneLeft = panelZoneRight - TOP_PANEL_WIDTH
  const panelZoneTop = topEdge - TOP_PANEL_OVERHANG
  const panelZoneBottom = topEdge + TOP_PANEL_DROP

  const isNearLeftEdge = cursor.x >= leftEdge && cursor.x <= leftEdge + RESIZE_MARGIN
  const isNearRightEdge = cursor.x >= rightEdge - RESIZE_MARGIN && cursor.x <= rightEdge
  const isNearTopEdge = cursor.y >= topEdge && cursor.y <= topEdge + RESIZE_MARGIN
  const isNearBottomEdge = cursor.y >= bottomEdge - RESIZE_MARGIN && cursor.y <= bottomEdge

  const isNearEdge = isNearLeftEdge || isNearRightEdge || isNearTopEdge || isNearBottomEdge

  const isInMenuZone =
    cursor.x >= menuZoneLeft &&
    cursor.x <= menuZoneRight &&
    cursor.y >= menuZoneTop &&
    cursor.y <= menuZoneBottom

  const isInPanelZone =
    cursor.x >= panelZoneLeft &&
    cursor.x <= panelZoneRight &&
    cursor.y >= panelZoneTop &&
    cursor.y <= panelZoneBottom

  updateIgnoreState(!(isInMenuZone || isInPanelZone || isNearEdge))
}

const startPassThroughMonitor = () => {
  if (!passThroughEnabled || passThroughInterval || !mainWindow) {
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

const createWindow = async () => {
  const DEFAULT_WIDTH = 1080
  const DEFAULT_HEIGHT = 720
  const windowWidth = Math.round(DEFAULT_WIDTH / 2)
  const windowHeight = Math.round(DEFAULT_HEIGHT / 2)

  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    resizable: true,
    frame: false,
    transparent: true,
    hasShadow: false,
    autoHideMenuBar: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
    },
  })

  updateIgnoreState(passThroughEnabled ? true : false)
  startPassThroughMonitor()
  mainWindow.setAlwaysOnTop(true, 'screen-saver')
  mainWindow.on('closed', () => {
    mainWindow = null
    lastIgnoreState = null
    stopPassThroughMonitor()
  })

  if (VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    await mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  ipcMain.handle('ping', () => 'pong')
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

  createWindow()

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
