import { useEffect, useState } from 'react'
import type { WindowState } from '@shared/ipc'

/** Tracks maximize/focus state broadcast by the main process. */
export function useWindowState(): WindowState {
  const [state, setState] = useState<WindowState>({ maximized: false, focused: true })

  useEffect(() => {
    const dispose = window.api.window.onStateChanged(setState)
    return dispose
  }, [])

  return state
}
