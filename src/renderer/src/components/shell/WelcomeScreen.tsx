import { useEffect, useRef, useState, type JSX } from 'react'
import { ArrowRight, Check, FilePlus2, FolderOpen, PenLine, Play, X } from 'lucide-react'
import { PRODUCT } from '@shared/product'
import { PROJECT_NAME_MAX } from '@core/schema/project'
import { forgetProject, listRecentProjects, type RecentProject } from '../../lib/recent'
import { openProjectAt, openProjectFromDialog, renameProjectFile } from '../../services/projectFiles'
import { useUiStore } from '../../state/uiStore'
import brandLogo from '../../../../assets/openscribe-128.png'
import { ProjectThumbnail } from './ProjectThumbnail'

function containingFolder(filePath: string): string {
  const parts = filePath.split(/[\\/]/).filter(Boolean)
  return parts.length > 1 ? parts[parts.length - 2] ?? '' : ''
}

function relativeTime(iso: string, now: number): string {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const minutes = Math.round((now - then) / 60_000)
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
  const [recent, setRecent] = useState<RecentProject[]>([])
  const [loaded, setLoaded] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const dismiss = (filePath: string): void => {
    setRecent((entries) => entries.filter((entry) => entry.filePath !== filePath))
    void forgetProject(filePath).catch(() => undefined)
  }

  const refresh = (): void => {
    void listRecentProjects()
      .then(setRecent)
      .catch(() => undefined)
  }

  // Keep "2 min ago" honest while the picker stays open.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  // Load the list, then drop entries whose file has been moved or deleted
  // instead of showing a card that fails only when clicked.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const entries = await listRecentProjects().catch(() => [] as RecentProject[])
      if (cancelled) return
      setRecent(entries)
      setLoaded(true)

      const exists = await Promise.all(
        entries.map((entry) => window.api.project.exists(entry.filePath).catch(() => true))
      )
      if (cancelled) return
      const missing = entries.filter((_, index) => !exists[index])
      if (missing.length === 0) return

      let next = entries
      for (const entry of missing) {
        next = await forgetProject(entry.filePath).catch(() => next)
      }
      if (!cancelled) setRecent(next)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="welcome home">
      <div className="home-backdrop" aria-hidden="true">
        <span className="home-glow home-glow-a" />
        <span className="home-glow home-glow-b" />
        <span className="home-glow home-glow-c" />
      </div>

      <div className="home-inner">
        <header className="home-top">
          <div className="home-brand">
            <img className="home-brand-mark" src={brandLogo} alt="" />
            <div className="home-brand-copy">
              <span className="home-brand-name">{PRODUCT.name}</span>
              <span className="home-brand-sub">{PRODUCT.tagline}</span>
            </div>
          </div>
          <span className="home-version">v{PRODUCT.version}</span>
        </header>

        <section className="home-intro">
          <h1 className="home-headline">
            Whiteboard animation,
            <span className="home-headline-muted">without the cloud.</span>
          </h1>
          <p className="home-tagline">
            Build hand-drawn explainer videos on an open canvas, then preview and export
            them offline. Every project stays in a folder you own.
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
        </section>

        <section className="home-projects" aria-label="Recent projects">
          <header className="home-projects-head">
            <h2>Recent projects</h2>
            <button className="home-link-btn" onClick={() => void openProjectFromDialog()}>
              Browse files
              <ArrowRight size={13} />
            </button>
          </header>

          {!loaded ? (
            <div className="home-skeleton-grid" aria-hidden="true">
              {[0, 1, 2].map((index) => (
                <div className="home-skeleton" key={index}>
                  <span className="home-skeleton-thumb" />
                  <span className="home-skeleton-line" />
                  <span className="home-skeleton-line short" />
                </div>
              ))}
            </div>
          ) : recent.length === 0 ? (
            <div className="home-empty">
              <span className="home-empty-icon">
                <FolderOpen size={16} />
              </span>
              <div>
                <p className="home-empty-title">No projects yet</p>
                <p className="home-empty-body">
                  Projects you create will appear here, ready to reopen.
                </p>
              </div>
            </div>
          ) : (
            <ul className="home-grid">
              {recent.map((entry, index) => (
                <ProjectCard
                  key={entry.filePath}
                  entry={entry}
                  thumbId={`proj-${index}`}
                  now={now}
                  onDismiss={dismiss}
                  onRenamed={refresh}
                />
              ))}
            </ul>
          )}
        </section>

        <footer className="home-footer">
          <span className="home-footer-item">
            <span className="home-footer-dot" />
            Local-first · {PRODUCT.license} licensed
          </span>
          <span className="home-footer-item">
            Press <kbd>Ctrl K</kbd> for commands
          </span>
        </footer>
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
        maxLength={PROJECT_NAME_MAX}
        disabled={saving}
        onChange={(event) => setDraft(event.target.value.slice(0, PROJECT_NAME_MAX))}
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

function ProjectCard({
  entry,
  thumbId,
  now,
  onDismiss,
  onRenamed
}: {
  entry: RecentProject
  thumbId: string
  now: number
  onDismiss: (filePath: string) => void
  onRenamed: () => void
}): JSX.Element {
  const [editing, setEditing] = useState(false)

  const startRename = (): void => setEditing(true)

  const renameShortcut = (event: { key: string; preventDefault(): void }): void => {
    if (event.key === 'F2') {
      event.preventDefault()
      startRename()
    }
  }

  const openProject = (): void => {
    void openProjectAt(entry.filePath)
  }

  return (
    <li className={`home-project${editing ? ' editing' : ''}`}>
      <button
        className="home-project-thumb"
        title={`Open ${entry.name}`}
        aria-label={`Open ${entry.name}`}
        onClick={openProject}
        onKeyDown={renameShortcut}
      >
        <ProjectThumbnail filePath={entry.filePath} idPrefix={thumbId} />
        <span className="home-project-open" aria-hidden="true">
          <Play size={13} />
        </span>
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
          title={`Open ${entry.name}`}
          onClick={openProject}
          onKeyDown={renameShortcut}
        >
          <span className="home-project-name">{entry.name}</span>
          <span className="home-project-meta">
            <span>{relativeTime(entry.openedAt, now)}</span>
            <span className="home-project-sep" aria-hidden="true">
              ·
            </span>
            <span className="home-project-path">
              <FolderOpen size={10} />
              {containingFolder(entry.filePath) || 'On this computer'}
            </span>
          </span>
        </button>
      )}

      {editing ? null : (
        <button
          className="home-project-rename"
          title="Rename project (F2)"
          aria-label={`Rename ${entry.name}`}
          onClick={startRename}
        >
          <PenLine size={12} />
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
