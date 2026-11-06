import { create } from 'zustand'
import type { Element, Project } from '@core/schema/project'
import type { Vec2 } from '@core/schema/primitives'

export type Tool =
  | 'select'
  | 'pan'
  | 'text'
  | 'rectangle'
  | 'roundedRectangle'
  | 'ellipse'
  | 'triangle'
  | 'line'
  | 'arrow'

export type TimelineMode = 'simple' | 'advanced'

export type SectionPanelId = 'scenes' | 'text' | 'image' | 'shapes' | 'camera' | 'music'

export interface ViewportState {
  center: Vec2
  zoom: number
}

interface EditorState {
  activeSceneId: string | null
  selection: string[]
  selectedCameraId: string | null
  tool: Tool
  viewport: ViewportState
  size: { width: number; height: number }
  showGrid: boolean
  snapping: boolean
  timelineMode: TimelineMode
  timelinePps: number
  timelineRowHeight: number
  dockHeight: number
  clipboard: Element[]
  fitNonce: number
  sectionPanel: SectionPanelId | null
  customBackgroundColors: string[]

  initForProject(project: Project): void
  setActiveScene(sceneId: string | null): void
  select(ids: string[]): void
  toggleSelect(id: string): void
  clearSelection(): void
  selectCamera(cameraId: string | null): void
  setTool(tool: Tool): void
  setViewport(viewport: ViewportState): void
  setSize(size: { width: number; height: number }): void
  requestFit(): void
  toggleGrid(): void
  toggleSnapping(): void
  setTimelineMode(mode: TimelineMode): void
  setTimelinePps(pps: number): void
  setTimelineRowHeight(height: number): void
  setDockHeight(height: number): void
  setClipboard(elements: Element[]): void
  toggleSectionPanel(panel: SectionPanelId): void
  closeSectionPanel(): void
  addCustomBackgroundColor(color: string): void
  prune(project: Project): void
}

export const useEditorStore = create<EditorState>((set, get) => ({
  activeSceneId: null,
  selection: [],
  selectedCameraId: null,
  tool: 'select',
  viewport: { center: { x: 0, y: 0 }, zoom: 0.35 },
  size: { width: 0, height: 0 },
  showGrid: false,
  snapping: true,
  timelineMode: 'simple',
  timelinePps: 56,
  timelineRowHeight: 32,
  dockHeight: 146,
  clipboard: [],
  fitNonce: 0,
  sectionPanel: null,
  customBackgroundColors: [],

  initForProject(project) {
    set({
      activeSceneId: project.scenes[0]?.id ?? null,
      selection: [],
      selectedCameraId: null,
      tool: 'select',
      sectionPanel: null,
      fitNonce: get().fitNonce + 1
    })
  },

  setActiveScene(sceneId) {
    const current = get()
    if (current.activeSceneId === sceneId) return
    set({ activeSceneId: sceneId, selection: [], selectedCameraId: null })
  },

  select(ids) {
    set({ selection: ids, selectedCameraId: null })
  },

  toggleSelect(id) {
    const selection = get().selection
    set({
      selection: selection.includes(id)
        ? selection.filter((candidate) => candidate !== id)
        : [...selection, id],
      selectedCameraId: null
    })
  },

  clearSelection() {
    if (get().selection.length === 0 && get().selectedCameraId === null) return
    set({ selection: [], selectedCameraId: null })
  },

  selectCamera(cameraId) {
    set({ selectedCameraId: cameraId, selection: [] })
  },

  setTool(tool) {
    set({ tool })
  },

  setViewport(viewport) {
    set({ viewport })
  },

  setSize(size) {
    const current = get().size
    if (current.width === size.width && current.height === size.height) return
    set({ size })
  },

  requestFit() {
    set({ fitNonce: get().fitNonce + 1 })
  },

  toggleGrid() {
    set({ showGrid: !get().showGrid })
  },

  toggleSnapping() {
    set({ snapping: !get().snapping })
  },

  setTimelineMode(mode) {
    set({ timelineMode: mode })
  },

  setTimelinePps(pps) {
    set({ timelinePps: Math.max(20, Math.min(220, pps)) })
  },

  setTimelineRowHeight(height) {
    set({ timelineRowHeight: Math.max(22, Math.min(68, Math.round(height))) })
  },

  setDockHeight(height) {
    set({ dockHeight: Math.max(120, Math.min(680, height)) })
  },

  setClipboard(elements) {
    set({ clipboard: elements })
  },

  toggleSectionPanel(panel) {
    set({ sectionPanel: get().sectionPanel === panel ? null : panel })
  },

  closeSectionPanel() {
    if (get().sectionPanel === null) return
    set({ sectionPanel: null })
  },

  addCustomBackgroundColor(color) {
    const normalized = color.toLowerCase()
    const colors = get().customBackgroundColors
    if (colors.includes(normalized)) return
    set({ customBackgroundColors: [...colors, normalized].slice(-16) })
  },

  prune(project) {
    const scene = project.scenes.find((candidate) => candidate.id === get().activeSceneId)
    if (!scene) {
      set({
        activeSceneId: project.scenes[0]?.id ?? null,
        selection: [],
        selectedCameraId: null
      })
      return
    }
    const ids = new Set(scene.elements.map((element) => element.id))
    const cameraIds = new Set(scene.cameras.map((camera) => camera.id))
    set({
      selection: get().selection.filter((id) => ids.has(id)),
      selectedCameraId:
        get().selectedCameraId && cameraIds.has(get().selectedCameraId!)
          ? get().selectedCameraId
          : null
    })
  }
}))
