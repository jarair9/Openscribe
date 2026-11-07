import { clamp, clamp01, ease, lerp } from '../math'
import { getEraserInstrument, instrumentHandedness } from '../instruments'
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

export interface DrawProgress {
  states: DrawableState[]
  activeId: string | null
  activeProgress: number
  activeFill: number
}

/** Share of a drawable's window spent outlining before the coloring pass. */
const STROKE_SHARE = 0.6

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
        // Board cleaning, not a fade. The eraser always travels left to right
        // whatever hand holds it — the renderer leans the front so the top of
        // the block clears ahead of the bottom. The Direction field is
        // deliberately ignored: an eraser has one correct direction.
        const eraser = getEraserInstrument(exit.instrumentId)
        wipe = { progress: 1 - eased, direction: 'left' }
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
    handStyle,
    instrumentId,
    handedness,
    erasing
  }
}
