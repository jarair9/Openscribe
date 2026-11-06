import {
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
  type PointerEvent as ReactPointerEvent
} from 'react'
import {
  Camera as CameraIcon,
  Film,
  Image as ImageIcon,
  Minus,
  Music2,
  PenTool,
  Plus,
  Shapes,
  Type as TypeIcon
} from 'lucide-react'
import { clamp, roundTo } from '@core/math'
import {
  updateElement,
  updateSceneAudioTrack
} from '@core/project/operations'
import type { Element } from '@core/schema/project'
import type { ProjectSchedule, SceneSchedule } from '@core/timeline/schedule'
import { useEditorStore } from '../../state/editorStore'
import { usePlaybackStore } from '../../state/playbackStore'
import { useProjectStore } from '../../state/projectStore'

const LABEL_WIDTH = 168
const RULER_HEIGHT = 30

export function Timeline({ schedule }: { schedule: ProjectSchedule }): JSX.Element | null {
  const project = useProjectStore((state) => state.project)
  const apply = useProjectStore((state) => state.apply)
  const beginTransaction = useProjectStore((state) => state.beginTransaction)
  const endTransaction = useProjectStore((state) => state.endTransaction)

  const activeSceneId = useEditorStore((state) => state.activeSceneId)
  const selection = useEditorStore((state) => state.selection)
  const selectedCameraId = useEditorStore((state) => state.selectedCameraId)
  const select = useEditorStore((state) => state.select)
  const selectCamera = useEditorStore((state) => state.selectCamera)
  const pps = useEditorStore((state) => state.timelinePps)
  const rowHeight = useEditorStore((state) => state.timelineRowHeight)
  const setRowHeight = useEditorStore((state) => state.setTimelineRowHeight)

  const time = usePlaybackStore((state) => state.time)
  const playing = usePlaybackStore((state) => state.playing)
  const setTime = usePlaybackStore((state) => state.setTime)
  const pause = usePlaybackStore((state) => state.pause)

  const [scrubbing, setScrubbing] = useState(false)
  const rulerRef = useRef<SVGSVGElement | null>(null)

  const sceneIndex = project
    ? project.scenes.findIndex((scene) => scene.id === activeSceneId)
    : -1
  const scene = project && sceneIndex >= 0 ? project.scenes[sceneIndex]! : project?.scenes[0] ?? null
  const sceneSchedule = project && scene ? schedule.scenes[project.scenes.indexOf(scene)] : undefined

  const laneWidth = useMemo(() => {
    const duration = sceneSchedule?.duration ?? 0
    return Math.max(520, duration * pps + 64)
  }, [sceneSchedule?.duration, pps])

  if (!project || !scene || !sceneSchedule) return null

  const localTime = clamp(time - sceneSchedule.start, 0, sceneSchedule.duration)

  const scrubTo = (clientX: number): void => {
    const rect = rulerRef.current?.getBoundingClientRect()
    if (!rect) return
    const next = clamp((clientX - rect.left) / pps, 0, sceneSchedule.duration)
    pause()
    setTime(sceneSchedule.start + next)
  }

  const updateTiming = (elementId: string, start: number): void => {
    apply(
      'Move element timing',
      (current) =>
        updateElement(current, scene.id, elementId, (element) => ({
          ...element,
          timing: { ...element.timing, mode: 'manual', start: Math.max(0, roundTo(start, 2)) }
        })),
      { coalesce: false }
    )
  }

  const updateEntranceDuration = (elementId: string, duration: number): void => {
    apply(
      'Resize entrance',
      (current) =>
        updateElement(current, scene.id, elementId, (element) => ({
          ...element,
          animation: {
            ...element.animation,
            entrance: { ...element.animation.entrance, duration: Math.max(0.1, roundTo(duration, 2)) }
          }
        })),
      { coalesce: false }
    )
  }

  const updateAudioStart = (trackId: string, start: number): void => {
    apply(
      'Move audio',
      (current) =>
        updateSceneAudioTrack(current, scene.id, trackId, (track) => ({
          ...track,
          startTime: Math.max(0, roundTo(start, 2))
        })),
      { coalesce: false }
    )
  }

  const startDrag = (
    event: ReactPointerEvent,
    label: string,
    onDelta: (deltaSeconds: number) => void
  ): void => {
    event.stopPropagation()
    event.preventDefault()
    const startX = event.clientX
    beginTransaction(label)
    const move = (moveEvent: PointerEvent): void => {
      onDelta((moveEvent.clientX - startX) / pps)
    }
    const up = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      endTransaction()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const step = niceStep(pps)
  const majorTicks = Array.from(
    { length: Math.floor(sceneSchedule.duration / step) + 1 },
    (_, index) => index * step
  ).filter((value) => value <= sceneSchedule.duration + 0.001)
  const minorTicks =
    step >= 2
      ? majorTicks
          .map((value) => value + step / 2)
          .filter((value) => value <= sceneSchedule.duration + 0.001)
      : []
  const orderedElements = [...scene.elements].sort(
    (a, b) =>
      (sceneSchedule.elements[a.id]?.start ?? 0) - (sceneSchedule.elements[b.id]?.start ?? 0)
  )

  const contentStyle = {
    '--track-h': `${rowHeight}px`,
    '--bar-h': `${Math.max(14, rowHeight - 12)}px`,
    '--grid-step': `${step * pps}px`
  } as CSSProperties

  return (
    <div className="timeline">
      <div className="timeline-zoom-rail" aria-label="Track height">
        <button
          className="zoom-rail-btn"
          title="Expand tracks"
          aria-label="Expand tracks"
          onClick={() => setRowHeight(rowHeight + 8)}
        >
          <Plus size={12} />
        </button>
        <span className="zoom-rail-line" aria-hidden="true" />
        <button
          className="zoom-rail-btn"
          title="Compress tracks"
          aria-label="Compress tracks"
          onClick={() => setRowHeight(rowHeight - 8)}
        >
          <Minus size={12} />
        </button>
      </div>

      <div className="timeline-scroll">
        <div
          className="timeline-content"
          style={{ ...contentStyle, width: LABEL_WIDTH + laneWidth, minHeight: '100%' }}
        >
          <div className="timeline-ruler-row">
            <div className="timeline-ruler-corner" style={{ width: LABEL_WIDTH }}>
              <span className="timeline-corner-time">{timecode(localTime)}</span>
            </div>
            <svg
              ref={rulerRef}
              className="timeline-ruler"
              width={laneWidth}
              height={RULER_HEIGHT}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId)
                setScrubbing(true)
                scrubTo(event.clientX)
              }}
              onPointerMove={(event) => {
                if (scrubbing) scrubTo(event.clientX)
              }}
              onPointerUp={(event) => {
                setScrubbing(false)
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId)
                }
              }}
            >
              {minorTicks.map((tick) => (
                <line
                  key={`minor-${tick}`}
                  x1={tick * pps}
                  y1={RULER_HEIGHT - 5}
                  x2={tick * pps}
                  y2={RULER_HEIGHT}
                  stroke="rgba(160, 166, 178, 0.3)"
                  strokeWidth={1}
                />
              ))}
              {majorTicks.map((tick) => (
                <g key={tick}>
                  <line
                    x1={tick * pps}
                    y1={RULER_HEIGHT - 10}
                    x2={tick * pps}
                    y2={RULER_HEIGHT}
                    stroke="rgba(160, 166, 178, 0.55)"
                    strokeWidth={1}
                  />
                  <text
                    x={tick * pps + 5}
                    y={12}
                    fill="#9a9aa2"
                    fontSize={10}
                    fontFamily="Cascadia Mono, Consolas, monospace"
                  >
                    {timecode(tick)}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          <div
            className="timeline-gridlines"
            style={{ left: LABEL_WIDTH, width: laneWidth }}
            aria-hidden="true"
          />

          <div className="timeline-track scene-track">
            <div className="timeline-track-label">
              <span className="track-icon">
                <Film size={13} />
              </span>
              <span className="track-name">{scene.name}</span>
              <span className="track-time">{timecode(sceneSchedule.duration)}</span>
            </div>
            <div className="timeline-track-lane">
              <div
                className="timeline-bar scene"
                style={{ left: 0, width: Math.max(8, sceneSchedule.duration * pps) }}
                title={`${scene.name} — ${timecode(sceneSchedule.duration)}`}
                onClick={() => {
                  pause()
                  setTime(sceneSchedule.start)
                }}
              >
                {scene.cameras.map((camera) => (
                  <span
                    key={camera.id}
                    className="scene-camera-tick"
                    style={{ left: camera.startTime * pps }}
                    title={`${camera.name} at ${timecode(camera.startTime)}`}
                  />
                ))}
                <span className="timeline-bar-label">{scene.name}</span>
              </div>
            </div>
          </div>

          {orderedElements.map((element) => (
            <ElementTrack
              key={element.id}
              sceneSchedule={sceneSchedule}
              element={element}
              pps={pps}
              selected={selection.includes(element.id)}
              onSelect={() => select([element.id])}
              updateTiming={updateTiming}
              updateEntranceDuration={updateEntranceDuration}
              beginDrag={startDrag}
            />
          ))}

          {scene.cameras.map((camera, index) => {
            const next = scene.cameras[index + 1]
            const start = camera.startTime
            const end = next ? next.startTime : sceneSchedule.duration
            const width = Math.max(0.2, end - start)
            return (
              <div
                className={`timeline-track ${selectedCameraId === camera.id ? 'selected' : ''}`}
                key={camera.id}
                onClick={() => selectCamera(camera.id)}
              >
                <div className="timeline-track-label">
                  <span className="track-icon">
                    <CameraIcon size={13} />
                  </span>
                  <span className="track-name">{camera.name}</span>
                  <span className="track-time">{timecode(start)}</span>
                </div>
                <div className="timeline-track-lane">
                  <div
                    className="timeline-bar camera"
                    style={{ left: start * pps, width: Math.max(4, width * pps) }}
                    title={`${camera.name} from ${timecode(start)}`}
                    onClick={() => selectCamera(camera.id)}
                  >
                    <span className="timeline-bar-label">{camera.name}</span>
                  </div>
                </div>
              </div>
            )
          })}

          {scene.audio.map((track) => {
            const scheduled = sceneSchedule.audio.find((entry) => entry.trackId === track.id)
            const duration = scheduled?.duration ?? 0
            return (
              <div className="timeline-track" key={track.id}>
                <div className="timeline-track-label">
                  <span className="track-icon">
                    <Music2 size={13} />
                  </span>
                  <span className="track-name">{track.name}</span>
                  <span className="track-time">{timecode(duration)}</span>
                </div>
                <div className="timeline-track-lane">
                  <div
                    className="timeline-bar audio"
                    style={{
                      left: track.startTime * pps,
                      width: Math.max(4, duration * pps)
                    }}
                    title={`${track.name} from ${timecode(track.startTime)}`}
                    onPointerDown={(event) => {
                      const start = track.startTime
                      startDrag(event, 'Move audio', (delta) =>
                        updateAudioStart(track.id, start + delta)
                      )
                    }}
                  >
                    <span className="timeline-bar-label">{track.name}</span>
                  </div>
                </div>
              </div>
            )
          })}

          {scene.elements.length === 0 && scene.audio.length === 0 ? (
            <div className="timeline-empty" style={{ marginLeft: LABEL_WIDTH }}>
              This scene has no elements yet. Import an illustration or add text to animate it.
            </div>
          ) : null}

          <div
            className="timeline-playhead"
            style={{ left: LABEL_WIDTH + localTime * pps }}
            aria-hidden="true"
          />
        </div>
      </div>

      <div className="sr-only" aria-live="polite">
        {playing ? 'Playing' : 'Paused'} at {timecode(localTime)} in {scene.name}.
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Element track                                                      */
/* ------------------------------------------------------------------ */

interface ElementTrackProps {
  sceneSchedule: SceneSchedule
  element: Element
  pps: number
  selected: boolean
  onSelect: () => void
  updateTiming: (elementId: string, start: number) => void
  updateEntranceDuration: (elementId: string, duration: number) => void
  beginDrag: (
    event: ReactPointerEvent,
    label: string,
    onDelta: (deltaSeconds: number) => void
  ) => void
}

function ElementTrack({
  sceneSchedule,
  element,
  pps,
  selected,
  onSelect,
  updateTiming,
  updateEntranceDuration,
  beginDrag
}: ElementTrackProps): JSX.Element {
  const timing = sceneSchedule.elements[element.id]
  if (!timing) return <></>

  const start = timing.start
  const total = Math.max(0.2, timing.end - start)
  const entrance = Math.max(0.1, timing.entranceEnd - timing.start)
  const emphasisStart = timing.emphasisStart
  const emphasisDuration = timing.emphasisEnd - timing.emphasisStart
  const exitStart = timing.exitStart
  const exitDuration = timing.exitEnd - timing.exitStart

  return (
    <div className={`timeline-track ${selected ? 'selected' : ''}`} onClick={onSelect}>
      <div className="timeline-track-label">
        <span className="track-icon">{trackIcon(element)}</span>
        <span className="track-name">{element.name}</span>
        <span className="track-time">{timecode(total)}</span>
      </div>
      <div className="timeline-track-lane">
        <div
          className="timeline-bar entrance"
          style={{ left: start * pps, width: Math.max(4, entrance * pps) }}
          title={`Entrance — ${timecode(start)} to ${timecode(timing.entranceEnd)} (drag to move)`}
          onPointerDown={(event) =>
            beginDrag(event, 'Move element timing', (delta) => updateTiming(element.id, start + delta))
          }
        >
          <span className="timeline-bar-label">In</span>
          <span
            className="timeline-bar-handle right"
            onPointerDown={(event) =>
              beginDrag(event, 'Resize entrance', (delta) =>
                updateEntranceDuration(element.id, entrance + delta)
              )
            }
          />
        </div>
        {emphasisDuration > 0 ? (
          <div
            className="timeline-bar emphasis"
            style={{ left: emphasisStart * pps, width: Math.max(4, emphasisDuration * pps) }}
            title={`Emphasis — ${timecode(emphasisStart)} to ${timecode(timing.emphasisEnd)}`}
          >
            <span className="timeline-bar-label">Emphasis</span>
          </div>
        ) : null}
        {exitDuration > 0 ? (
          <div
            className="timeline-bar exit"
            style={{ left: exitStart * pps, width: Math.max(4, exitDuration * pps) }}
            title={`Exit — ${timecode(exitStart)} to ${timecode(timing.exitEnd)}`}
          >
            <span className="timeline-bar-label">Exit</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function trackIcon(element: Element): JSX.Element {
  switch (element.kind) {
    case 'text':
      return <TypeIcon size={13} />
    case 'image':
      return <ImageIcon size={13} />
    case 'shape':
      return <Shapes size={13} />
    case 'svg':
    default:
      return <PenTool size={13} />
  }
}

function niceStep(pps: number): number {
  const target = Math.max(1, 52 / pps)
  const candidates = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600]
  return candidates.find((candidate) => candidate >= target) ?? 900
}

function timecode(seconds: number): string {
  const safe = Math.max(0, seconds)
  const minutes = Math.floor(safe / 60)
  const secs = Math.floor(safe % 60)
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}
