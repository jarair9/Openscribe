import { randomUUID } from 'node:crypto'
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { basename, dirname, extname, join, normalize, resolve } from 'node:path'
import { migrateProject, validateProject } from '@core/project/validate'
import { parseProject, type Project } from '@core/schema/project'
import { PRODUCT } from '@shared/product'
import { registerSession, type ProjectSession } from './sessions'

const MAX_PROJECT_BYTES = 64 * 1024 * 1024
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i

export class ProjectStoreError extends Error {}

function fail(message: string): never {
  throw new ProjectStoreError(message)
}

/** Turns a user supplied project name into a safe file and folder name. */
export function safeProjectName(raw: string): string {
  const cleaned = raw
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')
  if (!cleaned) return 'Untitled Project'
  const trimmed = cleaned.slice(0, 80)
  return WINDOWS_RESERVED.test(trimmed) ? `${trimmed} Project` : trimmed
}

function uniqueFolderPath(parentDir: string, base: string): string {
  let candidate = base
  let counter = 2
  while (existsSync(join(parentDir, candidate))) {
    candidate = `${base} ${counter}`
    counter += 1
  }
  return join(parentDir, candidate)
}

function assertParentDir(parentDir: string): void {
  if (typeof parentDir !== 'string' || !parentDir) fail('No destination folder was selected.')
  const info = statSync(parentDir, { throwIfNoEntry: false })
  if (!info || !info.isDirectory()) fail('The destination folder does not exist.')
}

function normalizeProjectPath(filePath: string): string {
  if (typeof filePath !== 'string' || !filePath) fail('No project file path was provided.')
  const full = resolve(filePath)
  if (extname(full).toLowerCase() !== `.${PRODUCT.projectExtension}`) {
    fail(`Project files must use the .${PRODUCT.projectExtension} extension.`)
  }
  return full
}

/**
 * Writes JSON through a temporary sibling file so an interrupted write can
 * never truncate the last valid save. The previous file is kept as .bak.
 */
function writeAtomically(filePath: string, contents: string): void {
  mkdirSync(dirname(filePath), { recursive: true })
  const tempPath = join(dirname(filePath), `.${basename(filePath)}.${randomUUID()}.tmp`)
  writeFileSync(tempPath, contents, 'utf8')
  if (existsSync(filePath)) {
    try {
      copyFileSync(filePath, `${filePath}.bak`)
    } catch {
      // A failed backup must not block the save itself.
    }
  }
  renameSync(tempPath, filePath)
}

function assertSavable(document: Project): void {
  const parsed = parseProject(document)
  if (!parsed.ok) fail(`Refusing to save an invalid document: ${parsed.error}`)
  const validation = validateProject(document)
  if (validation.errors.length > 0) {
    fail(`Refusing to save an invalid document: ${validation.errors[0]!.message}`)
  }
}

function serialize(document: Project, savedAt: string): string {
  return `${JSON.stringify({ ...document, updatedAt: savedAt }, null, 2)}\n`
}

function ensureAssetsDir(filePath: string): string {
  const assetsDir = join(dirname(filePath), 'assets')
  mkdirSync(assetsDir, { recursive: true })
  return assetsDir
}

export interface CreatedProject {
  session: ProjectSession
  document: Project
}

export function createProject(parentDir: string, name: string, document: Project): CreatedProject {
  assertParentDir(parentDir)
  const safeName = safeProjectName(name || document.name)
  const folder = uniqueFolderPath(parentDir, safeName)
  mkdirSync(join(folder, 'assets'), { recursive: true })

  const filePath = join(folder, `${basename(folder)}.${PRODUCT.projectExtension}`)
  const savedAt = new Date().toISOString()
  const next: Project = {
    ...document,
    name: safeName,
    createdAt: document.createdAt || savedAt,
    updatedAt: savedAt
  }
  assertSavable(next)
  writeAtomically(filePath, serialize(next, savedAt))

  return { session: registerSession(filePath), document: next }
}

export interface OpenedProjectFile {
  session: ProjectSession
  document: Project
  migrated: boolean
}

export function openProject(filePath: string): OpenedProjectFile {
  if (typeof filePath !== 'string' || !filePath) fail('No project file path was provided.')
  const full = resolve(filePath)
  const info = statSync(full, { throwIfNoEntry: false })
  if (!info || !info.isFile()) fail('The project file could not be found.')
  if (info.size > MAX_PROJECT_BYTES) fail('The project file is too large to open.')
  if (extname(full).toLowerCase() !== `.${PRODUCT.projectExtension}`) {
    fail(`“${basename(full)}” is not an ${PRODUCT.projectExtension} project.`)
  }

  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(full, 'utf8').replace(/^\uFEFF/, ''))
  } catch {
    fail('The project file is damaged or is not valid JSON.')
  }

  const migration = migrateProject(raw)
  if (!migration.ok || !migration.project) fail(migration.error ?? 'The project could not be migrated.')

  const parsed = parseProject(migration.project)
  if (!parsed.ok || !parsed.project) fail(parsed.error ?? 'The project document is invalid.')

  const validation = validateProject(parsed.project)
  if (validation.errors.length > 0) {
    const summary = validation.errors
      .slice(0, 3)
      .map((issue) => issue.message)
      .join(' ')
    fail(`The project is structurally invalid. ${summary}`)
  }

  ensureAssetsDir(full)
  return {
    session: registerSession(full),
    document: parsed.project,
    migrated: migration.migrated
  }
}

export function saveProject(filePath: string, document: Project): { savedAt: string } {
  const full = normalizeProjectPath(filePath)
  assertSavable(document)
  const savedAt = new Date().toISOString()
  writeAtomically(full, serialize(document, savedAt))
  ensureAssetsDir(full)
  registerSession(full)
  return { savedAt }
}

export function saveProjectAs(
  filePath: string,
  sourceFilePath: string | null,
  document: Project
): { session: ProjectSession; savedAt: string } {
  const full = normalizeProjectPath(filePath)
  assertSavable(document)

  const sourceDir = sourceFilePath ? dirname(resolve(sourceFilePath)) : null
  if (sourceDir && normalize(sourceDir) !== normalize(dirname(full))) {
    const sourceAssets = join(sourceDir, 'assets')
    if (existsSync(sourceAssets)) {
      cpSync(sourceAssets, join(dirname(full), 'assets'), {
        recursive: true,
        force: false,
        errorOnExist: false
      })
    }
  }

  const savedAt = new Date().toISOString()
  ensureAssetsDir(full)
  writeAtomically(full, serialize(document, savedAt))
  return { session: registerSession(full), savedAt }
}
