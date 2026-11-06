import { useEffect, useRef, useState, type JSX } from 'react'
import { Check, FilePlus2, FolderOpen, HardDrive, X } from 'lucide-react'
import { PRODUCT } from '@shared/product'
import brandLogo from '../../../../assets/Openscribe.png'
import { forgetProject, listRecentProjects, type RecentProject } from '../../lib/recent'
import { openProjectAt, openProjectFromDialog, renameProjectFile } from '../../services/projectFiles'
import { useUiStore } from '../../state/uiStore'
import { ProjectThumbnail } from './ProjectThumbnail'

/** Long enough to tell a double-click apart from a single one, short enough to feel instant. */
const OPEN_DELAY_MS = 230

function containingFolder(filePath: string): string {
  const parts = filePath.split(/[\\/]/).filter(Boolean)
  return parts.length > 1 ? parts[parts.length - 2] ?? '' : ''
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const minutes = Math.round((Date.now() - then) / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.round(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 31) return `${days} days ago`
  return new Date(iso).toLocaleDateString()
}

export function WelcomeScreen(): JSX.Element {
  const openDialog = useUiStore((state) => state.openDialog)
  const [recent, setRecent] = useState(listRecentProjects)

  const dismiss = (filePath: string): void => setRecent(forgetProject(filePath))
  const refresh = (): void => setRecent(listRecentProjects())

  return (
    <main className="welcome home">
      <div className="home-inner">
        <section className="home-hero">
          <div className="home-brand">
            <div className="home-mark">
              <img src={brandLogo} alt="" />
            </div>
            <h1 className="home-title">{PRODUCT.name}</h1>
            <svg className="home-flourish" viewBox="0 0 260 16" aria-hidden="true" focusable="false">
              <path d="M4 11 C 46 3, 78 14, 122 7 S 196 2, 256 9" />
            </svg>
          </div>

          <p className="home-tagline">
            Hand-drawn explainer videos, built from files on this computer. No accounts, no cloud,
            no telemetry.
          </p>

          <div className="home-cta">
            <button className="home-primary" onClick={() => openDialog('newProject')}>
              <FilePlus2 size={16} />
              <span>New project</span>
              <kbd>Ctrl N</kbd>
            </button>
            <button className="home-ghost" onClick={() => void openProjectFromDialog()}>
              <FolderOpen size={16} />
              <span>Open project</span>
              <kbd>Ctrl O</kbd>
            </button>
          </div>

          <div className="home-footnote">
            <HardDrive size={12} />
            <span>
              Saves as a <code>.{PRODUCT.projectExtension}</code> folder · {PRODUCT.license} · v
              {PRODUCT.version}
            </span>
          </div>
        </section>

        <section className="home-projects" aria-label="Recent projects">
          <header className="home-projects-head">
            <h2>Recent projects</h2>
            {recent.length > 0 ? <span className="home-count">{recent.length}</span> : null}
          </header>

          {recent.length === 0 ? (
            <div className="home-empty">
              <FolderOpen size={20} />
              <p className="home-empty-title">Nothing here yet</p>
              <p className="home-empty-body">
                Create a project and it will wait for you here, ready to reopen with one click.
              </p>
              <button className="home-empty-action" onClick={() => openDialog('newProject')}>
                <FilePlus2 size={14} />
                Create your first project
              </button>
            </div>
          ) : (
            <>
              <ul className="home-grid">
                {recent.map((entry, index) => (
                  <ProjectCard
                    key={entry.filePath}
                    entry={entry}
                    thumbId={`proj-${index}`}
                    onDismiss={dismiss}
                    onRenamed={refresh}
                  />
                ))}
              </ul>
              <p className="home-projects-hint">
                Double-click a card to rename · removing a project here only clears the list, your
                files stay on disk.
              </p>
            </>
          )}
        </section>
      </div>
    </main>
  )
}

/** Inline name editor — replaces the clickable card body so no input is nested in a button. */
function RenameField({
  entry,
  label,
  onDone,
  onCancel
}: {
  entry: RecentProject
  label: string
  onDone: () => void
  onCancel: () => void
}): JSX.Element {
  const [draft, setDraft] = useState(entry.name)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.focus()
    input.select()
  }, [])

  const commit = async (): Promise<void> => {
    const name = draft.trim()
    if (saving) return
    if (!name || name === entry.name) {
      onCancel()
      return
    }
    setSaving(true)
    const renamed = await renameProjectFile(entry.filePath, name)
    setSaving(false)
    if (renamed) onDone()
    else onCancel()
  }

  return (
    <div className="home-rename">
      <input
        ref={inputRef}
        className="text-input home-rename-input"
        type="text"
        value={draft}
        aria-label={`Rename ${label}`}
        disabled={saving}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            void commit()
          } else if (event.key === 'Escape') {
            event.preventDefault()
            onCancel()
          }
        }}
      />
      <button className="home-rename-btn" title="Save name" disabled={saving} onClick={() => void commit()}>
        <Check size={13} />
      </button>
      <button className="home-rename-btn" title="Cancel" disabled={saving} onClick={onCancel}>
        <X size={13} />
      </button>
    </div>
  )
}

function useDelayedOpen(filePath: string) {
  const timer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    []
  )

  return {
    /** A double-click arriving inside the delay cancels this and opens the rename field instead. */
    schedule(): void {
      if (timer.current !== null) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        timer.current = null
        void openProjectAt(filePath)
      }, OPEN_DELAY_MS)
    },
    cancel(): void {
      if (timer.current !== null) {
        window.clearTimeout(timer.current)
        timer.current = null
      }
    }
  }
}

function ProjectCard({
  entry,
  thumbId,
  onDismiss,
  onRenamed
}: {
  entry: RecentProject
  thumbId: string
  onDismiss: (filePath: string) => void
  onRenamed: () => void
}): JSX.Element {
  const [editing, setEditing] = useState(false)
  const open = useDelayedOpen(entry.filePath)

  const startRename = (): void => {
    open.cancel()
    setEditing(true)
  }

  const renameShortcut = (event: { key: string; preventDefault(): void }): void => {
    if (event.key === 'F2') {
      event.preventDefault()
      startRename()
    }
  }

  return (
    <li className={`home-project${editing ? ' editing' : ''}`}>
      <button
        className="home-project-thumb"
        title={`Open ${entry.name} · double-click or F2 to rename`}
        aria-label={`Open ${entry.name}`}
        onClick={open.schedule}
        onDoubleClick={startRename}
        onKeyDown={renameShortcut}
      >
        <ProjectThumbnail filePath={entry.filePath} idPrefix={thumbId} />
      </button>

      {editing ? (
        <div className="home-project-edit">
          <RenameField
            entry={entry}
            label={entry.name}
            onDone={() => {
              setEditing(false)
              onRenamed()
            }}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : (
        <button
          className="home-project-info"
          title={`Open ${entry.name} · double-click or F2 to rename`}
          onClick={open.schedule}
          onDoubleClick={startRename}
          onKeyDown={renameShortcut}
        >
          <span className="home-project-name">{entry.name}</span>
          <span className="home-project-meta">
            {relativeTime(entry.openedAt)} · {containingFolder(entry.filePath) || entry.filePath}
          </span>
        </button>
      )}

      <button
        className="home-project-remove"
        title="Remove from this list"
        aria-label={`Remove ${entry.name} from recent projects`}
        onClick={() => onDismiss(entry.filePath)}
      >
        <X size={12} />
      </button>
    </li>
  )
}
