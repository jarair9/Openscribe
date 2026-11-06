import type { AudioTrack, Element, Project, Scene } from '../schema/project'

export interface ElementSchedule {
  elementId: string
  /** Scene-relative start of the entrance. */
  start: number
  entranceEnd: number
  emphasisStart: number
  emphasisEnd: number
  exitStart: number
  exitEnd: number
  /** Last moment at which the element can be visible. */
  end: number
}

export interface CameraSchedule {
  cameraId: string
  start: number
  end: number
}

export interface AudioSchedule {
  trackId: string
  start: number
  end: number
  duration: number
}

export interface SceneSchedule {
  sceneId: string
  index: number
  /** Absolute project time at which the scene begins. */
  start: number
  duration: number
  end: number
  elements: Record<string, ElementSchedule>
  cameras: CameraSchedule[]
  audio: AudioSchedule[]
}

export interface ProjectSchedule {
  version: number
  duration: number
  scenes: SceneSchedule[]
  /** Flat lookup helper: elementId -> its scene + timing. */
  elements: Record<string, { sceneIndex: number; sceneId: string; timing: ElementSchedule }>
}

const MIN_SCENE_DURATION = 1

export function sceneElementTiming(element: Element, cursor: number): ElementSchedule {
  const start = element.timing.mode === 'manual' ? element.timing.start : cursor
  const entranceEnd = start + element.animation.entrance.duration
  const emphasisDuration =
    element.animation.emphasis.type === 'none'
      ? 0
      : element.animation.emphasis.duration * element.animation.emphasis.loops
  const emphasisStart = entranceEnd + element.animation.emphasis.delay
  const emphasisEnd = emphasisStart + emphasisDuration
  const exitStart =
    Math.max(entranceEnd, emphasisEnd) + element.animation.exit.delay
  const exitDuration =
    element.animation.exit.type === 'none' ? 0 : element.animation.exit.duration
  const exitEnd = exitStart + exitDuration
  return {
    elementId: element.id,
    start,
    entranceEnd,
    emphasisStart,
    emphasisEnd,
    exitStart,
    exitEnd,
    end: Math.max(entranceEnd, emphasisEnd, exitEnd)
  }
}

function audioDurationOf(project: Project, track: AudioTrack): number {
  const asset = project.assets.find((candidate) => candidate.id === track.assetId)
  const sourceDuration = asset?.audio?.duration ?? 0
  const outPoint = track.outPoint ?? sourceDuration
  return Math.max(0, outPoint - track.inPoint)
}

function scheduleScene(
  project: Project,
  scene: Scene,
  index: number,
  start: number
): SceneSchedule {
  const elements: Record<string, ElementSchedule> = {}
  let cursor = 0
  let contentEnd = 0

  for (const element of scene.elements) {
    const timing = sceneElementTiming(element, cursor)
    elements[element.id] = timing
    contentEnd = Math.max(contentEnd, timing.end)
    cursor = Math.max(cursor, timing.start + element.animation.entrance.duration + element.animation.pauseAfter)
  }

  const cameras: CameraSchedule[] = scene.cameras.map((camera, cameraIndex) => ({
    cameraId: camera.id,
    start: cameraIndex === 0 ? 0 : camera.startTime,
    end:
      cameraIndex === 0
        ? camera.startTime
        : camera.startTime + Math.max(0, camera.transition.duration)
  }))
  const cameraEnd = cameras.reduce((max, entry) => Math.max(max, entry.end), 0)

  const audio: AudioSchedule[] = scene.audio.map((track) => {
    const duration = audioDurationOf(project, track)
    return {
      trackId: track.id,
      start: track.startTime,
      duration,
      end: track.startTime + duration
    }
  })
  const audioEnd = audio.reduce((max, entry) => Math.max(max, entry.end), 0)

  const duration =
    Math.max(MIN_SCENE_DURATION, contentEnd, cameraEnd, audioEnd) + scene.holdAfter

  return {
    sceneId: scene.id,
    index,
    start,
    duration,
    end: start + duration,
    elements,
    cameras,
    audio
  }
}

/**
 * Derive the complete schedule from the document. The result is a pure
 * function of the project: identical documents always produce identical
 * schedules, which preview and export share.
 */
export function buildSchedule(project: Project): ProjectSchedule {
  const scenes: SceneSchedule[] = []
  const elements: ProjectSchedule['elements'] = {}
  let cursor = 0

  project.scenes.forEach((scene, index) => {
    const scheduled = scheduleScene(project, scene, index, cursor)
    scenes.push(scheduled)
    for (const timing of Object.values(scheduled.elements)) {
      elements[timing.elementId] = {
        sceneIndex: index,
        sceneId: scene.id,
        timing
      }
    }
    cursor = scheduled.end
  })

  return {
    version: 1,
    duration: Math.max(0.1, cursor),
    scenes,
    elements
  }
}

export function sceneAt(
  schedule: ProjectSchedule,
  time: number
): { scene: SceneSchedule; localTime: number } {
  const t = Math.max(0, time)
  for (let index = 0; index < schedule.scenes.length; index += 1) {
    const scene = schedule.scenes[index]!
    const isLast = index === schedule.scenes.length - 1
    if (t < scene.end || isLast) {
      return { scene, localTime: Math.min(t - scene.start, scene.duration) }
    }
  }
  const last = schedule.scenes[schedule.scenes.length - 1]!
  return { scene: last, localTime: last.duration }
}

export function sceneScheduleById(
  schedule: ProjectSchedule,
  sceneId: string
): SceneSchedule | undefined {
  return schedule.scenes.find((scene) => scene.sceneId === sceneId)
}

export function absoluteElementRange(
  schedule: ProjectSchedule,
  elementId: string
): { start: number; end: number } | null {
  const entry = schedule.elements[elementId]
  if (!entry) return null
  const scene = schedule.scenes[entry.sceneIndex]!
  return {
    start: scene.start + entry.timing.start,
    end: scene.start + entry.timing.end
  }
}
