import { sampleCamera } from '@core/camera/sample'
import { createId } from '@core/ids'
import { clamp } from '@core/math'
import { addElement, addSceneAudioTrack } from '@core/project/operations'
import { createImageElement, createSvgElement } from '@core/schema/factories'
import type { Rect } from '@core/schema/primitives'
import type { Asset, Project, Scene } from '@core/schema/project'
import { buildSchedule } from '@core/timeline/schedule'
import { useEditorStore } from '../state/editorStore'
import { usePlaybackStore } from '../state/playbackStore'
import { useProjectStore } from '../state/projectStore'
import { useUiStore } from '../state/uiStore'

/** Playhead position relative to the active scene, clamped to its range. */
export function sceneLocalTime(project: Project, scene: Scene): number {
  const schedule = buildSchedule(project)
  const sceneSchedule = schedule.scenes[project.scenes.indexOf(scene)]
  const time = usePlaybackStore.getState().time
  return sceneSchedule ? clamp(time - sceneSchedule.start, 0, sceneSchedule.duration) : 0
}

function fittedFrame(camera: Rect, naturalWidth: number, naturalHeight: number): Rect {
  const scale = Math.min(
    (camera.width * 0.45) / Math.max(1, naturalWidth),
    (camera.height * 0.45) / Math.max(1, naturalHeight),
    4
  )
  const width = Math.max(16, naturalWidth * scale)
  const height = Math.max(16, naturalHeight * scale)
  return {
    x: camera.x + camera.width / 2 - width / 2,
    y: camera.y + camera.height / 2 - height / 2,
    width,
    height
  }
}

/**
 * Place an asset in the active scene at the playhead. Images and SVGs become
 * elements; audio becomes a scene track. Selects the inserted element.
 */
export function insertAssetAtPlayhead(asset: Asset): 'element' | 'audio' | null {
  const { project, apply } = useProjectStore.getState()
  if (!project) return null
  const sceneId = useEditorStore.getState().activeSceneId ?? project.scenes[0]?.id
  const scene = project.scenes.find((candidate) => candidate.id === sceneId) ?? project.scenes[0]
  if (!scene) return null
  const localTime = sceneLocalTime(project, scene)

  if (asset.kind === 'audio') {
    apply(
      'Add audio track',
      (current) =>
        addSceneAudioTrack(current, scene.id, {
          id: createId('aud'),
          name: asset.name,
          assetId: asset.id,
          startTime: localTime,
          inPoint: 0,
          outPoint: null,
          volume: 1,
          fadeIn: 0.15,
          fadeOut: 0.3
        }),
      { coalesce: false }
    )
    useUiStore.getState().toast(`Added “${asset.name}” to the scene audio.`, 'success')
    return 'audio'
  }

  const camera = sampleCamera(scene.cameras, localTime, project.output)
  const naturalWidth = asset.svg?.viewBox.width ?? asset.image?.width ?? 400
  const naturalHeight = asset.svg?.viewBox.height ?? asset.image?.height ?? 400
  const frame = fittedFrame(camera.frame, naturalWidth, naturalHeight)
  const element =
    asset.kind === 'svg'
      ? createSvgElement(asset, { name: asset.name, frame })
      : createImageElement(asset, { name: asset.name, frame })
  apply('Insert asset', (current) => addElement(current, scene.id, element), {
    coalesce: false
  })
  useEditorStore.getState().select([element.id])
  return 'element'
}
