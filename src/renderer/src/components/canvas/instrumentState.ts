import type { SceneVisual } from '@core/animation/scene'
import type { ElementVisualState } from '@core/animation/evaluate'
import { rotatePoint } from '@core/geometry'
import { degToRad } from '@core/math'
import type { Element, Scene, TextElement } from '@core/schema/project'
import { evaluateStrokeWriting, strokeWritingBounds, strokeWritingPlanForText } from '@core/text/strokeWriting'
import type { ElementSchedule } from '@core/timeline/schedule'
import type { ActiveInstrument } from './InstrumentOverlay'
import { eraseEdgePoint, wipeEdgePoint } from './renderUtils'
import { revealBounds, textEraseCursor, textWriteCursor } from './textMetrics'

/** Map a cursor from the text element's local layout into scene/world space. */
function strokeCursorToWorld(
  element: TextElement,
  state: ElementVisualState,
  cursor: {
    point: { x: number; y: number }
    tangent: { x: number; y: number }
    strokeIndex: number
  }
): { x: number; y: number; angle: number; pose: number } {
  const frame = element.frame
  const center = { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 }
  const scale = Math.max(0.0001, state.scale)
  const local = {
    x: center.x + (cursor.point.x - center.x) * scale,
    y: center.y + (cursor.point.y - center.y) * scale
  }
  const rotation = element.rotation + state.rotation
  const rotated = rotatePoint(local, center, rotation)
  const radians = degToRad(rotation)
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const tangent = {
    x: cursor.tangent.x * cos - cursor.tangent.y * sin,
    y: cursor.tangent.x * sin + cursor.tangent.y * cos
  }
  return {
    x: rotated.x + state.translate.x,
    y: rotated.y + state.translate.y,
    angle: (Math.atan2(tangent.y, tangent.x) * 180) / Math.PI,
    // The grip alternates once per pen stroke, never mid-stroke.
    pose: cursor.strokeIndex
  }
}

/**
 * The eraser rides the middle of the diagonal front, so it crosses the block
 * left to right whichever hand is holding it.
 */
function eraseCursor(element: Element, progress: number): { x: number; y: number; angle: number } {
  if (element.kind === 'text') {
    // Stroke fonts are laid out by their own metrics, not the system face.
    const strokeBounds = strokeWritingBounds(element)
    if (strokeBounds) return eraseEdgePoint(strokeBounds, progress)
    return textEraseCursor(element, progress)
  }
  return eraseEdgePoint(revealBounds(element), progress)
}

/** The drawing instrument currently touching the artwork, if any. */
export function findActiveInstrument(
  scene: Scene,
  visual: SceneVisual,
  timings?: Record<string, ElementSchedule>
): ActiveInstrument | null {
  const activeElements = scene.elements.filter((element) => {
    const state = visual.elements[element.id]
    return Boolean(
      state?.handStyle &&
        (state.activeDrawableId || state.wipe || state.scribble || state.strokeDraw !== null)
    )
  })
  // Manual timings can overlap. The animation that started latest is the one
  // visually on top of the drawing cursor at this moment.
  activeElements.sort((a, b) => (timings?.[a.id]?.start ?? 0) - (timings?.[b.id]?.start ?? 0))
  const element = activeElements.at(-1)
  if (!element) return null
  const state = visual.elements[element.id]!
  if (!state.handStyle) return null

  if (state.activeDrawableId) {
    const drawableIndex = state.drawables?.findIndex(
      (drawable) => drawable.id === state.activeDrawableId
    ) ?? -1
    // Once the outline is closed the hand stops tracing and colors the shape
    // in, riding the zig-zag so ink appears under the nib.
    if (state.activeDrawableBBox && state.activeDrawableFill > 0) {
      return {
        elementId: element.id,
        drawableId: null,
        progress: state.activeDrawableFill,
        style: state.handStyle,
        instrumentId: state.instrumentId,
        handedness: state.handedness,
        scribbleFrame: state.activeDrawableBBox,
        pose: drawableIndex >= 0 ? drawableIndex : null
      }
    }
    return {
      elementId: element.id,
      drawableId: state.activeDrawableId,
      progress: state.activeDrawableProgress,
      style: state.handStyle,
      instrumentId: state.instrumentId,
      handedness: state.handedness,
      // One grip change per path, so the hand does not shimmer mid-stroke.
      pose: drawableIndex >= 0 ? drawableIndex : null
    }
  }
  if (state.strokeDraw !== null && element.kind === 'text') {
    const plan = strokeWritingPlanForText(element)
    const cursor = plan ? evaluateStrokeWriting(plan, state.strokeDraw) : null
    if (cursor) {
      const world = strokeCursorToWorld(element, state, cursor)
      return {
        elementId: element.id,
        drawableId: null,
        progress: state.strokeDraw,
        style: state.handStyle,
        instrumentId: state.instrumentId,
        handedness: state.handedness,
        strokeCursor: world,
        pose: world.pose
      }
    }
  }
  if (state.scribble) {
    return {
      elementId: element.id,
      drawableId: null,
      progress: state.scribble.progress,
      style: state.handStyle,
      instrumentId: state.instrumentId,
      handedness: state.handedness,
      scribbleFrame: element.frame,
      pose: Math.floor(state.scribble.progress * 6)
    }
  }
  if (!state.wipe) return null
  // An eraser scrubs as it travels, so the pose alternates far more often than
  // the four grips a pen uses across a whole stroke.
  const pose = state.erasing ? Math.floor(state.wipe.progress * 10) : null
  if (state.erasing) {
    return {
      elementId: element.id,
      drawableId: null,
      progress: state.wipe.progress,
      style: state.handStyle,
      instrumentId: state.instrumentId,
      handedness: state.handedness,
      wipeCursor: eraseCursor(element, state.wipe.progress),
      pose
    }
  }
  if (element.kind === 'text') {
    // Stroke fonts are not laid out with the system face, so the instrument has
    // to ride the ink block instead of a measured baseline.
    const strokeBounds = strokeWritingBounds(element)
    return {
      elementId: element.id,
      drawableId: null,
      progress: state.wipe.progress,
      style: state.handStyle,
      instrumentId: state.instrumentId,
      handedness: state.handedness,
      wipeCursor: strokeBounds
        ? wipeEdgePoint(strokeBounds, state.wipe.direction, state.wipe.progress)
        : textWriteCursor(element, state.wipe.progress, state.wipe.direction),
      pose
    }
  }
  return {
    elementId: element.id,
    drawableId: null,
    progress: state.wipe.progress,
    style: state.handStyle,
    instrumentId: state.instrumentId,
    handedness: state.handedness,
    wipeFrame: element.frame,
    wipeDirection: state.wipe.direction,
    pose
  }
}
