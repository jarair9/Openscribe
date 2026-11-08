import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Camera as CameraIcon,
  ChevronRight,
  Circle,
  Copy,
  Heading1,
  Image as ImageIcon,
  Eye,
  EyeOff,
  ImagePlus,
  Images,
  Loader2,
  Lock,
  LockOpen,
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
  bringElementForward,
  duplicateScene,
  moveScene,
  removeCamera,
  removeScene,
  removeSceneAudioTrack,
  sendElementBackward,
  updateCamera,
  updateElement
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
  layers: 'Layers',
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
        {panel === 'layers' ? <LayersPanel /> : null}
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
/* Layers                                                             */
/* ------------------------------------------------------------------ */

function LayersPanel(): JSX.Element | null {
  const project = useProjectStore((state) => state.project)
  const apply = useProjectStore((state) => state.apply)
  const activeSceneId = useEditorStore((state) => state.activeSceneId)
  const selection = useEditorStore((state) => state.selection)
  const select = useEditorStore((state) => state.select)
  if (!project) return null

  const scene =
    project.scenes.find((candidate) => candidate.id === activeSceneId) ?? project.scenes[0]
  if (!scene) return null

  // Front-most element sits at the top of the list, the way layer panels read.
  const layers = [...scene.elements].reverse()
  const selected = new Set(selection)

  const toggle = (id: string, visible: boolean): void => {
    apply(
      visible ? 'Hide layer' : 'Show layer',
      (current) =>
        updateElement(current, scene.id, id, (element) => ({ ...element, visible })),
      { coalesce: false }
    )
  }

  const toggleLock = (id: string, locked: boolean): void => {
    apply(
      locked ? 'Lock layer' : 'Unlock layer',
      (current) =>
        updateElement(current, scene.id, id, (element) => ({ ...element, locked })),
      { coalesce: false }
    )
  }

  const reorder = (id: string, direction: 'forward' | 'backward'): void => {
    apply(
      direction === 'forward' ? 'Bring layer forward' : 'Send layer backward',
      (current) =>
        direction === 'forward'
          ? bringElementForward(current, scene.id, id)
          : sendElementBackward(current, scene.id, id),
      { coalesce: false }
    )
  }

  return (
    <div className="panel-stack panel-stack-fill layers-panel">
      {layers.length === 0 ? (
        <div className="panel-empty">
          <Square size={22} />
          <span>This scene is empty.</span>
          <span className="panel-empty-hint">Add text, artwork or a shape to see it here.</span>
        </div>
      ) : (
        <div className="panel-list layers-list" role="list" aria-label="Scene layers">
          {layers.map((element) => {
            const active = selected.has(element.id)
            return (
              <div
                key={element.id}
                role="listitem"
                className={`layer-row ${active ? 'active' : ''} ${
                  element.visible ? '' : 'hidden-layer'
                }`}
              >
                <button
                  className="layer-main"
                  onClick={() => select([element.id])}
                  title={`${element.name}${element.locked ? ' · locked' : ''}`}
                >
                  <span className="layer-kind">
                    {element.kind === 'text' ? (
                      <Type size={13} />
                    ) : element.kind === 'image' || element.kind === 'svg' ? (
                      <ImageIcon size={13} />
                    ) : (
                      <Square size={13} />
                    )}
                  </span>
                  <span className="layer-name">{element.name}</span>
                </button>
                <div className="layer-actions">
                  <button
                    className="layer-btn"
                    title={element.visible ? 'Hide layer' : 'Show layer'}
                    aria-label={element.visible ? 'Hide layer' : 'Show layer'}
                    aria-pressed={!element.visible}
                    onClick={() => toggle(element.id, !element.visible)}
                  >
                    {element.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                  </button>
                  <button
                    className={`layer-btn ${element.locked ? 'active' : ''}`}
                    title={element.locked ? 'Unlock layer' : 'Lock layer'}
                    aria-label={element.locked ? 'Unlock layer' : 'Lock layer'}
                    aria-pressed={element.locked}
                    onClick={() => toggleLock(element.id, !element.locked)}
                  >
                    {element.locked ? <Lock size={12} /> : <LockOpen size={12} />}
                  </button>
                  <button
                    className="layer-btn"
                    title="Bring forward"
                    aria-label="Bring forward"
                    onClick={() => reorder(element.id, 'forward')}
                  >
                    <ArrowUp size={12} />
                  </button>
                  <button
                    className="layer-btn"
                    title="Send backward"
                    aria-label="Send backward"
                    onClick={() => reorder(element.id, 'backward')}
                  >
                    <ArrowDown size={12} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
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

  const setCameraFlag = (cameraId: string, patch: { visible?: boolean; locked?: boolean }): void => {
    apply(
      patch.visible !== undefined ? 'Toggle camera visibility' : 'Toggle camera lock',
      (current) => updateCamera(current, scene.id, cameraId, (camera) => ({ ...camera, ...patch })),
      { coalesce: false }
    )
  }

  return (
    <div className="panel-stack">
      <div className="panel-list" role="list" aria-label="Cameras">
        {scene.cameras.map((camera) => (
          <div
            key={camera.id}
            role="button"
            tabIndex={0}
            className={`panel-row camera-row ${camera.id === selectedCameraId ? 'active' : ''} ${
              camera.visible === false ? 'camera-row-hidden' : ''
            }`}
            onClick={() => selectCamera(camera.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                selectCamera(camera.id)
              }
            }}
          >
            <span className="panel-row-icon">
              <CameraIcon size={15} />
            </span>
            <span className="panel-row-text">
              <span className="panel-row-title">{camera.name}</span>
              <span className="panel-row-sub">
                {camera.visible === false ? 'Hidden · ' : ''}Starts at{' '}
                {formatSeconds(camera.startTime)}
              </span>
            </span>
            <span className="panel-row-meta">{Math.round(camera.viewWidth)} px</span>
            <span className="camera-row-actions">
              <button
                className="icon-btn"
                title={camera.visible === false ? 'Show frame' : 'Hide frame'}
                aria-label={camera.visible === false ? 'Show camera frame' : 'Hide camera frame'}
                aria-pressed={camera.visible === false}
                onClick={(event) => {
                  event.stopPropagation()
                  setCameraFlag(camera.id, { visible: camera.visible === false })
                }}
              >
                {camera.visible === false ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
              <button
                className={`icon-btn ${camera.locked ? 'active' : ''}`}
                title={camera.locked ? 'Unlock camera' : 'Lock camera'}
                aria-label={camera.locked ? 'Unlock camera' : 'Lock camera'}
                aria-pressed={camera.locked}
                onClick={(event) => {
                  event.stopPropagation()
                  setCameraFlag(camera.id, { locked: !camera.locked })
                }}
              >
                {camera.locked ? <Lock size={12} /> : <LockOpen size={12} />}
              </button>
            </span>
          </div>
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
        Click a frame on the canvas to select it, then drag it or use its corner and edge handles to
        expand and compress. The eye hides a frame; the lock keeps it from moving.
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
  const selectedAudioTrackId = useEditorStore((state) => state.selectedAudioTrackId)
  const selectAudioTrack = useEditorStore((state) => state.selectAudioTrack)
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
          {scene.audio.map((track) => {
            const selected = track.id === selectedAudioTrackId
            return (
              <div
                key={track.id}
                className={`panel-row audio-row${selected ? ' active' : ''}`}
                role="button"
                tabIndex={0}
                aria-expanded={selected}
                title="Open track settings in the inspector"
                onClick={() => selectAudioTrack(selected ? null : track.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    selectAudioTrack(selected ? null : track.id)
                  }
                }}
              >
                <span className="panel-row-icon">
                  <Music2 size={15} />
                </span>
                <span className="panel-row-text">
                  <span className="panel-row-title">{track.name}</span>
                  <span className="panel-row-sub">
                    Starts at {formatSeconds(track.startTime)} · {Math.round(track.volume * 100)}%
                  </span>
                </span>
                <ChevronRight size={13} className={`row-chevron${selected ? ' open' : ''}`} />
                <button
                  className="icon-btn danger"
                  title="Remove audio"
                  aria-label={`Remove ${track.name}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    apply(
                      'Remove audio',
                      (current) => removeSceneAudioTrack(current, scene.id, track.id),
                      { coalesce: false }
                    )
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )
          })}
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
  const meterRef = useRef<HTMLCanvasElement | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const meterContextRef = useRef<AudioContext | null>(null)
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
    analyserRef.current = null
    const context = meterContextRef.current
    meterContextRef.current = null
    if (context && context.state !== 'closed') void context.close()
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
    // StrictMode remounts once in dev; without re-arming the flag every state
    // update in finish() would be skipped and the card would stay "Recording".
    mountedRef.current = true
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

  useEffect(() => {
    if (state !== 'recording') return
    const levels = new Float32Array(28)
    let frame = 0
    const draw = (): void => {
      frame = window.requestAnimationFrame(draw)
      const canvas = meterRef.current
      const analyser = analyserRef.current
      if (!canvas || !analyser) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      if (width === 0 || height === 0) return
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr
        canvas.height = height * dpr
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const bins = new Uint8Array(analyser.frequencyBinCount)
      analyser.getByteFrequencyData(bins)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)
      const gap = 3
      const barWidth = (width - gap * (levels.length - 1)) / levels.length
      const usable = Math.floor(bins.length * 0.7)
      for (let index = 0; index < levels.length; index += 1) {
        const from = Math.floor((index / levels.length) * usable)
        const to = Math.max(from + 1, Math.floor(((index + 1) / levels.length) * usable))
        let sum = 0
        for (let bin = from; bin < to; bin += 1) sum += bins[bin] ?? 0
        const target = sum / (to - from) / 255
        levels[index] = levels[index]! + (target - levels[index]!) * 0.45
        const barHeight = Math.max(2, levels[index]! * (height - 4))
        const x = index * (barWidth + gap)
        const y = (height - barHeight) / 2
        ctx.fillStyle = `rgba(255, 91, 104, ${0.4 + levels[index]! * 0.6})`
        ctx.beginPath()
        ctx.roundRect(x, y, barWidth, barHeight, barWidth / 2)
        ctx.fill()
      }
    }
    frame = window.requestAnimationFrame(draw)
    return () => window.cancelAnimationFrame(frame)
  }, [state])

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
      const context = new AudioContext()
      meterContextRef.current = context
      if (context.state === 'suspended') void context.resume()
      const analyser = context.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.6
      context.createMediaStreamSource(stream).connect(analyser)
      analyserRef.current = analyser
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
    else if (state === 'recording') void finish(recorder?.mimeType ?? '')
  }

  const cancel = (): void => {
    cancelledRef.current = true
    stop()
  }

  const live = state === 'recording'
  return (
    <div className="voice-recorder">
      {live || state === 'saving' ? (
        <div className={`voice-card${live ? ' live' : ''}`}>
          <div className="voice-card-head">
            {live ? <span className="voice-live-dot" /> : <Loader2 size={13} className="voice-spin" />}
            <span className="voice-live-label">{live ? 'Recording' : 'Saving voiceover'}</span>
            <span className="voice-timer">{formatSeconds(elapsed)}</span>
          </div>
          <canvas ref={meterRef} className="voice-meter" aria-hidden="true" />
          <div className="voice-card-actions">
            <button className="btn btn-sm voice-stop" onClick={stop} disabled={!live}>
              <Square size={10} /> Stop & save
            </button>
            <button
              className="icon-btn voice-discard"
              title="Discard recording"
              aria-label="Discard recording"
              onClick={cancel}
              disabled={!live}
            >
              <Trash2 size={13} />
            </button>
          </div>
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
