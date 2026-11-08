import type {
  AppInfo,
  ChooseExportPathRequest,
  CreateProjectRequest,
  ExportEncodeRequest,
  ExportEngineInfo,
  ExportFinishRequest,
  ExportFrameRequest,
  ExportPrepareRequest,
  ExportResult,
  ExportSession,
  IngestAssetsResult,
  LibraryItem,
  OpenedProject,
  PeekedProject,
  SaveProjectAsRequest,
  SaveProjectRequest,
  SaveProjectResult,
  SessionInfo,
  WindowState
} from './ipc'

/** The complete privileged surface exposed to the renderer by the preload. */
export interface StudioApi {
  app: {
    info(): Promise<AppInfo>
    openLogsFolder(): Promise<void>
  }
  files: {
    /** Resolves the on-disk path of a dropped File (Electron webUtils). */
    pathForFile(file: File): string
  }
  window: {
    minimize(): void
    toggleMaximize(): void
    close(): void
    onStateChanged(listener: (state: WindowState) => void): () => void
  }
  dialogs: {
    pickParentDir(): Promise<string | null>
    openProject(): Promise<string | null>
    importAssets(): Promise<string[]>
    saveProjectAs(defaultPath: string | null): Promise<string | null>
    chooseExportPath(request: ChooseExportPathRequest): Promise<string | null>
    pickExportDir(): Promise<string | null>
  }
  export: {
    engine(): Promise<ExportEngineInfo>
    prepare(request: ExportPrepareRequest): Promise<ExportSession>
    frame(request: ExportFrameRequest): Promise<void>
    encode(request: ExportEncodeRequest): Promise<void>
    finish(request: ExportFinishRequest): Promise<ExportResult>
    reveal(path: string): Promise<void>
  }
  project: {
    create(request: CreateProjectRequest): Promise<OpenedProject>
    open(filePath: string): Promise<OpenedProject>
    peek(filePath: string): Promise<PeekedProject>
    save(request: SaveProjectRequest): Promise<SaveProjectResult>
    saveAs(request: SaveProjectAsRequest): Promise<SessionInfo>
  }
  assets: {
    ingest(assetToken: string, paths: string[]): Promise<IngestAssetsResult>
    readText(assetToken: string, fileName: string): Promise<string>
    readBase64(assetToken: string, fileName: string): Promise<string>
    saveAudio(
      assetToken: string,
      data: Uint8Array,
      originalName: string
    ): Promise<IngestAssetsResult['files'][number]>
  }
  library: {
    list(): Promise<LibraryItem[]>
    importAsset(id: string, assetToken: string): Promise<IngestAssetsResult>
  }
}
