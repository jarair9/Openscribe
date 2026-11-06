import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'

export interface ProjectSession {
  token: string
  filePath: string
  assetsDir: string
}

const sessionsByToken = new Map<string, ProjectSession>()
const sessionsByFile = new Map<string, ProjectSession>()

export function assetsDirForProjectFile(filePath: string): string {
  return join(dirname(filePath), 'assets')
}

export function registerSession(filePath: string): ProjectSession {
  const existing = sessionsByFile.get(filePath)
  if (existing) {
    sessionsByToken.set(existing.token, existing)
    return existing
  }
  const session: ProjectSession = {
    token: randomUUID(),
    filePath,
    assetsDir: assetsDirForProjectFile(filePath)
  }
  sessionsByToken.set(session.token, session)
  sessionsByFile.set(filePath, session)
  return session
}

export function sessionByToken(token: string): ProjectSession | undefined {
  return sessionsByToken.get(token)
}
