import { clamp, clamp01, ease, lerp } from '../math'
import {
  getDragInstrument,
  getEraserInstrument,
  instrumentHandedness
} from '../instruments'
import { mapRect } from './scribble'
import { strokeFontForElement } from '../text/strokeFont'
import type { Drawable, Element } from '../schema/project'
import type { Direction, Rect, Vec2 } from '../schema/primitives'
import type { ElementSchedule } from '../timeline/schedule'

export interface DrawableState {
  id: string
  /** 0..1 stroke/outline reveal. */
  draw: number
  /** 0..1 fill reveal. */
  fill: number
}

export interface WipeState {
  progress: number
  direction: Direction
}

/** A hand carrying the element in from outside the stage. */
export interface DragState {
  /** Clock hour the element is carried in from (12 top, 3 right, 6 bottom, 9 left). */
  from: number
  /** 0..1 eased element travel: off-stage at 0, landed at 1. */
  progress: number
  /** 0..1 hand withdrawal after the element lands. */
  release: number
  /** World distance the hand retreats along the entry vector. */
  travel: number
}

export interface ElementVisualState {
  elementId: string
  rendered: boolean
  opacity: number
  translate: Vec2
  scale: number
  rotation: number
  /** Per-drawable reveal for SVG elements; null when the element has no drawables. */
  drawables: DrawableState[] | null
  activeDrawableId: string | null
  activeDrawableProgress: number
  /** Coloring (scribble) progress of the active drawable's fill, 0..1. */
  activeDrawableFill: number
  /** World-space box the active drawable's fill is being colored into. */
  activeDrawableBBox: Rect | null
  /** Element-level zig-zag coloring reveal, used by images. */
  scribble: { progress: number } | null
  /** Linear reveal for stroke-font text while its drawing entrance runs. */
  strokeDraw: number | null
  /** Present for directional reveal entrances. */
  wipe: WipeState | null
  /** Present while a handDrag carries the element onto the stage. */
  drag: DragState | null
  handStyle: 'handDraw' | 'penDraw' | null
  instrumentId: string | null
  /** Which hand the instrument artwork is, as photographed. */
  handedness: 'right' | 'left'
  /** True while an erase exit is clearing the board, so the hand can scrub. */
  erasing: boolean
}

export function hiddenElementState(elementId: string): ElementVisualState {
  return {
    elementId,
    rendered: false,
    opacity: 0,
    translate: { x: 0, y: 0 },
    scale: 1,
    rotation: 0,
    drawables: null,
    activeDrawableId: null,
    activeDrawableProgress: 0,
    activeDrawableFill: 0,
    activeDrawableBBox: null,
    scribble: null,
    strokeDraw: null,
    wipe: null,
    drag: null,
    handStyle: null,
    instrumentId: null,
    handedness: 'right',
    erasing: false
  }
}

function directionVector(direction: Direction): Vec2 {
  switch (direction) {
    case 'left':
      return { x: -1, y: 0 }
    case 'right':
      return { x: 1, y: 0 }
    case 'up':
      return { x: 0, y: -1 }
    case 'down':
      return { x: 0, y: 1 }
    case 'diagonal':
    default:
      return { x: 0.7, y: 0.7 }
  }
}

/** Unit vector pointing at the clock position the element enters from. */
export function dragVector(hour: number): Vec2 {
  const radians = (hour * Math.PI) / 6
  const x = Math.sin(radians)
  const y = -Math.cos(radians)
  // Keep the cardinal hours exactly axis-aligned; sin(π) is not quite zero.
  return {
    x: Math.abs(x) < 1e-9 ? 0 : x,
    y: Math.abs(y) < 1e-9 ? 0 : y
  }
}

/**
 * How far along `vector` the frame has to travel to be fully off-camera.
 * Clearing either axis is enough, so the shortest of the two is used — a
 * diagonal entry then hugs the corner instead of starting miles away.
 */
function dragTravel(frame: Rect, cameraFrame: Rect, vector: Vec2, margin: number): number {
  const distances: number[] = []
  if (vector.x > 1e-6) {
    // Entering from the right: the element's left edge must clear the camera.
    distances.push((cameraFrame.x + cameraFrame.width - frame.x + margin) / vector.x)
  } else if (vector.x < -1e-6) {
    // From the left: its right edge must clear the camera.
    distances.push((frame.x + frame.width - cameraFrame.x + margin) / -vector.x)
  }
  if (vector.y > 1e-6) {
    // From below: its top edge must clear the camera.
    distances.push((cameraFrame.y + cameraFrame.height - frame.y + margin) / vector.y)
  } else if (vector.y < -1e-6) {
    // From above: its bottom edge must clear the camera.
    distances.push((frame.y + frame.height - cameraFrame.y + margin) / -vector.y)
  }
  return Math.max(160, Math.min(...distances))
}

export interface DrawProgress {
  states: DrawableState[]
  activeId: string | null
  activeProgress: number
  activeFill: number
}

/** Share of a drawable's window spent outlining before the coloring pass. */
const STROKE_SHARE = 0.6

/** Share of a drag-in spent carrying; the rest is the hand pulling away. */
const DRAG_CARRY_SHARE = 0.72

/**
 * Distribute a single entrance progress across drawables by weight.
 * Evaluation is a pure function of progress, so scrubbing backwards and
 * rendering out of order are exact.
 */
export function distributeDrawProgress(
  drawables: Drawable[],
  order: string[] | null,
  overall: number
): DrawProgress {
  if (drawables.length === 0) {
    return { states: [], activeId: null, activeProgress: 0, activeFill: 0 }
  }
  const byId = new Map(drawables.map((drawable) => [drawable.id, drawable]))
  const ordered = order && order.length > 0
    ? [
        ...order.map((id) => byId.get(id)).filter((drawable): drawable is Drawable => Boolean(drawable)),
        ...drawables.filter((drawable) => !order.includes(drawable.id))
      ]
    : drawables
  const weights = ordered.map((drawable) =>
    drawable.weight > 0 ? drawable.weight : drawable.length || 1
  )
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || ordered.length

  const progress = clamp01(overall)
  const states: DrawableState[] = []
  let activeId: string | null = null
  let activeProgress = 0
  let activeFill = 0
  let cursor = 0

  ordered.forEach((drawable, index) => {
    const share = (weights[index] ?? 1) / totalWeight
    const start = cursor
    const end = index === ordered.length - 1 ? 1 : cursor + share
    const local =
      end <= start ? (progress >= end ? 1 : 0) : clamp01((progress - start) / (end - start))
    // Outline first, then color in: the fill only starts once the nib has most
    // of the way around, so coloring reads as a second pass rather than a fade.
    const draw = clamp01(local / STROKE_SHARE)
    const fill = clamp01((local - STROKE_SHARE) / (1 - STROKE_SHARE))
    states.push({ id: drawable.id, draw, fill })
    if (activeId === null && progress < 1 && progress >= start && progress <= end) {
      activeId = drawable.id
      activeProgress = draw
      activeFill = fill
    }
    cursor = end
  })

  return { states, activeId, activeProgress, activeFill }
}

/**
 * Deterministically evaluate one element at a scene-local timestamp.
 * `drawables` is the resolved geometry for SVG assets (empty for other kinds).
 */
export function evaluateElement(
  element: Element,
  timing: ElementSchedule,
  localTime: number,
  drawables: Drawable[] = [],
  cameraFrame: Rect = { x: 0, y: 0, width: 1280, height: 720 },
  assetViewBox: Rect | null = null
): ElementVisualState {
  if (!element.visible) return hiddenElementState(element.id)
  if (localTime < timing.start) return hiddenElementState(element.id)
  if (element.animation.exit.type !== 'none' && localTime >= timing.exitEnd) {
    return hiddenElementState(element.id)
  }

  const { entrance, emphasis, exit } = element.animation
  const entranceProgress = clamp01(
    (localTime - timing.start) / Math.max(entrance.duration, 1e-9)
  )
  const entranceDone = localTime >= timing.entranceEnd - 1e-9

  let opacity = element.opacity
  let scale = 1
  let rotation = 0
  let translate: Vec2 = { x: 0, y: 0 }
  let drawableStates: DrawableState[] | null = null
  let activeDrawableId: string | null = null
  let activeDrawableProgress = 0
  let activeDrawableFill = 0
  let activeDrawableBBox: Rect | null = null
  let scribble: { progress: number } | null = null
  let strokeDraw: number | null = null
  let wipe: WipeState | null = null
  let drag: DragState | null = null
  let handStyle: 'handDraw' | 'penDraw' | null = null
  let instrumentId: string | null = null
  let handedness: 'right' | 'left' = entrance.handedness
  let erasing = false

  const frame = element.frame
  const travelByDirection: Record<Direction, number> = {
    left: frame.x + frame.width - cameraFrame.x + 24,
    right: cameraFrame.x + cameraFrame.width - frame.x + 24,
    up: frame.y + frame.height - cameraFrame.y + 24,
    down: cameraFrame.y + cameraFrame.height - frame.y + 24,
    diagonal: Math.max(
      (frame.x + frame.width - cameraFrame.x) / 0.7,
      (frame.y + frame.height - cameraFrame.y) / 0.7
    ) + 24
  }
  const travel = Math.max(
    80,
    travelByDirection[entrance.direction],
    Math.max(frame.width, frame.height)
  )
  const isDrawStyle =
    entrance.type === 'draw' || entrance.type === 'handDraw' || entrance.type === 'penDraw'

  if (entrance.type === 'none') {
    // No entrance animation: the element is simply present from its start
    // time, fully drawn, with no instrument, wipe or coloring pass.
    if (drawables.length > 0) {
      drawableStates = drawables.map((drawable) => ({ id: drawable.id, draw: 1, fill: 1 }))
    }
  } else if (isDrawStyle) {
    const order = element.kind === 'svg' ? element.drawOrder : null
    const strokeFont = element.kind === 'text' ? strokeFontForElement(element) : null
    if (entranceDone) {
      drawableStates = drawables.map((drawable) => ({ id: drawable.id, draw: 1, fill: 1 }))
    } else {
      const eased = ease(entrance.easing, entranceProgress)
      const distributed = distributeDrawProgress(drawables, order, eased)
      if (strokeFont && drawables.length === 0) {
        // Stroke text carries its own per-stroke rhythm; the entrance progress
        // stays linear so the bundled timing and pen lifts are not warped.
        strokeDraw = entranceProgress
      } else if (distributed.states.length > 0) {
        drawableStates = distributed.states
        activeDrawableId = distributed.activeId
        activeDrawableProgress = distributed.activeProgress
        activeDrawableFill = distributed.activeFill
        if (activeDrawableId && assetViewBox) {
          const active = drawables.find((drawable) => drawable.id === activeDrawableId)
          if (active) activeDrawableBBox = mapRect(active.bbox, assetViewBox, frame)
        }
      } else if (element.kind === 'image') {
        // Raster images have no strokes to trace, so the hand colors them in
        // with a zig-zag pass and the pixels appear only where it has been.
        scribble = { progress: eased }
      } else {
        // Text and shapes have no recoverable strokes: reveal them with a
        // directional wipe so they still read as being drawn on. Text is
        // written left-to-right; everything else sweeps down like VideoScribe.
        wipe = {
          progress: eased,
          direction: element.kind === 'text' ? 'right' : 'down'
        }
      }
      if (entrance.type === 'handDraw' || entrance.type === 'penDraw') {
        handStyle = entrance.type
        instrumentId = entrance.instrumentId
      }
    }
  } else if (!entranceDone) {
    const eased = ease(entrance.easing, entranceProgress)
    switch (entrance.type) {
      case 'fadeIn':
        opacity = element.opacity * eased
        break
      case 'moveIn': {
        const vector = directionVector(entrance.direction)
        translate = {
          x: vector.x * travel * (1 - eased),
          y: vector.y * travel * (1 - eased)
        }
        break
      }
      case 'popIn':
        scale = lerp(0.82, 1, eased)
        opacity = element.opacity * eased
        break
      case 'handDrag': {
        // The element stays whole and simply rides in with the hand, exactly
        // as VideoScribe's drag-in reads: no wipe, no partial ink.
        const vector = dragVector(entrance.dragFrom)
        // A rotated frame needs its rotated bounds cleared, not the raw box.
        const radians = (element.rotation * Math.PI) / 180
        const cos = Math.abs(Math.cos(radians))
        const sin = Math.abs(Math.sin(radians))
        const bounds: Rect = {
          x: frame.x + (frame.width - (frame.width * cos + frame.height * sin)) / 2,
          y: frame.y + (frame.height - (frame.width * sin + frame.height * cos)) / 2,
          width: frame.width * cos + frame.height * sin,
          height: frame.width * sin + frame.height * cos
        }
        const distance = dragTravel(bounds, cameraFrame, vector, 48)
        // The element is released before the entrance ends, leaving the hand a
        // beat to withdraw along the path it came in on.
        const carry = clamp01(entranceProgress / DRAG_CARRY_SHARE)
        const carried = ease(entrance.easing, carry)
        translate = {
          x: vector.x * distance * (1 - carried),
          y: vector.y * distance * (1 - carried)
        }
        handStyle = 'handDraw'
        // Old projects may name a pen here; only carrying hands may render.
        instrumentId = getDragInstrument(entrance.instrumentId).id
        // A hand reaching in from the left is mirrored so the palm leads.
        handedness = vector.x < -0.25 ? 'left' : 'right'
        drag = {
          from: entrance.dragFrom,
          progress: carried,
          release: clamp01((entranceProgress - DRAG_CARRY_SHARE) / (1 - DRAG_CARRY_SHARE)),
          travel: distance
        }
        break
      }
      case 'reveal':
        wipe = { progress: eased, direction: entrance.direction }
        break
    }
  } else if (entrance.type === 'draw' || entrance.type === 'handDraw' || entrance.type === 'penDraw') {
    drawableStates = drawables.map((drawable) => ({ id: drawable.id, draw: 1, fill: 1 }))
  }

  if (
    emphasis.type !== 'none' &&
    localTime >= timing.emphasisStart &&
    localTime < timing.emphasisEnd + 1e-9
  ) {
    const u = clamp01(
      (localTime - timing.emphasisStart) / Math.max(emphasis.duration * emphasis.loops, 1e-9)
    )
    const loops = emphasis.loops
    const intensity = emphasis.intensity
    switch (emphasis.type) {
      case 'pulse':
        scale *= 1 + Math.abs(Math.sin(u * Math.PI * loops)) * 0.08 * intensity
        break
      case 'bounce':
        translate = {
          ...translate,
          y: translate.y - Math.abs(Math.sin(u * Math.PI * loops)) * 42 * intensity
        }
        break
      case 'shake':
        translate = {
          ...translate,
          x: translate.x + Math.sin(u * Math.PI * 2 * loops * 3) * 14 * intensity
        }
        break
      case 'spin':
        rotation += 360 * u * loops
        break
      case 'zoom':
        scale *= 1 + Math.sin(u * Math.PI * Math.max(1, loops)) * 0.16 * intensity
        break
    }
  }

  if (exit.type !== 'none' && localTime >= timing.exitStart) {
    const u = clamp01((localTime - timing.exitStart) / Math.max(exit.duration, 1e-9))
    const eased = ease(exit.easing, u)
    switch (exit.type) {
      case 'fadeOut':
        opacity *= 1 - eased
        break
      case 'moveOut': {
        const vector = directionVector(exit.direction)
        translate = {
          x: translate.x + vector.x * travel * eased,
          y: translate.y + vector.y * travel * eased
        }
        break
      }
      case 'scaleOut':
        scale *= Math.max(0, 1 - eased)
        break
      case 'erase': {
        // Board cleaning, not a fade. The eraser scrubs back and forth down
        // the block the way a hand wipes a whiteboard — the renderer alternates
        // the pass direction and leans the leading edge. The Direction field is
        // deliberately ignored: an eraser chooses its own path.
        //
        // The scrub runs on raw time rather than the exit easing. A hand wiping
        // a board moves at a steady pace; curving the progress (the default
        // ease-in is cubic) left the board almost untouched until the last
        // moment and then made it vanish in a rush.
        const eraser = getEraserInstrument(exit.instrumentId)
        wipe = { progress: 1 - u, direction: 'left' }
        handStyle = eraser.kind === 'hand' ? 'handDraw' : 'penDraw'
        instrumentId = eraser.id
        handedness = instrumentHandedness(eraser)
        erasing = true
        break
      }
    }
  }

  return {
    elementId: element.id,
    rendered: true,
    opacity: clamp(opacity, 0, 1),
    translate,
    scale: Math.max(0, scale),
    rotation,
    drawables: drawableStates,
    activeDrawableId,
    activeDrawableProgress,
    activeDrawableFill,
    activeDrawableBBox,
    scribble,
    strokeDraw,
    wipe,
    drag,
    handStyle,
    instrumentId,
    handedness,
    erasing
  }
}
