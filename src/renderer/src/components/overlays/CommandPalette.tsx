import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import { CornerDownLeft, Search } from 'lucide-react'
import { PRODUCT } from '@shared/product'
import { openProjectFromDialog, saveProject, saveProjectAs } from '../../services/projectFiles'
import { useEditorStore, type SectionPanelId } from '../../state/editorStore'
import { useProjectStore } from '../../state/projectStore'
import { useUiStore } from '../../state/uiStore'

interface Command {
  id: string
  label: string
  group: string
  shortcut?: string
  keywords?: string
  run: () => void
}

const PANELS: Array<{ id: SectionPanelId; label: string }> = [
  { id: 'scenes', label: 'Scenes' },
  { id: 'layers', label: 'Layers' },
  { id: 'text', label: 'Text' },
  { id: 'image', label: 'Media' },
  { id: 'shapes', label: 'Shapes' },
  { id: 'camera', label: 'Camera' },
  { id: 'music', label: 'Music' }
]

function buildCommands(): Command[] {
  const ui = useUiStore.getState()
  const editor = useEditorStore.getState()
  const project = useProjectStore.getState()
  const commands: Command[] = [
    {
      id: 'project.new',
      label: 'New project',
      group: 'Project',
      shortcut: 'Ctrl+N',
      run: () => ui.openDialog('newProject')
    },
    {
      id: 'project.open',
      label: 'Open project',
      group: 'Project',
      shortcut: 'Ctrl+O',
      run: () => void openProjectFromDialog()
    },
    {
      id: 'project.save',
      label: 'Save project',
      group: 'Project',
      shortcut: 'Ctrl+S',
      run: () => void saveProject()
    },
    {
      id: 'project.saveAs',
      label: 'Save project as',
      group: 'Project',
      shortcut: 'Ctrl+Shift+S',
      run: () => void saveProjectAs()
    },
    {
      id: 'project.export',
      label: 'Export video',
      group: 'Project',
      shortcut: 'Ctrl+E',
      run: () => ui.openDialog('export')
    },
    {
      id: 'project.settings',
      label: 'Project settings',
      group: 'Project',
      run: () => ui.openDialog('projectSettings')
    },
    {
      id: 'app.preferences',
      label: 'Preferences',
      group: 'Application',
      shortcut: 'Ctrl+,',
      run: () => ui.openDialog('preferences')
    },
    {
      id: 'app.shortcuts',
      label: 'Keyboard shortcuts',
      group: 'Application',
      run: () => ui.openDialog('shortcuts')
    },
    {
      id: 'app.about',
      label: `About ${PRODUCT.name}`,
      group: 'Application',
      run: () => ui.openDialog('about')
    },
    {
      id: 'view.grid',
      label: editor.showGrid ? 'Hide grid' : 'Show grid',
      group: 'View',
      shortcut: 'G',
      run: editor.toggleGrid
    },
    {
      id: 'view.snapping',
      label: editor.snapping ? 'Disable snapping' : 'Enable snapping',
      group: 'View',
      run: editor.toggleSnapping
    },
    {
      id: 'view.fit',
      label: 'Fit scene in editor',
      group: 'View',
      shortcut: 'Shift+1',
      run: editor.requestFit
    },
    {
      id: 'view.preview',
      label: 'Preview project',
      group: 'View',
      shortcut: 'Ctrl+Enter',
      run: () => ui.openPreview()
    },
    {
      id: 'view.simple',
      label: 'Timeline: simple',
      group: 'View',
      run: () => editor.setTimelineMode('simple')
    },
    {
      id: 'view.advanced',
      label: 'Timeline: advanced',
      group: 'View',
      run: () => editor.setTimelineMode('advanced')
    }
  ]

  for (const panel of PANELS) {
    commands.push({
      id: `panel.${panel.id}`,
      label: `Open ${panel.label} panel`,
      group: 'Panels',
      keywords: 'library sidebar',
      run: () => {
        const state = useEditorStore.getState()
        if (state.sectionPanel !== panel.id) state.toggleSectionPanel(panel.id)
      }
    })
  }

  if (!project.project) return commands

  commands.push(
    {
      id: 'edit.undo',
      label: 'Undo',
      group: 'Edit',
      shortcut: 'Ctrl+Z',
      run: project.undo
    },
    {
      id: 'edit.redo',
      label: 'Redo',
      group: 'Edit',
      shortcut: 'Ctrl+Shift+Z',
      run: project.redo
    }
  )

  return commands
}

export function CommandPalette(): JSX.Element | null {
  const open = useUiStore((state) => state.paletteOpen)
  const close = useUiStore((state) => state.closePalette)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const commands = useMemo(() => (open ? buildCommands() : []), [open])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return commands
    return commands.filter((command) =>
      `${command.label} ${command.group} ${command.keywords ?? ''}`.toLowerCase().includes(needle)
    )
  }, [commands, query])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setIndex(0)
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [open])

  useEffect(() => setIndex(0), [query])

  if (!open) return null

  const run = (command: Command | undefined): void => {
    if (!command) return
    close()
    command.run()
  }

  return (
    <div
      className="palette-scrim"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="palette-search">
          <Search size={15} />
          <input
            ref={inputRef}
            className="palette-input"
            value={query}
            placeholder="Type a command or panel name…"
            aria-label="Search commands"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setIndex((value) => Math.min(filtered.length - 1, value + 1))
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                setIndex((value) => Math.max(0, value - 1))
              } else if (event.key === 'Enter') {
                event.preventDefault()
                run(filtered[index])
              } else if (event.key === 'Escape') {
                event.preventDefault()
                close()
              }
            }}
          />
          <kbd className="palette-kbd">Esc</kbd>
        </div>
        <div className="palette-list" role="listbox" aria-label="Commands">
          {filtered.length === 0 ? (
            <p className="palette-empty">No command matches “{query}”.</p>
          ) : (
            filtered.map((command, position) => (
              <button
                key={command.id}
                role="option"
                aria-selected={position === index}
                className={`palette-item ${position === index ? 'active' : ''}`}
                onPointerEnter={() => setIndex(position)}
                onClick={() => run(command)}
              >
                <span className="palette-group">{command.group}</span>
                <span className="palette-label">{command.label}</span>
                {command.shortcut ? (
                  <span className="palette-shortcut">{command.shortcut}</span>
                ) : position === index ? (
                  <CornerDownLeft size={12} className="palette-enter" />
                ) : null}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
