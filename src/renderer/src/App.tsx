import { useMemo, type CSSProperties, type JSX, type PointerEvent as ReactPointerEvent } from 'react'
import { buildSchedule } from '@core/timeline/schedule'
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
import { useWindowState } from './hooks/useWindowState'
import { useEditorStore } from './state/editorStore'
import { useProjectStore } from './state/projectStore'

export default function App(): JSX.Element {
  const project = useProjectStore((state) => state.project)
  const session = useProjectStore((state) => state.session)
  const panelWidth = useEditorStore((state) => state.panelWidth)
  const inspectorWidth = useEditorStore((state) => state.inspectorWidth)
  const setPanelWidth = useEditorStore((state) => state.setPanelWidth)
  const setInspectorWidth = useEditorStore((state) => state.setInspectorWidth)
  const resetPanelWidths = useEditorStore((state) => state.resetPanelWidths)
  const schedule = useMemo(
    () => project ? buildSchedule(project) : { version: 1, duration: 0, scenes: [], elements: {} },
    [project]
  )

  useWindowState()
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
      <DialogHost />
      <CommandPalette />
      <Overlays />
      <PreviewOverlay />
    </div>
  )
}
