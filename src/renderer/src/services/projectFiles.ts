import { createProject } from '@core/schema/factories'
import { usePlaybackStore } from '../state/playbackStore'
import { useProjectStore } from '../state/projectStore'
import { useUiStore } from '../state/uiStore'
import { rememberProject, renameRecentProject, listRecentProjects } from '../lib/recent'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The operation failed.'
}

/** How long the open/create scrim stays up so fonts and assets settle in. */
const MIN_LOAD_MS = 5500

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

/**
 * Warms the fonts the editor draws with. Best-effort: the scrim already has a
 * minimum duration, so this just makes sure the work happens during it rather
 * than on the first painted frame.
 */
async function warmUpFonts(): Promise<void> {
  try {
    const fonts = document.fonts
    await Promise.race([
      Promise.allSettled([
        fonts.ready,
        fonts.load('400 16px "Polan Stronk"'),
        fonts.load('600 16px "Segoe UI Variable Text"'),
        fonts.load('640 16px "Segoe UI Variable Display"')
      ]),
      wait(4500)
    ])
  } catch {
    // Font loading must never block opening a project.
  }
}

/** The label the loader can show before the document has been read off disk. */
function projectName(filePath: string): string {
  const known = listRecentProjects().find((entry) => entry.filePath === filePath)
  if (known) return known.name
  const parts = filePath.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] ?? 'Project'
}

export interface NewProjectOptions {
  name: string
  parentDir: string
  width: number
  height: number
  fps: number
}

export async function createNewProject(options: NewProjectOptions): Promise<boolean> {
  const project = createProject({
    name: options.name,
    width: options.width,
    height: options.height,
    fps: options.fps
  })
  const ui = useUiStore.getState()
  ui.startLoading({ title: `Creating “${options.name}”`, detail: 'Loading fonts and writing the project folder' })
  const startedAt = Date.now()
  try {
    const [opened] = await Promise.all([
      window.api.project.create({
        parentDir: options.parentDir,
        name: options.name,
        document: project
      }),
      warmUpFonts()
    ])
    const elapsed = Date.now() - startedAt
    if (elapsed < MIN_LOAD_MS) await wait(MIN_LOAD_MS - elapsed)
    usePlaybackStore.getState().stop()
    useProjectStore.getState().open(opened)
    rememberProject(opened.document.name, opened.filePath)
    ui.toast(`Created “${opened.document.name}”`, 'success')
    return true
  } catch (error) {
    ui.toast(errorMessage(error), 'error')
    return false
  } finally {
    ui.stopLoading()
  }
}

export async function openProjectAt(filePath: string): Promise<boolean> {
  const store = useProjectStore.getState()
  const ui = useUiStore.getState()

  if (store.project && store.dirty) {
    const discard = await ui.askConfirm({
      title: 'Discard unsaved changes?',
      message: 'The current project has unsaved changes. Opening another project will discard them.',
      confirmLabel: 'Discard and open'
    })
    if (!discard) return false
  }

  const name = projectName(filePath)
  ui.startLoading({ title: `Opening “${name}”`, detail: 'Loading fonts and preparing the workspace' })
  const startedAt = Date.now()
  try {
    const [opened] = await Promise.all([window.api.project.open(filePath), warmUpFonts()])
    const elapsed = Date.now() - startedAt
    if (elapsed < MIN_LOAD_MS) await wait(MIN_LOAD_MS - elapsed)
    usePlaybackStore.getState().stop()
    useProjectStore.getState().open(opened)
    rememberProject(opened.document.name, opened.filePath)
    ui.toast(`Opened “${opened.document.name}”`, 'success')
    return true
  } catch (error) {
    ui.toast(errorMessage(error), 'error')
    return false
  } finally {
    ui.stopLoading()
  }
}

export async function openProjectFromDialog(): Promise<boolean> {
  const filePath = await window.api.dialogs.openProject()
  if (!filePath) return false
  return openProjectAt(filePath)
}

/** Leave the editor and return to the project picker. */
export async function returnToProjects(): Promise<boolean> {
  const { project, dirty } = useProjectStore.getState()
  const ui = useUiStore.getState()
  if (!project) return true

  if (dirty) {
    const discard = await ui.askConfirm({
      title: 'Leave without saving?',
      message: 'This project has unsaved changes that will be lost. Save with Ctrl+S first.',
      confirmLabel: 'Leave without saving'
    })
    if (!discard) return false
  }

  usePlaybackStore.getState().stop()
  useProjectStore.getState().close()
  return true
}

/**
 * Rename a project that is not open. The document is read, renamed and written
 * back in place; the file keeps its name and location on disk.
 */
export async function renameProjectFile(filePath: string, name: string): Promise<boolean> {
  const ui = useUiStore.getState()
  const trimmed = name.trim()
  if (!trimmed) return false

  ui.setBusy('Renaming project…')
  try {
    const opened = await window.api.project.open(filePath)
    if (opened.document.name === trimmed) return true
    await window.api.project.save({
      filePath: opened.filePath,
      document: { ...opened.document, name: trimmed }
    })
    renameRecentProject(opened.filePath, trimmed)
    ui.toast(`Renamed to “${trimmed}”`, 'success')
    return true
  } catch (error) {
    ui.toast(errorMessage(error), 'error')
    return false
  } finally {
    ui.setBusy(null)
  }
}

export async function saveProject(
  options: { auto?: boolean } = {}
): Promise<boolean> {
  const { project, session, revision } = useProjectStore.getState()
  const ui = useUiStore.getState()
  if (!project || !session) return false

  const revisionAtSave = revision
  useProjectStore.getState().markSaving()
  if (!options.auto) ui.setBusy('Saving project…')
  try {
    const result = await window.api.project.save({
      filePath: session.filePath,
      document: project
    })
    useProjectStore.getState().markSaved(result.savedAt, undefined, revisionAtSave, options.auto)
    rememberProject(project.name, session.filePath)
    return true
  } catch (error) {
    const message = errorMessage(error)
    useProjectStore.getState().markSaveFailed(message)
    if (options.auto) {
      ui.toast(`Autosave failed: ${message}`, 'error', {
        action: { label: 'Retry', run: () => void saveProject({ auto: true }) }
      })
    } else {
      ui.toast(message, 'error')
    }
    return false
  } finally {
    if (!options.auto) ui.setBusy(null)
  }
}

export async function saveProjectAs(): Promise<boolean> {
  const { project, session } = useProjectStore.getState()
  const ui = useUiStore.getState()
  if (!project) return false

  const suggested = session
    ? session.filePath.replace(/(\.[^./\\]+)$/, ` copy$1`)
    : undefined

  const chosen = await window.api.dialogs.saveProjectAs(suggested ?? null)
  if (!chosen) return false

  ui.setBusy('Saving project…')
  try {
    const nextSession = await window.api.project.saveAs({
      filePath: chosen,
      sourceFilePath: session?.filePath ?? null,
      document: project
    })
    useProjectStore.getState().markSaved(new Date().toISOString(), nextSession)
    rememberProject(project.name, nextSession.filePath)
    ui.toast('Project saved to a new location.', 'success')
    return true
  } catch (error) {
    ui.toast(errorMessage(error), 'error')
    return false
  } finally {
    ui.setBusy(null)
  }
}

export async function requestWindowClose(): Promise<void> {
  const { project, dirty } = useProjectStore.getState()
  const ui = useUiStore.getState()
  if (project && dirty) {
    const discard = await ui.askConfirm({
      title: 'Close without saving?',
      message: 'This project has unsaved changes that will be lost.',
      confirmLabel: 'Close without saving'
    })
    if (!discard) return
  }
  window.api.window.close()
}

export { errorMessage }
