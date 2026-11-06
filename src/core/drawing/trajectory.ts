import svgpath from 'svgpath'
import { clamp01 } from '../math'

export interface DrawingPoint {
  x: number
  y: number
}

export interface TrajectorySample extends DrawingPoint {
  distance: number
  tangent: DrawingPoint
}

export interface DrawingStroke {
  samples: TrajectorySample[]
  length: number
}

export interface DrawingTrajectory {
  strokes: DrawingStroke[]
  length: number
}

export interface TrajectoryPosition {
  point: DrawingPoint
  tangent: DrawingPoint
  strokeIndex: number
  progress: number
}

const CURVE_STEPS = 32

function distance(a: DrawingPoint, b: DrawingPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function append(stroke: DrawingStroke, point: DrawingPoint, tangent?: DrawingPoint): void {
  const previous = stroke.samples[stroke.samples.length - 1]
  if (!previous) {
    stroke.samples.push({ ...point, distance: 0, tangent: tangent ?? { x: 1, y: 0 } })
    return
  }
  const length = distance(previous, point)
  if (length <= 1e-8) return
  stroke.length += length
  const dx = tangent?.x ?? point.x - previous.x
  const dy = tangent?.y ?? point.y - previous.y
  const magnitude = Math.hypot(dx, dy) || 1
  if (stroke.samples.length === 1) {
    previous.tangent = { x: dx / magnitude, y: dy / magnitude }
  }
  stroke.samples.push({
    ...point,
    distance: stroke.length,
    tangent: { x: dx / magnitude, y: dy / magnitude }
  })
}

function cubic(
  p0: DrawingPoint,
  p1: DrawingPoint,
  p2: DrawingPoint,
  p3: DrawingPoint,
  t: number
): DrawingPoint {
  const inverse = 1 - t
  return {
    x: inverse ** 3 * p0.x + 3 * inverse ** 2 * t * p1.x + 3 * inverse * t ** 2 * p2.x + t ** 3 * p3.x,
    y: inverse ** 3 * p0.y + 3 * inverse ** 2 * t * p1.y + 3 * inverse * t ** 2 * p2.y + t ** 3 * p3.y
  }
}

function quadratic(
  p0: DrawingPoint,
  p1: DrawingPoint,
  p2: DrawingPoint,
  t: number
): DrawingPoint {
  const inverse = 1 - t
  return {
    x: inverse ** 2 * p0.x + 2 * inverse * t * p1.x + t ** 2 * p2.x,
    y: inverse ** 2 * p0.y + 2 * inverse * t * p1.y + t ** 2 * p2.y
  }
}

function cubicTangent(
  p0: DrawingPoint,
  p1: DrawingPoint,
  p2: DrawingPoint,
  p3: DrawingPoint,
  t: number
): DrawingPoint {
  const inverse = 1 - t
  return {
    x: 3 * inverse ** 2 * (p1.x - p0.x) + 6 * inverse * t * (p2.x - p1.x) + 3 * t ** 2 * (p3.x - p2.x),
    y: 3 * inverse ** 2 * (p1.y - p0.y) + 6 * inverse * t * (p2.y - p1.y) + 3 * t ** 2 * (p3.y - p2.y)
  }
}

function quadraticTangent(
  p0: DrawingPoint,
  p1: DrawingPoint,
  p2: DrawingPoint,
  t: number
): DrawingPoint {
  return {
    x: 2 * (1 - t) * (p1.x - p0.x) + 2 * t * (p2.x - p1.x),
    y: 2 * (1 - t) * (p1.y - p0.y) + 2 * t * (p2.y - p1.y)
  }
}

/**
 * Convert normalized SVG geometry to deterministic subpath samples. Move-to
 * commands start new strokes; no connector is ever invented between them.
 */
export function buildDrawingTrajectory(d: string): DrawingTrajectory {
  const strokes: DrawingStroke[] = []
  let active: DrawingStroke | null = null
  let contourStart: DrawingPoint = { x: 0, y: 0 }
  let current: DrawingPoint = { x: 0, y: 0 }

  const normalized = svgpath(d).abs().unshort().unarc()
  normalized.iterate((rawSegment) => {
    const segment = rawSegment as unknown as Array<string | number>
    const command = String(segment[0]).toUpperCase()
    const values = segment.slice(1).map(Number)

    if (command === 'M') {
      current = { x: values[0] ?? 0, y: values[1] ?? 0 }
      contourStart = current
      active = { samples: [], length: 0 }
      append(active, current)
      strokes.push(active)
      return
    }
    if (!active) return

    if (command === 'L') {
      current = { x: values[0] ?? current.x, y: values[1] ?? current.y }
      append(active, current)
    } else if (command === 'H') {
      current = { x: values[0] ?? current.x, y: current.y }
      append(active, current)
    } else if (command === 'V') {
      current = { x: current.x, y: values[0] ?? current.y }
      append(active, current)
    } else if (command === 'C') {
      const p0 = current
      const p1 = { x: values[0] ?? current.x, y: values[1] ?? current.y }
      const p2 = { x: values[2] ?? current.x, y: values[3] ?? current.y }
      const p3 = { x: values[4] ?? current.x, y: values[5] ?? current.y }
      for (let step = 1; step <= CURVE_STEPS; step += 1) {
        const t = step / CURVE_STEPS
        append(active, cubic(p0, p1, p2, p3, t), cubicTangent(p0, p1, p2, p3, t))
      }
      current = p3
    } else if (command === 'Q') {
      const p0 = current
      const p1 = { x: values[0] ?? current.x, y: values[1] ?? current.y }
      const p2 = { x: values[2] ?? current.x, y: values[3] ?? current.y }
      for (let step = 1; step <= CURVE_STEPS; step += 1) {
        const t = step / CURVE_STEPS
        append(active, quadratic(p0, p1, p2, t), quadraticTangent(p0, p1, p2, t))
      }
      current = p2
    } else if (command === 'Z') {
      append(active, contourStart)
      current = contourStart
    }
  })

  const valid = strokes.filter((stroke) => stroke.samples.length > 0)
  return { strokes: valid, length: valid.reduce((sum, stroke) => sum + stroke.length, 0) }
}

function pointAtDistance(stroke: DrawingStroke, target: number): TrajectoryPosition | null {
  const samples = stroke.samples
  if (samples.length === 0) return null
  if (samples.length === 1 || stroke.length <= 1e-8) {
    return { point: samples[0]!, tangent: samples[0]!.tangent, strokeIndex: -1, progress: 1 }
  }

  let low = 1
  let high = samples.length - 1
  while (low < high) {
    const middle = (low + high) >>> 1
    if (samples[middle]!.distance < target) low = middle + 1
    else high = middle
  }
  const end = samples[low]!
  const start = samples[low - 1]!
  const span = Math.max(1e-8, end.distance - start.distance)
  const t = clamp01((target - start.distance) / span)
  const dx = end.x - start.x
  const dy = end.y - start.y
  const tangentX = start.tangent.x + (end.tangent.x - start.tangent.x) * t
  const tangentY = start.tangent.y + (end.tangent.y - start.tangent.y) * t
  const tangentLength = Math.hypot(tangentX, tangentY) || 1
  return {
    point: { x: start.x + dx * t, y: start.y + dy * t },
    tangent: { x: tangentX / tangentLength, y: tangentY / tangentLength },
    strokeIndex: -1,
    progress: target / stroke.length
  }
}

/** Evaluate an absolute 0..1 position across path strokes in source order. */
export function evaluateDrawingTrajectory(
  trajectory: DrawingTrajectory,
  progress: number
): TrajectoryPosition | null {
  if (trajectory.strokes.length === 0) return null
  const total = trajectory.length
  if (total <= 1e-8) {
    const first = trajectory.strokes[0]!.samples[0]!
    return { point: first, tangent: first.tangent, strokeIndex: 0, progress: 1 }
  }

  let remaining = clamp01(progress) * total
  for (let index = 0; index < trajectory.strokes.length; index += 1) {
    const stroke = trajectory.strokes[index]!
    if (remaining <= stroke.length || index === trajectory.strokes.length - 1) {
      const position = pointAtDistance(stroke, Math.min(remaining, stroke.length))
      return position ? { ...position, strokeIndex: index } : null
    }
    remaining -= stroke.length
  }
  return null
}
