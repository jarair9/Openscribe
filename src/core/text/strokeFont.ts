import { BUNDLED_STROKE_FONTS } from '@fonts'
import type { TextElement } from '../schema/project'

/** [x, y, penWidth] in font units. y grows downward from the baseline. */
export type StrokeFontPoint = [number, number, number]

export interface StrokeFontStroke {
  p: StrokeFontPoint[]
  /** Delay from the glyph start, in seconds at the bundled writing speed. */
  d: number
  /** Natural drawing duration in seconds. */
  a: number
  r?: number
  n?: number[][]
}

export interface StrokeFontGlyph {
  /** Advance width in font units. */
  w: number
  /** Bundled natural writing time in seconds. */
  t: number
  s: StrokeFontStroke[]
}

export interface StrokeFontBundle {
  id: string
  family: string
  unitsPerEm: number
  ascender: number
  descender: number
  lineCap: 'round' | 'butt' | 'square'
  glyphs: Record<string, StrokeFontGlyph>
}

const bundledIds = new Set(BUNDLED_STROKE_FONTS.map((font) => font.id))

/** Bundled fonts first, then fonts the user imported at runtime. */
export const STROKE_FONTS: StrokeFontBundle[] = [...BUNDLED_STROKE_FONTS]

/** The first entry of the bundled list, so the manifest owns the default face. */
export const DEFAULT_STROKE_FONT_ID = BUNDLED_STROKE_FONTS[0]!.id

export function getStrokeFont(id: string | null | undefined): StrokeFontBundle | null {
  if (!id) return null
  return STROKE_FONTS.find((font) => font.id === id) ?? null
}

export function isBundledStrokeFont(id: string): boolean {
  return bundledIds.has(id)
}

export function uniqueStrokeFontId(base: string): string {
  const slug = base || 'custom-font'
  if (!STROKE_FONTS.some((font) => font.id === slug)) return slug
  let suffix = 2
  while (STROKE_FONTS.some((font) => font.id === `${slug}-${suffix}`)) suffix += 1
  return `${slug}-${suffix}`
}

/** Register (or replace) a user-imported stroke font for this session. */
export function registerStrokeFont(font: StrokeFontBundle): void {
  const index = STROKE_FONTS.findIndex((candidate) => candidate.id === font.id)
  if (index >= 0) STROKE_FONTS[index] = font
  else STROKE_FONTS.push(font)
  resolutionCache = new WeakMap()
}

/** Remove a user-imported font. Bundled fonts cannot be removed. */
export function unregisterStrokeFont(id: string): void {
  if (bundledIds.has(id)) return
  const index = STROKE_FONTS.findIndex((font) => font.id === id)
  if (index >= 0) STROKE_FONTS.splice(index, 1)
  resolutionCache = new WeakMap()
}

/** Whitespace carries no bundled glyph in the generated bundle. */
export const SPACE_ADVANCE_RATIO = 0.42

export function glyphAdvance(font: StrokeFontBundle, character: string): number {
  const glyph = font.glyphs[character]
  if (glyph) return glyph.w
  return /\s/u.test(character) ? font.unitsPerEm * SPACE_ADVANCE_RATIO : 0
}

interface FontResolution {
  key: string
  font: StrokeFontBundle | null
}

let resolutionCache = new WeakMap<TextElement, FontResolution>()

function isDrawable(glyph: StrokeFontGlyph | undefined): glyph is StrokeFontGlyph {
  return Boolean(glyph && glyph.s.length > 0)
}

function charactersNeeded(text: string): string[] {
  return [...new Set(Array.from(text).filter((c) => c !== '\n' && !/\s/u.test(c)))]
}

function covers(font: StrokeFontBundle | null, text: string): font is StrokeFontBundle {
  if (!font) return false
  return charactersNeeded(text).every((character) => isDrawable(font.glyphs[character]))
}

/** The first bundled face that can draw this character, if any. */
function donorGlyph(character: string): { font: StrokeFontBundle; glyph: StrokeFontGlyph } | null {
  for (const font of STROKE_FONTS) {
    const glyph = font.glyphs[character]
    if (isDrawable(glyph)) return { font, glyph }
  }
  return null
}

/** Put a borrowed glyph in the borrower's units so one scale still fits both. */
function rescaleGlyph(glyph: StrokeFontGlyph, ratio: number): StrokeFontGlyph {
  if (ratio === 1) return glyph
  return {
    w: glyph.w * ratio,
    t: glyph.t,
    s: glyph.s.map((stroke) => ({
      ...stroke,
      p: stroke.p.map(([x, y, width]) => [x * ratio, y * ratio, width * ratio] as StrokeFontPoint)
    }))
  }
}

/**
 * The chosen face, with any character it cannot draw borrowed from another
 * bundled font. Borrowing one glyph keeps the handwriting of the rest of the
 * text in the font the user picked; swapping the whole face would silently
 * ignore that pick (an ellipsis in a preset did exactly that).
 */
function fillGaps(font: StrokeFontBundle, text: string): StrokeFontBundle {
  let glyphs: Record<string, StrokeFontGlyph> | null = null
  for (const character of charactersNeeded(text)) {
    if (isDrawable(font.glyphs[character])) continue
    const donor = donorGlyph(character)
    if (!donor) continue
    glyphs ??= { ...font.glyphs }
    glyphs[character] = rescaleGlyph(donor.glyph, font.unitsPerEm / donor.font.unitsPerEm)
  }
  return glyphs ? { ...font, glyphs } : font
}

/**
 * The stroke font that draws this text. The requested font always wins; glyphs
 * outside its coverage are borrowed from another bundled font so the nib still
 * walks the ink. Null only when the requested font is gone and no other face can
 * draw the text at all.
 */
export function strokeFontForElement(element: TextElement): StrokeFontBundle | null {
  const fontId = element.strokeFontId ?? DEFAULT_STROKE_FONT_ID
  const key = `${fontId}|${element.text}`
  const cached = resolutionCache.get(element)
  if (cached?.key === key) return cached.font

  const requested = getStrokeFont(fontId)
  const resolved = requested
    ? fillGaps(requested, element.text)
    : (STROKE_FONTS.find((font) => covers(font, element.text)) ?? null)
  resolutionCache.set(element, { key, font: resolved })
  return resolved
}

/**
 * Characters the text needs that no bundled font can draw. They are left out of
 * the handwriting, so the UI can say so instead of showing absent ink.
 */
export function uncoveredCharacters(element: TextElement): string[] {
  const font = getStrokeFont(element.strokeFontId ?? DEFAULT_STROKE_FONT_ID)
  const needed = charactersNeeded(element.text)
  if (!font) return needed
  const merged = fillGaps(font, element.text)
  return needed.filter((character) => !isDrawable(merged.glyphs[character]))
}
