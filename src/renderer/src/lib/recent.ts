export interface RecentProject {
  name: string
  filePath: string
  openedAt: string
}

const STORAGE_KEY = 'openwhiteboard.recentProjects'
const MAX_RECENT = 8

export function listRecentProjects(): RecentProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (entry): entry is RecentProject =>
        Boolean(entry) &&
        typeof entry === 'object' &&
        typeof (entry as RecentProject).filePath === 'string' &&
        typeof (entry as RecentProject).name === 'string'
    )
  } catch {
    return []
  }
}

export function rememberProject(name: string, filePath: string): RecentProject[] {
  const next = [
    { name, filePath, openedAt: new Date().toISOString() },
    ...listRecentProjects().filter((entry) => entry.filePath !== filePath)
  ].slice(0, MAX_RECENT)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Storage being unavailable only loses the recent list.
  }
  return next
}

export function forgetProject(filePath: string): RecentProject[] {
  const next = listRecentProjects().filter((entry) => entry.filePath !== filePath)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
  return next
}

/** Update a stored label in place, keeping the list order and timestamps. */
export function renameRecentProject(filePath: string, name: string): RecentProject[] {
  const next = listRecentProjects().map((entry) =>
    entry.filePath === filePath ? { ...entry, name } : entry
  )
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
  return next
}
