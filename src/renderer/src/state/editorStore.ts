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

export type SectionPanelId =
  | 'scenes'
  | 'layers'
  | 'text'
  | 'image'
  | 'shapes'
  | 'camera'
  | 'music'

export interface ViewportState {
  center: Vec2
  zoom: number
}

const PANEL_STORAGE_KEY = 'ows.panelWidth'
const INSPECTOR_STORAGE_KEY = 'ows.inspectorWidth'

function storedWidth(key: string, fallback: number, min: number, max: number): number {
  try {
    const raw = window.localStorage.getItem(key)
    const parsed = raw === null ? Number.NaN : Number(raw)
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback
  } catch {
    return fallback
  }
}

function rememberWidth(key: string, value: number): void {
  try {
    window.localStorage.setItem(key, String(value))
  } catch {
    // A blocked storage area must never break the layout.
  }
}

interface EditorState {
  activeSceneId: string | null
  selection: string[]
  selectedCameraId: string | null
  selectedAudioTrackId: string | null
  tool: Tool
  viewport: ViewportState
  size: { width: number; height: number }
  showGrid: boolean
  snapping: boolean
  timelineMode: TimelineMode
  timelinePps: number
  timelineRowHeight: number
  dockHeight: number
  panelWidth: number
  inspectorWidth: number
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
  selectAudioTrack(trackId: string | null): void
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
  setPanelWidth(width: number): void
  setInspectorWidth(width: number): void
  resetPanelWidths(): void
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
  selectedAudioTrackId: null,
  tool: 'select',
  viewport: { center: { x: 0, y: 0 }, zoom: 0.35 },
  size: { width: 0, height: 0 },
  showGrid: false,
  snapping: true,
  timelineMode: 'simple',
  timelinePps: 56,
  timelineRowHeight: 32,
  dockHeight: 146,
  panelWidth: storedWidth(PANEL_STORAGE_KEY, 236, 190, 420),
  inspectorWidth: storedWidth(INSPECTOR_STORAGE_KEY, 300, 250, 460),
  clipboard: [],
  fitNonce: 0,
  sectionPanel: null,
  customBackgroundColors: [],

  initForProject(project) {
    set({
      activeSceneId: project.scenes[0]?.id ?? null,
      selection: [],
      selectedCameraId: null,
      selectedAudioTrackId: null,
      tool: 'select',
      sectionPanel: null,
      fitNonce: get().fitNonce + 1
    })
  },

  setActiveScene(sceneId) {
    const current = get()
    if (current.activeSceneId === sceneId) return
    set({ activeSceneId: sceneId, selection: [], selectedCameraId: null, selectedAudioTrackId: null })
  },

  select(ids) {
    set({ selection: ids, selectedCameraId: null, selectedAudioTrackId: null })
  },

  toggleSelect(id) {
    const selection = get().selection
    set({
      selection: selection.includes(id)
        ? selection.filter((candidate) => candidate !== id)
        : [...selection, id],
      selectedCameraId: null,
      selectedAudioTrackId: null
    })
  },

  clearSelection() {
    if (
      get().selection.length === 0 &&
      get().selectedCameraId === null &&
      get().selectedAudioTrackId === null
    ) {
      return
    }
    set({ selection: [], selectedCameraId: null, selectedAudioTrackId: null })
  },

  selectCamera(cameraId) {
    set({ selectedCameraId: cameraId, selection: [], selectedAudioTrackId: null })
  },

  selectAudioTrack(trackId) {
    set({ selectedAudioTrackId: trackId, selection: [], selectedCameraId: null })
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

  setPanelWidth(width) {
    const next = Math.max(190, Math.min(420, Math.round(width)))
    rememberWidth(PANEL_STORAGE_KEY, next)
    set({ panelWidth: next })
  },

  setInspectorWidth(width) {
    const next = Math.max(250, Math.min(460, Math.round(width)))
    rememberWidth(INSPECTOR_STORAGE_KEY, next)
    set({ inspectorWidth: next })
  },

  resetPanelWidths() {
    rememberWidth(PANEL_STORAGE_KEY, 236)
    rememberWidth(INSPECTOR_STORAGE_KEY, 300)
    set({ panelWidth: 236, inspectorWidth: 300 })
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
        selectedCameraId: null,
        selectedAudioTrackId: null
      })
      return
    }
    const ids = new Set(scene.elements.map((element) => element.id))
    const cameraIds = new Set(scene.cameras.map((camera) => camera.id))
    const audioIds = new Set(scene.audio.map((track) => track.id))
    set({
      selection: get().selection.filter((id) => ids.has(id)),
      selectedCameraId:
        get().selectedCameraId && cameraIds.has(get().selectedCameraId!)
          ? get().selectedCameraId
          : null,
      selectedAudioTrackId:
        get().selectedAudioTrackId && audioIds.has(get().selectedAudioTrackId!)
          ? get().selectedAudioTrackId
          : null
    })
  }
}))
