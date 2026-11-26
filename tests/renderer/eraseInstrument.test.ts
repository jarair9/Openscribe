import { describe, expect, it } from 'vitest'
import { evaluateElement } from '../../src/core/animation/evaluate'
import { DEFAULT_ERASER_INSTRUMENT_ID, INSTRUMENTS, instrumentHandedness } from '../../src/core/instruments'
import { createTextElement } from '../../src/core/schema/factories'
import type { SceneVisual } from '../../src/core/animation/scene'
import type { Scene } from '../../src/core/schema/project'
import { findActiveInstrument } from '../../src/renderer/src/components/canvas/instrumentState'

const timing = {
  elementId: 'erase-me',
  start: 0,
  entranceEnd: 1,
  emphasisStart: 1,
  emphasisEnd: 1,
  exitStart: 2,
  exitEnd: 3,
  end: 3
}

function instrumented(localTime: number, instrumentId: string | null) {
  const element = createTextElement('Wipe me away', {
    name: 'Eraser test',
    frame: { x: 40, y: 60, width: 420, height: 120 },
    animation: {
      entrance: {
        type: 'handDraw',
        duration: 1,
        easing: 'linear',
        direction: 'right',
        instrumentId: null,
        handedness: 'right',
        dragFrom: 9
      },
      emphasis: { type: 'none', duration: 0, loops: 1, intensity: 0, delay: 0 },
      exit: {
        type: 'erase',
        duration: 1,
        easing: 'linear',
        direction: 'down',
        delay: 0,
        instrumentId
      },
      pauseAfter: 0
    }
  })
  element.id = 'erase-me'
  element.fontSize = 80
  const state = evaluateElement(element, timing, localTime)
  const scene = { id: 's1', elements: [element] } as unknown as Scene
  const visual = { elements: { [element.id]: state } } as unknown as SceneVisual
  return { element, state, instrument: findActiveInstrument(scene, visual, { [element.id]: timing }) }
}

describe('eraser instrument during the exit', () => {
  it('rests once the board is clean', () => {
    const { instrument } = instrumented(1.5, DEFAULT_ERASER_INSTRUMENT_ID)
    expect(instrument).toBeNull()
  })

  it('shows the supplied eraser hand while the board is being cleared', () => {
    const { state, instrument } = instrumented(2.4, DEFAULT_ERASER_INSTRUMENT_ID)
    expect(state.erasing).toBe(true)
    expect(instrument).not.toBeNull()
    expect(instrument!.instrumentId).toBe(DEFAULT_ERASER_INSTRUMENT_ID)
    expect(instrument!.style).toBe('handDraw')
    expect(instrument!.wipeCursor).toBeTruthy()
    // Scrubbing pose: the eraser alternates frames instead of gliding.
    expect(instrument!.pose).toBeTypeOf('number')
  })

  it('walks down the block as the erase advances', () => {
    const early = instrumented(2.25, DEFAULT_ERASER_INSTRUMENT_ID).instrument!
    const late = instrumented(2.75, DEFAULT_ERASER_INSTRUMENT_ID).instrument!
    expect(early.wipeCursor!.y).toBeLessThan(late.wipeCursor!.y)
  })

  it('scrubs back and forth rather than sweeping one way', () => {
    // The block is scrubbed in several passes, so the heading has to flip as
    // the eraser works its way down rather than staying one way throughout.
    const angles = new Set<number>()
    for (let step = 1; step < 10; step += 1) {
      const at = 2 + step / 10
      const instrument = instrumented(at, DEFAULT_ERASER_INSTRUMENT_ID).instrument
      expect(instrument).not.toBeNull()
      angles.add(instrument!.wipeCursor!.angle)
    }
    expect([...angles].sort((a, b) => a - b)).toEqual([0, 180])
  })

  it('keeps the same hand for a scrubbing pass either way', () => {
    const early = instrumented(2.25, DEFAULT_ERASER_INSTRUMENT_ID).instrument!
    const late = instrumented(2.75, DEFAULT_ERASER_INSTRUMENT_ID).instrument!
    expect(early.handedness).toBe(late.handedness)
    expect(early.instrumentId).toBe(late.instrumentId)
  })

  it('rides the same path for a left-handed eraser', () => {
    const leftHanded = INSTRUMENTS.find((item) => instrumentHandedness(item) === 'left')!
    const early = instrumented(2.25, leftHanded.id).instrument!
    const late = instrumented(2.75, leftHanded.id).instrument!
    expect(early.handedness).toBe('left')
    expect(early.wipeCursor!.y).toBeLessThan(late.wipeCursor!.y)
  })
})
