import { protocol } from 'electron'
import { createReadStream, statSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { Readable } from 'node:stream'
import { isSafeFileName } from '@core/assets/kinds'
import { PRODUCT } from '@shared/product'
import { assetMimeType } from './assets'
import { log } from './logger'
import { sessionByToken } from './sessions'
import { resolveLibraryPath } from './library'

const SCHEME = PRODUCT.assetScheme
const LIBRARY_SCHEME = PRODUCT.libraryScheme

/**
 * Must run before app readiness so Chromium treats the scheme as secure and
 * fetchable. Kept separate from the handler registration for that reason.
 */
export function registerAssetScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true
      }
    },
    {
      scheme: LIBRARY_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true }
    }
  ])
}

function notFound(): Response {
  return new Response('Asset not found', { status: 404, headers: { 'content-type': 'text/plain' } })
}

interface ByteRange {
  start: number
  end: number
}

function parseRange(header: string | null, total: number): ByteRange | null | 'invalid' {
  if (!header) return null
  const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim())
  if (!match) return 'invalid'
  const [, rawStart = '', rawEnd = ''] = match
  if (!rawStart && !rawEnd) return 'invalid'

  if (!rawStart) {
    // Suffix range: the last `rawEnd` bytes.
    const length = Number(rawEnd)
    if (!Number.isFinite(length) || length <= 0) return 'invalid'
    return { start: Math.max(0, total - length), end: total - 1 }
  }

  const start = Number(rawStart)
  const end = rawEnd ? Number(rawEnd) : total - 1
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= total) {
    return 'invalid'
  }
  return { start, end: Math.min(end, total - 1) }
}

/**
 * Streams a file and honours HTTP range requests. Chromium only treats media
 * as seekable when the source advertises `accept-ranges` and answers partial
 * requests, which is what lets long voiceovers play without being loaded into
 * renderer memory in their entirety.
 */
export function serveFile(request: Request, fullPath: string, cacheControl: string): Response {
  const info = statSync(fullPath, { throwIfNoEntry: false })
  if (!info || !info.isFile()) return notFound()

  const total = info.size
  const range = parseRange(request.headers.get('range'), total)
  const headers: Record<string, string> = {
    'content-type': assetMimeType(fullPath),
    'accept-ranges': 'bytes',
    // WebAudio GainNode playback of boosted tracks needs CORS-clean media.
    'access-control-allow-origin': '*',
    'cache-control': cacheControl
  }

  if (range === 'invalid') {
    return new Response(null, {
      status: 416,
      headers: { ...headers, 'content-range': `bytes */${total}` }
    })
  }

  if (range) {
    const length = range.end - range.start + 1
    const body = Readable.toWeb(createReadStream(fullPath, { start: range.start, end: range.end }))
    return new Response(body as unknown as BodyInit, {
      status: 206,
      headers: {
        ...headers,
        'content-range': `bytes ${range.start}-${range.end}/${total}`,
        'content-length': String(length)
      }
    })
  }

  const body = Readable.toWeb(createReadStream(fullPath))
  return new Response(body as unknown as BodyInit, {
    status: 200,
    headers: { ...headers, 'content-length': String(total) }
  })
}

/**
 * Serves project assets from `ows-asset://asset/<sessionToken>/<fileName>`.
 * The token is an unguessable per-project identifier, so the renderer can
 * reference local files without ever receiving arbitrary filesystem access.
 */
export function registerAssetProtocol(): void {
  protocol.handle(SCHEME, (request) => {
    try {
      const url = new URL(request.url)
      if (url.hostname !== 'asset') return notFound()

      const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)
      if (segments.length !== 2) return notFound()

      const [token, fileName] = segments
      if (!token || !fileName || !isSafeFileName(fileName)) return notFound()

      const session = sessionByToken(token)
      if (!session) return notFound()

      const root = resolve(session.assetsDir)
      const fullPath = resolve(join(root, fileName))
      if (fullPath !== root && !fullPath.startsWith(`${root}${sep}`)) return notFound()

      return serveFile(request, fullPath, 'public, max-age=31536000, immutable')
    } catch (error) {
      log('error', 'Asset protocol failure', error)
      return notFound()
    }
  })

  protocol.handle(LIBRARY_SCHEME, (request) => {
    try {
      const url = new URL(request.url)
      if (url.hostname !== 'asset') return notFound()
      const fullPath = resolveLibraryPath(url.pathname)
      if (!fullPath) return notFound()
      return serveFile(request, fullPath, 'public, max-age=86400')
    } catch (error) {
      log('error', 'Bundled library protocol failure', error)
      return notFound()
    }
  })
}
