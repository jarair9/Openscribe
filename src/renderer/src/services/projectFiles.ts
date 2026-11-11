import { createProject } from '@core/schema/factories'
import { PROJECT_NAME_MAX } from '@core/schema/project'
import { usePlaybackStore } from '../state/playbackStore'
import { useProjectStore } from '../state/projectStore'
import { useUiStore } from '../state/uiStore'
import { rememberProject, renameRecentProject, listRecentProjects } from '../lib/recent'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The operation failed.'
}

/** One project open/create at a time; two quick clicks must not race the loader. */
let loadInFlight = false

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

/**
 * Warms the fonts the editor draws with. Best-effort and deliberately not
 * awaited: the workspace should appear as soon as the project is read, and the
 * boot screen has already loaded the display fonts by this point.
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
      wait(2500)
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
  if (loadInFlight) return false
  loadInFlight = true

  const name = options.name.trim().slice(0, PROJECT_NAME_MAX) || 'Untitled project'
  const project = createProject({
    name,
    width: options.width,
    height: options.height,
    fps: options.fps
  })
  const ui = useUiStore.getState()
  ui.startLoading({
    title: `Creating “${name}”`,
    detail: 'Writing the project folder and preparing the canvas'
  })

  try {
    const opened = await window.api.project.create({
      parentDir: options.parentDir,
      name,
      document: project
    })
    void warmUpFonts()
    usePlaybackStore.getState().stop()
    useProjectStore.getState().open(opened)
    rememberProject(opened.document.name, opened.filePath)
    ui.toast(`Created “${opened.document.name}”`, 'success')
    return true
  } catch (error) {
    ui.toast(errorMessage(error), 'error')
    return false
  } finally {
    loadInFlight = false
    ui.stopLoading()
  }
}

export async function openProjectAt(filePath: string): Promise<boolean> {
  if (loadInFlight) return false
  loadInFlight = true

  const store = useProjectStore.getState()
  const ui = useUiStore.getState()

  try {
    if (store.project && store.dirty) {
      const discard = await ui.askConfirm({
        title: 'Discard unsaved changes?',
        message: 'The current project has unsaved changes. Opening another project will discard them.',
        confirmLabel: 'Discard and open'
      })
      if (!discard) return false
    }

    const name = projectName(filePath)
    ui.startLoading({
      title: `Opening “${name}”`,
      detail: 'Reading the project and preparing the workspace'
    })

    const opened = await window.api.project.open(filePath)
    void warmUpFonts()
    usePlaybackStore.getState().stop()
    useProjectStore.getState().open(opened)
    rememberProject(opened.document.name, opened.filePath)
    ui.toast(`Opened “${opened.document.name}”`, 'success')
    return true
  } catch (error) {
    ui.toast(errorMessage(error), 'error')
    return false
  } finally {
    loadInFlight = false
    ui.stopLoading()
  }
}

export async function openProjectFromDialog(): Promise<boolean> {
  try {
    const filePath = await window.api.dialogs.openProject()
    if (!filePath) return false
    return openProjectAt(filePath)
  } catch (error) {
    useUiStore.getState().toast(errorMessage(error), 'error')
    return false
  }
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
 * Rename a project that is not open. The read, rename and write happen in one
 * main-process operation, so an external edit cannot slip between them.
 */
export async function renameProjectFile(filePath: string, name: string): Promise<boolean> {
  const ui = useUiStore.getState()
  const trimmed = name.trim().slice(0, PROJECT_NAME_MAX)
  if (!trimmed) return false

  ui.setBusy('Renaming project…')
  try {
    const result = await window.api.project.rename(filePath, trimmed)
    renameRecentProject(filePath, result.name)
    ui.toast(`Renamed to “${result.name}”`, 'success')
    return true
  } catch (error) {
    ui.toast(errorMessage(error), 'error')
    return false
  } finally {
    ui.setBusy(null)
  }
}

export async function saveProject(options: { auto?: boolean } = {}): Promise<boolean> {
  const { project, session, revision, openGeneration } = useProjectStore.getState()
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
    useProjectStore
      .getState()
      .markSaved(result.savedAt, undefined, revisionAtSave, options.auto, openGeneration)
    rememberProject(project.name, session.filePath)
    return true
  } catch (error) {
    const message = errorMessage(error)
    useProjectStore.getState().markSaveFailed(message, openGeneration)
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
  const { project, session, revision, openGeneration } = useProjectStore.getState()
  const ui = useUiStore.getState()
  if (!project) return false

  const revisionAtSave = revision
  const suggested = session
    ? session.filePath.replace(/(\.[^./\\]+)$/, ` copy$1`)
    : undefined

  let chosen: string | null
  try {
    chosen = await window.api.dialogs.saveProjectAs(suggested ?? null)
  } catch (error) {
    ui.toast(errorMessage(error), 'error')
    return false
  }
  if (!chosen) return false

  ui.setBusy('Saving project…')
  try {
    const nextSession = await window.api.project.saveAs({
      filePath: chosen,
      sourceFilePath: session?.filePath ?? null,
      document: project
    })
    useProjectStore
      .getState()
      .markSaved(new Date().toISOString(), nextSession, revisionAtSave, false, openGeneration)
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

let closePrompt: Promise<void> | null = null

/** Ask before closing; the main process also routes Alt+F4 and taskbar closes here. */
export async function requestWindowClose(): Promise<void> {
  if (closePrompt) return closePrompt

  closePrompt = (async () => {
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
    window.api.window.confirmClose()
  })()

  try {
    await closePrompt
  } finally {
    closePrompt = null
  }
}

export { errorMessage }
