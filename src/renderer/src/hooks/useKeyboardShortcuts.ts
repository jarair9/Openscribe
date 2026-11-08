import { useEffect } from 'react'
import { buildSchedule } from '@core/timeline/schedule'
import {
  copySelection,
  cutSelection,
  deleteSelection,
  duplicateSelection,
  nudgeSelection,
  pasteClipboard,
  selectAll
} from '../services/editCommands'
import {
  openProjectFromDialog,
  returnToProjects,
  saveProject,
  saveProjectAs
} from '../services/projectFiles'
import { useEditorStore, type Tool } from '../state/editorStore'
import { usePlaybackStore } from '../state/playbackStore'
import { useProjectStore } from '../state/projectStore'
import { useUiStore } from '../state/uiStore'

const TOOL_KEYS: Record<string, Tool> = {
  v: 'select',
  h: 'pan',
  t: 'text',
  r: 'rectangle',
  u: 'roundedRectangle',
  o: 'ellipse',
  y: 'triangle',
  l: 'line',
  a: 'arrow'
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable ||
    Boolean(target.closest('[contenteditable="true"]'))
  )
}

/** Window-level editor shortcuts. All handlers read the latest store state. */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      const ui = useUiStore.getState()

      if (ui.previewOpen) {
        if (event.key === 'Escape') ui.closePreview()
        return
      }

      if (ui.paletteOpen) {
        if (event.key === 'Escape') {
          ui.closePalette()
        } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
          event.preventDefault()
          ui.closePalette()
        }
        return
      }

      if (event.key === 'Escape') {
        if (ui.confirm) {
          ui.resolveConfirm(false)
          return
        }
        if (ui.dialog) {
          ui.closeDialog()
          return
        }
        const editor = useEditorStore.getState()
        editor.setTool('select')
        editor.clearSelection()
        return
      }

      if (ui.dialog || ui.confirm) return
      if (isEditableTarget(event.target)) return
      if (event.target instanceof HTMLElement && event.target.closest('button')) {
        // Let focused buttons handle Space/Enter themselves.
        if (event.key === ' ' || event.key === 'Enter') return
      }

      const project = useProjectStore.getState().project
      const mod = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()

      if (mod && event.key === 'Enter') {
        event.preventDefault()
        if (project) ui.openPreview()
        return
      }

      if (mod) {
        switch (key) {
          case 'k':
            event.preventDefault()
            ui.togglePalette()
            return
          case ',':
            event.preventDefault()
            ui.openDialog('preferences')
            return
          case 's':
            event.preventDefault()
            void (event.shiftKey ? saveProjectAs() : saveProject())
            return
          case 'o':
            event.preventDefault()
            void openProjectFromDialog()
            return
          case 'n':
            event.preventDefault()
            ui.openDialog('newProject')
            return
          case 'e':
            if (project) {
              event.preventDefault()
              ui.openDialog('export')
            }
            return
          case 'h':
            if (event.shiftKey) {
              event.preventDefault()
              void returnToProjects()
            }
            return
          case 'z':
            event.preventDefault()
            if (event.shiftKey) useProjectStore.getState().redo()
            else useProjectStore.getState().undo()
            return
          case 'y':
            event.preventDefault()
            useProjectStore.getState().redo()
            return
          case 'c':
            copySelection()
            return
          case 'x':
            cutSelection()
            return
          case 'v':
            pasteClipboard()
            return
          case 'd':
            event.preventDefault()
            duplicateSelection()
            return
          case 'a':
            event.preventDefault()
            selectAll()
            return
          case '0':
            event.preventDefault()
            useEditorStore.getState().requestFit()
            return
          default:
            return
        }
      }

      if (!project) return

      if (key === ' ') {
        event.preventDefault()
        const playback = usePlaybackStore.getState()
        const duration = buildSchedule(project).duration
        if (!playback.playing && playback.time >= duration - 0.01) playback.setTime(0)
        playback.toggle()
        return
      }
      if (key === 'delete' || key === 'backspace') {
        event.preventDefault()
        deleteSelection()
        return
      }
      if (key === 'home') {
        event.preventDefault()
        usePlaybackStore.getState().setTime(0)
        return
      }
      if (key === 'end') {
        event.preventDefault()
        usePlaybackStore.getState().setTime(buildSchedule(project).duration)
        return
      }
      if (key === 'arrowleft' || key === 'arrowright' || key === 'arrowup' || key === 'arrowdown') {
        const step = event.shiftKey ? 10 : 1
        if (useEditorStore.getState().selection.length === 0) return
        event.preventDefault()
        if (key === 'arrowleft') nudgeSelection(-step, 0)
        if (key === 'arrowright') nudgeSelection(step, 0)
        if (key === 'arrowup') nudgeSelection(0, -step)
        if (key === 'arrowdown') nudgeSelection(0, step)
        return
      }
      if (event.key === '!' || (event.shiftKey && key === '1')) {
        useEditorStore.getState().requestFit()
        return
      }
      if (key === 'g') {
        useEditorStore.getState().toggleGrid()
        return
      }

      const tool = TOOL_KEYS[key]
      if (tool) {
        useEditorStore.getState().setTool(tool)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}
