import { evaluateScene, type SceneVisual } from '@core/animation/scene'
import { clamp } from '@core/math'
import type { Project, Scene } from '@core/schema/project'
import type { ProjectSchedule, SceneSchedule } from '@core/timeline/schedule'

/**
 * Time used for still previews. Entrances are all complete, but the sample
 * stops just before the earliest exit so a finished scene does not collapse
 * into an empty frame.
 */
export function previewTimeOf(scene: Scene, schedule: SceneSchedule): number {
  let entranceEnd = 0
  let earliestExit = Infinity
  for (const element of scene.elements) {
    const timing = schedule.elements[element.id]
    if (!timing) continue
    entranceEnd = Math.max(entranceEnd, timing.entranceEnd)
    if (element.animation.exit.type !== 'none') {
      earliestExit = Math.min(earliestExit, timing.exitStart)
    }
  }
  const limit = Number.isFinite(earliestExit) ? earliestExit - 0.001 : schedule.duration
  return clamp(Math.min(entranceEnd, limit), 0, schedule.duration)
}

export function scenePreview(
  project: Project,
  scene: Scene,
  sceneIndex: number,
  schedule: ProjectSchedule
): SceneVisual | null {
  const sceneSchedule = schedule.scenes[sceneIndex]
  if (!sceneSchedule) return null
  return evaluateScene(
    project,
    scene,
    sceneIndex,
    previewTimeOf(scene, sceneSchedule),
    sceneSchedule.duration,
    sceneSchedule.start,
    project.output,
    schedule
  )
}
