import type { Project } from '@core/schema/project'
import type { AssetKind } from '@core/assets/kinds'

/**
 * Every privileged operation the renderer is allowed to request. The preload
 * bridge exposes exactly these channels and nothing else.
 */
export const IPC = {
  appInfo: 'app:info',
  openLogsFolder: 'app:open-logs',

  windowMinimize: 'window:minimize',
  windowToggleMaximize: 'window:toggle-maximize',
  windowClose: 'window:close',
  windowStateChanged: 'window:state-changed',

  dialogPickParentDir: 'dialog:pick-parent-dir',
  dialogOpenProject: 'dialog:open-project',
  dialogImportAssets: 'dialog:import-assets',
  dialogSaveProjectAs: 'dialog:save-project-as',
  dialogChooseExportPath: 'dialog:choose-export-path',
  dialogPickExportDir: 'dialog:pick-export-dir',

  exportEngine: 'export:engine',
  exportPrepare: 'export:prepare',
  exportFrame: 'export:frame',
  exportEncode: 'export:encode',
  exportFinish: 'export:finish',
  exportReveal: 'export:reveal',

  projectCreate: 'project:create',
  projectOpen: 'project:open',
  projectPeek: 'project:peek',
  projectSave: 'project:save',
  projectSaveAs: 'project:save-as',

  assetIngest: 'asset:ingest',
  assetReadText: 'asset:read-text',
  assetReadBase64: 'asset:read-base64',
  assetSaveAudio: 'asset:save-audio',
  libraryList: 'library:list',
  libraryImport: 'library:import'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]

export interface AppInfo {
  productName: string
  version: string
  platform: string
  isDev: boolean
  userDataDir: string
  logsDir: string
}

export interface WindowState {
  maximized: boolean
  focused: boolean
}

/** A project opened by the main process; the token scopes asset access. */
export interface SessionInfo {
  filePath: string
  assetsDir: string
  assetToken: string
}

export interface OpenedProject extends SessionInfo {
  document: Project
}

/** Read-only project document for a thumbnail; no editor session is implied. */
export interface PeekedProject {
  filePath: string
  assetToken: string
  document: Project
}

export interface CreateProjectRequest {
  parentDir: string
  name: string
  document: Project
}

export interface SaveProjectRequest {
  filePath: string
  document: Project
}

export interface SaveProjectResult {
  savedAt: string
}

export interface SaveProjectAsRequest {
  /** Destination file path chosen through the save dialog. */
  filePath: string
  /** Current project file, used to carry existing assets along. */
  sourceFilePath: string | null
  document: Project
}

export interface IngestAssetsRequest {
  assetToken: string
  paths: string[]
}

export interface ReadAssetRequest {
  assetToken: string
  fileName: string
}

/** Audio recorded in the renderer, saved as WAV into the project asset folder. */
export interface SaveAudioRequest {
  assetToken: string
  data: Uint8Array
  originalName: string
}

export interface IngestedFile {
  kind: AssetKind
  /** Stored file name inside the project's assets directory. */
  fileName: string
  originalName: string
  mimeType: string
  byteSize: number
  contentHash: string
  deduped: boolean
  /** Present for SVG files below the text payload limit. */
  text: string | null
  /** Present for audio files below the binary payload limit. */
  dataBase64: string | null
}

export interface IngestAssetsResult {
  files: IngestedFile[]
  rejected: Array<{ path: string; reason: string }>
}

export interface LibraryItem {
  id: string
  name: string
  category: 'hands' | 'hand-and-pen-tools' | 'characters' | 'illustration-styles' | 'illustrations' | 'ui-icons'
  group: string
  relativePath: string
  kind: 'svg' | 'image'
}

export interface ChooseExportPathRequest {
  defaultName: string
  extension: string
  formatName: string
}

/** What the user asked for: one video file, or the PNG frames themselves. */
export type ExportFormat = 'mp4' | 'webm' | 'frames'

export interface ExportEngineInfo {
  /** Encoder that will run, or null when there is none on this machine. */
  path: string | null
  /** True when the encoder ships inside the app instead of coming from PATH. */
  bundled: boolean
  version: string | null
  /** Whether this build can write mp4 files. */
  canEncodeMp4: boolean
}

export interface ExportPrepareRequest {
  /** Folder the user picked; the export creates a run folder inside it. */
  dir: string
  projectName: string
  format: ExportFormat
}

export interface ExportSession {
  id: string
  /** The folder the user picked; finished files are written straight into it. */
  folder: string
  /** Where the PNG frames are written, cleaned up after encoding unless kept. */
  framesDir: string
  /** The video path the encoder will produce, so the UI can name it up front. */
  videoPath: string
  /** printf pattern ffmpeg reads the sequence with. */
  framePattern: string
}

export interface ExportFrameRequest {
  id: string
  /** Zero-based frame index; files are written one-based to match ffmpeg. */
  index: number
  data: Uint8Array
}

export interface ExportEncodeRequest {
  id: string
  format: Exclude<ExportFormat, 'frames'>
  fps: number
  /** x264/vp9 CRF: lower is better quality and bigger files. */
  quality: number
}

export interface ExportFinishRequest {
  id: string
  /** Leave the PNG sequence in place so it can be re-encoded by hand. */
  keepFrames: boolean
  /** The run was cancelled: discard partial output and report nothing. */
  abandon?: boolean
}

export interface ExportResult {
  folder: string
  /** The video file, or null for a frames-only export. */
  filePath: string | null
  frameCount: number
  /** Size of the delivered file, or of the frames folder for a frames export. */
  bytes: number | null
}
