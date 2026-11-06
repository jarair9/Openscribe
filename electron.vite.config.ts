import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const aliases = {
  '@core': resolve('src/core'),
  '@shared': resolve('src/shared'),
  '@renderer': resolve('src/renderer/src'),
  '@fonts': resolve('fonts/index.ts')
}

export default defineConfig({
  main: {
    resolve: { alias: aliases },
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    resolve: { alias: aliases },
    plugins: [externalizeDepsPlugin()],
    build: {
      rolldownOptions: {
        output: { format: 'cjs', entryFileNames: '[name].js' }
      }
    }
  },
  renderer: {
    resolve: { alias: aliases },
    plugins: [react()]
  }
})
