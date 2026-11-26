import { describe, expect, it } from 'vitest'
import { buildSchedule } from '../../src/core/timeline/schedule'
import {
  createAnimation,
  createAsset,
  createImageElement,
  createProject,
  createTextElement
} from '../../src/core/schema/factories'
import { previewTimeOf, scenePreview } from '../../src/renderer/src/lib/scenePreview'

/**
 * Mirrors the failing project: a headline that erases itself at 2.75s and a
 * logo that is only scheduled in at 3.07s, so the two are never on the board
 * together.
 */
function erasingHeadlineAndLateLogo() {
  const project = createProject({ name: 'Late logo', width: 1920, height: 1080 })
  const heading = createTextElement('Your headline', {
    name: 'Heading',
    frame: { x: -300, y: -360, width: 600, height: 150 },
    animation: createAnimation({
      exit: { type: 'erase', duration: 0.6, easing: 'easeIn' }
    })
  })
  const asset = createAsset('image', {
    name: 'Logo',
    fileName: 'logo.png',
    mimeType: 'image/png',
    byteSize: 2048,
    contentHash: 'a'.repeat(64),
    image: { width: 2400, height: 1792 }
  })
  const logo = createImageElement(asset, {
    name: 'Logo',
    frame: { x: -272, y: -186, width: 650, height: 486 },
    animation: createAnimation({
      entrance: { type: 'handDraw', duration: 2.4, direction: 'diagonal' }
    })
  })
  logo.timing = { mode: 'manual', start: 3.07 }
  project.assets = [asset]
  project.scenes[0]!.elements = [heading, logo]
  return { project, heading, logo }
}

describe('still preview timing', () => {
  it('does not freeze on a moment before a late element has arrived', () => {
    const { project, heading, logo } = erasingHeadlineAndLateLogo()
    const schedule = buildSchedule(project)
    const scene = project.scenes[0]!
    const time = previewTimeOf(scene, schedule.scenes[0]!)

    // The logo finishes drawing at 3.07 + 2.4; the headline is long gone.
    expect(time).toBeCloseTo(5.47, 1)

    const visual = scenePreview(project, scene, 0, schedule)!
    expect(visual.elements[logo.id]!.rendered).toBe(true)
    expect(visual.elements[heading.id]!.rendered).toBe(false)
  })

  it('shows every element when they do overlap', () => {
    const { project, heading, logo } = erasingHeadlineAndLateLogo()
    heading.animation.exit = { ...heading.animation.exit, type: 'none' }
    const schedule = buildSchedule(project)
    const scene = project.scenes[0]!
    const visual = scenePreview(project, scene, 0, schedule)!

    expect(visual.elements[logo.id]!.rendered).toBe(true)
    expect(visual.elements[heading.id]!.rendered).toBe(true)
  })

  it('keeps a finished scene on screen instead of collapsing to an empty frame', () => {
    const { project } = erasingHeadlineAndLateLogo()
    project.scenes[0]!.elements = project.scenes[0]!.elements.map((element) => ({
      ...element,
      animation: {
        ...element.animation,
        exit: { ...element.animation.exit, type: 'erase', duration: 0.6 }
      }
    }))
    const schedule = buildSchedule(project)
    const scene = project.scenes[0]!
    const time = previewTimeOf(scene, schedule.scenes[0]!)
    expect(time).toBeLessThanOrEqual(schedule.scenes[0]!.duration + 1e-6)

    const visual = scenePreview(project, scene, 0, schedule)!
    const shown = Object.values(visual.elements).filter((state) => state.rendered)
    expect(shown.length).toBeGreaterThan(0)
  })

  it('starts at zero for an empty scene', () => {
    const { project } = erasingHeadlineAndLateLogo()
    project.scenes[0]!.elements = []
    const schedule = buildSchedule(project)
    expect(previewTimeOf(project.scenes[0]!, schedule.scenes[0]!)).toBe(0)
  })
})
