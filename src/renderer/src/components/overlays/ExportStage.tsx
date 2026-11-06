import { useCallback, useEffect, useMemo, useRef, useState, type JSX, type RefObject } from 'react'
import { evaluateScene } from '@core/animation/scene'
import type { Project } from '@core/schema/project'
import { buildSchedule, sceneAt, type ProjectSchedule } from '@core/timeline/schedule'
import { drawablePathKey, InstrumentOverlay } from '../canvas/InstrumentOverlay'
import { findActiveInstrument } from '../canvas/instrumentState'
import { SceneArtwork } from '../canvas/SceneArtwork'

const EMPTY_SCHEDULE: ProjectSchedule = { version: 1, duration: 0, scenes: [], elements: {} }

/**
 * Off-screen scene painter for the export loop.
 *
 * The stage is never displayed, but it has to be laid out at real pixel
 * dimensions: the instrument overlay positions the hand with `getScreenCTM()`,
 * and a zero-sized box gives it no geometry to work from.
 */
export function useExportStage(
  project: Project | null,
  token: string
): {
  schedule: ProjectSchedule
  stage: JSX.Element | null
  /** Paint `time` and resolve once the browser has the finished DOM for it. */
  renderFrame(time: number): Promise<void>
  svgRef: RefObject<SVGSVGElement | null>
} {
  const schedule = useMemo(() => (project ? buildSchedule(project) : EMPTY_SCHEDULE), [project])
  const [tick, setTick] = useState({ time: 0, seq: 0 })
  const svgRef = useRef<SVGSVGElement | null>(null)
  const pathRefs = useRef<Map<string, SVGPathElement>>(new Map())
  const waiter = useRef<(() => void) | null>(null)

  const registerPath = useCallback((elementId: string, drawableId: string, path: SVGPathElement | null) => {
    const key = drawablePathKey(elementId, drawableId)
    if (path) pathRefs.current.set(key, path)
    else pathRefs.current.delete(key)
  }, [])

  const notify = useCallback(() => waiter.current?.(), [])

  const renderFrame = useCallback((time: number) => {
    return new Promise<void>((resolve) => {
      waiter.current = resolve
      setTick((previous) => ({ time, seq: previous.seq + 1 }))
    })
  }, [])

  const current = useMemo(() => {
    if (!project || schedule.scenes.length === 0) return null
    const at = sceneAt(schedule, tick.time)
    const sceneDoc = project.scenes[at.scene.index]
    if (!sceneDoc) return null
    const visual = evaluateScene(
      project,
      sceneDoc,
      at.scene.index,
      at.localTime,
      at.scene.duration,
      at.scene.start,
      project.output,
      schedule
    )
    return {
      sceneDoc,
      visual,
      instrument: findActiveInstrument(sceneDoc, visual, at.scene.elements)
    }
  }, [project, schedule, tick.time])

  useEffect(notify, [tick, notify])

  const stage = useMemo(() => {
    if (!project || !current) return null
    const camera = current.visual.camera.frame
    const clipId = `export-frame-${current.sceneDoc.id}`
    return (
      <div className="export-stage" aria-hidden="true">
        <svg
          ref={svgRef}
          viewBox={`${camera.x} ${camera.y} ${camera.width} ${camera.height}`}
          width={project.output.width}
          height={project.output.height}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
              <rect x={camera.x} y={camera.y} width={camera.width} height={camera.height} />
            </clipPath>
          </defs>
          <g clipPath={`url(#${clipId})`}>
            <SceneArtwork
              project={project}
              scene={current.sceneDoc}
              visual={current.visual}
              token={token}
              idPrefix="export"
              backgroundFrame={camera}
              registerPath={registerPath}
            />
          </g>
          <g clipPath={`url(#${clipId})`}>
            <InstrumentOverlay
              active={current.instrument}
              pathRefs={pathRefs}
              cameraHeight={camera.height}
              cameraWidth={camera.width}
              svgRef={svgRef}
              viewport={{ center: { x: 0, y: 0 }, zoom: 1 }}
              space="svg"
            />
          </g>
        </svg>
      </div>
    )
  }, [project, current, token, registerPath])

  return { schedule, stage, renderFrame, svgRef }
}
