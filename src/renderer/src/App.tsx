import {
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type JSX,
  type PointerEvent as ReactPointerEvent
} from 'react'
import { scheduleFor } from '@core/timeline/scheduleCache'
import { BottomDock } from './components/shell/BottomDock'
import { CommandPalette } from './components/overlays/CommandPalette'
import { SceneCanvas } from './components/canvas/SceneCanvas'
import { DialogHost } from './components/dialogs/DialogHost'
import { Inspector } from './components/inspector/Inspector'
import { Overlays } from './components/overlays/Overlays'
import { PreviewOverlay } from './components/overlays/PreviewOverlay'
import { SectionPanel } from './components/panels/SectionPanel'
import { StatusBar } from './components/shell/StatusBar'
import { TitleBar } from './components/shell/TitleBar'
import { ToolRail } from './components/shell/ToolRail'
import { WelcomeScreen } from './components/shell/WelcomeScreen'
import { useAutosave } from './hooks/useAutosave'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { usePlaybackClock } from './hooks/usePlaybackClock'
import { useProjectAudio } from './hooks/useProjectAudio'
import { requestWindowClose } from './services/projectFiles'
import { useEditorStore } from './state/editorStore'
import { useProjectStore } from './state/projectStore'
import { useUiStore } from './state/uiStore'

export default function App(): JSX.Element {
  const project = useProjectStore((state) => state.project)
  const session = useProjectStore((state) => state.session)
  const loading = useUiStore((state) => state.loading !== null)
  const modalOpen = useUiStore(
    (state) =>
      state.dialog !== null ||
      state.confirm !== null ||
      state.paletteOpen ||
      state.previewOpen
  )
  const panelWidth = useEditorStore((state) => state.panelWidth)
  const inspectorWidth = useEditorStore((state) => state.inspectorWidth)
  const setPanelWidth = useEditorStore((state) => state.setPanelWidth)
  const setInspectorWidth = useEditorStore((state) => state.setInspectorWidth)
  const resetPanelWidths = useEditorStore((state) => state.resetPanelWidths)
  const schedule = useMemo(
    () => project ? scheduleFor(project) : { version: 1, duration: 0, scenes: [], elements: {} },
    [project]
  )
  const shellRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const dispose = window.api.window.onCloseRequested(() => {
      void requestWindowClose()
    })
    return dispose
  }, [])

  // Keep the editor out of the tab order and the accessibility tree while a
  // project is loading or a dialog owns the screen. Dialogs, the palette, the
  // preview and the loading scrim all render as siblings of this shell.
  useEffect(() => {
    const shell = shellRef.current
    if (!shell) return
    shell.toggleAttribute('inert', loading || modalOpen)
  }, [loading, modalOpen])

  useKeyboardShortcuts()
  useAutosave()
  usePlaybackClock(schedule.duration)
  useProjectAudio(project, schedule, session?.assetToken ?? '')

  const dragPanel = (event: ReactPointerEvent<HTMLDivElement>): void => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = panelWidth
    const move = (moveEvent: PointerEvent): void =>
      setPanelWidth(startWidth + (moveEvent.clientX - startX))
    const up = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      document.body.classList.remove('resizing-panels')
    }
    document.body.classList.add('resizing-panels')
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const dragInspector = (event: ReactPointerEvent<HTMLDivElement>): void => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = inspectorWidth
    const move = (moveEvent: PointerEvent): void =>
      setInspectorWidth(startWidth - (moveEvent.clientX - startX))
    const up = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      document.body.classList.remove('resizing-panels')
    }
    document.body.classList.add('resizing-panels')
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div className="app">
      <div className="app-shell" ref={shellRef}>
        <TitleBar />
        {project ? (
          <div
            className="app-body"
            style={{
              '--panel-width': `${panelWidth}px`,
              '--inspector-width': `${inspectorWidth}px`
            } as CSSProperties}
          >
            <div className="left-stack">
              <ToolRail />
              <SectionPanel />
            </div>
            <div
              className="panel-splitter"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize library panel"
              title="Drag to resize · double-click to reset"
              onPointerDown={dragPanel}
              onDoubleClick={resetPanelWidths}
            />
            <main className="workspace">
              <div className="workspace-canvas">
                <SceneCanvas />
              </div>
              <BottomDock schedule={schedule} />
            </main>
            <div
              className="panel-splitter"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize inspector"
              title="Drag to resize · double-click to reset"
              onPointerDown={dragInspector}
              onDoubleClick={resetPanelWidths}
            />
            <Inspector />
          </div>
        ) : (
          <WelcomeScreen />
        )}
        <StatusBar />
      </div>
      <DialogHost />
      <CommandPalette />
      <Overlays />
      <PreviewOverlay />
    </div>
  )
}
