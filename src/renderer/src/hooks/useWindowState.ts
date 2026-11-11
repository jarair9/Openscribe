import { useSyncExternalStore } from 'react'
import type { WindowState } from '@shared/ipc'

/** One process-wide subscription shared by every component that reads the state. */
let current: WindowState = { maximized: false, focused: true }
const listeners = new Set<() => void>()
let detach: (() => void) | null = null

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (!detach) {
    detach = window.api.window.onStateChanged((state) => {
      current = state
      for (const notify of listeners) notify()
    })
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && detach) {
      detach()
      detach = null
    }
  }
}

/** Tracks maximize/focus state broadcast by the main process. */
export function useWindowState(): WindowState {
  return useSyncExternalStore(subscribe, () => current)
}
