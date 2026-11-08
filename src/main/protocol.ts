import { protocol } from 'electron'
import { readFileSync, statSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
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

      const info = statSync(fullPath, { throwIfNoEntry: false })
      if (!info || !info.isFile()) return notFound()

      const data = readFileSync(fullPath)
      return new Response(new Uint8Array(data), {
        status: 200,
        headers: {
          'content-type': assetMimeType(fileName),
          'content-length': String(data.byteLength),
          // WebAudio GainNode playback of boosted tracks needs CORS-clean media.
          'access-control-allow-origin': '*',
          'cache-control': 'public, max-age=31536000, immutable'
        }
      })
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
      const data = readFileSync(fullPath)
      return new Response(new Uint8Array(data), {
        status: 200,
        headers: {
          'content-type': assetMimeType(fullPath),
          'content-length': String(data.byteLength),
          'access-control-allow-origin': '*',
          'cache-control': 'public, max-age=86400'
        }
      })
    } catch (error) {
      log('error', 'Bundled library protocol failure', error)
      return notFound()
    }
  })
}
