import { clamp01, ease, progress } from '../math'
import { sampleCamera, type CameraSample } from '../camera/sample'
import {
  evaluateElement,
  type ElementVisualState
} from './evaluate'
import { drawablesForElement } from '../assets/resolve'
import type { OutputSettings, Project, Scene } from '../schema/project'
import type { ProjectSchedule } from '../timeline/schedule'
import { sceneAt } from '../timeline/schedule'

export interface SceneVisual {
  sceneIndex: number
  sceneId: string
  sceneStart: number
  duration: number
  localTime: number
  /** Fade opacity for the scene entrance transition (1 when settled). */
  transitionOpacity: number
  camera: CameraSample
  elements: Record<string, ElementVisualState>
}

export interface ProjectVisual {
  time: number
  duration: number
  scene: SceneVisual
}

function sceneTransitionOpacity(scene: Scene, sceneIndex: number, localTime: number): number {
  if (sceneIndex === 0) return 1
  if (scene.transition.type !== 'fade') return 1
  const duration = scene.transition.duration
  if (duration <= 0) return 1
  return ease('easeOut', clamp01(localTime / duration))
}

export function evaluateScene(
  project: Project,
  scene: Scene,
  sceneIndex: number,
  localTime: number,
  duration: number,
  sceneStart: number,
  output: OutputSettings,
  schedule: ProjectSchedule
): SceneVisual {
  const sceneSchedule = schedule.scenes[sceneIndex]
  const elements: Record<string, ElementVisualState> = {}
  const camera = sampleCamera(scene.cameras, localTime, output)
  for (const element of scene.elements) {
    const timing = sceneSchedule?.elements[element.id]
    if (!timing) continue
    elements[element.id] = evaluateElement(
      element,
      timing,
      localTime,
      drawablesForElement(project, element),
      camera.frame
    )
  }
  return {
    sceneIndex,
    sceneId: scene.id,
    sceneStart,
    duration,
    localTime,
    transitionOpacity: sceneTransitionOpacity(scene, sceneIndex, localTime),
    camera,
    elements
  }
}

/**
 * "What does the project look like at exactly time t?"
 * This single function powers editor preview and future export rendering.
 */
export function evaluateProjectAt(
  project: Project,
  schedule: ProjectSchedule,
  time: number
): ProjectVisual {
  const clamped = Math.max(0, Math.min(time, schedule.duration))
  const { scene, localTime } = sceneAt(schedule, clamped)
  const sceneIndex = scene.index
  const sceneDoc = project.scenes[sceneIndex]!
  const visual = evaluateScene(
    project,
    sceneDoc,
    sceneIndex,
    localTime,
    scene.duration,
    scene.start,
    project.output,
    schedule
  )
  return {
    time: clamped,
    duration: schedule.duration,
    scene: visual
  }
}

/** Progress of the whole project, used by the playhead/status bar. */
export function projectProgress(schedule: ProjectSchedule, time: number): number {
  return progress(0, schedule.duration, time)
}
