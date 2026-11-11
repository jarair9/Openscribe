import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { IPC, type WindowState } from '@shared/ipc'
import { PRODUCT } from '@shared/product'
import { log } from './logger'

let mainWindow: BrowserWindow | null = null

/** Windows whose renderer has already answered the unsaved-changes prompt. */
const approvedCloses = new WeakSet<BrowserWindow>()

/** Set when the renderer process died and can no longer answer a prompt. */
const rendererGone = new WeakSet<BrowserWindow>()

/** Pending "the renderer never acknowledged the close request" guards. */
const closeGuards = new WeakMap<BrowserWindow, ReturnType<typeof setTimeout>>()

const CLOSE_ACK_TIMEOUT_MS = 4000

export function approveWindowClose(window: BrowserWindow): void {
  const guard = closeGuards.get(window)
  if (guard) clearTimeout(guard)
  closeGuards.delete(window)
  approvedCloses.add(window)
}

/** The renderer received the request and is showing (or skipping) the prompt. */
export function acknowledgeWindowClose(window: BrowserWindow): void {
  const guard = closeGuards.get(window)
  if (guard) clearTimeout(guard)
  closeGuards.delete(window)
}

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
      ? join(process.resourcesPath, 'openscribe-256.png')
      : join(app.getAppPath(), 'src/assets/openscribe-256.png'),
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
    rendererGone.add(window)
  })
  setTimeout(() => reveal('startup timeout'), 6000)

  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null
  })

  // Alt+F4, the taskbar and the system shutdown menu all land here. Ask the
  // renderer first so unsaved work is never discarded silently; the renderer
  // answers by calling the approve-then-close IPC.
  window.on('close', (event) => {
    if (approvedCloses.has(window)) {
      approvedCloses.delete(window)
      return
    }
    // A window still loading has no project to lose and would never answer.
    // A crashed renderer cannot answer either, so do not trap the user.
    if (
      rendererGone.has(window) ||
      window.webContents.isDestroyed() ||
      window.webContents.isLoadingMainFrame()
    ) {
      return
    }
    event.preventDefault()
    window.webContents.send(IPC.windowCloseRequested)

    // If React never mounted (or the renderer is wedged) nobody acknowledges
    // the request. Let the second chance through rather than blocking Alt+F4
    // forever; a live renderer acknowledges immediately.
    const existing = closeGuards.get(window)
    if (existing) clearTimeout(existing)
    closeGuards.set(
      window,
      setTimeout(() => {
        closeGuards.delete(window)
        if (window.isDestroyed()) return
        log('warn', 'Close request was not acknowledged; closing the window')
        approvedCloses.add(window)
        window.close()
      }, CLOSE_ACK_TIMEOUT_MS)
    )
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
