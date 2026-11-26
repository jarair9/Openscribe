import { describe, expect, it } from 'vitest'
import {
  SCRUB_PASS_HEIGHT,
  scrubCoveredPolygons,
  scrubPassCount,
  scrubPasses,
  scrubRemainingPolygons,
  scrubRemainingRects,
  scrubTip
} from '../../../src/core/animation/scrub'
import type { Rect } from '../../../src/core/schema/primitives'

const box: Rect = { x: 0, y: 0, width: 200, height: 90 }

function area(points: Array<{ x: number; y: number }>): number {
  let sum = 0
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index]!
    const b = points[(index + 1) % points.length]!
    sum += a.x * b.y - b.x * a.y
  }
  return Math.abs(sum) / 2
}

function totalArea(polygons: Array<Array<{ x: number; y: number }>>): number {
  return polygons.reduce((sum, points) => sum + area(points), 0)
}

function bounds(polygons: Array<Array<{ x: number; y: number }>>) {
  const all = polygons.flat()
  return {
    minX: Math.min(...all.map((point) => point.x)),
    maxX: Math.max(...all.map((point) => point.x)),
    minY: Math.min(...all.map((point) => point.y)),
    maxY: Math.max(...all.map((point) => point.y))
  }
}

describe('scrub passes', () => {
  it('alternates direction, which is what makes the zig-zag', () => {
    const passes = scrubPasses(box)
    expect(passes[0]!.leftToRight).toBe(true)
    expect(passes[1]!.leftToRight).toBe(false)
    expect(passes[2]!.leftToRight).toBe(true)
  })

  it('scales the pass count with the block and keeps it bounded', () => {
    expect(scrubPassCount(SCRUB_PASS_HEIGHT * 4)).toBe(4)
    expect(scrubPassCount(1)).toBe(3)
    expect(scrubPassCount(100_000)).toBe(32)
  })

  it('tiles the block exactly so an erased band never comes back', () => {
    const passes = scrubPasses(box)
    expect(passes[0]!.top).toBe(box.y)
    for (let index = 0; index < passes.length - 1; index += 1) {
      expect(passes[index]!.bottom).toBe(passes[index + 1]!.top)
    }
    expect(passes.at(-1)!.bottom).toBe(box.y + box.height)
  })

  it('bleeds a reveal slightly past each pass so no hairline is left', () => {
    const passes = scrubPasses(box)
    const covered = scrubCoveredPolygons(box, 0.5)
    const active = passes[Math.floor(passes.length / 2)]!
    expect(Math.max(...covered.flat().map((point) => point.y))).toBeGreaterThan(active.bottom)
  })
})

describe('scrub coverage', () => {
  it('reveals nothing before it starts and the whole block when it finishes', () => {
    expect(scrubCoveredPolygons(box, 0)).toHaveLength(0)
    const full = bounds(scrubCoveredPolygons(box, 1))
    expect(full.minX).toBeCloseTo(box.x, 6)
    expect(full.maxX).toBeCloseTo(box.x + box.width, 6)
    expect(full.minY).toBeCloseTo(box.y, 6)
    expect(full.maxY).toBeCloseTo(box.y + box.height, 6)
  })

  it('never uncovers ground it has already covered', () => {
    let previous = 0
    for (let step = 0; step <= 20; step += 1) {
      const covered = totalArea(scrubCoveredPolygons(box, step / 20))
      expect(covered).toBeGreaterThanOrEqual(previous - 1e-6)
      previous = covered
    }
  })

  it('works top down, leaving the bottom of the block for last', () => {
    const half = bounds(scrubCoveredPolygons(box, 0.5))
    expect(half.minY).toBeCloseTo(box.y, 6)
    expect(half.maxY).toBeLessThan(box.y + box.height)
  })

  it('erases the complement of what it has revealed', () => {
    expect(scrubRemainingPolygons(box, 0)).toHaveLength(scrubPasses(box).length)
    expect(bounds(scrubRemainingPolygons(box, 0)).maxY).toBeCloseTo(box.y + box.height, 6)
    expect(scrubRemainingPolygons(box, 1)).toHaveLength(0)
  })

  it('returns nothing for a block with no area', () => {
    const empty = { x: 0, y: 0, width: 0, height: 0 }
    expect(scrubCoveredPolygons(empty, 0.5)).toHaveLength(0)
    expect(scrubRemainingPolygons(empty, 0.5)).toHaveLength(0)
  })
})

describe('scrub tip', () => {
  it('stays inside the block and only ever moves on to later passes', () => {
    let previousPass = -1
    for (let step = 0; step <= 200; step += 1) {
      const tip = scrubTip(box, step / 200)
      expect(tip.x).toBeGreaterThanOrEqual(box.x - 1e-6)
      expect(tip.x).toBeLessThanOrEqual(box.x + box.width + 1e-6)
      expect(tip.pass).toBeGreaterThanOrEqual(previousPass)
      previousPass = tip.pass
    }
  })

  it('turns around at the end of each pass', () => {
    const angles = new Set<number>()
    for (let step = 0; step <= 100; step += 1) angles.add(scrubTip(box, step / 100).angle)
    expect([...angles].sort()).toEqual([0, 180])
  })
})

describe('scrub over loose rects', () => {
  it('keeps a full-width strip while the eraser is still above it', () => {
    const strips = scrubRemainingRects(box, 0, [box])
    expect(strips).toHaveLength(scrubPasses(box).length)
    expect(strips.every((strip) => strip.width === box.width)).toBe(true)
  })

  it('drops the strips the eraser has passed', () => {
    expect(scrubRemainingRects(box, 1, [box])).toHaveLength(0)
  })

  it('only reports strips that survive part-way through', () => {
    const strips = scrubRemainingRects(box, 0.5, [box])
    expect(strips.length).toBeGreaterThan(0)
    expect(strips.length).toBeLessThan(scrubPasses(box).length)
  })
})
