import type { JSX } from 'react'
import { useUiStore } from '../../state/uiStore'
import { Dialog } from './Dialog'

export function ConfirmDialog(): JSX.Element | null {
  const confirm = useUiStore((state) => state.confirm)
  const resolveConfirm = useUiStore((state) => state.resolveConfirm)
  if (!confirm) return null

  return (
    <Dialog
      title={confirm.title}
      onClose={() => resolveConfirm(false)}
      footer={
        <>
          <button className="btn" onClick={() => resolveConfirm(false)}>
            Cancel
          </button>
          <button
            className={`btn ${confirm.tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            autoFocus
            onClick={() => resolveConfirm(true)}
          >
            {confirm.confirmLabel}
          </button>
        </>
      }
    >
      <p className="confirm-message">{confirm.message}</p>
    </Dialog>
  )
}
