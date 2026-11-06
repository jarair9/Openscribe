import { clamp01, lerp } from '../math'
import { boundsOfPoints } from '../geometry'
import type { Rect, Vec2 } from '../schema/primitives'
import type { TextElement } from '../schema/project'
import { glyphAdvance, strokeFontForElement, type StrokeFontBundle } from './strokeFont'

export interface StrokeWritingPoint {
  x: number
  y: number
}

export interface PlannedStroke {
  id: string
  glyphIndex: number
  glyphChar: string
  /** World-space polyline samples. */
  points: StrokeWritingPoint[]
  cumulative: number[]
  length: number
  /** Median pen width in world units. */
  width: number
  dot: boolean
  /** SVG path data for the centerline. */
  d: string
  /** Normalized drawing window (0..1 of the entrance). */
  start: number
  end: number
  /** Cumulative pen-up + ink distance before this stroke starts. */
  traveledStart: number
}

export interface PlannedTravel {
  id: string
  from: StrokeWritingPoint
  to: StrokeWritingPoint
  distance: number
  /** Normalized window (0..1 of the entrance). */
  start: number
  end: number
  traveledStart: number
}

export interface StrokeWritingPlan {
  fontId: string
  fontFamily: string
  strokes: PlannedStroke[]
  travels: PlannedTravel[]
  /** Bundled natural duration before it was fitted to the entrance. */
  naturalDuration: number
  totalInkLength: number
  totalTravelDistance: number
  bounds: Rect
}

export interface StrokeWritingCursor {
  point: StrokeWritingPoint
  /** Unit direction of travel; follows the ink tangent while pen-down. */
  tangent: Vec2
  /** Degrees, for pen instruments. */
  angle: number
  /** Pen-up + ink distance covered so far, used to cycle hand poses. */
  traveled: number
  /** Index of the stroke being written; drives the hand's grip alternation. */
  strokeIndex: number
  moving: boolean
  penDown: boolean
}

const GLYPH_GAP = 0.1
const WORD_GAP = 0.15
const LINE_GAP = 0.3
/** Minimum pen-up interval so consecutive strokes never teleport. */
const MIN_PEN_UP = 0.045
const MIN_STROKE_DURATION = 0.03
/** A dot gets a short, deliberate tap instead of the bundle's 1 ms. */
const DOT_DURATION = 0.09
const DOT_LENGTH = 0.75

interface CachedPlan {
  key: string
  plan: StrokeWritingPlan
}

/**
 * The layout inputs a plan needs. A TextElement satisfies it; font previews
 * supply a plain object so they draw with the same geometry as the canvas.
 */
export interface StrokeLayout {
  text: string
  fontSize: number
  letterSpacing: number
  lineHeight: number
  align: 'left' | 'center' | 'right'
  writeBackwards: boolean
  frame: Rect
}

const planCache = new WeakMap<StrokeLayout, CachedPlan>()

function cacheKey(element: StrokeLayout, font: StrokeFontBundle): string {
  const { frame } = element
  return [
    font.id,
    element.text,
    element.fontSize,
    element.letterSpacing,
    element.lineHeight,
    element.align,
    element.writeBackwards,
    frame.x,
    frame.y,
    frame.width,
    frame.height
  ].join('\u0001')
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Smoothstep keeps handwriting fluid: enough acceleration to read as a hand
 * settling on the surface, without the near-stop of a cubic ease at both ends.
 */
function penEase(value: number): number {
  const t = clamp01(value)
  return t * t * (3 - 2 * t)
}

function buildStrokeGeometry(
  font: StrokeFontBundle,
  char: string,
  strokeIndex: number,
  glyphX: number,
  baseline: number,
  scale: number
): { points: StrokeWritingPoint[]; width: number } | null {
  const glyph = font.glyphs[char]
  const stroke = glyph?.s[strokeIndex]
  if (!glyph || !stroke || stroke.p.length === 0) return null

  const points: StrokeWritingPoint[] = []
  const widths: number[] = []
  for (const point of stroke.p) {
    const next = {
      x: round(glyphX + point[0] * scale),
      y: round(baseline + point[1] * scale)
    }
    const previous = points[points.length - 1]
    if (!previous || Math.abs(previous.x - next.x) > 1e-6 || Math.abs(previous.y - next.y) > 1e-6) {
      points.push(next)
    }
    widths.push(point[2] * scale)
  }
  if (points.length === 0) return null
  widths.sort((a, b) => a - b)
  const width = Math.max(0.35, widths[Math.floor(widths.length / 2)] ?? 1)
  return { points, width }
}

function polylineLength(points: StrokeWritingPoint[]): number {
  let total = 0
  for (let index = 1; index < points.length; index += 1) {
    total += Math.hypot(
      points[index]!.x - points[index - 1]!.x,
      points[index]!.y - points[index - 1]!.y
    )
  }
  return total
}

function pathData(points: StrokeWritingPoint[]): string {
  if (points.length === 0) return ''
  const [first, ...rest] = points
  return `M ${first!.x} ${first!.y}${rest.map((point) => ` L ${point.x} ${point.y}`).join('')}`
}

export function strokeWritingPlan(
  element: StrokeLayout,
  font: StrokeFontBundle
): StrokeWritingPlan {
  const key = cacheKey(element, font)
  const cached = planCache.get(element)
  if (cached?.key === key) return cached.plan

  const scale = element.fontSize / font.unitsPerEm
  const spacing = element.letterSpacing
  const lineHeight = element.fontSize * element.lineHeight
  const rawLines = element.text.replace(/\r\n/g, '\n').split('\n')

  const lines = rawLines.map((line, index) => {
    const chars = Array.from(line)
    const advances = chars.map((character) => glyphAdvance(font, character) * scale)
    const width = Math.max(
      0,
      advances.reduce((sum, advance) => sum + advance, 0) + spacing * Math.max(0, chars.length - 1)
    )
    const x =
      element.align === 'center'
        ? element.frame.x + (element.frame.width - width) / 2
        : element.align === 'right'
          ? element.frame.x + element.frame.width - width
          : element.frame.x
    return {
      chars,
      advances,
      width,
      x,
      baseline: element.frame.y + element.fontSize + index * lineHeight
    }
  })

  interface DraftStroke extends Omit<PlannedStroke, 'start' | 'end' | 'traveledStart'> {
    naturalStart: number
    naturalEnd: number
  }

  const draft: DraftStroke[] = []
  let clock = 0
  let penX = 0
  let lineStart = false
  let afterSpace = false
  let glyphIndex = 0

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex]!
    penX = line.x
    lineStart = true
    afterSpace = false

    for (let charIndex = 0; charIndex < line.chars.length; charIndex += 1) {
      const character = line.chars[charIndex]!
      const advance = line.advances[charIndex] ?? 0
      const whitespace = /\s/u.test(character)

      if (whitespace) {
        penX += advance + spacing
        afterSpace = true
        continue
      }

      const glyph = font.glyphs[character]
      if (!glyph) {
        penX += advance + spacing
        continue
      }

      if (glyph.s.length > 0) {
        if (draft.length > 0) {
          clock += lineStart ? LINE_GAP : afterSpace ? WORD_GAP : GLYPH_GAP
        }
        const glyphStart = clock
        let lastEnd = glyphStart
        glyph.s.forEach((stroke, strokeIndex) => {
          const geometry = buildStrokeGeometry(font, character, strokeIndex, penX, line.baseline, scale)
          if (!geometry) return
          const length = polylineLength(geometry.points)
          const dot = length <= DOT_LENGTH
          const duration = Math.max(
            dot ? DOT_DURATION : MIN_STROKE_DURATION,
            dot ? 0 : stroke.a
          )
          let start = glyphStart + Math.max(0, stroke.d)
          if (draft.length > 0) start = Math.max(start, lastEnd + MIN_PEN_UP)
          const end = start + duration
          draft.push({
            id: `s${draft.length}`,
            glyphIndex,
            glyphChar: character,
            points: geometry.points,
            cumulative: [],
            length,
            width: geometry.width,
            dot,
            d: pathData(geometry.points),
            naturalStart: start,
            naturalEnd: end
          })
          lastEnd = end
        })
        clock = lastEnd
      }

      lineStart = false
      afterSpace = false
      penX += advance + spacing
      glyphIndex += 1
    }
  }

  const naturalDuration = clock
  const totalInkLength = draft.reduce((sum, stroke) => sum + stroke.length, 0)
  const windows = draft.map((stroke) =>
    naturalDuration > 0
      ? { start: stroke.naturalStart / naturalDuration, end: stroke.naturalEnd / naturalDuration }
      : { start: 0, end: 1 }
  )
  const strokes: PlannedStroke[] = []
  const travels: PlannedTravel[] = []
  let traveled = 0

  draft.forEach((stroke, index) => {
    const window = windows[index]!
    if (index > 0) {
      const previous = strokes[index - 1]!
      const from = previous.points[previous.points.length - 1]!
      const to = stroke.points[0]!
      const distance = Math.hypot(to.x - from.x, to.y - from.y)
      travels.push({
        id: `t${travels.length}`,
        from,
        to,
        distance,
        start: previous.end,
        end: window.start,
        traveledStart: traveled
      })
      traveled += distance
    }
    const cumulative: number[] = [0]
    for (let pointIndex = 1; pointIndex < stroke.points.length; pointIndex += 1) {
      cumulative.push(
        cumulative[pointIndex - 1]! +
          Math.hypot(
            stroke.points[pointIndex]!.x - stroke.points[pointIndex - 1]!.x,
            stroke.points[pointIndex]!.y - stroke.points[pointIndex - 1]!.y
          )
      )
    }
    strokes.push({
      id: stroke.id,
      glyphIndex: stroke.glyphIndex,
      glyphChar: stroke.glyphChar,
      points: stroke.points,
      cumulative,
      length: stroke.length,
      width: stroke.width,
      dot: stroke.dot,
      d: stroke.d,
      start: window.start,
      end: window.end,
      traveledStart: traveled
    })
    traveled += stroke.length
  })

  const points = draft.flatMap((stroke) => stroke.points)
  const halfWidth = Math.max(...draft.map((stroke) => stroke.width / 2), scale * 20)
  const bounds =
    points.length > 0
      ? (() => {
          const box = boundsOfPoints(points)
          return {
            x: box.x - halfWidth,
            y: box.y - halfWidth,
            width: box.width + halfWidth * 2,
            height: box.height + halfWidth * 2
          }
        })()
      : {
          x: element.frame.x,
          y: element.frame.y,
          width: element.frame.width,
          height: element.frame.height
        }

  const plan: StrokeWritingPlan = {
    fontId: font.id,
    fontFamily: font.family,
    strokes,
    travels,
    naturalDuration,
    totalInkLength,
    totalTravelDistance: traveled - totalInkLength,
    bounds
  }
  planCache.set(element, { key, plan })
  return plan
}

export function strokeWritingPlanForText(element: TextElement): StrokeWritingPlan | null {
  const font = strokeFontForElement(element)
  return font ? strokeWritingPlan(element, font) : null
}

/**
 * A single-line sample of `text` written in `font`, laid out from the origin.
 * Used by the font picker so each entry previews its own handwriting.
 */
export function strokeSample(font: StrokeFontBundle, text: string, fontSize: number): StrokeWritingPlan {
  return strokeWritingPlan(
    {
      text,
      fontSize,
      letterSpacing: 0,
      lineHeight: 1.4,
      align: 'left',
      writeBackwards: false,
      frame: { x: 0, y: 0, width: 0, height: fontSize * 1.4 }
    },
    font
  )
}

function pointAtDistance(stroke: PlannedStroke, distance: number): { point: StrokeWritingPoint; tangent: Vec2 } {
  const { points, cumulative } = stroke
  if (points.length === 1 || stroke.length <= 1e-6) {
    return { point: points[0]!, tangent: { x: 1, y: 0 } }
  }
  const target = Math.max(0, Math.min(distance, stroke.length))
  let low = 1
  let high = cumulative.length - 1
  while (low < high) {
    const middle = (low + high) >>> 1
    if (cumulative[middle]! < target) low = middle + 1
    else high = middle
  }
  const end = points[low]!
  const start = points[low - 1]!
  const span = Math.max(1e-8, cumulative[low]! - cumulative[low - 1]!)
  const local = clamp01((target - cumulative[low - 1]!) / span)
  const dx = end.x - start.x
  const dy = end.y - start.y
  const magnitude = Math.hypot(dx, dy) || 1
  return {
    point: { x: start.x + dx * local, y: start.y + dy * local },
    tangent: { x: dx / magnitude, y: dy / magnitude }
  }
}

/** Partial ink reveal for one stroke, using the same easing as the hand. */
export function strokeDrawProgress(stroke: PlannedStroke, progress: number): number {
  if (progress <= stroke.start) return 0
  if (progress >= stroke.end) return 1
  return penEase((progress - stroke.start) / Math.max(1e-9, stroke.end - stroke.start))
}

/**
 * Where the pen tip is at an entrance progress. The cursor follows the exact
 * ink polyline, glides between strokes with the pen lifted, and freezes on the
 * spot while a stroke is not moving.
 */
export function evaluateStrokeWriting(
  plan: StrokeWritingPlan,
  progress: number
): StrokeWritingCursor | null {
  if (plan.strokes.length === 0) return null
  const t = clamp01(progress)
  const first = plan.strokes[0]!
  const last = plan.strokes[plan.strokes.length - 1]!

  if (t < first.start) {
    return {
      point: first.points[0]!,
      tangent: { x: 1, y: 0 },
      angle: 0,
      traveled: 0,
      strokeIndex: 0,
      moving: false,
      penDown: false
    }
  }

  for (let index = 0; index < plan.strokes.length; index += 1) {
    const stroke = plan.strokes[index]!
    if (t < stroke.start) {
      const previous = plan.strokes[index - 1]
      const travel = plan.travels[index - 1]
      if (previous && travel) {
        const local = penEase((t - previous.end) / Math.max(1e-9, stroke.start - previous.end))
        const distance = travel.distance * local
        const tangent =
          travel.distance > 1e-6
            ? {
                x: (travel.to.x - travel.from.x) / travel.distance,
                y: (travel.to.y - travel.from.y) / travel.distance
              }
            : { x: 1, y: 0 }
        return {
          point: {
            x: lerp(travel.from.x, travel.to.x, local),
            y: lerp(travel.from.y, travel.to.y, local)
          },
          tangent,
          angle: (Math.atan2(tangent.y, tangent.x) * 180) / Math.PI,
          traveled: travel.traveledStart + distance,
          strokeIndex: index,
          moving: travel.distance > 1e-6,
          penDown: false
        }
      }
      return {
        point: first.points[0]!,
        tangent: { x: 1, y: 0 },
        angle: 0,
        traveled: 0,
        strokeIndex: 0,
        moving: false,
        penDown: false
      }
    }

    if (t <= stroke.end) {
      const local = strokeDrawProgress(stroke, t)
      const position = pointAtDistance(stroke, stroke.length * local)
      return {
        point: position.point,
        tangent: position.tangent,
        angle: (Math.atan2(position.tangent.y, position.tangent.x) * 180) / Math.PI,
        traveled: stroke.traveledStart + stroke.length * local,
        strokeIndex: index,
        moving: stroke.length > 1e-6,
        penDown: true
      }
    }
  }

  const endPoint = last.points[last.points.length - 1]!
  return {
    point: endPoint,
    tangent: { x: 1, y: 0 },
    angle: 0,
    traveled: last.traveledStart + last.length,
    strokeIndex: plan.strokes.length - 1,
    moving: false,
    penDown: false
  }
}

/** Ink extents, used to clip reveal/erase transitions around stroke text. */
export function strokeWritingBounds(element: TextElement): Rect | null {
  const plan = strokeWritingPlanForText(element)
  return plan ? plan.bounds : null
}
