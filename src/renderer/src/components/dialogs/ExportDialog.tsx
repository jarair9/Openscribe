import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react'
import { CircleCheck, Film, FolderOpen, Images, Loader2, TriangleAlert } from 'lucide-react'
import { formatSeconds } from '@core/math'
import type { ExportEngineInfo, ExportFormat, ExportResult } from '@shared/ipc'
import { usePreferencesStore } from '../../state/preferencesStore'
import { useProjectStore } from '../../state/projectStore'
import { useUiStore } from '../../state/uiStore'
import { CheckField, SelectField } from '../inspector/controls'
import { SceneThumbnail } from '../shell/SceneThumbnail'
import { useExportStage } from '../overlays/ExportStage'
import { exportProject, isExportCancelled, type ExportProgress } from '../../services/exportProject'
import { Dialog } from './Dialog'

type QualityKey = 'draft' | 'standard' | 'high' | 'maximum'

/** x264 / vp9 rate factors, labelled the way an editor would promise them. */
const QUALITY: Record<QualityKey, number> = { draft: 30, standard: 23, high: 19, maximum: 15 }

const FORMATS: Array<{ value: ExportFormat; label: string }> = [
  { value: 'mp4', label: 'MP4 video' },
  { value: 'webm', label: 'WebM video' },
  { value: 'frames', label: 'PNG frames' }
]

/** Even sides keep the encoder from silently resizing the sequence. */
function evenSize(value: number): number {
  return Math.max(2, 2 * Math.round(value / 2))
}

function projectFolder(filePath: string | undefined): string {
  if (!filePath) return ''
  const cut = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  return cut > 0 ? filePath.slice(0, cut) : ''
}

const nextPaint = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })

export function ExportDialog({ onClose }: { onClose: () => void }): JSX.Element | null {
  const project = useProjectStore((state) => state.project)
  const session = useProjectStore((state) => state.session)
  const token = session?.assetToken ?? ''

  const preferences = usePreferencesStore()

  const [engine, setEngine] = useState<ExportEngineInfo | null>(null)
  const [format, setFormat] = useState<ExportFormat>(preferences.exportFormat)
  const [fps, setFps] = useState(project?.output.fps ?? 30)
  const [scale, setScale] = useState(preferences.exportScale)
  const [quality, setQuality] = useState<QualityKey>(preferences.exportQuality)
  const [keepFrames, setKeepFrames] = useState(preferences.keepFrames)
  const [dir, setDir] = useState(projectFolder(session?.filePath))
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<ExportProgress | null>(null)
  const [result, setResult] = useState<ExportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cancelled = useRef(false)
  const clock = useRef(0)
  const { schedule, stage, renderFrame, svgRef } = useExportStage(project, token)

  useEffect(() => {
    let live = true
    window.api.export
      .engine()
      .then((info) => {
        if (live) setEngine(info)
      })
      .catch(() => {
        if (live) setEngine({ path: null, bundled: false, version: null, canEncodeMp4: false })
      })
    return () => {
      live = false
    }
  }, [])

  const width = evenSize(((project?.output.width ?? 1280) * scale) / 100)
  const height = evenSize(((project?.output.height ?? 720) * scale) / 100)
  const totalFrames = Math.max(1, Math.round(schedule.duration * fps))
  const needsEngine = format !== 'frames'
  const engineReady = !needsEngine || Boolean(engine?.path)

  useEffect(() => {
    if (engine && !engine.path && format !== 'frames') setFormat('frames')
  }, [engine, format])

  const doneFrames = progress?.frame ?? 0
  const percent = progress ? Math.round((doneFrames / totalFrames) * 100) : 0
  const remaining = useMemo(() => {
    if (!progress || !clock.current || progress.frame === 0) return null
    const perFrame = (performance.now() - clock.current) / progress.frame
    return Math.max(0, Math.round(((totalFrames - progress.frame) * perFrame) / 1000))
  }, [progress, totalFrames])

  const close = useCallback(() => {
    if (running) {
      cancelled.current = true
      return
    }
    onClose()
  }, [running, onClose])

  const chooseDir = async (): Promise<void> => {
    const picked = await window.api.dialogs.pickExportDir()
    if (picked) setDir(picked)
  }

  const start = async (): Promise<void> => {
    if (!project || running || !dir) return
    // Remember the choices so the next export opens where this one left off.
    preferences.setExportFormat(format)
    preferences.setExportQuality(quality)
    preferences.setExportScale(scale)
    preferences.setKeepFrames(keepFrames)
    cancelled.current = false
    clock.current = performance.now()
    setRunning(true)
    setError(null)
    setResult(null)
    setProgress({ phase: 'frames', frame: 0, total: totalFrames })
    try {
      const finished = await exportProject({
        projectName: project.name,
        dir,
        format,
        fps,
        quality: QUALITY[quality],
        keepFrames: keepFrames || format === 'frames',
        width,
        height,
        duration: schedule.duration,
        onProgress: setProgress,
        cancelled: () => cancelled.current,
        captureFrame: async (time) => {
          await renderFrame(time)
          await nextPaint()
          return svgRef.current
        }
      })
      setResult(finished)
      useUiStore.getState().toast('Export finished.', 'success')
    } catch (caught) {
      if (isExportCancelled(caught)) {
        setProgress(null)
        useUiStore.getState().toast('Export cancelled.', 'info')
      } else {
        setError(caught instanceof Error ? caught.message : 'The export failed.')
      }
    } finally {
      setRunning(false)
    }
  }

  const reveal = (target: string | null): void => {
    if (!target) return
    window.api.export.reveal(target).catch((caught: unknown) =>
      useUiStore
        .getState()
        .toast(caught instanceof Error ? caught.message : 'Could not open that folder.', 'error')
    )
  }

  const strip = useMemo(() => {
    if (!project) return null
    return project.scenes.map((scene, index) => {
      const sceneSchedule = schedule.scenes[index]
      return (
        <figure className="export-cell" key={scene.id}>
          <div className="export-thumb">
            <SceneThumbnail
              project={project}
              scene={scene}
              sceneIndex={index}
              schedule={schedule}
              idPrefix={`export-thumb-${index}`}
            />
          </div>
          <figcaption>
            <span className="export-cell-index">{index + 1}</span>
            <span>{formatSeconds(sceneSchedule?.duration ?? 0, true)}</span>
          </figcaption>
        </figure>
      )
    })
  }, [project, schedule])

  if (!project) return null

  return (
    <Dialog
      title="Export video"
      subtitle="Render every frame of the project into a video file or a PNG sequence."
      wide
      onClose={close}
      footer={
        running ? (
          <>
            <span className="footer-hint">
              {progress?.phase === 'encoding'
                ? 'Encoding the frame sequence…'
                : progress?.phase === 'finishing'
                  ? 'Cleaning up…'
                  : `Frame ${doneFrames} of ${totalFrames}`}
            </span>
            <button className="btn" onClick={() => (cancelled.current = true)}>
              Cancel export
            </button>
          </>
        ) : result ? (
          <>
            <span className="footer-hint">
              {result.filePath ? 'Video written · ' : 'Frames written · '}
              {result.frameCount} frame{result.frameCount === 1 ? '' : 's'}
              {result.bytes ? ` · ${formatBytes(result.bytes)}` : ''}
            </span>
            <button className="btn" onClick={onClose}>
              Done
            </button>
            <button
              className="btn btn-primary"
              onClick={() => reveal(result.filePath ?? result.folder)}
            >
              <FolderOpen size={13} />
              {result.filePath ? 'Show file' : 'Open folder'}
            </button>
          </>
        ) : (
          <>
            <span className="footer-hint">
              {totalFrames} frames · {width}×{height} · {fps} fps
            </span>
            <button className="btn" onClick={close}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              disabled={!engineReady || !dir || schedule.duration <= 0}
              onClick={start}
            >
              <Film size={13} />
              Export
            </button>
          </>
        )
      }
    >
      <div className="export-layout">
        <section className="export-filmstrip">
          <header className="export-strip-head">
            <span>{project.name}</span>
            <span className="export-strip-length">{formatSeconds(schedule.duration, true)}</span>
          </header>
          <div className="export-strip-scroll">{strip}</div>
        </section>

        <div className="export-settings">
          <div className="field-row cols-2">
            <SelectField
              label="Format"
              value={format}
              options={FORMATS.map((entry) => ({ value: entry.value, label: entry.label }))}
              onChange={setFormat}
              disabled={running}
            />
            <SelectField
              label="Frame rate"
              value={String(fps)}
              options={[24, 25, 30, 50, 60].map((value) => ({
                value: String(value),
                label: `${value} fps`
              }))}
              onChange={(value) => setFps(Number(value))}
              disabled={running}
            />
          </div>

          <div className="field-row cols-2">
            <SelectField
              label="Size"
              value={String(scale)}
              options={[50, 100, 150, 200].map((value) => ({
                value: String(value),
                label: `${value}% · ${evenSize((project.output.width * value) / 100)}×${evenSize(
                  (project.output.height * value) / 100
                )}`
              }))}
              onChange={(value) => setScale(Number(value))}
              disabled={running}
            />
            <SelectField
              label="Quality"
              value={quality}
              options={[
                { value: 'draft', label: 'Draft (smallest)' },
                { value: 'standard', label: 'Standard' },
                { value: 'high', label: 'High' },
                { value: 'maximum', label: 'Maximum (largest)' }
              ]}
              onChange={(value) => setQuality(value as QualityKey)}
              disabled={running || format === 'frames'}
            />
          </div>

          <div className="field">
            <span className="field-label">Destination folder</span>
            <div className="export-dir">
              <input className="text-input" value={dir} readOnly placeholder="No folder chosen yet" />
              <button className="btn btn-sm" onClick={chooseDir} disabled={running}>
                <FolderOpen size={13} />
                Choose…
              </button>
            </div>
            <span className="hint">
              {format === 'frames'
                ? 'A folder of numbered PNGs is created here.'
                : `A ${format.toUpperCase()} and its frames folder are created here.`}
            </span>
          </div>

          {format === 'frames' ? null : (
            <CheckField
              label="Keep the PNG frames after encoding"
              checked={keepFrames}
              onChange={setKeepFrames}
              disabled={running}
            />
          )}

          {engine && !engine.path ? (
            <p className="export-note warn">
              <TriangleAlert size={14} />
              No video encoder was found on this computer, so only PNG frames can be written.
            </p>
          ) : (
            <p className="export-note">
              {format === 'frames' ? <Images size={14} /> : <Film size={14} />}
              {format === 'frames'
                ? 'Frames are written without an encoder.'
                : engine?.bundled
                  ? `Bundled encoder${engine.version ? ` · ${engine.version}` : ''}.`
                  : `Using ffmpeg from your system${engine?.version ? ` · ${engine.version}` : ''}.`}
            </p>
          )}

          {running ? (
            <div className="export-running">
              <div
                className="export-bar"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={totalFrames}
                aria-valuenow={doneFrames}
              >
                <div className="export-bar-fill" style={{ width: `${percent}%` }} />
              </div>
              <div className="export-running-meta">
                <span>
                  <Loader2 size={13} className="voice-spin" /> {percent}%
                </span>
                {remaining !== null ? <span>{formatSeconds(remaining, false)} left</span> : null}
              </div>
            </div>
          ) : null}

          {error ? <p className="export-error">{error}</p> : null}
          {result ? (
            <p className="export-done">
              <CircleCheck size={14} />
              Saved to {result.folder}
            </p>
          ) : null}
        </div>
      </div>
      {stage}
    </Dialog>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
