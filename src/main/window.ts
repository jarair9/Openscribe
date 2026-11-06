import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { IPC, type WindowState } from '@shared/ipc'
import { PRODUCT } from '@shared/product'
import { log } from './logger'

let mainWindow: BrowserWindow | null = null

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

function windowState(window: BrowserWindow): WindowState {
  return { maximized: window.isMaximized(), focused: window.isFocused() }
}

function broadcastState(window: BrowserWindow): void {
  if (window.isDestroyed()) return
  window.webContents.send(IPC.windowStateChanged, windowState(window))
}

export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1500,
    height: 950,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    frame: false,
    icon: app.isPackaged
      ? join(process.resourcesPath, 'Openscribe.png')
      : join(app.getAppPath(), 'src/assets/Openscribe.png'),
    title: PRODUCT.name,
    backgroundColor: '#0e1014',
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false
    }
  })

  mainWindow = window

  // ready-to-show is the happy path, but a renderer that fails to paint (a cold
  // disk cache, a dev-server reload before first frame) never emits it and the
  // app looks like it refused to launch. Any of the three signals reveals it.
  let revealed = false
  const reveal = (reason: string): void => {
    if (revealed || window.isDestroyed()) return
    revealed = true
    log('info', `Main window shown (${reason})`)
    window.show()
    window.focus()
  }
  window.once('ready-to-show', () => reveal('ready-to-show'))
  window.webContents.once('did-finish-load', () => {
    setTimeout(() => reveal('did-finish-load fallback'), 1500)
  })
  window.webContents.once('did-fail-load', (_event, code, description) => {
    log('error', 'Renderer failed to load', { code, description })
    reveal('did-fail-load')
  })
  window.webContents.on('render-process-gone', (_event, details) => {
    log('error', 'Renderer process gone', details)
  })
  setTimeout(() => reveal('startup timeout'), 6000)

  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null
  })

  window.on('maximize', () => broadcastState(window))
  window.on('unmaximize', () => broadcastState(window))
  window.on('focus', () => broadcastState(window))
  window.on('blur', () => broadcastState(window))

  // The editor never needs remote content. Navigation and popups are denied.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, url) => {
    const devUrl = process.env['ELECTRON_RENDERER_URL']
    if (devUrl && url.startsWith(devUrl)) return
    event.preventDefault()
    log('warn', 'Blocked renderer navigation', { url })
  })
  window.webContents.on('will-attach-webview', (event) => event.preventDefault())

  // The editor needs the microphone for voiceover recording and nothing else.
  window.webContents.session.setPermissionRequestHandler((contents, permission, callback, details) => {
    if (contents !== window.webContents || permission !== 'media') {
      callback(false)
      return
    }
    const mediaTypes = (details as { mediaTypes?: string[] }).mediaTypes ?? []
    callback(mediaTypes.length === 0 || mediaTypes.every((type) => type === 'audio'))
  })

  window.webContents.session.setPermissionCheckHandler((contents, permission) => {
    return contents === window.webContents && permission === 'media'
  })

  if (!app.isPackaged) {
    window.webContents.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown' && input.key === 'F12') {
        window.webContents.toggleDevTools()
        event.preventDefault()
      }
    })
  }

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    void window.loadURL(devUrl)
  } else {
    void window.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }

  return window
}
