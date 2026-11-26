import type { Rect } from '../schema/primitives'
import { scrubTip } from './scrub'

/**
 * Nib position on the coloring path. Coloring a fill or a raster image uses the
 * same back-and-forth scrub as the eraser, so the hand and the ink agree.
 */
export function scribbleTip(box: Rect, progress: number): { x: number; y: number; angle: number } {
  const tip = scrubTip(box, progress)
  return { x: tip.x, y: tip.y, angle: tip.angle }
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
