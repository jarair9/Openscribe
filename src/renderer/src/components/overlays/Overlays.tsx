import type { JSX } from 'react'
import { CircleCheck, Info, TriangleAlert } from 'lucide-react'
import { useUiStore } from '../../state/uiStore'

export function Overlays(): JSX.Element {
  const busy = useUiStore((state) => state.busy)
  const loading = useUiStore((state) => state.loading)
  const toasts = useUiStore((state) => state.toasts)
  const dismissToast = useUiStore((state) => state.dismissToast)

  return (
    <>
      {busy ? <div className="busy-bar" role="progressbar" aria-label={busy} /> : null}
      {loading ? (
        <div className="loading-scrim" role="status" aria-live="polite" aria-busy="true">
          <div className="loading-card">
            <span className="loading-label">{loading.title}</span>
            <div className="loading-track" aria-hidden="true">
              <div className="loading-bar" />
            </div>
            {loading.detail ? <span className="loading-detail">{loading.detail}</span> : null}
          </div>
        </div>
      ) : null}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <button
            key={toast.id}
            className={`toast ${toast.kind}`}
            onClick={() => dismissToast(toast.id)}
            title="Dismiss"
          >
            <span className="toast-icon">
              {toast.kind === 'success' ? (
                <CircleCheck size={15} />
              ) : toast.kind === 'error' ? (
                <TriangleAlert size={15} />
              ) : (
                <Info size={15} />
              )}
            </span>
            {toast.message}
          </button>
        ))}
      </div>
    </>
  )
}
