import { clamp01 } from '@core/math'
import { scrubRemainingPolygons, scrubTip } from '@core/animation/scrub'
import type { Direction } from '@core/schema/primitives'
import type { Rect } from '@core/schema/primitives'
import type { ShapeElement, ShapeKind } from '@core/schema/project'

export function elementGroupTransform(
  frame: Rect,
  rotation: number,
  state: { translate: { x: number; y: number }; scale: number; rotation: number }
): string {
  const cx = frame.x + frame.width / 2
  const cy = frame.y + frame.height / 2
  const effectiveRotation = rotation + state.rotation
  const scale = Math.max(0.0001, state.scale)
  return [
    `translate(${cx + state.translate.x} ${cy + state.translate.y})`,
    `rotate(${effectiveRotation})`,
    `scale(${scale})`,
    `translate(${-cx} ${-cy})`
  ].join(' ')
}

interface Point {
  x: number
  y: number
}

/**
 * Clip polygon for the part of the frame where `side` is non-negative. `side`
 * has to be linear in x and y so the boundary crosses each frame edge at most
 * once, which is what makes one intersection per corner enough.
 */
function sidePolygon(frame: Rect, side: (point: Point) => number): string {
  const corners: Point[] = [
    { x: frame.x, y: frame.y },
    { x: frame.x + frame.width, y: frame.y },
    { x: frame.x + frame.width, y: frame.y + frame.height },
    { x: frame.x, y: frame.y + frame.height }
  ]
  const points: Point[] = []
  for (let index = 0; index < corners.length; index += 1) {
    const a = corners[index]!
    const b = corners[(index + 1) % corners.length]!
    const sa = side(a)
    const sb = side(b)
    if (sa >= 0) points.push(a)
    if (sa >= 0 !== sb >= 0) {
      const t = sa / (sa - sb)
      points.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
    }
  }
  // A front that has swept clean past the frame would otherwise emit an empty
  // points list; a degenerate sliver outside the frame says "clips nothing out"
  // unambiguously instead of relying on how the parser treats an empty polygon.
  if (points.length === 0) {
    const x = frame.x + frame.width
    const y = frame.y + frame.height
    return `${x},${y} ${x + 0.01},${y} ${x + 0.01},${y + 0.01} ${x},${y + 0.01}`
  }
  return points.map((point) => `${point.x},${point.y}`).join(' ')
}

/**
 * Polygon used as a clip path for directional reveal entrances.
 * Progress 0 yields an empty area; progress 1 covers the frame.
 */
export function revealPolygon(frame: Rect, direction: Direction, progress: number): string {
  const p = Math.max(0, Math.min(1, progress))
  const x0 = frame.x
  const y0 = frame.y
  const x1 = frame.x + frame.width
  const y1 = frame.y + frame.height

  switch (direction) {
    case 'left': {
      const edge = x1 - frame.width * p
      return `${x1},${y0} ${edge},${y0} ${edge},${y1} ${x1},${y1}`
    }
    case 'up': {
      const edge = y1 - frame.height * p
      return `${x0},${y1} ${x1},${y1} ${x1},${edge} ${x0},${edge}`
    }
    case 'down': {
      const edge = y0 + frame.height * p
      return `${x0},${y0} ${x1},${y0} ${x1},${edge} ${x0},${edge}`
    }
    case 'diagonal': {
      const threshold = (frame.width + frame.height) * p
      return sidePolygon(
        frame,
        (point) => threshold - (point.x - x0) - (point.y - y0)
      )
    }
    case 'right':
    default: {
      const edge = x0 + frame.width * p
      return `${x0},${y0} ${edge},${y0} ${edge},${y1} ${x0},${y1}`
    }
  }
}

/**
 * Point on the leading edge of a directional wipe, with the angle it travels
 * at. The instrument rides this so the nib sits exactly on the reveal.
 */
export function wipeEdgePoint(
  frame: Rect,
  direction: Direction,
  progress: number
): { x: number; y: number; angle: number } {
  const p = clamp01(progress)
  switch (direction) {
    case 'left':
      return { x: frame.x + frame.width * (1 - p), y: frame.y + frame.height * 0.62, angle: 180 }
    case 'up':
      return { x: frame.x + frame.width * 0.5, y: frame.y + frame.height * (1 - p), angle: -90 }
    case 'down':
      return { x: frame.x + frame.width * 0.5, y: frame.y + frame.height * p, angle: 90 }
    case 'diagonal': {
      const threshold = (frame.width + frame.height) * p
      const minX = Math.max(0, threshold - frame.height)
      const maxX = Math.min(frame.width, threshold)
      return {
        x: frame.x + (minX + maxX) / 2,
        y: frame.y + threshold - (minX + maxX) / 2,
        angle: 45
      }
    }
    case 'right':
    default:
      return { x: frame.x + frame.width * p, y: frame.y + frame.height * 0.62, angle: 0 }
  }
}

/** Formats scrub geometry as an SVG `points` attribute. */
export function polygonPoints(points: Array<{ x: number; y: number }>): string {
  return points.map((point) => `${point.x},${point.y}`).join(' ')
}

/**
 * Clip polygons for the erase: the ink still standing, one polygon per pass.
 * The eraser scrubs across the block and back rather than sweeping it once, so
 * the survivors come back band by band instead of as a single front. `visible`
 * is wipe progress: 1 while the ink stands, 0 once the board is clean.
 */
export function erasePolygons(frame: Rect, visible: number): string[] {
  return scrubRemainingPolygons(frame, 1 - clamp01(visible)).map(polygonPoints)
}

/** Where the eraser rides: the middle of the pass it is currently crossing. */
export function eraseEdgePoint(
  frame: Rect,
  visible: number
): { x: number; y: number; angle: number; pass: number } {
  return scrubTip(frame, 1 - clamp01(visible))
}

export interface ArrowGeometry {
  start: { x: number; y: number }
  end: { x: number; y: number }
  head: string
}

export function arrowGeometry(frame: Rect, strokeWidth: number): ArrowGeometry {
  const start = { x: frame.x, y: frame.y + frame.height }
  const end = { x: frame.x + frame.width, y: frame.y }
  const angle = Math.atan2(end.y - start.y, end.x - start.x)
  const size = Math.max(14, strokeWidth * 3.2)
  const spread = Math.PI / 7
  const p1 = {
    x: end.x - Math.cos(angle - spread) * size,
    y: end.y - Math.sin(angle - spread) * size
  }
  const p2 = {
    x: end.x - Math.cos(angle + spread) * size,
    y: end.y - Math.sin(angle + spread) * size
  }
  return {
    start,
    end,
    head: `${end.x},${end.y} ${p1.x},${p1.y} ${p2.x},${p2.y}`
  }
}

export function shapeLabel(shape: ShapeKind): string {
  switch (shape) {
    case 'rectangle':
      return 'Rectangle'
    case 'roundedRectangle':
      return 'Rounded rectangle'
    case 'ellipse':
      return 'Ellipse'
    case 'triangle':
      return 'Triangle'
    case 'line':
      return 'Line'
    case 'arrow':
      return 'Arrow'
  }
}

export function shapeIsLine(shape: ShapeElement['shape']): boolean {
  return shape === 'line' || shape === 'arrow'
}

/** Renders multiline text lines clipped only by the frame for hit-testing. */
export function textLines(text: string): string[] {
  return text.replace(/\r\n/g, '\n').split('\n')
}
