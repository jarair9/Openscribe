import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  JSX,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent
} from 'react'
import type { ElementVisualState } from '@core/animation/evaluate'
import { evaluateScene, type SceneVisual } from '@core/animation/scene'
import { cameraFrame } from '@core/camera/sample'
import { clamp, roundTo } from '@core/math'
import {
  fitRect,
  rectCenter,
  resizeFrame,
  rotatePoint,
  rotatedRectBounds,
  screenToWorld,
  unionRects,
  worldToScreen,
  zoomAroundPoint,
  type ResizeHandle
} from '@core/geometry'
import { updateCamera, updateElements } from '@core/project/operations'
import type { Element as DocElement, Project, Scene } from '@core/schema/project'
import type { Rect, Vec2 } from '@core/schema/primitives'
import { buildSchedule } from '@core/timeline/schedule'
import { fitTextFrame } from './textMetrics'
import { useEditorStore, type Tool } from '../../state/editorStore'
import { usePlaybackStore } from '../../state/playbackStore'
import { useProjectStore } from '../../state/projectStore'
import {
  bringSelectionForward,
  copySelection,
  createShapeFromRect,
  createTextAt,
  cutSelection,
  deleteSelection,
  duplicateSelection,
  pasteClipboard,
  selectAll,
  sendSelectionBackward,
  toggleSelectedLocked,
  toggleSelectedVisible
} from '../../services/editCommands'
import { SceneArtwork } from './SceneArtwork'
import { fitBoundsOfScene, pageFrameOf } from './sceneBounds'

const HANDLE_SIZE = 7
const ROTATE_OFFSET = 26
const TEXT_MIN_SIZE = 12

type DragState =
  | { kind: 'move'; ids: string[]; startWorld: Vec2; origins: Map<string, Rect> }
  | {
      kind: 'resize'
      id: string
      handle: ResizeHandle
      startWorld: Vec2
      frame: Rect
      rotation: number
      text?: { fontSize: number; letterSpacing: number }
    }
  | { kind: 'rotate'; id: string; center: Vec2; startAngle: number; startRotation: number }
  | { kind: 'pan'; startClient: Vec2; startCenter: Vec2 }
  | { kind: 'create'; startWorld: Vec2; tool: Tool }

interface ContextMenuState {
  x: number
  y: number
}

function handleDirection(handle: ResizeHandle): { x: number; y: number } {
  return {
    x: handle.includes('e') ? 0.5 : handle.includes('w') ? -0.5 : 0,
    y: handle.includes('s') ? 0.5 : handle.includes('n') ? -0.5 : 0
  }
}

/**
 * Text scales with its box, so a drag is projected onto the anchor-to-handle
 * diagonal and applied uniformly instead of stretching the glyphs.
 */
function textResizeScale(
  frame: Rect,
  handle: ResizeHandle,
  localDx: number,
  localDy: number
): number {
  const direction = handleDirection(handle)
  const vx = direction.x * 2 * frame.width
  const vy = direction.y * 2 * frame.height
  const lengthSquared = vx * vx + vy * vy
  const minScale = Math.max(
    TEXT_MIN_SIZE / Math.max(1, frame.width),
    TEXT_MIN_SIZE / Math.max(1, frame.height)
  )
  if (lengthSquared <= 0) return 1
  const scale = 1 + (localDx * vx + localDy * vy) / lengthSquared
  return Math.max(minScale, scale)
}

function scaledFrameAboutHandle(
  frame: Rect,
  handle: ResizeHandle,
  scale: number,
  rotation: number
): Rect {
  const direction = handleDirection(handle)
  const width = frame.width * scale
  const height = frame.height * scale
  const center = rectCenter(frame)
  const anchor = rotatePoint(
    {
      x: center.x - direction.x * frame.width,
      y: center.y - direction.y * frame.height
    },
    center,
    rotation
  )
  const offset = rotatePoint(
    { x: -direction.x * width, y: -direction.y * height },
    { x: 0, y: 0 },
    rotation
  )
  return {
    x: anchor.x - offset.x - width / 2,
    y: anchor.y - offset.y - height / 2,
    width,
    height
  }
}

export function SceneCanvas(): JSX.Element {
  const project = useProjectStore((state) => state.project)
  const session = useProjectStore((state) => state.session)
  const apply = useProjectStore((state) => state.apply)
  const beginTransaction = useProjectStore((state) => state.beginTransaction)
  const endTransaction = useProjectStore((state) => state.endTransaction)

  const activeSceneId = useEditorStore((state) => state.activeSceneId)
  const selection = useEditorStore((state) => state.selection)
  const selectedCameraId = useEditorStore((state) => state.selectedCameraId)
  const tool = useEditorStore((state) => state.tool)
  const viewport = useEditorStore((state) => state.viewport)
  const size = useEditorStore((state) => state.size)
  const showGrid = useEditorStore((state) => state.showGrid)
  const snapping = useEditorStore((state) => state.snapping)
  const fitNonce = useEditorStore((state) => state.fitNonce)
  const setViewport = useEditorStore((state) => state.setViewport)
  const setSize = useEditorStore((state) => state.setSize)
  const select = useEditorStore((state) => state.select)
  const selectCamera = useEditorStore((state) => state.selectCamera)
  const clearSelection = useEditorStore((state) => state.clearSelection)
  const setTool = useEditorStore((state) => state.setTool)

  const time = usePlaybackStore((state) => state.time)
  const playing = usePlaybackStore((state) => state.playing)

  const hostRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const [preview, setPreview] = useState<Rect | null>(null)
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null })
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [cameraEditingId, setCameraEditingId] = useState<string | null>(null)
  const [panning, setPanning] = useState(false)

  const schedule = useMemo(() => (project ? buildSchedule(project) : null), [project])
  const sceneIndex = project ? project.scenes.findIndex((scene) => scene.id === activeSceneId) : -1
  const scene = project && sceneIndex >= 0 ? project.scenes[sceneIndex]! : null
  const sceneSchedule = schedule && sceneIndex >= 0 ? schedule.scenes[sceneIndex] : undefined

  const localTime = sceneSchedule ? clamp(time - sceneSchedule.start, 0, sceneSchedule.duration) : 0

  const visual = useMemo<SceneVisual | null>(() => {
    if (!project || !scene || !sceneSchedule || !schedule) return null
    return evaluateScene(
      project,
      scene,
      sceneIndex,
      localTime,
      sceneSchedule.duration,
      sceneSchedule.start,
      project.output,
      schedule
    )
  }, [project, scene, sceneIndex, sceneSchedule, schedule, localTime])

  // The canvas is a layout surface, not a second playback window: every element
  // is drawn in its finished state so nothing hides behind an entrance that has
  // not started yet. The Preview overlay owns animation.
  const displayVisual = useMemo<SceneVisual | null>(() => {
    if (!visual || !scene) return visual
    const elements: Record<string, ElementVisualState> = { ...visual.elements }
    let changed = false
    for (const element of scene.elements) {
      const state = visual.elements[element.id]
      if (!state) continue
      if (!element.visible) continue
      elements[element.id] = {
        ...state,
        rendered: true,
        opacity: element.opacity,
        translate: { x: 0, y: 0 },
        scale: 1,
        rotation: 0,
        drawables: state.drawables
          ? state.drawables.map((drawable) => ({ ...drawable, draw: 1, fill: 1 }))
          : null,
        activeDrawableId: null,
        activeDrawableProgress: 0,
        strokeDraw: state.strokeDraw === null ? null : 1,
        wipe: null,
        handStyle: null,
        instrumentId: null,
        erasing: false
      }
      changed = true
    }
    return changed ? { ...visual, elements } : visual
  }, [visual, scene, playing])

  /* ---------------------------------------------------------------- */
  /* Sizing and fitting                                                */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(host)
    setSize({ width: host.clientWidth, height: host.clientHeight })
    return () => observer.disconnect()
  }, [setSize])

  const fitView = useCallback(() => {
    if (!project || !scene || size.width < 10 || size.height < 10) return
    setViewport(fitRect(fitBoundsOfScene(project, scene), size, 36))
  }, [project, scene, size, setViewport])

  useEffect(() => {
    if (!project || !scene || size.width < 10 || size.height < 10) return
    fitView()
    // Refit only when asked or when the active scene changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitNonce, activeSceneId, size.width > 0, size.height > 0])

  const sceneDataRef = useRef<{ project: Project; scene: Scene } | null>(null)
  sceneDataRef.current = project && scene ? { project, scene } : null

  // Keep the artboard visible when panels or the window shrink the workspace:
  // zoom out only, never overriding a deliberate closer view.
  useEffect(() => {
    const data = sceneDataRef.current
    if (!data || size.width < 10 || size.height < 10) return
    const fit = fitRect(fitBoundsOfScene(data.project, data.scene), size, 36)
    const current = useEditorStore.getState().viewport
    if (current.zoom > fit.zoom * 1.002) setViewport(fit)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height])

  /* ---------------------------------------------------------------- */
  /* Wheel-based zoom and pan                                          */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const handler = (event: WheelEvent): void => {
      event.preventDefault()
      const bounds = host.getBoundingClientRect()
      const anchor = { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
      const current = useEditorStore.getState().viewport
      if (event.ctrlKey || event.metaKey) {
        const factor = Math.exp(-event.deltaY * 0.0018)
        setViewport(zoomAroundPoint(current, bounds, anchor, factor))
      } else {
        const dx = event.shiftKey ? event.deltaY : event.deltaX
        const dy = event.shiftKey ? 0 : event.deltaY
        setViewport({
          ...current,
          center: {
            x: current.center.x + dx / current.zoom,
            y: current.center.y + dy / current.zoom
          }
        })
      }
    }
    host.addEventListener('wheel', handler, { passive: false })
    return () => host.removeEventListener('wheel', handler)
  }, [setViewport])

  /* ---------------------------------------------------------------- */
  /* Context menu dismissal                                            */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    if (!contextMenu) return
    const close = (): void => setContextMenu(null)
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [contextMenu])

  // Camera handles only exist while that camera is actively being edited.
  useEffect(() => {
    if (cameraEditingId && selectedCameraId !== cameraEditingId) setCameraEditingId(null)
  }, [selectedCameraId, cameraEditingId])

  useEffect(() => {
    if (!cameraEditingId) return
    const exit = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setCameraEditingId(null)
    }
    window.addEventListener('keydown', exit)
    return () => window.removeEventListener('keydown', exit)
  }, [cameraEditingId])

  useEffect(() => {
    if (playing) setCameraEditingId(null)
  }, [playing])

  const worldFromClient = useCallback((clientX: number, clientY: number): Vec2 => {
    const bounds = svgRef.current?.getBoundingClientRect()
    if (!bounds) return { x: 0, y: 0 }
    return screenToWorld(
      { x: clientX - bounds.left, y: clientY - bounds.top },
      useEditorStore.getState().viewport,
      { width: bounds.width, height: bounds.height }
    )
  }, [])

  /* ---------------------------------------------------------------- */
  /* Pointer interactions                                              */
  /* ---------------------------------------------------------------- */

  const handleSvgPointerDown = (event: ReactPointerEvent<SVGSVGElement>): void => {
    if (!project || !scene) return
    setContextMenu(null)
    setCameraEditingId(null)
    if (event.button === 1 || tool === 'pan') {
      event.preventDefault()
      svgRef.current?.setPointerCapture(event.pointerId)
      setPanning(true)
      dragRef.current = {
        kind: 'pan',
        startClient: { x: event.clientX, y: event.clientY },
        startCenter: viewport.center
      }
      return
    }
    if (event.button !== 0) return

    const world = worldFromClient(event.clientX, event.clientY)

    if (tool === 'text') {
      const id = createTextAt(world)
      if (id) {
        setTool('select')
        setEditingTextId(id)
      }
      return
    }

    if (
      tool === 'rectangle' ||
      tool === 'roundedRectangle' ||
      tool === 'ellipse' ||
      tool === 'triangle' ||
      tool === 'line' ||
      tool === 'arrow'
    ) {
      svgRef.current?.setPointerCapture(event.pointerId)
      dragRef.current = { kind: 'create', startWorld: world, tool }
      setPreview({ x: world.x, y: world.y, width: 0.001, height: 0.001 })
      return
    }

    if (tool === 'select') {
      clearSelection()
      setEditingTextId(null)
    }
  }

  const handleElementPointerDown = (
    elementId: string,
    event: ReactPointerEvent<SVGGElement>
  ): void => {
    if (!project || !scene || event.button !== 0 || tool !== 'select') return
    const element = scene.elements.find((candidate) => candidate.id === elementId)
    if (!element) return
    setCameraEditingId(null)

    const additive = event.shiftKey || event.ctrlKey || event.metaKey
    const currentSelection = useEditorStore.getState().selection
    if (additive) useEditorStore.getState().toggleSelect(elementId)
    else if (!currentSelection.includes(elementId)) select([elementId])

    const nextSelection = useEditorStore.getState().selection
    if (!nextSelection.includes(elementId) || element.locked) return

    const origins = new Map<string, Rect>()
    for (const id of nextSelection) {
      const candidate = scene.elements.find((item) => item.id === id)
      if (candidate) origins.set(id, { ...candidate.frame })
    }
    beginTransaction(nextSelection.length > 1 ? 'Move elements' : 'Move element')
    dragRef.current = {
      kind: 'move',
      ids: nextSelection,
      startWorld: worldFromClient(event.clientX, event.clientY),
      origins
    }
    svgRef.current?.setPointerCapture(event.pointerId)
  }

  const startResize = (
    event: ReactPointerEvent<SVGRectElement>,
    element: DocElement,
    handle: ResizeHandle
  ): void => {
    if (event.button !== 0) return
    event.stopPropagation()
    beginTransaction('Resize element')
    dragRef.current = {
      kind: 'resize',
      id: element.id,
      handle,
      startWorld: worldFromClient(event.clientX, event.clientY),
      frame: { ...element.frame },
      rotation: element.rotation,
      text:
        element.kind === 'text'
          ? { fontSize: element.fontSize, letterSpacing: element.letterSpacing }
          : undefined
    }
    svgRef.current?.setPointerCapture(event.pointerId)
  }

  const startRotate = (event: ReactPointerEvent<SVGCircleElement>, element: DocElement): void => {
    if (event.button !== 0) return
    event.stopPropagation()
    const center = {
      x: element.frame.x + element.frame.width / 2,
      y: element.frame.y + element.frame.height / 2
    }
    const world = worldFromClient(event.clientX, event.clientY)
    beginTransaction('Rotate element')
    dragRef.current = {
      kind: 'rotate',
      id: element.id,
      center,
      startAngle: Math.atan2(world.y - center.y, world.x - center.x),
      startRotation: element.rotation
    }
    svgRef.current?.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>): void => {
    const drag = dragRef.current
    if (!drag || !project || !scene) return
    const world = worldFromClient(event.clientX, event.clientY)

    if (drag.kind === 'pan') {
      const zoom = useEditorStore.getState().viewport.zoom
      setViewport({
        zoom,
        center: {
          x: drag.startCenter.x - (event.clientX - drag.startClient.x) / zoom,
          y: drag.startCenter.y - (event.clientY - drag.startClient.y) / zoom
        }
      })
      return
    }

    if (drag.kind === 'create') {
      setPreview({
        x: Math.min(drag.startWorld.x, world.x),
        y: Math.min(drag.startWorld.y, world.y),
        width: Math.max(1, Math.abs(world.x - drag.startWorld.x)),
        height: Math.max(1, Math.abs(world.y - drag.startWorld.y))
      })
      return
    }

    if (drag.kind === 'move') {
      let dx = world.x - drag.startWorld.x
      let dy = world.y - drag.startWorld.y
      const zoom = useEditorStore.getState().viewport.zoom
      let guideX: number | null = null
      let guideY: number | null = null

      if (snapping && drag.ids.length === 1) {
        const id = drag.ids[0]!
        const origin = drag.origins.get(id)
        if (origin) {
          const snap = computeSnap(
            project,
            scene,
            id,
            origin,
            dx,
            dy,
            6 / zoom
          )
          dx = snap.dx
          dy = snap.dy
          guideX = snap.guideX
          guideY = snap.guideY
        }
      }
      setGuides({ x: guideX, y: guideY })

      const ids = new Set(drag.ids)
      apply(
        'Move elements',
        (current) =>
          updateElements(current, scene.id, ids, (element) => {
            const origin = drag.origins.get(element.id)
            if (!origin) return element
            return {
              ...element,
              frame: { ...element.frame, x: origin.x + dx, y: origin.y + dy }
            }
          }),
        { coalesce: false }
      )
      return
    }

    if (drag.kind === 'resize') {
      const dx = world.x - drag.startWorld.x
      const dy = world.y - drag.startWorld.y
      const angle = (-drag.rotation * Math.PI) / 180
      const localDx = dx * Math.cos(angle) - dy * Math.sin(angle)
      const localDy = dx * Math.sin(angle) + dy * Math.cos(angle)
      const frame = resizeFrame(drag.frame, drag.handle, localDx, localDy, drag.rotation, 8)
      const text = drag.text
      if (text) {
        const scale = textResizeScale(drag.frame, drag.handle, localDx, localDy)
        const scaledFrame = scaledFrameAboutHandle(drag.frame, drag.handle, scale, drag.rotation)
        apply(
          'Resize text',
          (current) =>
            updateElements(current, scene.id, new Set([drag.id]), (element) =>
              element.kind === 'text'
                ? {
                    ...element,
                    frame: scaledFrame,
                    fontSize: Math.max(4, roundTo(text.fontSize * scale, 2)),
                    letterSpacing: roundTo(text.letterSpacing * scale, 2)
                  }
                : { ...element, frame }
            ),
          { coalesce: false }
        )
        return
      }
      apply(
        'Resize element',
        (current) =>
          updateElements(current, scene.id, new Set([drag.id]), (element) => ({ ...element, frame })),
        { coalesce: false }
      )
      return
    }

    if (drag.kind === 'rotate') {
      const angle = Math.atan2(world.y - drag.center.y, world.x - drag.center.x)
      let rotation = drag.startRotation + ((angle - drag.startAngle) * 180) / Math.PI
      if (event.shiftKey) rotation = Math.round(rotation / 15) * 15
      apply(
        'Rotate element',
        (current) =>
          updateElements(current, scene.id, new Set([drag.id]), (element) => ({
            ...element,
            rotation: roundTo(rotation, 2)
          })),
        { coalesce: false }
      )
    }
  }

  const finishDrag = (event: ReactPointerEvent<SVGSVGElement>): void => {
    const drag = dragRef.current
    dragRef.current = null
    setPanning(false)
    setGuides({ x: null, y: null })
    if (svgRef.current?.hasPointerCapture(event.pointerId)) {
      svgRef.current.releasePointerCapture(event.pointerId)
    }
    if (!drag) return

    if (drag.kind === 'create') {
      setPreview(null)
      const world = worldFromClient(event.clientX, event.clientY)
      const rect = {
        x: Math.min(drag.startWorld.x, world.x),
        y: Math.min(drag.startWorld.y, world.y),
        width: Math.abs(world.x - drag.startWorld.x),
        height: Math.abs(world.y - drag.startWorld.y)
      }
      if (rect.width >= 8 && rect.height >= 8) {
        const kind =
          drag.tool === 'rectangle' ||
          drag.tool === 'roundedRectangle' ||
          drag.tool === 'ellipse' ||
          drag.tool === 'triangle' ||
          drag.tool === 'line' ||
          drag.tool === 'arrow'
            ? drag.tool
            : 'rectangle'
        createShapeFromRect(kind, rect)
        setTool('select')
      }
      return
    }
    if (drag.kind !== 'pan') endTransaction()
  }

  const handleDoubleClick = (event: ReactMouseEvent): void => {
    if (!project || !scene) return
    const id = elementIdFromTarget(event.target)
    if (!id) return
    const element = scene.elements.find((candidate) => candidate.id === id)
    if (element?.kind === 'text') {
      select([id])
      setEditingTextId(id)
    }
  }

  const handleContextMenu = (event: ReactMouseEvent): void => {
    event.preventDefault()
    if (!project || !scene) return
    const id = elementIdFromTarget(event.target)
    if (id) {
      if (!useEditorStore.getState().selection.includes(id)) select([id])
    } else {
      clearSelection()
    }
    setContextMenu({ x: event.clientX, y: event.clientY })
  }

  /* ---------------------------------------------------------------- */
  /* Render                                                            */
  /* ---------------------------------------------------------------- */

  if (!project || !scene || !visual || !schedule) {
    return <div ref={hostRef} className="canvas-host" />
  }

  const token = session?.assetToken ?? ''
  const pageFrame = pageFrameOf(project.output)
  const viewWidth = size.width / viewport.zoom
  const viewHeight = size.height / viewport.zoom
  const viewFrame: Rect = {
    x: viewport.center.x - viewWidth / 2,
    y: viewport.center.y - viewHeight / 2,
    width: viewWidth,
    height: viewHeight
  }
  const viewBox = `${viewFrame.x} ${viewFrame.y} ${viewWidth} ${viewHeight}`
  const selectionElements = scene.elements.filter((element) => selection.includes(element.id))
  const singleSelection = selectionElements.length === 1 ? selectionElements[0]! : null
  const selectedCamera = scene.cameras.find((camera) => camera.id === selectedCameraId)
  const activeCamera = scene.cameras.find((camera) => camera.id === visual.camera.cameraId)
  const zoomPercent = Math.round(viewport.zoom * 1000) / 10

  return (
    <div ref={hostRef} className="canvas-host">
      <svg
        ref={svgRef}
        className={[
          'canvas-svg',
          tool === 'pan' ? 'tool-pan' : '',
          panning ? 'panning' : '',
          tool === 'text' ? 'tool-text' : '',
          tool !== 'select' && tool !== 'text' && tool !== 'pan' ? 'tool-create' : ''
        ]
          .filter(Boolean)
          .join(' ')}
        viewBox={viewBox}
        onPointerDown={handleSvgPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      >
        <rect
          className="canvas-page"
          x={pageFrame.x}
          y={pageFrame.y}
          width={pageFrame.width}
          height={pageFrame.height}
          strokeWidth={1 / viewport.zoom}
          pointerEvents="none"
        />
        <SceneArtwork
          project={project}
          scene={scene}
          visual={displayVisual ?? visual}
          token={token}
          idPrefix={`stage-${scene.id}`}
          backgroundFrame={viewFrame}
          grid={
            <GridLayer visible={showGrid} viewport={viewport} size={size} />
          }
          interactive={tool === 'select'}
          onElementPointerDown={handleElementPointerDown}
        />

        <CameraChrome
          project={project}
          scene={scene}
          activeCameraId={visual.camera.cameraId}
          selectedCameraId={selectedCamera?.id ?? null}
          editingCameraId={cameraEditingId}
          zoom={viewport.zoom}
          onSelect={selectCamera}
          onEdit={(cameraId) => setCameraEditingId(cameraId)}
          toWorld={worldFromClient}
          onMove={(cameraId, center) =>
            apply(
              'Move camera',
              (current) =>
                updateCamera(current, scene.id, cameraId, (camera) => ({ ...camera, center })),
              { coalesce: true }
            )
          }
          onResize={(cameraId, viewWidth, center) =>
            apply(
              'Resize camera',
              (current) =>
                updateCamera(current, scene.id, cameraId, (camera) => ({
                  ...camera,
                  center,
                  viewWidth: Math.max(32, viewWidth)
                })),
              { coalesce: true }
            )
          }
        />

        {!playing
          ? selectionElements.map((element) => (
              <SelectionLayer
                key={element.id}
                element={element}
                zoom={viewport.zoom}
                showHandles={singleSelection?.id === element.id && !element.locked}
                onResizeStart={startResize}
                onRotateStart={startRotate}
              />
            ))
          : null}

        {guides.x !== null ? (
          <line
            className="guide-line"
            x1={guides.x}
            y1={viewport.center.y - viewHeight / 2}
            x2={guides.x}
            y2={viewport.center.y + viewHeight / 2}
            strokeWidth={1 / viewport.zoom}
          />
        ) : null}
        {guides.y !== null ? (
          <line
            className="guide-line"
            x1={viewport.center.x - viewWidth / 2}
            y1={guides.y}
            x2={viewport.center.x + viewWidth / 2}
            y2={guides.y}
            strokeWidth={1 / viewport.zoom}
          />
        ) : null}

        {preview ? (
          <rect
            x={preview.x}
            y={preview.y}
            width={preview.width}
            height={preview.height}
            fill="rgba(255,63,208,0.10)"
            stroke="var(--selection)"
            strokeWidth={1.5 / viewport.zoom}
            strokeDasharray={`${6 / viewport.zoom} ${4 / viewport.zoom}`}
            pointerEvents="none"
          />
        ) : null}

        {selectionElements.length > 1 ? (
          <MultiSelectionOutline elements={selectionElements} zoom={viewport.zoom} />
        ) : null}
      </svg>

      <div className="canvas-badge">
        <span className="camera-dot" />
        <span>{selectedCamera?.name ?? activeCamera?.name ?? 'Camera'}</span>
        <span style={{ color: 'var(--text-muted)' }}>
          {Math.round(visual.camera.frame.width)} × {Math.round(visual.camera.frame.height)}
        </span>
      </div>

      <ZoomHud
        zoom={zoomPercent}
        onZoomIn={() =>
          setViewport(
            zoomAroundPoint(viewport, size, { x: size.width / 2, y: size.height / 2 }, 1.25)
          )
        }
        onZoomOut={() =>
          setViewport(
            zoomAroundPoint(viewport, size, { x: size.width / 2, y: size.height / 2 }, 0.8)
          )
        }
        onReset={() =>
          setViewport(
            zoomAroundPoint(viewport, size, { x: size.width / 2, y: size.height / 2 }, 1 / viewport.zoom)
          )
        }
        onFit={fitView}
      />

      {editingTextId ? (
        <InlineTextEditor
          key={editingTextId}
          elementId={editingTextId}
          project={project}
          scene={scene}
          viewport={viewport}
          size={size}
          onDone={() => setEditingTextId(null)}
        />
      ) : null}

      {contextMenu ? (
        <CanvasContextMenu
          state={contextMenu}
          hasTextSelection={singleSelection?.kind === 'text'}
          locked={singleSelection?.locked ?? false}
          visible={singleSelection?.visible ?? true}
          onClose={() => setContextMenu(null)}
          onEditText={(id) => {
            select([id])
            setEditingTextId(id)
          }}
        />
      ) : null}
    </div>
  )
}

function elementIdFromTarget(target: EventTarget | null): string | null {
  if (!(target instanceof SVGElement)) return null
  return target.closest('[data-element-id]')?.getAttribute('data-element-id') ?? null
}

/* ------------------------------------------------------------------ */
/* Grid                                                               */
/* ------------------------------------------------------------------ */

interface GridLayerProps {
  visible: boolean
  viewport: { center: Vec2; zoom: number }
  size: { width: number; height: number }
}

function GridLayer({ visible, viewport, size }: GridLayerProps): JSX.Element | null {
  if (!visible || size.width === 0) return null
  const viewWidth = size.width / viewport.zoom
  const viewHeight = size.height / viewport.zoom
  const left = viewport.center.x - viewWidth / 2
  const top = viewport.center.y - viewHeight / 2

  let step = 100
  while (step * viewport.zoom < 28) step *= 5
  while (step * viewport.zoom > 220) step /= 2

  const startX = Math.floor(left / step) * step
  const startY = Math.floor(top / step) * step

  /* A pattern keeps the grid anchored to world coordinates while costing one rect
     instead of a line per column and row, which mattered at 400+ elements a side. */
  return (
    <g pointerEvents="none">
      <defs>
        <pattern
          id="ows-grid"
          x={startX}
          y={startY}
          width={step}
          height={step}
          patternUnits="userSpaceOnUse"
        >
          <circle
            cx={0}
            cy={0}
            r={1.15 / viewport.zoom}
            fill="none"
            stroke="rgba(18,20,26,0.3)"
            strokeWidth={1.7 / viewport.zoom}
          />
        </pattern>
      </defs>
      <rect
        x={startX}
        y={startY}
        width={viewWidth + step}
        height={viewHeight + step}
        fill="url(#ows-grid)"
      />
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* Camera chrome                                                      */
/* ------------------------------------------------------------------ */

interface CameraChromeProps {
  project: Project
  scene: Scene
  activeCameraId: string
  selectedCameraId: string | null
  editingCameraId: string | null
  zoom: number
  onSelect: (cameraId: string) => void
  onEdit: (cameraId: string) => void
  toWorld: (clientX: number, clientY: number) => Vec2
  onMove: (cameraId: string, center: Vec2) => void
  onResize: (cameraId: string, viewWidth: number, center: Vec2) => void
}

function CameraChrome({
  project,
  scene,
  activeCameraId,
  selectedCameraId,
  editingCameraId,
  zoom,
  onSelect,
  onEdit,
  toWorld,
  onMove,
  onResize
}: CameraChromeProps): JSX.Element {
  const dragCamera = (
    event: ReactPointerEvent,
    cameraId: string,
    startCenter: Vec2
  ): void => {
    event.stopPropagation()
    event.preventDefault()
    onSelect(cameraId)
    const start = toWorld(event.clientX, event.clientY)
    const move = (moveEvent: PointerEvent): void => {
      const world = toWorld(moveEvent.clientX, moveEvent.clientY)
      onMove(cameraId, {
        x: startCenter.x + (world.x - start.x),
        y: startCenter.y + (world.y - start.y)
      })
    }
    const up = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const resizeCamera = (
    event: ReactPointerEvent,
    cameraId: string,
    startWidth: number,
    startCenter: Vec2,
    direction: { x: 1 | -1; y: 1 | -1 }
  ): void => {
    event.stopPropagation()
    event.preventDefault()
    onSelect(cameraId)
    const move = (moveEvent: PointerEvent): void => {
      const world = toWorld(moveEvent.clientX, moveEvent.clientY)
      const aspect = project.output.width / project.output.height
      const fixed = {
        x: startCenter.x - direction.x * startWidth / 2,
        y: startCenter.y - direction.y * (startWidth / aspect) / 2
      }
      const dx = world.x - fixed.x
      const dy = world.y - fixed.y
      // Project the pointer onto the camera's locked-aspect diagonal. The
      // opposite corner stays anchored, matching a conventional frame resize.
      const inverseAspect = 1 / aspect
      const width = Math.max(
        32,
        (dx * direction.x + dy * direction.y * inverseAspect) /
          (1 + inverseAspect * inverseAspect)
      )
      onResize(cameraId, width, {
        x: fixed.x + direction.x * width / 2,
        y: fixed.y + direction.y * width / aspect / 2
      })
    }
    const up = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <g>
      {scene.cameras.map((camera) => {
        const frame = cameraFrame(camera, project.output)
        const active = camera.id === activeCameraId
        const selected = camera.id === selectedCameraId
        if (!active && !selected) return null
        const editing = selected && camera.id === editingCameraId
        const handle = 6 / zoom
        const chipWidth = Math.max(70, camera.name.length * 7.4 + 26) / zoom
        const chipHeight = 23 / zoom
        const corners: Array<{ x: number; y: number; direction: { x: 1 | -1; y: 1 | -1 } }> = [
          { x: frame.x, y: frame.y, direction: { x: -1, y: -1 } },
          { x: frame.x + frame.width, y: frame.y, direction: { x: 1, y: -1 } },
          { x: frame.x, y: frame.y + frame.height, direction: { x: -1, y: 1 } },
          { x: frame.x + frame.width, y: frame.y + frame.height, direction: { x: 1, y: 1 } }
        ]

        return (
          <g key={camera.id}>
            <rect
              className="camera-frame"
              x={frame.x}
              y={frame.y}
              width={frame.width}
              height={frame.height}
              strokeWidth={1.4 / zoom}
              opacity={selected ? 1 : 0.8}
              fill="none"
              pointerEvents="none"
            />
            <g pointerEvents="none" opacity={0.55}>
              <line
                x1={frame.x}
                y1={frame.y}
                x2={frame.x + frame.width}
                y2={frame.y + frame.height}
                className="camera-diagonal"
                strokeWidth={1 / zoom}
                strokeDasharray={`${6 / zoom} ${5 / zoom}`}
              />
              <line
                x1={frame.x + frame.width}
                y1={frame.y}
                x2={frame.x}
                y2={frame.y + frame.height}
                className="camera-diagonal"
                strokeWidth={1 / zoom}
                strokeDasharray={`${6 / zoom} ${5 / zoom}`}
              />
            </g>

            {/* Only the border is a hit target so elements inside stay clickable. */}
            <rect
              x={frame.x}
              y={frame.y}
              width={frame.width}
              height={frame.height}
              fill="none"
              stroke="transparent"
              strokeWidth={Math.max(10 / zoom, 8)}
              pointerEvents="stroke"
              style={{ cursor: editing ? 'move' : 'default' }}
              onPointerDown={(event) => {
                if (editing) dragCamera(event, camera.id, camera.center)
                else {
                  event.stopPropagation()
                  onSelect(camera.id)
                }
              }}
              onDoubleClick={(event) => {
                event.stopPropagation()
                event.preventDefault()
                onSelect(camera.id)
                onEdit(camera.id)
              }}
            >
              <title>Double-click to move or resize this camera</title>
            </rect>

            {editing
              ? corners.map((corner, index) => (
                  <rect
                    key={index}
                    className="camera-handle"
                    x={corner.x - handle / 2}
                    y={corner.y - handle / 2}
                    width={handle}
                    height={handle}
                    rx={1 / zoom}
                    onPointerDown={(event) =>
                      resizeCamera(
                        event,
                        camera.id,
                        camera.viewWidth,
                        camera.center,
                        corner.direction
                      )
                    }
                    style={{
                      cursor:
                        corner.direction.x === corner.direction.y
                          ? 'nwse-resize'
                          : 'nesw-resize'
                    }}
                  />
                ))
              : null}

            <g
              transform={`translate(${frame.x + frame.width / 2 - chipWidth / 2} ${frame.y - chipHeight - 5 / zoom})`}
              opacity={0.72}
              onPointerDown={(event) => dragCamera(event, camera.id, camera.center)}
              onDoubleClick={(event) => {
                event.stopPropagation()
                event.preventDefault()
                onSelect(camera.id)
                onEdit(camera.id)
              }}
              style={{ cursor: 'move' }}
            >
              <title>{`${camera.name} — double-click for corner handles`}</title>
              <rect
                x={0}
                y={0}
                width={chipWidth}
                height={chipHeight}
                rx={4 / zoom}
                className="camera-chip"
              />
              <text
                className="camera-label"
                x={chipWidth / 2}
                y={chipHeight / 2 + 4.4 / zoom}
                fontSize={12.5 / zoom}
                textAnchor="middle"
              >
                {camera.name}
              </text>
            </g>
          </g>
        )
      })}
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* Selection                                                          */
/* ------------------------------------------------------------------ */

interface SelectionLayerProps {
  element: DocElement
  zoom: number
  showHandles: boolean
  onResizeStart: (
    event: ReactPointerEvent<SVGRectElement>,
    element: DocElement,
    handle: ResizeHandle
  ) => void
  onRotateStart: (event: ReactPointerEvent<SVGCircleElement>, element: DocElement) => void
}

const HANDLE_POSITIONS: Array<{ handle: ResizeHandle; x: number; y: number }> = [
  { handle: 'nw', x: 0, y: 0 },
  { handle: 'n', x: 0.5, y: 0 },
  { handle: 'ne', x: 1, y: 0 },
  { handle: 'e', x: 1, y: 0.5 },
  { handle: 'se', x: 1, y: 1 },
  { handle: 's', x: 0.5, y: 1 },
  { handle: 'sw', x: 0, y: 1 },
  { handle: 'w', x: 0, y: 0.5 }
]

function SelectionLayer({
  element,
  zoom,
  showHandles,
  onResizeStart,
  onRotateStart
}: SelectionLayerProps): JSX.Element {
  const frame = element.frame
  const center = { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 }
  const rotation = element.rotation
  const handleSize = HANDLE_SIZE / zoom
  const rotateOffset = ROTATE_OFFSET / zoom

  const localToWorld = (x: number, y: number): Vec2 => {
    const radians = (rotation * Math.PI) / 180
    const dx = x - center.x
    const dy = y - center.y
    return {
      x: center.x + dx * Math.cos(radians) - dy * Math.sin(radians),
      y: center.y + dx * Math.sin(radians) + dy * Math.cos(radians)
    }
  }

  const topCenter = localToWorld(center.x, frame.y)
  const rotateHandle = localToWorld(center.x, frame.y - rotateOffset * 0.9)

  return (
    <g>
      <rect
        className="selection-box"
        x={frame.x}
        y={frame.y}
        width={frame.width}
        height={frame.height}
        transform={`rotate(${rotation} ${center.x} ${center.y})`}
        strokeWidth={1.5 / zoom}
        pointerEvents="none"
      />
      {showHandles ? (
        <g>
          <line
            className="rotate-handle-line"
            x1={topCenter.x}
            y1={topCenter.y}
            x2={rotateHandle.x}
            y2={rotateHandle.y}
            strokeWidth={1.2 / zoom}
            pointerEvents="none"
          />
          <circle
            cx={rotateHandle.x}
            cy={rotateHandle.y}
            r={4 / zoom}
            fill="#ffffff"
            stroke="var(--selection)"
            strokeWidth={1.5 / zoom}
            style={{ cursor: 'grab' }}
            onPointerDown={(event) => onRotateStart(event, element)}
          />
          {HANDLE_POSITIONS.map(({ handle, x, y }) => {
            const point = localToWorld(frame.x + frame.width * x, frame.y + frame.height * y)
            return (
              <rect
                key={handle}
                className="selection-handle"
                x={point.x - handleSize / 2}
                y={point.y - handleSize / 2}
                width={handleSize}
                height={handleSize}
                strokeWidth={1.5 / zoom}
                style={{ cursor: cursorFor(handle) }}
                onPointerDown={(event) => onResizeStart(event, element, handle)}
              />
            )
          })}
        </g>
      ) : null}
    </g>
  )
}

function cursorFor(handle: ResizeHandle): string {
  switch (handle) {
    case 'n':
    case 's':
      return 'ns-resize'
    case 'e':
    case 'w':
      return 'ew-resize'
    case 'nw':
    case 'se':
      return 'nwse-resize'
    case 'ne':
    case 'sw':
      return 'nesw-resize'
  }
}

function MultiSelectionOutline({
  elements,
  zoom
}: {
  elements: DocElement[]
  zoom: number
}): JSX.Element | null {
  const bounds = unionRects(
    elements.map((element) => rotatedRectBounds(element.frame, element.rotation))
  )
  if (!bounds) return null
  return (
    <rect
      x={bounds.x - 4 / zoom}
      y={bounds.y - 4 / zoom}
      width={bounds.width + 8 / zoom}
      height={bounds.height + 8 / zoom}
      fill="none"
      stroke="var(--selection)"
      strokeDasharray={`${5 / zoom} ${4 / zoom}`}
      strokeWidth={1.2 / zoom}
      pointerEvents="none"
    />
  )
}

/* ------------------------------------------------------------------ */
/* Snapping                                                           */
/* ------------------------------------------------------------------ */

function computeSnap(
  project: Project,
  scene: Scene,
  movingId: string,
  origin: Rect,
  dx: number,
  dy: number,
  threshold: number
): { dx: number; dy: number; guideX: number | null; guideY: number | null } {
  const targetsX: number[] = []
  const targetsY: number[] = []
  for (const element of scene.elements) {
    if (element.id === movingId || !element.visible) continue
    const bounds = rotatedRectBounds(element.frame, element.rotation)
    targetsX.push(bounds.x, bounds.x + bounds.width / 2, bounds.x + bounds.width)
    targetsY.push(bounds.y, bounds.y + bounds.height / 2, bounds.y + bounds.height)
  }
  const camera = scene.cameras[0]
  if (camera) {
    const frame = cameraFrame(camera, project.output)
    targetsX.push(frame.x, frame.x + frame.width / 2, frame.x + frame.width)
    targetsY.push(frame.y, frame.y + frame.height / 2, frame.y + frame.height)
  }
  targetsX.push(0)
  targetsY.push(0)

  const x = origin.x + dx
  const y = origin.y + dy
  const width = origin.width
  const height = origin.height

  let bestX = threshold
  let adjustX = 0
  let guideX: number | null = null
  for (const target of targetsX) {
    for (const edge of [x, x + width / 2, x + width]) {
      const distance = target - edge
      if (Math.abs(distance) <= bestX) {
        bestX = Math.abs(distance)
        adjustX = distance
        guideX = target
      }
    }
  }

  let bestY = threshold
  let adjustY = 0
  let guideY: number | null = null
  for (const target of targetsY) {
    for (const edge of [y, y + height / 2, y + height]) {
      const distance = target - edge
      if (Math.abs(distance) <= bestY) {
        bestY = Math.abs(distance)
        adjustY = distance
        guideY = target
      }
    }
  }

  return {
    dx: guideX === null ? dx : dx + adjustX,
    dy: guideY === null ? dy : dy + adjustY,
    guideX,
    guideY
  }
}

/* ------------------------------------------------------------------ */
/* Inline text editor                                                 */
/* ------------------------------------------------------------------ */

interface InlineTextEditorProps {
  elementId: string
  project: Project
  scene: Scene
  viewport: { center: Vec2; zoom: number }
  size: { width: number; height: number }
  onDone: () => void
}

function InlineTextEditor({
  elementId,
  scene,
  viewport,
  size,
  onDone
}: InlineTextEditorProps): JSX.Element | null {
  const element = scene.elements.find((candidate) => candidate.id === elementId)
  const apply = useProjectStore((state) => state.apply)
  const [value, setValue] = useState(element?.kind === 'text' ? element.text : '')
  const areaRef = useRef<HTMLTextAreaElement | null>(null)
  const committed = useRef(false)

  useEffect(() => {
    areaRef.current?.focus()
    areaRef.current?.select()
  }, [])

  if (!element || element.kind !== 'text') return null

  const topLeft = worldToScreen({ x: element.frame.x, y: element.frame.y }, viewport, size)
  const zoom = viewport.zoom

  const commit = (): void => {
    if (committed.current) return
    committed.current = true
    if (value !== element.text) {
      apply('Edit text', (current) => ({
        ...current,
        scenes: current.scenes.map((candidate) =>
          candidate.id !== scene.id
            ? candidate
            : {
                ...candidate,
                elements: candidate.elements.map((item) => {
                  if (item.id !== element.id || item.kind !== 'text') return item
                  const edited = { ...item, text: value }
                  return { ...edited, frame: fitTextFrame(edited) }
                })
              }
        )
      }))
    }
    onDone()
  }

  return (
    <textarea
      ref={areaRef}
      className="canvas-text-editor"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={commit}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          committed.current = true
          onDone()
        } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault()
          commit()
        }
        event.stopPropagation()
      }}
      style={{
        left: topLeft.x,
        top: topLeft.y,
        width: Math.max(40, element.frame.width * zoom),
        height: Math.max(24, element.frame.height * zoom),
        fontSize: element.fontSize * zoom,
        fontWeight: element.fontWeight,
        color: element.color,
        textAlign: element.align,
        letterSpacing: element.letterSpacing * zoom,
        lineHeight: element.lineHeight
      }}
    />
  )
}

/* ------------------------------------------------------------------ */
/* HUD                                                                */
/* ------------------------------------------------------------------ */

interface ZoomHudProps {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
  onFit: () => void
}

function ZoomHud({ zoom, onZoomIn, onZoomOut, onReset, onFit }: ZoomHudProps): JSX.Element {
  return (
    <div className="canvas-hud">
      <button className="icon-btn" title="Zoom out (Ctrl + −)" onClick={onZoomOut}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M3 7h8" />
        </svg>
      </button>
      <button className="zoom-value" title="Reset to 100%" onClick={onReset}>
        {zoom}%
      </button>
      <button className="icon-btn" title="Zoom in (Ctrl + +)" onClick={onZoomIn}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M7 3v8M3 7h8" />
        </svg>
      </button>
      <button className="icon-btn" title="Fit scene (Shift + 1)" onClick={onFit}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M5 2H2v3M9 2h3v3M5 12H2V9M9 12h3V9" />
        </svg>
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Context menu                                                       */
/* ------------------------------------------------------------------ */

interface CanvasContextMenuProps {
  state: ContextMenuState
  hasTextSelection: boolean
  locked: boolean
  visible: boolean
  onClose: () => void
  onEditText: (elementId: string) => void
}

function CanvasContextMenu({
  state,
  hasTextSelection,
  locked,
  visible,
  onClose,
  onEditText
}: CanvasContextMenuProps): JSX.Element {
  const project = useProjectStore((store) => store.project)
  const selection = useEditorStore((store) => store.selection)
  const clipboard = useEditorStore((store) => store.clipboard)
  const scene = project?.scenes.find((candidate) => candidate.id === useEditorStore.getState().activeSceneId)
  const selectedElement = scene?.elements.find((element) => selection.includes(element.id))

  const run = (action: () => void): void => {
    action()
    onClose()
  }

  return (
    <div
      className="menu-popover"
      style={{ position: 'fixed', left: state.x, top: state.y, right: 'auto', zIndex: 80 }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        className="menu-item"
        disabled={!hasTextSelection || !selectedElement}
        onClick={() => {
          if (selectedElement) {
            const id = selectedElement.id
            onClose()
            onEditText(id)
          }
        }}
      >
        Edit text
      </button>
      <div className="menu-sep" />
      <button className="menu-item" disabled={selection.length === 0} onClick={() => run(cutSelection)}>
        Cut <span className="menu-shortcut">Ctrl+X</span>
      </button>
      <button className="menu-item" disabled={selection.length === 0} onClick={() => run(copySelection)}>
        Copy <span className="menu-shortcut">Ctrl+C</span>
      </button>
      <button className="menu-item" disabled={clipboard.length === 0} onClick={() => run(pasteClipboard)}>
        Paste <span className="menu-shortcut">Ctrl+V</span>
      </button>
      <button className="menu-item" disabled={selection.length === 0} onClick={() => run(duplicateSelection)}>
        Duplicate <span className="menu-shortcut">Ctrl+D</span>
      </button>
      <button className="menu-item" disabled={selection.length === 0} onClick={() => run(deleteSelection)}>
        Delete <span className="menu-shortcut">Del</span>
      </button>
      <div className="menu-sep" />
      <button className="menu-item" disabled={selection.length === 0} onClick={() => run(bringSelectionForward)}>
        Bring forward
      </button>
      <button className="menu-item" disabled={selection.length === 0} onClick={() => run(sendSelectionBackward)}>
        Send backward
      </button>
      <button className="menu-item" disabled={selection.length === 0} onClick={() => run(toggleSelectedLocked)}>
        {locked ? 'Unlock' : 'Lock'}
      </button>
      <button className="menu-item" disabled={selection.length === 0} onClick={() => run(toggleSelectedVisible)}>
        {visible ? 'Hide' : 'Show'}
      </button>
      <div className="menu-sep" />
      <button className="menu-item" onClick={() => run(selectAll)}>
        Select all <span className="menu-shortcut">Ctrl+A</span>
      </button>
      <button
        className="menu-item"
        onClick={() => run(() => useEditorStore.getState().requestFit())}
      >
        Fit scene <span className="menu-shortcut">Shift+1</span>
      </button>
    </div>
  )
}
