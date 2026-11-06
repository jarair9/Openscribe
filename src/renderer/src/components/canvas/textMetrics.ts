import { clamp01 } from '@core/math'
import { glyphAdvance, strokeFontForElement } from '@core/text/strokeFont'
import type { Direction, Rect } from '@core/schema/primitives'
import type { Element, TextElement } from '@core/schema/project'
import { eraseEdgePoint, eraseEdgeX } from './renderUtils'

let context: CanvasRenderingContext2D | null | undefined
const widthCache = new Map<string, number>()

function measuringContext(): CanvasRenderingContext2D | null {
  if (context !== undefined) return context
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null
  context = canvas ? canvas.getContext('2d') : null
  return context
}

/**
 * Advance width of one line as the canvas actually paints it: bundled stroke
 * fonts are laid out from their own glyph metrics, so measuring them with a
 * system font would size the frame against the wrong face entirely.
 */
export function textInkWidth(element: TextElement, line: string): number {
  const font = strokeFontForElement(element)
  if (!font) return lineWidth(element, line)
  const characters = Array.from(line)
  const scale = element.fontSize / font.unitsPerEm
  return (
    characters.reduce((sum, character) => sum + glyphAdvance(font, character) * scale, 0) +
    element.letterSpacing * Math.max(0, characters.length - 1)
  )
}

/**
 * The frame a text element should have for its current content. Text paints
 * from `frame.y` and is aligned inside the frame, never wrapped to it, so a
 * fixed-width frame leaves the selection box floating far away from the ink.
 * The anchor the text is aligned around is held still while the box shrinks.
 */
export function fitTextFrame(element: TextElement): Rect {
  const frame = element.frame
  const lines = element.text.replace(/\r\n/g, '\n').split('\n')
  const ink = Math.max(0, ...lines.map((line) => textInkWidth(element, line)))
  const width = Math.max(ink + element.fontSize * 0.12, element.fontSize * 3)
  const height =
    element.fontSize * (1 + (lines.length - 1) * element.lineHeight) + element.fontSize * 0.25
  const anchor =
    element.align === 'center'
      ? frame.x + frame.width / 2
      : element.align === 'right'
        ? frame.x + frame.width
        : frame.x
  return {
    x:
      element.align === 'center'
        ? anchor - width / 2
        : element.align === 'right'
          ? anchor - width
          : anchor,
    y: frame.y,
    width,
    height
  }
}

function lineWidth(element: TextElement, line: string): number {
  const key = `${element.fontFamily}|${element.fontWeight}|${element.italic ? 'i' : 'n'}|${element.fontSize}|${element.letterSpacing}|${line}`
  const cached = widthCache.get(key)
  if (cached !== undefined) return cached
  const ctx = measuringContext()
  if (!ctx) return line.length * element.fontSize * 0.56
  ctx.font = `${element.italic ? 'italic ' : ''}${element.fontWeight} ${element.fontSize}px ${element.fontFamily}`
  if ('letterSpacing' in ctx) {
    ctx.letterSpacing = `${element.letterSpacing}px`
  }
  const width = ctx.measureText(line).width
  if ('letterSpacing' in ctx) {
    ctx.letterSpacing = '0px'
  }
  if (widthCache.size > 400) widthCache.clear()
  widthCache.set(key, width)
  return width
}

/**
 * Horizontal extent the text actually paints, anchored inside its frame.
 * Text is laid out from `frame.x` with no wrapping, so the frame can be much
 * wider than the ink; reveals and the drawing instrument should follow the ink.
 */
export function revealBounds(element: Element): Rect {
  if (element.kind !== 'text') return element.frame
  const frame = element.frame
  const lines = element.text.replace(/\r\n/g, '\n').split('\n')
  const ink = Math.max(0, ...lines.map((line) => lineWidth(element, line)))
  const width = Math.min(frame.width, Math.max(ink + element.fontSize * 0.08, element.fontSize * 0.6))
  const x =
    element.align === 'center'
      ? frame.x + (frame.width - width) / 2
      : element.align === 'right'
        ? frame.x + frame.width - width
        : frame.x
  return { x, y: frame.y, width, height: frame.height }
}

interface TextLineInk {
  x: number
  y: number
  width: number
  height: number
  baseline: number
}

/**
 * Per-line ink boxes, laid out exactly like TextArtwork (one tspan per line,
 * no wrapping). Used to reveal text the way VideoScribe writes it: the nib
 * travels left-to-right along each baseline, finishing a line before the next.
 */
function textLineInks(element: TextElement): TextLineInk[] {
  const frame = element.frame
  const lines = element.text.replace(/\r\n/g, '\n').split('\n')
  const lineHeight = element.fontSize * element.lineHeight
  return lines.map((line, index) => {
    const width = line.trim().length > 0 ? lineWidth(element, line) : 0
    const x =
      element.align === 'center'
        ? frame.x + (frame.width - width) / 2
        : element.align === 'right'
          ? frame.x + frame.width - width
          : frame.x
    return {
      x,
      y: frame.y + index * lineHeight,
      width,
      height: lineHeight + element.fontSize * 0.25,
      baseline: frame.y + element.fontSize + index * lineHeight
    }
  })
}

interface WritingUnit {
  text: string
  x: number
  y: number
  width: number
  height: number
  baseline: number
  weight: number
  backwards: boolean
  travel?: { fromX: number; fromY: number; toX: number; toY: number }
}

function writingPlan(element: TextElement): { units: WritingUnit[]; total: number } {
  const inks = textLineInks(element)
  const lines = element.text.replace(/\r\n/g, '\n').split('\n')
  const units: WritingUnit[] = []

  inks.forEach((ink, lineIndex) => {
    const characters = Array.from(lines[lineIndex] ?? '')
    let prefix = ''
    const lineUnits: WritingUnit[] = []
    for (const character of characters) {
      const before = lineWidth(element, prefix)
      const after = lineWidth(element, prefix + character)
      const width = Math.max(0, after - before)
      const weight = glyphWritingWeight(character, width, element.fontSize)
      lineUnits.push({
        text: character,
        x: ink.x + before,
        y: ink.y,
        width,
        height: ink.height,
        baseline: ink.baseline,
        weight,
        backwards: element.writeBackwards
      })
      prefix += character
    }
    if (element.writeBackwards) lineUnits.reverse()
    units.push(...lineUnits)
    if (lineIndex < inks.length - 1 && lines[lineIndex + 1]?.length) {
      const next = inks[lineIndex + 1]!
      const fromX = element.writeBackwards ? ink.x : ink.x + ink.width
      const toX = element.writeBackwards ? next.x + next.width : next.x
      const travelDistance = Math.hypot(toX - fromX, next.baseline - ink.baseline)
      units.push({
        text: '', x: toX, y: next.y, width: 0, height: next.height, baseline: next.baseline,
        weight: Math.max(element.fontSize, travelDistance),
        backwards: element.writeBackwards,
        travel: { fromX, fromY: ink.baseline, toX, toY: next.baseline }
      })
    }
  })

  return { units, total: units.reduce((sum, unit) => sum + unit.weight, 0) || 1 }
}

/**
 * Ink the wipe leaves visible. `progress` is the visible fraction and
 * `direction` is which way the edge travels: 'right' uncovers from the start of
 * the writing plan, 'left' keeps the tail and uncovers from the end back.
 */
export function textRevealRects(
  element: TextElement,
  progress: number,
  direction: Direction = 'right'
): Rect[] {
  const { units, total } = writingPlan(element)
  const edge = edgeDistance(progress, direction, total)
  const rects: Rect[] = []
  let travelled = 0
  for (const unit of units) {
    const local = writingStrokeProgress(clamp01((edge - travelled) / unit.weight))
    travelled += unit.weight
    if (!unit.text.trim() || unit.width <= 0) continue
    if (direction === 'left') {
      // `local` is how much of this glyph the eraser has already taken.
      if (local >= 1) continue
      const visible = 1 - local
      rects.push({
        x: unit.x + (unit.backwards ? 0 : unit.width * local),
        y: unit.y,
        width: unit.width * visible,
        height: unit.height
      })
      continue
    }
    if (local <= 0) continue
    rects.push({
      x: unit.x + (unit.backwards ? unit.width * (1 - local) : 0),
      y: unit.y,
      // Reveal ink continuously up to the nib. Waiting for a whole glyph to
      // pop in made the cursor visibly move independently of the lettering.
      width: unit.width * local,
      height: unit.height
    })
  }
  return rects
}

function edgeDistance(progress: number, direction: Direction, total: number): number {
  const visible = clamp01(progress)
  return (direction === 'left' ? 1 - visible : visible) * total
}

/** The box the lines of a text element actually paint, used to lean the erase. */
function inkBlock(inks: TextLineInk[]): Rect {
  const drawn = inks.filter((ink) => ink.width > 0)
  const rows = drawn.length > 0 ? drawn : inks.slice(0, 1)
  const left = Math.min(...rows.map((ink) => ink.x))
  const right = Math.max(...rows.map((ink) => ink.x + ink.width))
  const top = Math.min(...rows.map((ink) => ink.y))
  const bottom = Math.max(...rows.map((ink) => ink.y + ink.height))
  return {
    x: left,
    y: top,
    width: Math.max(1e-6, right - left),
    height: Math.max(1e-6, bottom - top)
  }
}

/**
 * Ink the eraser leaves standing: one box per line, cut where the diagonal
 * front crosses that line. Because the front leans, the top line is always the
 * shortest survivor and the bottom line the longest, which is what makes a
 * single sweep read as a hand dragging an eraser down the board.
 */
export function textEraseRects(element: TextElement, visible: number): Rect[] {
  const inks = textLineInks(element)
  const block = inkBlock(inks)
  return inks
    .filter((ink) => ink.width > 0)
    .map((ink) => {
      const edge = eraseEdgeX(block, visible, (ink.y - block.y) / block.height)
      const x = Math.max(ink.x, edge)
      return { x, y: ink.y, width: Math.max(0, ink.x + ink.width - x), height: ink.height }
    })
    .filter((rect) => rect.width > 0)
}

/** Where the eraser sits on the front, at the height of the block's middle row. */
export function textEraseCursor(
  element: TextElement,
  visible: number
): { x: number; y: number; angle: number } {
  return eraseEdgePoint(inkBlock(textLineInks(element)), visible)
}

/** Instrument position on the wipe edge, glyph by glyph. */
export function textWriteCursor(
  element: TextElement,
  progress: number,
  direction: Direction = 'right'
): { x: number; y: number; angle: number } {
  const { units, total } = writingPlan(element)
  const edge = edgeDistance(progress, direction, total)
  let remaining = edge
  let current = units[0]
  if (!current) {
    return { x: element.frame.x, y: element.frame.y + element.fontSize, angle: 0 }
  }
  for (let index = 0; index < units.length; index += 1) {
    const unit = units[index]!
    current = unit
    if (remaining <= unit.weight) {
      const fraction = unit.weight > 0 ? clamp01(remaining / unit.weight) : 1
      // Give each glyph its own eased stroke so the pen starts and settles on
      // every letter instead of sweeping through a whole word at one speed.
      const strokeMotion = writingStrokeProgress(fraction)
      if (unit.travel) {
        const travel = writingStrokeProgress(fraction)
        return {
          x: unit.travel.fromX + (unit.travel.toX - unit.travel.fromX) * travel,
          y: unit.travel.fromY + (unit.travel.toY - unit.travel.fromY) * travel,
          angle: 0
        }
      }
      return {
        x: unit.backwards
          ? unit.x + unit.width * (1 - strokeMotion)
          : unit.x + unit.width * strokeMotion,
        // Keep the nib on the rendered baseline. The previous synthetic
        // per-letter vertical wobble made it visibly drift off the glyphs.
        y: unit.baseline,
        angle: 0
      }
    }
    remaining -= unit.weight
  }
  return { x: current.x + current.width, y: current.baseline, angle: 0 }
}

function glyphWritingWeight(character: string, advance: number, fontSize: number): number {
  if (/\s/u.test(character)) return Math.max(advance * 0.45, fontSize * 0.12)

  const glyph = character.toLocaleLowerCase()
  const narrow = 'ilI!|.,:;\'`'
  const complex = 'mwMW@%&'
  const punctuation = '!?.,:;'
  const factor = complex.includes(character) ? 1.45 : narrow.includes(character) ? 0.72 : punctuation.includes(character) ? 1.25 : 1
  // A minimum stroke time prevents thin letters from flashing past the nib;
  // wider or more complex letters naturally take longer to write.
  const shapeWidth = /[mw]/u.test(glyph) ? Math.max(advance, fontSize * 0.68) : advance
  return Math.max(shapeWidth * factor, fontSize * 0.24 * factor)
}

function writingStrokeProgress(progress: number): number {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2
}
