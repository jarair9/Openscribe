import {
  isBundledStrokeFont,
  STROKE_FONTS,
  uniqueStrokeFontId,
  type StrokeFontBundle,
  type StrokeFontGlyph
} from './strokeFont'

export interface StrokeFontFileInput {
  name: string
  text: string
}

interface BundleMetadata {
  family: string
  fullFamily?: string
  unitsPerEm: number
  ascender: number
  descender: number
  lineCap: StrokeFontBundle['lineCap']
}

/**
 * Import a stroke font exported by Tegaki. Accepts either the app's stroke-font
 * JSON or the two files from a Tegaki bundle folder (`bundle.ts` and
 * `glyphData.json`).
 */
export function parseStrokeFontFiles(files: StrokeFontFileInput[]): StrokeFontBundle {
  if (files.length === 0) throw new Error('Select a font bundle first.')

  const glyphFile = files.find((file) => /(^|[/\\])glyphData\.json$/i.test(file.name))
  if (glyphFile) {
    const bundleFile = files.find((file) => /(^|[/\\])bundle\.ts$/i.test(file.name))
    if (!bundleFile) {
      throw new Error(
        'Select bundle.ts together with glyphData.json. Unzip the Tegaki bundle and pick both files.'
      )
    }
    const metadata = parseBundleMetadata(bundleFile.text)
    const glyphs = parseJson(glyphFile.text, glyphFile.name)
    if (!isRecord(glyphs)) throw new Error('glyphData.json is not a glyph table.')
    validateGlyphs(glyphs)
    const family = metadata.fullFamily ?? metadata.family
    return {
      id: resolveFontId(family),
      family,
      unitsPerEm: metadata.unitsPerEm,
      ascender: metadata.ascender,
      descender: metadata.descender,
      lineCap: metadata.lineCap,
      glyphs: glyphs as Record<string, StrokeFontGlyph>
    }
  }

  const jsonFile = files.find((file) => file.name.toLowerCase().endsWith('.json'))
  if (!jsonFile) {
    throw new Error('Expected a stroke-font .json file, or a Tegaki bundle with bundle.ts and glyphData.json.')
  }
  return normalizeBundle(parseJson(jsonFile.text, jsonFile.name))
}

function normalizeBundle(raw: unknown): StrokeFontBundle {
  if (!isRecord(raw)) throw new Error('This file is not a stroke font bundle.')
  const glyphs = raw.glyphs
  if (!isRecord(glyphs)) throw new Error('The bundle has no glyph data.')
  validateGlyphs(glyphs)

  const family =
    typeof raw.family === 'string' && raw.family.trim() ? raw.family.trim() : 'Custom handwriting'
  const requestedId = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : ''
  return {
    id: requestedId && !isBundledStrokeFont(requestedId) ? requestedId : resolveFontId(family),
    family,
    unitsPerEm: positiveNumber(raw.unitsPerEm, 1000),
    ascender: finiteNumber(raw.ascender, 960),
    descender: finiteNumber(raw.descender, -300),
    lineCap:
      raw.lineCap === 'butt' || raw.lineCap === 'square' || raw.lineCap === 'round'
        ? raw.lineCap
        : 'round',
    glyphs: glyphs as Record<string, StrokeFontGlyph>
  }
}

function validateGlyphs(glyphs: Record<string, unknown>): void {
  let inspected = 0
  for (const [character, value] of Object.entries(glyphs)) {
    if (!isRecord(value)) throw new Error(`Glyph “${character}” is malformed.`)
    if (typeof value.w !== 'number' || typeof value.t !== 'number' || !Array.isArray(value.s)) {
      throw new Error(`Glyph “${character}” is missing its advance or strokes.`)
    }
    for (const stroke of value.s as unknown[]) {
      if (!isRecord(stroke) || !Array.isArray(stroke.p) || stroke.p.length === 0) {
        throw new Error(`Glyph “${character}” has a malformed stroke.`)
      }
      for (const point of stroke.p as unknown[]) {
        if (!Array.isArray(point) || point.length < 2) {
          throw new Error(`Glyph “${character}” has a malformed point.`)
        }
      }
    }
    inspected += 1
    if (inspected >= 2000) break
  }
  if (inspected === 0) throw new Error('The bundle contains no glyphs.')
}

function parseBundleMetadata(source: string): BundleMetadata {
  const number = (field: string): number => {
    const match = source.match(new RegExp(`${field}:\\s*(-?[\\d.]+)`))
    if (!match) throw new Error(`bundle.ts is missing ${field}.`)
    return Number(match[1])
  }
  const text = (field: string): string | undefined => {
    const match = source.match(new RegExp(`${field}:\\s*['"]([^'"]+)['"]`))
    return match?.[1]
  }
  const family = text('family')
  const fullFamily = text('fullFamily')
  if (!family && !fullFamily) throw new Error('bundle.ts is missing the font family name.')
  const lineCap = text('lineCap')
  return {
    family: family ?? fullFamily!,
    fullFamily,
    unitsPerEm: number('unitsPerEm'),
    ascender: number('ascender'),
    descender: number('descender'),
    lineCap: lineCap === 'butt' || lineCap === 'square' ? lineCap : 'round'
  }
}

function resolveFontId(family: string): string {
  const existing = STROKE_FONTS.find(
    (font) => font.family.toLowerCase() === family.toLowerCase()
  )
  if (existing && !isBundledStrokeFont(existing.id)) return existing.id
  return uniqueStrokeFontId(slugify(family))
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function parseJson(text: string, name: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`${name} is not valid JSON.`)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function positiveNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
