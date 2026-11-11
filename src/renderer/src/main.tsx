import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { PRODUCT } from '@shared/product'
import App from './App'
import './styles/index.css'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Renderer crashed', error, info.componentStack)
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="crash-screen" role="alert">
          <div className="crash-card">
            <h1>Something went wrong</h1>
            <p>{this.state.error.message || 'The editor could not start.'}</p>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload the app
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

const container = document.getElementById('root')
if (!container) throw new Error('Renderer root element is missing.')

// The static splash is the first paint, so align its copy with the product
// identity before React takes over.
document.title = PRODUCT.name
const bootBrand = document.querySelector('.boot-brand')
if (bootBrand) bootBrand.textContent = PRODUCT.name
const bootSub = document.querySelector('.boot-sub')
if (bootSub) bootSub.textContent = PRODUCT.tagline

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
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

/* Wait for the display fonts, but never hold the splash hostage to a slow
   font: after two seconds the workspace may appear and fonts can settle in. */
const fontsReady = Promise.race([
  (document.fonts?.ready ?? Promise.resolve()) as Promise<unknown>,
  new Promise((resolve) => window.setTimeout(resolve, 2000))
])

void Promise.all([fontsReady, afterFirstFrame()])
  .then(dismissBootScreen)
  .catch(dismissBootScreen)

// A crash before the first frame must not trap the user behind the splash.
window.addEventListener('error', dismissBootScreen, { once: true })
