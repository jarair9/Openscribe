import { randomUUID } from 'node:crypto'
import { mkdir, rm, stat, writeFile } from 'node:fs/promises'
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type {
  ExportEncodeRequest,
  ExportFinishRequest,
  ExportFormat,
  ExportFrameRequest,
  ExportPrepareRequest,
  ExportResult,
  ExportSession
} from '@shared/ipc'
import { encodeSequence } from './ffmpeg'
import { log } from './logger'
import { safeProjectName } from './projectStore'

const FRAME_PATTERN = 'frame_%05d.png'

interface ExportRun {
  folder: string
  framesDir: string
  videoPath: string
  format: ExportFormat
  frames: number
  bytes: number
}

const runs = new Map<string, ExportRun>()

function assertFolder(dir: string): string {
  if (typeof dir !== 'string' || !dir) throw new Error('No export folder was selected.')
  const info = statSync(dir, { throwIfNoEntry: false })
  if (!info || !info.isDirectory()) throw new Error('The export folder does not exist.')
  return dir
}

/** `<base> 2`, `<base> 3`… so a repeat export never lands on top of the last one. */
function uniqueChild(parent: string, base: string, isFile: boolean): string {
  let candidate = join(parent, base)
  let counter = 2
  while (existsSync(candidate)) {
    candidate = join(parent, isFile ? `${base.replace(/\.[^.]+$/, '')} ${counter}` : `${base} ${counter}`)
    counter += 1
  }
  return candidate
}

export async function prepareExport(request: ExportPrepareRequest): Promise<ExportSession> {
  const folder = assertFolder(request.dir)
  const baseName = safeProjectName(request.projectName)
  const framesDir = uniqueChild(folder, `${baseName} frames`, false)
  await mkdir(framesDir, { recursive: true })

  const extension = request.format === 'webm' ? 'webm' : 'mp4'
  const videoPath =
    request.format === 'frames' ? '' : uniqueChild(folder, `${baseName}.${extension}`, true)
  const id = randomUUID()
  runs.set(id, { folder, framesDir, videoPath, format: request.format, frames: 0, bytes: 0 })
  return { id, folder, framesDir, videoPath, framePattern: FRAME_PATTERN }
}

/** One PNG at a time: the renderer only produces them as fast as it can draw them. */
export async function writeExportFrame(request: ExportFrameRequest): Promise<void> {
  const run = runs.get(request.id)
  if (!run) throw new Error('The export is no longer running.')
  if (!Number.isInteger(request.index) || request.index < 0) {
    throw new Error('Frame index out of range.')
  }
  const bytes = new Uint8Array(request.data)
  const name = FRAME_PATTERN.replace('%05d', String(request.index + 1).padStart(5, '0'))
  await writeFile(join(run.framesDir, name), bytes)
  run.frames += 1
  run.bytes += bytes.byteLength
}

export async function encodeExport(request: ExportEncodeRequest): Promise<void> {
  const run = runs.get(request.id)
  if (!run) throw new Error('The export is no longer running.')
  if (!run.videoPath) throw new Error('This export does not produce a video file.')
  if (run.frames === 0) throw new Error('No frames were rendered for this export.')
  await encodeSequence({
    framesDir: run.framesDir,
    framePattern: FRAME_PATTERN,
    outputPath: run.videoPath,
    fps: Math.max(1, Math.round(request.fps)),
    quality: Math.round(request.quality),
    format: request.format
  })
}

export async function finishExport(request: ExportFinishRequest): Promise<ExportResult> {
  const run = runs.get(request.id)
  if (!run) throw new Error('The export is no longer running.')
  runs.delete(request.id)

  if (request.abandon) {
    await rm(run.framesDir, { recursive: true, force: true }).catch((error) =>
      log('warn', 'Could not clean up a cancelled export', error)
    )
    if (run.videoPath) {
      await rm(run.videoPath, { force: true }).catch((error) =>
        log('warn', 'Could not remove a partial video file', error)
      )
    }
    return { folder: run.folder, filePath: null, frameCount: run.frames, bytes: null }
  }

  if (run.format !== 'frames' && !request.keepFrames) {
    await rm(run.framesDir, { recursive: true, force: true }).catch((error) =>
      log('warn', 'Could not clean up export frames', error)
    )
  }

  let bytes = run.bytes
  if (run.videoPath) {
    const info = await stat(run.videoPath).catch(() => null)
    if (!info || info.size === 0) throw new Error('The encoder produced an empty video file.')
    bytes = info.size
  }

  return {
    folder: run.folder,
    filePath: run.videoPath || null,
    frameCount: run.frames,
    bytes
  }
}
