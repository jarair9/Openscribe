import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { existsSync } from 'node:fs'
import { extname, join } from 'node:path'
import type { Project } from '@core/schema/project'
import { PRODUCT } from '@shared/product'
import {
  IPC,
  type AppInfo,
  type ChooseExportPathRequest,
  type CreateProjectRequest,
  type ExportEncodeRequest,
  type ExportFinishRequest,
  type ExportFrameRequest,
  type ExportPrepareRequest,
  type IngestAssetsRequest,
  type ReadAssetRequest,
  type SaveAudioRequest,
  type SaveProjectAsRequest,
  type SaveProjectRequest
} from '@shared/ipc'
import { ingestAssets, readAssetBase64, readAssetText, saveAudioBytes } from './assets'
import { encodeExport, finishExport, prepareExport, writeExportFrame } from './export'
import { ffmpegEngine } from './ffmpeg'
import { log, logsDir } from './logger'
import { createProject, openProject, saveProject, saveProjectAs, safeProjectName } from './projectStore'
import { getMainWindow } from './window'
import { libraryItemById, listLibraryItems } from './library'

function dialogParent(event: Electron.IpcMainInvokeEvent | Electron.IpcMainEvent): BrowserWindow {
  const window = BrowserWindow.fromWebContents(event.sender) ?? getMainWindow()
  if (!window) throw new Error('The application window is not available.')
  return window
}

function assertString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${field} is required.`)
  return value
}

function assertDocument(value: unknown): Project {
  if (!value || typeof value !== 'object') throw new Error('A project document is required.')
  return value as Project
}

function handle(
  channel: string,
  listener: (event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => unknown
): void {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await listener(event, ...args)
    } catch (error) {
      log('warn', `IPC ${channel} failed`, error)
      throw error
    }
  })
}

export function registerIpc(): void {
  ipcMain.on(IPC.windowMinimize, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })
  ipcMain.on(IPC.windowToggleMaximize, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return
    if (window.isMaximized()) window.unmaximize()
    else window.maximize()
  })
  ipcMain.on(IPC.windowClose, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  handle(IPC.appInfo, (): AppInfo => ({
    productName: PRODUCT.name,
    version: PRODUCT.version,
    platform: process.platform,
    isDev: !app.isPackaged,
    userDataDir: app.getPath('userData'),
    logsDir: logsDir()
  }))

  handle(IPC.openLogsFolder, async () => {
    await shell.openPath(logsDir())
  })

  handle(IPC.dialogPickParentDir, async (event) => {
    const result = await dialog.showOpenDialog(dialogParent(event), {
      title: 'Choose a folder for the project',
      buttonLabel: 'Choose folder',
      properties: ['openDirectory', 'createDirectory']
    })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  handle(IPC.dialogOpenProject, async (event) => {
    const result = await dialog.showOpenDialog(dialogParent(event), {
      title: 'Open project',
      properties: ['openFile'],
      filters: [
        { name: PRODUCT.projectFileFilterName, extensions: [PRODUCT.projectExtension] },
        { name: 'All files', extensions: ['*'] }
      ]
    })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  handle(IPC.dialogImportAssets, async (event) => {
    const result = await dialog.showOpenDialog(dialogParent(event), {
      title: 'Import illustrations and audio',
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Supported media',
          extensions: ['svg', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'wav', 'mp3', 'ogg', 'm4a', 'flac']
        },
        { name: 'Illustrations', extensions: ['svg', 'png', 'jpg', 'jpeg', 'gif', 'webp'] },
        { name: 'Audio', extensions: ['wav', 'mp3', 'ogg', 'm4a', 'flac'] }
      ]
    })
    return result.canceled ? [] : result.filePaths
  })

  handle(IPC.dialogSaveProjectAs, async (event, defaultPath: unknown) => {
    const suggested =
      typeof defaultPath === 'string' && defaultPath
        ? defaultPath
        : join(app.getPath('documents'), `Untitled Project.${PRODUCT.projectExtension}`)
    const result = await dialog.showSaveDialog(dialogParent(event), {
      title: 'Save project as',
      defaultPath: suggested,
      filters: [{ name: PRODUCT.projectFileFilterName, extensions: [PRODUCT.projectExtension] }]
    })
    if (result.canceled || !result.filePath) return null
    return extname(result.filePath).toLowerCase() === `.${PRODUCT.projectExtension}`
      ? result.filePath
      : `${result.filePath}.${PRODUCT.projectExtension}`
  })

  handle(IPC.dialogChooseExportPath, async (event, request: unknown) => {
    const input = (request ?? {}) as Partial<ChooseExportPathRequest>
    const extension = assertString(input.extension, 'Export extension').replace(/^\./, '')
    const name = typeof input.defaultName === 'string' && input.defaultName ? input.defaultName : 'Untitled'
    const result = await dialog.showSaveDialog(dialogParent(event), {
      title: 'Choose export destination',
      defaultPath: join(app.getPath('videos'), `${name}.${extension}`),
      filters: [{ name: input.formatName ?? extension.toUpperCase(), extensions: [extension] }]
    })
    if (result.canceled || !result.filePath) return null
    return extname(result.filePath).toLowerCase() === `.${extension}`
      ? result.filePath
      : `${result.filePath}.${extension}`
  })

  handle(IPC.dialogPickExportDir, async (event) => {
    const result = await dialog.showOpenDialog(dialogParent(event), {
      title: 'Choose a folder for the export',
      buttonLabel: 'Choose folder',
      defaultPath: app.getPath('videos'),
      properties: ['openDirectory', 'createDirectory']
    })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  handle(IPC.exportEngine, () =>
    ffmpegEngine().then((engine) =>
      engine
        ? {
            path: engine.path,
            bundled: engine.bundled,
            version: engine.version,
            canEncodeMp4: engine.encoders.has('libx264') || engine.encoders.has('mpeg4')
          }
        : { path: null, bundled: false, version: null, canEncodeMp4: false }
    )
  )

  handle(IPC.exportPrepare, (_event, request: unknown) => prepareExport(request as ExportPrepareRequest))
  handle(IPC.exportFrame, (_event, request: unknown) => writeExportFrame(request as ExportFrameRequest))
  handle(IPC.exportEncode, (_event, request: unknown) => encodeExport(request as ExportEncodeRequest))
  handle(IPC.exportFinish, (_event, request: unknown) => finishExport(request as ExportFinishRequest))

  handle(IPC.exportReveal, (_event, path: unknown) => {
    const target = assertString(path, 'Path')
    if (!existsSync(target)) throw new Error('That file is no longer there.')
    return shell.openPath(target)
  })

  handle(IPC.projectCreate, (_event, request: unknown) => {
    const input = (request ?? {}) as Partial<CreateProjectRequest>
    const parentDir = assertString(input.parentDir, 'Destination folder')
    const name = safeProjectName(typeof input.name === 'string' ? input.name : 'Untitled Project')
    const document = assertDocument(input.document)
    const created = createProject(parentDir, name, document)
    return {
      filePath: created.session.filePath,
      assetsDir: created.session.assetsDir,
      assetToken: created.session.token,
      document: created.document
    }
  })

  handle(IPC.projectOpen, (_event, filePath: unknown) => {
    const opened = openProject(assertString(filePath, 'Project path'))
    return {
      filePath: opened.session.filePath,
      assetsDir: opened.session.assetsDir,
      assetToken: opened.session.token,
      document: opened.document
    }
  })

  handle(IPC.projectPeek, (_event, filePath: unknown) => {
    const opened = openProject(assertString(filePath, 'Project path'))
    return {
      filePath: opened.session.filePath,
      assetToken: opened.session.token,
      document: opened.document
    }
  })

  handle(IPC.projectSave, (_event, request: unknown) => {
    const input = (request ?? {}) as Partial<SaveProjectRequest>
    return saveProject(assertString(input.filePath, 'Project path'), assertDocument(input.document))
  })

  handle(IPC.projectSaveAs, (_event, request: unknown) => {
    const input = (request ?? {}) as Partial<SaveProjectAsRequest>
    const destination = assertString(input.filePath, 'Destination path')
    const source = typeof input.sourceFilePath === 'string' && input.sourceFilePath ? input.sourceFilePath : null
    const result = saveProjectAs(destination, source, assertDocument(input.document))
    return {
      filePath: result.session.filePath,
      assetsDir: result.session.assetsDir,
      assetToken: result.session.token
    }
  })

  handle(IPC.assetIngest, (_event, request: unknown) => {
    const input = (request ?? {}) as Partial<IngestAssetsRequest>
    const token = assertString(input.assetToken, 'Asset session')
    if (!Array.isArray(input.paths) || input.paths.some((path) => typeof path !== 'string')) {
      throw new Error('A list of file paths is required.')
    }
    return ingestAssets(token, input.paths as string[])
  })

  handle(IPC.assetReadText, (_event, request: unknown) => {
    const input = (request ?? {}) as Partial<ReadAssetRequest>
    return readAssetText(assertString(input.assetToken, 'Asset session'), assertString(input.fileName, 'Asset file'))
  })

  handle(IPC.assetReadBase64, (_event, request: unknown) => {
    const input = (request ?? {}) as Partial<ReadAssetRequest>
    return readAssetBase64(assertString(input.assetToken, 'Asset session'), assertString(input.fileName, 'Asset file'))
  })

  handle(IPC.assetSaveAudio, (_event, request: unknown) => {
    const input = (request ?? {}) as Partial<SaveAudioRequest>
    const token = assertString(input.assetToken, 'Asset session')
    if (!(input.data instanceof Uint8Array)) throw new Error('Recorded audio data is required.')
    const name = typeof input.originalName === 'string' ? input.originalName : 'Voiceover.wav'
    return saveAudioBytes(token, input.data, name)
  })

  handle(IPC.libraryList, () => listLibraryItems())

  handle(IPC.libraryImport, (_event, request: unknown) => {
    const input = (request ?? {}) as { id?: unknown; assetToken?: unknown }
    const id = assertString(input.id, 'Library item')
    const token = assertString(input.assetToken, 'Asset session')
    const found = libraryItemById(id)
    if (!found) throw new Error('That bundled library item is unavailable.')
    return ingestAssets(token, [found.filePath])
  })
}
