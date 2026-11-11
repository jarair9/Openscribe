import { app, BrowserWindow, Menu } from 'electron'
import { cpSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { PRODUCT } from '@shared/product'
import { registerIpc } from './ipc'
import { log } from './logger'
import { registerAssetProtocol, registerAssetScheme } from './protocol'
import { createMainWindow, getMainWindow } from './window'

app.setName(PRODUCT.name)

/**
 * Renaming the product moves Electron's userData folder. Copy the first
 * matching legacy profile so recent projects and preferences survive the
 * upgrade; the renderer's preserved `openwhiteboard.*` keys live inside it.
 */
function migrateLegacyUserData(): void {
  const appData = app.getPath('appData')
  const current = app.getPath('userData')
  if (existsSync(current)) return

  for (const legacy of ['OpenWhiteboard', 'openwhiteboard', 'Whitescribe', 'Whiteboard', 'Whiteboard Studio']) {
    const source = join(appData, legacy)
    if (source === current || !existsSync(source)) continue
    try {
      cpSync(source, current, { recursive: true, force: false, errorOnExist: false })
      log('info', `Migrated legacy user data from ${source}`)
      return
    } catch (error) {
      log('warn', `Could not migrate legacy user data from ${source}`, error)
    }
  }
}

migrateLegacyUserData()

process.on('uncaughtException', (error) => {
  log('error', 'Uncaught exception in main process', error)
})
process.on('unhandledRejection', (reason) => {
  log('error', 'Unhandled rejection in main process', reason)
})

registerAssetScheme()

const hasLock = app.requestSingleInstanceLock()
if (!hasLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const window = getMainWindow()
    if (!window) return
    if (window.isMinimized()) window.restore()
    window.focus()
  })

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null)
    registerIpc()
    registerAssetProtocol()
    createMainWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
