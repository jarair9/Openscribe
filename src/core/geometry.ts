import { clamp, degToRad } from './math'
import type { Rect, Vec2 } from './schema/primitives'

export function vec(x: number, y: number): Vec2 {
  return { x, y }
}

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y }
}

export function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y }
}

export function scaleVec(a: Vec2, factor: number): Vec2 {
  return { x: a.x * factor, y: a.y * factor }
}

export function lengthOf(v: Vec2): number {
  return Math.hypot(v.x, v.y)
}

export function rectFromCenter(center: Vec2, width: number, height: number): Rect {
  return { x: center.x - width / 2, y: center.y - height / 2, width, height }
}

export function rectCenter(rect: Rect): Vec2 {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
}

export function rectCorners(rect: Rect): Vec2[] {
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height }
  ]
}

export function rotatePoint(point: Vec2, center: Vec2, degrees: number): Vec2 {
  if (degrees === 0) return point
  const radians = degToRad(degrees)
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const dx = point.x - center.x
  const dy = point.y - center.y
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos
  }
}

/** AABB of a rotated rect. */
export function rotatedRectBounds(rect: Rect, rotationDegrees: number): Rect {
  if (rotationDegrees === 0) return rect
  const center = rectCenter(rect)
  const corners = rectCorners(rect).map((corner) => rotatePoint(corner, center, rotationDegrees))
  return boundsOfPoints(corners)
}

export function boundsOfPoints(points: Vec2[]): Rect {
  if (points.length === 0) return { x: 0, y: 0, width: 1, height: 1 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const point of points) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }
  return { x: minX, y: minY, width: Math.max(0.0001, maxX - minX), height: Math.max(0.0001, maxY - minY) }
}

export function unionRects(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null
  const points = rects.flatMap(rectCorners)
  return boundsOfPoints(points)
}

export function expandRect(rect: Rect, amount: number): Rect {
  return {
    x: rect.x - amount,
    y: rect.y - amount,
    width: rect.width + amount * 2,
    height: rect.height + amount * 2
  }
}

export function rectContainsPoint(rect: Rect, point: Vec2): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  )
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  )
}

/* ------------------------------------------------------------------ */
/* Viewport (editor-only; never affects output)                       */
/* ------------------------------------------------------------------ */

export interface Viewport {
  /** World coordinate shown at the center of the canvas element. */
  center: Vec2
  /** Screen pixels per world unit. */
  zoom: number
}

export interface ScreenSize {
  width: number
  height: number
}

export const MIN_ZOOM = 0.02
export const MAX_ZOOM = 16

export function worldToScreen(point: Vec2, viewport: Viewport, screen: ScreenSize): Vec2 {
  return {
    x: (point.x - viewport.center.x) * viewport.zoom + screen.width / 2,
    y: (point.y - viewport.center.y) * viewport.zoom + screen.height / 2
  }
}

export function screenToWorld(point: Vec2, viewport: Viewport, screen: ScreenSize): Vec2 {
  return {
    x: (point.x - screen.width / 2) / viewport.zoom + viewport.center.x,
    y: (point.y - screen.height / 2) / viewport.zoom + viewport.center.y
  }
}

/** World rectangle currently visible in the editor. */
export function viewportRect(viewport: Viewport, screen: ScreenSize): Rect {
  return {
    x: viewport.center.x - screen.width / (2 * viewport.zoom),
    y: viewport.center.y - screen.height / (2 * viewport.zoom),
    width: screen.width / viewport.zoom,
    height: screen.height / viewport.zoom
  }
}

export function fitRect(rect: Rect, screen: ScreenSize, padding = 64): Viewport {
  const availableWidth = Math.max(32, screen.width - padding * 2)
  const availableHeight = Math.max(32, screen.height - padding * 2)
  const zoom = clamp(
    Math.min(availableWidth / rect.width, availableHeight / rect.height),
    MIN_ZOOM,
    MAX_ZOOM
  )
  return { center: rectCenter(rect), zoom }
}

export function zoomAroundPoint(
  viewport: Viewport,
  screen: ScreenSize,
  anchorScreen: Vec2,
  factor: number
): Viewport {
  const before = screenToWorld(anchorScreen, viewport, screen)
  const zoom = clamp(viewport.zoom * factor, MIN_ZOOM, MAX_ZOOM)
  const after = screenToWorld(anchorScreen, { ...viewport, zoom }, screen)
  return {
    zoom,
    center: {
      x: viewport.center.x + (before.x - after.x),
      y: viewport.center.y + (before.y - after.y)
    }
  }
}

/* ------------------------------------------------------------------ */
/* Resize                                                            */
/* ------------------------------------------------------------------ */

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

/**
 * Resize a frame by dragging one handle. The delta is expressed in the
 * element's local (unrotated) coordinate space; the frame's opposite edge
 * stays visually anchored for rotated elements.
 */
export function resizeFrame(
  frame: Rect,
  handle: ResizeHandle,
  localDx: number,
  localDy: number,
  rotationDegrees: number,
  minSize = 4
): Rect {
  let width = frame.width
  let height = frame.height
  let localShiftX = 0
  let localShiftY = 0

  if (handle.includes('e')) {
    width += localDx
    localShiftX = localDx / 2
  }
  if (handle.includes('w')) {
    width -= localDx
    localShiftX = localDx / 2
  }
  if (handle.includes('s')) {
    height += localDy
    localShiftY = localDy / 2
  }
  if (handle.includes('n')) {
    height -= localDy
    localShiftY = localDy / 2
  }

  width = Math.max(minSize, width)
  height = Math.max(minSize, height)

  const center = rectCenter(frame)
  const shift = rotatePoint(
    { x: center.x + localShiftX, y: center.y + localShiftY },
    center,
    rotationDegrees
  )
  return {
    x: shift.x - width / 2,
    y: shift.y - height / 2,
    width,
    height
  }
}

export function snapValue(value: number, targets: number[], threshold: number): number {
  let best = value
  let bestDistance = threshold
  for (const target of targets) {
    const distance = Math.abs(target - value)
    if (distance <= bestDistance) {
      best = target
      bestDistance = distance
    }
  }
  return best
}
