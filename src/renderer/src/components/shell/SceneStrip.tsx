import { useEffect, useRef, useState, type JSX } from 'react'
import { ArrowLeft, ArrowRight, Plus, Trash2 } from 'lucide-react'
import { formatSeconds } from '@core/math'
import { addScene, duplicateScene, moveScene, removeScene } from '@core/project/operations'
import type { ProjectSchedule } from '@core/timeline/schedule'
import { seekToScene } from '../../hooks/usePlaybackClock'
import { useEditorStore } from '../../state/editorStore'
import { useProjectStore } from '../../state/projectStore'
import { useUiStore } from '../../state/uiStore'
import { SceneThumbnail } from './SceneThumbnail'

interface SceneMenuState {
  sceneId: string
  x: number
  y: number
}

export function SceneStrip({ schedule }: { schedule: ProjectSchedule }): JSX.Element | null {
  const project = useProjectStore((state) => state.project)
  const apply = useProjectStore((state) => state.apply)
  const activeSceneId = useEditorStore((state) => state.activeSceneId)
  const setActiveScene = useEditorStore((state) => state.setActiveScene)
  const askConfirm = useUiStore((state) => state.askConfirm)
  const [menu, setMenu] = useState<SceneMenuState | null>(null)
  const dragId = useRef<string | null>(null)

  useEffect(() => {
    if (!menu) return
    const close = (): void => setMenu(null)
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [menu])

  if (!project) return null

  const activate = (sceneId: string): void => {
    setActiveScene(sceneId)
    seekToScene(sceneId)
  }

  const add = (): void => {
    let newId: string | null = null
    apply(
      'Add scene',
      (current) => {
        const result = addScene(current, {
          afterSceneId: activeSceneId ?? undefined
        })
        newId = result.sceneId
        return result.project
      },
      { coalesce: false }
    )
    if (newId) {
      const sceneId: string = newId
      activate(sceneId)
    }
  }

  const duplicate = (sceneId: string): void => {
    const result = duplicateScene(project, sceneId)
    if (!result) return
    apply('Duplicate scene', () => result.project, { coalesce: false })
    activate(result.sceneId)
  }

  const remove = async (sceneId: string): Promise<void> => {
    if (project.scenes.length <= 1) {
      useUiStore.getState().toast('A project needs at least one scene.', 'info')
      return
    }
    const scene = project.scenes.find((candidate) => candidate.id === sceneId)
    if (!scene) return
    const confirmed = await askConfirm({
      title: 'Delete scene?',
      message: `“${scene.name}” and its elements will be removed. This can be undone.`,
      confirmLabel: 'Delete scene'
    })
    if (!confirmed) return
    const index = project.scenes.findIndex((candidate) => candidate.id === sceneId)
    apply('Delete scene', (current) => removeScene(current, sceneId), { coalesce: false })
    const next = useProjectStore.getState().project?.scenes[Math.max(0, index - 1)]
    if (next) activate(next.id)
  }

  const move = (sceneId: string, offset: number): void => {
    apply('Reorder scenes', (current) => moveScene(current, sceneId, offset), { coalesce: false })
  }

  return (
    <div className="scene-strip" role="list" aria-label="Scenes">
      {project.scenes.map((scene, index) => {
        const sceneSchedule = schedule.scenes[index]
        return (
          <div
            key={scene.id}
            role="listitem"
            className={`scene-card ${scene.id === activeSceneId ? 'active' : ''}`}
            draggable
            title={`${scene.name} · ${formatSeconds(sceneSchedule?.duration ?? 0, true)}`}
            onClick={() => activate(scene.id)}
            onContextMenu={(event) => {
              event.preventDefault()
              setActiveScene(scene.id)
              setMenu({ sceneId: scene.id, x: event.clientX, y: event.clientY })
            }}
            onDragStart={() => {
              dragId.current = scene.id
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              const source = dragId.current
              dragId.current = null
              if (!source || source === scene.id) return
              const from = project.scenes.findIndex((candidate) => candidate.id === source)
              const to = project.scenes.findIndex((candidate) => candidate.id === scene.id)
              if (from === -1 || to === -1) return
              move(source, to - from)
            }}
          >
            <div className="scene-card-thumb">
              <SceneThumbnail
                project={project}
                scene={scene}
                sceneIndex={index}
                schedule={schedule}
                idPrefix={`thumb-${scene.id}`}
              />
            </div>
            <span className="scene-card-index">{index + 1}</span>
            <button
              className="scene-card-delete"
              title={
                project.scenes.length <= 1
                  ? 'A project needs at least one scene'
                  : `Delete ${scene.name}`
              }
              aria-label={`Delete ${scene.name}`}
              disabled={project.scenes.length <= 1}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                void remove(scene.id)
              }}
            >
              <Trash2 size={11} />
            </button>
            <div className="scene-card-footer">
              <span className="scene-card-name">{scene.name}</span>
              <span className="scene-card-duration">
                {formatSeconds(sceneSchedule?.duration ?? 0)}
              </span>
            </div>
          </div>
        )
      })}
      <button className="scene-add" title="Add scene" onClick={add}>
        <Plus size={15} />
        <span>Add scene</span>
      </button>

      {menu ? (
        <div
          className="menu-popover"
          style={{ position: 'fixed', left: menu.x, top: menu.y, right: 'auto', zIndex: 90 }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            className="menu-item"
            onClick={() => {
              setMenu(null)
              duplicate(menu.sceneId)
            }}
          >
            Duplicate scene
          </button>
          <button
            className="menu-item"
            disabled={project.scenes[0]?.id === menu.sceneId}
            onClick={() => {
              setMenu(null)
              move(menu.sceneId, -1)
            }}
          >
            <ArrowLeft size={13} /> Move earlier
          </button>
          <button
            className="menu-item"
            disabled={project.scenes[project.scenes.length - 1]?.id === menu.sceneId}
            onClick={() => {
              setMenu(null)
              move(menu.sceneId, 1)
            }}
          >
            <ArrowRight size={13} /> Move later
          </button>
          <div className="menu-sep" />
          <button
            className="menu-item"
            disabled={project.scenes.length <= 1}
            onClick={() => {
              setMenu(null)
              void remove(menu.sceneId)
            }}
          >
            <Trash2 size={13} /> Delete scene
          </button>
        </div>
      ) : null}
    </div>
  )
}
