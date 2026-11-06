import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Camera as CameraIcon,
  Circle,
  Copy,
  Heading1,
  Image as ImageIcon,
  ImagePlus,
  Images,
  Loader2,
  Maximize2,
  Mic,
  Minus,
  Music2,
  Pilcrow,
  Plus,
  Square,
  Squircle,
  Trash2,
  Triangle,
  Type,
  X
} from 'lucide-react'
import { cameraFrame } from '@core/camera/sample'
import { rectFromCenter } from '@core/geometry'
import { formatSeconds } from '@core/math'
import {
  addCamera,
  addElement,
  addScene,
  duplicateScene,
  moveScene,
  removeCamera,
  removeScene,
  removeSceneAudioTrack,
  updateCamera
} from '@core/project/operations'
import { createCamera, createShapeElement, createTextElement, nextElementName } from '@core/schema/factories'
import type { ShapeKind } from '@core/schema/project'
import { buildSchedule } from '@core/timeline/schedule'
import { assetUrl } from '../../lib/assets'
import { seekToScene } from '../../hooks/usePlaybackClock'
import { importAssetsFromDialog } from '../../services/importAssets'
import { insertAssetAtPlayhead, sceneLocalTime } from '../../services/insertAsset'
import { saveVoiceover } from '../../services/voiceover'
import { useEditorStore, type SectionPanelId } from '../../state/editorStore'
import { useProjectStore } from '../../state/projectStore'
import { useUiStore } from '../../state/uiStore'
import { contentBoundsOf } from '../canvas/sceneBounds'
import { fitTextFrame } from '../canvas/textMetrics'
import { SceneThumbnail } from '../shell/SceneThumbnail'

const PANEL_TITLES: Record<SectionPanelId, string> = {
  scenes: 'Scenes',
  text: 'Text',
  image: 'Media',
  shapes: 'Shapes',
  camera: 'Camera',
  music: 'Music'
}

export function SectionPanel(): JSX.Element | null {
  const panel = useEditorStore((state) => state.sectionPanel)
  const close = useEditorStore((state) => state.closeSectionPanel)
  if (!panel) return null

  return (
    <aside className="section-panel" aria-label={`${PANEL_TITLES[panel]} panel`}>
      <header className="section-panel-head">
        <span className="section-panel-title">{PANEL_TITLES[panel]}</span>
        <button className="icon-btn" title="Close panel" aria-label="Close panel" onClick={close}>
          <X size={14} />
        </button>
      </header>
      <div className="section-panel-body">
        {panel === 'scenes' ? <ScenesPanel /> : null}
        {panel === 'text' ? <TextPanel /> : null}
        {panel === 'image' ? <ImagePanel /> : null}
        {panel === 'shapes' ? <ShapesPanel /> : null}
        {panel === 'camera' ? <CameraPanel /> : null}
        {panel === 'music' ? <MusicPanel /> : null}
      </div>
    </aside>
  )
}

/* ------------------------------------------------------------------ */
/* Scenes                                                             */
/* ------------------------------------------------------------------ */

function ScenesPanel(): JSX.Element | null {
  const project = useProjectStore((state) => state.project)
  const apply = useProjectStore((state) => state.apply)
  const activeSceneId = useEditorStore((state) => state.activeSceneId)
  const setActiveScene = useEditorStore((state) => state.setActiveScene)
  const askConfirm = useUiStore((state) => state.askConfirm)
  const schedule = useMemo(() => (project ? buildSchedule(project) : null), [project])

  if (!project || !schedule) return null

  const activeIndex = Math.max(
    0,
    project.scenes.findIndex((scene) => scene.id === activeSceneId)
  )
  const activeScene = project.scenes[activeIndex] ?? project.scenes[0]

  const activate = (sceneId: string): void => {
    setActiveScene(sceneId)
    seekToScene(sceneId)
  }

  const add = (): void => {
    let newId: string | null = null
    apply(
      'Add scene',
      (current) => {
        const result = addScene(current, { afterSceneId: activeScene?.id })
        newId = result.sceneId
        return result.project
      },
      { coalesce: false }
    )
    if (newId) activate(newId)
  }

  const duplicate = (): void => {
    if (!activeScene) return
    const result = duplicateScene(project, activeScene.id)
    if (!result) return
    apply('Duplicate scene', () => result.project, { coalesce: false })
    activate(result.sceneId)
  }

  const move = (offset: number): void => {
    if (!activeScene) return
    apply('Reorder scenes', (current) => moveScene(current, activeScene.id, offset), {
      coalesce: false
    })
  }

  const remove = async (sceneId?: string): Promise<void> => {
    const target = project.scenes.find((scene) => scene.id === sceneId) ?? activeScene
    if (!target || project.scenes.length <= 1) return
    const index = project.scenes.findIndex((scene) => scene.id === target.id)
    const confirmed = await askConfirm({
      title: 'Delete scene?',
      message: `“${target.name}” and its elements will be removed. This can be undone.`,
      confirmLabel: 'Delete scene'
    })
    if (!confirmed) return
    const nextScene = project.scenes[Math.max(0, index - 1)] ?? project.scenes[0]
    apply('Delete scene', (current) => removeScene(current, target.id), { coalesce: false })
    if (nextScene) activate(nextScene.id)
  }

  return (
    <>
      <div className="panel-list panel-scene-list" role="list" aria-label="Scene list">
        {project.scenes.map((scene, index) => {
          const sceneSchedule = schedule.scenes[index]
          return (
            <div
              key={scene.id}
              role="listitem"
              className={`panel-scene ${scene.id === activeSceneId ? 'active' : ''}`}
            >
              <button
                className="panel-scene-main"
                onClick={() => activate(scene.id)}
                title={scene.name}
              >
                <span className="panel-scene-thumb">
                  <SceneThumbnail
                    project={project}
                    scene={scene}
                    sceneIndex={index}
                    schedule={schedule}
                    idPrefix={`panel-${scene.id}`}
                  />
                </span>
                <span className="panel-scene-meta">
                  <span className="panel-scene-name">{scene.name}</span>
                  <span className="panel-scene-time">
                    {formatSeconds(sceneSchedule?.start ?? 0)} →{' '}
                    {formatSeconds((sceneSchedule?.start ?? 0) + (sceneSchedule?.duration ?? 0))}
                  </span>
                </span>
              </button>
              <button
                className="panel-scene-delete"
                title={
                  project.scenes.length <= 1
                    ? 'A project needs at least one scene'
                    : `Delete ${scene.name}`
                }
                aria-label={`Delete ${scene.name}`}
                disabled={project.scenes.length <= 1}
                onClick={() => void remove(scene.id)}
              >
                <Trash2 size={12} />
              </button>
            </div>
          )
        })}
      </div>
      <div className="panel-actionbar">
        <button className="icon-btn" title="Add scene" aria-label="Add scene" onClick={add}>
          <Plus size={15} />
        </button>
        <button
          className="icon-btn"
          title="Duplicate scene"
          aria-label="Duplicate scene"
          onClick={duplicate}
        >
          <Copy size={14} />
        </button>
        <button
          className="icon-btn"
          title="Move scene earlier"
          aria-label="Move scene earlier"
          disabled={activeIndex === 0}
          onClick={() => move(-1)}
        >
          <ArrowUp size={14} />
        </button>
        <button
          className="icon-btn"
          title="Move scene later"
          aria-label="Move scene later"
          disabled={activeIndex === project.scenes.length - 1}
          onClick={() => move(1)}
        >
          <ArrowDown size={14} />
        </button>
        <button
          className="icon-btn danger"
          title="Delete scene"
          aria-label="Delete scene"
          disabled={project.scenes.length <= 1}
          onClick={() => void remove()}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Text                                                               */
/* ------------------------------------------------------------------ */

const TEXT_PRESETS = [
  { id: 'heading', label: 'Heading', hint: 'Big title', icon: <Heading1 size={17} />, fontSize: 120, weight: 700, text: 'Your headline' },
  { id: 'body', label: 'Body text', hint: 'Sentence', icon: <Type size={17} />, fontSize: 72, weight: 500, text: 'Enter text here…' },
  { id: 'caption', label: 'Caption', hint: 'Small note', icon: <Pilcrow size={17} />, fontSize: 48, weight: 500, text: 'Caption' }
] as const

function TextPanel(): JSX.Element | null {
  const project = useProjectStore((state) => state.project)
  const apply = useProjectStore((state) => state.apply)
  const setTool = useEditorStore((state) => state.setTool)
  const activeSceneId = useEditorStore((state) => state.activeSceneId)
  if (!project) return null

  const scene =
    project.scenes.find((candidate) => candidate.id === activeSceneId) ?? project.scenes[0]
  if (!scene) return null

  const addPreset = (preset: (typeof TEXT_PRESETS)[number]): void => {
    const camera = scene.cameras[0]
    const center = camera?.center ?? { x: 0, y: 0 }
    const viewWidth = camera?.viewWidth ?? project.output.width
    const element = createTextElement(preset.text, {
      name: nextElementName(scene.elements, preset.label),
      frame: rectFromCenter(
        center,
        viewWidth * 0.6,
        preset.fontSize * (preset.id === 'caption' ? 1.4 : 1.8)
      )
    })
    Object.assign(element, {
      fontSize: preset.fontSize,
      fontWeight: preset.weight,
      align: 'center' as const
    })
    element.frame = fitTextFrame(element)
    apply('Add text', (current) => addElement(current, scene.id, element), { coalesce: false })
    useEditorStore.getState().select([element.id])
  }

  return (
    <div className="panel-stack">
      <p className="panel-lead">Add text, then double-click it on the canvas to type.</p>
      {TEXT_PRESETS.map((preset) => (
        <button key={preset.id} className="panel-big-option" onClick={() => addPreset(preset)}>
          <span className="panel-option-icon">{preset.icon}</span>
          <span className="panel-option-text">
            <span className="panel-option-title">{preset.label}</span>
            <span className="panel-option-hint">{preset.hint}</span>
          </span>
          <Plus size={14} className="panel-option-plus" />
        </button>
      ))}
      <div className="panel-divider" />
      <button className="btn btn-sm panel-wide-btn" onClick={() => setTool('text')}>
        <Type size={13} /> Place text on canvas
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Images                                                             */
/* ------------------------------------------------------------------ */

function ImagePanel(): JSX.Element | null {
  const project = useProjectStore((state) => state.project)
  const session = useProjectStore((state) => state.session)
  if (!project || !session) return null

  const visuals = project.assets.filter((asset) => asset.kind === 'svg' || asset.kind === 'image')

  return (
    <div className="panel-stack panel-stack-fill">
      <button className="btn btn-sm panel-wide-btn" onClick={() => void importAssetsFromDialog()}>
        <ImagePlus size={13} /> Import images or SVG
      </button>
      <button className="btn btn-sm panel-wide-btn" onClick={() => useUiStore.getState().openDialog('assetLibrary')}>
        <Images size={13} /> Browse asset library
      </button>
      {visuals.length === 0 ? (
        <div className="panel-empty">
          <ImageIcon size={22} />
          <span>No artwork yet.</span>
          <span className="panel-empty-hint">SVG files animate with a drawing hand.</span>
        </div>
      ) : (
        <div className="panel-asset-grid">
          {visuals.map((asset) => (
            <button
              key={asset.id}
              className="panel-asset"
              title={`Insert ${asset.name}`}
              onClick={() => insertAssetAtPlayhead(asset)}
            >
              <img src={assetUrl(session.assetToken, asset.fileName)} alt={asset.name} loading="lazy" />
              <span>{asset.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Shapes                                                             */
/* ------------------------------------------------------------------ */

const SHAPES: Array<{ shape: ShapeKind; label: string; shortcut: string; icon: JSX.Element }> = [
  { shape: 'rectangle', label: 'Rectangle', shortcut: 'R', icon: <Square size={17} /> },
  { shape: 'roundedRectangle', label: 'Rounded', shortcut: 'U', icon: <Squircle size={17} /> },
  { shape: 'ellipse', label: 'Ellipse', shortcut: 'O', icon: <Circle size={17} /> },
  { shape: 'triangle', label: 'Triangle', shortcut: 'Y', icon: <Triangle size={17} /> },
  { shape: 'line', label: 'Line', shortcut: 'L', icon: <Minus size={17} /> },
  { shape: 'arrow', label: 'Arrow', shortcut: 'A', icon: <ArrowUpRight size={17} /> }
]

function ShapesPanel(): JSX.Element | null {
  const project = useProjectStore((state) => state.project)
  const apply = useProjectStore((state) => state.apply)
  const activeSceneId = useEditorStore((state) => state.activeSceneId)
  if (!project) return null

  const scene =
    project.scenes.find((candidate) => candidate.id === activeSceneId) ?? project.scenes[0]
  if (!scene) return null

  const insert = (shape: ShapeKind): void => {
    const camera = scene.cameras[0]
    const center = camera?.center ?? { x: 0, y: 0 }
    const viewWidth = camera?.viewWidth ?? project.output.width
    const isLine = shape === 'line' || shape === 'arrow'
    const element = createShapeElement(shape, {
      name: nextElementName(scene.elements, SHAPES.find((entry) => entry.shape === shape)?.label ?? 'Shape'),
      frame: rectFromCenter(center, viewWidth * 0.36, viewWidth * (isLine ? 0.16 : 0.24))
    })
    apply('Add shape', (current) => addElement(current, scene.id, element), { coalesce: false })
    useEditorStore.getState().select([element.id])
  }

  return (
    <div className="panel-stack">
      <p className="panel-lead">Click to place a shape in the center, or use a shortcut and drag.</p>
      <div className="panel-shape-grid">
        {SHAPES.map((entry) => (
          <button
            key={entry.shape}
            className="panel-shape"
            title={`Insert ${entry.label.toLowerCase()} (${entry.shortcut} to draw)`}
            onClick={() => insert(entry.shape)}
          >
            <span className="panel-shape-icon">{entry.icon}</span>
            <span className="panel-shape-label">{entry.label}</span>
            <span className="panel-shape-key">{entry.shortcut}</span>
          </button>
        ))}
      </div>
      <p className="panel-hint">
        Shapes are drawn on by the hand when they animate. Change weight and color in the inspector.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Camera                                                             */
/* ------------------------------------------------------------------ */

function CameraPanel(): JSX.Element | null {
  const project = useProjectStore((state) => state.project)
  const apply = useProjectStore((state) => state.apply)
  const activeSceneId = useEditorStore((state) => state.activeSceneId)
  const selectedCameraId = useEditorStore((state) => state.selectedCameraId)
  const selectCamera = useEditorStore((state) => state.selectCamera)
  const toast = useUiStore((state) => state.toast)
  if (!project) return null

  const scene =
    project.scenes.find((candidate) => candidate.id === activeSceneId) ?? project.scenes[0]
  if (!scene) return null

  const add = (): void => {
    const localTime = sceneLocalTime(project, scene)
    const sceneSchedule = buildSchedule(project).scenes[project.scenes.indexOf(scene)]
    const duration = sceneSchedule?.duration ?? 1
    const base = scene.cameras.find((camera) => camera.startTime <= localTime) ?? scene.cameras[0]
    const frame = base ? cameraFrame(base, project.output) : null
    const camera = createCamera({
      center: frame
        ? { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 }
        : { x: 0, y: 0 },
      viewWidth: frame ? frame.width * 0.75 : project.output.width,
      name: `Camera ${scene.cameras.length + 1}`,
      startTime: Math.max(0.1, Math.min(localTime, Math.max(0.1, duration - 0.1)))
    })
    apply('Add camera', (current) => addCamera(current, scene.id, camera), { coalesce: false })
    selectCamera(camera.id)
  }

  const fitArtwork = (): void => {
    if (!selectedCameraId) return
    const bounds = contentBoundsOf(scene)
    if (!bounds) {
      toast('Add artwork to the scene first.', 'info')
      return
    }
    const aspect = project.output.width / project.output.height
    const viewWidth = Math.max(bounds.width, bounds.height * aspect) * 1.15
    apply(
      'Fit camera to artwork',
      (current) =>
        updateCamera(current, scene.id, selectedCameraId, (camera) => ({
          ...camera,
          center: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
          viewWidth: Math.max(16, viewWidth)
        })),
      { coalesce: false }
    )
  }

  const remove = (): void => {
    if (!selectedCameraId) return
    if (scene.cameras.length <= 1) {
      toast('A scene needs at least one camera.', 'info')
      return
    }
    apply('Remove camera', (current) => removeCamera(current, scene.id, selectedCameraId), {
      coalesce: false
    })
    selectCamera(null)
  }

  return (
    <div className="panel-stack">
      <div className="panel-list" role="list" aria-label="Cameras">
        {scene.cameras.map((camera) => (
          <button
            key={camera.id}
            className={`panel-row ${camera.id === selectedCameraId ? 'active' : ''}`}
            onClick={() => selectCamera(camera.id)}
          >
            <span className="panel-row-icon">
              <CameraIcon size={15} />
            </span>
            <span className="panel-row-text">
              <span className="panel-row-title">{camera.name}</span>
              <span className="panel-row-sub">Starts at {formatSeconds(camera.startTime)}</span>
            </span>
            <span className="panel-row-meta">{Math.round(camera.viewWidth)} px</span>
          </button>
        ))}
      </div>
      <button className="btn btn-sm panel-wide-btn" onClick={add}>
        <Plus size={13} /> Add camera at playhead
      </button>
      <div className="panel-row-actions">
        <button className="btn btn-sm" disabled={!selectedCameraId} onClick={fitArtwork}>
          <Maximize2 size={13} /> Fit artwork
        </button>
        <button
          className="btn btn-sm btn-danger"
          disabled={!selectedCameraId || scene.cameras.length <= 1}
          onClick={remove}
        >
          <Trash2 size={13} /> Delete
        </button>
      </div>
      <p className="panel-hint">
        Cameras switch at their start time. Drag or resize the magenta frame on the canvas.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Music                                                              */
/* ------------------------------------------------------------------ */

function MusicPanel(): JSX.Element | null {
  const project = useProjectStore((state) => state.project)
  const apply = useProjectStore((state) => state.apply)
  const activeSceneId = useEditorStore((state) => state.activeSceneId)
  if (!project) return null

  const scene =
    project.scenes.find((candidate) => candidate.id === activeSceneId) ?? project.scenes[0]
  if (!scene) return null
  const audioAssets = project.assets.filter((asset) => asset.kind === 'audio')

  return (
    <div className="panel-stack panel-stack-fill">
      <button className="btn btn-sm panel-wide-btn" onClick={() => void importAssetsFromDialog()}>
        <ImagePlus size={13} /> Import audio
      </button>

      <VoiceRecorder />

      {scene.audio.length === 0 ? (
        <div className="panel-empty">
          <Music2 size={22} />
          <span>No audio in this scene.</span>
          <span className="panel-empty-hint">Audio starts at the playhead.</span>
        </div>
      ) : (
        <div className="panel-list" role="list" aria-label="Scene audio">
          {scene.audio.map((track) => (
            <div key={track.id} className="panel-row static">
              <span className="panel-row-icon">
                <Music2 size={15} />
              </span>
              <span className="panel-row-text">
                <span className="panel-row-title">{track.name}</span>
                <span className="panel-row-sub">Starts at {formatSeconds(track.startTime)}</span>
              </span>
              <button
                className="icon-btn danger"
                title="Remove audio"
                aria-label={`Remove ${track.name}`}
                onClick={() =>
                  apply(
                    'Remove audio',
                    (current) => removeSceneAudioTrack(current, scene.id, track.id),
                    { coalesce: false }
                  )
                }
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {audioAssets.length > 0 ? (
        <>
          <div className="panel-divider" />
          <div className="panel-subtitle">Audio files</div>
          <div className="panel-asset-grid audio">
            {audioAssets.map((asset) => (
              <button
                key={asset.id}
                className="panel-asset audio"
                title={`Add ${asset.name} at playhead`}
                onClick={() => insertAssetAtPlayhead(asset)}
              >
                <span className="panel-asset-audio-icon">
                  <Music2 size={20} />
                </span>
                <span>{asset.name}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Voice recording                                                    */
/* ------------------------------------------------------------------ */

function VoiceRecorder(): JSX.Element {
  const [state, setState] = useState<'idle' | 'starting' | 'recording' | 'saving'>('idle')
  const [elapsed, setElapsed] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)
  const startedAtRef = useRef(0)
  const cancelledRef = useRef(false)
  const mountedRef = useRef(true)
  const toast = useUiStore((store) => store.toast)

  const stopTimer = (): void => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const releaseStream = (): void => {
    stopTimer()
    for (const track of streamRef.current?.getTracks() ?? []) track.stop()
    streamRef.current = null
  }

  const finish = async (mimeType: string): Promise<void> => {
    releaseStream()
    const chunks = chunksRef.current
    chunksRef.current = []
    if (cancelledRef.current || chunks.length === 0) {
      if (mountedRef.current) setState('idle')
      return
    }
    if (mountedRef.current) setState('saving')
    const blob = new Blob(chunks, { type: mimeType || 'audio/webm' })
    await saveVoiceover(blob)
    if (mountedRef.current) setState('idle')
  }

  useEffect(() => {
    return () => {
      mountedRef.current = false
      cancelledRef.current = true
      stopTimer()
      const recorder = recorderRef.current
      if (recorder && recorder.state !== 'inactive') recorder.stop()
      releaseStream()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const start = async (): Promise<void> => {
    if (state !== 'idle') return
    setState('starting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      })
      streamRef.current = stream
      const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4'
      ]
      const mimeType = candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      cancelledRef.current = false
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => void finish(recorder.mimeType)
      recorderRef.current = recorder
      recorder.start(200)
      startedAtRef.current = performance.now()
      setElapsed(0)
      timerRef.current = window.setInterval(() => {
        setElapsed((performance.now() - startedAtRef.current) / 1000)
      }, 100)
      setState('recording')
    } catch (error) {
      releaseStream()
      setState('idle')
      toast(
        error instanceof Error && error.name === 'NotAllowedError'
          ? 'Microphone access was denied. Allow the microphone and try again.'
          : 'No microphone is available for recording.',
        'error'
      )
    }
  }

  const stop = (): void => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
  }

  const cancel = (): void => {
    cancelledRef.current = true
    stop()
  }

  return (
    <div className="voice-recorder">
      {state === 'recording' ? (
        <div className="voice-recorder-live">
          <span className="voice-live-dot" />
          <span className="voice-live-label">Recording</span>
          <span className="voice-timer">{formatSeconds(elapsed)}</span>
          <span className="voice-recorder-spacer" />
          <button className="btn btn-sm voice-stop" onClick={stop}>
            <Square size={10} /> Stop
          </button>
          <button
            className="icon-btn"
            title="Discard recording"
            aria-label="Discard recording"
            onClick={cancel}
          >
            <X size={13} />
          </button>
        </div>
      ) : state === 'saving' ? (
        <div className="voice-recorder-status">
          <Loader2 size={14} className="voice-spin" />
          Adding voiceover…
        </div>
      ) : (
        <button
          className="btn btn-sm panel-wide-btn voice-record-btn"
          disabled={state === 'starting'}
          onClick={() => void start()}
        >
          <Mic size={13} />
          {state === 'starting' ? 'Starting microphone…' : 'Record voiceover'}
        </button>
      )}
      <p className="panel-hint voice-hint">
        Records from your microphone and starts at the playhead.
      </p>
    </div>
  )
}
