import { useMemo } from 'react'
import type { JSX } from 'react'
import { buildSchedule } from '@core/timeline/schedule'
import { BottomDock } from './components/shell/BottomDock'
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
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { usePlaybackClock } from './hooks/usePlaybackClock'
import { useWindowState } from './hooks/useWindowState'
import { useProjectStore } from './state/projectStore'

export default function App(): JSX.Element {
  const project = useProjectStore((state) => state.project)
  const schedule = useMemo(
    () => project ? buildSchedule(project) : { version: 1, duration: 0, scenes: [], elements: {} },
    [project]
  )

  useWindowState()
  useKeyboardShortcuts()
  usePlaybackClock(schedule.duration)

  return (
    <div className="app">
      <TitleBar />
      {project ? (
        <div className="app-body">
          <div className="left-stack">
            <ToolRail />
            <SectionPanel />
          </div>
          <main className="workspace">
            <div className="workspace-canvas">
              <SceneCanvas />
            </div>
            <BottomDock schedule={schedule} />
          </main>
          <Inspector />
        </div>
      ) : (
        <WelcomeScreen />
      )}
      <StatusBar />
      <DialogHost />
      <Overlays />
      <PreviewOverlay />
    </div>
  )
}
