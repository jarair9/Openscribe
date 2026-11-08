import { useEffect } from 'react'
import { saveProject } from '../services/projectFiles'
import { usePreferencesStore } from '../state/preferencesStore'
import { useProjectStore } from '../state/projectStore'

/**
 * Writes a checkpoint after a quiet period once the document is dirty.
 *
 * The revision counter is the guard: if an edit lands while the save is in
 * flight, markSaved keeps `dirty` set and this effect schedules another pass.
 */
export function useAutosave(): void {
  const autosave = usePreferencesStore((state) => state.autosave)
  const delay = usePreferencesStore((state) => state.autosaveDelay)
  const dirty = useProjectStore((state) => state.dirty)
  const revision = useProjectStore((state) => state.revision)
  const saving = useProjectStore((state) => state.saving)
  const saveError = useProjectStore((state) => state.saveError)
  const hasSession = useProjectStore((state) => state.session !== null)

  useEffect(() => {
    // After a failure, wait for the retry action or the next edit rather than
    // hammering the disk on a timer.
    if (!autosave || !dirty || !hasSession || saving || saveError) return
    const timer = window.setTimeout(() => {
      void saveProject({ auto: true })
    }, Math.max(2, delay) * 1000)
    return () => window.clearTimeout(timer)
  }, [autosave, delay, dirty, revision, saving, saveError, hasSession])
}
