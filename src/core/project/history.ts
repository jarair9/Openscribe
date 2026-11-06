import type { Project } from '../schema/project'

export interface HistoryEntry {
  project: Project
  label: string
}

export interface HistoryState {
  past: HistoryEntry[]
  future: HistoryEntry[]
  limit: number
}

export function createHistory(limit = 100): HistoryState {
  return { past: [], future: [], limit }
}

export function canUndo(history: HistoryState): boolean {
  return history.past.length > 0
}

export function canRedo(history: HistoryState): boolean {
  return history.future.length > 0
}

/** Record the document state that existed before an edit. */
export function recordHistory(
  history: HistoryState,
  before: Project,
  label: string
): HistoryState {
  const past = [...history.past, { project: before, label }]
  const overflow = Math.max(0, past.length - history.limit)
  return {
    past: overflow > 0 ? past.slice(overflow) : past,
    future: [],
    limit: history.limit
  }
}

export function undo(
  history: HistoryState,
  current: Project
): { project: Project; history: HistoryState; label: string } | null {
  const entry = history.past[history.past.length - 1]
  if (!entry) return null
  return {
    project: entry.project,
    label: entry.label,
    history: {
      past: history.past.slice(0, -1),
      future: [{ project: current, label: entry.label }, ...history.future],
      limit: history.limit
    }
  }
}

export function redo(
  history: HistoryState,
  current: Project
): { project: Project; history: HistoryState; label: string } | null {
  const entry = history.future[0]
  if (!entry) return null
  return {
    project: entry.project,
    label: entry.label,
    history: {
      past: [...history.past, { project: current, label: entry.label }],
      future: history.future.slice(1),
      limit: history.limit
    }
  }
}
