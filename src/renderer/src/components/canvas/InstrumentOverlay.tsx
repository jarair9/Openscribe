import { useLayoutEffect, useRef, useState } from 'react'
import type { JSX, MouseEvent as ReactMouseEvent, RefObject } from 'react'
import { clamp01 } from '@core/math'
import { getInstrument, handPositionForTip, handScaleForStage } from '@core/instruments'
import type { Direction, Rect } from '@core/schema/primitives'
import type { ViewportState } from '../../state/editorStore'
import { wipeEdgePoint } from './renderUtils'
import { HandInstrumentArt } from './HandInstrumentArt'

export interface ActiveInstrument {
  elementId: string
  drawableId: string | null
  progress: number
  style: 'handDraw' | 'penDraw'
  instrumentId: string | null
  handedness?: 'right' | 'left'
  /** Set for shape reveals that follow a wipe edge instead of a path. */
  wipeFrame?: Rect | null
  wipeDirection?: Direction
  /** Text is written along the baseline, line by line, rather than wiped. */
  wipeCursor?: { x: number; y: number; angle: number } | null
  /** Exact ink position for stroke-font handwriting. */
  strokeCursor?: { x: number; y: number; angle: number; pose: number } | null
  /** Hand pose frame derived from distance travelled, frozen while idle. */
  pose?: number | null
}

interface InstrumentOverlayProps {
  active: ActiveInstrument | null
  pathRefs: RefObject<Map<string, SVGPathElement>>
  cameraHeight: number
  cameraWidth: number
  svgRef: RefObject<SVGSVGElement | null>
  viewport: ViewportState
  /** "svg" treats the SVG viewBox as world space (used by the full-screen player). */
  space?: 'viewport' | 'svg'
}

interface TipState {
  x: number
  y: number
  angle: number
}

export function drawablePathKey(elementId: string, drawableId: string): string {
  return `${elementId}::${drawableId}`
}

/**
 * Point at a reveal fraction of a rendered path. Chromium's own arc-length
 * parameterisation is the one the stroke-dash reveal uses, so sampling the live
 * path puts the nib exactly on the leading edge of the ink.
 */
function pointOnPath(
  path: SVGPathElement,
  progress: number
): { point: { x: number; y: number }; tangent: { x: number; y: number } } {
  const total = path.getTotalLength()
  if (!Number.isFinite(total) || total <= 0) {
    return { point: path.getPointAtLength(0), tangent: { x: 1, y: 0 } }
  }
  const distance = clamp01(progress) * total
  const point = path.getPointAtLength(distance)
  const epsilon = Math.max(0.05, total * 0.004)
  const behind = path.getPointAtLength(Math.max(0, distance - epsilon))
  const ahead = path.getPointAtLength(Math.min(total, distance + epsilon))
  const dx = ahead.x - behind.x
  const dy = ahead.y - behind.y
  const magnitude = Math.hypot(dx, dy)
  return {
    point,
    tangent: magnitude > 1e-6 ? { x: dx / magnitude, y: dy / magnitude } : { x: 1, y: 0 }
  }
}

/**
 * Positions the drawing instrument at the point the active path is currently
 * being revealed at, oriented along the path tangent.
 */
export function InstrumentOverlay({
  active,
  pathRefs,
  cameraHeight,
  cameraWidth,
  svgRef,
  viewport,
  space = 'viewport'
}: InstrumentOverlayProps): JSX.Element | null {
  const [tip, setTip] = useState<TipState | null>(null)
  const [pickedAnchor, setPickedAnchor] = useState<{ id: string; x: number; y: number } | null>(null)
  const previous = useRef<TipState | null>(null)

  useLayoutEffect(() => {
    const svg = svgRef.current

    const commit = (world: { x: number; y: number }, angle: number): void => {
      const last = previous.current
      if (
        last &&
        Math.abs(last.x - world.x) < 0.05 &&
        Math.abs(last.y - world.y) < 0.05 &&
        Math.abs(last.angle - angle) < 0.2
      ) {
        return
      }
      const next = { x: world.x, y: world.y, angle }
      previous.current = next
      setTip(next)
    }

    if (!active || !svg) {
      if (previous.current) {
        previous.current = null
        setTip(null)
      }
      return
    }

    // Stroke text: the nib follows the exact ink polyline and pen-up travels.
    if (active.strokeCursor) {
      commit(active.strokeCursor, active.strokeCursor.angle)
      return
    }

    // Font-reveal text is written: the nib follows the line being written.
    if (active.wipeCursor) {
      commit(active.wipeCursor, active.wipeCursor.angle)
      return
    }

    // Shapes reveal through a wipe: follow its leading edge.
    if (active.wipeFrame) {
      const edge = wipeEdgePoint(active.wipeFrame, active.wipeDirection ?? 'right', active.progress)
      commit(edge, edge.angle)
      return
    }

    const path = active.drawableId
      ? pathRefs.current?.get(drawablePathKey(active.elementId, active.drawableId))
      : null
    if (!path) {
      if (previous.current) {
        previous.current = null
        setTip(null)
      }
      return
    }

    try {
      const position = pointOnPath(path, active.progress)
      const point = position.point
      const ahead = {
        x: point.x + position.tangent.x,
        y: point.y + position.tangent.y
      }
      const matrix = path.getScreenCTM()
      if (!matrix) return

      const screenPoint = new DOMPoint(point.x, point.y).matrixTransform(matrix)
      const screenAhead = new DOMPoint(ahead.x, ahead.y).matrixTransform(matrix)

      let world: { x: number; y: number }
      let dx: number
      let dy: number

      if (space === 'svg') {
        const svgMatrix = svg.getScreenCTM()
        if (!svgMatrix) return
        const inverse = svgMatrix.inverse()
        const local = new DOMPoint(screenPoint.x, screenPoint.y).matrixTransform(inverse)
        const localAhead = new DOMPoint(screenAhead.x, screenAhead.y).matrixTransform(inverse)
        world = { x: local.x, y: local.y }
        dx = localAhead.x - local.x
        dy = localAhead.y - local.y
      } else {
        const bounds = svg.getBoundingClientRect()
        world = {
          x: (screenPoint.x - bounds.left - bounds.width / 2) / viewport.zoom + viewport.center.x,
          y: (screenPoint.y - bounds.top - bounds.height / 2) / viewport.zoom + viewport.center.y
        }
        dx = screenAhead.x - screenPoint.x
        dy = screenAhead.y - screenPoint.y
      }

      const angle =
        Math.abs(dx) + Math.abs(dy) < 0.001
          ? (previous.current?.angle ?? 0)
          : (Math.atan2(dy, dx) * 180) / Math.PI

      commit(world, angle)
    } catch {
      // Geometry can be unavailable during unmount; skip the frame.
    }
  })

  if (!active || !tip) return null

  const instrument = getInstrument(active.instrumentId)
  // Photographic instruments — hands and the supplied pen presets — are laid
  // out in an aspect-wide box and pinned to their measured nib. Only the
  // vector fallback pen lives in a 100×100 box and turns with the stroke.
  const isPhotographic = Boolean(instrument.assetPath)
  const boxWidth = instrument.kind === 'hand' || isPhotographic ? instrument.aspect * 100 : 100
  const pose = active.pose ?? Math.floor(active.progress * 4)
  const secondPose = Boolean(instrument.assetPath2 && instrument.tip2 && pose % 2 === 1)
  const defaultTip = secondPose ? instrument.tip2! : instrument.tip
  const drawingTip = pickedAnchor?.id === instrument.id ? pickedAnchor : defaultTip
  const tipX = drawingTip.x * boxWidth
  const tipY = drawingTip.y * 100
  const rotation = instrument.kind === 'hand' || isPhotographic
    ? instrument.handRotation
    : tip.angle + (instrument.rotationOffset ?? 0)
  const stage = svgRef.current?.viewBox.baseVal
  const stageWidth = cameraWidth || stage?.width || cameraHeight * 16 / 9
  // Keep the authored lower cut edge below the stage even on taller formats.
  // This constraint is relaxed only when the asset itself has a nonstandard anchor.
  const handScale = instrument.kind === 'hand'
    ? handScaleForStage(stageWidth, cameraHeight, boxWidth, tipY, instrument.scaleRelativeToStageWidth, instrument.cuffEdgeY)
    : Math.max(24, cameraHeight * instrument.heightFactor) / 100
  const scale = handScale
  const debugHand = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debugHand') === '1'
  const requestedHandedness = active.handedness ?? 'right'
  const sourceHandedness = secondPose
    ? instrument.sourceHandedness2 ?? instrument.sourceHandedness ?? 'right'
    : instrument.sourceHandedness ?? 'right'
  // The author's left/right choice always wins; the source orientation only
  // decides whether the photo has to be mirrored to satisfy it.
  const handPlacement = handPositionForTip(
    tip,
    { x: tipX, y: tipY },
    scale,
    instrument.kind === 'hand' ? requestedHandedness : 'right',
    sourceHandedness
  )
  const handX = handPlacement.x
  const handY = handPlacement.y

  const pickAnchor = (event: ReactMouseEvent<SVGImageElement>): void => {
    const matrix = event.currentTarget.getScreenCTM()
    if (!matrix) return
    const local = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
    const next = { id: instrument.id, x: clamp01(local.x / boxWidth), y: clamp01(local.y / 100) }
    setPickedAnchor(next)
    console.info(`[debugHand] ${instrument.id} pen-tip anchor`, { x: Number(next.x.toFixed(4)), y: Number(next.y.toFixed(4)) })
  }

  return (
    <>
      <g
        transform={instrument.kind === 'hand' || isPhotographic
          ? `translate(${handX} ${handY}) scale(${handPlacement.scaleX} ${scale})`
          : `translate(${tip.x} ${tip.y}) rotate(${rotation}) scale(${scale}) translate(${-tipX} ${-tipY})`}
        pointerEvents={debugHand ? 'auto' : 'none'}
        aria-hidden="true"
      >
        {instrument.kind === 'hand' || isPhotographic
          ? <HandInstrumentArt instrument={instrument} secondPose={secondPose} onImageClick={debugHand ? pickAnchor : undefined} />
          : <PenArt />}
      </g>
      {debugHand ? <g pointerEvents="none" aria-hidden="true">
        <rect x={handPlacement.scaleX < 0 ? handX - boxWidth * scale : handX} y={handY} width={boxWidth * scale} height={100 * scale} fill="none" stroke="#ff3030" strokeWidth={Math.max(1, cameraHeight / 700)} />
        <circle cx={tip.x} cy={tip.y} r={Math.max(3, cameraHeight / 160)} fill="#ff2020" stroke="white" strokeWidth={1} />
        <circle cx={tip.x} cy={tip.y} r={Math.max(6, cameraHeight / 100)} fill="none" stroke="#ff2020" strokeDasharray="3 2" strokeWidth={1} />
      </g> : null}
    </>
  )
}

function PenArt(): JSX.Element {
  return (
    <g>
      <path
        d="M20 12 L27 4 L58 35 L49 46 Z"
        fill="#20242b"
        stroke="#111419"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M27 4 L33 8 L24 17 L20 12 Z" fill="#c9a45c" />
      <path d="M20 12 L24 8 L27 12 L23 16 Z" fill="#111419" />
      <path d="M38 15 L46 23" stroke="#5b6370" strokeWidth="1.4" />
    </g>
  )
}
