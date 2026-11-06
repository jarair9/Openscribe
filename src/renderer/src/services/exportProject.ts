import type { ExportFormat, ExportResult } from '@shared/ipc'

/** The single frame the export loop is asking the stage to paint. */
export type FrameCapture = (time: number) => Promise<SVGSVGElement | null>

export type ExportPhase = 'frames' | 'encoding' | 'finishing'

export interface ExportProgress {
  phase: ExportPhase
  /** Frames written so far; `total` for the encoding and finishing phases. */
  frame: number
  total: number
}

export class ExportCancelledError extends Error {
  constructor() {
    super('Export cancelled.')
    this.name = 'ExportCancelledError'
  }
}

export function isExportCancelled(error: unknown): boolean {
  return error instanceof ExportCancelledError
}

export interface ExportRequest {
  projectName: string
  /** Folder the user picked; the main process creates the run inside it. */
  dir: string
  format: ExportFormat
  fps: number
  /** x264/vp9 CRF — lower is better and bigger. Ignored for a frames export. */
  quality: number
  keepFrames: boolean
  width: number
  height: number
  duration: number
  captureFrame: FrameCapture
  onProgress(progress: ExportProgress): void
  /** Checked before every frame, so Cancel stops within one frame. */
  cancelled(): boolean
}

/**
 * Draws every frame of the project, hands the PNGs to the main process and
 * runs the encoder. Frames are sampled from a pure schedule, never from wall
 * clock time, so the result is identical no matter how slowly they render.
 */
export async function exportProject(request: ExportRequest): Promise<ExportResult> {
  const total = Math.max(1, Math.round(request.duration * request.fps))
  const session = await window.api.export.prepare({
    dir: request.dir,
    projectName: request.projectName,
    format: request.format
  })

  try {
    const canvas = new OffscreenCanvas(request.width, request.height)
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) throw new Error('The app could not open a drawing surface for the export.')
    const assets = new Map<string, Promise<string>>()

    for (let index = 0; index < total; index += 1) {
      if (request.cancelled()) throw new ExportCancelledError()
      const svg = await request.captureFrame(index / request.fps)
      if (!svg) throw new Error('The export lost its drawing stage. Close and reopen Export.')
      const png = await rasterize(svg, request.width, request.height, assets, canvas, context)
      await window.api.export.frame({ id: session.id, index, data: png })
      request.onProgress({ phase: 'frames', frame: index + 1, total })
    }

    if (request.format !== 'frames') {
      request.onProgress({ phase: 'encoding', frame: total, total })
      await window.api.export.encode({
        id: session.id,
        format: request.format,
        fps: request.fps,
        quality: request.quality
      })
    }

    request.onProgress({ phase: 'finishing', frame: total, total })
    return await window.api.export.finish({ id: session.id, keepFrames: request.keepFrames })
  } catch (error) {
    await window.api.export
      .finish({ id: session.id, keepFrames: true, abandon: true })
      .catch(() => {})
    throw error
  }
}

/**
 * An SVG rasterised as an image can only see what is inside the file, so every
 * external asset has to be inlined as a data URL first. Fonts need no such
 * treatment: handwriting is already vector strokes and everything else is a
 * family the system provides.
 */
async function rasterize(
  svg: SVGSVGElement,
  width: number,
  height: number,
  assets: Map<string, Promise<string>>,
  canvas: OffscreenCanvas,
  context: OffscreenCanvasRenderingContext2D
): Promise<Uint8Array> {
  const clone = svg.cloneNode(true) as SVGSVGElement
  await inlineImages(clone, assets)
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))

  const markup = new XMLSerializer().serializeToString(clone)
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const image = await loadImage(url)
    context.clearRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)
    const blob = await canvas.convertToBlob({ type: 'image/png' })
    return new Uint8Array(await blob.arrayBuffer())
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function inlineImages(root: SVGSVGElement, assets: Map<string, Promise<string>>): Promise<void> {
  const images = Array.from(root.querySelectorAll('image')).filter((image) => {
    const href = image.getAttribute('href') ?? ''
    return href !== '' && !href.startsWith('data:')
  })
  await Promise.all(
    images.map(async (image) => {
      const href = image.getAttribute('href')!
      let pending = assets.get(href)
      if (!pending) {
        pending = toDataUrl(href)
        assets.set(href, pending)
      }
      try {
        image.setAttribute('href', await pending)
      } catch {
        // A missing asset should not take the whole export down with it.
        image.remove()
      }
    })
  )
}

function toDataUrl(url: string): Promise<string> {
  return fetch(url)
    .then(async (response) => {
      if (!response.ok) throw new Error(`Asset unavailable: ${response.status}`)
      return response.blob()
    })
    .then(
      (blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result))
          reader.onerror = () => reject(reader.error)
          reader.readAsDataURL(blob)
        })
    )
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('A frame could not be decoded.'))
    image.src = url
  })
}
