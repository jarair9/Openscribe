import { describe, expect, it } from 'vitest'
import { createTextElement } from '../../../src/core/schema/factories'
import { textRevealRects, textWriteCursor } from '../../../src/renderer/src/components/canvas/textMetrics'
import { handPositionForTip, handScaleForStage } from '../../../src/core/instruments'

describe('font based text writing', () => {
  it('creates text with the default handwriting stroke font', () => {
    const element = createTextElement('A B', {
      frame: { x: 100, y: 80, width: 600, height: 160 }
    })

    expect(element.writingMode).toBe('strokeScript')
    expect(element.strokeFontId).toBe('polan-stronk')
    expect(element.fontFamily).toBe('Polan Stronk')
    expect(element.writeBackwards).toBe(false)
  })

  it('moves the cursor and reveals ink right-to-left when requested', () => {
    const element = createTextElement('AB', {
      frame: { x: 100, y: 80, width: 400, height: 160 }
    })
    element.fontSize = 100
    element.writeBackwards = true

    const first = textWriteCursor(element, 0.15)
    const later = textWriteCursor(element, 0.35)
    const rect = textRevealRects(element, 0.15)[0]!

    expect(first.x).toBeGreaterThan(later.x)
    expect(rect.x + rect.width).toBeCloseTo(100 + 2 * 56)
  })

  it('returns identical cursor coordinates when the same time is evaluated twice', () => {
    const element = createTextElement('I am student start', {
      frame: { x: 80, y: 40, width: 1200, height: 180 }
    })
    const first = textWriteCursor(element, 0.42)
    const again = textWriteCursor(element, 0.42)
    expect(again).toEqual(first)
  })

  it('keeps left-to-right x monotonic and y movement smooth at 30 fps', () => {
    const element = createTextElement('I am student start\nsecond line', {
      frame: { x: 80, y: 40, width: 1200, height: 300 }
    })
    element.fontSize = 100
    const samples = Array.from({ length: 61 }, (_, frame) => textWriteCursor(element, frame / 60))

    const firstLine = samples.slice(0, 20)
    for (let index = 1; index < firstLine.length; index += 1) {
      expect(firstLine[index]!.x + 0.001).toBeGreaterThanOrEqual(firstLine[index - 1]!.x)
    }
    for (let index = 1; index < samples.length; index += 1) {
      expect(Math.abs(samples[index]!.y - samples[index - 1]!.y)).toBeLessThan(60)
    }
  })

  it('extends the default hand past the stage on the 5x5 tip grid at three output sizes', () => {
    for (const [width, height] of [[778, 567], [1233, 676], [1920, 1080]]) {
      const aspect = 829 / 1200
      const spriteWidth = aspect * 100
      const anchorY = 0.142 * 100
      const scale = handScaleForStage(width, height, spriteWidth, anchorY, 0.4, 81)
      for (let row = 0; row < 5; row += 1) {
        for (let column = 0; column < 5; column += 1) {
          const tipY = (height * row) / 4
          const tipX = (width * column) / 4
          const cuffEdgeY = tipY + (81 - anchorY) * scale
          expect(cuffEdgeY).toBeGreaterThan(height)
          expect(tipX).toBeGreaterThanOrEqual(0)
          expect(tipX).toBeLessThanOrEqual(width)
        }
      }
    }
  })

  it('keeps the pen-tip anchor fixed for both left- and right-handed art', () => {
    const tip = { x: 317, y: 209 }
    const anchor = { x: 12.24, y: 0.42 }
    for (const handedness of ['right', 'left'] as const) {
      const placed = handPositionForTip(tip, anchor, 1.7, handedness)
      expect(placed.x + anchor.x * placed.scaleX).toBeCloseTo(tip.x)
      expect(placed.y + anchor.y * 1.7).toBeCloseTo(tip.y)
    }
  })
})
