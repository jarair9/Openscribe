import svgpath from 'svgpath'
import type { Drawable } from '../schema/project'
import type { Rect } from '../schema/primitives'
import { fallbackMeasure, type PathMeasurement } from './measure'
import { IDENTITY, multiply, parseTransform, type Matrix } from './transform'

export class SvgImportError extends Error {}

export interface AnalyzeSvgOptions {
  /** DOM-backed measurement supplied by the renderer for exact lengths. */
  measure?: (d: string) => PathMeasurement
  maxDrawables?: number
}

export interface AnalyzedSvg {
  viewBox: Rect
  drawables: Drawable[]
  warnings: string[]
}

type LineCap = 'butt' | 'round' | 'square'
type LineJoin = 'miter' | 'round' | 'bevel'

interface InheritedStyle {
  fill: string | null
  stroke: string | null
  strokeWidth: number
  fillOpacity: number
  strokeOpacity: number
  fillRule: 'nonzero' | 'evenodd'
  lineCap: LineCap
  lineJoin: LineJoin
  color: string
  visibility: 'visible' | 'hidden'
}

const DEFAULT_STYLE: InheritedStyle = {
  fill: '#000000',
  stroke: null,
  strokeWidth: 1,
  fillOpacity: 1,
  strokeOpacity: 1,
  fillRule: 'nonzero',
  lineCap: 'butt',
  lineJoin: 'miter',
  color: '#000000',
  visibility: 'visible'
}

const SKIP_TAGS = new Set([
  'defs',
  'clippath',
  'mask',
  'symbol',
  'lineargradient',
  'radialgradient',
  'pattern',
  'filter',
  'metadata',
  'title',
  'desc',
  'style',
  'script'
])

const DANGEROUS_TAGS = new Set([
  'script',
  'foreignobject',
  'iframe',
  'object',
  'embed',
  'audio',
  'video',
  'canvas'
])

function tagOf(element: Element): string {
  return element.localName?.toLowerCase() ?? element.tagName.toLowerCase()
}

function parseNumber(value: string | null | undefined): number | null {
  if (!value) return null
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseStyleDeclarations(value: string | null | undefined): Record<string, string> {
  const declarations: Record<string, string> = {}
  if (!value) return declarations
  for (const chunk of value.split(';')) {
    const colon = chunk.indexOf(':')
    if (colon === -1) continue
    const key = chunk.slice(0, colon).trim().toLowerCase()
    const val = chunk.slice(colon + 1).trim()
    if (key && val) declarations[key] = val
  }
  return declarations
}

function collectClassRules(doc: Document): {
  byClass: Map<string, Record<string, string>>
  byTag: Map<string, Record<string, string>>
} {
  const byClass = new Map<string, Record<string, string>>()
  const byTag = new Map<string, Record<string, string>>()
  for (const style of Array.from(doc.getElementsByTagName('style'))) {
    const css = (style.textContent ?? '').replace(/\/\*[\s\S]*?\*\//g, '')
    const rulePattern = /([^{}]+)\{([^}]*)\}/g
    let match: RegExpExecArray | null
    while ((match = rulePattern.exec(css)) !== null) {
      const declarations = parseStyleDeclarations(match[2])
      for (const rawSelector of (match[1] ?? '').split(',')) {
        const selector = rawSelector.trim()
        if (/^\.[\w-]+$/.test(selector)) {
          byClass.set(selector.slice(1), { ...byClass.get(selector.slice(1)), ...declarations })
        } else if (/^[a-zA-Z][\w-]*$/.test(selector)) {
          const tag = selector.toLowerCase()
          byTag.set(tag, { ...byTag.get(tag), ...declarations })
        }
      }
    }
  }
  return { byClass, byTag }
}

function collectGradientColors(doc: Document): Map<string, string> {
  const colors = new Map<string, string>()
  const gradients = Array.from(doc.getElementsByTagName('*')).filter((element) => {
    const tag = tagOf(element)
    return tag === 'lineargradient' || tag === 'radialgradient'
  })
  for (const gradient of gradients) {
    const id = gradient.getAttribute('id')
    if (!id) continue
    const stops = Array.from(gradient.getElementsByTagName('*')).filter(
      (element) => tagOf(element) === 'stop'
    )
    for (const stop of stops) {
      const style = parseStyleDeclarations(stop.getAttribute('style'))
      const color = stop.getAttribute('stop-color') ?? style['stop-color']
      if (color && color !== 'none') {
        colors.set(id, color)
        break
      }
    }
  }
  return colors
}

function elementClassNames(element: Element): string[] {
  return (element.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)
}

interface ResolveContext {
  byClass: Map<string, Record<string, string>>
  byTag: Map<string, Record<string, string>>
  gradients: Map<string, string>
  warnings: Set<string>
}

function propertyValue(
  element: Element,
  prop: string,
  ctx: ResolveContext
): string | null {
  const inline = parseStyleDeclarations(element.getAttribute('style'))
  if (inline[prop] !== undefined) return inline[prop]!
  const classes = elementClassNames(element)
  for (const className of classes) {
    const rule = ctx.byClass.get(className)
    if (rule?.[prop] !== undefined) return rule[prop]!
  }
  const tagRule = ctx.byTag.get(tagOf(element))
  if (tagRule?.[prop] !== undefined) return tagRule[prop]!
  return element.getAttribute(prop)
}

function resolvePaint(
  value: string | null,
  inheritedFallback: string | null,
  ctx: ResolveContext
): string | null {
  if (value === null || value === '') return inheritedFallback
  const trimmed = value.trim()
  if (trimmed === 'none' || trimmed === 'transparent') return null
  if (trimmed === 'currentColor') return inheritedFallback ?? '#000000'
  const urlMatch = /^url\(\s*['"]?#([^'")\s]+)['"]?\s*\)$/.exec(trimmed)
  if (urlMatch) {
    const gradient = ctx.gradients.get(urlMatch[1]!)
    if (gradient) {
      ctx.warnings.add('Gradient paints were replaced with their first stop color.')
      return gradient
    }
    ctx.warnings.add('Unsupported paint server references were replaced with black.')
    return '#000000'
  }
  if (trimmed.startsWith('url(')) {
    ctx.warnings.add('Unsupported paint server references were replaced with black.')
    return '#000000'
  }
  return trimmed
}

function resolveStyle(
  element: Element,
  inherited: InheritedStyle,
  ctx: ResolveContext
): InheritedStyle {
  const fillRaw = propertyValue(element, 'fill', ctx)
  const strokeRaw = propertyValue(element, 'stroke', ctx)
  const strokeWidth = parseNumber(propertyValue(element, 'stroke-width', ctx))
  const fillOpacity = parseNumber(propertyValue(element, 'fill-opacity', ctx))
  const strokeOpacity = parseNumber(propertyValue(element, 'stroke-opacity', ctx))
  const color = propertyValue(element, 'color', ctx)
  const fillRule = propertyValue(element, 'fill-rule', ctx)
  const lineCap = propertyValue(element, 'stroke-linecap', ctx)
  const lineJoin = propertyValue(element, 'stroke-linejoin', ctx)
  const visibility = propertyValue(element, 'visibility', ctx)

  return {
    fill: resolvePaint(fillRaw, inherited.fill, ctx),
    stroke: resolvePaint(strokeRaw, inherited.stroke, ctx),
    strokeWidth: strokeWidth !== null ? Math.max(0, strokeWidth) : inherited.strokeWidth,
    fillOpacity: fillOpacity !== null ? Math.min(1, Math.max(0, fillOpacity)) : inherited.fillOpacity,
    strokeOpacity:
      strokeOpacity !== null ? Math.min(1, Math.max(0, strokeOpacity)) : inherited.strokeOpacity,
    fillRule: fillRule === 'evenodd' ? 'evenodd' : fillRule === 'nonzero' ? 'nonzero' : inherited.fillRule,
    lineCap:
      lineCap === 'round' || lineCap === 'square' || lineCap === 'butt'
        ? (lineCap as LineCap)
        : inherited.lineCap,
    lineJoin:
      lineJoin === 'round' || lineJoin === 'bevel' || lineJoin === 'miter'
        ? (lineJoin as LineJoin)
        : inherited.lineJoin,
    color: color ?? inherited.color,
    visibility: visibility === 'hidden' || visibility === 'collapse' ? 'hidden' : inherited.visibility
  }
}

function pointsToPath(value: string | null, close: boolean): string | null {
  if (!value) return null
  const numbers = (value.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number)
  if (numbers.length < 4) return null
  let path = ''
  for (let index = 0; index + 1 < numbers.length; index += 2) {
    const x = numbers[index]!
    const y = numbers[index + 1]!
    path += `${index === 0 ? 'M' : 'L'}${x} ${y} `
  }
  return close ? `${path}Z` : path.trim()
}

function shapeToPathData(element: Element): string | null {
  const tag = tagOf(element)
  switch (tag) {
    case 'path':
      return element.getAttribute('d')
    case 'rect': {
      const x = parseNumber(element.getAttribute('x')) ?? 0
      const y = parseNumber(element.getAttribute('y')) ?? 0
      const width = parseNumber(element.getAttribute('width')) ?? 0
      const height = parseNumber(element.getAttribute('height')) ?? 0
      if (width <= 0 || height <= 0) return null
      const rx = Math.min(parseNumber(element.getAttribute('rx')) ?? 0, width / 2)
      const ry = Math.min(parseNumber(element.getAttribute('ry')) ?? rx, height / 2)
      if (rx > 0 && ry > 0) {
        return [
          `M${x + rx} ${y}`,
          `H${x + width - rx}`,
          `A${rx} ${ry} 0 0 1 ${x + width} ${y + ry}`,
          `V${y + height - ry}`,
          `A${rx} ${ry} 0 0 1 ${x + width - rx} ${y + height}`,
          `H${x + rx}`,
          `A${rx} ${ry} 0 0 1 ${x} ${y + height - ry}`,
          `V${y + ry}`,
          `A${rx} ${ry} 0 0 1 ${x + rx} ${y}`,
          'Z'
        ].join(' ')
      }
      return `M${x} ${y} H${x + width} V${y + height} H${x} Z`
    }
    case 'circle': {
      const cx = parseNumber(element.getAttribute('cx')) ?? 0
      const cy = parseNumber(element.getAttribute('cy')) ?? 0
      const r = parseNumber(element.getAttribute('r')) ?? 0
      if (r <= 0) return null
      return `M${cx - r} ${cy} A${r} ${r} 0 1 0 ${cx + r} ${cy} A${r} ${r} 0 1 0 ${cx - r} ${cy} Z`
    }
    case 'ellipse': {
      const cx = parseNumber(element.getAttribute('cx')) ?? 0
      const cy = parseNumber(element.getAttribute('cy')) ?? 0
      const rx = parseNumber(element.getAttribute('rx')) ?? 0
      const ry = parseNumber(element.getAttribute('ry')) ?? 0
      if (rx <= 0 || ry <= 0) return null
      return `M${cx - rx} ${cy} A${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`
    }
    case 'line': {
      const x1 = parseNumber(element.getAttribute('x1')) ?? 0
      const y1 = parseNumber(element.getAttribute('y1')) ?? 0
      const x2 = parseNumber(element.getAttribute('x2')) ?? 0
      const y2 = parseNumber(element.getAttribute('y2')) ?? 0
      return `M${x1} ${y1} L${x2} ${y2}`
    }
    case 'polyline':
      return pointsToPath(element.getAttribute('points'), false)
    case 'polygon':
      return pointsToPath(element.getAttribute('points'), true)
    default:
      return null
  }
}

function applyMatrixToPath(d: string, matrix: Matrix): string | null {
  const isIdentity =
    matrix[0] === 1 && matrix[1] === 0 && matrix[2] === 0 && matrix[3] === 1 && matrix[4] === 0 && matrix[5] === 0
  try {
    const path = svgpath(d).unarc().unshort().abs()
    const transformed = isIdentity ? path : path.matrix([...matrix])
    const result = transformed.round(3).toString()
    return result.trim().length > 0 ? result : null
  } catch {
    return null
  }
}

function parseViewBox(element: Element): Rect | null {
  const raw = element.getAttribute('viewBox')
  if (raw) {
    const values = (raw.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number)
    if (values.length === 4 && values[2]! > 0 && values[3]! > 0) {
      return { x: values[0]!, y: values[1]!, width: values[2]!, height: values[3]! }
    }
  }
  const width = parseNumber(element.getAttribute('width'))
  const height = parseNumber(element.getAttribute('height'))
  if (width && height && width > 0 && height > 0) {
    return { x: 0, y: 0, width, height }
  }
  return null
}

function unionBBox(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const rect of rects) {
    minX = Math.min(minX, rect.x)
    minY = Math.min(minY, rect.y)
    maxX = Math.max(maxX, rect.x + rect.width)
    maxY = Math.max(maxY, rect.y + rect.height)
  }
  return {
    x: minX,
    y: minY,
    width: Math.max(0.01, maxX - minX),
    height: Math.max(0.01, maxY - minY)
  }
}

/**
 * Sanitize and analyze an SVG document into an ordered list of drawable paths.
 * The raw SVG markup is never injected into the application DOM; only resolved
 * geometry values are used, and those are re-validated by svgpath.
 */
export function analyzeSvg(text: string, options: AnalyzeSvgOptions = {}): AnalyzedSvg {
  if (typeof DOMParser === 'undefined') {
    throw new SvgImportError('SVG analysis requires a DOM environment.')
  }
  if (text.length > 20 * 1024 * 1024) {
    throw new SvgImportError('The SVG file is too large to import (limit 20 MB).')
  }
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
  const parserError = doc.getElementsByTagName('parsererror')[0]
  if (parserError) {
    throw new SvgImportError('The file is not valid SVG/XML.')
  }
  const root = doc.documentElement
  if (!root || tagOf(root) !== 'svg') {
    throw new SvgImportError('The file does not contain an SVG document.')
  }

  const warnings = new Set<string>()
  const { byClass, byTag } = collectClassRules(doc)
  const gradientColors = collectGradientColors(doc)
  const ctx: ResolveContext = {
    byClass,
    byTag,
    gradients: gradientColors,
    warnings
  }

  for (const tag of DANGEROUS_TAGS) {
    for (const element of Array.from(doc.getElementsByTagName(tag))) {
      element.remove()
    }
  }
  for (const element of Array.from(doc.getElementsByTagName('*'))) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase()
      if (name.startsWith('on')) element.removeAttribute(attribute.name)
      if ((name === 'href' || name === 'xlink:href') && !attribute.value.trim().startsWith('#')) {
        element.removeAttribute(attribute.name)
      }
    }
  }

  const drawables: Drawable[] = []
  const usedIds = new Set<string>()
  const measure = options.measure ?? fallbackMeasure
  const maxDrawables = options.maxDrawables ?? 3000
  let drawableIndex = 0

  const warnTag = (tag: string, message: string) => {
    if (!warnings.has(message)) warnings.add(message)
    void tag
  }

  const visit = (
    element: Element,
    inherited: InheritedStyle,
    parentMatrix: Matrix,
    ancestorOpacity: number
  ): void => {
    const tag = tagOf(element)
    if (SKIP_TAGS.has(tag)) return

    if (tag === 'image') {
      warnTag(tag, 'Embedded raster images inside SVG are not drawn.')
      return
    }
    if (tag === 'use') {
      warnTag(tag, '<use> references are not expanded and were skipped.')
      return
    }
    if (tag === 'text' || tag === 'tspan') {
      warnTag(tag, 'Text inside SVG is not converted to outlines and was skipped.')
      return
    }
    if (tag === 'filter' || element.getAttribute('filter')) {
      warnTag(tag, 'SVG filters are not supported and were ignored.')
    }
    if (element.getAttribute('clip-path') || element.getAttribute('mask')) {
      warnTag(tag, 'Clipping and masking are not supported and were ignored.')
    }

    const display = propertyValue(element, 'display', ctx)
    if (display === 'none') return

    const style = resolveStyle(element, inherited, ctx)
    if (style.visibility === 'hidden') return

    const ownOpacity = parseNumber(propertyValue(element, 'opacity', ctx)) ?? 1
    const opacity = ancestorOpacity * Math.min(1, Math.max(0, ownOpacity))
    const matrix = multiply(parentMatrix, parseTransform(element.getAttribute('transform')))

    if (tag === 'g' || tag === 'a' || tag === 'svg') {
      if (tag === 'svg' && element !== root) {
        warnTag(tag, 'Nested SVG documents are flattened without their viewport.')
      }
      for (const child of Array.from(element.children)) {
        visit(child, style, matrix, opacity)
      }
      return
    }

    const rawPath = shapeToPathData(element)
    if (!rawPath) return
    const d = applyMatrixToPath(rawPath, matrix)
    if (!d) return
    if (drawables.length >= maxDrawables) {
      throw new SvgImportError(
        `The SVG contains more than ${maxDrawables} drawable shapes. Simplify it or split it into several assets.`
      )
    }

    let measurement: PathMeasurement
    try {
      measurement = measure(d)
    } catch {
      measurement = fallbackMeasure(d)
    }

    const baseId = element.getAttribute('id')
    let id = baseId && /^[\w.-]+$/.test(baseId) ? baseId : `drawable_${drawableIndex + 1}`
    if (usedIds.has(id)) id = `drawable_${drawableIndex + 1}_${drawables.length + 1}`
    while (usedIds.has(id)) id = `${id}_x`
    usedIds.add(id)

    const fill = style.fill
    const stroke = style.stroke
    if (!fill && !stroke) {
      drawableIndex += 1
      return
    }

    const weight = Math.max(4, measurement.length)
    drawables.push({
      id,
      d,
      fill,
      fillOpacity: style.fill ? style.fillOpacity * opacity : 0,
      fillRule: style.fillRule,
      stroke,
      strokeWidth: style.strokeWidth,
      strokeOpacity: style.stroke ? style.strokeOpacity * opacity : 0,
      lineCap: style.lineCap,
      lineJoin: style.lineJoin,
      opacity: 1,
      length: Math.max(0, measurement.length),
      weight,
      bbox: measurement.bbox
    })
    drawableIndex += 1
  }

  const rootMatrix: Matrix = IDENTITY
  for (const child of Array.from(root.children)) {
    visit(child, DEFAULT_STYLE, rootMatrix, 1)
  }

  if (drawables.length === 0) {
    throw new SvgImportError(
      'No supported vector shapes were found. Use paths, rectangles, circles, ellipses, lines or polygons.'
    )
  }

  const declaredViewBox = parseViewBox(root)
  const measuredBounds = unionBBox(drawables.map((drawable) => drawable.bbox))
  const viewBox: Rect = declaredViewBox ?? measuredBounds ?? { x: 0, y: 0, width: 100, height: 100 }
  if (!declaredViewBox) {
    warnings.add('The SVG had no viewBox or dimensions; bounds were inferred from its content.')
  }

  return {
    viewBox,
    drawables,
    warnings: Array.from(warnings).slice(0, 20)
  }
}
