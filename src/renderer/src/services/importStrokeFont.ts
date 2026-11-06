import type { StrokeFontBundle } from '@core/text/strokeFont'
import { parseStrokeFontFiles } from '@core/text/strokeFontImport'
import { useFontStore } from '../state/fontStore'
import { useUiStore } from '../state/uiStore'

/**
 * Read files picked from disk, parse a stroke-font bundle, and register it for
 * the session (and for future sessions when local storage has room).
 */
export async function importStrokeFontFiles(fileList: FileList | null): Promise<StrokeFontBundle | null> {
  const files = Array.from(fileList ?? [])
  if (files.length === 0) return null
  try {
    const inputs = await Promise.all(
      files.map(async (file) => ({
        name: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
        text: await file.text()
      }))
    )
    const bundle = parseStrokeFontFiles(inputs)
    const { persisted } = useFontStore.getState().addFont(bundle)
    useUiStore
      .getState()
      .toast(
        persisted
          ? `Added handwriting font “${bundle.family}”.`
          : `Added “${bundle.family}” for this session — local storage is full.`,
        persisted ? 'info' : 'error'
      )
    return bundle
  } catch (error) {
    useUiStore
      .getState()
      .toast(error instanceof Error ? error.message : 'Could not import that font.', 'error')
    return null
  }
}
