import { rectFromCenter } from '@core/geometry'
import { createId } from '@core/ids'
import { cameraFrame } from '@core/camera/sample'
import {
  addElement,
  bringElementForward,
  duplicateElements,
  mapScene,
  moveElements,
  removeElements,
  sendElementBackward,
  updateElement
} from '@core/project/operations'
import { createShapeElement, createTextElement, nextElementName } from '@core/schema/factories'
import type { Element, Project, Scene, ShapeKind } from '@core/schema/project'
import type { Rect, Vec2 } from '@core/schema/primitives'
import { fitTextFrame } from '../components/canvas/textMetrics'
import { useEditorStore } from '../state/editorStore'
import { useProjectStore } from '../state/projectStore'
import { useUiStore } from '../state/uiStore'

export function activeScene(project: Project): Scene | null {
  const id = useEditorStore.getState().activeSceneId
  return project.scenes.find((scene) => scene.id === id) ?? project.scenes[0] ?? null
}

export function selectedElements(project: Project): Element[] {
  const scene = activeScene(project)
  if (!scene) return []
  const ids = new Set(useEditorStore.getState().selection)
  return scene.elements.filter((element) => ids.has(element.id))
}

function withScene(
  label: string,
  recipe: (project: Project, scene: Scene) => Project
): boolean {
  const { project, apply } = useProjectStore.getState()
  if (!project) return false
  const scene = activeScene(project)
  if (!scene) return false
  const next = recipe(project, scene)
  if (next === project) return false
  apply(label, () => next, { coalesce: false })
  return true
}

export function deleteSelection(): void {
  const { project } = useProjectStore.getState()
  if (!project) return
  const scene = activeScene(project)
  const ids = new Set(useEditorStore.getState().selection)
  if (!scene || ids.size === 0) return
  useProjectStore.getState().apply(
    'Delete elements',
    (current) => removeElements(current, scene.id, ids),
    { coalesce: false }
  )
  useEditorStore.getState().clearSelection()
}

export function duplicateSelection(): void {
  const { project } = useProjectStore.getState()
  if (!project) return
  const scene = activeScene(project)
  const ids = new Set(useEditorStore.getState().selection)
  if (!scene || ids.size === 0) return
  let newIds: string[] = []
  useProjectStore.getState().apply(
    'Duplicate elements',
    (current) => {
      const result = duplicateElements(current, scene.id, ids)
      newIds = result.newIds
      return result.project
    },
    { coalesce: false }
  )
  useEditorStore.getState().select(newIds)
}

export function copySelection(): void {
  const { project } = useProjectStore.getState()
  if (!project) return
  const elements = selectedElements(project)
  if (elements.length === 0) return
  useEditorStore.getState().setClipboard(structuredClone(elements) as Element[])
  useUiStore.getState().toast(
    elements.length === 1 ? 'Copied 1 element.' : `Copied ${elements.length} elements.`,
    'info'
  )
}

export function cutSelection(): void {
  copySelection()
  deleteSelection()
}

export function pasteClipboard(): void {
  const { project } = useProjectStore.getState()
  if (!project) return
  const scene = activeScene(project)
  const clipboard = useEditorStore.getState().clipboard
  if (!scene || clipboard.length === 0) return

  const pasted: Element[] = clipboard.map((element) => {
    const copy = structuredClone(element) as Element
    copy.id = createId('el')
    copy.frame = { ...copy.frame, x: copy.frame.x + 36, y: copy.frame.y + 36 }
    if (scene.elements.some((candidate) => candidate.name === copy.name)) {
      copy.name = nextElementName(scene.elements, copy.name.replace(/ copy( \d+)?$/, ''))
    }
    return copy
  })

  useProjectStore.getState().apply(
    'Paste elements',
    (current) => {
      let next = current
      for (const element of pasted) next = addElement(next, scene.id, element)
      return next
    },
    { coalesce: false }
  )
  useEditorStore.getState().select(pasted.map((element) => element.id))
}

export function selectAll(): void {
  const { project } = useProjectStore.getState()
  if (!project) return
  const scene = activeScene(project)
  if (!scene) return
  useEditorStore.getState().select(scene.elements.map((element) => element.id))
}

export function nudgeSelection(dx: number, dy: number): void {
  const { project } = useProjectStore.getState()
  if (!project) return
  const scene = activeScene(project)
  const ids = new Set(useEditorStore.getState().selection)
  if (!scene || ids.size === 0) return
  useProjectStore.getState().apply(
    'Move elements',
    (current) => moveElements(current, scene.id, ids, dx, dy)
  )
}

export type AlignEdge = 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom'

/** Line the selection up with the visible stage, the way VideoScribe's icons do. */
export function alignSelection(edge: AlignEdge): void {
  withScene('Align elements', (project, scene) => {
    const ids = new Set(useEditorStore.getState().selection)
    const stage = cameraFrame(scene.cameras[0]!, project.output)
    return mapScene(project, scene.id, (item) => ({
      ...item,
      elements: item.elements.map((element) => {
        if (!ids.has(element.id) || element.locked) return element
        const frame = element.frame
        const x =
          edge === 'left' ? stage.x
            : edge === 'centerX' ? stage.x + (stage.width - frame.width) / 2
              : edge === 'right' ? stage.x + stage.width - frame.width
                : frame.x
        const y =
          edge === 'top' ? stage.y
            : edge === 'centerY' ? stage.y + (stage.height - frame.height) / 2
              : edge === 'bottom' ? stage.y + stage.height - frame.height
                : frame.y
        return x === frame.x && y === frame.y ? element : { ...element, frame: { ...frame, x, y } }
      })
    }))
  })
}

/** Even out the gaps between the selected elements along one axis. */
export function distributeSelection(axis: 'horizontal' | 'vertical'): void {
  withScene('Distribute elements', (project, scene) => {
    const ids = new Set(useEditorStore.getState().selection)
    const moving = scene.elements.filter((element) => ids.has(element.id) && !element.locked)
    if (moving.length < 3) return project
    const span = axis === 'horizontal'
      ? { start: (element: Element) => element.frame.x, size: (element: Element) => element.frame.width }
      : { start: (element: Element) => element.frame.y, size: (element: Element) => element.frame.height }
    const ordered = [...moving].sort((a, b) => span.start(a) - span.start(b))
    const first = ordered[0]!
    const last = ordered[ordered.length - 1]!
    const from = span.start(first)
    const to = span.start(last) + span.size(last)
    const ink = ordered.reduce((sum, element) => sum + span.size(element), 0)
    const gap = (to - from - ink) / (ordered.length - 1)
    if (!Number.isFinite(gap) || gap < 0) return project
    let cursor = from
    const placed = new Map<string, number>()
    for (const element of ordered) {
      placed.set(element.id, cursor)
      cursor += span.size(element) + gap
    }
    return mapScene(project, scene.id, (item) => ({
      ...item,
      elements: item.elements.map((element) => {
        const at = placed.get(element.id)
        if (at === undefined) return element
        return axis === 'horizontal'
          ? { ...element, frame: { ...element.frame, x: at } }
          : { ...element, frame: { ...element.frame, y: at } }
      })
    }))
  })
}

export function bringSelectionForward(): void {
  withScene('Bring forward', (project, scene) => {
    let next = project
    for (const id of useEditorStore.getState().selection) {
      next = bringElementForward(next, scene.id, id)
    }
    return next
  })
}

export function sendSelectionBackward(): void {
  withScene('Send backward', (project, scene) => {
    let next = project
    for (const id of useEditorStore.getState().selection) {
      next = sendElementBackward(next, scene.id, id)
    }
    return next
  })
}

export function toggleSelectedLocked(): void {
  const { project } = useProjectStore.getState()
  if (!project) return
  const scene = activeScene(project)
  const ids = new Set(useEditorStore.getState().selection)
  if (!scene || ids.size === 0) return
  const anyUnlocked = scene.elements.some((element) => ids.has(element.id) && !element.locked)
  useProjectStore.getState().apply(
    anyUnlocked ? 'Lock elements' : 'Unlock elements',
    (current) =>
      scene.elements.reduce(
        (next, element) =>
          ids.has(element.id)
            ? updateElement(next, scene.id, element.id, (item) => ({ ...item, locked: anyUnlocked }))
            : next,
        current
      ),
    { coalesce: false }
  )
}

export function toggleSelectedVisible(): void {
  const { project } = useProjectStore.getState()
  if (!project) return
  const scene = activeScene(project)
  const ids = new Set(useEditorStore.getState().selection)
  if (!scene || ids.size === 0) return
  const anyVisible = scene.elements.some((element) => ids.has(element.id) && element.visible)
  useProjectStore.getState().apply(
    anyVisible ? 'Hide elements' : 'Show elements',
    (current) =>
      scene.elements.reduce(
        (next, element) =>
          ids.has(element.id)
            ? updateElement(next, scene.id, element.id, (item) => ({ ...item, visible: !anyVisible }))
            : next,
        current
      ),
    { coalesce: false }
  )
}

export function createTextAt(point: Vec2): string | null {
  const { project } = useProjectStore.getState()
  if (!project) return null
  const scene = activeScene(project)
  if (!scene) return null

  const frame = rectFromCenter(point, 560, 118)
  const element = createTextElement('Text', {
    name: nextElementName(scene.elements, 'Text'),
    frame
  })
  // Fit to the real ink, then put that box back where the user clicked.
  const fitted = fitTextFrame(element)
  element.frame = { ...fitted, x: point.x - fitted.width / 2, y: point.y - fitted.height / 2 }
  useProjectStore.getState().apply(
    'Add text',
    (current) => addElement(current, scene.id, element),
    { coalesce: false }
  )
  useEditorStore.getState().select([element.id])
  return element.id
}

export function createShapeFromRect(kind: ShapeKind, rect: Rect): string | null {
  const { project } = useProjectStore.getState()
  if (!project) return null
  const scene = activeScene(project)
  if (!scene) return null

  const normalized: Rect = {
    x: rect.x,
    y: rect.y,
    width: Math.max(8, rect.width),
    height: Math.max(8, rect.height)
  }
  const base = kind
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (character) => character.toUpperCase())
  const element = createShapeElement(kind, {
    name: nextElementName(scene.elements, base),
    frame: normalized
  })
  useProjectStore.getState().apply(
    `Add ${base.toLowerCase()}`,
    (current) => addElement(current, scene.id, element),
    { coalesce: false }
  )
  useEditorStore.getState().select([element.id])
  return element.id
}
