import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
) as { version: string }

const define = { __APP_VERSION__: JSON.stringify(pkg.version) }

/**
 * The shipped page has no inline scripts. The dev server needs one exception
 * for React Fast Refresh's inline preamble, so the relaxation exists only in
 * `serve` and never reaches a production build.
 */
const devInlineScripts: Plugin = {
  name: 'openscribe-dev-inline-scripts',
  apply: 'serve',
  transformIndexHtml(html) {
    return html.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
  }
}

const aliases = {
  '@core': resolve('src/core'),
  '@shared': resolve('src/shared'),
  '@renderer': resolve('src/renderer/src'),
  '@fonts': resolve('fonts/index.ts')
}

export default defineConfig({
  main: {
    resolve: { alias: aliases },
    define,
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    resolve: { alias: aliases },
    define,
    plugins: [externalizeDepsPlugin()],
    build: {
      rolldownOptions: {
        output: { format: 'cjs', entryFileNames: '[name].js' }
      }
    }
  },
  renderer: {
    resolve: { alias: aliases },
    define,
    plugins: [react(), devInlineScripts]
  }
})
