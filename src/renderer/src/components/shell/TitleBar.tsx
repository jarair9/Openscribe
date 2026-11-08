import { useEffect, useRef, useState, type JSX, type ReactNode } from 'react'
import {
  ChevronDown,
  Clapperboard,
  Command,
  Minus,
  Play,
  Redo2,
  Save,
  Settings,
  Square,
  Undo2,
  X
} from 'lucide-react'
import { canRedo, canUndo } from '@core/project/history'
import { renameProject } from '@core/project/operations'
import { PRODUCT } from '@shared/product'
import { useWindowState } from '../../hooks/useWindowState'
import {
  copySelection,
  cutSelection,
  deleteSelection,
  duplicateSelection,
  pasteClipboard,
  selectAll
} from '../../services/editCommands'
import {
  openProjectFromDialog,
  requestWindowClose,
  returnToProjects,
  saveProject,
  saveProjectAs
} from '../../services/projectFiles'
import { useEditorStore } from '../../state/editorStore'
import { useProjectStore } from '../../state/projectStore'
import { useUiStore } from '../../state/uiStore'
import brandLogo from '../../../../assets/Openscribe.png'

type CloseMenu = () => void

export function TitleBar(): JSX.Element {
  const project = useProjectStore((state) => state.project)
  const dirty = useProjectStore((state) => state.dirty)
  const saving = useProjectStore((state) => state.saving)
  const saveError = useProjectStore((state) => state.saveError)
  const lastAutoSaveAt = useProjectStore((state) => state.lastAutoSaveAt)
  const history = useProjectStore((state) => state.history)
  const apply = useProjectStore((state) => state.apply)
  const showGrid = useEditorStore((state) => state.showGrid)
  const snapping = useEditorStore((state) => state.snapping)
  const windowState = useWindowState()

  const saveLabel = saveError
    ? 'Save failed'
    : saving
      ? 'Saving…'
      : dirty
        ? 'Unsaved changes'
        : lastAutoSaveAt
          ? 'Autosaved'
          : 'Saved'

  const [name, setName] = useState(project?.name ?? '')
  useEffect(() => setName(project?.name ?? ''), [project?.name])

  const commitName = (): void => {
    if (!project) return
    const trimmed = name.trim()
    if (!trimmed || trimmed === project.name) {
      setName(project.name)
      return
    }
    apply('Rename project', (current) => renameProject(current, trimmed), { coalesce: false })
  }

  const brandInner = (
    <>
      <span className="brand-mark">
        <img src={brandLogo} alt="" />
      </span>
      <span className="brand-name">{PRODUCT.shortName}</span>
    </>
  )

  return (
    <header className="titlebar">
      <div className="brand">
        {project ? (
          <button
            className="brand-button"
            title="Double-click to back to projects (Ctrl+Shift+H)"
            aria-label="Back to projects"
            onDoubleClick={() => void returnToProjects()}
          >
            {brandInner}
          </button>
        ) : (
          <span className="brand-static">{brandInner}</span>
        )}
      </div>
      <div className="titlebar-sep" />

      <TitleMenu label="Project">
        {(close) => (
          <>
            <MenuItem
              label="New project…"
              shortcut="Ctrl+N"
              onClick={() => {
                close()
                useUiStore.getState().openDialog('newProject')
              }}
            />
            <MenuItem
              label="Open project…"
              shortcut="Ctrl+O"
              onClick={() => {
                close()
                void openProjectFromDialog()
              }}
            />
            <MenuItem
              label="Back to projects"
              shortcut="Ctrl+Shift+H"
              disabled={!project}
              onClick={() => {
                close()
                void returnToProjects()
              }}
            />
            <div className="menu-sep" />
            <MenuItem
              label="Save"
              shortcut="Ctrl+S"
              disabled={!project}
              onClick={() => {
                close()
                void saveProject()
              }}
            />
            <MenuItem
              label="Save as…"
              shortcut="Ctrl+Shift+S"
              disabled={!project}
              onClick={() => {
                close()
                void saveProjectAs()
              }}
            />
            <div className="menu-sep" />
            <MenuItem
              label="Export video…"
              disabled={!project}
              onClick={() => {
                close()
                useUiStore.getState().openDialog('export')
              }}
            />
            <MenuItem
              label="Project settings…"
              disabled={!project}
              onClick={() => {
                close()
                useUiStore.getState().openDialog('projectSettings')
              }}
            />
            <MenuItem
              label="Preferences…"
              shortcut="Ctrl+,"
              onClick={() => {
                close()
                useUiStore.getState().openDialog('preferences')
              }}
            />
          </>
        )}
      </TitleMenu>

      <TitleMenu label="Edit" disabled={!project}>
        {(close) => (
          <>
            <MenuItem
              label="Undo"
              shortcut="Ctrl+Z"
              disabled={!canUndo(history)}
              onClick={() => {
                close()
                useProjectStore.getState().undo()
              }}
            />
            <MenuItem
              label="Redo"
              shortcut="Ctrl+Shift+Z"
              disabled={!canRedo(history)}
              onClick={() => {
                close()
                useProjectStore.getState().redo()
              }}
            />
            <div className="menu-sep" />
            <MenuItem label="Cut" shortcut="Ctrl+X" disabled={!project} onClick={() => { close(); cutSelection() }} />
            <MenuItem label="Copy" shortcut="Ctrl+C" disabled={!project} onClick={() => { close(); copySelection() }} />
            <MenuItem label="Paste" shortcut="Ctrl+V" disabled={!project} onClick={() => { close(); pasteClipboard() }} />
            <MenuItem label="Duplicate" shortcut="Ctrl+D" disabled={!project} onClick={() => { close(); duplicateSelection() }} />
            <MenuItem label="Delete" shortcut="Del" disabled={!project} onClick={() => { close(); deleteSelection() }} />
            <div className="menu-sep" />
            <MenuItem label="Select all" shortcut="Ctrl+A" disabled={!project} onClick={() => { close(); selectAll() }} />
          </>
        )}
      </TitleMenu>

      <TitleMenu label="View" disabled={!project}>
        {(close) => (
          <>
            <MenuItem
              label={showGrid ? 'Hide grid' : 'Show grid'}
              shortcut="G"
              onClick={() => {
                close()
                useEditorStore.getState().toggleGrid()
              }}
            />
            <MenuItem
              label={snapping ? 'Disable snapping' : 'Enable snapping'}
              onClick={() => {
                close()
                useEditorStore.getState().toggleSnapping()
              }}
            />
            <div className="menu-sep" />
            <MenuItem
              label="Fit scene in editor"
              shortcut="Shift+1"
              onClick={() => {
                close()
                useEditorStore.getState().requestFit()
              }}
            />
            <MenuItem
              label="Preview project"
              shortcut="Ctrl+Enter"
              onClick={() => {
                close()
                useUiStore.getState().openPreview()
              }}
            />
            <MenuItem
              label="Timeline: simple"
              onClick={() => {
                close()
                useEditorStore.getState().setTimelineMode('simple')
              }}
            />
            <MenuItem
              label="Timeline: advanced"
              onClick={() => {
                close()
                useEditorStore.getState().setTimelineMode('advanced')
              }}
            />
            <div className="menu-sep" />
            <MenuItem
              label="Command palette…"
              shortcut="Ctrl+K"
              onClick={() => {
                close()
                useUiStore.getState().openPalette()
              }}
            />
          </>
        )}
      </TitleMenu>

      <TitleMenu label="Help">
        {(close) => (
          <>
            <MenuItem
              label="Keyboard shortcuts"
              onClick={() => {
                close()
                useUiStore.getState().openDialog('shortcuts')
              }}
            />
            <MenuItem
              label={`About ${PRODUCT.name}`}
              onClick={() => {
                close()
                useUiStore.getState().openDialog('about')
              }}
            />
          </>
        )}
      </TitleMenu>

      <div className="titlebar-spacer" />

      {project ? (
        <div className="titlebar-center">
          <input
            className="titlebar-title"
            value={name}
            aria-label="Project name"
            onChange={(event) => setName(event.target.value)}
            onBlur={commitName}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.currentTarget.blur()
              } else if (event.key === 'Escape') {
                setName(project.name)
                event.currentTarget.blur()
              }
            }}
          />
          <span
            className={`save-state ${saveError ? 'error' : dirty ? 'dirty' : 'clean'}`}
            title={
              saveError
                ? saveError
                : lastAutoSaveAt && !dirty
                  ? `Last autosave ${new Date(lastAutoSaveAt).toLocaleTimeString()}`
                  : 'Saved to disk'
            }
            aria-live="polite"
          >
            <span className="save-dot" aria-hidden="true" />
            {saveLabel}
          </span>
        </div>
      ) : null}

      {project ? (
        <div className="titlebar-actions">
          <button
            className="icon-btn"
            title="Command palette (Ctrl+K)"
            aria-label="Command palette"
            onClick={() => useUiStore.getState().openPalette()}
          >
            <Command size={15} />
          </button>
          <span className="titlebar-actions-sep" />
          <button
            className="btn btn-primary btn-sm titlebar-preview"
            title="Preview project (Ctrl+Enter)"
            onClick={() => useUiStore.getState().openPreview()}
          >
            <Play size={12} />
            Preview
          </button>
          <button
            className="btn btn-sm titlebar-export"
            title="Export video (Ctrl+E)"
            onClick={() => useUiStore.getState().openDialog('export')}
          >
            <Clapperboard size={12} />
            Export
          </button>
          <span className="titlebar-actions-sep" />
          <button
            className="icon-btn"
            title="Undo (Ctrl+Z)"
            disabled={!canUndo(history)}
            onClick={() => useProjectStore.getState().undo()}
          >
            <Undo2 size={15} />
          </button>
          <button
            className="icon-btn"
            title="Redo (Ctrl+Shift+Z)"
            disabled={!canRedo(history)}
            onClick={() => useProjectStore.getState().redo()}
          >
            <Redo2 size={15} />
          </button>
          <button
            className="icon-btn"
            title="Save (Ctrl+S)"
            disabled={!dirty}
            onClick={() => void saveProject()}
          >
            <Save size={15} />
          </button>
          <button
            className="icon-btn"
            title="Project settings"
            onClick={() => useUiStore.getState().openDialog('projectSettings')}
          >
            <Settings size={15} />
          </button>
        </div>
      ) : null}

      <div className="window-controls">
        <button
          className="window-control"
          title="Minimize"
          onClick={() => window.api.window.minimize()}
        >
          <Minus size={15} />
        </button>
        <button
          className="window-control"
          title={windowState.maximized ? 'Restore' : 'Maximize'}
          onClick={() => window.api.window.toggleMaximize()}
        >
          <Square size={11} />
        </button>
        <button
          className="window-control close"
          title="Close"
          onClick={() => void requestWindowClose()}
        >
          <X size={16} />
        </button>
      </div>
    </header>
  )
}

function TitleMenu({
  label,
  disabled,
  children
}: {
  label: string
  disabled?: boolean
  children: ReactNode | ((close: CloseMenu) => ReactNode)
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent): void => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [open])

  return (
    <div className="menu-anchor" ref={ref}>
      <button
        className="btn btn-ghost btn-sm"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
        <ChevronDown size={12} />
      </button>
      {open ? (
        <div className="menu-popover left">
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      ) : null}
    </div>
  )
}

function MenuItem({
  label,
  shortcut,
  disabled,
  onClick
}: {
  label: string
  shortcut?: string
  disabled?: boolean
  onClick: () => void
}): JSX.Element {
  return (
    <button className="menu-item" disabled={disabled} onClick={onClick}>
      {label}
      {shortcut ? <span className="menu-shortcut">{shortcut}</span> : null}
    </button>
  )
}
