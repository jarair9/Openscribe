import { describe, expect, it } from 'vitest'
import { scrubPasses } from '../../src/core/animation/scrub'
import { createTextElement } from '../../src/core/schema/factories'
import { eraseEdgePoint, erasePolygons } from '../../src/renderer/src/components/canvas/renderUtils'
import { textEraseRects } from '../../src/renderer/src/components/canvas/textMetrics'

const block = { x: 100, y: 50, width: 400, height: 300 }

function points(value: string): Array<[number, number]> {
  return value.split(' ').map((point) => point.split(',').map(Number) as [number, number])
}

function bounds(values: string[]): { minX: number; maxX: number; minY: number; maxY: number } {
  const all = values.flatMap(points)
  return {
    minX: Math.min(...all.map(([x]) => x)),
    maxX: Math.max(...all.map(([x]) => x)),
    minY: Math.min(...all.map(([, y]) => y)),
    maxY: Math.max(...all.map(([, y]) => y))
  }
}

function area(rects: Array<{ width: number; height: number }>): number {
  return rects.reduce((sum, rect) => sum + rect.width * rect.height, 0)
}

describe('eraser scrub', () => {
  it('leaves the whole block standing before the eraser arrives', () => {
    const box = bounds(erasePolygons(block, 1))
    expect(box.minX).toBeCloseTo(block.x, 6)
    expect(box.maxX).toBeCloseTo(block.x + block.width, 6)
    expect(box.minY).toBeCloseTo(block.y, 6)
    expect(box.maxY).toBeCloseTo(block.y + block.height, 6)
  })

  it('leaves nothing once the block is clean', () => {
    expect(erasePolygons(block, 0)).toHaveLength(0)
  })

  it('clears from the top of the block downwards', () => {
    const polygons = erasePolygons(block, 0.5)
    expect(polygons.length).toBeGreaterThan(0)
    expect(bounds(polygons).minY).toBeGreaterThan(block.y + block.height / 3)
  })

  it('scrubs back and forth instead of sweeping one way', () => {
    // Coverage 0.25 lands on a rightward pass, 0.35 on the leftward one after it.
    expect(eraseEdgePoint(block, 0.75).angle).toBe(0)
    expect(eraseEdgePoint(block, 0.65).angle).toBe(180)
  })

  it('walks down the block as the erase advances', () => {
    // `visible` runs the other way: the block is intact at 1 and clean at 0.
    const early = eraseEdgePoint(block, 0.95)
    const late = eraseEdgePoint(block, 0.05)
    expect(early.y).toBeLessThan(late.y)
    expect(late.pass).toBeGreaterThan(early.pass)
  })

  it('keeps the hand inside the block throughout', () => {
    for (let step = 0; step <= 100; step += 1) {
      const point = eraseEdgePoint(block, 1 - step / 100)
      expect(point.x).toBeGreaterThanOrEqual(block.x - 1e-6)
      expect(point.x).toBeLessThanOrEqual(block.x + block.width + 1e-6)
      expect(point.y).toBeGreaterThanOrEqual(block.y - 1e-6)
      expect(point.y).toBeLessThanOrEqual(block.y + block.height + 1e-6)
    }
  })

  it('tiles its passes so an erased band never shows through again', () => {
    const passes = scrubPasses(block)
    for (let index = 0; index < passes.length - 1; index += 1) {
      expect(passes[index]!.bottom).toBe(passes[index + 1]!.top)
    }
  })
})

describe('eraser scrub over text', () => {
  function paragraph() {
    const element = createTextElement('aaa bbb\nccc ddd\neee fff', {
      name: 'Erase test',
      frame: { x: 10, y: 20, width: 520, height: 240 }
    })
    element.fontSize = 60
    return element
  }

  it('leaves every line intact before the eraser arrives', () => {
    expect(area(textEraseRects(paragraph(), 1))).toBeGreaterThan(0)
  })

  it('clears the whole block once the eraser has crossed it', () => {
    expect(textEraseRects(paragraph(), 0)).toHaveLength(0)
  })

  it('leaves the lines below the eraser standing while it works', () => {
    const element = paragraph()
    const full = area(textEraseRects(element, 1))
    const half = area(textEraseRects(element, 0.5))
    expect(half).toBeGreaterThan(0)
    expect(half).toBeLessThan(full)
  })
})
