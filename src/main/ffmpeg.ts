import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { log } from './logger'

export interface FfmpegEngine {
  path: string
  /** True when the encoder came from inside the app rather than from PATH. */
  bundled: boolean
  version: string | null
  encoders: Set<string>
}

let probed: Promise<FfmpegEngine | null> | null = null

/**
 * The packaged build gets ffmpeg from `extraResources`, which electron-builder
 * drops next to the app binary; a dev checkout reads it straight from the
 * repository. Both are tried before PATH so an export never depends on what
 * happens to be installed on the machine.
 */
function candidates(): Array<{ path: string; bundled: boolean }> {
  const exe = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  const list = [
    { path: join(process.resourcesPath ?? '', 'ffmpeg', exe), bundled: true },
    { path: join(app.getAppPath(), 'resources', 'ffmpeg', exe), bundled: true }
  ]
  if (process.platform !== 'win32') {
    list.push({ path: '/usr/local/bin/ffmpeg', bundled: false }, { path: '/opt/homebrew/bin/ffmpeg', bundled: false })
  }
  return list.filter((candidate) => existsSync(candidate.path))
}

function readEncoders(path: string): Set<string> {
  const result = spawnSync(path, ['-hide_banner', '-encoders'], { encoding: 'utf8', timeout: 15000 })
  const text = result.stdout ?? ''
  const names = new Set<string>()
  for (const line of text.split('\n')) {
    // One encoder per line, marked by the video flag column: " V....D libx264 …".
    const match = /^\s*V[A-Z.]{5}\s+(\S+)/.exec(line)
    if (match?.[1]) names.add(match[1])
  }
  return names
}

function firstLine(value: string | undefined): string | null {
  const line = value?.split('\n')[0]?.trim()
  return line ? line.replace(/^ffmpeg version\s*/, '') : null
}

function probe(): Promise<FfmpegEngine | null> {
  const onPath = candidates()
  const search = process.platform === 'win32' ? 'where' : 'which'
  const lookup = spawnSync(search, ['ffmpeg'], { encoding: 'utf8', timeout: 8000 })
  const fromPath = (lookup.stdout ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && existsSync(line))
    .map((path) => ({ path, bundled: false }))
  for (const candidate of [...onPath, ...fromPath]) {
    const version = spawnSync(candidate.path, ['-hide_banner', '-version'], {
      encoding: 'utf8',
      timeout: 15000
    })
    if (version.status !== 0) continue
    return Promise.resolve({
      ...candidate,
      version: firstLine(version.stdout),
      encoders: readEncoders(candidate.path)
    })
  }
  return Promise.resolve(null)
}

/** Resolved once per process: the binary does not move while the app runs. */
export function ffmpegEngine(): Promise<FfmpegEngine | null> {
  probed ??= probe()
  return probed
}

export interface EncodeOptions {
  framesDir: string
  framePattern: string
  outputPath: string
  fps: number
  quality: number
  format: 'mp4' | 'webm'
}

/**
 * Turn a numbered PNG sequence into a single video. `-framerate` before the
 * input makes each PNG last exactly one frame, so the finished video matches
 * the timeline length rather than the wall clock it took to draw it.
 */
export async function encodeSequence(options: EncodeOptions): Promise<void> {
  const engine = await ffmpegEngine()
  if (!engine) throw new Error('No video encoder is available on this computer.')

  const videoCodec =
    options.format === 'webm'
      ? engine.encoders.has('libvpx-vp9')
        ? ['-c:v', 'libvpx-vp9', '-crf', String(options.quality), '-b:v', '0']
        : ['-c:v', 'libvpx', '-crf', String(options.quality), '-b:v', '2M']
      : engine.encoders.has('libx264')
        ? ['-c:v', 'libx264', '-preset', 'medium', '-crf', String(options.quality)]
        : ['-c:v', 'mpeg4', '-q:v', '4']

  const args = [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-framerate',
    String(options.fps),
    '-i',
    options.framePattern,
    // Half-pixel formats cannot carry an odd edge, and every player wants yuv420p.
    '-vf',
    'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    '-pix_fmt',
    'yuv420p',
    ...videoCodec,
    ...(options.format === 'mp4' ? ['-movflags', '+faststart'] : []),
    options.outputPath
  ]

  await new Promise<void>((resolve, reject) => {
    const child = spawn(engine.path, args, { cwd: options.framesDir, windowsHide: true })
    let stderr = ''
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
      if (stderr.length > 8000) stderr = stderr.slice(-8000)
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`The video encoder failed (${code ?? 'signal'}). ${stderr.trim()}`))
    })
  })
  log('info', `Encoded ${options.format} to ${options.outputPath}`)
}
