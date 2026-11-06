import { describe, expect, it } from 'vitest'
import { evaluateElement } from '../../../src/core/animation/evaluate'
import {
  DEFAULT_ERASER_INSTRUMENT_ID,
  ERASER_INSTRUMENTS,
  INSTRUMENTS,
  getEraserInstrument,
  instrumentHandedness,
  isEraserInstrument
} from '../../../src/core/instruments'
import type { Element } from '../../../src/core/schema/project'

function eraseElement(instrumentId: string | null): Element {
  return {
    id: 'txt-test',
    kind: 'text',
    visible: true,
    opacity: 1,
    frame: { x: 0, y: 0, width: 300, height: 100 },
    animation: {
      entrance: {
        type: 'fadeIn',
        duration: 1,
        easing: 'linear',
        direction: 'right',
        instrumentId: null,
        handedness: 'right'
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
  } as unknown as Element
}

const timing = {
  elementId: 'txt-test',
  start: 0,
  entranceEnd: 1,
  emphasisStart: 1,
  emphasisEnd: 1,
  exitStart: 2,
  exitEnd: 3,
  end: 3
}

describe('directional erase exit', () => {
  it('keeps full opacity and reduces the visible wipe area over exit time', () => {
    const element = eraseElement(null)

    const first = evaluateElement(element, timing, 2.25)
    const later = evaluateElement(element, timing, 2.75)

    expect(first.opacity).toBe(1)
    expect(first.wipe?.progress).toBeCloseTo(0.75)
    expect(later.wipe?.progress).toBeCloseTo(0.25)
  })

  it('falls back to the supplied eraser hand and shows it on the wipe edge', () => {
    const state = evaluateElement(eraseElement(null), timing, 2.25)

    expect(state.instrumentId).toBe(DEFAULT_ERASER_INSTRUMENT_ID)
    expect(state.handStyle).toBe('handDraw')
    expect(state.erasing).toBe(true)
  })

  it('sweeps left to right whatever hand holds the eraser', () => {
    // The fixture asks for 'down'; an eraser has one correct direction.
    expect(evaluateElement(eraseElement(null), timing, 2.25).wipe?.direction).toBe('left')

    const leftHanded = INSTRUMENTS.find((instrument) => instrumentHandedness(instrument) === 'left')
    expect(leftHanded).toBeDefined()

    const state = evaluateElement(eraseElement(leftHanded!.id), timing, 2.25)
    expect(state.wipe?.direction).toBe('left')
    // The photographed hand still decides which way the artwork faces.
    expect(state.handedness).toBe('left')
  })
})

describe('eraser picker set', () => {
  it('offers only the hands that clean the board', () => {
    expect(ERASER_INSTRUMENTS.length).toBeGreaterThan(0)
    expect(ERASER_INSTRUMENTS.length).toBeLessThan(INSTRUMENTS.length)
    expect(ERASER_INSTRUMENTS.every(isEraserInstrument)).toBe(true)
  })

  it('contains the eraser it falls back to', () => {
    expect(ERASER_INSTRUMENTS.map((instrument) => instrument.id)).toContain(
      DEFAULT_ERASER_INSTRUMENT_ID
    )
    expect(getEraserInstrument(null).id).toBe(DEFAULT_ERASER_INSTRUMENT_ID)
  })
})
