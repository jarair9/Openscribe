import { clamp01 } from '../math'
import type { Rect } from '../schema/primitives'

/**
 * Height of one scrubbing pass in world units. A pass is roughly as tall as the
 * contact patch of a hand, so a sweep reads as something dragged across the
 * board instead of a bar wiping the whole frame in a handful of steps.
 */
export const SCRUB_PASS_HEIGHT = 30
/** Finished passes bleed into the next one so no uncoloured seam survives. */
const SCRUB_BLEED = 0.1
const SCRUB_MIN_PASSES = 3
const SCRUB_MAX_PASSES = 32
/** How far the leading edge leans, as a fraction of the pass height. */
const SCRUB_LEAN = 0.32

export interface ScrubPass {
  index: number
  top: number
  bottom: number
  /** Every other pass runs the other way; the alternation is the zig-zag. */
  leftToRight: boolean
}

export interface ScrubPoint {
  x: number
  y: number
}

export interface ScrubTip {
  x: number
  y: number
  /** Heading of the pass: 0 travelling right, 180 travelling left. */
  angle: number
  /** Pass the tip is on, so the instrument can flip its pose with the stroke. */
  pass: number
}

/** Number of passes a block of `height` is scribbled over in. */
export function scrubPassCount(height: number): number {
  const safe = Math.max(1, height)
  return Math.max(SCRUB_MIN_PASSES, Math.min(SCRUB_MAX_PASSES, Math.round(safe / SCRUB_PASS_HEIGHT)))
}

/**
 * The passes a block is scrubbed in. Bands tile the block exactly, so an
 * erased band never leaks back into the one above it, and alternate passes run
 * in opposite directions — which is the zig-zag.
 */
export function scrubPasses(box: Rect): ScrubPass[] {
  const count = scrubPassCount(box.height)
  const band = box.height / count
  return Array.from({ length: count }, (_, index) => ({
    index,
    top: box.y + index * band,
    bottom: index === count - 1 ? box.y + box.height : box.y + (index + 1) * band,
    leftToRight: index % 2 === 0
  }))
}

/**
 * A pass grown by the bleed margin. Reveals overlap deliberately so the hand
 * never leaves an uncoloured hairline between two passes.
 */
function bledBand(box: Rect, pass: ScrubPass): { top: number; bottom: number } {
  const bleed = (pass.bottom - pass.top) * SCRUB_BLEED
  return {
    top: Math.max(box.y, pass.top - bleed),
    bottom: Math.min(box.y + box.height, pass.bottom + bleed)
  }
}

/** How far the leading edge leans, in world units, across one pass. */
function passLean(pass: ScrubPass, box: Rect): number {
  return Math.min((pass.bottom - pass.top) * SCRUB_LEAN * 0.5, Math.max(1, box.width * 0.08))
}

function clampX(box: Rect, x: number): number {
  return Math.min(box.x + box.width, Math.max(box.x, x))
}

/** Where the leading edge sits `fraction` of the way across a pass. */
function passFront(box: Rect, pass: ScrubPass, fraction: number): number {
  const f = clamp01(fraction)
  return pass.leftToRight ? box.x + box.width * f : box.x + box.width * (1 - f)
}

function bandQuad(box: Rect, band: { top: number; bottom: number }): ScrubPoint[] {
  return [
    { x: box.x, y: band.top },
    { x: box.x + box.width, y: band.top },
    { x: box.x + box.width, y: band.bottom },
    { x: box.x, y: band.bottom }
  ]
}

/** The area of one pass the nib has already covered, or null before it starts. */
function coveredQuad(box: Rect, pass: ScrubPass, fraction: number): ScrubPoint[] | null {
  const f = clamp01(fraction)
  if (f <= 0) return null
  const band = bledBand(box, pass)
  if (f >= 1) return bandQuad(box, band)
  const lean = passLean(pass, box)
  const front = passFront(box, pass, f)
  // The edge leans the same way whichever direction the hand is travelling, so
  // a rightward pass leads at the top and a leftward one leads at the bottom.
  const topX = clampX(box, front + lean)
  const bottomX = clampX(box, front - lean)
  if (pass.leftToRight) {
    return [
      { x: box.x, y: band.top },
      { x: topX, y: band.top },
      { x: bottomX, y: band.bottom },
      { x: box.x, y: band.bottom }
    ]
  }
  return [
    { x: topX, y: band.top },
    { x: box.x + box.width, y: band.top },
    { x: box.x + box.width, y: band.bottom },
    { x: bottomX, y: band.bottom }
  ]
}

/** The part of one pass that survives the eraser, or null once it is clean. */
function remainingQuad(box: Rect, pass: ScrubPass, cleared: number): ScrubPoint[] | null {
  const c = clamp01(cleared)
  if (c >= 1) return null
  if (c <= 0) return bandQuad(box, pass)
  const lean = passLean(pass, box)
  const front = passFront(box, pass, c)
  const topX = clampX(box, front + lean)
  const bottomX = clampX(box, front - lean)
  if (pass.leftToRight) {
    return [
      { x: topX, y: pass.top },
      { x: box.x + box.width, y: pass.top },
      { x: box.x + box.width, y: pass.bottom },
      { x: bottomX, y: pass.bottom }
    ]
  }
  return [
    { x: box.x, y: pass.top },
    { x: topX, y: pass.top },
    { x: bottomX, y: pass.bottom },
    { x: box.x, y: pass.bottom }
  ]
}

/**
 * Quads covering the part of `box` a scribble has reached at `coverage`. Used
 * as a reveal mask, so the pixels only appear under the hand.
 */
export function scrubCoveredPolygons(box: Rect, coverage: number): ScrubPoint[][] {
  if (box.width <= 0 || box.height <= 0) return []
  const passes = scrubPasses(box)
  const polygons: ScrubPoint[][] = []
  for (const pass of passes) {
    const quad = coveredQuad(box, pass, coverage * passes.length - pass.index)
    if (quad) polygons.push(quad)
  }
  return polygons
}

/**
 * Quads covering the part of `box` still standing after `coverage` has been
 * erased — the complement of the reveal, band by band.
 */
export function scrubRemainingPolygons(box: Rect, coverage: number): ScrubPoint[][] {
  if (box.width <= 0 || box.height <= 0) return []
  const passes = scrubPasses(box)
  const polygons: ScrubPoint[][] = []
  for (const pass of passes) {
    const quad = remainingQuad(box, pass, coverage * passes.length - pass.index)
    if (quad) polygons.push(quad)
  }
  return polygons
}

/**
 * Cuts loose rects — text lines, which are laid out on their own baselines —
 * down to whatever survives a scrub of the block that contains them.
 */
export function scrubRemainingRects(box: Rect, coverage: number, rects: Rect[]): Rect[] {
  if (box.width <= 0 || box.height <= 0) return []
  const passes = scrubPasses(box)
  const surviving: Rect[] = []
  for (const rect of rects) {
    for (const pass of passes) {
      const top = Math.max(rect.y, pass.top)
      const bottom = Math.min(rect.y + rect.height, pass.bottom)
      if (bottom - top <= 0.001) continue
      const cleared = coverage * passes.length - pass.index
      if (cleared >= 1) continue
      let left = rect.x
      let right = rect.x + rect.width
      if (cleared > 0) {
        const front = clampX(box, passFront(box, pass, cleared))
        if (pass.leftToRight) left = Math.max(left, front)
        else right = Math.min(right, front)
      }
      if (right - left <= 0.001) continue
      surviving.push({ x: left, y: top, width: right - left, height: bottom - top })
    }
  }
  return surviving
}

/** Where the hand sits while scrubbing `box` at `coverage`. */
export function scrubTip(box: Rect, coverage: number): ScrubTip {
  const passes = scrubPasses(box)
  const progress = clamp01(coverage) * passes.length
  const index = Math.min(passes.length - 1, Math.floor(progress))
  const pass = passes[index]!
  return {
    x: clampX(box, passFront(box, pass, progress - index)),
    y: (pass.top + pass.bottom) / 2,
    angle: pass.leftToRight ? 0 : 180,
    pass: pass.index
  }
}
