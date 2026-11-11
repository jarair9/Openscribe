import { useEffect, useRef, useState, type JSX } from 'react'
import {
  ArrowRight,
  Check,
  FilePlus2,
  Film,
  FolderOpen,
  HardDrive,
  Music2,
  PenLine,
  Play,
  X
} from 'lucide-react'
import { PRODUCT } from '@shared/product'
import { PROJECT_NAME_MAX } from '@core/schema/project'
import { forgetProject, listRecentProjects, type RecentProject } from '../../lib/recent'
import { openProjectAt, openProjectFromDialog, renameProjectFile } from '../../services/projectFiles'
import { useUiStore } from '../../state/uiStore'
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
  const [recent, setRecent] = useState(listRecentProjects)
  const [now, setNow] = useState(() => Date.now())

  const dismiss = (filePath: string): void => setRecent(forgetProject(filePath))
  const refresh = (): void => setRecent(listRecentProjects())

  // Keep "2 min ago" honest while the picker stays open.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  // Drop entries whose file has been moved or deleted instead of showing a
  // card that fails only when clicked.
  useEffect(() => {
    let cancelled = false
    const entries = listRecentProjects()
    void Promise.all(
      entries.map((entry) => window.api.project.exists(entry.filePath).catch(() => true))
    ).then((exists) => {
      if (cancelled) return
      const missing = entries.filter((_, index) => !exists[index])
      if (missing.length === 0) return
      for (const entry of missing) forgetProject(entry.filePath)
      setRecent(listRecentProjects())
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="welcome home">
      <div className="home-backdrop" aria-hidden="true" />
      <div className="home-inner">
        <section className="home-hero">
          <div className="home-hero-copy">
            <div className="home-kicker-row">
              <p className="home-eyebrow">No cloud. No account. Just your ideas.</p>
              <span className="home-pill">
                <HardDrive size={11} />
                Local-first
              </span>
            </div>
            <h1 className="home-headline">
              Draw it. Animate it.
              <span className="home-headline-accent">Publish it.</span>
            </h1>
            <p className="home-tagline">
              Build hand-drawn explainer videos on an open canvas, then preview and export them
              offline. Every project stays on this computer, in a folder you own.
            </p>

            <div className="home-cta">
              <button className="home-primary" onClick={() => openDialog('newProject')}>
                <FilePlus2 size={17} />
                <span>New project</span>
                <kbd>Ctrl N</kbd>
              </button>
              <button className="home-ghost" onClick={() => void openProjectFromDialog()}>
                <FolderOpen size={17} />
                <span>Open project</span>
                <kbd>Ctrl O</kbd>
              </button>
            </div>

            <ul className="home-points">
              <li>
                <PenLine size={13} />
                <span>Hand-drawn animation</span>
              </li>
              <li>
                <Music2 size={13} />
                <span>Voiceover &amp; audio</span>
              </li>
              <li>
                <Film size={13} />
                <span>Offline MP4 &amp; GIF export</span>
              </li>
            </ul>
          </div>

          <div className="home-hero-art" aria-hidden="true">
            <div className="home-art-glow" />
            <div className="home-art-card">
              <svg className="home-art-sketch" viewBox="0 0 480 320" role="presentation">
                <defs>
                  <pattern id="home-art-dots" width="18" height="18" patternUnits="userSpaceOnUse">
                    <circle cx="2" cy="2" r="1.2" fill="#dedbd2" />
                  </pattern>
                </defs>
                <rect x="24" y="20" width="432" height="280" rx="16" fill="url(#home-art-dots)" />

                <g className="home-art-camera">
                  <rect x="62" y="64" width="356" height="188" rx="12" />
                  <path d="M62 96 V78 A16 16 0 0 1 78 62 H96" />
                  <path d="M384 62 H402 A16 16 0 0 1 418 78 V96" />
                  <path d="M62 220 V238 A16 16 0 0 0 78 254 H96" />
                  <path d="M384 254 H402 A16 16 0 0 0 418 238 V220" />
                </g>

                <g className="home-art-ink">
                  <path d="M92 206 C 112 138, 156 100, 198 124 C 238 146, 212 198, 180 184 C 152 172, 176 136, 216 142 C 256 148, 262 196, 232 212" />
                  <path d="M266 168 C 292 136, 328 124, 358 138" />
                  <path d="M348 122 L 364 138 L 344 150" />
                  <path d="M286 216 C 302 208, 320 208, 336 216" />
                </g>

                <g className="home-art-accent">
                  <path d="M112 156 C 130 132, 150 124, 170 130" />
                  <path d="M360 194 C 372 184, 386 184, 398 194" />
                </g>

                <g className="home-art-timeline">
                  <rect x="84" y="272" width="312" height="8" rx="4" />
                  <rect x="84" y="272" width="146" height="8" rx="4" className="home-art-progress" />
                  <circle cx="230" cy="276" r="8" className="home-art-playhead" />
                </g>
              </svg>
            </div>
            <div className="home-art-foot">
              <span className="home-art-dot" />
              <span>Saved as a plain folder you own</span>
            </div>
          </div>
        </section>

        <section className="home-projects" aria-label="Recent projects">
          <header className="home-projects-head">
            <div className="home-projects-title">
              <h2>Recent projects</h2>
              {recent.length > 0 ? <span className="home-count">{recent.length}</span> : null}
            </div>
            <button className="home-link-btn" onClick={() => void openProjectFromDialog()}>
              Browse files
              <ArrowRight size={13} />
            </button>
          </header>

          {recent.length === 0 ? (
            <div className="home-empty">
              <div className="home-empty-art" aria-hidden="true">
                <span className="home-empty-frame" />
                <FilePlus2 size={22} />
              </div>
              <div className="home-empty-copy">
                <h3 className="home-empty-title">Start your first project</h3>
                <p className="home-empty-body">
                  Everything you make is saved as a portable project folder on disk. Create one now
                  and it will be waiting here next time.
                </p>
                <div className="home-empty-actions">
                  <button className="home-empty-action" onClick={() => openDialog('newProject')}>
                    <FilePlus2 size={14} />
                    Create a project
                  </button>
                  <button
                    className="home-empty-secondary"
                    onClick={() => void openProjectFromDialog()}
                  >
                    <FolderOpen size={14} />
                    Open an existing one
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
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
              <p className="home-projects-hint">
                Press F2 or use the pencil on a card to rename · removing a project here only
                clears the list, your files stay on disk.
              </p>
            </>
          )}
        </section>

        <footer className="home-footer">
          <span className="home-footer-item">
            <span className="home-footer-dot" />
            {PRODUCT.name} {PRODUCT.version}
          </span>
          <span className="home-footer-item">
            {PRODUCT.license} license · Projects are folders containing an{' '}
            <code>.{PRODUCT.projectExtension}</code> document
          </span>
          <span className="home-footer-item home-footer-tip">
            Press <kbd>Ctrl K</kbd> anywhere for commands
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
        <span className="home-project-open">
          <Play size={12} />
          Open
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
            <span className="home-project-path">
              <FolderOpen size={10} />
              {containingFolder(entry.filePath) || entry.filePath}
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
