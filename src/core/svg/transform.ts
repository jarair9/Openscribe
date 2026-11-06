/**
 * Minimal 2D affine matrix utilities and SVG transform-list parsing.
 * Matrices are column-major SVG matrices: [a, b, c, d, e, f].
 */
export type Matrix = readonly [number, number, number, number, number, number]

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0]

export function multiply(parent: Matrix, child: Matrix): Matrix {
  const [a1, b1, c1, d1, e1, f1] = parent
  const [a2, b2, c2, d2, e2, f2] = child
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1
  ]
}

export function applyMatrix(matrix: Matrix, x: number, y: number): { x: number; y: number } {
  const [a, b, c, d, e, f] = matrix
  return { x: a * x + c * y + e, y: b * x + d * y + f }
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

function parseNumbers(value: string): number[] {
  return (value.match(/[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g) ?? []).map(Number)
}

function transformToMatrix(name: string, args: number[]): Matrix {
  switch (name) {
    case 'matrix': {
      if (args.length < 6) return IDENTITY
      return [args[0]!, args[1]!, args[2]!, args[3]!, args[4]!, args[5]!]
    }
    case 'translate': {
      const tx = args[0] ?? 0
      const ty = args[1] ?? 0
      return [1, 0, 0, 1, tx, ty]
    }
    case 'scale': {
      const sx = args[0] ?? 1
      const sy = args[1] ?? sx
      return [sx, 0, 0, sy, 0, 0]
    }
    case 'rotate': {
      const angle = toRadians(args[0] ?? 0)
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      const rotation: Matrix = [cos, sin, -sin, cos, 0, 0]
      if (args.length >= 3) {
        const cx = args[1]!
        const cy = args[2]!
        const toOrigin: Matrix = [1, 0, 0, 1, -cx, -cy]
        const back: Matrix = [1, 0, 0, 1, cx, cy]
        return multiply(multiply(back, rotation), toOrigin)
      }
      return rotation
    }
    case 'skewX': {
      return [1, 0, Math.tan(toRadians(args[0] ?? 0)), 1, 0, 0]
    }
    case 'skewY': {
      return [1, Math.tan(toRadians(args[0] ?? 0)), 0, 1, 0, 0]
    }
    default:
      return IDENTITY
  }
}

/**
 * Parse an SVG transform list into one matrix. Transforms are composed in
 * list order, matching the SVG specification (T then R means T * R).
 */
export function parseTransform(value: string | null | undefined): Matrix {
  if (!value) return IDENTITY
  let result: Matrix = IDENTITY
  const pattern = /([a-zA-Z]+)\s*\(([^)]*)\)/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(value)) !== null) {
    const name = match[1]!
    const args = parseNumbers(match[2] ?? '')
    result = multiply(result, transformToMatrix(name, args))
  }
  return result
}
