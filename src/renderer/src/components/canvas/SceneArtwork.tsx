import type { JSX, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import type { SceneVisual } from '@core/animation/scene'
import type { WipeState } from '@core/animation/evaluate'
import { scribbleRects } from '@core/animation/scribble'
import type { Rect } from '@core/schema/primitives'
import type { Element, Project, Scene } from '@core/schema/project'
import { strokeWritingBounds } from '@core/text/strokeWriting'
import { assetUrl } from '../../lib/assets'
import { ElementNode } from './ElementNode'
import { erasePolygon, revealPolygon } from './renderUtils'
import { revealBounds, textEraseRects, textRevealRects } from './textMetrics'

interface SceneArtworkProps {
  project: Project
  scene: Scene
  visual: SceneVisual
  token: string
  idPrefix: string
  /** World rect painted by the scene background. Defaults to the camera view (export/thumbnails). */
  backgroundFrame?: Rect
  /** Editor grid, drawn above the background but beneath the artwork. */
  grid?: ReactNode
  interactive?: boolean
  registerPath?: (elementId: string, drawableId: string, path: SVGPathElement | null) => void
  onElementPointerDown?: (elementId: string, event: ReactPointerEvent<SVGGElement>) => void
}

/**
 * Pure scene composition at a given visual state. Shared by the editor canvas,
 * scene thumbnails, and the future export renderer.
 */
export function SceneArtwork({
  project,
  scene,
  visual,
  token,
  idPrefix,
  backgroundFrame,
  grid,
  interactive = false,
  registerPath,
  onElementPointerDown
}: SceneArtworkProps): JSX.Element {
  const frame = backgroundFrame ?? visual.camera.frame
  const background = scene.background

  return (
    <g opacity={visual.transitionOpacity}>
      <defs>
        {background.type === 'gradient' ? (
          <linearGradient
            id={`${idPrefix}-bg`}
            x1={`${0.5 - Math.cos((background.angle * Math.PI) / 180) / 2}`}
            y1={`${0.5 - Math.sin((background.angle * Math.PI) / 180) / 2}`}
            x2={`${0.5 + Math.cos((background.angle * Math.PI) / 180) / 2}`}
            y2={`${0.5 + Math.sin((background.angle * Math.PI) / 180) / 2}`}
          >
            <stop offset="0" stopColor={background.from} />
            <stop offset="1" stopColor={background.to} />
          </linearGradient>
        ) : null}
        {scene.elements.map((element) => {
          const state = visual.elements[element.id]
          if (!state?.wipe) return null
          return (
            <clipPath id={`${idPrefix}-wipe-${element.id}`} key={element.id}>
              {wipeClipChildren(element, state.wipe, state.erasing)}
            </clipPath>
          )
        })}
        {scene.elements.map((element) => {
          const state = visual.elements[element.id]
          if (!state?.scribble) return null
          return (
            <clipPath id={`${idPrefix}-scribble-${element.id}`} key={`scribble-${element.id}`}>
              {scribbleRects(element.frame, state.scribble.progress).map((band, index) => (
                <rect key={index} x={band.x} y={band.y} width={band.width} height={band.height} />
              ))}
            </clipPath>
          )
        })}
      </defs>

      {background.type === 'solid' ? (
        <rect x={frame.x} y={frame.y} width={frame.width} height={frame.height} fill={background.color} />
      ) : null}
      {background.type === 'gradient' ? (
        <rect
          x={frame.x}
          y={frame.y}
          width={frame.width}
          height={frame.height}
          fill={`url(#${idPrefix}-bg)`}
        />
      ) : null}
      {background.type === 'image' ? (
        <BackgroundImage
          project={project}
          token={token}
          frame={frame}
          assetId={background.assetId}
          fit={background.fit}
        />
      ) : null}

      {grid}

      {scene.elements.map((element) => {
        const state = visual.elements[element.id]
        if (!state) return null
        return (
          <ElementNode
            key={element.id}
            project={project}
            element={element}
            state={state}
            token={token}
            opacity={1}
            clipId={
              state.wipe
                ? `${idPrefix}-wipe-${element.id}`
                : state.scribble
                  ? `${idPrefix}-scribble-${element.id}`
                  : undefined
            }
            selected={false}
            registerPath={registerPath}
            onPointerDown={
              interactive && onElementPointerDown
                ? (target, event) => {
                    event.stopPropagation()
                    onElementPointerDown(target.id, event)
                  }
                : undefined
            }
          />
        )
      })}
    </g>
  )
}

/**
 * Children of an element's wipe clip path. An erase leans its front so the top
 * of a block clears ahead of the bottom; a reveal just grows along its edge.
 */
function wipeClipChildren(element: Element, wipe: WipeState, erasing: boolean): JSX.Element {
  if (element.kind === 'text') {
    // Stroke text is not laid out with the system font, so its edge has to
    // follow the actual ink block rather than measured glyph boxes.
    const strokeBounds = strokeWritingBounds(element)
    if (!strokeBounds) {
      const rects = erasing
        ? textEraseRects(element, wipe.progress)
        : textRevealRects(element, wipe.progress, wipe.direction)
      return (
        <>
          {rects.map((rect, index) => (
            <rect key={index} x={rect.x} y={rect.y} width={rect.width} height={rect.height} />
          ))}
        </>
      )
    }
    return (
      <polygon
        points={
          erasing
            ? erasePolygon(strokeBounds, wipe.progress)
            : revealPolygon(strokeBounds, wipe.direction, wipe.progress)
        }
      />
    )
  }
  const bounds = revealBounds(element)
  return (
    <polygon
      points={
        erasing ? erasePolygon(bounds, wipe.progress) : revealPolygon(bounds, wipe.direction, wipe.progress)
      }
    />
  )
}

interface BackgroundImageProps {
  project: Project
  token: string
  frame: { x: number; y: number; width: number; height: number }
  assetId: string
  fit: 'cover' | 'contain'
}

function BackgroundImage({ project, token, frame, assetId, fit }: BackgroundImageProps): JSX.Element {
  const asset = project.assets.find((candidate) => candidate.id === assetId)
  if (!asset || asset.kind !== 'image') {
    return <rect x={frame.x} y={frame.y} width={frame.width} height={frame.height} fill="#ffffff" />
  }
  return (
    <g>
      <rect x={frame.x} y={frame.y} width={frame.width} height={frame.height} fill="#ffffff" />
      <image
        href={assetUrl(token, asset.fileName)}
        x={frame.x}
        y={frame.y}
        width={frame.width}
        height={frame.height}
        preserveAspectRatio={fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet'}
        pointerEvents="none"
      />
    </g>
  )
}
