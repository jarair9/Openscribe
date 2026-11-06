import type { Easing } from './schema/primitives'

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Normalized progress of value within [start, end], clamped to 0..1. */
export function progress(start: number, end: number, value: number): number {
  if (end <= start) return value >= end ? 1 : 0
  return clamp01((value - start) / (end - start))
}

export function ease(easing: Easing, t: number): number {
  const x = clamp01(t)
  switch (easing) {
    case 'easeIn':
      return x * x * x
    case 'easeOut':
      return 1 - Math.pow(1 - x, 3)
    case 'easeInOut':
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
    case 'linear':
    default:
      return x
  }
}

export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180
}

export function radToDeg(radians: number): number {
  return (radians * 180) / Math.PI
}

export function normalizeDegrees(degrees: number): number {
  const wrapped = degrees % 360
  return wrapped < 0 ? wrapped + 360 : wrapped
}

export function roundTo(value: number, decimals = 2): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

export function approxEqual(a: number, b: number, epsilon = 1e-6): boolean {
  return Math.abs(a - b) <= epsilon
}

export function sinusoidalDuring(progress01: number, loops: number): number {
  return Math.sin(clamp01(progress01) * Math.PI * 2 * loops)
}

/** Logarithmic interpolation used for perceptual camera zoom. */
export function lerpLog(a: number, b: number, t: number): number {
  if (a <= 0 || b <= 0) return lerp(a, b, t)
  return Math.exp(lerp(Math.log(a), Math.log(b), t))
}

export function formatSeconds(seconds: number, precise = false): string {
  const safe = Math.max(0, seconds)
  const minutes = Math.floor(safe / 60)
  const rest = safe - minutes * 60
  const secs = precise ? rest.toFixed(2) : Math.floor(rest).toString().padStart(2, '0')
  return `${minutes}:${precise ? secs.padStart(5, '0') : secs}`
}
