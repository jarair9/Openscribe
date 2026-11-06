import { contextBridge, ipcRenderer } from 'electron'
import type { StudioApi } from '@shared/api'
import {
  IPC,
  type ChooseExportPathRequest,
  type CreateProjectRequest,
  type ExportEncodeRequest,
  type ExportFinishRequest,
  type ExportFrameRequest,
  type ExportPrepareRequest,
  type ExportResult,
  type ExportSession,
  type IngestAssetsResult,
  type OpenedProject,
  type PeekedProject,
  type SaveProjectAsRequest,
  type SaveProjectRequest,
  type SaveProjectResult,
  type SessionInfo,
  type WindowState
} from '@shared/ipc'

const REMOTE_PREFIX = /^Error invoking remote method '[^']*':\s*(?:Error:\s*)?/

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  try {
    return (await ipcRenderer.invoke(channel, ...args)) as T
  } catch (error) {
    const raw = error instanceof Error ? error.message : 'The operation failed.'
    throw new Error(raw.replace(REMOTE_PREFIX, ''))
  }
}

const api: StudioApi = {
  app: {
    info: () => invoke('app:info'),
    openLogsFolder: () => invoke('app:open-logs')
  },
  window: {
    minimize: () => ipcRenderer.send(IPC.windowMinimize),
    toggleMaximize: () => ipcRenderer.send(IPC.windowToggleMaximize),
    close: () => ipcRenderer.send(IPC.windowClose),
    onStateChanged: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, state: WindowState): void => listener(state)
      ipcRenderer.on(IPC.windowStateChanged, handler)
      return () => ipcRenderer.removeListener(IPC.windowStateChanged, handler)
    }
  },
  dialogs: {
    pickParentDir: () => invoke('dialog:pick-parent-dir'),
    openProject: () => invoke('dialog:open-project'),
    importAssets: () => invoke('dialog:import-assets'),
    saveProjectAs: (defaultPath) => invoke('dialog:save-project-as', defaultPath),
    chooseExportPath: (request: ChooseExportPathRequest) => invoke('dialog:choose-export-path', request),
    pickExportDir: () => invoke('dialog:pick-export-dir')
  },
  export: {
    engine: () => invoke('export:engine'),
    prepare: (request: ExportPrepareRequest) => invoke<ExportSession>('export:prepare', request),
    frame: (request: ExportFrameRequest) => invoke<void>('export:frame', request),
    encode: (request: ExportEncodeRequest) => invoke<void>('export:encode', request),
    finish: (request: ExportFinishRequest) => invoke<ExportResult>('export:finish', request),
    reveal: (path: string) => invoke<void>('export:reveal', path)
  },
  project: {
    create: (request: CreateProjectRequest) => invoke<OpenedProject>('project:create', request),
    open: (filePath: string) => invoke<OpenedProject>('project:open', filePath),
    peek: (filePath: string) => invoke<PeekedProject>('project:peek', filePath),
    save: (request: SaveProjectRequest) => invoke<SaveProjectResult>('project:save', request),
    saveAs: (request: SaveProjectAsRequest) => invoke<SessionInfo>('project:save-as', request)
  },
  assets: {
    ingest: (assetToken: string, paths: string[]) =>
      invoke<IngestAssetsResult>('asset:ingest', { assetToken, paths }),
    readText: (assetToken: string, fileName: string) =>
      invoke<string>('asset:read-text', { assetToken, fileName }),
    readBase64: (assetToken: string, fileName: string) =>
      invoke<string>('asset:read-base64', { assetToken, fileName }),
    saveAudio: (assetToken: string, data: Uint8Array, originalName: string) =>
      invoke<IngestAssetsResult['files'][number]>('asset:save-audio', {
        assetToken,
        data,
        originalName
      })
  },
  library: {
    list: () => invoke('library:list'),
    importAsset: (id: string, assetToken: string) =>
      invoke('library:import', { id, assetToken })
  }
}

contextBridge.exposeInMainWorld('api', api)
