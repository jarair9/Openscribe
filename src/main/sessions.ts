import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'

export interface ProjectSession {
  token: string
  filePath: string
  assetsDir: string
}

/** More than a handful of open projects is already unusual; keep the map bounded. */
const MAX_SESSIONS = 32

const sessionsByToken = new Map<string, ProjectSession>()
const sessionsByFile = new Map<string, ProjectSession>()
const accessOrder: string[] = []

function touch(token: string): void {
  const index = accessOrder.indexOf(token)
  if (index !== -1) accessOrder.splice(index, 1)
  accessOrder.push(token)
}

function evict(): void {
  while (accessOrder.length > MAX_SESSIONS) {
    const token = accessOrder.shift()
    if (!token) continue
    const session = sessionsByToken.get(token)
    if (!session) continue
    sessionsByToken.delete(token)
    if (sessionsByFile.get(session.filePath) === session) {
      sessionsByFile.delete(session.filePath)
    }
  }
}

export function assetsDirForProjectFile(filePath: string): string {
  return join(dirname(filePath), 'assets')
}

export function registerSession(filePath: string): ProjectSession {
  const existing = sessionsByFile.get(filePath)
  if (existing) {
    sessionsByToken.set(existing.token, existing)
    touch(existing.token)
    return existing
  }
  const session: ProjectSession = {
    token: randomUUID(),
    filePath,
    assetsDir: assetsDirForProjectFile(filePath)
  }
  sessionsByToken.set(session.token, session)
  sessionsByFile.set(filePath, session)
  touch(session.token)
  evict()
  return session
}

export function sessionByToken(token: string): ProjectSession | undefined {
  const session = sessionsByToken.get(token)
  if (session) touch(token)
  return session
}
