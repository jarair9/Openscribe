import { describe, expect, it } from 'vitest'
import { evaluateElement } from '../../../src/core/animation/evaluate'
import { createTextElement } from '../../../src/core/schema/factories'
import { sceneElementTiming } from '../../../src/core/timeline/schedule'
import {
  STROKE_FONTS,
  strokeFontForElement,
  uncoveredCharacters
} from '../../../src/core/text/strokeFont'
import {
  evaluateStrokeWriting,
  strokeDrawProgress,
  strokeWritingPlan,
  type PlannedStroke
} from '../../../src/core/text/strokeWriting'

function strokeElement(text: string) {
  const element = createTextElement(text, {
    name: 'Handwriting',
    frame: { x: 100, y: 80, width: 900, height: 220 }
  })
  element.writingMode = 'strokeScript'
  element.strokeFontId = 'polan-stronk'
  element.fontFamily = 'Polan Stronk'
  element.fontSize = 100
  element.letterSpacing = 0
  return element
}

function distanceToPolyline(stroke: PlannedStroke, point: { x: number; y: number }): number {
  let best = Infinity
  for (let index = 1; index < stroke.points.length; index += 1) {
    const a = stroke.points[index - 1]!
    const b = stroke.points[index]!
    const dx = b.x - a.x
    const dy = b.y - a.y
    const lengthSquared = dx * dx + dy * dy
    const t = lengthSquared > 0
      ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared))
      : 0
    best = Math.min(best, Math.hypot(point.x - (a.x + dx * t), point.y - (a.y + dy * t)))
  }
  return best
}

describe('stroke font handwriting', () => {
  it('keeps the chosen face and borrows only the glyphs it cannot draw', () => {
    const supported = strokeElement('Hello, world!')
    expect(strokeFontForElement(supported)?.id).toBe('polan-stronk')

    // A character outside the chosen face must not swap the whole font — that
    // swap is what made "the font I picked is not applying" happen.
    const partial = strokeElement('Café')
    expect(strokeFontForElement(partial)?.id).toBe('polan-stronk')

    // Nothing in the bundle draws an emoji, so it is reported as uncovered.
    const missing = strokeElement('Sold out 🐧')
    expect(strokeFontForElement(missing)?.id).toBe('polan-stronk')
    expect(uncoveredCharacters(missing)).toEqual(['🐧'])

    const legacyReveal = strokeElement('Hello')
    legacyReveal.writingMode = 'fontReveal'
    expect(strokeFontForElement(legacyReveal)?.id).toBe('polan-stronk')
  })

  it('writes ordinary text with every bundled font', () => {
    const sample = 'Handwritten text 123, yes?'
    for (const font of STROKE_FONTS) {
      const element = strokeElement(sample)
      element.strokeFontId = font.id

      expect(uncoveredCharacters(element), font.id).toEqual([])
      const resolved = strokeFontForElement(element)
      expect(resolved?.id, font.id).toBe(font.id)

      const plan = strokeWritingPlan(element, resolved!)
      const inked = Array.from(sample).filter((character) => /[A-Za-z0-9]/.test(character))
      expect(plan.strokes.length, font.id).toBeGreaterThanOrEqual(inked.length)
      expect(plan.naturalDuration, font.id).toBeGreaterThan(0)
      for (const stroke of plan.strokes) {
        for (const point of stroke.points) {
          expect(Number.isFinite(point.x) && Number.isFinite(point.y), `${font.id} ${stroke.glyphChar}`)
            .toBe(true)
        }
      }
    }
  })

  it('lays out real glyph strokes in order with pen-up travel between them', () => {
    const element = strokeElement('Hi there')
    const font = strokeFontForElement(element)!
    const plan = strokeWritingPlan(element, font)

    expect(plan.strokes.length).toBeGreaterThan(8)
    expect(plan.travels).toHaveLength(plan.strokes.length - 1)
    expect(plan.strokes[0]!.start).toBe(0)
    expect(plan.strokes.at(-1)!.end).toBeCloseTo(1, 6)
    for (let index = 1; index < plan.strokes.length; index += 1) {
      expect(plan.strokes[index]!.start).toBeGreaterThanOrEqual(plan.strokes[index - 1]!.end - 1e-9)
    }
    for (let index = 0; index < plan.travels.length; index += 1) {
      const travel = plan.travels[index]!
      expect(travel.end).toBeGreaterThanOrEqual(travel.start - 1e-9)
      expect(travel.end).toBeCloseTo(plan.strokes[index + 1]!.start, 9)
    }
    for (const stroke of plan.strokes) {
      if (stroke.dot) expect(stroke.length).toBeLessThanOrEqual(0.75)
      else expect(stroke.length).toBeGreaterThan(0)
      expect(stroke.width).toBeGreaterThan(0.3)
      expect(stroke.start).toBeGreaterThanOrEqual(0)
      expect(stroke.end).toBeLessThanOrEqual(1)
    }
    expect(evaluateStrokeWriting(plan, 0)!.point).toEqual(plan.strokes[0]!.points[0])
    expect(evaluateStrokeWriting(plan, 1)!.point).toEqual(plan.strokes.at(-1)!.points.at(-1))
  })

  it('keeps the pen on the ink for the whole stroke', () => {
    const element = strokeElement('abc')
    const font = strokeFontForElement(element)!
    const plan = strokeWritingPlan(element, font)

    for (const stroke of plan.strokes) {
      const progress = (stroke.start + stroke.end) / 2
      const cursor = evaluateStrokeWriting(plan, progress)!
      expect(cursor.penDown).toBe(true)
      expect(distanceToPolyline(stroke, cursor.point)).toBeLessThan(0.02)
      expect(cursor.traveled).toBeGreaterThanOrEqual(stroke.traveledStart - 1e-6)
    }
  })

  it('moves between strokes with the pen lifted', () => {
    const element = strokeElement('ab')
    const font = strokeFontForElement(element)!
    const plan = strokeWritingPlan(element, font)
    const travel = plan.travels.find((candidate) => candidate.distance > 4)
    expect(travel).toBeDefined()

    const progress = (travel!.start + travel!.end) / 2
    const cursor = evaluateStrokeWriting(plan, progress)!
    expect(cursor.penDown).toBe(false)
    expect(cursor.moving).toBe(true)
    expect(cursor.point.x).toBeGreaterThanOrEqual(Math.min(travel!.from.x, travel!.to.x) - 1e-6)
    expect(cursor.point.x).toBeLessThanOrEqual(Math.max(travel!.from.x, travel!.to.x) + 1e-6)
  })

  it('is deterministic and freezes in place on a dot tap', () => {
    const element = strokeElement('.')
    const font = strokeFontForElement(element)!
    const plan = strokeWritingPlan(element, font)

    expect(plan.strokes).toHaveLength(1)
    expect(plan.strokes[0]!.dot).toBe(true)
    const first = evaluateStrokeWriting(plan, 0.4)!
    const again = evaluateStrokeWriting(plan, 0.4)!
    expect(again).toEqual(first)
    expect(first.moving).toBe(false)
    expect(first.penDown).toBe(true)
    expect(first.point).toEqual(plan.strokes[0]!.points[0])
  })

  it('evaluates stroke text linearly and reports the active drawing phase', () => {
    const element = strokeElement('Write')
    const timing = sceneElementTiming(element, 0)
    const camera = { x: 0, y: 0, width: 1920, height: 1080 }

    const half = evaluateElement(element, timing, timing.entranceEnd / 2, [], camera)
    expect(half.strokeDraw).toBeCloseTo(0.5, 6)
    expect(half.wipe).toBeNull()
    expect(half.handStyle).toBe('handDraw')

    const done = evaluateElement(element, timing, timing.entranceEnd + 0.01, [], camera)
    expect(done.strokeDraw).toBeNull()
    expect(done.handStyle).toBeNull()
  })

  it('uses the same per-stroke easing for ink and hand', () => {
    const element = strokeElement('m')
    const font = strokeFontForElement(element)!
    const plan = strokeWritingPlan(element, font)
    const stroke = plan.strokes[0]!

    for (const fraction of [0.15, 0.5, 0.85]) {
      const progress = stroke.start + (stroke.end - stroke.start) * fraction
      const draw = strokeDrawProgress(stroke, progress)
      const cursor = evaluateStrokeWriting(plan, progress)!
      expect(cursor.traveled - stroke.traveledStart).toBeCloseTo(stroke.length * draw, 5)
    }
  })
})
