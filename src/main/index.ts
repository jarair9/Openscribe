import { app, BrowserWindow, Menu } from 'electron'
import { PRODUCT } from '@shared/product'
import { registerIpc } from './ipc'
import { log } from './logger'
import { registerAssetProtocol, registerAssetScheme } from './protocol'
import { createMainWindow, getMainWindow } from './window'

app.setName(PRODUCT.name)

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
