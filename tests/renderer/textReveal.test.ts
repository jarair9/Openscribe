import { describe, expect, it } from 'vitest'
import { createTextElement } from '../../src/core/schema/factories'
import { textRevealRects, textWriteCursor } from '../../src/renderer/src/components/canvas/textMetrics'

describe('text write reveal', () => {
  it('reveals part of the current glyph in sync with the writing cursor', () => {
    const element = createTextElement('AB', {
      name: 'Writing test',
      frame: { x: 10, y: 20, width: 400, height: 140 },
      animation: {
        entrance: { type: 'handDraw', duration: 2, easing: 'linear', direction: 'right', instrumentId: null, handedness: 'right' },
        emphasis: { type: 'none', duration: 0.8, loops: 1, intensity: 0, delay: 0 },
        exit: { type: 'none', duration: 0, easing: 'linear', direction: 'right', delay: 0, instrumentId: null },
        pauseAfter: 0
      }
    })
    element.fontSize = 100

    const rects = textRevealRects(element, 0.25)
    const cursor = textWriteCursor(element, 0.25)

    expect(rects).toHaveLength(1)
    expect(rects[0]!.width).toBeGreaterThan(0)
    expect(rects[0]!.width).toBeLessThan(56)
    expect(cursor.x).toBeCloseTo(element.frame.x + rects[0]!.width)
  })

  it('leaves the tail of the word visible when a left hand erases from the start', () => {
    const element = createTextElement('AB', {
      name: 'Erase test',
      frame: { x: 10, y: 20, width: 400, height: 140 },
      animation: {
        entrance: { type: 'handDraw', duration: 2, easing: 'linear', direction: 'right', instrumentId: null, handedness: 'right' },
        emphasis: { type: 'none', duration: 0.8, loops: 1, intensity: 0, delay: 0 },
        exit: { type: 'erase', duration: 1, easing: 'linear', direction: 'down', delay: 0, instrumentId: null },
        pauseAfter: 0
      }
    })
    element.fontSize = 100

    // Three quarters of the ink already gone, with the eraser entering from the left.
    const rects = textRevealRects(element, 0.25, 'left')
    const cursor = textWriteCursor(element, 0.25, 'left')

    expect(rects).toHaveLength(1)
    expect(rects[0]!.x).toBeGreaterThan(element.frame.x)
    expect(cursor.x).toBeCloseTo(rects[0]!.x)
  })
})
