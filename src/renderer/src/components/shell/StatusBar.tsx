import { useMemo, type JSX } from 'react'
import { formatSeconds } from '@core/math'
import { buildSchedule } from '@core/timeline/schedule'
import { useEditorStore } from '../../state/editorStore'
import { usePlaybackStore } from '../../state/playbackStore'
import { useProjectStore } from '../../state/projectStore'

export function StatusBar(): JSX.Element {
  const project = useProjectStore((state) => state.project)
  const status = useProjectStore((state) => state.status)
  const dirty = useProjectStore((state) => state.dirty)
  const saving = useProjectStore((state) => state.saving)
  const saveError = useProjectStore((state) => state.saveError)
  const lastAutoSaveAt = useProjectStore((state) => state.lastAutoSaveAt)
  const activeSceneId = useEditorStore((state) => state.activeSceneId)
  const selection = useEditorStore((state) => state.selection)
  const tool = useEditorStore((state) => state.tool)
  const viewport = useEditorStore((state) => state.viewport)
  const time = usePlaybackStore((state) => state.time)
  const schedule = useMemo(() => (project ? buildSchedule(project) : null), [project])
  const scene = project?.scenes.find((candidate) => candidate.id === activeSceneId)

  return (
    <footer className="statusbar">
      <span className="statusbar-item">Tool: {tool}</span>
      {project ? (
        <>
          <span className="statusbar-item">{scene?.name ?? 'No scene'}</span>
          <span className="statusbar-item">
            {selection.length === 0
              ? 'Nothing selected'
              : `${selection.length} selected`}
          </span>
        </>
      ) : (
        <span className="statusbar-item">No project open</span>
      )}
      <div className="statusbar-spacer" />
      {project ? (
        <>
          <span className="statusbar-item">
            {formatSeconds(time, true)} / {formatSeconds(schedule?.duration ?? 0, true)}
          </span>
          <span className="statusbar-item">
            {project.output.width}×{project.output.height} · {project.output.fps} fps
          </span>
          <span className="statusbar-item">Zoom {Math.round(viewport.zoom * 100)}%</span>
          <span
            className={`statusbar-item save-status ${saveError ? 'error' : ''}`}
            title={status ?? undefined}
          >
            {saveError
              ? `Save failed: ${saveError}`
              : saving
                ? 'Saving…'
                : dirty
                  ? 'Unsaved changes'
                  : lastAutoSaveAt
                    ? `Autosaved ${new Date(lastAutoSaveAt).toLocaleTimeString()}`
                    : 'Saved'}
          </span>
        </>
      ) : null}
      <span className="statusbar-item">Local-first · no network</span>
    </footer>
  )
}
