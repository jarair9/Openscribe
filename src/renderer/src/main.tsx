import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/index.css'

const container = document.getElementById('root')
if (!container) throw new Error('Renderer root element is missing.')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
)

/* The splash belongs to the document, not to React. Hold it until the app has
   actually committed a frame, otherwise it clears onto a blank window. */
function dismissBootScreen(): void {
  document.body.classList.add('booted')
  window.setTimeout(() => document.getElementById('boot')?.remove(), 320)
}

const afterFirstFrame = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))

void Promise.all([document.fonts?.ready ?? Promise.resolve(), afterFirstFrame()]).then(dismissBootScreen)
