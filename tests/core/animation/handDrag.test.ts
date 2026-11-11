import { describe, expect, it } from 'vitest'
import { dragVector, evaluateElement } from '../../../src/core/animation/evaluate'
import { createTextElement } from '../../../src/core/schema/factories'
import { DEFAULT_DRAG_INSTRUMENT_ID, DRAG_INSTRUMENTS, isEraserInstrument, isGestureHandName } from '../../../src/core/instruments'
import type { Rect } from '../../../src/core/schema/primitives'

const CAMERA: Rect = { x: 0, y: 0, width: 1280, height: 720 }

const timing = {
  elementId: 'drag',
  start: 0,
  entranceEnd: 1.2,
  emphasisStart: 1.2,
  emphasisEnd: 1.2,
  exitStart: 1.2,
  exitEnd: 1.2,
  end: 1.2
}

function dragElement(dragFrom: number, instrumentId: string | null = null) {
  const element = createTextElement('Hold', {
    name: 'Drag test',
    frame: { x: 490, y: 310, width: 300, height: 100 },
    animation: {
      entrance: {
        type: 'handDrag',
        duration: 1.2,
        easing: 'linear',
        direction: 'right',
        instrumentId,
        handedness: 'right',
        dragFrom
      },
      emphasis: { type: 'none', duration: 0, loops: 1, intensity: 0, delay: 0 },
      exit: {
        type: 'none',
        duration: 0,
        easing: 'linear',
        direction: 'down',
        delay: 0,
        instrumentId: null
      },
      pauseAfter: 0
    }
  })
  element.id = 'drag'
  return element
}

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

describe('hand drag-in entrance', () => {
  it('starts the element fully outside the camera from all twelve hours', () => {
    for (const hour of HOURS) {
      const element = dragElement(hour)
      const state = evaluateElement(element, timing, 0.0001, [], CAMERA)
      const frame = element.frame
      const left = frame.x + state.translate.x
      const top = frame.y + state.translate.y
      const outside =
        left >= CAMERA.x + CAMERA.width ||
        left + frame.width <= CAMERA.x ||
        top >= CAMERA.y + CAMERA.height ||
        top + frame.height <= CAMERA.y
      expect(outside, `hour ${hour} starts off-stage`).toBe(true)
    }
  })

  it('keeps the element whole and opaque while it is carried', () => {
    const state = evaluateElement(dragElement(3), timing, 0.6, [], CAMERA)
    expect(state.opacity).toBe(1)
    expect(state.drawables).toBeNull()
    expect(state.wipe).toBeNull()
    expect(state.scribble).toBeNull()
    expect(state.drag?.from).toBe(3)
    expect(state.drag?.progress).toBeCloseTo(0.5 / 0.72)
    // Halfway in, the element still sits to the right of its final frame.
    expect(state.translate.x).toBeGreaterThan(0)
  })

  it('releases the element early and withdraws the hand instead of popping it', () => {
    // 0.9s of 1.2s is past the 72% carry point, so the element has landed…
    const landing = evaluateElement(dragElement(3), timing, 0.9, [], CAMERA)
    expect(landing.translate).toEqual({ x: 0, y: 0 })
    expect(landing.drag?.release).toBeGreaterThan(0)
    expect(landing.drag?.travel).toBeGreaterThan(0)
    expect(landing.handStyle).toBe('handDraw')

    const later = evaluateElement(dragElement(3), timing, 1.1, [], CAMERA)
    expect(later.drag!.release).toBeGreaterThan(landing.drag!.release)
    expect(later.handStyle).toBe('handDraw')
  })

  it('uses the open hand by default and drops it once the element lands', () => {
    const mid = evaluateElement(dragElement(9), timing, 0.4, [], CAMERA)
    expect(mid.handStyle).toBe('handDraw')
    expect(mid.instrumentId).toBe(DEFAULT_DRAG_INSTRUMENT_ID)

    const done = evaluateElement(dragElement(9), timing, 1.21, [], CAMERA)
    expect(done.drag).toBeNull()
    expect(done.handStyle).toBeNull()
    expect(done.translate).toEqual({ x: 0, y: 0 })
  })

  it('mirrors the hand for entries from the left side', () => {
    const left = evaluateElement(dragElement(9), timing, 0.4, [], CAMERA)
    const right = evaluateElement(dragElement(3), timing, 0.4, [], CAMERA)
    const top = evaluateElement(dragElement(12), timing, 0.4, [], CAMERA)
    expect(left.handedness).toBe('left')
    expect(right.handedness).toBe('right')
    expect(top.handedness).toBe('right')
  })

  it('offers three entry angles per side', () => {
    const sides = { top: [11, 12, 1], right: [2, 3, 4], bottom: [5, 6, 7], left: [8, 9, 10] }
    for (const [side, hours] of Object.entries(sides)) {
      for (const hour of hours) {
        const vector = dragVector(hour)
        if (side === 'top') expect(vector.y).toBeLessThan(0)
        if (side === 'bottom') expect(vector.y).toBeGreaterThan(0)
        if (side === 'right') expect(vector.x).toBeGreaterThan(0)
        if (side === 'left') expect(vector.x).toBeLessThan(0)
      }
    }
    expect(dragVector(12)).toEqual({ x: 0, y: -1 })
    expect(dragVector(6).y).toBeCloseTo(1)
  })

  it('offers only open gesture hands, never pen or pencil grips', () => {
    expect(DRAG_INSTRUMENTS.length).toBeGreaterThan(1)
    expect(DRAG_INSTRUMENTS[0]!.id).toBe(DEFAULT_DRAG_INSTRUMENT_ID)
    expect(DRAG_INSTRUMENTS.every((instrument) => instrument.kind === 'hand')).toBe(true)
    expect(DRAG_INSTRUMENTS.some(isEraserInstrument)).toBe(false)
    expect(DRAG_INSTRUMENTS.every((instrument) => isGestureHandName(instrument.name))).toBe(true)
    expect(
      DRAG_INSTRUMENTS.some((instrument) =>
        /\b(pencil|marker|biro|ballpoint|crayon|eraser|pen)\b/i.test(instrument.name)
      )
    ).toBe(false)
    // Every carrying hand knows where the palm is, so it can hold the artwork.
    expect(DRAG_INSTRUMENTS.every((instrument) => instrument.grip)).toBe(true)
  })
})
