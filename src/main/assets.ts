import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, extname, join, resolve, sep } from 'node:path'
import {
  assetKindOf,
  extensionOf,
  isSafeFileName,
  MIME_BY_EXTENSION,
  type AssetKind
} from '@core/assets/kinds'
import type { IngestedFile, IngestAssetsResult } from '@shared/ipc'
import { log } from './logger'
import { sessionByToken, type ProjectSession } from './sessions'

const MAX_BYTES: Record<AssetKind, number> = {
  svg: 24 * 1024 * 1024,
  image: 64 * 1024 * 1024,
  audio: 256 * 1024 * 1024
}

const SVG_TEXT_LIMIT = 16 * 1024 * 1024
const AUDIO_BASE64_LIMIT = 24 * 1024 * 1024

export class AssetError extends Error {}

function reject(reason: string): never {
  throw new AssetError(reason)
}

function session(token: string): ProjectSession {
  const found = sessionByToken(token)
  if (!found) reject('The project session has expired. Reopen the project and try again.')
  return found
}

/* ------------------------------------------------------------------ */
/* Content sniffing                                                   */
/* ------------------------------------------------------------------ */

function startsWith(buffer: Buffer, bytes: number[]): boolean {
  if (buffer.length < bytes.length) return false
  return bytes.every((value, index) => buffer[index] === value)
}

function ascii(buffer: Buffer, start: number, length: number): string {
  return buffer.subarray(start, start + length).toString('latin1')
}

/** Verifies that a file's signature matches the format its extension claims. */
function contentMatchesExtension(buffer: Buffer, extension: string): boolean {
  switch (extension) {
    case '.svg': {
      const head = buffer.subarray(0, 4096).toString('utf8').replace(/^\uFEFF/, '').trimStart()
      if (/^<\?xml/i.test(head) || /^<!--/.test(head) || /^<!DOCTYPE/i.test(head)) {
        return /<svg[\s>]/i.test(buffer.subarray(0, 16 * 1024).toString('utf8'))
      }
      return /^<svg[\s>]/i.test(head)
    }
    case '.png':
      return startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    case '.jpg':
    case '.jpeg':
      return startsWith(buffer, [0xff, 0xd8, 0xff])
    case '.gif':
      return ascii(buffer, 0, 6) === 'GIF87a' || ascii(buffer, 0, 6) === 'GIF89a'
    case '.webp':
      return ascii(buffer, 0, 4) === 'RIFF' && ascii(buffer, 8, 4) === 'WEBP'
    case '.wav':
      return ascii(buffer, 0, 4) === 'RIFF' && ascii(buffer, 8, 4) === 'WAVE'
    case '.mp3':
      return ascii(buffer, 0, 3) === 'ID3' || (buffer.length > 1 && buffer[0] === 0xff && (buffer[1]! & 0xe0) === 0xe0)
    case '.ogg':
      return ascii(buffer, 0, 4) === 'OggS'
    case '.flac':
      return ascii(buffer, 0, 4) === 'fLaC'
    case '.m4a':
      return ascii(buffer, 4, 4) === 'ftyp'
    default:
      return false
  }
}

function describe(extension: string): string {
  return extension.replace('.', '').toUpperCase()
}

/* ------------------------------------------------------------------ */
/* Ingestion                                                          */
/* ------------------------------------------------------------------ */

interface StoredFile {
  fileName: string
  byteSize: number
  contentHash: string
  deduped: boolean
}

function storeBuffer(session: ProjectSession, buffer: Buffer, extension: string): StoredFile {
  const contentHash = createHash('sha256').update(buffer).digest('hex')
  const fileName = `${contentHash.slice(0, 24)}${extension}`
  const destination = join(session.assetsDir, fileName)
  mkdirSync(session.assetsDir, { recursive: true })

  const deduped = existsSync(destination)
  if (!deduped) writeFileSync(destination, buffer)

  return { fileName, byteSize: buffer.length, contentHash, deduped }
}

function ingestOne(session: ProjectSession, sourcePath: string): IngestedFile {
  const info = statSync(sourcePath, { throwIfNoEntry: false })
  if (!info || !info.isFile()) reject('The file does not exist or is not a regular file.')

  const extension = extensionOf(sourcePath)
  const kind = assetKindOf(sourcePath)
  if (!kind) reject(`Unsupported file type “${extension || basename(sourcePath)}”.`)

  if (info.size === 0) reject('The file is empty.')
  if (info.size > MAX_BYTES[kind]) {
    reject(`The file exceeds the ${Math.round(MAX_BYTES[kind] / (1024 * 1024))} MB limit for ${kind} files.`)
  }

  const buffer = readFileSync(sourcePath)
  if (!contentMatchesExtension(buffer, extension)) {
    reject(`The file content does not match the ${describe(extension)} format.`)
  }

  const stored = storeBuffer(session, buffer, extension)

  return {
    kind,
    fileName: stored.fileName,
    originalName: basename(sourcePath),
    mimeType: MIME_BY_EXTENSION[extension] ?? 'application/octet-stream',
    byteSize: stored.byteSize,
    contentHash: stored.contentHash,
    deduped: stored.deduped,
    text: kind === 'svg' && buffer.length <= SVG_TEXT_LIMIT ? buffer.toString('utf8') : null,
    dataBase64: kind === 'audio' && buffer.length <= AUDIO_BASE64_LIMIT ? buffer.toString('base64') : null
  }
}

export function saveAudioBytes(
  assetToken: string,
  data: Uint8Array,
  originalName: string
): IngestedFile {
  const project = session(assetToken)
  if (!(data instanceof Uint8Array) || data.byteLength === 0) {
    reject('The recording is empty.')
  }
  if (data.byteLength > MAX_BYTES.audio) {
    reject(`The recording exceeds the ${Math.round(MAX_BYTES.audio / (1024 * 1024))} MB limit.`)
  }

  const buffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength)
  if (!contentMatchesExtension(buffer, '.wav')) {
    reject('The recording is not valid WAV audio.')
  }

  const stored = storeBuffer(project, buffer, '.wav')
  const trimmed = typeof originalName === 'string' ? basename(originalName.trim()) : ''
  return {
    kind: 'audio',
    fileName: stored.fileName,
    originalName: (trimmed || 'Voiceover.wav').slice(0, 160),
    mimeType: 'audio/wav',
    byteSize: stored.byteSize,
    contentHash: stored.contentHash,
    deduped: stored.deduped,
    text: null,
    dataBase64: null
  }
}

export function ingestAssets(assetToken: string, paths: string[]): IngestAssetsResult {
  const project = session(assetToken)
  if (!Array.isArray(paths) || paths.length === 0) reject('No files were selected.')
  if (paths.length > 200) reject('Too many files were selected at once.')

  const files: IngestedFile[] = []
  const rejected: IngestAssetsResult['rejected'] = []

  for (const path of paths) {
    try {
      if (typeof path !== 'string' || !path) throw new AssetError('Invalid file path.')
      files.push(ingestOne(project, path))
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'The file could not be imported.'
      log('warn', 'Asset import rejected', { path, reason })
      rejected.push({ path: String(path), reason })
    }
  }

  return { files, rejected }
}

/* ------------------------------------------------------------------ */
/* Asset access                                                       */
/* ------------------------------------------------------------------ */

function resolveAssetPath(assetToken: string, fileName: string): string {
  const project = session(assetToken)
  if (!isSafeFileName(fileName)) reject('Invalid asset file name.')
  const root = resolve(project.assetsDir)
  const full = resolve(join(root, fileName))
  if (full !== root && !full.startsWith(`${root}${sep}`)) reject('Invalid asset path.')
  const info = statSync(full, { throwIfNoEntry: false })
  if (!info || !info.isFile()) reject('The asset file is missing. It may have been moved or deleted.')
  return full
}

export function readAssetText(assetToken: string, fileName: string): string {
  const full = resolveAssetPath(assetToken, fileName)
  const info = statSync(full)
  if (info.size > SVG_TEXT_LIMIT) reject('The asset is too large to read as text.')
  return readFileSync(full, 'utf8')
}

export function readAssetBase64(assetToken: string, fileName: string): string {
  const full = resolveAssetPath(assetToken, fileName)
  const info = statSync(full)
  if (info.size > 96 * 1024 * 1024) reject('The asset is too large to read in one request.')
  return readFileSync(full).toString('base64')
}

export function assetMimeType(fileName: string): string {
  return MIME_BY_EXTENSION[extname(fileName).toLowerCase()] ?? 'application/octet-stream'
}
