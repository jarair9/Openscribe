import { create } from 'zustand'
import {
  createHistory,
  recordHistory,
  redo as redoHistory,
  undo as undoHistory,
  type HistoryState
} from '@core/project/history'
import type { Project } from '@core/schema/project'
import type { OpenedProject, SessionInfo } from '@shared/ipc'
import { useEditorStore } from './editorStore'

export interface ApplyOptions {
  /** Skip undo recording; used by drag transactions and field coalescing. */
  coalesce?: boolean
}

interface ProjectStoreState {
  project: Project | null
  session: SessionInfo | null
  dirty: boolean
  savedAt: string | null
  lastAutoSaveAt: string | null
  saving: boolean
  saveError: string | null
  revision: number
  history: HistoryState
  status: string | null
  transaction: string | null

  open(opened: OpenedProject): void
  close(): void
  apply(label: string, recipe: (project: Project) => Project, options?: ApplyOptions): void
  beginTransaction(label: string): void
  endTransaction(): void
  undo(): void
  redo(): void
  markSaving(): void
  markSaved(savedAt: string, session?: SessionInfo, revisionAtSave?: number, auto?: boolean): void
  markSaveFailed(message: string): void
  updateSession(session: SessionInfo): void
  setStatus(status: string | null): void
}

let lastEdit = { label: '', at: 0 }

export const useProjectStore = create<ProjectStoreState>((set, get) => ({
  project: null,
  session: null,
  dirty: false,
  savedAt: null,
  lastAutoSaveAt: null,
  saving: false,
  saveError: null,
  revision: 0,
  history: createHistory(150),
  status: null,
  transaction: null,

  open(opened) {
    lastEdit = { label: '', at: 0 }
    set({
      project: opened.document,
      session: {
        filePath: opened.filePath,
        assetsDir: opened.assetsDir,
        assetToken: opened.assetToken
      },
      dirty: false,
      savedAt: opened.document.updatedAt,
      lastAutoSaveAt: null,
      saving: false,
      saveError: null,
      revision: 0,
      history: createHistory(150),
      status: null,
      transaction: null
    })
    useEditorStore.getState().initForProject(opened.document)
  },

  close() {
    lastEdit = { label: '', at: 0 }
    set({
      project: null,
      session: null,
      dirty: false,
      savedAt: null,
      lastAutoSaveAt: null,
      saving: false,
      saveError: null,
      revision: 0,
      history: createHistory(150),
      status: null,
      transaction: null
    })
  },

  apply(label, recipe, options) {
    const { project, history, transaction } = get()
    if (!project) return
    const next = recipe(project)
    if (next === project) return

    const now = Date.now()
    const coalesce = options?.coalesce ?? true
    const shouldRecord =
      !transaction &&
      (!coalesce || lastEdit.label !== label || now - lastEdit.at > 800)

    lastEdit = { label, at: now }
    set({
      project: next,
      history: shouldRecord ? recordHistory(history, project, label) : history,
      dirty: true,
      revision: get().revision + 1,
      saveError: null,
      status: label
    })
  },

  beginTransaction(label) {
    const { project, history, transaction } = get()
    if (!project || transaction) return
    lastEdit = { label: '', at: 0 }
    set({ transaction: label, history: recordHistory(history, project, label) })
  },

  endTransaction() {
    if (get().transaction) set({ transaction: null })
  },

  undo() {
    const { project, history, transaction } = get()
    if (!project) return
    if (transaction) {
      set({ transaction: null })
      return
    }
    const result = undoHistory(history, project)
    if (!result) return
    lastEdit = { label: '', at: 0 }
    set({
      project: result.project,
      history: result.history,
      dirty: true,
      revision: get().revision + 1,
      status: `Undo ${result.label}`
    })
    useEditorStore.getState().prune(result.project)
  },

  redo() {
    const { project, history, transaction } = get()
    if (!project) return
    if (transaction) return
    const result = redoHistory(history, project)
    if (!result) return
    lastEdit = { label: '', at: 0 }
    set({
      project: result.project,
      history: result.history,
      dirty: true,
      revision: get().revision + 1,
      status: `Redo ${result.label}`
    })
    useEditorStore.getState().prune(result.project)
  },

  markSaving() {
    set({ saving: true, saveError: null })
  },

  markSaved(savedAt, session, revisionAtSave, auto = false) {
    const stale = revisionAtSave !== undefined && revisionAtSave !== get().revision
    set({
      dirty: stale,
      savedAt,
      lastAutoSaveAt: auto ? savedAt : get().lastAutoSaveAt,
      saving: false,
      saveError: null,
      session: session ?? get().session
    })
  },

  markSaveFailed(message) {
    set({ saving: false, saveError: message })
  },

  updateSession(session) {
    set({ session })
  },

  setStatus(status) {
    set({ status })
  }
}))
