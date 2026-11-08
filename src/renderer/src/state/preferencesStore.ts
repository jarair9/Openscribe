import { create } from 'zustand'
import type { ExportFormat } from '@shared/ipc'

export type AccentId = 'magenta' | 'cyan' | 'amber' | 'violet'
export type ExportQuality = 'draft' | 'standard' | 'high' | 'maximum'

export const ACCENTS: Record<
  AccentId,
  { label: string; accent: string; strong: string; soft: string }
> = {
  magenta: {
    label: 'Magenta',
    accent: '#ff3fd0',
    strong: '#e21caf',
    soft: 'rgba(255, 63, 208, 0.12)'
  },
  cyan: {
    label: 'Cyan',
    accent: '#3fd8ff',
    strong: '#0fb4dd',
    soft: 'rgba(63, 216, 255, 0.12)'
  },
  amber: {
    label: 'Amber',
    accent: '#ffb03f',
    strong: '#e08c12',
    soft: 'rgba(255, 176, 63, 0.13)'
  },
  violet: {
    label: 'Violet',
    accent: '#a78bfa',
    strong: '#7c5cf0',
    soft: 'rgba(167, 139, 250, 0.14)'
  }
}

export interface Preferences {
  autosave: boolean
  /** Seconds of quiet after the last edit before a checkpoint is written. */
  autosaveDelay: number
  accent: AccentId
  exportFormat: ExportFormat
  exportQuality: ExportQuality
  exportScale: number
  keepFrames: boolean
}

interface PreferencesState extends Preferences {
  setAutosave(autosave: boolean): void
  setAutosaveDelay(seconds: number): void
  setAccent(accent: AccentId): void
  setExportFormat(format: ExportFormat): void
  setExportQuality(quality: ExportQuality): void
  setExportScale(scale: number): void
  setKeepFrames(keepFrames: boolean): void
  reset(): void
}

const STORAGE_KEY = 'ows.preferences.v1'

const DEFAULTS: Preferences = {
  autosave: true,
  autosaveDelay: 3,
  accent: 'magenta',
  exportFormat: 'mp4',
  exportQuality: 'standard',
  exportScale: 100,
  keepFrames: false
}

const EXPORT_FORMATS: ExportFormat[] = ['mp4', 'webm', 'frames']
const QUALITIES: ExportQuality[] = ['draft', 'standard', 'high', 'maximum']
const SCALES = [50, 100, 150, 200]

function isAccent(value: unknown): value is AccentId {
  return typeof value === 'string' && value in ACCENTS
}

function load(): Preferences {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const stored = JSON.parse(raw) as Partial<Preferences>
    return {
      autosave: typeof stored.autosave === 'boolean' ? stored.autosave : DEFAULTS.autosave,
      autosaveDelay:
        typeof stored.autosaveDelay === 'number'
          ? Math.min(60, Math.max(2, stored.autosaveDelay))
          : DEFAULTS.autosaveDelay,
      accent: isAccent(stored.accent) ? stored.accent : DEFAULTS.accent,
      exportFormat:
        typeof stored.exportFormat === 'string' && EXPORT_FORMATS.includes(stored.exportFormat)
          ? stored.exportFormat
          : DEFAULTS.exportFormat,
      exportQuality:
        typeof stored.exportQuality === 'string' && QUALITIES.includes(stored.exportQuality)
          ? stored.exportQuality
          : DEFAULTS.exportQuality,
      exportScale:
        typeof stored.exportScale === 'number' && SCALES.includes(stored.exportScale)
          ? stored.exportScale
          : DEFAULTS.exportScale,
      keepFrames: typeof stored.keepFrames === 'boolean' ? stored.keepFrames : DEFAULTS.keepFrames
    }
  } catch {
    return { ...DEFAULTS }
  }
}

function persist(state: Preferences): void {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        autosave: state.autosave,
        autosaveDelay: state.autosaveDelay,
        accent: state.accent,
        exportFormat: state.exportFormat,
        exportQuality: state.exportQuality,
        exportScale: state.exportScale,
        keepFrames: state.keepFrames
      })
    )
  } catch {
    // Preferences are a convenience; never fail the editor over storage.
  }
}

/**
 * Applies the chosen accent to the shared tokens. Selection follows the accent
 * so the editor stays coherent; the camera keeps its own dedicated colour.
 */
export function applyAccent(accent: AccentId): void {
  const palette = ACCENTS[accent]
  const root = document.documentElement
  root.style.setProperty('--accent', palette.accent)
  root.style.setProperty('--accent-strong', palette.strong)
  root.style.setProperty('--accent-soft', palette.soft)
  root.style.setProperty('--selection', palette.accent)
}

const initial = load()

export const usePreferencesStore = create<PreferencesState>((set, get) => {
  const patch = (partial: Partial<Preferences>): void => {
    set(partial)
    persist({ ...get(), ...partial })
  }

  return {
    ...initial,

    setAutosave(autosave) {
      patch({ autosave })
    },

    setAutosaveDelay(seconds) {
      patch({ autosaveDelay: Math.min(60, Math.max(2, Math.round(seconds))) })
    },

    setAccent(accent) {
      applyAccent(accent)
      patch({ accent })
    },

    setExportFormat(exportFormat) {
      patch({ exportFormat })
    },

    setExportQuality(exportQuality) {
      patch({ exportQuality })
    },

    setExportScale(exportScale) {
      patch({ exportScale })
    },

    setKeepFrames(keepFrames) {
      patch({ keepFrames })
    },

    reset() {
      set({ ...DEFAULTS })
      persist(DEFAULTS)
      applyAccent(DEFAULTS.accent)
    }
  }
})

applyAccent(initial.accent)
