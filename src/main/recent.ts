import { app } from 'electron'
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import type { RecentProject } from '@shared/ipc'
import { log } from './logger'

/**
 * Recent projects live in a plain JSON file next to the profile instead of the
 * renderer's localStorage. Chromium can discard a page's storage when its
 * origin or profile generation changes (dev server port, storage reset), which
 * silently emptied the welcome screen's list. A file in userData survives all
 * of that and is easiest to inspect when something goes wrong.
 */
const MAX_RECENT = 8
const FILE_NAME = 'recent-projects.json'

function storePath(): string {
  return join(app.getPath('userData'), FILE_NAME)
}

function isEntry(value: unknown): value is RecentProject {
  if (!value || typeof value !== 'object') return false
  const entry = value as Partial<RecentProject>
  return (
    typeof entry.name === 'string' &&
    typeof entry.filePath === 'string' &&
    typeof entry.openedAt === 'string'
  )
}

/** Drop malformed rows, duplicate paths and anything past the list limit. */
function normalize(raw: unknown): RecentProject[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const entries: RecentProject[] = []
  for (const value of raw) {
    if (!isEntry(value)) continue
    const filePath = value.filePath.trim()
    if (!filePath || seen.has(filePath)) continue
    seen.add(filePath)
    const name = value.name.trim() || basename(filePath).replace(/\.[^.\\/]+$/, '')
    const openedAt = Number.isFinite(Date.parse(value.openedAt))
      ? value.openedAt
      : new Date().toISOString()
    entries.push({ name, filePath, openedAt })
    if (entries.length >= MAX_RECENT) break
  }
  return entries
}

export function listRecent(): RecentProject[] {
  try {
    return normalize(JSON.parse(readFileSync(storePath(), 'utf8')))
  } catch {
    // Missing or unreadable file simply means there is no history yet.
    return []
  }
}

/** Write through a temp file so a crash mid-write keeps the previous list. */
function write(entries: RecentProject[]): RecentProject[] {
  const next = normalize(entries)
  const target = storePath()
  const temp = `${target}.tmp`
  try {
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(temp, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
    renameSync(temp, target)
  } catch (error) {
    log('warn', 'Could not write the recent projects list', error)
    try {
      rmSync(temp, { force: true })
    } catch {
      // Ignore cleanup failures; the list is only a convenience.
    }
  }
  return next
}

export function rememberRecent(entry: RecentProject): RecentProject[] {
  const openedAt = Number.isFinite(Date.parse(entry.openedAt))
    ? entry.openedAt
    : new Date().toISOString()
  return write([
    { ...entry, openedAt },
    ...listRecent().filter((item) => item.filePath !== entry.filePath)
  ])
}

export function forgetRecent(filePath: string): RecentProject[] {
  return write(listRecent().filter((entry) => entry.filePath !== filePath))
}

export function renameRecent(filePath: string, name: string): RecentProject[] {
  return write(
    listRecent().map((entry) => (entry.filePath === filePath ? { ...entry, name } : entry))
  )
}
