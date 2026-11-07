import { clamp01 } from '../math'
import type { Rect } from '../schema/primitives'

export interface ScribbleBand {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Rows the coloring pass tiles the box into. Bands touch exactly, so a finished
 * pass covers the whole box with no uncolored gaps between strokes.
 */
export function scribbleRowCount(height: number): number {
  return Math.max(2, Math.min(7, Math.round(height / 46)))
}

/**
 * The area a boustrophedon coloring pass has covered: every completed row in
 * full, plus the part of the current row the nib has crossed. Alternating row
 * direction is what makes the hand zig-zag instead of sweeping one way.
 */
export function scribbleRects(box: Rect, progress: number): ScribbleBand[] {
  const rows = scribbleRowCount(box.height)
  const band = box.height / rows
  const swept = clamp01(progress) * rows
  const done = Math.min(rows, Math.floor(swept))
  const frac = swept - done
  const bands: ScribbleBand[] = []
  for (let row = 0; row < done; row += 1) {
    bands.push({ x: box.x, y: box.y + row * band, width: box.width, height: band })
  }
  if (done < rows && frac > 0) {
    const width = box.width * frac
    bands.push({
      x: done % 2 === 0 ? box.x : box.x + box.width - width,
      y: box.y + done * band,
      width,
      height: band
    })
  }
  return bands
}

/** Nib position on the coloring path, oriented along the row it is crossing. */
export function scribbleTip(box: Rect, progress: number): { x: number; y: number; angle: number } {
  const rows = scribbleRowCount(box.height)
  const band = box.height / rows
  const swept = clamp01(progress) * rows
  const row = Math.min(rows - 1, Math.floor(swept))
  const frac = clamp01(swept - row)
  const leftToRight = row % 2 === 0
  return {
    x: leftToRight ? box.x + box.width * frac : box.x + box.width * (1 - frac),
    y: box.y + band * (row + 0.5),
    angle: leftToRight ? 0 : 180
  }
}

/** Map a rect from one coordinate space into another (asset viewBox to frame). */
export function mapRect(rect: Rect, from: Rect, to: Rect): Rect {
  const scaleX = to.width / Math.max(0.001, from.width)
  const scaleY = to.height / Math.max(0.001, from.height)
  return {
    x: to.x + (rect.x - from.x) * scaleX,
    y: to.y + (rect.y - from.y) * scaleY,
    width: rect.width * scaleX,
    height: rect.height * scaleY
  }
}
