export type AssetKind = 'svg' | 'image' | 'audio'

export const ASSET_KIND_BY_EXTENSION: Record<string, AssetKind> = {
  '.svg': 'svg',
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.gif': 'image',
  '.webp': 'image',
  '.wav': 'audio',
  '.mp3': 'audio',
  '.ogg': 'audio',
  '.m4a': 'audio',
  '.flac': 'audio'
}

export const MIME_BY_EXTENSION: Record<string, string> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.flac': 'audio/flac'
}

export const AUDIO_EXTENSIONS = new Set(['.wav', '.mp3', '.ogg', '.m4a', '.flac'])

export const IMAGE_EXTENSIONS: Record<string, string> = {
  '.png': 'png',
  '.jpg': 'jpeg',
  '.jpeg': 'jpeg',
  '.gif': 'gif',
  '.webp': 'webp'
}

export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot === -1 ? '' : fileName.slice(dot).toLowerCase()
}

export function assetKindOf(fileName: string): AssetKind | null {
  return ASSET_KIND_BY_EXTENSION[extensionOf(fileName)] ?? null
}

/** A filename is considered safe when it cannot address another directory. */
export function isSafeFileName(fileName: string): boolean {
  if (!fileName || fileName.length > 255) return false
  if (fileName.includes('/') || fileName.includes('\\')) return false
  if (fileName === '.' || fileName === '..') return false
  return /^[\w .-]+$/.test(fileName)
}
