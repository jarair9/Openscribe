import { z } from 'zod'
import { ColorSchema, DirectionSchema, EasingSchema, RectSchema, Vec2Schema } from './primitives'

export const SCHEMA_VERSION = 1

/* ------------------------------------------------------------------ */
/* Animation                                                          */
/* ------------------------------------------------------------------ */

export const EntranceTypeSchema = z.enum([
  'none',
  'draw',
  'handDraw',
  'penDraw',
  'fadeIn',
  'moveIn',
  'popIn',
  'reveal'
])
export type EntranceType = z.infer<typeof EntranceTypeSchema>

export const EmphasisTypeSchema = z.enum(['none', 'pulse', 'bounce', 'shake', 'spin', 'zoom'])
export type EmphasisType = z.infer<typeof EmphasisTypeSchema>

export const ExitTypeSchema = z.enum(['none', 'fadeOut', 'moveOut', 'scaleOut', 'erase'])
export type ExitType = z.infer<typeof ExitTypeSchema>

export const EntranceSchema = z.object({
  type: EntranceTypeSchema,
  duration: z.number().min(0).max(600),
  easing: EasingSchema,
  direction: DirectionSchema,
  /** Instrument used by handDraw / penDraw. */
  instrumentId: z.string().nullable(),
  /** Mirror the fixed-angle hand art when drawing left-handed. */
  handedness: z.enum(['right', 'left']).default('right')
})
export type Entrance = z.infer<typeof EntranceSchema>

export const EmphasisSchema = z.object({
  type: EmphasisTypeSchema,
  /** Duration of a single loop, in seconds. */
  duration: z.number().min(0).max(600),
  loops: z.number().int().min(1).max(50),
  intensity: z.number().min(0).max(3),
  delay: z.number().min(0).max(600)
})
export type Emphasis = z.infer<typeof EmphasisSchema>

export const ExitSchema = z.object({
  type: ExitTypeSchema,
  duration: z.number().min(0).max(600),
  easing: EasingSchema,
  direction: DirectionSchema,
  delay: z.number().min(0).max(600),
  /** Eraser used by the erase exit. Its native handedness sets the travel direction. */
  instrumentId: z.string().nullable().default(null)
})
export type Exit = z.infer<typeof ExitSchema>

export const AnimationSchema = z.object({
  entrance: EntranceSchema,
  emphasis: EmphasisSchema,
  exit: ExitSchema,
  /** Idle time inserted before the next auto-scheduled element. */
  pauseAfter: z.number().min(0).max(600)
})
export type Animation = z.infer<typeof AnimationSchema>

export const TimingSchema = z.object({
  mode: z.enum(['auto', 'manual']),
  /** Scene-relative start in seconds. Only used when mode is "manual". */
  start: z.number().min(0).max(86_400)
})
export type Timing = z.infer<typeof TimingSchema>

/* ------------------------------------------------------------------ */
/* Assets                                                             */
/* ------------------------------------------------------------------ */

export const AssetKindSchema = z.enum(['svg', 'image', 'audio'])
export type AssetKindName = z.infer<typeof AssetKindSchema>

export const DrawableSchema = z.object({
  id: z.string(),
  /** Absolute path data in the asset's viewBox coordinate space. */
  d: z.string(),
  fill: ColorSchema.nullable(),
  fillOpacity: z.number().min(0).max(1),
  fillRule: z.enum(['nonzero', 'evenodd']),
  stroke: ColorSchema.nullable(),
  strokeWidth: z.number().min(0),
  strokeOpacity: z.number().min(0).max(1),
  lineCap: z.enum(['butt', 'round', 'square']),
  lineJoin: z.enum(['miter', 'round', 'bevel']),
  opacity: z.number().min(0).max(1),
  /** Approximate geometric length used for drawing-time distribution. */
  length: z.number().min(0),
  /** Relative share of the element's entrance duration. */
  weight: z.number().min(0),
  bbox: RectSchema
})
export type Drawable = z.infer<typeof DrawableSchema>

export const SvgAssetDataSchema = z.object({
  /** viewBox expressed as a rect; x/y are usually 0. */
  viewBox: RectSchema,
  drawables: z.array(DrawableSchema).min(1),
  /** Non-fatal import notes, e.g. dropped filters or external references. */
  warnings: z.array(z.string())
})
export type SvgAssetData = z.infer<typeof SvgAssetDataSchema>

export const ImageAssetDataSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive()
})
export type ImageAssetData = z.infer<typeof ImageAssetDataSchema>

export const AudioAssetDataSchema = z.object({
  duration: z.number().min(0),
  sampleRate: z.number().int().positive()
})
export type AudioAssetData = z.infer<typeof AudioAssetDataSchema>

export const AssetSchema = z.object({
  id: z.string(),
  kind: AssetKindSchema,
  name: z.string(),
  /** Stored file name inside the project's assets directory. */
  fileName: z.string(),
  mimeType: z.string(),
  byteSize: z.number().int().min(0),
  contentHash: z.string(),
  createdAt: z.string(),
  svg: SvgAssetDataSchema.nullable(),
  image: ImageAssetDataSchema.nullable(),
  audio: AudioAssetDataSchema.nullable(),
  tags: z.array(z.string()),
  favorite: z.boolean()
})
export type Asset = z.infer<typeof AssetSchema>

/* ------------------------------------------------------------------ */
/* Elements                                                           */
/* ------------------------------------------------------------------ */

export const ElementTypeSchema = z.enum(['svg', 'image', 'text', 'shape'])
export type ElementType = z.infer<typeof ElementTypeSchema>

const ElementBaseSchema = z.object({
  id: z.string(),
  kind: ElementTypeSchema,
  name: z.string(),
  /** Axis-aligned frame in world coordinates, before rotation. */
  frame: RectSchema,
  /** Rotation around the frame center, in degrees. */
  rotation: z.number().min(-360_000).max(360_000),
  opacity: z.number().min(0).max(1),
  visible: z.boolean(),
  locked: z.boolean(),
  animation: AnimationSchema,
  timing: TimingSchema
})

export const SvgElementSchema = ElementBaseSchema.extend({
  kind: z.literal('svg'),
  assetId: z.string(),
  /** Explicit drawable order override; null uses the asset order. */
  drawOrder: z.array(z.string()).nullable()
})
export type SvgElement = z.infer<typeof SvgElementSchema>

export const ImageElementSchema = ElementBaseSchema.extend({
  kind: z.literal('image'),
  assetId: z.string()
})
export type ImageElement = z.infer<typeof ImageElementSchema>

export const TextElementSchema = ElementBaseSchema.extend({
  kind: z.literal('text'),
  text: z.string().max(20_000),
  /**
   * Legacy switch kept for older documents. Text is always animated with the
   * bundled pen strokes; uncovered characters fall back to a wipe reveal.
   */
  writingMode: z.enum(['strokeScript', 'fontReveal']).default('strokeScript'),
  /** Bundled stroke font used by strokeScript; null uses the default. */
  strokeFontId: z.string().nullable().default(null),
  /** Reveals glyphs from the right edge toward the left for RTL writing. */
  writeBackwards: z.boolean().default(false),
  fontFamily: z.string(),
  fontSize: z.number().positive(),
  fontWeight: z.number().int().min(100).max(900),
  italic: z.boolean(),
  align: z.enum(['left', 'center', 'right']),
  lineHeight: z.number().min(0.5).max(4),
  letterSpacing: z.number().min(-20).max(100),
  color: ColorSchema
})
export type TextElement = z.infer<typeof TextElementSchema>

export const ShapeKindSchema = z.enum([
  'rectangle',
  'roundedRectangle',
  'ellipse',
  'triangle',
  'line',
  'arrow'
])
export type ShapeKind = z.infer<typeof ShapeKindSchema>

export const ShapeElementSchema = ElementBaseSchema.extend({
  kind: z.literal('shape'),
  shape: ShapeKindSchema,
  fill: ColorSchema.nullable(),
  stroke: ColorSchema.nullable(),
  strokeWidth: z.number().min(0),
  cornerRadius: z.number().min(0)
})
export type ShapeElement = z.infer<typeof ShapeElementSchema>

export const ElementSchema = z.discriminatedUnion('kind', [
  SvgElementSchema,
  ImageElementSchema,
  TextElementSchema,
  ShapeElementSchema
])
export type Element = z.infer<typeof ElementSchema>

/* ------------------------------------------------------------------ */
/* Background, camera, audio, scene                                   */
/* ------------------------------------------------------------------ */

export const BackgroundSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('solid'), color: ColorSchema }),
  z.object({
    type: z.literal('gradient'),
    from: ColorSchema,
    to: ColorSchema,
    angle: z.number()
  }),
  z.object({
    type: z.literal('image'),
    assetId: z.string(),
    fit: z.enum(['cover', 'contain'])
  })
])
export type Background = z.infer<typeof BackgroundSchema>

export const CameraSchema = z.object({
  id: z.string(),
  name: z.string(),
  center: Vec2Schema,
  /** World-space width of the visible frame. Height derives from output ratio. */
  viewWidth: z.number().positive(),
  transition: z.object({
    duration: z.number().min(0).max(60),
    easing: EasingSchema
  }),
  /** Scene-relative time at which this camera becomes active. */
  startTime: z.number().min(0)
})
export type Camera = z.infer<typeof CameraSchema>

export const AudioTrackSchema = z.object({
  id: z.string(),
  name: z.string(),
  assetId: z.string(),
  startTime: z.number().min(0),
  inPoint: z.number().min(0),
  outPoint: z.number().min(0).nullable(),
  volume: z.number().min(0).max(2),
  fadeIn: z.number().min(0),
  fadeOut: z.number().min(0)
})
export type AudioTrack = z.infer<typeof AudioTrackSchema>

export const SceneTransitionSchema = z.object({
  type: z.enum(['none', 'fade']),
  duration: z.number().min(0).max(10)
})
export type SceneTransition = z.infer<typeof SceneTransitionSchema>

export const SceneSchema = z.object({
  id: z.string(),
  name: z.string(),
  background: BackgroundSchema,
  elements: z.array(ElementSchema),
  cameras: z.array(CameraSchema).min(1),
  audio: z.array(AudioTrackSchema),
  transition: SceneTransitionSchema,
  /** Extra resting time appended to the scene's computed duration. */
  holdAfter: z.number().min(0).max(600)
})
export type Scene = z.infer<typeof SceneSchema>

/* ------------------------------------------------------------------ */
/* Project                                                            */
/* ------------------------------------------------------------------ */

export const OutputSettingsSchema = z.object({
  width: z.number().int().min(16).max(7680),
  height: z.number().int().min(16).max(7680),
  fps: z.number().int().min(1).max(120)
})
export type OutputSettings = z.infer<typeof OutputSettingsSchema>

export const ProjectSettingsSchema = z.object({
  defaultAnimation: AnimationSchema,
  defaultInstrumentId: z.string()
})
export type ProjectSettings = z.infer<typeof ProjectSettingsSchema>

export const ProjectSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: z.string(),
  name: z.string().min(1).max(200),
  createdAt: z.string(),
  updatedAt: z.string(),
  output: OutputSettingsSchema,
  settings: ProjectSettingsSchema,
  assets: z.array(AssetSchema),
  scenes: z.array(SceneSchema).min(1),
  audio: z.array(AudioTrackSchema)
})
export type Project = z.infer<typeof ProjectSchema>

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

export interface ParseProjectResult {
  ok: boolean
  project: Project | null
  error: string | null
}

export function parseProject(input: unknown): ParseProjectResult {
  const result = ProjectSchema.safeParse(input)
  if (result.success) return { ok: true, project: result.data, error: null }
  const first = result.error.issues[0]
  const path = first?.path.join('.') ?? ''
  const message = first ? `${path ? `${path}: ` : ''}${first.message}` : 'Invalid project document'
  return { ok: false, project: null, error: message }
}

export type AnyElement = SvgElement | ImageElement | TextElement | ShapeElement
