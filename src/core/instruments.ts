import type { EntranceType } from './schema/project'
import handLibrary from '@shared/hand-library.json'
import calibratedHandTips from '@shared/hand-tips-calibrated.json'

export interface InstrumentDefinition {
  id: string
  name: string
  kind: 'hand' | 'pen'
  description: string
  /** Drawing tip position inside the instrument's normalized box (0..1). */
  tip: { x: number; y: number }
  tip2?: { x: number; y: number }
  /** Palm/grip position used when the hand carries an element (0..1). */
  grip?: { x: number; y: number }
  /** Instrument box height as a fraction of the camera view height. */
  heightFactor: number
  /** Width divided by height. */
  aspect: number
  /** Hand artwork is authored at its writing angle and is never rotated. */
  handRotation: 0
  /** Target photographic hand width as a fraction of stage width. */
  scaleRelativeToStageWidth: number
  /** Lowest point of the authored cuff edge, in the 0..100 sprite box. */
  cuffEdgeY?: number
  /** Pens may turn to follow the stroke. */
  rotationOffset?: number
  /** Tool the hand holds (hands only). */
  tool?: 'marker' | 'pencil'
  /** Bundled photographic preset path, relative to open-assets. */
  assetPath?: string
  assetPath2?: string
  /** Small preview used by the hand picker; falls back to the first pose. */
  thumbnail?: string
  /** Native writing orientation of each supplied hand pose. */
  sourceHandedness?: 'right' | 'left'
  sourceHandedness2?: 'right' | 'left'
  group?: string
  supportedStyles: EntranceType[]
}

/** Scale the hand to its target width and move its authored cuff edge past the stage. */
export function handScaleForStage(
  stageWidth: number,
  stageHeight: number,
  spriteWidth: number,
  anchorY: number,
  scaleRelativeToStageWidth = 0.4,
  cuffEdgeY = 100
): number {
  const widthScale = stageWidth * scaleRelativeToStageWidth / spriteWidth
  const cutEdgeScale = (stageHeight * 1.1 + 1) / Math.max(1, cuffEdgeY - anchorY)
  return Math.max(widthScale, cutEdgeScale)
}

export function handPositionForTip(
  tip: { x: number; y: number },
  anchor: { x: number; y: number },
  scale: number,
  handedness: 'right' | 'left',
  sourceHandedness: 'right' | 'left' = 'right'
): { x: number; y: number; scaleX: number } {
  // Library sets contain both native right- and left-handed photos. Flip only
  // when the requested hand differs from the orientation in the source art.
  const scaleX = handedness === sourceHandedness ? scale : -scale
  return {
    x: tip.x - anchor.x * scaleX,
    y: tip.y - anchor.y * scale,
    scaleX
  }
}

const DRAW_STYLES: EntranceType[] = ['handDraw', 'penDraw']

/**
 * The catalog's non-tool poses — "move in hand" and "move in fingers" — are
 * the open gesture photos; every other catalog hand is holding a pen, pencil,
 * crayon or eraser and would read as drawing rather than carrying.
 */
export function isGestureHandName(name: string): boolean {
  return /move[\s-]*in|gesture|open hand/i.test(name)
}

// VideoScribe's stored offsets for these presets are authoring-space
// adjustments, not image-space nib coordinates, and place the visible nib well
// away from the pixels they name. hand-tips-calibrated.json holds the real
// nib, measured from each supplied PNG canvas (the tool tip is the extreme
// horizontal pixel of the sprite above the midline; mirrored art puts it on
// the right, and paintbrush poses use the bristle block instead).
const CALIBRATED_HAND_TIPS = calibratedHandTips as unknown as
  Record<string, { tip: [number, number]; tip2: [number, number] }>

// The pencil preset and the library's “Rosie pencil” entry show the same photo,
// so both read its nib from the shared table. A private copy here drifted from
// the calibrated pose and made the pencil draw from the wrong point.
const PENCIL_HAND_TIP: { tip: [number, number]; tip2: [number, number] } =
  CALIBRATED_HAND_TIPS['4818'] ?? { tip: [0.0711, 0.0796], tip2: [0.0726, 0.0796] }

const TOOL_PRESETS: InstrumentDefinition[] = [
  {
    id: 'tool-eraser-hand', name: 'Eraser hand', kind: 'hand',
    description: 'Photographic hand holding the supplied eraser; uses its two provided frames.',
    tip: { x: 0.099, y: 0.162 }, tip2: { x: 0.099, y: 0.163 },
    heightFactor: 0.31, aspect: 0.875, handRotation: 0, scaleRelativeToStageWidth: 0.4,
    rotationOffset: -43,
    assetPath: 'hand-and-pen-tools/default-erase-1.png', assetPath2: 'hand-and-pen-tools/default-erase-2.png',
    group: 'Supplied tool hands · Eraser', supportedStyles: DRAW_STYLES
  },
  {
    id: 'tool-open-hand', name: 'Open gesture hand', kind: 'hand',
    description: 'Photographic open hand from the supplied tool set.',
    tip: { x: 0.43, y: 0.045 }, heightFactor: 0.31, aspect: 581 / 1200,
    handRotation: 0, scaleRelativeToStageWidth: 0.4,
    grip: { x: 0.45, y: 0.31 },
    assetPath: 'hand-and-pen-tools/default-drag.png',
    group: 'Supplied tool hands · Gestures', supportedStyles: DRAW_STYLES
  },
  {
    id: 'tool-marker-frames', name: 'Classic marker', kind: 'pen',
    description: 'Supplied marker with two drawing frames.',
    tip: { x: 0.0254, y: 0.0603 }, tip2: { x: 0.0127, y: 0.0259 },
    heightFactor: 0.15, aspect: 473 / 232, handRotation: 0, scaleRelativeToStageWidth: 0.4,
    assetPath: 'hand-and-pen-tools/default-pen-1.png', assetPath2: 'hand-and-pen-tools/default-pen-2.png',
    group: 'Supplied tools · Pens', supportedStyles: DRAW_STYLES
  },
  {
    id: 'tool-marker', name: 'Whiteboard pen', kind: 'pen',
    description: 'Supplied standalone whiteboard pen.',
    tip: { x: 0.0375, y: 0.0506 }, heightFactor: 0.15, aspect: 160 / 79,
    handRotation: 0, scaleRelativeToStageWidth: 0.4, assetPath: 'hand-and-pen-tools/default-pen.png',
    group: 'Supplied tools · Pens', supportedStyles: DRAW_STYLES
  }
]

export const INSTRUMENTS: InstrumentDefinition[] = [
  {
    id: 'hand-classic',
    name: 'Marker hand',
    kind: 'hand',
    description: 'A real photographed hand holding a dry-erase marker.',
    // Measured from the Rosie sprite canvases: the graphite/marker nib is the
    // leftmost opaque pixel at (34, 139) and (35, 139) of an 829x1200 frame.
    tip: { x: 0.041, y: 0.1158 },
    tip2: { x: 0.0422, y: 0.1158 },
    heightFactor: 0.33,
    aspect: 829 / 1200,
    handRotation: 0,
    scaleRelativeToStageWidth: 0.4,
    cuffEdgeY: 81,
    tool: 'marker',
    assetPath: 'hands/Rosie1.png',
    assetPath2: 'hands/Rosie2.png',
    supportedStyles: DRAW_STYLES
  },
  {
    id: 'hand-pencil',
    name: 'Pencil hand',
    kind: 'hand',
    description: 'A real photographed hand holding a pencil.',
    tip: { x: PENCIL_HAND_TIP.tip[0], y: PENCIL_HAND_TIP.tip[1] },
    tip2: { x: PENCIL_HAND_TIP.tip2[0], y: PENCIL_HAND_TIP.tip2[1] },
    heightFactor: 0.33,
    aspect: 0.5391666666666667,
    handRotation: 0,
    scaleRelativeToStageWidth: 0.4,
    cuffEdgeY: 81,
    tool: 'pencil',
    assetPath: 'hands/rosie/4818-rosie-pencil_hand1.png',
    assetPath2: 'hands/rosie/4818-rosie-pencil_hand2.png',
    supportedStyles: DRAW_STYLES
  },
  ...handLibrary.map((hand) => {
    const isPen = hand.group === 'pens'
    const isGesture = isGestureHandName(hand.name)
    const calibratedTip = CALIBRATED_HAND_TIPS[String(hand.id)]
    // Preserve these native left-hand photo sets even when loading a project
    // whose generated catalog predates the per-pose source-orientation fields.
    const nativeLeftHandSet = ['daniel', 'jacob', 'mike'].includes(hand.group.toLowerCase())
    const sourceHandedness = hand.sourceHandedness ?? (nativeLeftHandSet ? 'left' : 'right')
    const sourceHandedness2 = hand.sourceHandedness2 ?? (nativeLeftHandSet ? 'left' : 'right')
    return {
      id: `hand-library-${hand.id}`,
      name: hand.name,
      kind: isPen ? 'pen' as const : 'hand' as const,
      description: `${hand.name} · ${hand.group} preset`,
      tip: calibratedTip ? { x: calibratedTip.tip[0], y: calibratedTip.tip[1] } : { x: hand.tipX, y: hand.tipY },
      tip2: calibratedTip ? { x: calibratedTip.tip2[0], y: calibratedTip.tip2[1] } : { x: hand.tip2X, y: hand.tip2Y },
      // Gesture photos have no measured palm, so they share a rough centre.
      grip: isGesture ? { x: 0.5, y: 0.28 } : undefined,
      heightFactor: isPen ? 0.15 : 0.31,
      aspect: hand.aspect,
      handRotation: 0 as const,
      scaleRelativeToStageWidth: 0.4,
      cuffEdgeY: isPen ? undefined : 81,
      rotationOffset: isPen ? 0 : -43,
      tool: isPen ? undefined : 'pencil' as const,
      assetPath: hand.hand1.replace(/^open-assets\//, ''),
      assetPath2: hand.hand2?.replace(/^open-assets\//, ''),
      thumbnail: hand.thumbnail?.replace(/^open-assets\//, ''),
      sourceHandedness: sourceHandedness as 'right' | 'left',
      sourceHandedness2: sourceHandedness2 as 'right' | 'left',
      group: hand.group,
      supportedStyles: DRAW_STYLES
    }
  }),
  ...TOOL_PRESETS
]

export const DEFAULT_INSTRUMENT_ID = 'hand-classic'

/** The supplied hand-with-eraser pose, used whenever no eraser is chosen yet. */
export const DEFAULT_ERASER_INSTRUMENT_ID = 'tool-eraser-hand'

export function getInstrument(id: string | null | undefined): InstrumentDefinition {
  return INSTRUMENTS.find((instrument) => instrument.id === id) ?? INSTRUMENTS[0]!
}

export function getEraserInstrument(id: string | null | undefined): InstrumentDefinition {
  return INSTRUMENTS.find((instrument) => instrument.id === id) ?? getInstrument(DEFAULT_ERASER_INSTRUMENT_ID)
}

/**
 * Which hand the artwork actually is. The erase exit travels with it — a left
 * hand clears left-to-right — so the photo is never mirrored for that choice.
 */
export function instrumentHandedness(instrument: InstrumentDefinition): 'right' | 'left' {
  return instrument.sourceHandedness ?? 'right'
}

/**
 * Hands that clean the board instead of marking it. The catalog is generated,
 * so the naming is the only usage signal it carries — every eraser and wiper
 * pose in it is named for the tool it holds.
 */
export function isEraserInstrument(instrument: InstrumentDefinition): boolean {
  return /eras|wip/i.test(`${instrument.name} ${instrument.group ?? ''}`)
}

/** The subset offered by the eraser picker. */
export const ERASER_INSTRUMENTS: InstrumentDefinition[] = INSTRUMENTS.filter(isEraserInstrument)

/** The open hand used by the drag-in entrance when no other pose is chosen. */
export const DEFAULT_DRAG_INSTRUMENT_ID = 'tool-open-hand'

/**
 * Hands that can carry an element in. Erasers are excluded — board cleaning has
 * its own exit effect — and so are the pen/pencil grips: a hand holding a
 * marker would look like it is about to draw, not deliver the artwork. Only
 * open gesture poses remain.
 */
export function isDragInstrument(instrument: InstrumentDefinition): boolean {
  if (instrument.kind !== 'hand') return false
  if (isEraserInstrument(instrument)) return false
  return instrument.id === DEFAULT_DRAG_INSTRUMENT_ID || isGestureHandName(instrument.name)
}

export const DRAG_INSTRUMENTS: InstrumentDefinition[] = INSTRUMENTS.filter(isDragInstrument).sort(
  (a, b) => {
    if (a.id === DEFAULT_DRAG_INSTRUMENT_ID) return -1
    if (b.id === DEFAULT_DRAG_INSTRUMENT_ID) return 1
    return 0
  }
)

export function getDragInstrument(id: string | null | undefined): InstrumentDefinition {
  return (
    DRAG_INSTRUMENTS.find((instrument) => instrument.id === id) ??
    DRAG_INSTRUMENTS.find((instrument) => instrument.id === DEFAULT_DRAG_INSTRUMENT_ID) ??
    INSTRUMENTS[0]!
  )
}

export function instrumentForStyle(style: EntranceType, requestedId: string | null): InstrumentDefinition {
  if (style === 'handDrag') return getDragInstrument(requestedId)
  const requested = INSTRUMENTS.find((instrument) => instrument.id === requestedId)
  if (requested && requested.supportedStyles.includes(style)) return requested
  if (style === 'penDraw') return getInstrument('tool-marker')
  return INSTRUMENTS[0]!
}
