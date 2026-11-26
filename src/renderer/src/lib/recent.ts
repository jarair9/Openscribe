import type { RecentProject } from '@shared/ipc'

export type { RecentProject }

/**
 * The list itself is owned by the main process (see src/main/recent.ts) so it
 * survives renderer storage resets. This module only adapts the IPC calls and
 * rescues the history older builds kept in localStorage.
 */
const LEGACY_KEY = 'openwhiteboard.recentProjects'
const MAX_RECENT = 8

function readLegacy(): RecentProject[] {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (entry): entry is RecentProject =>
          Boolean(entry) &&
          typeof entry === 'object' &&
          typeof (entry as RecentProject).filePath === 'string' &&
          typeof (entry as RecentProject).name === 'string' &&
          typeof (entry as RecentProject).openedAt === 'string'
      )
      .slice(0, MAX_RECENT)
  } catch {
    return []
  }
}

/**
 * One-time move from localStorage to the file store. Runs once per session and
 * clears the old key so entries the user removed do not come back.
 */
let legacyRestore: Promise<void> | null = null

function restoreLegacy(): Promise<void> {
  legacyRestore ??= (async () => {
    const legacy = readLegacy()
    if (legacy.length === 0) return
    try {
      const current = await window.api.recent.list()
      const known = new Set(current.map((entry) => entry.filePath))
      // Oldest first: the store prepends, so this rebuilds the newest-first order.
      const seeds = legacy
        .filter((entry) => !known.has(entry.filePath))
        .reverse()
        .slice(-MAX_RECENT)
      for (const entry of seeds) await window.api.recent.remember(entry)
      localStorage.removeItem(LEGACY_KEY)
    } catch {
      // Leave the key in place so a later launch can try again.
    }
  })()
  return legacyRestore
}

export async function listRecentProjects(): Promise<RecentProject[]> {
  await restoreLegacy()
  return window.api.recent.list()
}

export async function rememberProject(
  name: string,
  filePath: string
): Promise<RecentProject[]> {
  await restoreLegacy()
  return window.api.recent.remember({ name, filePath, openedAt: new Date().toISOString() })
}

export async function forgetProject(filePath: string): Promise<RecentProject[]> {
  await restoreLegacy()
  return window.api.recent.forget(filePath)
}

/** Update a stored label in place, keeping the list order and timestamps. */
export async function renameRecentProject(
  filePath: string,
  name: string
): Promise<RecentProject[]> {
  await restoreLegacy()
  return window.api.recent.rename(filePath, name)
}
