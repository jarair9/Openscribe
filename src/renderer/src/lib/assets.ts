import type { PathMeasurement } from '@core/svg/measure'
import type { Rect } from '@core/schema/primitives'

/** Builds the token-scoped URL handled by the main process asset protocol. */
export function assetUrl(token: string, fileName: string): string {
  return `ows-asset://asset/${encodeURIComponent(token)}/${encodeURIComponent(fileName)}`
}

export function libraryAssetUrl(relativePath: string): string {
  const encoded = relativePath.split('/').map((part) => encodeURIComponent(part)).join('/')
  return `ows-library://asset/${encoded}`
}

/**
 * Raw asset bytes for in-memory playback: protocol fetch first, IPC base64
 * fallback when the custom scheme is not fetchable in the current context.
 */
export async function readAssetBytes(token: string, fileName: string): Promise<ArrayBuffer> {
  try {
    const response = await fetch(assetUrl(token, fileName))
    if (response.ok) return await response.arrayBuffer()
  } catch {
    // Fall through to the IPC read below.
  }
  const base64 = await window.api.assets.readBase64(token, fileName)
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes.buffer
}

let measureHost: SVGSVGElement | null = null

function host(): SVGSVGElement {
  if (measureHost && measureHost.isConnected) return measureHost
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('width', '0')
  svg.setAttribute('height', '0')
  svg.style.position = 'absolute'
  svg.style.width = '0'
  svg.style.height = '0'
  svg.style.overflow = 'hidden'
  svg.style.opacity = '0'
  svg.style.pointerEvents = 'none'
  svg.setAttribute('aria-hidden', 'true')
  document.body.appendChild(svg)
  measureHost = svg
  return svg
}

/** Exact path length and bounds using the browser's SVG geometry engine. */
export function measureSvgPath(d: string): PathMeasurement {
  const svg = host()
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', d)
  svg.appendChild(path)
  try {
    const box = path.getBBox()
    const length = path.getTotalLength()
    if (!Number.isFinite(length)) throw new Error('Unmeasurable path')
    return {
      length,
      bbox: {
        x: box.x,
        y: box.y,
        width: Math.max(0.001, box.width),
        height: Math.max(0.001, box.height)
      }
    }
  } finally {
    path.remove()
  }
}

export function loadImageSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      if (!image.naturalWidth || !image.naturalHeight) {
        reject(new Error('The image has no readable dimensions.'))
        return
      }
      resolve({ width: image.naturalWidth, height: image.naturalHeight })
    }
    image.onerror = () => reject(new Error('The image could not be decoded.'))
    image.src = url
  })
}

export function loadAudioDuration(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio()
    const timeout = window.setTimeout(() => {
      cleanup()
      reject(new Error('Timed out while reading the audio file.'))
    }, 15_000)

    function cleanup(): void {
      window.clearTimeout(timeout)
      audio.removeAttribute('src')
      audio.load()
    }

    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0
      cleanup()
      if (duration <= 0) reject(new Error('The audio duration could not be determined.'))
      else resolve(duration)
    }
    audio.onerror = () => {
      cleanup()
      reject(new Error('The audio file could not be decoded.'))
    }
    audio.src = url
  })
}

/** Visible bounding box of the artwork inside an SVG viewBox. */
export function contentRectOf(viewBox: Rect, drawableBounds: Rect[]): Rect {
  if (drawableBounds.length === 0) return viewBox
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const box of drawableBounds) {
    minX = Math.min(minX, box.x)
    minY = Math.min(minY, box.y)
    maxX = Math.max(maxX, box.x + box.width)
    maxY = Math.max(maxY, box.y + box.height)
  }
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY)
  }
}
