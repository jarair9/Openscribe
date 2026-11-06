import { describe, expect, it } from 'vitest'
import { createTextElement } from '../../src/core/schema/factories'
import { eraseEdgePoint, eraseEdgeX, erasePolygon } from '../../src/renderer/src/components/canvas/renderUtils'
import { textEraseRects } from '../../src/renderer/src/components/canvas/textMetrics'

const block = { x: 100, y: 50, width: 400, height: 300 }

function points(value: string): Array<[number, number]> {
  return value.split(' ').map((point) => point.split(',').map(Number) as [number, number])
}

/** Where the front cuts a row of the clip polygon: its leftmost surviving x. */
function frontX(value: string, y: number): number {
  return Math.min(...points(value).filter(([, rowY]) => rowY === y).map(([x]) => x))
}

describe('diagonal erase front', () => {
  it('puts the top of a block ahead of its bottom', () => {
    expect(eraseEdgeX(block, 0.5, 0)).toBeGreaterThan(eraseEdgeX(block, 0.5, 1))
    const mid = erasePolygon(block, 0.5)
    expect(frontX(mid, block.y)).toBeGreaterThan(frontX(mid, block.y + block.height))
  })

  it('takes nothing before the eraser arrives and everything after it passes', () => {
    expect(eraseEdgeX(block, 1, 0)).toBeCloseTo(block.x)
    expect(eraseEdgeX(block, 1, 1)).toBeLessThan(block.x)
    expect(eraseEdgeX(block, 0, 1)).toBeCloseTo(block.x + block.width)
    expect(eraseEdgeX(block, 0, 0)).toBeGreaterThan(block.x + block.width)
  })

  it('travels left to right as the erase advances', () => {
    expect(eraseEdgeX(block, 0.75, 0.5)).toBeLessThan(eraseEdgeX(block, 0.25, 0.5))
    expect(eraseEdgePoint(block, 0.75).x).toBeLessThan(eraseEdgePoint(block, 0.25).x)
  })

  it('stays inside the frame at both ends of the sweep', () => {
    const intact = points(erasePolygon(block, 1))
    expect(intact).toHaveLength(4)
    expect(Math.min(...intact.map(([x]) => x))).toBeCloseTo(block.x)
    expect(Math.max(...intact.map(([x]) => x))).toBeCloseTo(block.x + block.width)
    expect(Math.max(...points(erasePolygon(block, 0)).map(([x]) => x))).toBeCloseTo(block.x + block.width)
  })
})

describe('diagonal erase of text', () => {
  function paragraph() {
    const element = createTextElement('aaa bbb\nccc ddd\neee fff', {
      name: 'Erase test',
      frame: { x: 10, y: 20, width: 520, height: 240 }
    })
    element.fontSize = 60
    return element
  }

  it('leaves every line intact before the eraser arrives', () => {
    const rects = textEraseRects(paragraph(), 1)
    expect(rects).toHaveLength(3)
    expect(rects.every((rect) => rect.width > 0)).toBe(true)
  })

  it('clears the whole block once the eraser has crossed it', () => {
    expect(textEraseRects(paragraph(), 0)).toHaveLength(0)
  })

  it('cuts the first line further along than the last', () => {
    const rects = textEraseRects(paragraph(), 0.5)
    expect(rects).toHaveLength(3)
    const [first, , last] = rects
    expect(first!.x).toBeGreaterThan(last!.x)
    // Each line is cut by the same front, so what survives still ends together.
    expect(first!.x + first!.width).toBeCloseTo(last!.x + last!.width, 6)
  })

  it('walks rightwards across the lines', () => {
    const element = paragraph()
    expect(textEraseRects(element, 0.75)[0]!.x).toBeLessThan(textEraseRects(element, 0.25)[0]!.x)
  })
})
