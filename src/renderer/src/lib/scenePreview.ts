import { evaluateScene, type SceneVisual } from '@core/animation/scene'
import { clamp } from '@core/math'
import type { Project, Scene } from '@core/schema/project'
import type { ElementSchedule, ProjectSchedule, SceneSchedule } from '@core/timeline/schedule'

interface PreviewEntry {
  element: Scene['elements'][number]
  timing: ElementSchedule
}

function previewEntries(scene: Scene, schedule: SceneSchedule): PreviewEntry[] {
  return scene.elements.flatMap((element) => {
    const timing = schedule.elements[element.id]
    return timing ? [{ element, timing }] : []
  })
}

/** True when the element is fully drawn and has not started leaving. */
function settledAt(entry: PreviewEntry, time: number): boolean {
  const { element, timing } = entry
  if (time < timing.start) return false
  // An entrance that is still running is not the finished picture.
  if (time < timing.entranceEnd - 1e-6) return false
  if (element.animation.exit.type === 'none') return true
  // At the very start of an exit the element is still fully there; only drop it
  // once the exit has run its course.
  return time < timing.exitEnd - 1e-6
}

/**
 * Time used for still previews: the moment that shows the most finished
 * elements at once.
 *
 * Taking the time just before the earliest exit is not enough. Elements do not
 * line up — a headline can erase itself before a later logo has even been drawn
 * — and clamping to that first exit hides everything that starts afterwards, so
 * the thumbnail says "logo missing" when the logo is simply late. Scoring the
 * moments where the picture changes and keeping the busiest one shows the whole
 * scene whenever the scene allows it, and the richest frame when it does not.
 */
export function previewTimeOf(scene: Scene, schedule: SceneSchedule): number {
  const entries = previewEntries(scene, schedule)
  if (entries.length === 0) return 0

  const moments = new Set<number>([0])
  for (const { timing } of entries) {
    moments.add(clamp(timing.entranceEnd, 0, schedule.duration))
    if (timing.exitEnd > timing.exitStart) {
      moments.add(clamp(timing.exitStart, 0, schedule.duration))
    }
  }

  let bestTime = 0
  let bestCount = -1
  for (const time of [...moments].sort((a, b) => a - b)) {
    let count = 0
    for (const entry of entries) {
      if (settledAt(entry, time)) count += 1
    }
    // Ties go to the later moment, which keeps the preview as close to the
    // scene's finished state as possible.
    if (count >= bestCount) {
      bestCount = count
      bestTime = time
    }
  }
  return bestTime
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
