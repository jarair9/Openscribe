import { createId, nowIso } from '../ids'
import { rectFromCenter } from '../geometry'
import { DEFAULT_ERASER_INSTRUMENT_ID, DEFAULT_INSTRUMENT_ID } from '../instruments'
import type { Rect, Vec2 } from './primitives'
import {
  SCHEMA_VERSION,
  type Animation,
  type Asset,
  type AudioAssetData,
  type Camera,
  type ImageAssetData,
  type ImageElement,
  type OutputSettings,
  type Project,
  type Scene,
  type ShapeElement,
  type ShapeKind,
  type SvgAssetData,
  type SvgElement,
  type TextElement,
  type EntranceType,
  type Background,
  type AssetKindName
} from './project'

/* ------------------------------------------------------------------ */
/* Output presets                                                     */
/* ------------------------------------------------------------------ */

export type AspectPreset = '16:9' | '1:1' | '9:16'

export interface OutputPreset {
  id: AspectPreset
  label: string
  width: number
  height: number
}

export const OUTPUT_PRESETS: OutputPreset[] = [
  { id: '16:9', label: 'Landscape 16:9', width: 1920, height: 1080 },
  { id: '1:1', label: 'Square 1:1', width: 1080, height: 1080 },
  { id: '9:16', label: 'Portrait 9:16', width: 1080, height: 1920 }
]

export const OUTPUT_RESOLUTIONS = [
  { label: '720p', width: 1280, height: 720 },
  { label: '1080p', width: 1920, height: 1080 },
  { label: '1440p', width: 2560, height: 1440 },
  { label: '4K', width: 3840, height: 2160 }
]

export function aspectOf(output: OutputSettings): number {
  return output.width / output.height
}

export function aspectPresetOf(output: OutputSettings): AspectPreset | 'custom' {
  const ratio = aspectOf(output)
  if (Math.abs(ratio - 16 / 9) < 0.01) return '16:9'
  if (Math.abs(ratio - 1) < 0.01) return '1:1'
  if (Math.abs(ratio - 9 / 16) < 0.01) return '9:16'
  return 'custom'
}

/* ------------------------------------------------------------------ */
/* Animation defaults                                                 */
/* ------------------------------------------------------------------ */

export interface AnimationOverrides {
  entrance?: Partial<Animation['entrance']>
  emphasis?: Partial<Animation['emphasis']>
  exit?: Partial<Animation['exit']>
  pauseAfter?: number
}

export function createAnimation(overrides: AnimationOverrides = {}): Animation {
  return {
    entrance: {
      type: 'handDraw',
      duration: 2.4,
      easing: 'easeInOut',
      direction: 'right',
      instrumentId: DEFAULT_INSTRUMENT_ID,
      handedness: 'right',
      ...overrides.entrance
    },
    emphasis: {
      type: 'none',
      duration: 0.8,
      loops: 1,
      intensity: 1,
      delay: 0,
      ...overrides.emphasis
    },
    exit: {
      type: 'none',
      duration: 0.6,
      easing: 'easeIn',
      direction: 'down',
      delay: 0,
      instrumentId: DEFAULT_ERASER_INSTRUMENT_ID,
      ...overrides.exit
    },
    pauseAfter: overrides.pauseAfter ?? 0.35
  }
}

const DEFAULT_ENTRANCE_BY_KIND: Record<AssetKindName | 'text' | 'shape', EntranceType> = {
  svg: 'handDraw',
  image: 'handDraw',
  audio: 'fadeIn',
  text: 'handDraw',
  shape: 'handDraw'
}

const DEFAULT_DURATION_BY_ENTRANCE: Record<EntranceType, number> = {
  draw: 2.2,
  handDraw: 2.4,
  penDraw: 2.4,
  fadeIn: 0.8,
  moveIn: 0.8,
  popIn: 0.6,
  reveal: 0.9
}

export function defaultAnimationFor(kind: AssetKindName | 'text' | 'shape'): Animation {
  const type = DEFAULT_ENTRANCE_BY_KIND[kind]
  return createAnimation({
    entrance: {
      type,
      duration: DEFAULT_DURATION_BY_ENTRANCE[type],
      // Raster illustrations have no vector strokes, so use a directional reveal.
      ...(kind === 'image' ? { direction: 'diagonal' as const } : {})
    },
    pauseAfter: 0.35
  })
}

/* ------------------------------------------------------------------ */
/* Assets                                                             */
/* ------------------------------------------------------------------ */

export interface AssetInput {
  name: string
  fileName: string
  mimeType: string
  byteSize: number
  contentHash: string
  svg?: SvgAssetData | null
  image?: ImageAssetData | null
  audio?: AudioAssetData | null
  tags?: string[]
}

export function createAsset(kind: AssetKindName, input: AssetInput): Asset {
  return {
    id: createId(kind === 'image' ? 'img' : kind),
    kind,
    name: input.name,
    fileName: input.fileName,
    mimeType: input.mimeType,
    byteSize: input.byteSize,
    contentHash: input.contentHash,
    createdAt: nowIso(),
    svg: input.svg ?? null,
    image: input.image ?? null,
    audio: input.audio ?? null,
    tags: input.tags ?? [],
    favorite: false
  }
}

/* ------------------------------------------------------------------ */
/* Cameras, scenes, project                                           */
/* ------------------------------------------------------------------ */

export function createCamera(input: {
  center: Vec2
  viewWidth: number
  name?: string
  startTime?: number
}): Camera {
  return {
    id: createId('cam'),
    name: input.name ?? 'Camera',
    center: input.center,
    viewWidth: Math.max(16, input.viewWidth),
    transition: { duration: 1.2, easing: 'easeInOut' },
    startTime: input.startTime ?? 0
  }
}

export function defaultBackground(): Background {
  return { type: 'solid', color: '#ffffff' }
}

export function createScene(output: OutputSettings, index = 0): Scene {
  return {
    id: createId('scene'),
    name: `Scene ${index + 1}`,
    background: defaultBackground(),
    elements: [],
    cameras: [createCamera({ center: { x: 0, y: 0 }, viewWidth: output.width, name: 'Camera 1' })],
    audio: [],
    transition: { type: 'none', duration: 0.5 },
    holdAfter: 0
  }
}

export interface CreateProjectOptions {
  name: string
  width?: number
  height?: number
  fps?: number
}

export function createProject(options: CreateProjectOptions): Project {
  const output: OutputSettings = {
    width: options.width ?? 1920,
    height: options.height ?? 1080,
    fps: options.fps ?? 30
  }
  const timestamp = nowIso()
  return {
    schemaVersion: SCHEMA_VERSION,
    id: createId('project'),
    name: options.name.trim() || 'Untitled project',
    createdAt: timestamp,
    updatedAt: timestamp,
    output,
    settings: {
      defaultAnimation: createAnimation(),
      defaultInstrumentId: DEFAULT_INSTRUMENT_ID
    },
    assets: [],
    scenes: [createScene(output, 0)],
    audio: []
  }
}

/* ------------------------------------------------------------------ */
/* Elements                                                           */
/* ------------------------------------------------------------------ */

export interface ElementOptions {
  name?: string
  animation?: Animation
  frame: Rect
}

function baseElementProps(options: ElementOptions) {
  return {
    id: createId('el'),
    name: options.name ?? 'Element',
    frame: options.frame,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    animation: options.animation ?? createAnimation(),
    timing: { mode: 'auto' as const, start: 0 }
  }
}

export function createSvgElement(
  asset: Asset,
  options: ElementOptions
): SvgElement {
  return {
    ...baseElementProps({
      ...options,
      animation: options.animation ?? defaultAnimationFor('svg')
    }),
    kind: 'svg',
    assetId: asset.id,
    drawOrder: null
  }
}

export function createImageElement(
  asset: Asset,
  options: ElementOptions
): ImageElement {
  return {
    ...baseElementProps({
      ...options,
      animation: options.animation ?? defaultAnimationFor('image')
    }),
    kind: 'image',
    assetId: asset.id
  }
}

export function createTextElement(text: string, options: ElementOptions): TextElement {
  return {
    ...baseElementProps({
      ...options,
      animation: options.animation ?? defaultAnimationFor('text')
    }),
    kind: 'text',
    text,
    writingMode: 'strokeScript',
    strokeFontId: 'polan-stronk',
    writeBackwards: false,
    fontFamily: 'Polan Stronk',
    fontSize: 96,
    fontWeight: 600,
    italic: false,
    align: 'left',
    lineHeight: 1.2,
    letterSpacing: 0,
    color: '#16181d'
  }
}

export function createShapeElement(shape: ShapeKind, options: ElementOptions): ShapeElement {
  const filled = shape !== 'line' && shape !== 'arrow'
  return {
    ...baseElementProps({
      ...options,
      animation: options.animation ?? defaultAnimationFor('shape')
    }),
    kind: 'shape',
    shape,
    fill: filled ? '#ffffff' : null,
    stroke: '#16181d',
    strokeWidth: shape === 'line' || shape === 'arrow' ? 6 : 4,
    cornerRadius: shape === 'roundedRectangle' ? 24 : 0
  }
}

/** Fit a natural asset size into the camera view, centered. */
export function frameFittedToCamera(
  camera: Camera,
  output: OutputSettings,
  contentWidth: number,
  contentHeight: number,
  fraction = 0.45
): Rect {
  const viewHeight = (camera.viewWidth * output.height) / output.width
  const maxWidth = camera.viewWidth * fraction
  const maxHeight = viewHeight * fraction
  const scale = Math.min(maxWidth / contentWidth, maxHeight / contentHeight, 4)
  const width = Math.max(16, contentWidth * scale)
  const height = Math.max(16, contentHeight * scale)
  return rectFromCenter(camera.center, width, height)
}

export function nextElementName(elements: Array<{ name: string }>, base: string): string {
  let index = 1
  const existing = new Set(elements.map((element) => element.name))
  while (existing.has(`${base} ${index}`)) index += 1
  return `${base} ${index}`
}
