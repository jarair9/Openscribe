import { create } from 'zustand'
import {
  isBundledStrokeFont,
  registerStrokeFont,
  unregisterStrokeFont,
  type StrokeFontBundle
} from '@core/text/strokeFont'

const STORAGE_KEY = 'openwhiteboard.strokeFonts.v1'

interface FontStoreState {
  customFonts: StrokeFontBundle[]
  addFont(font: StrokeFontBundle): { persisted: boolean }
  removeFont(id: string): void
}

function readStoredFonts(): StrokeFontBundle[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (font): font is StrokeFontBundle =>
        Boolean(font) &&
        typeof font === 'object' &&
        typeof (font as StrokeFontBundle).id === 'string' &&
        typeof (font as StrokeFontBundle).family === 'string' &&
        Boolean((font as StrokeFontBundle).glyphs)
    )
  } catch {
    return []
  }
}

const storedFonts = readStoredFonts()
for (const font of storedFonts) registerStrokeFont(font)

function persist(fonts: StrokeFontBundle[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fonts))
    return true
  } catch {
    return false
  }
}

export const useFontStore = create<FontStoreState>((set, get) => ({
  customFonts: storedFonts,

  addFont(font) {
    const next = [...get().customFonts.filter((candidate) => candidate.id !== font.id), font]
    registerStrokeFont(font)
    const persisted = persist(next)
    set({ customFonts: next })
    return { persisted }
  },

  removeFont(id) {
    if (isBundledStrokeFont(id)) return
    const next = get().customFonts.filter((font) => font.id !== id)
    unregisterStrokeFont(id)
    persist(next)
    set({ customFonts: next })
  }
}))
