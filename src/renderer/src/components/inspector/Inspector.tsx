import { useMemo, useRef, useState, type JSX } from 'react'
import {
  AlignCenter,
  AlignCenterVertical,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignLeft,
  AlignRight,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  ArrowDown,
  ArrowUp,
  Ban,
  Camera,
  Circle,
  Copy,
  Crown,
  Eraser,
  Eye,
  EyeOff,
  FlipHorizontal,
  Hand,
  HeartPulse,
  Image as ImageIcon,
  Info,
  Lock,
  Maximize,
  Minimize,
  Minus,
  Move,
  ArrowUpRight,
  PenTool,
  Pencil,
  Plus,
  RotateCw,
  ScanLine,
  Shapes,
  Sparkles,
  Square,
  Sun,
  Trash2,
  Triangle,
  Type,
  Unlock,
  Waves,
  Zap
} from 'lucide-react'
import { cameraFrame } from '@core/camera/sample'
import { clamp, formatSeconds } from '@core/math'
import { fitRect } from '@core/geometry'
import {
  addCamera,
  duplicateScene,
  moveScene,
  removeCamera,
  removeScene,
  renameScene,
  setSceneBackground,
  updateCamera,
  updateElements
} from '@core/project/operations'
import { createCamera } from '@core/schema/factories'
import type {
  Camera as CameraSettings,
  Element,
  EmphasisType,
  EntranceType,
  ExitType,
  Project,
  Scene,
  ShapeElement,
  ShapeKind,
  TextElement
} from '@core/schema/project'
import { buildSchedule } from '@core/timeline/schedule'
import { DEFAULT_ERASER_INSTRUMENT_ID, INSTRUMENTS } from '@core/instruments'
import {
  DEFAULT_STROKE_FONT_ID,
  STROKE_FONTS,
  getStrokeFont,
  uncoveredCharacters
} from '@core/text/strokeFont'
import {
  alignSelection,
  bringSelectionForward,
  deleteSelection,
  distributeSelection,
  duplicateSelection,
  sendSelectionBackward,
  toggleSelectedLocked,
  toggleSelectedVisible
} from '../../services/editCommands'
import { seekToScene } from '../../hooks/usePlaybackClock'
import { importStrokeFontFiles } from '../../services/importStrokeFont'
import { fitTextFrame } from '../canvas/textMetrics'
import { useColorStore } from '../../state/colorStore'
import { useEditorStore } from '../../state/editorStore'
import { useFontStore } from '../../state/fontStore'
import { usePlaybackStore } from '../../state/playbackStore'
import { useProjectStore } from '../../state/projectStore'
import { useUiStore } from '../../state/uiStore'
import { FontPicker } from './FontPicker'
import { HandTypePicker } from './HandTypePicker'
import {
  ColorField,
  IconToggleRow,
  NumberField,
  Section,
  SelectField,
  SliderField,
  StepperField,
  SwatchField,
  TextAreaField,
  TextField,
  TileGroup,
  TilePickerField,
  type TileOption
} from './controls'

/* Each animation stage shows the one effect it holds; the full icon-tile set
   opens from that box, the way VideoScribe's "Type" popup works. */
const ENTRANCE_TILES: TileOption<EntranceType>[] = [
  { value: 'none', label: 'None', icon: <Ban size={17} />, title: 'No animation — appears instantly' },
  { value: 'handDraw', label: 'Hand', icon: <Hand size={17} />, title: 'Written by a hand holding the pen' },
  { value: 'penDraw', label: 'Pen', icon: <PenTool size={17} />, title: 'Drawn by a pen tip' },
  { value: 'draw', label: 'Draw', icon: <Pencil size={17} />, title: 'Ink appears with no instrument' },
  { value: 'fadeIn', label: 'Fade', icon: <Sun size={17} />, title: 'Fades in place' },
  { value: 'moveIn', label: 'Move in', icon: <Move size={17} />, title: 'Slides in from a direction' },
  { value: 'popIn', label: 'Pop', icon: <HeartPulse size={17} />, title: 'Springs up from nothing' },
  { value: 'reveal', label: 'Wipe', icon: <ScanLine size={17} />, title: 'Wiped open along a direction' }
]

const EASING_OPTIONS = [
  { value: 'linear', label: 'Linear' },
  { value: 'easeIn', label: 'Ease in' },
  { value: 'easeOut', label: 'Ease out' },
  { value: 'easeInOut', label: 'Ease in-out' }
] as const

const DIRECTION_OPTIONS = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'up', label: 'Up' },
  { value: 'down', label: 'Down' },
  { value: 'diagonal', label: 'Diagonal' }
] as const

const EMPHASIS_TILES: TileOption<EmphasisType>[] = [
  { value: 'none', label: 'None', icon: <Ban size={17} /> },
  { value: 'pulse', label: 'Pulse', icon: <HeartPulse size={17} /> },
  { value: 'bounce', label: 'Bounce', icon: <Waves size={17} /> },
  { value: 'shake', label: 'Shake', icon: <Zap size={17} /> },
  { value: 'spin', label: 'Spin', icon: <RotateCw size={17} /> },
  { value: 'zoom', label: 'Zoom', icon: <Maximize size={17} /> }
]

const EXIT_TILES: TileOption<ExitType>[] = [
  { value: 'none', label: 'None', icon: <Ban size={17} />, title: 'Stays on the board' },
  { value: 'fadeOut', label: 'Fade', icon: <Sun size={17} />, title: 'Fades out in place' },
  { value: 'moveOut', label: 'Move out', icon: <Move size={17} />, title: 'Slides off in a direction' },
  { value: 'scaleOut', label: 'Shrink', icon: <Minimize size={17} />, title: 'Scales away to nothing' },
  {
    value: 'erase',
    label: 'Erase',
    icon: <Eraser size={17} />,
    title: 'A hand wipes the board clean, left to right'
  }
]

const SHAPE_TILES: TileOption<ShapeKind>[] = [
  { value: 'rectangle', label: 'Box', icon: <Square size={17} /> },
  { value: 'roundedRectangle', label: 'Rounded', icon: <RoundedSquareIcon /> },
  { value: 'ellipse', label: 'Oval', icon: <Circle size={17} /> },
  { value: 'triangle', label: 'Wedge', icon: <Triangle size={17} /> },
  { value: 'line', label: 'Line', icon: <Minus size={17} /> },
  { value: 'arrow', label: 'Arrow', icon: <ArrowUpRight size={17} /> }
]

const DEFAULT_BACKGROUND_COLORS = [
  '#7c1214', '#c8102e', '#e8451a', '#f28c05', '#f5cf0a', '#a8ce3a', '#4caf50', '#26a69a', '#26c6da',
  '#2196f3', '#4fc3f7', '#3f51b5', '#6a1b9a', '#8e24aa', '#c2185b', '#e91e63', '#d7c4a3', '#f8bbd0',
  '#f5cba7', '#ffe9a8', '#d9f2a8', '#a8e6cf', '#a8d8ea', '#000000', '#2e2e2e', '#5a5a5a', '#8a8a8a',
  '#9a9a9a', '#bdbdbd', '#d6d6d6', '#ffffff'
]

/** Ink reads best from a black-to-white ramp with the saturated markers on top. */
const DEFAULT_TEXT_COLORS = [
  '#16181d', '#3d4048', '#6b7078', '#9aa0a8', '#c9ced4', '#ffffff',
  '#7c1214', '#c8102e', '#e8451a', '#f28c05', '#f5cf0a', '#4caf50',
  '#26a69a', '#2196f3', '#3f51b5', '#6a1b9a', '#c2185b', '#8d6e63'
]

const TRANSITION_OPTIONS = [
  { value: 'none', label: 'None', icon: <Ban size={20} /> },
  { value: 'fade', label: 'Fade', icon: <Sparkles size={20} /> }
] as const

function formatSavedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Saved'
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const day = date.getDate()
  const month = date.toLocaleString(undefined, { month: 'short' })
  return `Saved at ${time} on ${day} ${month} '${String(date.getFullYear()).slice(-2)}`
}

function elementIcon(element: Element): JSX.Element {
  switch (element.kind) {
    case 'text':
      return <Type size={14} />
    case 'image':
      return <ImageIcon size={14} />
    case 'shape':
      return <Shapes size={14} />
    case 'svg':
    default:
      return <PenTool size={14} />
  }
}

function kindLabel(element: Element): string {
  switch (element.kind) {
    case 'text':
      return 'Text'
    case 'image':
      return 'Image'
    case 'shape':
      return 'Shape'
    case 'svg':
    default:
      return 'Illustration'
  }
}

export function Inspector(): JSX.Element {
  const project = useProjectStore((state) => state.project)
  const activeSceneId = useEditorStore((state) => state.activeSceneId)
  const selection = useEditorStore((state) => state.selection)
  const selectedCameraId = useEditorStore((state) => state.selectedCameraId)
  const time = usePlaybackStore((state) => state.time)

  const scene = project
    ? project.scenes.find((candidate) => candidate.id === activeSceneId) ?? project.scenes[0] ?? null
    : null
  const sceneIndex = project && scene ? project.scenes.indexOf(scene) : -1
  const schedule = useMemo(() => (project ? buildSchedule(project) : null), [project])
  const sceneSchedule = schedule && sceneIndex >= 0 ? schedule.scenes[sceneIndex] : undefined
  const localTime = sceneSchedule
    ? clamp(time - sceneSchedule.start, 0, sceneSchedule.duration)
    : 0

  if (!project) {
    return <aside className="inspector" />
  }

  const selectedElements = scene
    ? scene.elements.filter((element) => selection.includes(element.id))
    : []
  const selectedCamera = scene?.cameras.find((camera) => camera.id === selectedCameraId) ?? null

  return (
    <aside className="inspector">
      {selectedCamera && scene ? (
        <CameraInspector
          project={project}
          scene={scene}
          cameraId={selectedCamera.id}
          localTime={localTime}
        />
      ) : selectedElements.length === 1 && scene ? (
        <ElementInspector
          project={project}
          scene={scene}
          element={selectedElements[0]!}
        />
      ) : selectedElements.length > 1 ? (
        <MultiInspector count={selectedElements.length} />
      ) : scene ? (
        <SceneInspector
          project={project}
          scene={scene}
          sceneIndex={sceneIndex}
          localTime={localTime}
          duration={sceneSchedule?.duration ?? 0}
        />
      ) : null}
    </aside>
  )
}

/* ------------------------------------------------------------------ */
/* Element                                                            */
/* ------------------------------------------------------------------ */

function ElementInspector({
  project,
  scene,
  element
}: {
  project: Project
  scene: Scene
  element: Element
}): JSX.Element {
  const selectionIds = useEditorStore((state) => state.selection)
  const ids = useMemo(() => new Set(selectionIds), [selectionIds])
  const [tab, setTab] = useState<'edit' | 'animation'>('edit')

  const update = (label: string, updater: (element: Element) => Element): void => {
    useProjectStore.getState().apply(label, (current) =>
      updateElements(current, scene.id, ids, updater)
    )
  }

  const updateFrame = (patch: Partial<Element['frame']>): void => {
    update('Adjust layout', (item) => ({
      ...item,
      frame: { ...item.frame, ...patch }
    }))
  }

  const asset =
    element.kind === 'svg' || element.kind === 'image'
      ? project.assets.find((candidate) => candidate.id === element.assetId)
      : undefined

  const appearanceSection = <AppearanceSection element={element} update={update} />

  return (
    <>
      <header className="inspector-header">
        <div className="inspector-title">
          <span style={{ color: 'var(--text-muted)', display: 'grid', placeItems: 'center' }}>
            {elementIcon(element)}
          </span>
          <span className="inspector-title-text">{element.name}</span>
          <span className="inspector-kind">{kindLabel(element)}</span>
        </div>
      </header>

      <div className="inspector-tabs" role="tablist" aria-label="Element inspector">
        <button
          role="tab"
          aria-selected={tab === 'edit'}
          className={`inspector-tab ${tab === 'edit' ? 'active' : ''}`}
          onClick={() => setTab('edit')}
        >
          Edit
        </button>
        <button
          role="tab"
          aria-selected={tab === 'animation'}
          className={`inspector-tab ${tab === 'animation' ? 'active' : ''}`}
          onClick={() => setTab('animation')}
        >
          Animation
        </button>
      </div>

      <div className="inspector-scroll">
        {tab === 'edit' ? (
          <>
            {/* Colour is the first thing people want after typing a word, so text leads with
                Appearance; every other kind still opens on where it sits and how big it is. */}
            {element.kind === 'text' ? appearanceSection : null}
            <TransformSection element={element} update={update} updateFrame={updateFrame} />
            <AlignmentSection />
            {element.kind === 'text' ? <TextSection element={element} update={update} /> : null}
            {element.kind === 'shape' ? <ShapeSection element={element} update={update} /> : null}
            {element.kind === 'svg' || element.kind === 'image' ? (
              <SourceSection asset={asset} element={element} update={update} />
            ) : null}
            {element.kind === 'text' ? null : appearanceSection}
          </>
        ) : null}

        {tab === 'animation' ? (
          <>
            <EntranceSection element={element} update={update} />
            <EmphasisSection element={element} update={update} />
            <ExitSection element={element} update={update} />
            <TimingSection element={element} update={update} />
          </>
        ) : null}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Edit-tab sections                                                  */
/* ------------------------------------------------------------------ */

type UpdateElements = (label: string, updater: (element: Element) => Element) => void

function TransformSection({
  element,
  update,
  updateFrame
}: {
  element: Element
  update: UpdateElements
  updateFrame: (patch: Partial<Element['frame']>) => void
}): JSX.Element {
  return (
    <Section
      title="Transform"
      hint="Where the element sits, how big it is, and whether the canvas lets you touch it."
    >
      <IconToggleRow
        label="Element"
        items={[
          {
            key: 'lock',
            icon: element.locked ? <Lock size={15} /> : <Unlock size={15} />,
            title: element.locked ? 'Unlock this element' : 'Lock this element against selection and moves',
            active: element.locked,
            onClick: toggleSelectedLocked
          },
          {
            key: 'visible',
            icon: element.visible ? <Eye size={15} /> : <EyeOff size={15} />,
            title: element.visible ? 'Hide from the stage' : 'Show on the stage',
            active: !element.visible,
            onClick: toggleSelectedVisible
          },
          {
            key: 'duplicate',
            icon: <Copy size={15} />,
            title: 'Duplicate (Ctrl+D)',
            onClick: duplicateSelection
          },
          { key: 'delete', icon: <Trash2 size={15} />, title: 'Delete (Del)', onClick: deleteSelection }
        ]}
      />
      <TextField
        label="Name"
        value={element.name}
        onChange={(value) => update('Rename element', (item) => ({ ...item, name: value }))}
      />
      <div className="field-row cols-2">
        <NumberField label="X" value={element.frame.x} onChange={(value) => updateFrame({ x: value })} />
        <NumberField label="Y" value={element.frame.y} onChange={(value) => updateFrame({ y: value })} />
      </div>
      <div className="field-row cols-2">
        <NumberField
          label="Width"
          min={4}
          value={element.frame.width}
          onChange={(value) => updateFrame({ width: value })}
        />
        <NumberField
          label="Height"
          min={4}
          value={element.frame.height}
          onChange={(value) => updateFrame({ height: value })}
        />
      </div>
      <div className="field-row cols-2">
        <NumberField
          label="Rotation"
          unit="°"
          value={element.rotation}
          step={1}
          onChange={(value) => update('Rotate element', (item) => ({ ...item, rotation: value }))}
        />
        <div className="field">
          <span className="field-label">Layer</span>
          <div className="icon-row layer-buttons">
            <button
              type="button"
              className="icon-btn icon-row-btn"
              title="Bring forward"
              aria-label="Bring forward"
              onClick={bringSelectionForward}
            >
              <ArrowUp size={14} />
            </button>
            <button
              type="button"
              className="icon-btn icon-row-btn"
              title="Send backward"
              aria-label="Send backward"
              onClick={sendSelectionBackward}
            >
              <ArrowDown size={14} />
            </button>
          </div>
        </div>
      </div>
    </Section>
  )
}

function AlignmentSection(): JSX.Element {
  return (
    <Section
      title="Alignment"
      hint="Places the selection against the visible stage. Distributing needs three or more elements."
    >
      <IconToggleRow
        label="Align"
        items={[
          { key: 'left', icon: <AlignLeft size={15} />, title: 'Align left edges to the stage', onClick: () => alignSelection('left') },
          { key: 'centerX', icon: <AlignCenter size={15} />, title: 'Centre horizontally', onClick: () => alignSelection('centerX') },
          { key: 'right', icon: <AlignRight size={15} />, title: 'Align right edges to the stage', onClick: () => alignSelection('right') },
          { key: 'top', icon: <AlignStartVertical size={15} />, title: 'Align top edges to the stage', onClick: () => alignSelection('top') },
          { key: 'centerY', icon: <AlignCenterVertical size={15} />, title: 'Centre vertically', onClick: () => alignSelection('centerY') },
          { key: 'bottom', icon: <AlignEndVertical size={15} />, title: 'Align bottom edges to the stage', onClick: () => alignSelection('bottom') }
        ]}
      />
      <IconToggleRow
        label="Distribute"
        items={[
          {
            key: 'horizontal',
            icon: <AlignHorizontalDistributeCenter size={15} />,
            title: 'Even out horizontal gaps',
            onClick: () => distributeSelection('horizontal')
          },
          {
            key: 'vertical',
            icon: <AlignVerticalDistributeCenter size={15} />,
            title: 'Even out vertical gaps',
            onClick: () => distributeSelection('vertical')
          }
        ]}
      />
    </Section>
  )
}

function SourceSection({
  asset,
  element,
  update
}: {
  asset: Project['assets'][number] | undefined
  element: Element
  update: UpdateElements
}): JSX.Element {
  return (
    <Section title="Source">
      <div className="hint">
        {asset ? `${asset.name} · ${(asset.byteSize / 1024).toFixed(0)} KB` : 'Asset is missing.'}
      </div>
      {asset?.svg ? (
        <div className="hint">
          {asset.svg.drawables.length} drawable path{asset.svg.drawables.length === 1 ? '' : 's'}
          {asset.svg.warnings.length > 0 ? ` · ${asset.svg.warnings[0]}` : ''}
        </div>
      ) : null}
      {element.kind === 'svg' ? (
        <button
          className="btn btn-sm"
          disabled={element.drawOrder === null}
          onClick={() =>
            update('Reset draw order', (item) =>
              item.kind === 'svg' ? { ...item, drawOrder: null } : item
            )
          }
        >
          Reset draw order
        </button>
      ) : null}
    </Section>
  )
}

function AppearanceSection({
  element,
  update
}: {
  element: Element
  update: UpdateElements
}): JSX.Element {
  const customColors = useColorStore((state) => state.customColors)
  const addColor = useColorStore((state) => state.addColor)
  const removeColor = useColorStore((state) => state.removeColor)

  return (
    <Section title="Appearance" hint="Colour and transparency of the artwork itself.">
      {element.kind === 'text' ? (
        <SwatchField
          label="Ink colour"
          value={element.color}
          colors={DEFAULT_TEXT_COLORS}
          custom={customColors}
          onChange={(color) =>
            update('Change colour', (item) => (item.kind === 'text' ? { ...item, color } : item))
          }
          onAddCustom={addColor}
          onRemoveCustom={removeColor}
        />
      ) : null}
      {element.kind === 'shape' ? (
        <>
          <SwatchField
            label="Fill"
            value={element.fill}
            colors={DEFAULT_TEXT_COLORS}
            custom={customColors}
            onChange={(color) =>
              update('Edit shape', (item) => (item.kind === 'shape' ? { ...item, fill: color } : item))
            }
            onAddCustom={addColor}
            onRemoveCustom={removeColor}
            onNone={() =>
              update('Edit shape', (item) =>
                item.kind === 'shape' ? { ...item, fill: null } : item
              )
            }
            noneLabel="No fill"
          />
          <SwatchField
            label="Stroke"
            value={element.stroke}
            colors={DEFAULT_TEXT_COLORS}
            custom={customColors}
            onChange={(color) =>
              update('Edit shape', (item) => (item.kind === 'shape' ? { ...item, stroke: color } : item))
            }
            onAddCustom={addColor}
            onRemoveCustom={removeColor}
            onNone={() =>
              update('Edit shape', (item) =>
                item.kind === 'shape' ? { ...item, stroke: null } : item
              )
            }
            noneLabel="No stroke"
          />
        </>
      ) : null}
      <SliderField
        label="Opacity"
        value={element.opacity}
        onChange={(value) => update('Change opacity', (item) => ({ ...item, opacity: value }))}
      />
    </Section>
  )
}

/** Text properties that change the painted ink, and so the box around it. */
const TEXT_METRIC_FIELDS: (keyof TextElement)[] = [
  'text', 'fontSize', 'letterSpacing', 'lineHeight', 'align',
  'strokeFontId', 'fontFamily', 'fontWeight', 'italic'
]

function TextSection({
  element,
  update
}: {
  element: TextElement
  update: (label: string, updater: (element: Element) => Element) => void
}): JSX.Element {
  const patch = (value: Partial<TextElement>): void => {
    // Anything that changes the ink has to re-fit the box, or the selection
    // frame drifts away from the text it is supposed to be around.
    const refit = TEXT_METRIC_FIELDS.some((field) => field in value)
    update('Edit text', (item) => {
      if (item.kind !== 'text') return item
      const next: TextElement = { ...item, writingMode: 'strokeScript', ...value }
      return refit ? { ...next, frame: fitTextFrame(next) } : next
    })
  }
  const customFonts = useFontStore((state) => state.customFonts)
  const removeFont = useFontStore((state) => state.removeFont)
  const fileInput = useRef<HTMLInputElement | null>(null)
  const customIds = new Set(customFonts.map((font) => font.id))
  const selectedId = element.strokeFontId ?? DEFAULT_STROKE_FONT_ID
  const uncovered = uncoveredCharacters(element)
  const selectedIsCustom = customIds.has(selectedId)

  const chooseFont = (id: string): void => {
    const font = getStrokeFont(id)
    patch({ strokeFontId: id, ...(font ? { fontFamily: font.family } : {}) })
  }

  const handleImport = async (files: FileList | null): Promise<void> => {
    const font = await importStrokeFontFiles(files)
    if (font) chooseFont(font.id)
  }

  const handleRemove = (): void => {
    removeFont(selectedId)
    chooseFont(DEFAULT_STROKE_FONT_ID)
  }

  return (
    <Section title="Text" hint="Everything about the lettering except its colour.">
      <TextAreaField label="Content" value={element.text} onChange={(value) => patch({ text: value })} />
      <FontPicker
        label="Font"
        value={selectedId}
        fonts={STROKE_FONTS}
        customIds={customIds}
        onChange={chooseFont}
      />
      <div className="font-actions">
        <button className="btn btn-sm btn-gold" onClick={() => fileInput.current?.click()}>
          <Crown size={13} /> Add custom font
        </button>
        {selectedIsCustom ? (
          <button className="btn btn-sm" onClick={handleRemove}>
            <Trash2 size={12} /> Remove font
          </button>
        ) : null}
        <input
          ref={fileInput}
          className="font-import-input"
          type="file"
          multiple
          accept=".json,.ts"
          onChange={(event) => {
            void handleImport(event.target.files)
            event.target.value = ''
          }}
        />
      </div>
      <p className="hint">
        Fonts draw real pen strokes. Add a Tegaki bundle (select its bundle.ts and glyphData.json)
        or a saved stroke-font JSON.
      </p>
      {uncovered.length > 0 ? (
        <p className="hint font-warning">
          No bundled font can draw {uncovered.join(' ')}. Those characters stay out of the
          handwriting.
        </p>
      ) : null}
      <div className="field-row cols-2">
        <StepperField
          label="Font size"
          unit="px"
          min={4}
          max={600}
          step={1}
          value={element.fontSize}
          onChange={(value) => patch({ fontSize: value })}
        />
        <StepperField
          label="Line space"
          min={0.5}
          max={4}
          step={0.05}
          value={element.lineHeight}
          onChange={(value) => patch({ lineHeight: value })}
        />
      </div>
      <StepperField
        label="Letter spacing"
        min={-20}
        max={100}
        step={0.5}
        value={element.letterSpacing}
        onChange={(value) => patch({ letterSpacing: value })}
      />
      <IconToggleRow
        label="Text alignment"
        items={[
          {
            key: 'left',
            icon: <AlignLeft size={15} />,
            title: 'Align left',
            active: element.align === 'left',
            onClick: () => patch({ align: 'left' })
          },
          {
            key: 'center',
            icon: <AlignCenter size={15} />,
            title: 'Centre the line',
            active: element.align === 'center',
            onClick: () => patch({ align: 'center' })
          },
          {
            key: 'right',
            icon: <AlignRight size={15} />,
            title: 'Align right — writes from the right edge for RTL scripts',
            active: element.align === 'right',
            onClick: () => patch({ align: 'right' })
          },
          {
            key: 'backwards',
            icon: <FlipHorizontal size={15} />,
            title: element.writeBackwards
              ? 'Write leftwards, finishing at the left edge'
              : 'Write rightwards, finishing at the right edge',
            active: element.writeBackwards,
            onClick: () => patch({ writeBackwards: !element.writeBackwards })
          }
        ]}
      />
      <p className="hint">
        Strokes follow the font's natural order with pen lifts between strokes and letters.
        Weight and italics are fixed by the font.
      </p>
    </Section>
  )
}

function ShapeSection({
  element,
  update
}: {
  element: ShapeElement
  update: (label: string, updater: (element: Element) => Element) => void
}): JSX.Element {
  const patch = (value: Partial<ShapeElement>): void => {
    update('Edit shape', (item) => (item.kind === 'shape' ? { ...item, ...value } : item))
  }
  return (
    <Section title="Shape" hint="Fill and stroke colours live in Appearance.">
      <TileGroup
        label="Type"
        value={element.shape}
        options={SHAPE_TILES}
        columns={3}
        onChange={(shape) => patch({ shape })}
      />
      <div className="field-row cols-2">
        <StepperField
          label="Stroke width"
          unit="px"
          min={0}
          max={200}
          step={0.5}
          value={element.strokeWidth}
          onChange={(strokeWidth) => patch({ strokeWidth })}
        />
        <NumberField
          label="Corner radius"
          min={0}
          disabled={element.shape !== 'roundedRectangle'}
          value={element.cornerRadius}
          onChange={(cornerRadius) => patch({ cornerRadius })}
        />
      </div>
    </Section>
  )
}

function EntranceSection({
  element,
  update
}: {
  element: Element
  update: (label: string, updater: (element: Element) => Element) => void
}): JSX.Element {
  const entrance = element.animation.entrance
  const drawStyle = entrance.type === 'handDraw' || entrance.type === 'penDraw'
  const patch = (value: Partial<Element['animation']['entrance']>): void => {
    update('Change entrance', (item) => ({
      ...item,
      animation: { ...item.animation, entrance: { ...item.animation.entrance, ...value } }
    }))
  }
  return (
    <Section title="Entrance animation" hint="How the element arrives on the stage.">
      <TilePickerField
        label="Type"
        value={entrance.type}
        options={ENTRANCE_TILES}
        columns={4}
        onChange={(type) => patch(type === 'none' ? { type, duration: 0 } : { type })}
      />
      {drawStyle ? (
        <HandTypePicker
          label={entrance.type === 'handDraw' ? 'Hand type' : 'Pen type'}
          value={entrance.instrumentId ?? INSTRUMENTS[0]!.id}
          onChange={(instrumentId) => patch({ instrumentId })}
        />
      ) : null}
      {entrance.type !== 'none' ? (
      <div className="field-row cols-2">
        <StepperField
          label="Duration"
          min={0}
          max={600}
          step={0.1}
          value={entrance.duration}
          onChange={(duration) => patch({ duration })}
        />
        <SelectField
          label="Easing"
          value={entrance.easing}
          options={EASING_OPTIONS}
          onChange={(value) => patch({ easing: value })}
        />
      </div>
      ) : null}
      {drawStyle ? (
        element.kind === 'image' || element.kind === 'shape' ? (
          <SelectField
            label="Reveal direction"
            value={entrance.direction}
            options={DIRECTION_OPTIONS}
            onChange={(value) => patch({ direction: value })}
          />
        ) : null
      ) : entrance.type === 'moveIn' || entrance.type === 'reveal' ? (
        <SelectField
          label="Direction"
          value={entrance.direction}
          options={DIRECTION_OPTIONS}
          onChange={(value) => patch({ direction: value })}
        />
      ) : null}
    </Section>
  )
}

function EmphasisSection({
  element,
  update
}: {
  element: Element
  update: (label: string, updater: (element: Element) => Element) => void
}): JSX.Element {
  const emphasis = element.animation.emphasis
  const patch = (value: Partial<Element['animation']['emphasis']>): void => {
    update('Change emphasis', (item) => ({
      ...item,
      animation: { ...item.animation, emphasis: { ...item.animation.emphasis, ...value } }
    }))
  }
  return (
    <Section title="Emphasis animation" hint="A repeating effect once the element has arrived.">
      <TilePickerField
        label="Type"
        value={emphasis.type}
        options={EMPHASIS_TILES}
        columns={3}
        onChange={(type) => patch({ type })}
      />
      {emphasis.type !== 'none' ? (
        <>
          <div className="field-row cols-2">
            <StepperField
              label="Delay"
              min={0}
              max={600}
              step={0.1}
              value={emphasis.delay}
              onChange={(delay) => patch({ delay })}
            />
            <StepperField
              label="Loops"
              min={1}
              max={50}
              step={1}
              value={emphasis.loops}
              onChange={(loops) => patch({ loops: Math.round(loops) })}
            />
          </div>
          <StepperField
            label="Repeat time"
            min={0.1}
            max={600}
            step={0.1}
            value={emphasis.duration}
            onChange={(duration) => patch({ duration })}
          />
          <SliderField
            label="Intensity"
            min={0}
            max={3}
            step={0.05}
            value={emphasis.intensity}
            onChange={(intensity) => patch({ intensity })}
          />
        </>
      ) : (
        <StepperField
          label="Delay"
          min={0}
          max={600}
          step={0.1}
          value={emphasis.delay}
          onChange={(delay) => patch({ delay })}
        />
      )}
    </Section>
  )
}

function ExitSection({
  element,
  update
}: {
  element: Element
  update: (label: string, updater: (element: Element) => Element) => void
}): JSX.Element {
  const exit = element.animation.exit
  const patch = (value: Partial<Element['animation']['exit']>): void => {
    update('Change exit', (item) => ({
      ...item,
      animation: { ...item.animation, exit: { ...item.animation.exit, ...value } }
    }))
  }
  return (
    <Section title="Exit animation" hint="How the element leaves before the next one starts.">
      <TilePickerField
        label="Type"
        value={exit.type}
        options={EXIT_TILES}
        columns={3}
        onChange={(type) => patch({ type })}
      />
      {exit.type !== 'none' ? (
        <>
          {exit.type === 'erase' ? (
            <HandTypePicker
              label="Eraser"
              scope="erasers"
              subtitle="Pick the hand that clears the board. Every eraser sweeps left to right, cutting the lines on a diagonal from the top."
              value={exit.instrumentId ?? DEFAULT_ERASER_INSTRUMENT_ID}
              onChange={(instrumentId) => patch({ instrumentId })}
            />
          ) : null}
          <div className="field-row cols-2">
            <StepperField
              label="Duration"
              min={0}
              max={600}
              step={0.1}
              value={exit.duration}
              onChange={(duration) => patch({ duration })}
            />
            <StepperField
              label="Delay"
              min={0}
              max={600}
              step={0.1}
              value={exit.delay}
              onChange={(delay) => patch({ delay })}
            />
          </div>
          {/* An eraser sweeps one way, so there is nothing to choose here. */}
          {exit.type === 'erase' ? (
            <SelectField
              label="Easing"
              value={exit.easing}
              options={EASING_OPTIONS}
              onChange={(value) => patch({ easing: value })}
            />
          ) : (
            <div className="field-row cols-2">
              <SelectField
                label="Easing"
                value={exit.easing}
                options={EASING_OPTIONS}
                onChange={(value) => patch({ easing: value })}
              />
              <SelectField
                label="Direction"
                value={exit.direction}
                options={DIRECTION_OPTIONS}
                onChange={(value) => patch({ direction: value })}
              />
            </div>
          )}
        </>
      ) : null}
    </Section>
  )
}

function TimingSection({
  element,
  update
}: {
  element: Element
  update: (label: string, updater: (element: Element) => Element) => void
}): JSX.Element {
  const timing = element.timing
  return (
    <Section title="Timing">
      <div className="field-row cols-2">
        <SelectField
          label="Start"
          value={timing.mode}
          options={[
            { value: 'auto', label: 'Automatic' },
            { value: 'manual', label: 'Manual' }
          ] as const}
          onChange={(value) =>
            update('Change timing', (item) => ({
              ...item,
              timing: { ...item.timing, mode: value === 'manual' ? 'manual' : 'auto' }
            }))
          }
        />
        <NumberField
          label="At"
          min={0}
          step={0.1}
          disabled={timing.mode !== 'manual'}
          value={timing.start}
          onChange={(value) =>
            update('Change timing', (item) => ({ ...item, timing: { ...item.timing, start: value } }))
          }
        />
      </div>
      <NumberField
        label="Pause after"
        min={0}
        step={0.05}
        value={element.animation.pauseAfter}
        onChange={(value) =>
          update('Change pause', (item) => ({
            ...item,
            animation: { ...item.animation, pauseAfter: value }
          }))
        }
      />
    </Section>
  )
}

function MultiInspector({ count }: { count: number }): JSX.Element {
  return (
    <>
      <header className="inspector-header">
        <div className="inspector-title">
          <span className="inspector-title-text">{count} elements selected</span>
        </div>
      </header>
      <div className="inspector-scroll">
        <div className="empty-inspector">
          <strong>Transform together</strong>
          Drag, resize, or use the arrow keys. Per-element animation settings are available when a
          single element is selected.
        </div>
        <AlignmentSection />
        <Section title="Arrange">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className="btn btn-sm" onClick={bringSelectionForward}>
              <ArrowUp size={13} /> Bring forward
            </button>
            <button className="btn btn-sm" onClick={sendSelectionBackward}>
              <ArrowDown size={13} /> Send backward
            </button>
            <button className="btn btn-sm" onClick={toggleSelectedLocked}>
              <Lock size={13} /> Lock
            </button>
            <button className="btn btn-sm" onClick={toggleSelectedVisible}>
              <EyeOff size={13} /> Hide
            </button>
            <button className="btn btn-sm" onClick={duplicateSelection}>
              <Copy size={13} /> Duplicate
            </button>
            <button className="btn btn-sm btn-danger" onClick={deleteSelection}>
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </Section>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Camera                                                             */
/* ------------------------------------------------------------------ */

function CameraInspector({
  project,
  scene,
  cameraId,
  localTime
}: {
  project: Project
  scene: Scene
  cameraId: string
  localTime: number
}): JSX.Element {
  const camera = scene.cameras.find((candidate) => candidate.id === cameraId)
  const selectCamera = useEditorStore((state) => state.selectCamera)
  if (!camera) return <aside className="inspector" />

  const update = (label: string, updater: (camera: CameraSettings) => CameraSettings): void => {
    useProjectStore.getState().apply(
      label,
      (current) => updateCamera(current, scene.id, camera.id, updater),
      { coalesce: true }
    )
  }

  const focus = (): void => {
    const editor = useEditorStore.getState()
    editor.setViewport(fitRect(cameraFrame(camera, project.output), editor.size, 72))
  }

  return (
    <>
      <header className="inspector-header">
        <div className="inspector-title">
          <Camera size={14} style={{ color: 'var(--camera)' }} />
          <span className="inspector-title-text">{camera.name}</span>
          <span className="inspector-kind">Camera</span>
        </div>
        <button className="icon-btn" title="Back to scene" onClick={() => selectCamera(null)}>
          <X />
        </button>
      </header>
      <div className="inspector-scroll">
        <Section title="Camera">
          <TextField
            label="Name"
            value={camera.name}
            onChange={(value) => update('Rename camera', (item) => ({ ...item, name: value }))}
          />
          <div className="field-row cols-2">
            <NumberField
              label="Center X"
              value={camera.center.x}
              onChange={(value) =>
                update('Move camera', (item) => ({ ...item, center: { ...item.center, x: value } }))
              }
            />
            <NumberField
              label="Center Y"
              value={camera.center.y}
              onChange={(value) =>
                update('Move camera', (item) => ({ ...item, center: { ...item.center, y: value } }))
              }
            />
          </div>
          <NumberField
            label="View width"
            min={32}
            value={camera.viewWidth}
            onChange={(value) => update('Resize camera', (item) => ({ ...item, viewWidth: value }))}
          />
          <NumberField
            label="Becomes active"
            min={0}
            step={0.1}
            value={camera.startTime}
            onChange={(value) =>
              update('Change camera timing', (item) => ({ ...item, startTime: value }))
            }
          />
          <button className="btn btn-sm" onClick={focus}>
            <MaximizeIcon /> Frame in editor
          </button>
        </Section>
        <Section title="Transition in">
          <div className="field-row cols-2">
            <NumberField
              label="Duration"
              min={0}
              max={60}
              step={0.1}
              value={camera.transition.duration}
              onChange={(value) =>
                update('Change camera transition', (item) => ({
                  ...item,
                  transition: { ...item.transition, duration: value }
                }))
              }
            />
            <SelectField
              label="Easing"
              value={camera.transition.easing}
              options={EASING_OPTIONS}
              onChange={(value) =>
                update('Change camera transition', (item) => ({
                  ...item,
                  transition: { ...item.transition, easing: value }
                }))
              }
            />
          </div>
          <div className="hint">
            Scene time {formatSeconds(localTime, true)}. The camera moves; artwork stays put.
          </div>
          <button
            className="btn btn-sm btn-danger"
            disabled={scene.cameras.length <= 1}
            onClick={() => {
              useProjectStore.getState().apply(
                'Delete camera',
                (current) => removeCamera(current, scene.id, camera.id),
                { coalesce: false }
              )
              selectCamera(null)
            }}
          >
            <Trash2 size={13} /> Delete camera
          </button>
        </Section>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Scene                                                              */
/* ------------------------------------------------------------------ */

function SceneInspector({
  project,
  scene,
  sceneIndex,
  localTime,
  duration
}: {
  project: Project
  scene: Scene
  sceneIndex: number
  localTime: number
  duration: number
}): JSX.Element {
  const apply = useProjectStore((state) => state.apply)
  const selectCamera = useEditorStore((state) => state.selectCamera)
  const askConfirm = useUiStore((state) => state.askConfirm)
  const savedAt = useProjectStore((state) => state.savedAt)
  const dirty = useProjectStore((state) => state.dirty)
  const customColors = useEditorStore((state) => state.customBackgroundColors)
  const addCustomBackgroundColor = useEditorStore((state) => state.addCustomBackgroundColor)
  const [showBackgroundOptions, setShowBackgroundOptions] = useState(
    scene.background.type !== 'solid'
  )
  const colorInputRef = useRef<HTMLInputElement | null>(null)
  const imageAssets = project.assets.filter((asset) => asset.kind === 'image')
  const solidColor =
    scene.background.type === 'solid' ? scene.background.color.toLowerCase() : null

  const setBackground = (patch: (background: Scene['background']) => Scene['background']): void => {
    apply('Change background', (current) =>
      setSceneBackground(current, scene.id, patch(scene.background))
    )
  }

  const setTransition = (patch: Partial<Scene['transition']>): void => {
    apply('Change scene transition', (current) => ({
      ...current,
      scenes: current.scenes.map((candidate) =>
        candidate.id === scene.id
          ? { ...candidate, transition: { ...candidate.transition, ...patch } }
          : candidate
      )
    }))
  }

  const addNewCamera = (): void => {
    const startTime = Math.max(0.1, Math.min(localTime, Math.max(0.1, duration - 0.1)))
    const base = scene.cameras.find((camera) => camera.startTime <= localTime) ?? scene.cameras[0]
    const frame = base ? cameraFrame(base, project.output) : null
    const camera = createCamera({
      center: frame ? { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 } : { x: 0, y: 0 },
      viewWidth: frame ? frame.width * 0.75 : project.output.width,
      name: `Camera ${scene.cameras.length + 1}`,
      startTime
    })
    apply('Add camera', (current) => addCamera(current, scene.id, camera), { coalesce: false })
    selectCamera(camera.id)
  }

  const duplicate = (): void => {
    const result = duplicateScene(project, scene.id)
    if (!result) return
    apply('Duplicate scene', () => result.project, { coalesce: false })
    useEditorStore.getState().setActiveScene(result.sceneId)
    seekToScene(result.sceneId)
  }

  const remove = async (): Promise<void> => {
    if (project.scenes.length <= 1) return
    const confirmed = await askConfirm({
      title: 'Delete scene?',
      message: `“${scene.name}” and its elements will be removed. This can be undone.`,
      confirmLabel: 'Delete scene'
    })
    if (!confirmed) return
    apply('Delete scene', (current) => removeScene(current, scene.id), { coalesce: false })
    const current = useProjectStore.getState().project
    if (!current) return
    const nextScene = current.scenes[Math.max(0, sceneIndex - 1)] ?? current.scenes[0]
    if (nextScene) {
      useEditorStore.getState().setActiveScene(nextScene.id)
      seekToScene(nextScene.id)
    }
  }

  return (
    <>
      <header className="inspector-header">
        <div className="inspector-title">
          <span className="inspector-title-text">Scene settings</span>
        </div>
      </header>
      <div className="inspector-scroll">
        <Section title="Background color">
          <span className="field-label">Default colors</span>
          <div className="bg-swatch-grid">
            {DEFAULT_BACKGROUND_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={`bg-swatch ${solidColor === color ? 'active' : ''}`}
                style={{ background: color }}
                title={color}
                aria-label={`Set background to ${color}`}
                onClick={() => setBackground(() => ({ type: 'solid', color }))}
              />
            ))}
          </div>
          <span className="field-label">Custom colors</span>
          <div className="bg-swatch-grid">
            {customColors.map((color) => (
              <button
                key={color}
                type="button"
                className={`bg-swatch ${solidColor === color ? 'active' : ''}`}
                style={{ background: color }}
                title={color}
                aria-label={`Set background to ${color}`}
                onClick={() => setBackground(() => ({ type: 'solid', color }))}
              />
            ))}
            <button
              type="button"
              className="bg-swatch bg-swatch-add"
              title="Add a custom color"
              aria-label="Add a custom color"
              onClick={() => colorInputRef.current?.click()}
            >
              <Plus size={13} />
            </button>
          </div>
          <input
            ref={colorInputRef}
            type="color"
            className="bg-color-input"
            value={scene.background.type === 'solid' ? scene.background.color : '#ffffff'}
            onChange={(event) => {
              const color = event.target.value
              addCustomBackgroundColor(color)
              setBackground(() => ({ type: 'solid', color }))
            }}
          />
          <button
            type="button"
            className="bg-more-toggle"
            onClick={() => setShowBackgroundOptions((value) => !value)}
          >
            {showBackgroundOptions
              ? 'Hide gradient and image options'
              : 'Use a gradient or image…'}
          </button>
          {showBackgroundOptions ? (
            <>
          <SelectField
            label="Type"
            value={scene.background.type}
            options={[
              { value: 'solid', label: 'Solid color' },
              { value: 'gradient', label: 'Gradient' },
              { value: 'image', label: 'Image' }
            ] as const}
            onChange={(value) => {
              if (value === 'solid') setBackground(() => ({ type: 'solid', color: '#ffffff' }))
              else if (value === 'gradient')
                setBackground(() => ({
                  type: 'gradient',
                  from: '#ffffff',
                  to: '#dfe7f5',
                  angle: 90
                }))
              else {
                const first = imageAssets[0]
                if (!first) {
                  useUiStore.getState().toast('Import an image first.', 'info')
                  return
                }
                setBackground(() => ({ type: 'image', assetId: first.id, fit: 'cover' }))
              }
            }}
          />
          {scene.background.type === 'solid' ? (
            <ColorField
              label="Color"
              value={scene.background.color}
              onChange={(value) =>
                setBackground((current) =>
                  current.type === 'solid' ? { ...current, color: value ?? '#ffffff' } : current
                )
              }
            />
          ) : null}
          {scene.background.type === 'gradient' ? (
            <>
              <div className="field-row cols-2">
                <ColorField
                  label="From"
                  value={scene.background.from}
                  onChange={(value) =>
                    setBackground((current) =>
                      current.type === 'gradient' ? { ...current, from: value ?? '#ffffff' } : current
                    )
                  }
                />
                <ColorField
                  label="To"
                  value={scene.background.to}
                  onChange={(value) =>
                    setBackground((current) =>
                      current.type === 'gradient' ? { ...current, to: value ?? '#ffffff' } : current
                    )
                  }
                />
              </div>
              <NumberField
                label="Angle"
                unit="°"
                value={scene.background.angle}
                onChange={(value) =>
                  setBackground((current) =>
                    current.type === 'gradient' ? { ...current, angle: value } : current
                  )
                }
              />
            </>
          ) : null}
          {scene.background.type === 'image' ? (
            <>
              <SelectField
                label="Image"
                value={scene.background.assetId}
                options={imageAssets.map((asset) => ({ value: asset.id, label: asset.name }))}
                onChange={(value) =>
                  setBackground((current) =>
                    current.type === 'image' ? { ...current, assetId: value } : current
                  )
                }
              />
              <SelectField
                label="Fit"
                value={scene.background.fit}
                options={[
                  { value: 'cover', label: 'Cover' },
                  { value: 'contain', label: 'Contain' }
                ] as const}
                onChange={(value) =>
                  setBackground((current) =>
                    current.type === 'image' ? { ...current, fit: value } : current
                  )
                }
              />
            </>
          ) : null}
            </>
          ) : null}
        </Section>

        <Section title="Scene entrance transition">
          <span className="field-label">Type</span>
          <div className="transition-cards">
            {TRANSITION_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`transition-card ${scene.transition.type === option.value ? 'active' : ''}`}
                onClick={() => setTransition({ type: option.value })}
              >
                <span className="transition-card-icon">{option.icon}</span>
                <span>{option.label}</span>
              </button>
            ))}
          </div>
          <NumberField
            label="Duration"
            min={0}
            max={10}
            step={0.1}
            disabled={scene.transition.type === 'none' || sceneIndex === 0}
            value={scene.transition.duration}
            onChange={(value) => setTransition({ duration: value })}
          />
          <p className="hint">
            {sceneIndex === 0
              ? 'The first scene starts directly; transitions apply between scenes.'
              : 'Plays as this scene starts after the previous scene.'}
          </p>
        </Section>

        <Section title="Scene details" defaultOpen={false}>
          <TextField
            label="Name"
            value={scene.name}
            onChange={(value) =>
              apply('Rename scene', (current) => renameScene(current, scene.id, value))
            }
          />
          <div className="field-row cols-2">
            <div className="field">
              <span className="field-label">Duration</span>
              <div className="hint" style={{ height: 26, display: 'flex', alignItems: 'center' }}>
                {formatSeconds(duration, true)}
              </div>
            </div>
            <NumberField
              label="Hold after"
              min={0}
              step={0.1}
              value={scene.holdAfter}
              onChange={(value) =>
                apply('Change scene hold', (current) => ({
                  ...current,
                  scenes: current.scenes.map((candidate) =>
                    candidate.id === scene.id ? { ...candidate, holdAfter: value } : candidate
                  )
                }))
              }
            />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              className="btn btn-sm"
              title="Move scene earlier"
              disabled={sceneIndex === 0}
              onClick={() =>
                apply('Reorder scenes', (current) => moveScene(current, scene.id, -1), {
                  coalesce: false
                })
              }
            >
              <ArrowLeftIcon />
            </button>
            <button
              className="btn btn-sm"
              title="Move scene later"
              disabled={sceneIndex === project.scenes.length - 1}
              onClick={() =>
                apply('Reorder scenes', (current) => moveScene(current, scene.id, 1), {
                  coalesce: false
                })
              }
            >
              <ArrowRightIcon />
            </button>
            <button className="btn btn-sm" onClick={duplicate}>
              <Copy size={13} /> Duplicate
            </button>
            <button
              className="btn btn-sm btn-danger"
              disabled={project.scenes.length <= 1}
              onClick={() => void remove()}
            >
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </Section>

        <Section
          title={`Cameras (${scene.cameras.length})`}
          defaultOpen={false}
          actions={
            <button className="icon-btn" title="Add camera at playhead" onClick={addNewCamera}>
              <Plus size={14} />
            </button>
          }
        >
          {scene.cameras.map((camera) => (
            <button
              key={camera.id}
              className="recent-item"
              style={{ padding: '6px 8px' }}
              onClick={() => selectCamera(camera.id)}
            >
              <Camera size={13} style={{ color: 'var(--camera)' }} />
              <span className="recent-name">{camera.name}</span>
              <span className="recent-meta">{formatSeconds(camera.startTime, true)}</span>
            </button>
          ))}
          <div className="hint">
            Cameras switch at their start time. Add one to pan or zoom without moving artwork.
          </div>
        </Section>

        <Section title="Project" defaultOpen={false}>
          <div className="hint">
            {project.name} · {project.output.width} × {project.output.height} · {project.output.fps} fps
            <br />
            {project.scenes.length} scene{project.scenes.length === 1 ? '' : 's'} ·{' '}
            {project.assets.length} asset{project.assets.length === 1 ? '' : 's'}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              className="btn btn-sm"
              onClick={() => useUiStore.getState().openDialog('projectSettings')}
            >
              Project settings
            </button>
          </div>
        </Section>
      </div>
      <div className="inspector-savebar" title={savedAt ?? ''}>
        <span>
          {dirty ? 'Unsaved changes' : savedAt ? formatSavedAt(savedAt) : 'Not saved yet'}
        </span>
        <Info size={13} />
      </div>
    </>
  )
}

/* Small inline icons keep the file independent of icon name variants. */
function RoundedSquareIcon(): JSX.Element {
  return (
    <svg width="17" height="17" viewBox="0 0 17 17" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="2.5" y="2.5" width="12" height="12" rx="4.5" />
    </svg>
  )
}

function X(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 3l8 8M11 3l-8 8" />
    </svg>
  )
}

function MaximizeIcon(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M5 2H2v3M9 2h3v3M5 12H2V9M9 12h3V9" />
    </svg>
  )
}

function ArrowLeftIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M11 7H3M6 4L3 7l3 3" />
    </svg>
  )
}

function ArrowRightIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 7h8M8 4l3 3-3 3" />
    </svg>
  )
}
