import { expect, it } from 'vitest'
import { buildSchedule } from '@core/timeline/schedule'
import {
  createProject,
  createScene,
  createShapeElement,
  createTextElement
} from '@core/schema/factories'

it('diagnose', () => {
  const project = createProject({ name: 'Harness', width: 1280, height: 720, fps: 30 })
  project.scenes = [0, 1, 2].map((index) => createScene(project.output, index))
  project.scenes[0]!.elements = [
    createTextElement('Export works', { frame: { x: -360, y: -140, width: 720, height: 180 } })
  ]
  project.scenes[1]!.elements = [
    createShapeElement('rectangle', { frame: { x: -420, y: -160, width: 840, height: 320 } })
  ]
  const schedule = buildSchedule(project)
  console.log(
    JSON.stringify(
      {
        duration: schedule.duration,
        scenes: schedule.scenes.map((s) => ({
          start: s.start,
          duration: s.duration,
          end: s.end,
          elements: s.elements,
          cameras: s.cameras,
          audio: s.audio
        })),
        anim: project.scenes[0]!.elements[0]!.animation
      },
      null,
      2
    )
  )
  expect(Number.isFinite(schedule.duration)).toBe(true)
})
