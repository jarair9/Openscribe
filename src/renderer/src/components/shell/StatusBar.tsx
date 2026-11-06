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
          <span className="statusbar-item">{status ?? (dirty ? 'Modified' : 'Ready')}</span>
        </>
      ) : null}
      <span className="statusbar-item">Local-first · no network</span>
    </footer>
  )
}
