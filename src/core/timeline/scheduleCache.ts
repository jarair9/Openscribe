import type { Project } from '../schema/project'
import { buildSchedule, type ProjectSchedule } from './schedule'

/**
 * Cheap structural key for the fields `buildSchedule` actually reads. Camera
 * centre and view width are deliberately excluded: moving or resizing a camera
 * changes the document object but never the timeline, so a drag no longer
 * rebuilds the whole schedule on every pointer move.
 */
function timingKey(project: Project): string {
  const parts: string[] = []
  for (const scene of project.scenes) {
    parts.push(scene.id, String(scene.holdAfter))
    for (const element of scene.elements) {
      const { timing, animation } = element
      parts.push(
        element.id,
        timing.mode,
        String(timing.start),
        String(animation.entrance.duration),
        String(animation.pauseAfter),
        animation.emphasis.type,
        String(animation.emphasis.duration),
        String(animation.emphasis.loops),
        String(animation.emphasis.delay),
        animation.exit.type,
        String(animation.exit.duration),
        String(animation.exit.delay)
      )
    }
    for (const camera of scene.cameras) {
      parts.push(camera.id, String(camera.startTime), String(camera.transition.duration))
    }
    for (const track of scene.audio) {
      parts.push(
        track.id,
        track.assetId,
        String(track.startTime),
        String(track.inPoint),
        String(track.outPoint ?? '')
      )
    }
  }
  for (const asset of project.assets) {
    if (asset.audio) parts.push(asset.id, String(asset.audio.duration))
  }
  return parts.join('|')
}

const MAX_CACHED = 8
const cache = new Map<string, ProjectSchedule>()
let lastProject: Project | null = null
let lastSchedule: ProjectSchedule | null = null

/** A memoized `buildSchedule` for render paths that run on every frame. */
export function scheduleFor(project: Project): ProjectSchedule {
  if (lastProject === project && lastSchedule) return lastSchedule

  const key = timingKey(project)
  let schedule = cache.get(key)
  if (!schedule) {
    schedule = buildSchedule(project)
    cache.set(key, schedule)
    if (cache.size > MAX_CACHED) {
      const oldest = cache.keys().next().value
      if (oldest !== undefined) cache.delete(oldest)
    }
  }

  lastProject = project
  lastSchedule = schedule
  return schedule
}
