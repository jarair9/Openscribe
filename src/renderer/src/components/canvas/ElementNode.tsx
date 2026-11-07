import type { CSSProperties, JSX, PointerEvent as ReactPointerEvent } from 'react'
import type { ElementVisualState } from '@core/animation/evaluate'
import { scribbleRects } from '@core/animation/scribble'
import type { Asset, Element, Project } from '@core/schema/project'
import { strokeFontForElement } from '@core/text/strokeFont'
import { strokeDrawProgress, strokeWritingPlan } from '@core/text/strokeWriting'
import { assetUrl } from '../../lib/assets'
import { arrowGeometry, elementGroupTransform, textLines } from './renderUtils'

interface ElementNodeProps {
  project: Project
  element: Element
  state: ElementVisualState
  token: string
  opacity: number
  clipId?: string
  selected: boolean
  registerPath?: (elementId: string, drawableId: string, path: SVGPathElement | null) => void
  onPointerDown?: (element: Element, event: ReactPointerEvent<SVGGElement>) => void
}

export function ElementNode({
  project,
  element,
  state,
  token,
  opacity,
  clipId,
  selected,
  registerPath,
  onPointerDown
}: ElementNodeProps): JSX.Element | null {
  if (!state.rendered) return null

  const frame = element.frame
  const transform = elementGroupTransform(frame, element.rotation, state)
  const style: CSSProperties = {
    opacity: Math.max(0, Math.min(1, state.opacity * opacity))
  }
  const asset =
    element.kind === 'svg' || element.kind === 'image'
      ? project.assets.find((candidate) => candidate.id === element.assetId)
      : undefined

  return (
    <g
      transform={transform}
      style={style}
      clipPath={clipId ? `url(#${clipId})` : undefined}
      onPointerDown={onPointerDown ? (event) => onPointerDown(element, event) : undefined}
      data-element-id={element.id}
      aria-label={element.name}
      className={selected ? 'element selected' : 'element'}
    >
      {element.kind === 'svg' ? (
        <SvgArtwork
          element={element}
          state={state}
          asset={asset}
          registerPath={registerPath}
          frame={frame}
        />
      ) : null}
      {element.kind === 'image' ? (
        <ImageArtwork asset={asset} token={token} frame={frame} />
      ) : null}
      {element.kind === 'text' ? (
        <TextArtwork element={element} state={state} />
      ) : null}
      {element.kind === 'shape' ? <ShapeArtwork element={element} /> : null}
      <rect
        x={frame.x}
        y={frame.y}
        width={frame.width}
        height={frame.height}
        fill="transparent"
        pointerEvents="all"
      />
    </g>
  )
}

function MissingAsset({ frame, label }: { frame: Element['frame']; label: string }): JSX.Element {
  return (
    <g>
      <rect
        x={frame.x}
        y={frame.y}
        width={frame.width}
        height={frame.height}
        fill="#fff4f4"
        stroke="#e08b8b"
        strokeDasharray="8 6"
        strokeWidth={2}
      />
      <text
        x={frame.x + frame.width / 2}
        y={frame.y + frame.height / 2}
        textAnchor="middle"
        fontSize={Math.max(12, Math.min(28, frame.height / 5))}
        fill="#b05656"
        fontFamily="Segoe UI, sans-serif"
      >
        {label}
      </text>
    </g>
  )
}

interface SvgArtworkProps {
  element: Extract<Element, { kind: 'svg' }>
  state: ElementVisualState
  asset: Asset | undefined
  registerPath?: (elementId: string, drawableId: string, path: SVGPathElement | null) => void
  frame: Element['frame']
}

function SvgArtwork({ element, state, asset, registerPath, frame }: SvgArtworkProps): JSX.Element {
  const data = asset?.svg
  if (!asset || !data) {
    return <MissingAsset frame={frame} label="Missing illustration" />
  }

  const vb = data.viewBox
  const scaleX = frame.width / Math.max(0.001, vb.width)
  const scaleY = frame.height / Math.max(0.001, vb.height)
  const artTransform = `translate(${frame.x} ${frame.y}) scale(${scaleX} ${scaleY}) translate(${-vb.x} ${-vb.y})`
  const drawStates = new Map(state.drawables?.map((drawable) => [drawable.id, drawable]) ?? [])

  return (
    <g transform={artTransform}>
      {data.drawables.map((drawable) => {
        const reveal = drawStates.get(drawable.id)
        const draw = reveal ? reveal.draw : 1
        const fill = reveal ? reveal.fill : 1
        const traceFillOutline = drawable.stroke === null && drawable.fill !== null && draw < 1
        const dashed = draw < 0.999 && drawable.length > 0.5
        const coloring = drawable.fill !== null && fill < 0.999
        const fillClipId = coloring ? `ows-fill-${element.id}-${drawable.id}` : null
        return (
          <g key={drawable.id}>
            {fillClipId ? (
              <clipPath id={fillClipId}>
                {scribbleRects(drawable.bbox, fill).map((band, index) => (
                  <rect
                    key={index}
                    x={band.x}
                    y={band.y}
                    width={band.width}
                    height={band.height}
                  />
                ))}
              </clipPath>
            ) : null}
            {drawable.fill !== null ? (
              <path
                d={drawable.d}
                fill={drawable.fill}
                fillOpacity={drawable.fillOpacity}
                fillRule={drawable.fillRule}
                stroke="none"
                opacity={drawable.opacity}
                clipPath={fillClipId ? `url(#${fillClipId})` : undefined}
              />
            ) : null}
            <path
              ref={(node) => registerPath?.(element.id, drawable.id, node)}
              d={drawable.d}
              fill="none"
              fillRule={drawable.fillRule}
              stroke={drawable.stroke ?? (traceFillOutline ? drawable.fill! : 'none')}
              strokeWidth={traceFillOutline ? Math.max(1.5, drawable.strokeWidth) : drawable.strokeWidth}
              strokeOpacity={
                drawable.stroke !== null
                  ? drawable.strokeOpacity
                  : traceFillOutline
                    ? drawable.fillOpacity * (1 - fill)
                    : 0
              }
              strokeLinecap={drawable.lineCap}
              strokeLinejoin={drawable.lineJoin}
              strokeDasharray={dashed ? `${drawable.length} ${drawable.length}` : undefined}
              strokeDashoffset={dashed ? drawable.length * (1 - draw) : undefined}
              opacity={drawable.opacity}
            />
          </g>
        )
      })}
    </g>
  )
}

interface ImageArtworkProps {
  asset: Asset | undefined
  token: string
  frame: Element['frame']
}

function ImageArtwork({ asset, token, frame }: ImageArtworkProps): JSX.Element {
  if (!asset || !asset.image) {
    return <MissingAsset frame={frame} label="Missing image" />
  }
  return (
    <image
      href={assetUrl(token, asset.fileName)}
      x={frame.x}
      y={frame.y}
      width={frame.width}
      height={frame.height}
      preserveAspectRatio="none"
      pointerEvents="none"
    />
  )
}

function TextArtwork({
  element,
  state
}: {
  element: Extract<Element, { kind: 'text' }>
  state: ElementVisualState
}): JSX.Element {
  const font = strokeFontForElement(element)
  if (font) {
    return <StrokeTextArtwork element={element} progress={state.strokeDraw ?? 1} />
  }

  const lines = textLines(element.text)
  const anchor =
    element.align === 'center' ? 'middle' : element.align === 'right' ? 'end' : 'start'
  const x =
    element.align === 'center'
      ? element.frame.x + element.frame.width / 2
      : element.align === 'right'
        ? element.frame.x + element.frame.width
        : element.frame.x
  const lineHeight = element.fontSize * element.lineHeight

  return (
    <text
      x={x}
      y={element.frame.y + element.fontSize}
      fill={element.color}
      fontFamily={element.fontFamily}
      fontSize={element.fontSize}
      fontWeight={element.fontWeight}
      fontStyle={element.italic ? 'italic' : 'normal'}
      textAnchor={anchor}
      letterSpacing={element.letterSpacing}
      pointerEvents="none"
      style={{ whiteSpace: 'pre' }}
    >
      {lines.map((line, index) => (
        <tspan key={index} x={x} dy={index === 0 ? 0 : lineHeight}>
          {line || ' '}
        </tspan>
      ))}
    </text>
  )
}

function StrokeTextArtwork({
  element,
  progress
}: {
  element: Extract<Element, { kind: 'text' }>
  progress: number
}): JSX.Element | null {
  const font = strokeFontForElement(element)
  if (!font) return null
  const plan = strokeWritingPlan(element, font)

  return (
    <g pointerEvents="none">
      {plan.strokes.map((stroke) => {
        const draw = strokeDrawProgress(stroke, progress)
        if (draw <= 0) return null
        if (stroke.dot) {
          const radius = (stroke.width / 2) * (0.7 + 0.3 * Math.sqrt(draw))
          return (
            <circle
              key={stroke.id}
              cx={stroke.points[0]!.x}
              cy={stroke.points[0]!.y}
              r={radius}
              fill={element.color}
              opacity={Math.min(1, draw * 6)}
            />
          )
        }
        const partial = draw < 0.999
        return (
          <path
            key={stroke.id}
            d={stroke.d}
            fill="none"
            stroke={element.color}
            strokeWidth={stroke.width}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={partial ? `${stroke.length} ${stroke.length}` : undefined}
            strokeDashoffset={partial ? stroke.length * (1 - draw) : undefined}
          />
        )
      })}
    </g>
  )
}

function ShapeArtwork({ element }: { element: Extract<Element, { kind: 'shape' }> }): JSX.Element {
  const frame = element.frame
  const stroke = element.stroke ?? 'none'
  const strokeProps = {
    stroke,
    strokeWidth: element.strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const
  }

  if (element.shape === 'ellipse') {
    return (
      <ellipse
        cx={frame.x + frame.width / 2}
        cy={frame.y + frame.height / 2}
        rx={frame.width / 2}
        ry={frame.height / 2}
        fill={element.fill ?? 'none'}
        {...strokeProps}
        pointerEvents="none"
      />
    )
  }

  if (element.shape === 'triangle') {
    return (
      <polygon
        points={`${frame.x + frame.width / 2},${frame.y} ${frame.x + frame.width},${frame.y + frame.height} ${frame.x},${frame.y + frame.height}`}
        fill={element.fill ?? 'none'}
        {...strokeProps}
        pointerEvents="none"
      />
    )
  }

  if (element.shape === 'line') {
    return (
      <line
        x1={frame.x}
        y1={frame.y + frame.height}
        x2={frame.x + frame.width}
        y2={frame.y}
        {...strokeProps}
        pointerEvents="none"
      />
    )
  }

  if (element.shape === 'arrow') {
    const geometry = arrowGeometry(frame, element.strokeWidth)
    return (
      <g pointerEvents="none">
        <line
          x1={geometry.start.x}
          y1={geometry.start.y}
          x2={geometry.end.x}
          y2={geometry.end.y}
          {...strokeProps}
        />
        <polygon points={geometry.head} fill={element.stroke ?? '#16181d'} />
      </g>
    )
  }

  const radius = element.shape === 'roundedRectangle' ? element.cornerRadius : 0
  return (
    <rect
      x={frame.x}
      y={frame.y}
      width={frame.width}
      height={frame.height}
      rx={radius}
      ry={radius}
      fill={element.fill ?? 'none'}
      {...strokeProps}
      pointerEvents="none"
    />
  )
}

