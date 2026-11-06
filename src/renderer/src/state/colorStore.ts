import { create } from 'zustand'

const STORAGE_KEY = 'openwhiteboard.customColors.v1'

interface ColorStoreState {
  customColors: string[]
  addColor(hex: string): void
  removeColor(hex: string): void
}

function readStoredColors(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (value): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
    )
  } catch {
    return []
  }
}

function persist(colors: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(colors))
  } catch {
    /* Private-mode storage: the palette lives until the window closes. */
  }
}

export const useColorStore = create<ColorStoreState>((set, get) => ({
  customColors: readStoredColors(),

  addColor(hex) {
    const normalized = hex.toLowerCase()
    if (get().customColors.includes(normalized)) return
    const next = [normalized, ...get().customColors].slice(0, 24)
    persist(next)
    set({ customColors: next })
  },

  removeColor(hex) {
    const next = get().customColors.filter((color) => color !== hex)
    persist(next)
    set({ customColors: next })
  }
}))
