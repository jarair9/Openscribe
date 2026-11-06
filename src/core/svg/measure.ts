import type { Rect } from '../schema/primitives'

export interface PathMeasurement {
  length: number
  bbox: Rect
}

/** Fallback bbox used when no DOM measurement is available. */
export function approximateBBox(d: string): Rect {
  const numbers = (d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let index = 0; index + 1 < numbers.length; index += 2) {
    const x = numbers[index]!
    const y = numbers[index + 1]!
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, width: 1, height: 1 }
  return {
    x: minX,
    y: minY,
    width: Math.max(0.001, maxX - minX),
    height: Math.max(0.001, maxY - minY)
  }
}

/** Rough polyline length used only when DOM measurement is unavailable. */
export function approximateLength(d: string): number {
  const numbers = (d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number)
  let total = 0
  let previousX: number | null = null
  let previousY: number | null = null
  for (let index = 0; index + 1 < numbers.length; index += 2) {
    const x = numbers[index]!
    const y = numbers[index + 1]!
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    if (previousX !== null && previousY !== null) {
      total += Math.hypot(x - previousX, y - previousY)
    }
    previousX = x
    previousY = y
  }
  return total
}

export function fallbackMeasure(d: string): PathMeasurement {
  return { length: approximateLength(d), bbox: approximateBBox(d) }
}
