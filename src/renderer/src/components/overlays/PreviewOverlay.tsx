import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX
} from 'react'
import { Pause, Play, RotateCcw, Volume2, VolumeX, X, ZoomIn, ZoomOut } from 'lucide-react'
import { evaluateScene } from '@core/animation/scene'
import { clamp, clamp01, formatSeconds } from '@core/math'
import type { Rect } from '@core/schema/primitives'
import type { Project } from '@core/schema/project'
import {
  buildSchedule,
  sceneAt,
  type ProjectSchedule
} from '@core/timeline/schedule'
import { assetUrl } from '../../lib/assets'
import { togglePlayback } from '../../hooks/usePlaybackClock'
import { usePlaybackStore } from '../../state/playbackStore'
import { useProjectStore } from '../../state/projectStore'
import { useUiStore } from '../../state/uiStore'
import { drawablePathKey, InstrumentOverlay } from '../canvas/InstrumentOverlay'
import { findActiveInstrument } from '../canvas/instrumentState'
import { SceneArtwork } from '../canvas/SceneArtwork'

const EMPTY_SCHEDULE: ProjectSchedule = { version: 1, duration: 0, scenes: [], elements: {} }

const ZOOM_MIN = 0.5
const ZOOM_MAX = 4

/** Zoom keeps the camera's centre and shrinks the window into it. */
function zoomedFrame(frame: Rect, zoom: number): Rect {
  const width = frame.width / zoom
  const height = frame.height / zoom
  return {
    x: frame.x + (frame.width - width) / 2,
    y: frame.y + (frame.height - height) / 2,
    width,
    height
  }
}

export function PreviewOverlay(): JSX.Element | null {
  const project = useProjectStore((state) => state.project)
  const session = useProjectStore((state) => state.session)
  const open = useUiStore((state) => state.previewOpen)
  const closePreview = useUiStore((state) => state.closePreview)
  const time = usePlaybackStore((state) => state.time)
  const playing = usePlaybackStore((state) => state.playing)
  const rate = usePlaybackStore((state) => state.rate)
  const setRate = usePlaybackStore((state) => state.setRate)
  const setTime = usePlaybackStore((state) => state.setTime)

  const [muted, setMuted] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [previewViewport, setPreviewViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }))
  const previous = useRef<{ time: number; rate: number } | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const pathRefs = useRef<Map<string, SVGPathElement>>(new Map())

  const schedule = useMemo(() => (project ? buildSchedule(project) : EMPTY_SCHEDULE), [project])

  const current = useMemo(() => {
    if (!project || schedule.scenes.length === 0) return null
    const at = sceneAt(schedule, time)
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
      sceneSchedule: at.scene,
      visual,
      instrument: findActiveInstrument(sceneDoc, visual, at.scene.elements)
    }
  }, [project, schedule, time])

  const registerPath = useCallback((elementId: string, drawableId: string, path: SVGPathElement | null) => {
    const key = drawablePathKey(elementId, drawableId)
    if (path) pathRefs.current.set(key, path)
    else pathRefs.current.delete(key)
  }, [])

  const token = session?.assetToken ?? ''

  usePreviewAudio(project, schedule, token, open, muted)

  useEffect(() => {
    if (!open) return
    const playback = usePlaybackStore.getState()
    previous.current = { time: playback.time, rate: playback.rate }
    playback.setRate(1)
    playback.setTime(0)
    playback.play()
    return () => {
      const state = usePlaybackStore.getState()
      state.pause()
      if (previous.current) {
        state.setTime(previous.current.time)
        state.setRate(previous.current.rate)
      }
      previous.current = null
    }
  }, [open])

  useEffect(() => {
    const updateSize = (): void => setPreviewViewport({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  useEffect(() => {
    if (!open) return
    const handler = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closePreview()
        return
      }
      const target = event.target
      if (target instanceof HTMLElement) {
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'SELECT' ||
          target.tagName === 'TEXTAREA' ||
          target.closest('button')
        ) {
          return
        }
      }
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault()
        togglePlayback(schedule.duration)
        return
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault()
        const state = usePlaybackStore.getState()
        state.pause()
        const step = event.shiftKey ? 5 : 1
        state.setTime(clamp(state.time + (event.key === 'ArrowLeft' ? -step : step), 0, schedule.duration))
      }
      if (event.key === 'Home') {
        event.preventDefault()
        setTime(0)
      }
      if (event.key === 'End') {
        event.preventDefault()
        setTime(schedule.duration)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, closePreview, schedule.duration, setTime])

  if (!open || !project || !current) return null

  const { sceneDoc, sceneSchedule, visual, instrument } = current
  const camera = visual.camera.frame
  const view = zoomedFrame(camera, zoom)
  const previewAspect = project.output.width / project.output.height
  const previewStageWidth = Math.min(previewViewport.width, Math.max(0, previewViewport.height - 116) * previewAspect)
  const progress = schedule.duration > 0 ? clamp01(time / schedule.duration) : 0
  const sceneNumber = sceneSchedule.index + 1
  return (
    <div
      className={`preview-overlay ${playing ? 'playing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Project preview"
    >
      <header className="preview-top">
        <div className="preview-project">
          <span className="preview-project-name">{project.name}</span>
        </div>
        <div className="preview-shot">
          <span>
            Scene {sceneNumber} / {project.scenes.length}
          </span>
        </div>
        <button
          className="preview-close"
          title="Close preview (Esc)"
          aria-label="Close preview"
          onClick={closePreview}
        >
          <X size={18} />
        </button>
      </header>

      <div className="preview-stage-wrap">
        <div
          className="preview-stage"
          style={{
            width: `${previewStageWidth}px`,
            aspectRatio: `${project.output.width} / ${project.output.height}`,
            ['--preview-aspect' as string]: `${project.output.width / project.output.height}`
          }}
        >
          <svg
            ref={svgRef}
            className="preview-svg"
            viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <clipPath id={`preview-art-frame-${sceneDoc.id}`} clipPathUnits="userSpaceOnUse">
                <rect x={camera.x} y={camera.y} width={camera.width} height={camera.height} />
              </clipPath>
            </defs>
            <g clipPath={`url(#preview-art-frame-${sceneDoc.id})`}>
              <SceneArtwork
                project={project}
                scene={sceneDoc}
                visual={visual}
                token={token}
                idPrefix={`preview-${sceneDoc.id}`}
                backgroundFrame={camera}
                registerPath={registerPath}
              />
            </g>
            <g clipPath={`url(#preview-art-frame-${sceneDoc.id})`}>
              <InstrumentOverlay
                active={instrument}
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
      </div>

      <footer className="preview-controls">
        <button
          className="preview-play"
          title={playing ? 'Pause (Space)' : 'Play (Space)'}
          aria-label={playing ? 'Pause' : 'Play'}
          onClick={() => togglePlayback(schedule.duration)}
        >
          {playing ? <Pause size={17} /> : <Play size={17} />}
        </button>
        <button
          className="preview-icon-btn"
          title="Restart from the beginning"
          aria-label="Restart preview"
          onClick={() => {
            setTime(0)
            usePlaybackStore.getState().play()
          }}
        >
          <RotateCcw size={15} />
        </button>
        <span className="preview-time">
          {formatSeconds(time, true)} <span className="preview-time-dim">/ {formatSeconds(schedule.duration, true)}</span>
        </span>
        <input
          className="preview-scrubber"
          type="range"
          min={0}
          max={Math.max(0.1, schedule.duration)}
          step={0.01}
          value={Math.min(time, schedule.duration)}
          aria-label="Preview position"
          onChange={(event) => {
            usePlaybackStore.getState().pause()
            setTime(Number(event.target.value))
          }}
        />
        <span className="preview-percent">{Math.round(progress * 100)}%</span>
        <div className="preview-zoom" role="group" aria-label="Preview zoom">
          <button
            className="preview-icon-btn"
            title="Zoom out"
            aria-label="Zoom out"
            onClick={() => setZoom((value) => clamp(value / 1.25, ZOOM_MIN, ZOOM_MAX))}
          >
            <ZoomOut size={15} />
          </button>
          <button
            className="preview-zoom-level"
            title="Reset zoom"
            onClick={() => setZoom(1)}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            className="preview-icon-btn"
            title="Zoom in"
            aria-label="Zoom in"
            onClick={() => setZoom((value) => clamp(value * 1.25, ZOOM_MIN, ZOOM_MAX))}
          >
            <ZoomIn size={15} />
          </button>
        </div>
        <select
          className="select-input preview-rate"
          value={String(rate)}
          title="Preview speed"
          aria-label="Preview speed"
          onChange={(event) => setRate(Number(event.target.value))}
        >
          <option value="0.5">0.5×</option>
          <option value="1">1×</option>
          <option value="1.5">1.5×</option>
          <option value="2">2×</option>
        </select>
        <button
          className={`preview-icon-btn ${muted ? 'active' : ''}`}
          title={muted ? 'Unmute audio' : 'Mute audio'}
          aria-label={muted ? 'Unmute audio' : 'Mute audio'}
          aria-pressed={muted}
          onClick={() => setMuted((value) => !value)}
        >
          {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </button>
      </footer>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Audio                                                              */
/* ------------------------------------------------------------------ */

interface PreviewAudioEntry {
  id: string
  url: string
  start: number
  duration: number
  inPoint: number
  volume: number
  fadeIn: number
  fadeOut: number
}

function usePreviewAudio(
  project: Project | null,
  schedule: ProjectSchedule,
  token: string,
  active: boolean,
  muted: boolean
): void {
  const time = usePlaybackStore((state) => state.time)
  const playing = usePlaybackStore((state) => state.playing)
  const rate = usePlaybackStore((state) => state.rate)
  const audios = useRef<Map<string, HTMLAudioElement>>(new Map())

  const entries = useMemo<PreviewAudioEntry[]>(() => {
    if (!project) return []
    const list: PreviewAudioEntry[] = []
    const push = (
      track: Project['scenes'][number]['audio'][number],
      absoluteStart: number
    ): void => {
      const asset = project.assets.find((candidate) => candidate.id === track.assetId)
      if (!asset || asset.kind !== 'audio') return
      const sourceDuration = asset.audio?.duration ?? 0
      const outPoint = track.outPoint ?? sourceDuration
      const duration = Math.max(0, outPoint - track.inPoint)
      if (duration <= 0) return
      list.push({
        id: track.id,
        url: assetUrl(token, asset.fileName),
        start: absoluteStart,
        duration,
        inPoint: track.inPoint,
        volume: clamp(track.volume, 0, 1),
        fadeIn: track.fadeIn,
        fadeOut: track.fadeOut
      })
    }

    schedule.scenes.forEach((sceneSchedule, index) => {
      const scene = project.scenes[index]
      if (!scene) return
      for (const track of scene.audio) push(track, sceneSchedule.start + track.startTime)
    })
    for (const track of project.audio) push(track, track.startTime)
    return list
  }, [project, schedule, token])

  useEffect(() => {
    const map = new Map<string, HTMLAudioElement>()
    for (const entry of entries) {
      const audio = new Audio(entry.url)
      audio.preload = 'auto'
      map.set(entry.id, audio)
    }
    audios.current = map
    return () => {
      for (const audio of map.values()) {
        audio.pause()
        audio.removeAttribute('src')
        audio.load()
      }
      audios.current = new Map()
    }
  }, [entries])

  useEffect(() => {
    for (const entry of entries) {
      const audio = audios.current.get(entry.id)
      if (!audio) continue
      audio.muted = muted
      audio.playbackRate = clamp(rate, 0.25, 4)
      if (!active) {
        audio.pause()
        continue
      }
      const local = time - entry.start
      if (local < 0 || local >= entry.duration) {
        audio.pause()
        audio.currentTime = entry.inPoint
        continue
      }
      const expected = entry.inPoint + local
      let gain = entry.volume
      if (entry.fadeIn > 0.01) gain *= clamp01(local / entry.fadeIn)
      const remaining = entry.duration - local
      if (entry.fadeOut > 0.01) gain *= clamp01(remaining / entry.fadeOut)
      audio.volume = clamp01(gain)

      if (playing) {
        if (Math.abs(audio.currentTime - expected) > 0.35) audio.currentTime = expected
        if (audio.paused) void audio.play().catch(() => {})
      } else {
        audio.pause()
        if (Math.abs(audio.currentTime - expected) > 0.05) audio.currentTime = expected
      }
    }
  }, [entries, time, playing, rate, active, muted])
}
