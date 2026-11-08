import { useEffect, useRef, type JSX, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface DialogProps {
  title: string
  subtitle?: string
  wide?: boolean
  children: ReactNode
  footer?: ReactNode
  onClose: () => void
}

const FOCUSABLE =
  'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

export function Dialog({
  title,
  subtitle,
  wide,
  children,
  footer,
  onClose
}: DialogProps): JSX.Element {
  const surfaceRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const surface = surfaceRef.current
    const first =
      surface?.querySelector<HTMLElement>(`.dialog-body ${FOCUSABLE}`) ??
      surface?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? surface)?.focus()

    return () => {
      previous?.focus()
    }
  }, [])

  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const surface = surfaceRef.current
      if (!surface) return
      const items = Array.from(surface.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (item) => item.offsetParent !== null || item === document.activeElement
      )
      if (items.length === 0) {
        event.preventDefault()
        surface.focus()
        return
      }
      const first = items[0]!
      const last = items[items.length - 1]!
      if (event.shiftKey && (document.activeElement === first || document.activeElement === surface)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="overlay"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={surfaceRef}
        className={`dialog ${wide ? 'wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="dialog-header">
          <div>
            <h2 className="dialog-title">{title}</h2>
            {subtitle ? <p className="dialog-subtitle">{subtitle}</p> : null}
          </div>
          <button className="icon-btn" title="Close" aria-label="Close dialog" onClick={onClose}>
            <X size={15} />
          </button>
        </div>
        <div className="dialog-body">{children}</div>
        {footer ? <div className="dialog-footer">{footer}</div> : null}
      </div>
    </div>
  )
}
